/**
 * Achievement Definitions and Condition Checking Tests
 * Tests pure TypeScript logic - no React dependencies
 */

import {
  ACHIEVEMENTS,
  checkAchievements,
  isConditionMet,
  getAchievementById,
  getAchievementsByCategory,
} from '../achievements';
import type { AchievementContext, AchievementCondition } from '../achievements';

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

describe('Achievement Definitions', () => {
  it('should have at least 30 achievements', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
  });

  it('should have unique IDs', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have valid categories for all achievements', () => {
    const validCategories = ['milestone', 'streak', 'score', 'xp', 'practice', 'collection'];
    for (const achievement of ACHIEVEMENTS) {
      expect(validCategories).toContain(achievement.category);
    }
  });

  it('should have positive XP rewards for all achievements', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.xpReward).toBeGreaterThan(0);
    }
  });

  it('should have non-empty titles and descriptions', () => {
    for (const achievement of ACHIEVEMENTS) {
      expect(achievement.title.length).toBeGreaterThan(0);
      expect(achievement.description.length).toBeGreaterThan(0);
    }
  });
});

describe('getAchievementById', () => {
  it('should return achievement for valid ID', () => {
    const achievement = getAchievementById('first-exercise');
    expect(achievement).toBeDefined();
    expect(achievement?.title).toBe('First Note');
  });

  it('should return undefined for invalid ID', () => {
    const achievement = getAchievementById('does-not-exist');
    expect(achievement).toBeUndefined();
  });
});

describe('getAchievementsByCategory', () => {
  it('should return achievements filtered by category', () => {
    const streakAchievements = getAchievementsByCategory('streak');
    expect(streakAchievements.length).toBeGreaterThanOrEqual(4);
    for (const a of streakAchievements) {
      expect(a.category).toBe('streak');
    }
  });

  it('should return empty array for non-existent category', () => {
    // Cast to bypass type checking for this edge case test
    const result = getAchievementsByCategory('nonexistent' as 'milestone');
    expect(result).toEqual([]);
  });
});

describe('isConditionMet', () => {
  it('should check lessons_completed condition', () => {
    const condition: AchievementCondition = { type: 'lessons_completed', threshold: 5 };
    expect(isConditionMet(condition, defaultContext({ lessonsCompleted: 4 }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ lessonsCompleted: 5 }))).toBe(true);
    expect(isConditionMet(condition, defaultContext({ lessonsCompleted: 10 }))).toBe(true);
  });

  it('should check exercises_completed condition', () => {
    const condition: AchievementCondition = { type: 'exercises_completed', threshold: 1 };
    expect(isConditionMet(condition, defaultContext({ totalExercisesCompleted: 0 }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ totalExercisesCompleted: 1 }))).toBe(true);
  });

  it('should check current_streak condition', () => {
    const condition: AchievementCondition = { type: 'current_streak', threshold: 7 };
    expect(isConditionMet(condition, defaultContext({ currentStreak: 6 }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ currentStreak: 7 }))).toBe(true);
    expect(isConditionMet(condition, defaultContext({ currentStreak: 30 }))).toBe(true);
  });

  it('should check perfect_scores condition', () => {
    const condition: AchievementCondition = { type: 'perfect_scores', threshold: 1 };
    expect(isConditionMet(condition, defaultContext({ perfectScores: 0 }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ perfectScores: 1 }))).toBe(true);
  });

  it('should check high_score_count condition', () => {
    const condition: AchievementCondition = { type: 'high_score_count', threshold: 10 };
    expect(isConditionMet(condition, defaultContext({ highScoreExercises: 9 }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ highScoreExercises: 10 }))).toBe(true);
  });

  it('should check total_xp condition', () => {
    const condition: AchievementCondition = { type: 'total_xp', threshold: 1000 };
    expect(isConditionMet(condition, defaultContext({ totalXp: 999 }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ totalXp: 1000 }))).toBe(true);
  });

  it('should check level condition', () => {
    const condition: AchievementCondition = { type: 'level', threshold: 5 };
    expect(isConditionMet(condition, defaultContext({ level: 4 }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ level: 5 }))).toBe(true);
  });

  it('should check total_notes_played condition', () => {
    const condition: AchievementCondition = { type: 'total_notes_played', threshold: 100 };
    expect(isConditionMet(condition, defaultContext({ totalNotesPlayed: 99 }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ totalNotesPlayed: 100 }))).toBe(true);
  });

  it('should check cats_unlocked condition', () => {
    const condition: AchievementCondition = { type: 'cats_unlocked', threshold: 3 };
    expect(isConditionMet(condition, defaultContext({ catsUnlocked: 2 }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ catsUnlocked: 3 }))).toBe(true);
  });

  it('should check session_exercises condition', () => {
    const condition: AchievementCondition = { type: 'session_exercises', threshold: 10 };
    expect(isConditionMet(condition, defaultContext({ sessionExercises: 9 }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ sessionExercises: 10 }))).toBe(true);
  });

  it('should check exercises_with_same_cat condition', () => {
    const condition: AchievementCondition = { type: 'exercises_with_same_cat', threshold: 50 };
    expect(isConditionMet(condition, defaultContext({ exercisesWithSameCat: 49 }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ exercisesWithSameCat: 50 }))).toBe(true);
  });

  it('should check early_practice condition', () => {
    const condition: AchievementCondition = { type: 'early_practice', threshold: 1 };
    expect(isConditionMet(condition, defaultContext({ isEarlyPractice: false }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ isEarlyPractice: true }))).toBe(true);
  });

  it('should check late_practice condition', () => {
    const condition: AchievementCondition = { type: 'late_practice', threshold: 1 };
    expect(isConditionMet(condition, defaultContext({ isLatePractice: false }))).toBe(false);
    expect(isConditionMet(condition, defaultContext({ isLatePractice: true }))).toBe(true);
  });
});

describe('checkAchievements', () => {
  it('should return empty array when no conditions are met', () => {
    const result = checkAchievements(defaultContext(), new Set());
    expect(result).toEqual([]);
  });

  it('should return newly unlocked achievement IDs', () => {
    const context = defaultContext({ totalExercisesCompleted: 1 });
    const result = checkAchievements(context, new Set());
    expect(result).toContain('first-exercise');
  });

  it('should not return already-unlocked achievements', () => {
    const context = defaultContext({ totalExercisesCompleted: 1 });
    const alreadyUnlocked = new Set(['first-exercise']);
    const result = checkAchievements(context, alreadyUnlocked);
    expect(result).not.toContain('first-exercise');
  });

  it('should unlock multiple achievements at once', () => {
    const context = defaultContext({
      totalExercisesCompleted: 10,
      lessonsCompleted: 1,
      totalNotesPlayed: 100,
    });
    const result = checkAchievements(context, new Set());
    expect(result).toContain('first-exercise');
    expect(result).toContain('ten-exercises');
    expect(result).toContain('first-lesson');
    expect(result).toContain('notes-100');
    expect(result.length).toBeGreaterThanOrEqual(4);
  });

  it('should handle partial unlocks correctly', () => {
    const context = defaultContext({
      totalExercisesCompleted: 10,
      lessonsCompleted: 1,
    });
    const alreadyUnlocked = new Set(['first-exercise', 'first-lesson']);
    const result = checkAchievements(context, alreadyUnlocked);
    expect(result).not.toContain('first-exercise');
    expect(result).not.toContain('first-lesson');
    expect(result).toContain('ten-exercises');
  });

  it('should unlock streak achievements when streak is high enough', () => {
    const context = defaultContext({ currentStreak: 7 });
    const result = checkAchievements(context, new Set());
    expect(result).toContain('streak-3');
    expect(result).toContain('streak-7');
    expect(result).not.toContain('streak-14');
  });

  it('should unlock level achievements', () => {
    const context = defaultContext({ level: 10, totalXp: 5000 });
    const result = checkAchievements(context, new Set());
    expect(result).toContain('level-5');
    expect(result).toContain('level-10');
    expect(result).toContain('xp-1000');
  });

  it('should unlock cat collection achievements', () => {
    const context = defaultContext({ catsUnlocked: 3 });
    const result = checkAchievements(context, new Set());
    expect(result).toContain('cats-3');
    expect(result).not.toContain('cats-all');
  });

  it('should unlock all cat achievements when all 8 are unlocked', () => {
    const context = defaultContext({ catsUnlocked: 8 });
    const result = checkAchievements(context, new Set());
    expect(result).toContain('cats-3');
    expect(result).toContain('cats-all');
  });

  it('should unlock session marathon when 10+ exercises in one session', () => {
    const context = defaultContext({ sessionExercises: 10 });
    const result = checkAchievements(context, new Set());
    expect(result).toContain('session-marathon');
  });

  it('should unlock early bird when practicing before 8am', () => {
    const context = defaultContext({ isEarlyPractice: true });
    const result = checkAchievements(context, new Set());
    expect(result).toContain('early-bird');
    expect(result).not.toContain('night-owl');
  });

  it('should unlock night owl when practicing after 10pm', () => {
    const context = defaultContext({ isLatePractice: true });
    const result = checkAchievements(context, new Set());
    expect(result).toContain('night-owl');
    expect(result).not.toContain('early-bird');
  });

  it('should unlock cat companion achievements', () => {
    const context = defaultContext({ exercisesWithSameCat: 100 });
    const result = checkAchievements(context, new Set());
    expect(result).toContain('cat-duo');
    expect(result).toContain('best-friends');
  });

  it('should unlock century streak', () => {
    const context = defaultContext({ currentStreak: 100 });
    const result = checkAchievements(context, new Set());
    expect(result).toContain('streak-3');
    expect(result).toContain('streak-7');
    expect(result).toContain('streak-14');
    expect(result).toContain('streak-30');
    expect(result).toContain('streak-100');
  });
});
