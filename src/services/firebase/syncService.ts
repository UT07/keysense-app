/**
 * Sync Service
 * Manages offline queue and bidirectional sync with Firebase.
 * Changes are queued in AsyncStorage and flushed to Firestore
 * via syncProgress. Supports periodic sync and retry logic.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './config';
import { syncProgress } from './firestore';
import type { ProgressChange } from './firestore';

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
        // Nothing to sync, but still report success
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
// Singleton Export
// ============================================================================

export const syncManager = new SyncManager();
