/**
 * Sync Service
 * Manages offline queue and bidirectional sync with Firebase.
 * Changes are queued in AsyncStorage and flushed to Firestore
 * via syncProgress. Supports periodic sync and retry logic.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './config';
import {
  syncProgress, getAllLessonProgress, getGamificationData, addXp, createGamificationData,
  getCatEvolutionData, saveCatEvolutionData, getGemSyncData, saveGemSyncData,
} from './firestore';
import type { ProgressChange, LessonProgress as FirestoreLessonProgress } from './firestore';
import { useProgressStore } from '../../stores/progressStore';
import { logger } from '../../utils/logger';
import { useCatEvolutionStore } from '../../stores/catEvolutionStore';
import { useGemStore } from '../../stores/gemStore';
import { levelFromXp } from '../../core/progression/XpSystem';
import type { LessonProgress, ExerciseProgress } from '../../core/exercises/types';

// ============================================================================
// Constants
// ============================================================================

const QUEUE_KEY = 'keysense_sync_queue';
const LAST_SYNC_KEY = 'keysense_last_sync';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;
const DEFAULT_SYNC_INTERVAL = 300000; // 5 minutes

// ============================================================================
// Types
// ============================================================================

export interface SyncChange {
  type: 'exercise_completed' | 'xp_earned' | 'settings_changed';
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  lessonProgress?: {
    lessonId: string;
    status: 'in_progress' | 'completed';
    completedAt?: number;
    exerciseId: string;
    exerciseScore: {
      highScore: number;
      stars: number;
      attempts: number;
      averageScore: number;
    };
  };
}

export interface SyncResult {
  success: boolean;
  changesUploaded: number;
  changesDownloaded: number;
  conflicts: number;
}

// ============================================================================
// SyncManager Class
// ============================================================================

export class SyncManager {
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  // --------------------------------------------------------------------------
  // Periodic Sync
  // --------------------------------------------------------------------------

  /**
   * Start periodic sync at the given interval (default 5 minutes).
   * If already running, stops the existing timer first.
   */
  startPeriodicSync(intervalMs: number = DEFAULT_SYNC_INTERVAL): void {
    if (this.syncTimer !== null) {
      this.stopPeriodicSync();
    }
    this.syncTimer = setInterval(() => {
      this.flushQueue();
      // Also pull remote changes so cross-device updates are picked up
      this.pullRemoteProgress().catch(() => {});
    }, intervalMs);
  }

  /**
   * Stop periodic sync.
   */
  stopPeriodicSync(): void {
    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Returns true if periodic sync is currently active.
   */
  isPeriodicSyncActive(): boolean {
    return this.syncTimer !== null;
  }

  // --------------------------------------------------------------------------
  // Queue Management
  // --------------------------------------------------------------------------

  /**
   * Queue a change for later sync. Persisted to AsyncStorage.
   * Enforces MAX_QUEUE_SIZE by dropping oldest items.
   */
  async queueChange(change: SyncChange): Promise<void> {
    const queue = await this.loadQueue();
    queue.push(change);

    // Drop oldest items if queue exceeds max size
    while (queue.length > MAX_QUEUE_SIZE) {
      queue.shift();
    }

    await this.saveQueue(queue);
  }

  // --------------------------------------------------------------------------
  // Flush
  // --------------------------------------------------------------------------

  /**
   * Flush the offline queue to Firestore via syncProgress.
   * On success: clears queue and saves new sync timestamp.
   * On failure: increments retryCount, drops items that exceed MAX_RETRIES.
   */
  async flushQueue(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const queue = await this.loadQueue();
    if (queue.length === 0) return;

    // Filter out items that have already exceeded max retries
    const validItems = queue.filter((item) => item.retryCount < MAX_RETRIES);
    if (validItems.length === 0) {
      // All items expired -- clear queue
      await AsyncStorage.removeItem(QUEUE_KEY);
      return;
    }

    try {
      const lastSyncRaw = await AsyncStorage.getItem(LAST_SYNC_KEY);
      const lastSyncTimestamp = lastSyncRaw ? parseInt(lastSyncRaw, 10) : 0;

      // Convert SyncChange items to ProgressChange-compatible format for syncProgress
      const localChanges: ProgressChange[] = validItems.map((item, index) => ({
        id: `local-${item.timestamp}-${index}`,
        type: item.type as ProgressChange['type'],
        exerciseId: item.data.exerciseId as string | undefined,
        score: item.data.score as number | undefined,
        xpAmount: item.data.xpAmount as number | undefined,
        timestamp: { toMillis: () => item.timestamp } as ProgressChange['timestamp'],
        synced: false,
        lessonProgress: item.lessonProgress,
      }));

      const response = await syncProgress(uid, {
        lastSyncTimestamp,
        localChanges,
      });

      // Success: clear queue and save new timestamp
      await AsyncStorage.removeItem(QUEUE_KEY);
      await AsyncStorage.setItem(
        LAST_SYNC_KEY,
        String(response.newSyncTimestamp)
      );

      // Also sync XP to gamification doc so pullRemoteProgress can read it
      try {
        const localXp = useProgressStore.getState().totalXp;
        const remoteGam = await getGamificationData(uid);
        if (!remoteGam) {
          await createGamificationData(uid);
          if (localXp > 0) await addXp(uid, localXp, 'sync');
        } else if (localXp > remoteGam.xp) {
          await addXp(uid, localXp - remoteGam.xp, 'sync');
        }
      } catch {
        // Non-critical: XP sync failure doesn't block queue flush
      }

      // Sync cat evolution + gem data to Firestore
      await this.pushCatAndGemData(uid);
    } catch {
      // Failure: increment retryCount on valid items
      const updatedQueue = validItems.map((item) => ({
        ...item,
        retryCount: item.retryCount + 1,
      }));
      await this.saveQueue(updatedQueue);
    }
  }

  // --------------------------------------------------------------------------
  // Sync After Exercise
  // --------------------------------------------------------------------------

  /**
   * Queue an exercise completion and immediately attempt to flush.
   * Failures are silently caught (will be retried on next flush).
   */
  async syncAfterExercise(
    exerciseId: string,
    score: Record<string, unknown>,
    lessonProgress?: SyncChange['lessonProgress']
  ): Promise<void> {
    const change: SyncChange = {
      type: 'exercise_completed',
      data: { exerciseId, ...score },
      timestamp: Date.now(),
      retryCount: 0,
      lessonProgress,
    };

    await this.queueChange(change);

    // Attempt immediate flush (don't throw if it fails)
    try {
      await this.flushQueue();
    } catch {
      // Will be retried on next periodic flush or manual sync
    }
  }

  // --------------------------------------------------------------------------
  // Full Bidirectional Sync
  // --------------------------------------------------------------------------

  /**
   * Full sync: flush queue then report results.
   * Prevents concurrent syncs via isSyncing flag.
   */
  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        changesUploaded: 0,
        changesDownloaded: 0,
        conflicts: 0,
      };
    }

    this.isSyncing = true;

    try {
      const uid = auth.currentUser?.uid;
      if (!uid) {
        return {
          success: false,
          changesUploaded: 0,
          changesDownloaded: 0,
          conflicts: 0,
        };
      }

      // Load queue to count uploads
      const queue = await this.loadQueue();
      const validItems = queue.filter((item) => item.retryCount < MAX_RETRIES);
      const changesUploaded = validItems.length;

      if (changesUploaded === 0) {
        // No local changes to upload, but still pull remote updates
        await this.pullRemoteProgress().catch(() => {});
        return {
          success: true,
          changesUploaded: 0,
          changesDownloaded: 0,
          conflicts: 0,
        };
      }

      const lastSyncRaw = await AsyncStorage.getItem(LAST_SYNC_KEY);
      const lastSyncTimestamp = lastSyncRaw ? parseInt(lastSyncRaw, 10) : 0;

      const localChanges: ProgressChange[] = validItems.map((item, index) => ({
        id: `local-${item.timestamp}-${index}`,
        type: item.type as ProgressChange['type'],
        exerciseId: item.data.exerciseId as string | undefined,
        score: item.data.score as number | undefined,
        xpAmount: item.data.xpAmount as number | undefined,
        timestamp: { toMillis: () => item.timestamp } as ProgressChange['timestamp'],
        synced: false,
        lessonProgress: item.lessonProgress,
      }));

      try {
        const response = await syncProgress(uid, {
          lastSyncTimestamp,
          localChanges,
        });

        // Success
        await AsyncStorage.removeItem(QUEUE_KEY);
        await AsyncStorage.setItem(
          LAST_SYNC_KEY,
          String(response.newSyncTimestamp)
        );

        return {
          success: true,
          changesUploaded,
          changesDownloaded: response.serverChanges.length,
          conflicts: response.conflicts.length,
        };
      } catch {
        // Flush failed -- increment retry counts
        const updatedQueue = validItems.map((item) => ({
          ...item,
          retryCount: item.retryCount + 1,
        }));
        await this.saveQueue(updatedQueue);

        return {
          success: false,
          changesUploaded: 0,
          changesDownloaded: 0,
          conflicts: 0,
        };
      }
    } finally {
      this.isSyncing = false;
    }
  }

  // --------------------------------------------------------------------------
  // Pull Remote State (Download)
  // --------------------------------------------------------------------------

  /**
   * Fetch progress from Firestore and merge with local state.
   * Uses "highest wins" strategy: higher XP, higher scores, more attempts.
   * Called on app startup when authenticated and after sign-in on a new device.
   */
  async pullRemoteProgress(): Promise<{
    pulled: boolean;
    merged: boolean;
    error?: string;
  }> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      return { pulled: false, merged: false, error: 'No authenticated user' };
    }

    try {
      // Fetch remote data in parallel
      const [remoteLessons, remoteGamification, remoteCats, remoteGems] = await Promise.all([
        getAllLessonProgress(uid),
        getGamificationData(uid),
        getCatEvolutionData(uid).catch(() => null),
        getGemSyncData(uid).catch(() => null),
      ]);

      if (!remoteLessons.length && !remoteGamification && !remoteCats && !remoteGems) {
        logger.log('[Sync] No remote data found — nothing to pull');
        return { pulled: true, merged: false };
      }

      const localState = useProgressStore.getState();
      let didMerge = false;

      // Merge XP: take the higher value
      if (remoteGamification && remoteGamification.xp > localState.totalXp) {
        useProgressStore.setState({
          totalXp: remoteGamification.xp,
          level: levelFromXp(remoteGamification.xp),
        });
        didMerge = true;
        logger.log(
          `[Sync] Merged remote XP: ${remoteGamification.xp} (local was ${localState.totalXp})`,
        );
      }

      // Merge streak: take the one with the higher current streak
      if (remoteGamification) {
        const remoteStreak = remoteGamification.streak;
        const localStreak = localState.streakData;
        if (remoteStreak.currentStreak > localStreak.currentStreak) {
          useProgressStore.getState().updateStreakData({
            currentStreak: remoteStreak.currentStreak,
            longestStreak: Math.max(
              remoteStreak.longestStreak,
              localStreak.longestStreak,
            ),
            lastPracticeDate: remoteStreak.lastPracticeDate,
          });
          didMerge = true;
        } else if (
          remoteStreak.longestStreak > localStreak.longestStreak
        ) {
          useProgressStore.getState().updateStreakData({
            longestStreak: remoteStreak.longestStreak,
          });
          didMerge = true;
        }
      }

      // Merge lesson progress: per-exercise, take higher scores
      if (remoteLessons.length > 0) {
        for (const remoteLesson of remoteLessons) {
          const localLesson = localState.lessonProgress[remoteLesson.lessonId];

          if (!localLesson) {
            // Lesson doesn't exist locally — adopt the remote version entirely
            const convertedLesson = convertFirestoreLesson(remoteLesson);
            useProgressStore
              .getState()
              .updateLessonProgress(remoteLesson.lessonId, convertedLesson);
            didMerge = true;
            continue;
          }

          // Lesson exists locally — merge per-exercise scores
          let lessonChanged = false;
          const remoteScores = remoteLesson.exerciseScores ?? {};
          for (const [exId, remoteEx] of Object.entries(remoteScores)) {
            const localEx = localLesson.exerciseScores[exId];

            if (!localEx) {
              // Exercise doesn't exist locally — adopt remote
              useProgressStore.getState().updateExerciseProgress(
                remoteLesson.lessonId,
                exId,
                convertFirestoreExercise(remoteEx),
              );
              lessonChanged = true;
            } else if (remoteEx.highScore > localEx.highScore) {
              // Remote has a higher score — take it
              useProgressStore.getState().updateExerciseProgress(
                remoteLesson.lessonId,
                exId,
                {
                  ...localEx,
                  highScore: remoteEx.highScore,
                  stars: Math.max(remoteEx.stars, localEx.stars) as 0 | 1 | 2 | 3,
                  attempts: Math.max(remoteEx.attempts, localEx.attempts),
                  averageScore: remoteEx.averageScore,
                },
              );
              lessonChanged = true;
            } else if (remoteEx.attempts > localEx.attempts) {
              // Remote has more attempts (even if score is lower)
              useProgressStore.getState().updateExerciseProgress(
                remoteLesson.lessonId,
                exId,
                {
                  ...localEx,
                  attempts: remoteEx.attempts,
                },
              );
              lessonChanged = true;
            }
          }

          // Upgrade lesson status if remote is more advanced
          const statusRank = { locked: 0, available: 1, in_progress: 2, completed: 3 };
          if (statusRank[remoteLesson.status] > statusRank[localLesson.status]) {
            useProgressStore.getState().updateLessonProgress(
              remoteLesson.lessonId,
              {
                ...localLesson,
                ...(lessonChanged
                  ? useProgressStore.getState().lessonProgress[remoteLesson.lessonId]
                  : {}),
                status: remoteLesson.status,
                ...(remoteLesson.completedAt
                  ? {
                      completedAt:
                        typeof remoteLesson.completedAt === 'object' &&
                        'toMillis' in remoteLesson.completedAt
                          ? (remoteLesson.completedAt as any).toMillis()
                          : undefined,
                    }
                  : {}),
              },
            );
            lessonChanged = true;
          }

          if (lessonChanged) didMerge = true;
        }
      }

      // Merge cat evolution: union of owned cats, higher XP per cat
      if (remoteCats && remoteCats.ownedCats.length > 0) {
        const localCats = useCatEvolutionStore.getState();
        const mergedOwned = new Set([...localCats.ownedCats, ...remoteCats.ownedCats]);

        if (mergedOwned.size > localCats.ownedCats.length) {
          // Remote has cats we don't have locally — adopt them
          for (const catId of remoteCats.ownedCats) {
            if (!localCats.ownedCats.includes(catId)) {
              useCatEvolutionStore.getState().unlockCat(catId);
            }
          }
          didMerge = true;
        }

        // Merge per-cat XP: take higher XP
        for (const [catId, remoteCat] of Object.entries(remoteCats.evolutionData)) {
          const localCat = localCats.evolutionData[catId];
          if (localCat && remoteCat.xpAccumulated > localCat.xpAccumulated) {
            const diff = remoteCat.xpAccumulated - localCat.xpAccumulated;
            useCatEvolutionStore.getState().addEvolutionXp(catId, diff);
            didMerge = true;
          }
        }

        // If remote has a selected cat and local doesn't, adopt it
        if (remoteCats.selectedCatId && !localCats.selectedCatId) {
          useCatEvolutionStore.getState().selectCat(remoteCats.selectedCatId);
          didMerge = true;
        }

        logger.log(`[Sync] Cat evolution merged: ${mergedOwned.size} total cats`);
      }

      // Merge gems: take higher balance
      if (remoteGems) {
        const localGems = useGemStore.getState();
        if (remoteGems.gems > localGems.gems) {
          const diff = remoteGems.gems - localGems.gems;
          useGemStore.getState().earnGems(diff, 'cloud-sync');
          didMerge = true;
          logger.log(`[Sync] Merged remote gems: ${remoteGems.gems} (local was ${localGems.gems})`);
        }
      }

      if (didMerge) {
        logger.log('[Sync] Remote progress merged into local state');
      }

      return { pulled: true, merged: didMerge };
    } catch (error) {
      const msg = (error as Error)?.message ?? 'Unknown error';
      logger.warn('[Sync] Failed to pull remote progress:', msg);
      return { pulled: false, merged: false, error: msg };
    }
  }

  // --------------------------------------------------------------------------
  // Cat Evolution & Gem Sync
  // --------------------------------------------------------------------------

  /**
   * Push local cat evolution + gem data to Firestore.
   * Uses "highest wins" for gems: only pushes if local balance exceeds remote.
   * For cats: merges owned cats (union), takes higher XP per cat.
   */
  async pushCatAndGemData(uid?: string): Promise<void> {
    const resolvedUid = uid ?? auth.currentUser?.uid;
    if (!resolvedUid) return;

    try {
      // Push cat evolution data
      const catState = useCatEvolutionStore.getState();
      if (catState.ownedCats.length > 0) {
        const evolutionData: Record<string, {
          catId: string;
          currentStage: string;
          xpAccumulated: number;
          abilitiesUnlocked: string[];
        }> = {};

        for (const catId of catState.ownedCats) {
          const data = catState.evolutionData[catId];
          if (data) {
            evolutionData[catId] = {
              catId: data.catId,
              currentStage: data.currentStage,
              xpAccumulated: data.xpAccumulated,
              abilitiesUnlocked: data.abilitiesUnlocked,
            };
          }
        }

        const remoteCats = await getCatEvolutionData(resolvedUid);

        // Merge: take higher XP per cat, union of owned cats
        if (remoteCats) {
          const mergedOwned = new Set([...catState.ownedCats, ...remoteCats.ownedCats]);
          const mergedEvolution = { ...evolutionData };
          for (const [catId, remoteCat] of Object.entries(remoteCats.evolutionData)) {
            if (!mergedEvolution[catId]) {
              mergedEvolution[catId] = remoteCat;
            } else if (remoteCat.xpAccumulated > mergedEvolution[catId].xpAccumulated) {
              mergedEvolution[catId] = remoteCat;
            }
          }

          await saveCatEvolutionData(resolvedUid, {
            selectedCatId: catState.selectedCatId,
            ownedCats: Array.from(mergedOwned),
            evolutionData: mergedEvolution,
          });
        } else {
          await saveCatEvolutionData(resolvedUid, {
            selectedCatId: catState.selectedCatId,
            ownedCats: catState.ownedCats,
            evolutionData,
          });
        }
      }
    } catch {
      // Non-critical: cat sync failure doesn't block
    }

    try {
      // Push gem data
      const gemState = useGemStore.getState();
      const remoteGems = await getGemSyncData(resolvedUid);

      if (!remoteGems || gemState.gems > remoteGems.gems || gemState.totalGemsEarned > remoteGems.totalGemsEarned) {
        await saveGemSyncData(resolvedUid, {
          gems: Math.max(gemState.gems, remoteGems?.gems ?? 0),
          totalGemsEarned: Math.max(gemState.totalGemsEarned, remoteGems?.totalGemsEarned ?? 0),
          totalGemsSpent: Math.max(gemState.totalGemsSpent, remoteGems?.totalGemsSpent ?? 0),
        });
      }
    } catch {
      // Non-critical: gem sync failure doesn't block
    }
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async loadQueue(): Promise<SyncChange[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as SyncChange[];
    } catch {
      return [];
    }
  }

  private async saveQueue(queue: SyncChange[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

// ============================================================================
// Firestore → Local Type Converters
// ============================================================================

function convertFirestoreExercise(
  remote: FirestoreLessonProgress['exerciseScores'][string],
): ExerciseProgress {
  return {
    exerciseId: remote.exerciseId,
    highScore: remote.highScore,
    stars: remote.stars as 0 | 1 | 2 | 3,
    attempts: remote.attempts,
    lastAttemptAt:
      remote.lastAttemptAt && typeof remote.lastAttemptAt === 'object' && 'toMillis' in remote.lastAttemptAt
        ? (remote.lastAttemptAt as any).toMillis()
        : Date.now(),
    averageScore: remote.averageScore,
    completedAt: remote.highScore > 0 ? Date.now() : undefined,
  };
}

function convertFirestoreLesson(remote: FirestoreLessonProgress): LessonProgress {
  const exerciseScores: Record<string, ExerciseProgress> = {};
  for (const [exId, exData] of Object.entries(remote.exerciseScores ?? {})) {
    exerciseScores[exId] = convertFirestoreExercise(exData);
  }

  return {
    lessonId: remote.lessonId,
    status: remote.status,
    exerciseScores,
    bestScore: remote.bestScore,
    completedAt:
      remote.completedAt && typeof remote.completedAt === 'object' && 'toMillis' in remote.completedAt
        ? (remote.completedAt as any).toMillis()
        : undefined,
    totalAttempts: remote.totalAttempts,
    totalTimeSpentSeconds: remote.totalTimeSpentSeconds,
  };
}

// ============================================================================
// Singleton Export
// ============================================================================

export const syncManager = new SyncManager();
