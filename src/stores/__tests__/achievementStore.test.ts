/**
 * Achievement Store Tests
 * Tests state management, check-and-unlock logic, and persistence
 */

import { useAchievementStore, computeAchievementXpReward } from '../achievementStore';
import { PersistenceManager, STORAGE_KEYS } from '../persistence';
import type { AchievementContext } from '@/core/achievements/achievements';

/** Helper: create a default context with all zeros */
function defaultContext(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    totalXp: 0,
    level: 1,
    currentStreak: 0,
    lessonsCompleted: 0,
    perfectScores: 0,
    totalExercisesCompleted: 0,
    totalNotesPlayed: 0,
    catsUnlocked: 0,
    highScoreExercises: 0,
    sessionExercises: 0,
    exercisesWithSameCat: 0,
    isEarlyPractice: false,
    isLatePractice: false,
    ...overrides,
  };
}

describe('Achievement Store', () => {
  beforeEach(() => {
    useAchievementStore.setState({
      unlockedIds: {},
      totalNotesPlayed: 0,
      perfectScoreCount: 0,
      highScoreCount: 0,
    });
    PersistenceManager.deleteState(STORAGE_KEYS.ACHIEVEMENTS);
  });

  describe('Initial State', () => {
    it('should initialize with no unlocked achievements', () => {
      const state = useAchievementStore.getState();
      expect(state.getUnlockedCount()).toBe(0);
      expect(state.totalNotesPlayed).toBe(0);
      expect(state.perfectScoreCount).toBe(0);
      expect(state.highScoreCount).toBe(0);
    });

    it('should report total achievement count', () => {
      const state = useAchievementStore.getState();
      expect(state.getTotalCount()).toBeGreaterThanOrEqual(15);
    });
  });

  describe('isUnlocked', () => {
    it('should return false for locked achievements', () => {
      expect(useAchievementStore.getState().isUnlocked('first-exercise')).toBe(false);
    });

    it('should return true for unlocked achievements', () => {
      useAchievementStore.setState({
        unlockedIds: { 'first-exercise': '2026-02-15T10:00:00.000Z' },
      });
      expect(useAchievementStore.getState().isUnlocked('first-exercise')).toBe(true);
    });
  });

  describe('getUnlockedAchievements', () => {
    it('should return empty array when none unlocked', () => {
      const result = useAchievementStore.getState().getUnlockedAchievements();
      expect(result).toEqual([]);
    });

    it('should return unlocked achievements sorted newest first', () => {
      useAchievementStore.setState({
        unlockedIds: {
          'first-exercise': '2026-02-10T10:00:00.000Z',
          'first-lesson': '2026-02-12T10:00:00.000Z',
          'streak-3': '2026-02-11T10:00:00.000Z',
        },
      });

      const result = useAchievementStore.getState().getUnlockedAchievements();
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('first-lesson');
      expect(result[1].id).toBe('streak-3');
      expect(result[2].id).toBe('first-exercise');
    });
  });

  describe('checkAndUnlock', () => {
    it('should unlock achievements when conditions are met', () => {
      const context = defaultContext({ totalExercisesCompleted: 1 });
      const result = useAchievementStore.getState().checkAndUnlock(context);

      expect(result.length).toBeGreaterThanOrEqual(1);
      const ids = result.map((u) => u.id);
      expect(ids).toContain('first-exercise');
    });

    it('should not re-unlock already unlocked achievements', () => {
      // First unlock
      const context = defaultContext({ totalExercisesCompleted: 1 });
      const first = useAchievementStore.getState().checkAndUnlock(context);
      expect(first.map((u) => u.id)).toContain('first-exercise');

      // Second call with same context should not re-trigger
      const second = useAchievementStore.getState().checkAndUnlock(context);
      const secondIds = second.map((u) => u.id);
      expect(secondIds).not.toContain('first-exercise');
    });

    it('should unlock multiple achievements at once', () => {
      const context = defaultContext({
        totalExercisesCompleted: 10,
        lessonsCompleted: 5,
      });
      const result = useAchievementStore.getState().checkAndUnlock(context);

      const ids = result.map((u) => u.id);
      expect(ids).toContain('first-exercise');
      expect(ids).toContain('ten-exercises');
      expect(ids).toContain('first-lesson');
      expect(ids).toContain('five-lessons');
    });

    it('should persist unlocked achievements after checking', () => {
      const context = defaultContext({ totalExercisesCompleted: 1 });
      useAchievementStore.getState().checkAndUnlock(context);

      expect(useAchievementStore.getState().isUnlocked('first-exercise')).toBe(true);
      expect(useAchievementStore.getState().getUnlockedCount()).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when no new achievements are unlocked', () => {
      const context = defaultContext(); // All zeros, nothing to unlock
      const result = useAchievementStore.getState().checkAndUnlock(context);
      expect(result).toEqual([]);
    });

    it('should include unlock timestamps', () => {
      const context = defaultContext({ totalExercisesCompleted: 1 });
      const result = useAchievementStore.getState().checkAndUnlock(context);

      for (const unlock of result) {
        expect(unlock.unlockedAt).toBeDefined();
        // Should be a valid ISO date string
        expect(new Date(unlock.unlockedAt).toISOString()).toBe(unlock.unlockedAt);
      }
    });

    it('should use store-tracked stats for perfect scores and notes', () => {
      // Set store-tracked stats
      useAchievementStore.setState({
        perfectScoreCount: 1,
        totalNotesPlayed: 100,
      });

      // Context with zero perfect scores - store stats should override
      const context = defaultContext({ totalExercisesCompleted: 1 });
      const result = useAchievementStore.getState().checkAndUnlock(context);
      const ids = result.map((u) => u.id);

      expect(ids).toContain('first-perfect');
      expect(ids).toContain('notes-100');
    });
  });

  describe('incrementNotesPlayed', () => {
    it('should increment notes played count', () => {
      useAchievementStore.getState().incrementNotesPlayed(50);
      expect(useAchievementStore.getState().totalNotesPlayed).toBe(50);

      useAchievementStore.getState().incrementNotesPlayed(30);
      expect(useAchievementStore.getState().totalNotesPlayed).toBe(80);
    });
  });

  describe('recordPerfectScore', () => {
    it('should increment perfect score count', () => {
      useAchievementStore.getState().recordPerfectScore();
      expect(useAchievementStore.getState().perfectScoreCount).toBe(1);

      useAchievementStore.getState().recordPerfectScore();
      expect(useAchievementStore.getState().perfectScoreCount).toBe(2);
    });
  });

  describe('recordHighScore', () => {
    it('should increment high score count', () => {
      useAchievementStore.getState().recordHighScore();
      expect(useAchievementStore.getState().highScoreCount).toBe(1);

      useAchievementStore.getState().recordHighScore();
      expect(useAchievementStore.getState().highScoreCount).toBe(2);
    });
  });

  describe('Reset', () => {
    it('should reset all state to defaults', () => {
      // Set up some state
      useAchievementStore.setState({
        unlockedIds: { 'first-exercise': '2026-02-15T10:00:00.000Z' },
        totalNotesPlayed: 500,
        perfectScoreCount: 10,
        highScoreCount: 20,
      });

      useAchievementStore.getState().reset();

      const state = useAchievementStore.getState();
      expect(state.getUnlockedCount()).toBe(0);
      expect(state.totalNotesPlayed).toBe(0);
      expect(state.perfectScoreCount).toBe(0);
      expect(state.highScoreCount).toBe(0);
    });
  });
});

describe('computeAchievementXpReward', () => {
  it('should return 0 for empty array', () => {
    expect(computeAchievementXpReward([])).toBe(0);
  });

  it('should compute total XP for valid achievement IDs', () => {
    // first-exercise = 10 XP, first-lesson = 25 XP
    const total = computeAchievementXpReward(['first-exercise', 'first-lesson']);
    expect(total).toBe(35);
  });

  it('should skip invalid achievement IDs', () => {
    const total = computeAchievementXpReward(['first-exercise', 'non-existent']);
    expect(total).toBe(10);
  });
});
