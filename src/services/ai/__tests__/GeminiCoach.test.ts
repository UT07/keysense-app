/**
 * GeminiCoach test suite
 *
 * Tests the fallback chain: cache → Cloud Function → direct Gemini API → offline templates.
 * Also tests timeout protection, caching, and response validation.
 */

import type { CoachRequest } from '../GeminiCoach';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock AsyncStorage (used by cache)
const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve([...mockStorage.keys()])),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((k) => mockStorage.delete(k));
    return Promise.resolve();
  }),
}));

// Mock firebase/functions
const mockCallable = jest.fn();
jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => mockCallable),
}));

// Mock firebase config
jest.mock('../../firebase/config', () => ({
  functions: {},
}));

// Mock Gemini API
const mockGenerateContent = jest.fn();
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: mockGenerateContent,
    }),
  })),
}));

// Mock offline templates
jest.mock('../../../content/offlineCoachingTemplates', () => ({
  getOfflineCoachingText: jest.fn(
    () => 'Keep practicing! You are getting better with each try.'
  ),
}));

// Mock withTimeout to pass through by default (no actual timeout)
jest.mock('../../../utils/withTimeout', () => ({
  withTimeout: jest.fn((promise: Promise<unknown>) => promise),
}));

// ─── Test Data ──────────────────────────────────────────────────────────────

const baseRequest: CoachRequest = {
  exerciseId: 'lesson-01-ex-01',
  exerciseTitle: 'Find Middle C',
  difficulty: 1,
  score: {
    overall: 75,
    accuracy: 80,
    timing: 70,
    completeness: 90,
  },
  issues: {
    pitchErrors: [{ expected: 'C4', played: 'D4', beatPosition: 2 }],
    timingErrors: [{ note: 'E4', offsetMs: -120, beatPosition: 3 }],
    missedCount: 1,
    extraCount: 0,
  },
  context: {
    attemptNumber: 2,
    previousScore: 60,
    userLevel: 3,
    sessionMinutes: 8,
  },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GeminiCoach', () => {
  // Must be required after mocks are set up
  let GeminiCoach: typeof import('../GeminiCoach').GeminiCoach;

  beforeEach(() => {
    jest.resetModules();
    mockStorage.clear();
    mockCallable.mockReset();
    mockGenerateContent.mockReset();

    // Fresh import after mock reset
    GeminiCoach = require('../GeminiCoach').GeminiCoach;

    // babel-preset-expo inlines process.env.EXPO_PUBLIC_* at compile time,
    // so runtime assignments have no effect. Pre-set the private genAI field
    // to bypass initialize()'s env-var check for tests needing the direct API path.
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    (GeminiCoach as any).genAI = new GoogleGenerativeAI('test-key');
  });

  describe('Cloud Function path', () => {
    it('returns feedback from Cloud Function when available', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { feedback: 'Great rhythm! Try holding C4 a bit longer.' },
      });

      const result = await GeminiCoach.getFeedback(baseRequest);

      expect(result).toBe('Great rhythm! Try holding C4 a bit longer.');
    });

    it('caches successful Cloud Function response', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { feedback: 'Cached feedback!' },
      });

      // First call — hits CF
      await GeminiCoach.getFeedback(baseRequest);
      // Second call — should hit cache
      const result = await GeminiCoach.getFeedback(baseRequest);

      expect(result).toBe('Cached feedback!');
      // CF should only be called once
      expect(mockCallable).toHaveBeenCalledTimes(1);
    });
  });

  describe('Direct Gemini API fallback', () => {
    it('falls back to direct API when Cloud Function fails', async () => {
      mockCallable.mockRejectedValueOnce(new Error('functions/unavailable'));
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => 'Nice work! Focus on beat 3 timing.' },
      });

      const result = await GeminiCoach.getFeedback(baseRequest);

      expect(result).toBe('Nice work! Focus on beat 3 timing.');
    });

    it('falls back to offline templates when both CF and API fail', async () => {
      mockCallable.mockRejectedValueOnce(new Error('functions/unavailable'));
      mockGenerateContent.mockRejectedValueOnce(new Error('network error'));

      const result = await GeminiCoach.getFeedback(baseRequest);

      expect(result).toBe('Keep practicing! You are getting better with each try.');
    });
  });

  describe('Response validation', () => {
    it('rejects responses containing forbidden phrases', async () => {
      mockCallable.mockRejectedValueOnce(new Error('unavailable'));
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => 'As an AI, I think you did well!' },
      });

      const result = await GeminiCoach.getFeedback(baseRequest);

      // Should fall back to offline template
      expect(result).toBe('Keep practicing! You are getting better with each try.');
    });

    it('rejects overly long responses (>5 sentences)', async () => {
      mockCallable.mockRejectedValueOnce(new Error('unavailable'));
      mockGenerateContent.mockResolvedValueOnce({
        response: {
          text: () =>
            'One. Two. Three. Four. Five. Six. This is way too long for coaching feedback.',
        },
      });

      const result = await GeminiCoach.getFeedback(baseRequest);

      expect(result).toBe('Keep practicing! You are getting better with each try.');
    });
  });

  describe('Cache management', () => {
    it('clearAllCache removes all cached responses', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { feedback: 'Cached!' },
      });
      await GeminiCoach.getFeedback(baseRequest);

      await GeminiCoach.clearAllCache();

      // After clearing, should hit CF again
      mockCallable.mockResolvedValueOnce({
        data: { feedback: 'Fresh!' },
      });
      const result = await GeminiCoach.getFeedback(baseRequest);
      expect(result).toBe('Fresh!');
      expect(mockCallable).toHaveBeenCalledTimes(2);
    });

    it('getCacheStats returns correct count and size', async () => {
      mockCallable.mockResolvedValueOnce({
        data: { feedback: 'Some feedback' },
      });
      await GeminiCoach.getFeedback(baseRequest);

      const stats = await GeminiCoach.getCacheStats();
      expect(stats.itemCount).toBe(1);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('No API key', () => {
    it('falls back to offline templates when API key is missing', async () => {
      // Fresh class has genAI = null. Since Babel inlines the env var as undefined,
      // initialize() will always throw → falls back to offline templates.
      jest.resetModules();
      const { GeminiCoach: FreshCoach } = require('../GeminiCoach');

      mockCallable.mockRejectedValueOnce(new Error('unavailable'));

      const result = await FreshCoach.getFeedback(baseRequest);

      expect(result).toBe('Keep practicing! You are getting better with each try.');
    });
  });
});
