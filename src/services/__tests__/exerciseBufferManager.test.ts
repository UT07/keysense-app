/**
 * Tests for Exercise Buffer Manager
 */

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../geminiExerciseService', () => ({
  generateExercise: jest.fn(),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateExercise } from '../geminiExerciseService';
import type { AIExercise } from '../geminiExerciseService';
import {
  getNextExercise,
  getNextExerciseForSkill,
  addExercise,
  getBufferSize,
  fillBuffer,
  fillBufferForSkills,
  clearBuffer,
  BUFFER_TARGET,
  BUFFER_MAX_SIZE,
} from '../exerciseBufferManager';
import type { BufferedExercise } from '../exerciseBufferManager';

// ============================================================================
// Helpers
// ============================================================================

const makeExercise = (id: number): AIExercise => ({
  notes: [{ note: 60 + id, startBeat: 0, durationBeats: 1 }],
  settings: { tempo: 80, timeSignature: [4, 4] as [number, number], keySignature: 'C' },
});

const makeBuffered = (id: number, skillId: string = 'unknown'): BufferedExercise => ({
  exercise: makeExercise(id),
  targetSkillId: skillId,
});

const STORAGE_KEY = 'keysense_exercise_buffer';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;
const mockGenerateExercise = generateExercise as jest.Mock;

// ============================================================================
// Tests
// ============================================================================

describe('exerciseBufferManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  // --------------------------------------------------------------------------
  // getNextExercise
  // --------------------------------------------------------------------------

  describe('getNextExercise', () => {
    it('returns null when buffer is empty', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await getNextExercise();

      expect(result).toBeNull();
    });

    it('returns first exercise and removes it from buffer', async () => {
      const entries = [makeBuffered(1), makeBuffered(2), makeBuffered(3)];
      mockGetItem.mockResolvedValue(JSON.stringify(entries));

      const result = await getNextExercise();

      expect(result).toEqual(makeExercise(1));
      expect(mockSetItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify([makeBuffered(2), makeBuffered(3)])
      );
    });
  });

  // --------------------------------------------------------------------------
  // getNextExerciseForSkill
  // --------------------------------------------------------------------------

  describe('getNextExerciseForSkill', () => {
    it('returns exercise matching the skill', async () => {
      const entries = [
        makeBuffered(1, 'rh-cde'),
        makeBuffered(2, 'white-keys'),
        makeBuffered(3, 'rh-cde'),
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(entries));

      const result = await getNextExerciseForSkill('white-keys');

      expect(result).toEqual(makeExercise(2));
      // Buffer should have entries 1 and 3 remaining
      const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(saved).toHaveLength(2);
      expect(saved[0].targetSkillId).toBe('rh-cde');
      expect(saved[1].targetSkillId).toBe('rh-cde');
    });

    it('returns null when no skill match (instead of wrong-skill fallback)', async () => {
      const entries = [makeBuffered(1, 'rh-cde'), makeBuffered(2, 'rh-cde')];
      mockGetItem.mockResolvedValue(JSON.stringify(entries));

      const result = await getNextExerciseForSkill('white-keys');

      // Should return null so caller uses template fallback for correct skill
      expect(result).toBeNull();
    });

    it('returns null when buffer is empty', async () => {
      mockGetItem.mockResolvedValue(null);

      const result = await getNextExerciseForSkill('rh-cde');

      expect(result).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // addExercise
  // --------------------------------------------------------------------------

  describe('addExercise', () => {
    it('adds exercise to end of buffer with skillId', async () => {
      const existing = [makeBuffered(1, 'rh-cde')];
      mockGetItem.mockResolvedValue(JSON.stringify(existing));
      const newExercise = makeExercise(2);

      await addExercise(newExercise, 'white-keys');

      const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(saved).toHaveLength(2);
      expect(saved[1].targetSkillId).toBe('white-keys');
      expect(saved[1].exercise).toEqual(makeExercise(2));
    });

    it('defaults to unknown skillId when not provided', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([]));

      await addExercise(makeExercise(1));

      const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(saved[0].targetSkillId).toBe('unknown');
    });

    it('trims oldest when buffer exceeds max size', async () => {
      const exercises = Array.from({ length: BUFFER_MAX_SIZE }, (_, i) =>
        makeBuffered(i, `skill-${i}`)
      );
      mockGetItem.mockResolvedValue(JSON.stringify(exercises));

      await addExercise(makeExercise(99), 'new-skill');

      const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(saved).toHaveLength(BUFFER_MAX_SIZE);
      // First exercise (id 0) should be evicted
      expect(saved[0].targetSkillId).toBe('skill-1');
      // Last exercise should be the newly added one
      expect(saved[saved.length - 1].targetSkillId).toBe('new-skill');
    });
  });

  // --------------------------------------------------------------------------
  // getBufferSize
  // --------------------------------------------------------------------------

  describe('getBufferSize', () => {
    it('returns current count', async () => {
      const entries = [makeBuffered(1), makeBuffered(2), makeBuffered(3), makeBuffered(4)];
      mockGetItem.mockResolvedValue(JSON.stringify(entries));

      const size = await getBufferSize();

      expect(size).toBe(4);
    });

    it('returns 0 for empty buffer', async () => {
      mockGetItem.mockResolvedValue(null);

      const size = await getBufferSize();

      expect(size).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // fillBuffer
  // --------------------------------------------------------------------------

  describe('fillBuffer', () => {
    const params = {
      weakNotes: [60],
      tempoRange: { min: 80, max: 120 },
      difficulty: 3,
      noteCount: 8,
      skills: {
        timingAccuracy: 0.7,
        pitchAccuracy: 0.8,
        sightReadSpeed: 0.6,
        chordRecognition: 0.5,
      },
      targetSkillId: 'rh-cde',
    };

    it('generates exercises up to target', async () => {
      const existing = [makeBuffered(0, 'rh-cde')];
      mockGetItem.mockResolvedValue(JSON.stringify(existing));

      // Need BUFFER_TARGET - 1 = 4 more exercises
      mockGenerateExercise
        .mockResolvedValueOnce(makeExercise(1))
        .mockResolvedValueOnce(makeExercise(2))
        .mockResolvedValueOnce(makeExercise(3))
        .mockResolvedValueOnce(makeExercise(4));

      await fillBuffer(params);

      expect(mockGenerateExercise).toHaveBeenCalledTimes(BUFFER_TARGET - 1);
      const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(saved).toHaveLength(BUFFER_TARGET);
      // All new entries should have the skillId from params
      expect(saved[1].targetSkillId).toBe('rh-cde');
    });

    it('handles generation failures gracefully', async () => {
      const existing = [makeBuffered(0)];
      mockGetItem.mockResolvedValue(JSON.stringify(existing));

      // Two nulls, then successes — nulls don't add to buffer but loop continues
      mockGenerateExercise
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeExercise(1))
        .mockResolvedValueOnce(makeExercise(2));

      await fillBuffer(params);

      // Called 4 times (BUFFER_TARGET - 1 iterations)
      expect(mockGenerateExercise).toHaveBeenCalledTimes(BUFFER_TARGET - 1);
      // Only successful ones get added: original + 2 successes = 3
      const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(saved).toHaveLength(3);
    });

    it('does nothing when buffer is already at target', async () => {
      const entries = Array.from({ length: BUFFER_TARGET }, (_, i) => makeBuffered(i));
      mockGetItem.mockResolvedValue(JSON.stringify(entries));

      await fillBuffer(params);

      expect(mockGenerateExercise).not.toHaveBeenCalled();
      const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(saved).toHaveLength(BUFFER_TARGET);
    });
  });

  // --------------------------------------------------------------------------
  // fillBufferForSkills
  // --------------------------------------------------------------------------

  describe('fillBufferForSkills', () => {
    it('generates exercises for multiple skills', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([]));

      const baseParams = {
        weakNotes: [],
        tempoRange: { min: 60, max: 100 },
        difficulty: 2,
        noteCount: 8,
        skills: { timingAccuracy: 0.7, pitchAccuracy: 0.8, sightReadSpeed: 0.6, chordRecognition: 0.5 },
      };

      mockGenerateExercise
        .mockResolvedValueOnce(makeExercise(1))
        .mockResolvedValueOnce(makeExercise(2))
        .mockResolvedValueOnce(makeExercise(3));

      await fillBufferForSkills([
        { skillId: 'rh-cde', params: { ...baseParams, targetSkillId: 'rh-cde' }, count: 2 },
        { skillId: 'white-keys', params: { ...baseParams, targetSkillId: 'white-keys' }, count: 1 },
      ]);

      expect(mockGenerateExercise).toHaveBeenCalledTimes(3);
      const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(saved).toHaveLength(3);
      expect(saved[0].targetSkillId).toBe('rh-cde');
      expect(saved[1].targetSkillId).toBe('rh-cde');
      expect(saved[2].targetSkillId).toBe('white-keys');
    });

    it('stops when buffer reaches max size', async () => {
      const existing = Array.from({ length: BUFFER_MAX_SIZE - 1 }, (_, i) => makeBuffered(i));
      mockGetItem.mockResolvedValue(JSON.stringify(existing));

      mockGenerateExercise
        .mockResolvedValueOnce(makeExercise(50))
        .mockResolvedValueOnce(makeExercise(51));

      const baseParams = {
        weakNotes: [],
        tempoRange: { min: 60, max: 100 },
        difficulty: 2,
        noteCount: 8,
        skills: { timingAccuracy: 0.7, pitchAccuracy: 0.8, sightReadSpeed: 0.6, chordRecognition: 0.5 },
      };

      await fillBufferForSkills([
        { skillId: 'rh-cde', params: baseParams, count: 5 },
      ]);

      // Only 1 slot available, so only 1 generation call
      expect(mockGenerateExercise).toHaveBeenCalledTimes(1);
      const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(saved).toHaveLength(BUFFER_MAX_SIZE);
    });

    it('handles generation failures gracefully', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([]));

      mockGenerateExercise
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(makeExercise(1));

      const baseParams = {
        weakNotes: [],
        tempoRange: { min: 60, max: 100 },
        difficulty: 2,
        noteCount: 8,
        skills: { timingAccuracy: 0.7, pitchAccuracy: 0.8, sightReadSpeed: 0.6, chordRecognition: 0.5 },
      };

      await fillBufferForSkills([
        { skillId: 'rh-cde', params: baseParams, count: 2 },
      ]);

      // Both attempts called, one failed
      expect(mockGenerateExercise).toHaveBeenCalledTimes(2);
      const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(saved).toHaveLength(1);
      expect(saved[0].targetSkillId).toBe('rh-cde');
    });
  });

  // --------------------------------------------------------------------------
  // Legacy format migration
  // --------------------------------------------------------------------------

  describe('legacy format migration', () => {
    it('migrates plain AIExercise[] to BufferedExercise[]', async () => {
      // Old format: raw AIExercise array without wrapper
      const legacyBuffer = [makeExercise(1), makeExercise(2)];
      mockGetItem.mockResolvedValue(JSON.stringify(legacyBuffer));

      const result = await getNextExercise();

      expect(result).toEqual(makeExercise(1));
      // Remaining buffer should be in new format
      const saved = JSON.parse(mockSetItem.mock.calls[0][1]);
      expect(saved).toHaveLength(1);
      expect(saved[0].exercise).toEqual(makeExercise(2));
      expect(saved[0].targetSkillId).toBe('unknown');
    });
  });

  // --------------------------------------------------------------------------
  // clearBuffer
  // --------------------------------------------------------------------------

  describe('clearBuffer', () => {
    it('removes all exercises', async () => {
      await clearBuffer();

      expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
    });
  });
});
