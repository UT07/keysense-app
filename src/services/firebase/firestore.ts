/**
 * Firestore Data Service
 * Handles all Firestore operations including data models and sync
 */

import {
  doc,
  collection,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  Timestamp,
  FieldValue,
  increment,
} from 'firebase/firestore';
import { db, functions } from './config';
import { httpsCallable } from 'firebase/functions';

// ============================================================================
// Type Definitions (matching PRD section 5.3)
// ============================================================================

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Date | Timestamp | FieldValue;
  settings: {
    dailyGoalMinutes: number;
    reminderTime: string | null;
    soundEnabled: boolean;
    hapticEnabled: boolean;
    preferredHand: 'right' | 'left' | 'both';
  };
  equipment: {
    hasMidiKeyboard: boolean;
    midiDeviceName: string | null;
  };
  subscription: {
    tier: 'free' | 'pro';
    expiresAt: Timestamp | null;
  };
}

export interface LessonProgress {
  lessonId: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  exerciseScores: Record<string, ExerciseProgress>;
  bestScore: number;
  completedAt: Timestamp | null;
  totalAttempts: number;
  totalTimeSpentSeconds: number;
}

export interface ExerciseProgress {
  exerciseId: string;
  highScore: number;
  stars: 0 | 1 | 2 | 3;
  attempts: number;
  lastAttemptAt: Timestamp;
  averageScore: number;
}

export interface GamificationData {
  uid: string;
  xp: number;
  level: number;
  streak: {
    currentStreak: number;
    longestStreak: number;
    lastPracticeDate: string;
    freezesAvailable: number;
    freezesUsed: number;
    weeklyPractice: boolean[];
  };
  achievements: string[];
  dailyProgress: {
    date: string;
    exercisesCompleted: number;
    minutesPracticed: number;
    xpEarned: number;
  };
}

export interface ProgressChange {
  id: string;
  type: 'exercise_completed' | 'xp_earned' | 'level_up' | 'streak_updated';
  exerciseId?: string;
  score?: number;
  xpAmount?: number;
  timestamp: Timestamp;
  synced: boolean;
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

export interface ConflictResolution {
  field: string;
  localValue: any;
  serverValue: any;
  resolution: 'local' | 'server' | 'merged';
  resolvedValue: any;
}

// ============================================================================
// User Profile Operations
// ============================================================================

export async function createUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  const userDoc = doc(db, 'users', uid);
  const defaultProfile: Partial<UserProfile> = {
    uid,
    email: data.email || '',
    displayName: data.displayName || 'Learner',
    createdAt: serverTimestamp(),
    settings: {
      dailyGoalMinutes: 15,
      reminderTime: '09:00',
      soundEnabled: true,
      hapticEnabled: true,
      preferredHand: 'both',
    },
    equipment: {
      hasMidiKeyboard: false,
      midiDeviceName: null,
    },
    subscription: {
      tier: 'free',
      expiresAt: null,
    },
  };

  await setDoc(userDoc, { ...defaultProfile, ...data }, { merge: true });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userDoc = doc(db, 'users', uid);
  const docSnap = await getDoc(userDoc);

  if (!docSnap.exists()) {
    return null;
  }

  return docSnap.data() as UserProfile;
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const userDoc = doc(db, 'users', uid);
  await updateDoc(userDoc, updates);
}

// ============================================================================
// Lesson Progress Operations
// ============================================================================

export async function getLessonProgress(
  uid: string,
  lessonId: string
): Promise<LessonProgress | null> {
  const progressDoc = doc(db, 'users', uid, 'progress', lessonId);
  const docSnap = await getDoc(progressDoc);

  if (!docSnap.exists()) {
    return null;
  }

  return docSnap.data() as LessonProgress;
}

export async function getAllLessonProgress(uid: string): Promise<LessonProgress[]> {
  const progressCollection = collection(db, 'users', uid, 'progress');
  const querySnapshot = await getDocs(
    query(progressCollection, orderBy('lessonId', 'asc'))
  );

  return querySnapshot.docs.map((doc) => doc.data() as LessonProgress);
}

export async function updateLessonProgress(
  uid: string,
  lessonId: string,
  updates: Partial<LessonProgress>
): Promise<void> {
  const progressDoc = doc(db, 'users', uid, 'progress', lessonId);
  const updateData = {
    ...updates,
    ...(updates.completedAt && { completedAt: serverTimestamp() }),
  };
  await updateDoc(progressDoc, updateData);
}

export async function createLessonProgress(
  uid: string,
  lessonId: string,
  data: Partial<LessonProgress>
): Promise<void> {
  const progressDoc = doc(db, 'users', uid, 'progress', lessonId);
  const defaultProgress: Partial<LessonProgress> = {
    lessonId,
    status: 'available',
    exerciseScores: {},
    bestScore: 0,
    completedAt: null,
    totalAttempts: 0,
    totalTimeSpentSeconds: 0,
  };

  await setDoc(progressDoc, { ...defaultProgress, ...data }, { merge: true });
}

// ============================================================================
// Gamification Operations
// ============================================================================

export async function getGamificationData(uid: string): Promise<GamificationData | null> {
  const gamDoc = doc(db, 'users', uid, 'gamification', 'data');
  const docSnap = await getDoc(gamDoc);

  if (!docSnap.exists()) {
    return null;
  }

  return docSnap.data() as GamificationData;
}

export async function createGamificationData(uid: string): Promise<void> {
  const gamDoc = doc(db, 'users', uid, 'gamification', 'data');
  const defaultData: GamificationData = {
    uid,
    xp: 0,
    level: 1,
    streak: {
      currentStreak: 0,
      longestStreak: 0,
      lastPracticeDate: new Date().toISOString().split('T')[0],
      freezesAvailable: 1,
      freezesUsed: 0,
      weeklyPractice: [false, false, false, false, false, false, false],
    },
    achievements: [],
    dailyProgress: {
      date: new Date().toISOString().split('T')[0],
      exercisesCompleted: 0,
      minutesPracticed: 0,
      xpEarned: 0,
    },
  };

  // Use merge to avoid overwriting existing cloud data from another device
  const existing = await getDoc(gamDoc);
  if (existing.exists()) {
    // Doc already exists — don't overwrite
    return;
  }
  await setDoc(gamDoc, defaultData);
}

export async function addXp(uid: string, amount: number, source: string): Promise<number> {
  const gamDoc = doc(db, 'users', uid, 'gamification', 'data');
  const docSnap = await getDoc(gamDoc);

  if (!docSnap.exists()) {
    await createGamificationData(uid);
  }

  const currentData = (await getGamificationData(uid))!;
  const newXp = currentData.xp + amount;
  const newLevel = calculateLevel(newXp);

  await updateDoc(gamDoc, {
    xp: newXp,
    level: newLevel,
  });

  // Log XP change (best-effort — xpLog rules may block client writes)
  try {
    const logCollection = collection(db, 'users', uid, 'xpLog');
    await setDoc(doc(logCollection), {
      amount,
      source,
      newTotal: newXp,
      timestamp: serverTimestamp(),
    });
  } catch {
    // xpLog write failure is non-critical — gamification doc was already updated
  }

  return newLevel;
}

export async function updateStreak(uid: string, increment: boolean): Promise<void> {
  const gamDoc = doc(db, 'users', uid, 'gamification', 'data');
  const gamData = await getGamificationData(uid);

  if (!gamData) {
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const lastPracticeDate = gamData.streak.lastPracticeDate;

  let newStreak = gamData.streak.currentStreak;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Check if streak is still active
  if (lastPracticeDate === yesterday || lastPracticeDate === today) {
    if (increment) {
      newStreak = gamData.streak.currentStreak + 1;
    }
  } else {
    // Streak broken, reset
    newStreak = increment ? 1 : 0;
  }

  const longestStreak = Math.max(newStreak, gamData.streak.longestStreak);

  await updateDoc(gamDoc, {
    'streak.currentStreak': newStreak,
    'streak.longestStreak': longestStreak,
    'streak.lastPracticeDate': today,
  });
}

// ============================================================================
// Progress Sync & Conflict Resolution
// ============================================================================

export interface SyncRequest {
  lastSyncTimestamp: number;
  localChanges: ProgressChange[];
}

export interface SyncResponse {
  serverChanges: ProgressChange[];
  newSyncTimestamp: number;
  conflicts: ConflictResolution[];
}

/**
 * Sync local progress changes with server
 * Implements last-write-wins with conflict detection
 */
export async function syncProgress(uid: string, request: SyncRequest): Promise<SyncResponse> {
  const batch = writeBatch(db);
  const conflicts: ConflictResolution[] = [];

  // Get server changes since last sync
  const changesCollection = collection(db, 'users', uid, 'syncLog');
  const serverChanges = await getDocs(
    query(
      changesCollection,
      where('timestamp', '>', Timestamp.fromMillis(request.lastSyncTimestamp))
    )
  );

  const serverChangesList = serverChanges.docs.map((doc) => doc.data() as ProgressChange);

  // Apply local changes with conflict detection
  for (const localChange of request.localChanges) {
    // Check for conflicts
    const conflictingServer = serverChangesList.find(
      (sc) =>
        sc.type === localChange.type &&
        sc.exerciseId === localChange.exerciseId &&
        sc.timestamp.toMillis() > request.lastSyncTimestamp
    );

    if (conflictingServer) {
      // Conflict detected - use server value (last-write-wins)
      conflicts.push({
        field: localChange.type,
        localValue: localChange,
        serverValue: conflictingServer,
        resolution: 'server',
        resolvedValue: conflictingServer,
      });
    } else {
      // No conflict - apply local change to syncLog
      const changeDoc = doc(db, 'users', uid, 'syncLog', localChange.id);
      batch.set(changeDoc, {
        ...localChange,
        lessonProgress: undefined, // Don't store nested object in syncLog
        synced: true,
        timestamp: serverTimestamp(),
      });

      // Apply lesson progress update to the progress subcollection
      if (localChange.lessonProgress) {
        const lp = localChange.lessonProgress;
        const progressDoc = doc(db, 'users', uid, 'progress', lp.lessonId);
        batch.set(
          progressDoc,
          {
            lessonId: lp.lessonId,
            status: lp.status,
            ...(lp.completedAt ? { completedAt: Timestamp.fromMillis(lp.completedAt) } : {}),
            [`exerciseScores.${lp.exerciseId}`]: {
              exerciseId: lp.exerciseId,
              highScore: lp.exerciseScore.highScore,
              stars: lp.exerciseScore.stars,
              attempts: lp.exerciseScore.attempts,
              averageScore: lp.exerciseScore.averageScore,
              lastAttemptAt: serverTimestamp(),
            },
          },
          { merge: true }
        );
      }
    }
  }

  await batch.commit();

  return {
    serverChanges: serverChangesList,
    newSyncTimestamp: Date.now(),
    conflicts,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateLevel(xp: number): number {
  // Level curve: exponential (from PRD)
  // xpForLevel(level) = 100 * 1.5^(level-1)
  let level = 1;
  let totalXpNeeded = 0;

  while (totalXpNeeded + Math.floor(100 * Math.pow(1.5, level - 1)) <= xp) {
    totalXpNeeded += Math.floor(100 * Math.pow(1.5, level - 1));
    level++;
  }

  return level;
}

export function xpForNextLevel(currentLevel: number): number {
  return Math.floor(100 * Math.pow(1.5, currentLevel - 1));
}

export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpForNextLevel(i);
  }
  return total;
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Update multiple lesson progress records in a single transaction
 */
export async function batchUpdateLessonProgress(
  uid: string,
  updates: Record<string, Partial<LessonProgress>>
): Promise<void> {
  const batch = writeBatch(db);

  for (const [lessonId, data] of Object.entries(updates)) {
    const progressDoc = doc(db, 'users', uid, 'progress', lessonId);
    batch.update(progressDoc, data);
  }

  await batch.commit();
}

// ============================================================================
// Cat Evolution & Gem Sync Operations
// ============================================================================

export interface CatEvolutionSyncData {
  selectedCatId: string;
  ownedCats: string[];
  evolutionData: Record<string, {
    catId: string;
    currentStage: string;
    xpAccumulated: number;
    abilitiesUnlocked: string[];
  }>;
  updatedAt: FieldValue | Timestamp;
}

export interface GemSyncData {
  gems: number;
  totalGemsEarned: number;
  totalGemsSpent: number;
  updatedAt: FieldValue | Timestamp;
}

export async function getCatEvolutionData(uid: string): Promise<CatEvolutionSyncData | null> {
  const catDoc = doc(db, 'users', uid, 'gamification', 'catEvolution');
  const docSnap = await getDoc(catDoc);
  if (!docSnap.exists()) return null;
  return docSnap.data() as CatEvolutionSyncData;
}

export async function saveCatEvolutionData(uid: string, data: Omit<CatEvolutionSyncData, 'updatedAt'>): Promise<void> {
  const catDoc = doc(db, 'users', uid, 'gamification', 'catEvolution');
  await setDoc(catDoc, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getGemSyncData(uid: string): Promise<GemSyncData | null> {
  const gemDoc = doc(db, 'users', uid, 'gamification', 'gems');
  const docSnap = await getDoc(gemDoc);
  if (!docSnap.exists()) return null;
  return docSnap.data() as GemSyncData;
}

export async function saveGemSyncData(uid: string, data: Omit<GemSyncData, 'updatedAt'>): Promise<void> {
  const gemDoc = doc(db, 'users', uid, 'gamification', 'gems');
  await setDoc(gemDoc, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// ============================================================================
// Data Deletion
// ============================================================================

/**
 * All known subcollections under users/{uid}.
 * Must be kept in sync with the Cloud Function's USER_SUBCOLLECTIONS list
 * in firebase/functions/src/deleteUserData.ts.
 */
const USER_SUBCOLLECTIONS = [
  'progress',
  'gamification',
  'xpLog',
  'syncLog',
  'settings',
  'friends',
  'activity',
  'songMastery',
  'songRequests',
] as const;

/**
 * Firestore batch limit — max 500 operations per batch.commit().
 */
const BATCH_LIMIT = 500;

/**
 * Delete all documents in a subcollection using batched deletes.
 * Processes in batches of 500 (Firestore batch limit).
 * Returns the number of documents deleted.
 */
async function deleteSubcollection(uid: string, subcollectionName: string): Promise<number> {
  const colRef = collection(db, 'users', uid, subcollectionName);
  let deleted = 0;

  // Process in batches to handle collections with > 500 docs
  let hasMore = true;
  while (hasMore) {
    const snapshot = await getDocs(query(colRef, limit(BATCH_LIMIT)));

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const batch = writeBatch(db);
    for (const docSnap of snapshot.docs) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();
    deleted += snapshot.size;

    if (snapshot.size < BATCH_LIMIT) {
      hasMore = false;
    }
  }

  return deleted;
}

/**
 * Clean up the user's friend code from the friendCodes collection.
 * Queries friendCodes where uid == the deleted user.
 */
async function deleteFriendCodes(uid: string): Promise<number> {
  const codesQuery = query(
    collection(db, 'friendCodes'),
    where('uid', '==', uid),
  );
  const snapshot = await getDocs(codesQuery);

  if (snapshot.empty) return 0;

  const batch = writeBatch(db);
  for (const docSnap of snapshot.docs) {
    batch.delete(docSnap.ref);
  }
  await batch.commit();

  return snapshot.size;
}

/**
 * Remove the user from their league membership.
 * Reads the league ID from leagueStore (if available), then queries
 * the league's members subcollection. Also decrements memberCount.
 */
async function deleteLeagueMembership(uid: string): Promise<number> {
  let deleted = 0;

  // Try to get league membership info from the store (fastest path)
  let leagueId: string | null = null;
  try {
    const { useLeagueStore } = require('../../stores/leagueStore');
    const membership = useLeagueStore.getState().membership;
    if (membership?.leagueId) {
      leagueId = membership.leagueId;
    }
  } catch {
    // Store not available, fall through to query
  }

  if (leagueId) {
    // Direct delete — we know the league
    const memberRef = doc(db, 'leagues', leagueId, 'members', uid);
    const memberSnap = await getDoc(memberRef);
    if (memberSnap.exists()) {
      const batch = writeBatch(db);
      batch.delete(memberRef);
      batch.update(doc(db, 'leagues', leagueId), {
        memberCount: increment(-1),
      });
      await batch.commit();
      deleted = 1;
    }
  } else {
    // Fallback: search leagues for this week and check each one
    // (Client SDK doesn't support collectionGroup queries without composite indexes,
    //  so we search recent leagues for this user)
    try {
      const { getCurrentWeekMonday } = require('./leagueService');
      const weekStart = getCurrentWeekMonday();
      const leaguesQuery = query(
        collection(db, 'leagues'),
        where('weekStart', '==', weekStart),
      );
      const leagueSnap = await getDocs(leaguesQuery);

      for (const leagueDoc of leagueSnap.docs) {
        const memberRef = doc(db, 'leagues', leagueDoc.id, 'members', uid);
        const memberSnap = await getDoc(memberRef);
        if (memberSnap.exists()) {
          const batch = writeBatch(db);
          batch.delete(memberRef);
          batch.update(leagueDoc.ref, {
            memberCount: increment(-1),
          });
          await batch.commit();
          deleted++;
          break; // Users have at most one league membership per week
        }
      }
    } catch {
      // League cleanup failure is non-fatal
    }
  }

  return deleted;
}

/**
 * Delete challenges where the user is a participant (fromUid or toUid).
 * Runs two queries (Firestore doesn't support OR queries on different fields)
 * and deduplicates by document ID before batch deleting.
 */
async function deleteChallenges(uid: string): Promise<number> {
  const challengesCol = collection(db, 'challenges');

  const [fromSnap, toSnap] = await Promise.all([
    getDocs(query(challengesCol, where('fromUid', '==', uid))),
    getDocs(query(challengesCol, where('toUid', '==', uid))),
  ]);

  // Deduplicate (a user could be both fromUid and toUid in theory)
  const docsToDelete = new Map<string, typeof fromSnap.docs[0]>();
  for (const docSnap of [...fromSnap.docs, ...toSnap.docs]) {
    docsToDelete.set(docSnap.id, docSnap);
  }

  if (docsToDelete.size === 0) return 0;

  // Batch delete, respecting the 500-op limit
  const docs = Array.from(docsToDelete.values());
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const docSnap of chunk) {
      batch.delete(docSnap.ref);
    }
    await batch.commit();
  }

  return docsToDelete.size;
}

/**
 * Remove the user from other users' friend lists.
 * Reads the user's own friends subcollection to find bidirectional links,
 * then deletes the corresponding docs in each friend's subcollection.
 */
async function removeFromFriendLists(uid: string): Promise<number> {
  // Get all of this user's friend connections
  const friendsCol = collection(db, 'users', uid, 'friends');
  const friendsSnap = await getDocs(friendsCol);

  if (friendsSnap.empty) return 0;

  let removed = 0;

  // Process in batches
  const friendUids = friendsSnap.docs.map((d) => d.id);
  for (let i = 0; i < friendUids.length; i += BATCH_LIMIT) {
    const chunk = friendUids.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const friendUid of chunk) {
      // Delete this user's entry from the friend's friends subcollection
      const reverseRef = doc(db, 'users', friendUid, 'friends', uid);
      batch.delete(reverseRef);
    }
    await batch.commit();
    removed += chunk.length;
  }

  return removed;
}

/**
 * Client-side data deletion fallback.
 * Deletes all known user data when the Cloud Function is unavailable.
 *
 * Deletion order:
 *   1. Remove user from other users' friend lists (bidirectional cleanup)
 *   2. Delete friend codes
 *   3. Delete league membership
 *   4. Delete challenges
 *   5. Delete all user subcollections
 *   6. Delete the root user document
 */
async function deleteUserDataClientSide(uid: string): Promise<void> {
  console.log('[deleteUserData] Using client-side deletion for uid:', uid);

  // 1. Remove from other users' friend lists BEFORE deleting own friends subcollection
  //    (need to read own friends list to know who to clean up)
  try {
    const removed = await removeFromFriendLists(uid);
    if (removed > 0) {
      console.log(`[deleteUserData] Removed from ${removed} friend lists`);
    }
  } catch (err) {
    console.warn('[deleteUserData] Friend list cleanup failed:', err);
  }

  // 2. Delete friend codes
  try {
    const deleted = await deleteFriendCodes(uid);
    if (deleted > 0) {
      console.log(`[deleteUserData] Deleted ${deleted} friend codes`);
    }
  } catch (err) {
    console.warn('[deleteUserData] Friend code cleanup failed:', err);
  }

  // 3. Delete league membership
  try {
    const deleted = await deleteLeagueMembership(uid);
    if (deleted > 0) {
      console.log(`[deleteUserData] Deleted ${deleted} league memberships`);
    }
  } catch (err) {
    console.warn('[deleteUserData] League membership cleanup failed:', err);
  }

  // 4. Delete challenges
  try {
    const deleted = await deleteChallenges(uid);
    if (deleted > 0) {
      console.log(`[deleteUserData] Deleted ${deleted} challenges`);
    }
  } catch (err) {
    console.warn('[deleteUserData] Challenge cleanup failed:', err);
  }

  // 5. Delete all user subcollections
  for (const subcollection of USER_SUBCOLLECTIONS) {
    try {
      const deleted = await deleteSubcollection(uid, subcollection);
      if (deleted > 0) {
        console.log(`[deleteUserData] Deleted ${deleted} docs from ${subcollection}`);
      }
    } catch (err) {
      console.warn(`[deleteUserData] Failed to delete subcollection ${subcollection}:`, err);
    }
  }

  // 6. Delete the root user document
  await deleteDoc(doc(db, 'users', uid));
  console.log('[deleteUserData] Root user document deleted');
}

/**
 * Delete all user data (GDPR compliance).
 *
 * Strategy:
 *   1. Try the deleteUserAllData Cloud Function (server-side, uses Admin SDK
 *      for collectionGroup queries and complete cleanup).
 *   2. If the Cloud Function fails (not deployed, network error, etc.),
 *      fall back to client-side deletion which handles all known subcollections
 *      and cross-collection references.
 *
 * This ensures data is always cleaned up, even without Cloud Functions.
 */
export async function deleteUserData(uid: string): Promise<void> {
  // Primary path: Cloud Function (most thorough — has Admin SDK)
  try {
    const deleteAllData = httpsCallable<unknown, { success: boolean; deletedDocuments: number }>(
      functions,
      'deleteUserAllData',
      { timeout: 10000 },
    );

    const result = await deleteAllData({});
    if (result.data.success) {
      console.log(`[deleteUserData] Cloud Function deleted ${result.data.deletedDocuments} documents`);
      return;
    }
    // Cloud Function returned failure — fall through to client-side
    console.warn('[deleteUserData] Cloud Function returned failure, falling back to client-side');
  } catch (err) {
    console.warn('[deleteUserData] Cloud Function unavailable, falling back to client-side:', err);
  }

  // Fallback: client-side deletion
  await deleteUserDataClientSide(uid);
}
