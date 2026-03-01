/**
 * Cloud Function: Delete User Data
 * Recursively deletes all user subcollections and cleans up cross-collection references.
 * Called from client authStore.deleteAccount() before deleting the Firebase Auth account.
 *
 * Subcollections deleted:
 *   users/{uid}/progress, gamification, xpLog, syncLog, settings,
 *   friends, activity, songMastery, songRequests
 *
 * Cross-collection cleanup:
 *   - friendCodes/{code} where uid == caller
 *   - leagues/{leagueId}/members/{uid}
 *   - challenges/{id} where fromUid or toUid == caller
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

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
];

/**
 * Delete all documents in a collection (batch delete, max 500 per batch).
 */
async function deleteCollection(
  db: admin.firestore.Firestore,
  collectionPath: string,
): Promise<number> {
  const collectionRef = db.collection(collectionPath);
  let deleted = 0;

  // Process in batches of 500 (Firestore batch limit)
  let snapshot = await collectionRef.limit(500).get();
  while (snapshot.size > 0) {
    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snapshot.size;

    if (snapshot.size < 500) break;
    snapshot = await collectionRef.limit(500).get();
  }

  return deleted;
}

/**
 * Callable Cloud Function: deleteUserAllData
 * Deletes all user data from Firestore. Must be called by the authenticated user.
 */
export const deleteUserAllData = functions
  .region('us-central1')
  .https.onCall(async (_data: unknown, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated to delete account data',
      );
    }

    const uid = context.auth.uid;
    const db = admin.firestore();

    functions.logger.info('Starting user data deletion', { uid });

    try {
      let totalDeleted = 0;

      // 1. Delete all user subcollections
      for (const subcollection of USER_SUBCOLLECTIONS) {
        const path = `users/${uid}/${subcollection}`;
        const count = await deleteCollection(db, path);
        if (count > 0) {
          functions.logger.info(`Deleted ${count} docs from ${path}`);
        }
        totalDeleted += count;
      }

      // 2. Delete the user profile document
      await db.doc(`users/${uid}`).delete();
      totalDeleted += 1;

      // 3. Clean up friendCodes where uid == this user
      const friendCodesSnap = await db
        .collection('friendCodes')
        .where('uid', '==', uid)
        .get();

      if (!friendCodesSnap.empty) {
        const batch = db.batch();
        for (const doc of friendCodesSnap.docs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
        totalDeleted += friendCodesSnap.size;
        functions.logger.info(`Deleted ${friendCodesSnap.size} friend codes`);
      }

      // 4. Clean up league memberships
      // Query across all leagues for this user's membership docs
      const memberSnap = await db
        .collectionGroup('members')
        .where('uid', '==', uid)
        .get();

      if (!memberSnap.empty) {
        const batch = db.batch();
        for (const doc of memberSnap.docs) {
          batch.delete(doc.ref);
          // Decrement memberCount on parent league
          const leagueRef = doc.ref.parent.parent;
          if (leagueRef) {
            batch.update(leagueRef, {
              memberCount: admin.firestore.FieldValue.increment(-1),
            });
          }
        }
        await batch.commit();
        totalDeleted += memberSnap.size;
        functions.logger.info(`Deleted ${memberSnap.size} league memberships`);
      }

      // 5. Clean up challenges where user is participant
      const fromSnap = await db
        .collection('challenges')
        .where('fromUid', '==', uid)
        .get();
      const toSnap = await db
        .collection('challenges')
        .where('toUid', '==', uid)
        .get();

      const challengeIds = new Set<string>();
      const challengeBatch = db.batch();
      for (const doc of [...fromSnap.docs, ...toSnap.docs]) {
        if (!challengeIds.has(doc.id)) {
          challengeIds.add(doc.id);
          challengeBatch.delete(doc.ref);
        }
      }
      if (challengeIds.size > 0) {
        await challengeBatch.commit();
        totalDeleted += challengeIds.size;
        functions.logger.info(`Deleted ${challengeIds.size} challenges`);
      }

      // 6. Remove this user from other users' friend lists
      const friendOfSnap = await db
        .collectionGroup('friends')
        .where('uid', '==', uid)
        .get();

      if (!friendOfSnap.empty) {
        const batch = db.batch();
        for (const doc of friendOfSnap.docs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
        totalDeleted += friendOfSnap.size;
        functions.logger.info(`Removed from ${friendOfSnap.size} friend lists`);
      }

      functions.logger.info('User data deletion complete', { uid, totalDeleted });

      return { success: true, deletedDocuments: totalDeleted };
    } catch (error) {
      functions.logger.error('User data deletion failed', { uid, error: String(error) });
      throw new functions.https.HttpsError(
        'internal',
        'Failed to delete user data',
      );
    }
  });
