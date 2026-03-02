/**
 * Song Generation Service Tests
 */

import type { GeneratedSongABC } from '../songGenerationService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false })),
  setDoc: jest.fn(() => Promise.resolve()),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
}));

jest.mock('../firebase/config', () => ({
  db: {},
  firebaseAvailable: true,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { validateGeneratedSong, buildSongPrompt, assembleSong } from '../songGenerationService';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validABC = 'X:1\nT:Test Section\nM:4/4\nL:1/4\nK:C\nCDEF|GABc|';

const validRaw: GeneratedSongABC = {
  title: 'Happy Birthday',
  artist: 'Traditional',
  genre: 'pop',
  difficulty: 2,
  attribution: 'AI arrangement',
  tempo: 100,
  key: 'C',
  sections: [
    { label: 'Verse', melodyABC: validABC },
    { label: 'Chorus', melodyABC: validABC },
  ],
};

// ---------------------------------------------------------------------------
// validateGeneratedSong
// ---------------------------------------------------------------------------

describe('validateGeneratedSong', () => {
  it('accepts valid shape', () => {
    expect(validateGeneratedSong(validRaw)).toBe(true);
  });

  it('rejects null', () => {
    expect(validateGeneratedSong(null)).toBe(false);
  });

  it('rejects missing title', () => {
    expect(validateGeneratedSong({ ...validRaw, title: '' })).toBe(false);
  });

  it('rejects missing sections', () => {
    expect(validateGeneratedSong({ ...validRaw, sections: [] })).toBe(false);
  });

  it('rejects invalid difficulty (0)', () => {
    expect(validateGeneratedSong({ ...validRaw, difficulty: 0 })).toBe(false);
  });

  it('rejects invalid difficulty (6)', () => {
    expect(validateGeneratedSong({ ...validRaw, difficulty: 6 })).toBe(false);
  });

  it('rejects section with empty melodyABC', () => {
    const bad = {
      ...validRaw,
      sections: [{ label: 'Verse', melodyABC: '' }],
    };
    expect(validateGeneratedSong(bad)).toBe(false);
  });

  it('rejects section with empty label', () => {
    const bad = {
      ...validRaw,
      sections: [{ label: '', melodyABC: validABC }],
    };
    expect(validateGeneratedSong(bad)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildSongPrompt
// ---------------------------------------------------------------------------

describe('buildSongPrompt', () => {
  it('includes song title in prompt', () => {
    const prompt = buildSongPrompt({ title: 'Fur Elise', difficulty: 3 });
    expect(prompt).toContain('Fur Elise');
  });

  it('includes artist when provided', () => {
    const prompt = buildSongPrompt({
      title: 'Imagine',
      artist: 'John Lennon',
      difficulty: 2,
    });
    expect(prompt).toContain('John Lennon');
  });

  it('includes ABC instruction', () => {
    const prompt = buildSongPrompt({ title: 'Test', difficulty: 1 });
    expect(prompt).toContain('ABC');
  });

  it('includes difficulty level', () => {
    const prompt = buildSongPrompt({ title: 'Test', difficulty: 4 });
    expect(prompt).toContain('4');
  });
});

// ---------------------------------------------------------------------------
// assembleSong
// ---------------------------------------------------------------------------

describe('assembleSong', () => {
  it('builds Song from valid GeneratedSongABC', () => {
    const song = assembleSong(validRaw, 'gemini');
    expect(song).not.toBeNull();
    expect(song!.metadata.title).toBe('Happy Birthday');
    expect(song!.sections).toHaveLength(2);
    expect(song!.source).toBe('gemini');
    expect(song!.type).toBe('song');
  });

  it('returns null if any section parse fails', () => {
    const bad: GeneratedSongABC = {
      ...validRaw,
      sections: [
        { label: 'Good', melodyABC: validABC },
        { label: 'Bad', melodyABC: 'X:1\nK:C\n' },
      ],
    };
    const song = assembleSong(bad, 'gemini');
    expect(song).toBeNull();
  });

  it('generates slug-based song ID from title', () => {
    const song = assembleSong(validRaw, 'gemini');
    expect(song!.id).toMatch(/^gemini-happy-birthday-/);
  });

  it('sets melody notes with right hand', () => {
    const song = assembleSong(validRaw, 'gemini');
    const fullNotes = song!.sections[0].layers.full;
    expect(fullNotes.every((n) => n.hand === 'right')).toBe(true);
  });

  it('includes accompaniment in full layer when provided', () => {
    const withAccomp: GeneratedSongABC = {
      ...validRaw,
      sections: [
        {
          label: 'Verse',
          melodyABC: validABC,
          accompanimentABC: 'X:1\nT:LH\nM:4/4\nL:1/4\nK:C\nC,E,G,C|',
        },
      ],
    };
    const song = assembleSong(withAccomp, 'gemini');
    expect(song).not.toBeNull();
    const full = song!.sections[0].layers.full;
    // Should have melody (8 notes) + accompaniment (4 notes)
    expect(full.length).toBeGreaterThan(song!.sections[0].layers.melody.length);
    expect(full.some((n) => n.hand === 'left')).toBe(true);
  });

  it('normalizes genre strings', () => {
    const classical = assembleSong({ ...validRaw, genre: 'Classical Music' }, 'gemini');
    expect(classical!.metadata.genre).toBe('classical');

    const film = assembleSong({ ...validRaw, genre: 'Movie Soundtrack' }, 'gemini');
    expect(film!.metadata.genre).toBe('film');
  });
});
