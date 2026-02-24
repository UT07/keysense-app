/**
 * Song Service Tests
 *
 * Mocks firebase/firestore to test CRUD operations.
 */

import type { Song, SongMastery } from '@/core/songs/songTypes';

// ---------------------------------------------------------------------------
// Mock Firestore
// ---------------------------------------------------------------------------

const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...pathSegments: string[]) => ({
    path: pathSegments.join('/'),
  })),
  collection: jest.fn((_db: unknown, ...pathSegments: string[]) => ({
    path: pathSegments.join('/'),
  })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn((...args: unknown[]) => ({ type: 'where', args })),
  orderBy: jest.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: jest.fn((n: number) => ({ type: 'limit', n })),
  startAfter: jest.fn((doc: unknown) => ({ type: 'startAfter', doc })),
}));

jest.mock('../firebase/config', () => ({
  db: {},
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  getSong,
  saveSongToFirestore,
  saveUserSongMastery,
  getUserSongMastery,
  getUserSongRequestCount,
  incrementSongRequestCount,
  checkSongExists,
} from '../songService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSong: Song = {
  id: 'test-song-1',
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
  sections: [
    {
      id: 'verse-1',
      label: 'Verse 1',
      startBeat: 0,
      endBeat: 16,
      difficulty: 3,
      layers: {
        melody: [{ note: 60, startBeat: 0, durationBeats: 1 }],
        full: [{ note: 60, startBeat: 0, durationBeats: 1 }],
      },
    },
  ],
  settings: {
    tempo: 120,
    timeSignature: [4, 4],
    keySignature: 'C',
    countIn: 4,
    metronomeEnabled: true,
  },
  scoring: {
    timingToleranceMs: 50,
    timingGracePeriodMs: 150,
    passingScore: 70,
    starThresholds: [70, 85, 95],
  },
};

const mockMastery: SongMastery = {
  songId: 'test-song-1',
  userId: 'user-1',
  tier: 'bronze',
  sectionScores: { 'verse-1': 75 },
  lastPlayed: Date.now(),
  totalAttempts: 1,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getSong', () => {
  it('returns null for missing document', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getSong('missing-id');
    expect(result).toBeNull();
  });

  it('returns song data when document exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockSong,
    });
    const result = await getSong('test-song-1');
    expect(result).toEqual(mockSong);
  });
});

describe('saveSongToFirestore', () => {
  it('calls setDoc with correct path', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await saveSongToFirestore(mockSong);
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });
});

describe('checkSongExists', () => {
  it('returns false for non-existent song', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    expect(await checkSongExists('nope')).toBe(false);
  });

  it('returns true for existing song', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true });
    expect(await checkSongExists('test-song-1')).toBe(true);
  });
});

describe('getUserSongMastery', () => {
  it('returns null for unknown song', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const result = await getUserSongMastery('user-1', 'unknown');
    expect(result).toBeNull();
  });

  it('returns mastery data when exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockMastery,
    });
    const result = await getUserSongMastery('user-1', 'test-song-1');
    expect(result).toEqual(mockMastery);
  });
});

describe('saveUserSongMastery', () => {
  it('calls setDoc with merge: true', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await saveUserSongMastery('user-1', mockMastery);
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      mockMastery,
      { merge: true },
    );
  });
});

describe('getUserSongRequestCount', () => {
  it('returns 0 for unknown date', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const count = await getUserSongRequestCount('user-1', '2026-02-24');
    expect(count).toBe(0);
  });

  it('returns stored count', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ count: 3 }),
    });
    const count = await getUserSongRequestCount('user-1', '2026-02-24');
    expect(count).toBe(3);
  });
});

describe('incrementSongRequestCount', () => {
  it('increments existing count', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ count: 2 }),
    });
    mockSetDoc.mockResolvedValue(undefined);

    await incrementSongRequestCount('user-1', '2026-02-24');
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { count: 3 });
  });

  it('starts at 1 when no prior count', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockSetDoc.mockResolvedValue(undefined);

    await incrementSongRequestCount('user-1', '2026-02-24');
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { count: 1 });
  });
});
