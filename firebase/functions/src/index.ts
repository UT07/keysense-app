/**
 * Firebase Cloud Functions Index
 * Exports all Cloud Functions for deployment
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export all functions
export * from './generateCoachFeedback';
export * from './deleteUserData';
export * from './generateExercise';
export * from './generateSong';

// ============================================================================
// Additional Cloud Functions
// ============================================================================

import * as functions from 'firebase-functions';

/**
 * Cloud Function: Sync Progress
 * Handles bidirectional sync of user progress with conflict resolution
 */
export const syncProgress = functions
  .region('us-central1')
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated'
      );
    }

    const uid = context.auth.uid;

    try {
      const { lastSyncTimestamp, localChanges } = data;

      // Get server changes since last sync
      const changesRef = admin
        .firestore()
        .collection(`users/${uid}/syncLog`);

      const serverChanges = await changesRef
        .where('timestamp', '>', admin.firestore.Timestamp.fromMillis(lastSyncTimestamp))
        .get();

      const serverChangesList = serverChanges.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => doc.data());

      // Detect conflicts (same type + exercise within 5 seconds)
      const conflicts: Array<Record<string, any>> = [];

      for (const localChange of localChanges) {
        const conflict = serverChangesList.find(
          (sc: Record<string, any>) =>
            sc.type === localChange.type &&
            sc.exerciseId === localChange.exerciseId &&
            Math.abs(sc.timestamp.toMillis() - localChange.timestamp.toMillis()) < 5000
        );

        if (conflict) {
          conflicts.push({
            field: localChange.type,
            localValue: localChange,
            serverValue: conflict,
            resolution: 'server',
            resolvedValue: conflict,
          });
        }
      }

      // Apply local changes
      const batch = admin.firestore().batch();
      for (const change of localChanges) {
        const docRef = changesRef.doc(change.id);
        batch.set(docRef, {
          ...change,
          synced: true,
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();

      return {
        serverChanges: serverChangesList,
        newSyncTimestamp: Date.now(),
        conflicts,
        synced: true,
      };
    } catch (error) {
      functions.logger.error('Sync error', { uid, error: String(error) });
      throw new functions.https.HttpsError(
        'internal',
        'Sync failed'
      );
    }
  });

/**
 * Cloud Function: Complete Exercise
 * Awards XP, updates progress, checks achievements
 */
export const completeExercise = functions
  .region('us-central1')
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated'
      );
    }

    const uid = context.auth.uid;
    const { exerciseId, isPerfect } = data;

    try {
      const db = admin.firestore();
      const userRef = db.collection('users').doc(uid);

      // Get current gamification data
      const gamDoc = await userRef.collection('gamification').doc('data').get();
      const gamData = gamDoc.data() || {};

      // Calculate XP reward
      const XP_REWARDS = {
        exerciseComplete: 10,
        exerciseFirstTime: 25,
        exercisePerfect: 50,
      };

      let xpEarned = XP_REWARDS.exerciseComplete;

      // Bonus for first time
      const progressDoc = await userRef.collection('progress').doc(exerciseId).get();
      if (!progressDoc.exists || progressDoc.data()?.totalAttempts === 0) {
        xpEarned += XP_REWARDS.exerciseFirstTime;
      }

      // Bonus for perfect score
      if (isPerfect) {
        xpEarned += XP_REWARDS.exercisePerfect;
      }

      // Calculate new level
      const newXp = (gamData.xp || 0) + xpEarned;
      const newLevel = calculateLevel(newXp);
      const oldLevel = gamData.level || 1;

      // Update gamification
      const batch = db.batch();

      batch.set(
        userRef.collection('gamification').doc('data'),
        {
          xp: newXp,
          level: newLevel,
          lastExerciseAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Log XP change
      batch.set(db.collection(`users/${uid}/xpLog`).doc(), {
        amount: xpEarned,
        source: 'exercise_complete',
        newTotal: newXp,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log to sync log
      batch.set(db.collection(`users/${uid}/syncLog`).doc(), {
        type: 'xp_earned',
        exerciseId,
        xpAmount: xpEarned,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        synced: false,
      });

      await batch.commit();

      const achievements: string[] = [];

      // Check for achievements
      if (newLevel > oldLevel) {
        achievements.push(`level_${newLevel}`);
      }

      if (newXp >= 1000 && (gamData.xp || 0) < 1000) {
        achievements.push('xp_1000');
      }

      return {
        xpEarned,
        newLevel: newLevel > oldLevel ? newLevel : undefined,
        achievementsUnlocked: achievements,
      };
    } catch (error) {
      functions.logger.error('Exercise completion error', {
        uid,
        exerciseId,
        error: String(error),
      });
      throw new functions.https.HttpsError('internal', 'Failed to complete exercise');
    }
  });

/**
 * Cloud Function: Get Exercise Recommendations
 * Suggests next exercises based on user performance
 */
export const getExerciseRecommendations = functions
  .region('us-central1')
  .https.onCall(async (_data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated'
      );
    }

    const uid = context.auth.uid;

    try {
      const db = admin.firestore();
      const userRef = db.collection('users').doc(uid);

      // Get user progress
      const progressDocs = await userRef.collection('progress').get();

      const recommendations = [];

      // Analyze weaknesses
      let weakestSkill = null;
      let lowestScore = 100;

      for (const doc of progressDocs.docs) {
        const progress = doc.data();
        if (progress.bestScore < lowestScore) {
          lowestScore = progress.bestScore;
          weakestSkill = doc.id;
        }
      }

      if (weakestSkill) {
        recommendations.push({
          exerciseId: weakestSkill,
          reason: 'You had trouble with this one - let\'s practice it more!',
        });
      }

      // Recommend next in sequence
      const nextLesson = Math.min(progressDocs.docs.length + 1, 30); // Assume 30 exercises total
      recommendations.push({
        exerciseId: `lesson_${nextLesson}`,
        reason: 'Ready for the next challenge?',
      });

      return recommendations;
    } catch (error) {
      functions.logger.error('Recommendations error', { uid, error: String(error) });
      return [];
    }
  });

/**
 * Cloud Function: Get Weekly Summary
 * Generates weekly insights and goals
 */
export const getWeeklySummary = functions
  .region('us-central1')
  .https.onCall(async (_data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated'
      );
    }

    const uid = context.auth.uid;

    try {
      const db = admin.firestore();
      const userRef = db.collection('users').doc(uid);

      // Get this week's progress
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const syncLogs = await userRef
        .collection('syncLog')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(oneWeekAgo))
        .get();

      let exercisesCompleted = 0;
      let totalXp = 0;

      for (const doc of syncLogs.docs) {
        const data = doc.data();
        if (data.type === 'exercise_completed') {
          exercisesCompleted++;
        } else if (data.type === 'xp_earned') {
          totalXp += data.xpAmount || 0;
        }
      }

      // Estimate minutes (10 min per exercise average)
      const minutesPracticed = exercisesCompleted * 10;

      const improvements = [];
      if (exercisesCompleted >= 5) {
        improvements.push('Great consistency this week!');
      }
      if (totalXp >= 500) {
        improvements.push('Significant progress made!');
      }

      const nextWeekGoals = [];
      if (exercisesCompleted < 5) {
        nextWeekGoals.push('Aim for 5+ exercises');
      }
      nextWeekGoals.push('Complete one new skill');
      nextWeekGoals.push('Maintain your streak');

      return {
        exercisesCompleted,
        minutesPracticed,
        xpEarned: totalXp,
        improvements,
        nextWeekGoals,
      };
    } catch (error) {
      functions.logger.error('Weekly summary error', { uid, error: String(error) });
      return {
        exercisesCompleted: 0,
        minutesPracticed: 0,
        xpEarned: 0,
        improvements: [],
        nextWeekGoals: [],
      };
    }
  });

/**
 * Calculate user level from total XP
 */
function calculateLevel(totalXp: number): number {
  let level = 1;
  let xpRequired = 0;

  while (xpRequired + Math.floor(100 * Math.pow(1.5, level - 1)) <= totalXp) {
    xpRequired += Math.floor(100 * Math.pow(1.5, level - 1));
    level++;
  }

  return level;
}
