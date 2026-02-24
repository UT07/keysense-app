/**
 * Song Service — Firestore CRUD for the Music Library
 *
 * Firestore paths:
 *   songs/{songId}                    — full Song document
 *   users/{uid}/songMastery/{songId}  — per-user mastery
 *   users/{uid}/songRequests/{date}   — daily request counter
 */

import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase/config';
import type { Song, SongSummary, SongFilter, SongMastery } from '@/core/songs/songTypes';

// ---------------------------------------------------------------------------
// Global catalogue — songs/{songId}
// ---------------------------------------------------------------------------

export async function getSong(songId: string): Promise<Song | null> {
  const ref = doc(db, 'songs', songId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as Song;
}

export async function getSongSummaries(
  filter: SongFilter,
  pageSize: number = 20,
  pageAfter?: QueryDocumentSnapshot,
): Promise<{ summaries: SongSummary[]; lastDoc: QueryDocumentSnapshot | null }> {
  const constraints: Parameters<typeof query>[1][] = [];

  if (filter.genre && filter.genre !== 'all') {
    constraints.push(where('metadata.genre', '==', filter.genre));
  }
  if (filter.difficulty && filter.difficulty !== 'all') {
    constraints.push(where('metadata.difficulty', '==', filter.difficulty));
  }

  constraints.push(orderBy('metadata.title'));
  constraints.push(limit(pageSize));

  if (pageAfter) {
    constraints.push(startAfter(pageAfter));
  }

  const q = query(collection(db, 'songs'), ...constraints);
  const snap = await getDocs(q);

  const summaries: SongSummary[] = snap.docs.map((d) => {
    const data = d.data() as Song;
    return {
      id: data.id,
      metadata: data.metadata,
      settings: {
        tempo: data.settings.tempo,
        timeSignature: data.settings.timeSignature,
        keySignature: data.settings.keySignature,
      },
      sectionCount: data.sections.length,
    };
  });

  // Client-side text search (Firestore doesn't support full-text search)
  const filtered = filter.searchQuery
    ? summaries.filter(
        (s) =>
          s.metadata.title.toLowerCase().includes(filter.searchQuery!.toLowerCase()) ||
          s.metadata.artist.toLowerCase().includes(filter.searchQuery!.toLowerCase()),
      )
    : summaries;

  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return { summaries: filtered, lastDoc };
}

export async function searchSongs(
  queryStr: string,
  maxResults: number = 10,
): Promise<SongSummary[]> {
  // Firestore doesn't support full-text search.
  // We load a broader set and filter client-side.
  const { summaries } = await getSongSummaries(
    { searchQuery: queryStr },
    50,
  );
  return summaries.slice(0, maxResults);
}

export async function saveSongToFirestore(song: Song): Promise<void> {
  const ref = doc(db, 'songs', song.id);
  await setDoc(ref, song);
}

export async function checkSongExists(songId: string): Promise<boolean> {
  const ref = doc(db, 'songs', songId);
  const snap = await getDoc(ref);
  return snap.exists();
}

// ---------------------------------------------------------------------------
// Per-user mastery — users/{uid}/songMastery/{songId}
// ---------------------------------------------------------------------------

export async function getUserSongMastery(
  uid: string,
  songId: string,
): Promise<SongMastery | null> {
  const ref = doc(db, 'users', uid, 'songMastery', songId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as SongMastery;
}

export async function getAllUserSongMastery(uid: string): Promise<SongMastery[]> {
  const q = query(collection(db, 'users', uid, 'songMastery'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as SongMastery);
}

export async function saveUserSongMastery(
  uid: string,
  mastery: SongMastery,
): Promise<void> {
  const ref = doc(db, 'users', uid, 'songMastery', mastery.songId);
  await setDoc(ref, mastery, { merge: true });
}

// ---------------------------------------------------------------------------
// Rate limiting — users/{uid}/songRequests/{date}
// ---------------------------------------------------------------------------

export async function getUserSongRequestCount(
  uid: string,
  date: string,
): Promise<number> {
  const ref = doc(db, 'users', uid, 'songRequests', date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return 0;
  return (snap.data() as { count: number }).count ?? 0;
}

export async function incrementSongRequestCount(
  uid: string,
  date: string,
): Promise<void> {
  const ref = doc(db, 'users', uid, 'songRequests', date);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data() as { count: number }).count ?? 0 : 0;
  await setDoc(ref, { count: current + 1 });
}
