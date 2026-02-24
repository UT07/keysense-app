/**
 * Song Store Tests
 *
 * Tests mastery tracking, filters, recent songs, request limiting,
 * and hydration. Service calls (Firestore, Gemini) are mocked.
 */

import type { SongMastery, Song, SongSummary } from '@/core/songs/songTypes';

// ---------------------------------------------------------------------------
// Mocks — must come before imports that reference mocked modules
// ---------------------------------------------------------------------------

const mockLoadState = jest.fn().mockResolvedValue({});
const mockDeleteState = jest.fn().mockResolvedValue(undefined);

jest.mock('../persistence', () => ({
  PersistenceManager: {
    saveState: jest.fn().mockResolvedValue(undefined),
    loadState: (...args: unknown[]) => mockLoadState(...args),
    deleteState: (...args: unknown[]) => mockDeleteState(...args),
  },
  STORAGE_KEYS: {
    SONGS: 'test_songs',
  },
  createDebouncedSave: () => jest.fn(),
  createImmediateSave: () => jest.fn(),
}));

const mockGetSong = jest.fn();
const mockGetSongSummaries = jest.fn();

jest.mock('@/services/songService', () => ({
  getSong: (...args: unknown[]) => mockGetSong(...args),
  getSongSummaries: (...args: unknown[]) => mockGetSongSummaries(...args),
  saveUserSongMastery: jest.fn(),
}));

const mockGenerateAndSaveSong = jest.fn();

jest.mock('@/services/songGenerationService', () => ({
  generateAndSaveSong: (...args: unknown[]) => mockGenerateAndSaveSong(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { useSongStore, hydrateSongStore } from '../songStore';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mastery1: SongMastery = {
  songId: 'song-1',
  userId: 'user-1',
  tier: 'bronze',
  sectionScores: { 'section-0': 75 },
  lastPlayed: Date.now(),
  totalAttempts: 2,
};

const mastery2: SongMastery = {
  songId: 'song-2',
  userId: 'user-1',
  tier: 'silver',
  sectionScores: { 'section-0': 85 },
  lastPlayed: Date.now(),
  totalAttempts: 5,
};

const mockSong: Song = {
  id: 'song-1',
  version: 1,
  type: 'song',
  source: 'gemini',
  metadata: {
    title: 'Test Song',
    artist: 'Test Artist',
    genre: 'pop',
    difficulty: 3,
    durationSeconds: 120,
    attribution: 'AI arrangement',
  },
  sections: [],
  settings: {
    tempo: 120,
    timeSignature: [4, 4],
    keySignature: 'C',
    countIn: 4,
    metronomeEnabled: true,
    loopEnabled: true,
  },
  scoring: {
    timingToleranceMs: 50,
    timingGracePeriodMs: 150,
    passingScore: 70,
    starThresholds: [70, 85, 95],
  },
};

const mockSummary: SongSummary = {
  id: 'song-1',
  metadata: mockSong.metadata,
  settings: {
    tempo: 120,
    timeSignature: [4, 4] as [number, number],
    keySignature: 'C',
  },
  sectionCount: 2,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('songStore', () => {
  beforeEach(() => {
    useSongStore.getState().reset();
    jest.clearAllMocks();
  });

  // ── Default state ──────────────────────────────────────────────────

  describe('default state', () => {
    it('has empty mastery', () => {
      expect(useSongStore.getState().songMastery).toEqual({});
    });

    it('has empty filter', () => {
      expect(useSongStore.getState().filter).toEqual({});
    });

    it('has empty summaries', () => {
      expect(useSongStore.getState().summaries).toEqual([]);
    });

    it('has no current song', () => {
      expect(useSongStore.getState().currentSong).toBeNull();
    });
  });

  // ── Filter ─────────────────────────────────────────────────────────

  describe('setFilter', () => {
    it('merges partial filter', () => {
      useSongStore.getState().setFilter({ genre: 'classical' });
      expect(useSongStore.getState().filter).toEqual({ genre: 'classical' });
    });

    it('preserves existing filter fields', () => {
      useSongStore.getState().setFilter({ genre: 'pop' });
      useSongStore.getState().setFilter({ difficulty: 3 });
      expect(useSongStore.getState().filter).toEqual({ genre: 'pop', difficulty: 3 });
    });
  });

  // ── Mastery ────────────────────────────────────────────────────────

  describe('updateMastery', () => {
    it('stores mastery by songId', () => {
      useSongStore.getState().updateMastery(mastery1);
      expect(useSongStore.getState().songMastery['song-1']).toEqual(mastery1);
    });

    it('overwrites existing mastery for same song', () => {
      useSongStore.getState().updateMastery(mastery1);
      const updated = { ...mastery1, tier: 'gold' as const };
      useSongStore.getState().updateMastery(updated);
      expect(useSongStore.getState().songMastery['song-1'].tier).toBe('gold');
    });
  });

  describe('getMastery', () => {
    it('returns null for unknown songId', () => {
      expect(useSongStore.getState().getMastery('unknown')).toBeNull();
    });

    it('returns mastery for known songId', () => {
      useSongStore.getState().updateMastery(mastery1);
      expect(useSongStore.getState().getMastery('song-1')).toEqual(mastery1);
    });
  });

  // ── Request limiting ───────────────────────────────────────────────

  describe('canRequestSong', () => {
    it('returns true when count is 0', () => {
      expect(useSongStore.getState().canRequestSong()).toBe(true);
    });

    it('returns true when count < 5 today', () => {
      const today = new Date().toISOString().split('T')[0];
      useSongStore.setState({ songRequestsToday: { date: today, count: 4 } });
      expect(useSongStore.getState().canRequestSong()).toBe(true);
    });

    it('returns false when count >= 5 today', () => {
      const today = new Date().toISOString().split('T')[0];
      useSongStore.setState({ songRequestsToday: { date: today, count: 5 } });
      expect(useSongStore.getState().canRequestSong()).toBe(false);
    });

    it('returns true when date is yesterday (counter resets)', () => {
      useSongStore.setState({ songRequestsToday: { date: '2020-01-01', count: 10 } });
      expect(useSongStore.getState().canRequestSong()).toBe(true);
    });
  });

  // ── Recent songs ───────────────────────────────────────────────────

  describe('addRecentSong', () => {
    it('prepends song to recent list', () => {
      useSongStore.getState().addRecentSong('song-a');
      useSongStore.getState().addRecentSong('song-b');
      expect(useSongStore.getState().recentSongIds).toEqual(['song-b', 'song-a']);
    });

    it('caps at 10 entries', () => {
      for (let i = 0; i < 15; i++) {
        useSongStore.getState().addRecentSong(`song-${i}`);
      }
      expect(useSongStore.getState().recentSongIds).toHaveLength(10);
      expect(useSongStore.getState().recentSongIds[0]).toBe('song-14');
    });

    it('deduplicates existing entries', () => {
      useSongStore.getState().addRecentSong('song-a');
      useSongStore.getState().addRecentSong('song-b');
      useSongStore.getState().addRecentSong('song-a');
      expect(useSongStore.getState().recentSongIds).toEqual(['song-a', 'song-b']);
    });
  });

  // ── Load summaries ─────────────────────────────────────────────────

  describe('loadSummaries', () => {
    it('sets summaries from service', async () => {
      mockGetSongSummaries.mockResolvedValue({ summaries: [mockSummary], lastDoc: null });
      await useSongStore.getState().loadSummaries();
      expect(useSongStore.getState().summaries).toEqual([mockSummary]);
      expect(useSongStore.getState().isLoadingSummaries).toBe(false);
    });

    it('handles errors gracefully', async () => {
      mockGetSongSummaries.mockRejectedValue(new Error('network'));
      await useSongStore.getState().loadSummaries();
      expect(useSongStore.getState().summaries).toEqual([]);
      expect(useSongStore.getState().isLoadingSummaries).toBe(false);
    });
  });

  // ── Load song ──────────────────────────────────────────────────────

  describe('loadSong', () => {
    it('loads song from service', async () => {
      mockGetSong.mockResolvedValue(mockSong);
      await useSongStore.getState().loadSong('song-1');
      expect(useSongStore.getState().currentSong).toEqual(mockSong);
      expect(useSongStore.getState().isLoadingSong).toBe(false);
    });

    it('handles missing song', async () => {
      mockGetSong.mockResolvedValue(null);
      await useSongStore.getState().loadSong('missing');
      expect(useSongStore.getState().currentSong).toBeNull();
    });
  });

  // ── Hydration ──────────────────────────────────────────────────────

  describe('hydrateSongStore', () => {
    it('loads persisted data into store', async () => {
      const persisted = {
        songMastery: { 'song-1': mastery1 },
        recentSongIds: ['song-1'],
        songRequestsToday: { date: '2026-02-24', count: 2 },
      };
      mockLoadState.mockResolvedValue(persisted);
      await hydrateSongStore();
      expect(useSongStore.getState().songMastery).toEqual(persisted.songMastery);
      expect(useSongStore.getState().recentSongIds).toEqual(persisted.recentSongIds);
      expect(useSongStore.getState().songRequestsToday).toEqual(persisted.songRequestsToday);
    });
  });

  // ── Reset ──────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears all state to defaults', () => {
      useSongStore.getState().updateMastery(mastery1);
      useSongStore.getState().addRecentSong('song-1');
      useSongStore.getState().reset();

      expect(useSongStore.getState().songMastery).toEqual({});
      expect(useSongStore.getState().recentSongIds).toEqual([]);
      expect(useSongStore.getState().summaries).toEqual([]);
      expect(useSongStore.getState().currentSong).toBeNull();
    });
  });
});
