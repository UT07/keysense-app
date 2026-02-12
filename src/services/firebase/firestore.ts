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
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  Timestamp,
  FieldValue,
} from 'firebase/firestore';
import { db } from './config';

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

  // Log XP change
  const logCollection = collection(db, 'users', uid, 'xpLog');
  await setDoc(doc(logCollection), {
    amount,
    source,
    newTotal: newXp,
    timestamp: serverTimestamp(),
  });

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
      // No conflict - apply local change
      const changeDoc = doc(db, 'users', uid, 'syncLog', localChange.id);
      batch.set(changeDoc, {
        ...localChange,
        synced: true,
        timestamp: serverTimestamp(),
      });
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

/**
 * Delete user data (GDPR compliance)
 */
export async function deleteUserData(uid: string): Promise<void> {
  const batch = writeBatch(db);

  // Delete user profile
  const userDoc = doc(db, 'users', uid);
  batch.delete(userDoc);

  // Delete subcollections would require recursive deletion
  // This is handled by Cloud Functions or admin SDK

  await batch.commit();
}
