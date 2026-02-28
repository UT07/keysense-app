/**
 * Song Store
 *
 * Manages the Music Library browsing state:
 * - Song mastery (persisted)
 * - Recent songs list (persisted)
 * - Daily request counter (persisted)
 * - Browse state: summaries, filters, loading (transient)
 * - Current song for playback (transient)
 * - Song generation via Gemini (transient)
 *
 * Follows gemStore.ts pattern: create() + manual hydrate + debouncedSave.
 */

import { create } from 'zustand';
import type { Song, SongSummary, SongFilter, SongMastery, SongRequestParams } from '@/core/songs/songTypes';
import { PersistenceManager, STORAGE_KEYS, createDebouncedSave } from './persistence';
import { getSong, getSongSummaries } from '@/services/songService';
import { generateAndSaveSong } from '@/services/songGenerationService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Persisted data (survives app restart) */
interface SongData {
  songMastery: Record<string, SongMastery>;
  recentSongIds: string[];
  songRequestsToday: { date: string; count: number };
}

/** Full store state */
export interface SongStoreState extends SongData {
  // Transient browse state
  summaries: SongSummary[];
  isLoadingSummaries: boolean;
  filter: SongFilter;
  currentSong: Song | null;
  isLoadingSong: boolean;
  isGeneratingSong: boolean;
  generationError: string | null;

  // Actions
  loadSummaries: (reset?: boolean) => Promise<void>;
  loadMoreSummaries: () => Promise<void>;
  setFilter: (filter: Partial<SongFilter>) => void;
  loadSong: (songId: string) => Promise<void>;
  updateMastery: (mastery: SongMastery) => void;
  getMastery: (songId: string) => SongMastery | null;
  requestSong: (params: SongRequestParams, uid: string) => Promise<Song | null>;
  canRequestSong: () => boolean;
  addRecentSong: (songId: string) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const MAX_RECENT = 10;
const MAX_REQUESTS_PER_DAY = 5;

const defaultData: SongData = {
  songMastery: {},
  recentSongIds: [],
  songRequestsToday: { date: '', count: 0 },
};

const defaultTransient = {
  summaries: [] as SongSummary[],
  isLoadingSummaries: false,
  filter: {} as SongFilter,
  currentSong: null as Song | null,
  isLoadingSong: false,
  isGeneratingSong: false,
  generationError: null as string | null,
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const debouncedSave = createDebouncedSave<SongData>(STORAGE_KEYS.SONGS, 500);

function persistableData(state: SongStoreState): SongData {
  return {
    songMastery: state.songMastery,
    recentSongIds: state.recentSongIds,
    songRequestsToday: state.songRequestsToday,
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** Pagination cursor — kept outside Zustand because it's not serialisable */
// Cursor for Firestore pagination — typed to match getSongSummaries return
type PageCursor = Awaited<ReturnType<typeof getSongSummaries>>['lastDoc'];
let lastDocCursor: PageCursor = null;

/** Guards against stale Firestore responses overwriting newer results */
let loadRequestId = 0;

export const useSongStore = create<SongStoreState>((set, get) => ({
  ...defaultData,
  ...defaultTransient,

  // ── Browse ───────────────────────────────────────────────────────────

  loadSummaries: async (reset = true) => {
    if (reset) lastDocCursor = null;
    const thisRequest = ++loadRequestId;
    set({ isLoadingSummaries: true });
    try {
      const { summaries, lastDoc } = await getSongSummaries(get().filter, 20);
      if (thisRequest !== loadRequestId) return; // stale response — discard
      lastDocCursor = lastDoc;
      set({ summaries, isLoadingSummaries: false });
    } catch (err) {
      if (thisRequest !== loadRequestId) return; // stale
      console.warn('[SongStore] loadSummaries failed:', err);
      set({ summaries: [], isLoadingSummaries: false });
    }
  },

  loadMoreSummaries: async () => {
    if (!lastDocCursor || get().isLoadingSummaries) return;
    const thisRequest = ++loadRequestId;
    set({ isLoadingSummaries: true });
    try {
      const { summaries: more, lastDoc } = await getSongSummaries(
        get().filter,
        20,
        lastDocCursor ?? undefined,
      );
      if (thisRequest !== loadRequestId) return; // stale
      lastDocCursor = lastDoc;
      set((s) => ({ summaries: [...s.summaries, ...more], isLoadingSummaries: false }));
    } catch (err) {
      if (thisRequest !== loadRequestId) return; // stale
      console.warn('[SongStore] loadMoreSummaries failed:', err);
      set({ isLoadingSummaries: false });
    }
  },

  setFilter: (partial: Partial<SongFilter>) => {
    set((s) => ({ filter: { ...s.filter, ...partial } }));
  },

  // ── Current song ─────────────────────────────────────────────────────

  loadSong: async (songId: string) => {
    set({ isLoadingSong: true, currentSong: null });
    try {
      const song = await getSong(songId);
      set({ currentSong: song, isLoadingSong: false });
    } catch (err) {
      console.warn('[SongStore] loadSong failed:', err);
      set({ isLoadingSong: false });
    }
  },

  // ── Mastery ──────────────────────────────────────────────────────────

  updateMastery: (mastery: SongMastery) => {
    set((s) => ({
      songMastery: { ...s.songMastery, [mastery.songId]: mastery },
    }));
    debouncedSave(persistableData(get()));
  },

  getMastery: (songId: string) => {
    return get().songMastery[songId] ?? null;
  },

  // ── Song generation ──────────────────────────────────────────────────

  requestSong: async (params: SongRequestParams, uid: string) => {
    if (!get().canRequestSong()) {
      set({ generationError: 'Daily request limit reached (5/day)' });
      return null;
    }

    set({ isGeneratingSong: true, generationError: null });
    try {
      const song = await generateAndSaveSong(params, uid);
      if (song) {
        const today = new Date().toISOString().split('T')[0];
        set((s) => ({
          isGeneratingSong: false,
          currentSong: song,
          songRequestsToday: { date: today, count: s.songRequestsToday.date === today ? s.songRequestsToday.count + 1 : 1 },
        }));
        debouncedSave(persistableData(get()));
        return song;
      }
      set({ isGeneratingSong: false, generationError: 'Generation failed — try again' });
      return null;
    } catch (err) {
      console.warn('[SongStore] requestSong failed:', err);
      set({ isGeneratingSong: false, generationError: 'Generation failed — try again' });
      return null;
    }
  },

  canRequestSong: () => {
    const { songRequestsToday } = get();
    const today = new Date().toISOString().split('T')[0];
    if (songRequestsToday.date !== today) return true;
    return songRequestsToday.count < MAX_REQUESTS_PER_DAY;
  },

  // ── Recent songs ─────────────────────────────────────────────────────

  addRecentSong: (songId: string) => {
    set((s) => {
      const filtered = s.recentSongIds.filter((id) => id !== songId);
      return { recentSongIds: [songId, ...filtered].slice(0, MAX_RECENT) };
    });
    debouncedSave(persistableData(get()));
  },

  // ── Reset ────────────────────────────────────────────────────────────

  reset: () => {
    lastDocCursor = null;
    set({ ...defaultData, ...defaultTransient });
    PersistenceManager.deleteState(STORAGE_KEYS.SONGS);
  },
}));

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

/** Hydrate song store from AsyncStorage on app launch */
export async function hydrateSongStore(): Promise<void> {
  const data = await PersistenceManager.loadState<SongData>(STORAGE_KEYS.SONGS, defaultData);
  useSongStore.setState(data);
}
