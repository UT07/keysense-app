/**
 * Data Migration Service
 * Migrates local progress from AsyncStorage to Firestore on first sign-in
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Timestamp } from 'firebase/firestore';
import { useProgressStore } from '../../stores/progressStore';
import { auth } from './config';
import { createGamificationData, addXp, createLessonProgress } from './firestore';
import type { ExerciseProgress as FirestoreExerciseProgress } from './firestore';
import { logger } from '../../utils/logger';

const MIGRATION_KEY = 'purrrfect_keys_migrated';

/**
 * Check if local data has already been migrated to cloud
 */
export async function hasMigrated(): Promise<boolean> {
  const value = await AsyncStorage.getItem(MIGRATION_KEY);
  return value === 'true';
}

/**
 * Migrate local progress data to Firestore.
 * Should be called after a user signs in (non-anonymous).
 * Idempotent — checks migration flag before proceeding.
 */
export async function migrateLocalToCloud(): Promise<{ migrated: boolean; error?: string }> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    return { migrated: false, error: 'No authenticated user' };
  }

  // Skip if already migrated
  const alreadyMigrated = await hasMigrated();
  if (alreadyMigrated) {
    return { migrated: false };
  }

  try {
    const progressState = useProgressStore.getState();

    // 1. Migrate XP and level
    if (progressState.totalXp > 0) {
      await createGamificationData(uid);
      await addXp(uid, progressState.totalXp, 'migration');
    }

    // 2. Migrate lesson progress
    for (const [lessonId, lessonProgress] of Object.entries(progressState.lessonProgress)) {
      // Convert local ExerciseProgress (number timestamps) to Firestore format (Timestamps)
      const firestoreScores: Record<string, FirestoreExerciseProgress> = {};
      for (const [exId, exProgress] of Object.entries(lessonProgress.exerciseScores)) {
        firestoreScores[exId] = {
          exerciseId: exProgress.exerciseId,
          highScore: exProgress.highScore,
          stars: exProgress.stars,
          attempts: exProgress.attempts,
          lastAttemptAt: Timestamp.fromMillis(exProgress.lastAttemptAt || Date.now()),
          averageScore: exProgress.averageScore,
        };
      }

      await createLessonProgress(uid, lessonId, {
        lessonId,
        status: lessonProgress.status,
        exerciseScores: firestoreScores,
        bestScore: lessonProgress.bestScore,
        totalAttempts: lessonProgress.totalAttempts ?? 0,
        totalTimeSpentSeconds: lessonProgress.totalTimeSpentSeconds ?? 0,
      });
    }

    // 3. Mark as migrated
    await AsyncStorage.setItem(MIGRATION_KEY, 'true');
    logger.log('[DataMigration] Successfully migrated local data to cloud');

    return { migrated: true };
  } catch (error) {
    logger.warn('[DataMigration] Migration failed:', (error as Error)?.message);
    return { migrated: false, error: (error as Error)?.message ?? 'Unknown error' };
  }
}
