/**
 * Data Migration Tests
 * Tests migrateLocalToCloud: XP migration, lesson progress migration,
 * exerciseScores type conversion (local timestamps → Firestore Timestamps),
 * and idempotency via migration flag.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../config', () => ({
  auth: { currentUser: { uid: 'test-user' } },
  db: {},
}));

const mockCreateGamificationData = jest.fn().mockResolvedValue(undefined);
const mockAddXp = jest.fn().mockResolvedValue(1);
const mockCreateLessonProgress = jest.fn().mockResolvedValue(undefined);

jest.mock('../firestore', () => ({
  createGamificationData: (...args: unknown[]) => mockCreateGamificationData(...args),
  addXp: (...args: unknown[]) => mockAddXp(...args),
  createLessonProgress: (...args: unknown[]) => mockCreateLessonProgress(...args),
}));

jest.mock('../../../stores/progressStore', () => ({
  useProgressStore: {
    getState: jest.fn(),
  },
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { migrateLocalToCloud, hasMigrated } from '../dataMigration';
import { useProgressStore } from '../../../stores/progressStore';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockGetState = useProgressStore.getState as jest.Mock;

// ============================================================================
// Tests
// ============================================================================

describe('dataMigration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
  });

  describe('hasMigrated', () => {
    it('should return false when no migration flag exists', async () => {
      mockGetItem.mockResolvedValue(null);
      expect(await hasMigrated()).toBe(false);
    });

    it('should return true when migration flag is set', async () => {
      mockGetItem.mockResolvedValue('true');
      expect(await hasMigrated()).toBe(true);
    });
  });

  describe('migrateLocalToCloud', () => {
    it('should skip if already migrated', async () => {
      mockGetItem.mockResolvedValue('true');

      const result = await migrateLocalToCloud();

      expect(result.migrated).toBe(false);
      expect(mockCreateGamificationData).not.toHaveBeenCalled();
    });

    it('should skip if no authenticated user', async () => {
      const config = require('../config');
      const originalUser = config.auth.currentUser;
      config.auth.currentUser = null;

      const result = await migrateLocalToCloud();

      expect(result.migrated).toBe(false);
      expect(result.error).toBe('No authenticated user');

      config.auth.currentUser = originalUser;
    });

    it('should migrate XP when totalXp > 0', async () => {
      mockGetState.mockReturnValue({
        totalXp: 500,
        lessonProgress: {},
      });

      const result = await migrateLocalToCloud();

      expect(result.migrated).toBe(true);
      expect(mockCreateGamificationData).toHaveBeenCalledWith('test-user');
      expect(mockAddXp).toHaveBeenCalledWith('test-user', 500, 'migration');
    });

    it('should not migrate XP when totalXp is 0', async () => {
      mockGetState.mockReturnValue({
        totalXp: 0,
        lessonProgress: {},
      });

      const result = await migrateLocalToCloud();

      expect(result.migrated).toBe(true);
      expect(mockCreateGamificationData).not.toHaveBeenCalled();
      expect(mockAddXp).not.toHaveBeenCalled();
    });

    it('should convert exerciseScores with proper Timestamp conversion', async () => {
      const localTimestamp = 1700000000000;
      mockGetState.mockReturnValue({
        totalXp: 0,
        lessonProgress: {
          'lesson-01': {
            lessonId: 'lesson-01',
            status: 'in_progress',
            exerciseScores: {
              'lesson-01-ex-01': {
                exerciseId: 'lesson-01-ex-01',
                highScore: 85,
                stars: 2,
                attempts: 3,
                lastAttemptAt: localTimestamp,
                averageScore: 78,
              },
            },
            bestScore: 85,
            totalAttempts: 3,
            totalTimeSpentSeconds: 120,
          },
        },
      });

      await migrateLocalToCloud();

      expect(mockCreateLessonProgress).toHaveBeenCalledWith(
        'test-user',
        'lesson-01',
        expect.objectContaining({
          lessonId: 'lesson-01',
          status: 'in_progress',
          exerciseScores: expect.objectContaining({
            'lesson-01-ex-01': expect.objectContaining({
              exerciseId: 'lesson-01-ex-01',
              highScore: 85,
              stars: 2,
              attempts: 3,
              averageScore: 78,
              // lastAttemptAt should be a Firestore Timestamp, not a number
              lastAttemptAt: expect.objectContaining({
                toMillis: expect.any(Function),
              }),
            }),
          }),
        })
      );

      // Verify the Timestamp conversion produces the correct value
      const call = mockCreateLessonProgress.mock.calls[0];
      const firestoreScore = call[2].exerciseScores['lesson-01-ex-01'];
      expect(firestoreScore.lastAttemptAt.toMillis()).toBe(localTimestamp);
    });

    it('should handle exerciseScores with lastAttemptAt = 0 gracefully', async () => {
      mockGetState.mockReturnValue({
        totalXp: 0,
        lessonProgress: {
          'lesson-01': {
            lessonId: 'lesson-01',
            status: 'in_progress',
            exerciseScores: {
              'lesson-01-ex-01': {
                exerciseId: 'lesson-01-ex-01',
                highScore: 50,
                stars: 1,
                attempts: 1,
                lastAttemptAt: 0, // falsy but valid
                averageScore: 50,
              },
            },
            bestScore: 50,
            totalAttempts: 1,
            totalTimeSpentSeconds: 30,
          },
        },
      });

      await migrateLocalToCloud();

      // Should use Date.now() as fallback when lastAttemptAt is falsy
      const call = mockCreateLessonProgress.mock.calls[0];
      const firestoreScore = call[2].exerciseScores['lesson-01-ex-01'];
      expect(firestoreScore.lastAttemptAt.toMillis()).toBeGreaterThan(0);
    });

    it('should set migration flag after successful migration', async () => {
      mockGetState.mockReturnValue({
        totalXp: 0,
        lessonProgress: {},
      });

      await migrateLocalToCloud();

      expect(mockSetItem).toHaveBeenCalledWith('purrrfect_keys_migrated', 'true');
    });

    it('should return error on failure without setting migration flag', async () => {
      mockGetState.mockReturnValue({
        totalXp: 100,
        lessonProgress: {},
      });
      mockCreateGamificationData.mockRejectedValue(new Error('Firestore error'));

      const result = await migrateLocalToCloud();

      expect(result.migrated).toBe(false);
      expect(result.error).toBe('Firestore error');
      expect(mockSetItem).not.toHaveBeenCalledWith('purrrfect_keys_migrated', 'true');
    });
  });
});
