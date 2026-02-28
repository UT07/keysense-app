/**
 * Social Service — Firestore CRUD for friends, friend codes, activity feed, challenges
 *
 * Firestore paths:
 *   friendCodes/{code}                   — { uid } mapping for 6-char alphanumeric codes
 *   users/{uid}/friends/{friendUid}      — FriendConnection document
 *   users/{uid}/activity/{activityId}    — ActivityFeedItem document
 *   challenges/{challengeId}             — FriendChallenge document
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
  limit,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import type { FriendConnection, ActivityFeedItem, FriendChallenge } from '../../stores/types';

// ---------------------------------------------------------------------------
// Friend Code Alphabet — excludes ambiguous chars: I, O, 0, 1
// ---------------------------------------------------------------------------

const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const FRIEND_CODE_LENGTH = 6;
const MAX_CODE_RETRIES = 5;

// ---------------------------------------------------------------------------
// Friend Code Operations
// ---------------------------------------------------------------------------

/**
 * Generate a random 6-character alphanumeric friend code.
 * Uses a restricted alphabet (no I/O/0/1) to avoid ambiguity.
 * Uses crypto.getRandomValues() for cryptographic randomness.
 */
export function generateFriendCode(): string {
  const randomBytes = new Uint8Array(FRIEND_CODE_LENGTH);
  crypto.getRandomValues(randomBytes);

  let code = '';
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
    const index = randomBytes[i] % FRIEND_CODE_ALPHABET.length;
    code += FRIEND_CODE_ALPHABET[index];
  }
  return code;
}

/**
 * Register a friend code for a user. Retries up to 5 times on collision.
 * Writes to friendCodes/{code} -> { uid }.
 * Returns the successfully registered code.
 */
export async function registerFriendCode(uid: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const code = generateFriendCode();
    const codeRef = doc(db, 'friendCodes', code);
    const existing = await getDoc(codeRef);

    if (!existing.exists()) {
      await setDoc(codeRef, { uid });
      return code;
    }
    // Collision — retry with a new code
  }

  throw new Error('Failed to generate unique friend code after maximum retries');
}

/**
 * Look up a uid from a friend code.
 * Returns the uid if found, or null if the code doesn't exist.
 */
export async function lookupFriendCode(code: string): Promise<string | null> {
  const codeRef = doc(db, 'friendCodes', code.toUpperCase());
  const snap = await getDoc(codeRef);

  if (!snap.exists()) return null;

  const data = snap.data() as { uid: string };
  return data.uid;
}

// ---------------------------------------------------------------------------
// Friend Connection Operations
// ---------------------------------------------------------------------------

/**
 * Send a friend request. Writes to both users' friends subcollections:
 *   users/{fromUid}/friends/{toUid}   — status: pending_outgoing
 *   users/{toUid}/friends/{fromUid}   — status: pending_incoming
 */
export async function sendFriendRequest(
  fromUid: string,
  toUid: string,
  fromDisplayName: string,
  fromCatId: string,
  toDisplayName: string,
  toCatId: string,
): Promise<void> {
  const now = Date.now();

  const outgoingRef = doc(db, 'users', fromUid, 'friends', toUid);
  const incomingRef = doc(db, 'users', toUid, 'friends', fromUid);

  const outgoing: FriendConnection = {
    uid: toUid,
    displayName: toDisplayName,
    selectedCatId: toCatId,
    status: 'pending_outgoing',
    connectedAt: now,
  };

  const incoming: FriendConnection = {
    uid: fromUid,
    displayName: fromDisplayName,
    selectedCatId: fromCatId,
    status: 'pending_incoming',
    connectedAt: now,
  };

  const batch = writeBatch(db);
  batch.set(outgoingRef, outgoing);
  batch.set(incomingRef, incoming);
  await batch.commit();
}

/**
 * Accept a pending friend request. Updates both sides to 'accepted'.
 */
export async function acceptFriendRequest(
  myUid: string,
  friendUid: string,
): Promise<void> {
  const myRef = doc(db, 'users', myUid, 'friends', friendUid);
  const friendRef = doc(db, 'users', friendUid, 'friends', myUid);

  const now = Date.now();

  const batch = writeBatch(db);
  batch.update(myRef, { status: 'accepted', connectedAt: now });
  batch.update(friendRef, { status: 'accepted', connectedAt: now });
  await batch.commit();
}

/**
 * Remove a friend connection. Deletes documents on both sides.
 */
export async function removeFriendConnection(
  myUid: string,
  friendUid: string,
): Promise<void> {
  const myRef = doc(db, 'users', myUid, 'friends', friendUid);
  const friendRef = doc(db, 'users', friendUid, 'friends', myUid);

  const batch = writeBatch(db);
  batch.delete(myRef);
  batch.delete(friendRef);
  await batch.commit();
}

/**
 * Get all friend connections for a user.
 */
export async function getFriends(uid: string): Promise<FriendConnection[]> {
  const friendsCol = collection(db, 'users', uid, 'friends');
  const snap = await getDocs(friendsCol);

  return snap.docs.map((d) => d.data() as FriendConnection);
}

// ---------------------------------------------------------------------------
// Activity Feed Operations
// ---------------------------------------------------------------------------

/**
 * Post an activity item to a user's activity feed.
 * Writes to users/{uid}/activity/{item.id}.
 */
export async function postActivity(
  uid: string,
  item: ActivityFeedItem,
): Promise<void> {
  const activityRef = doc(db, 'users', uid, 'activity', item.id);
  await setDoc(activityRef, item);
}

/**
 * Get recent activity items from a friend's feed.
 * Returns items ordered by timestamp descending, limited to maxItems.
 */
export async function getFriendActivity(
  friendUid: string,
  maxItems: number = 20,
): Promise<ActivityFeedItem[]> {
  const activityCol = collection(db, 'users', friendUid, 'activity');
  const q = query(activityCol, orderBy('timestamp', 'desc'), limit(maxItems));
  const snap = await getDocs(q);

  return snap.docs.map((d) => d.data() as ActivityFeedItem);
}

// ---------------------------------------------------------------------------
// Friend Challenge Operations
// ---------------------------------------------------------------------------

/**
 * Create a friend challenge.
 * Writes to challenges/{challenge.id}.
 */
export async function createChallenge(challenge: FriendChallenge): Promise<void> {
  const challengeRef = doc(db, 'challenges', challenge.id);
  await setDoc(challengeRef, challenge);
}

/**
 * Get all challenges involving a user (as sender or receiver).
 * Queries by fromUid and toUid separately, then deduplicates.
 */
export async function getChallengesForUser(uid: string): Promise<FriendChallenge[]> {
  const challengesCol = collection(db, 'challenges');

  const fromQuery = query(challengesCol, where('fromUid', '==', uid));
  const toQuery = query(challengesCol, where('toUid', '==', uid));

  const [fromSnap, toSnap] = await Promise.all([
    getDocs(fromQuery),
    getDocs(toQuery),
  ]);

  const challengeMap = new Map<string, FriendChallenge>();

  for (const d of fromSnap.docs) {
    const challenge = d.data() as FriendChallenge;
    challengeMap.set(challenge.id, challenge);
  }
  for (const d of toSnap.docs) {
    const challenge = d.data() as FriendChallenge;
    challengeMap.set(challenge.id, challenge);
  }

  return Array.from(challengeMap.values());
}

/**
 * Update a challenge with the recipient's score and mark as completed.
 */
export async function updateChallengeResult(
  challengeId: string,
  toScore: number,
): Promise<void> {
  const challengeRef = doc(db, 'challenges', challengeId);
  await updateDoc(challengeRef, {
    toScore,
    status: 'completed',
  });
}
