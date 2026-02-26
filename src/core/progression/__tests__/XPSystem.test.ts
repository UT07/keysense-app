/**
 * Comprehensive tests for XP and Level Progression System
 */

import {
  xpForLevel,
  totalXpForLevel,
  levelFromXp,
  getLevelProgress,
  createEmptyStreak,
  isPracticedToday,
  daysSinceLastPractice,
  recordPracticeSession,
  calculateExerciseXp,
  hasAchievement,
  isDailyGoalMet,
  createDailyGoal,
  XP_REWARDS,
} from '../XpSystem';

describe('XPSystem', () => {
  describe('Level Calculations', () => {
    describe('xpForLevel', () => {
      it('should return 100 XP for level 1', () => {
        expect(xpForLevel(1)).toBe(100);
      });

      it('should return 150 XP for level 2', () => {
        expect(xpForLevel(2)).toBe(150);
      });

      it('should return 225 XP for level 3', () => {
        expect(xpForLevel(3)).toBe(225);
      });

      it('should grow exponentially', () => {
        const level5 = xpForLevel(5);
        const level10 = xpForLevel(10);
        expect(level10).toBeGreaterThan(level5 * 5);
      });

      it('should return 0 for invalid level', () => {
        expect(xpForLevel(0)).toBe(0);
        expect(xpForLevel(-1)).toBe(0);
      });
    });

    describe('totalXpForLevel', () => {
      it('should return 0 for level 1 (no XP needed to start)', () => {
        expect(totalXpForLevel(1)).toBe(0);
      });

      it('should return 100 for level 2 (XP needed to reach level 2)', () => {
        expect(totalXpForLevel(2)).toBe(100);
      });

      it('should return 250 for level 3 (100 + 150)', () => {
        expect(totalXpForLevel(3)).toBe(250);
      });

      it('should accumulate correctly', () => {
        const total2 = totalXpForLevel(2);
        const total3 = totalXpForLevel(3);
        expect(total3).toBe(total2 + xpForLevel(2));
      });

      it('should grow for each level', () => {
        for (let level = 2; level <= 10; level++) {
          expect(totalXpForLevel(level)).toBeGreaterThan(totalXpForLevel(level - 1));
        }
      });
    });

    describe('levelFromXp', () => {
      it('should return level 1 for 0-99 XP', () => {
        expect(levelFromXp(0)).toBe(1);
        expect(levelFromXp(50)).toBe(1);
        expect(levelFromXp(99)).toBe(1);
      });

      it('should return level 2 for 100-249 XP', () => {
        expect(levelFromXp(100)).toBe(2);
        expect(levelFromXp(200)).toBe(2);
        expect(levelFromXp(249)).toBe(2);
      });

      it('should return level 3 for 250-474 XP', () => {
        expect(levelFromXp(250)).toBe(3);
        expect(levelFromXp(474)).toBe(3);
      });

      it('should return level 4 for 475+ XP', () => {
        expect(levelFromXp(475)).toBe(4);
        expect(levelFromXp(500)).toBe(4);
      });

      it('should match totalXpForLevel', () => {
        for (let xp = 0; xp <= 10000; xp += 100) {
          const level = levelFromXp(xp);
          const nextLevelXp = totalXpForLevel(level + 1);
          expect(xp).toBeLessThan(nextLevelXp);
        }
      });
    });

    describe('getLevelProgress', () => {
      it('should return correct progress data', () => {
        const progress = getLevelProgress(100);
        expect(progress.level).toBe(2);
        expect(progress.totalXp).toBe(100);
        expect(progress.xpIntoLevel).toBe(0);
      });

      it('should calculate progress to next level', () => {
        const progress = getLevelProgress(125);
        expect(progress.level).toBe(2);
        expect(progress.xpIntoLevel).toBe(25);
        expect(progress.xpToNextLevel).toBe(125);
        expect(progress.percentToNextLevel).toBeLessThanOrEqual(100);
        expect(progress.percentToNextLevel).toBeGreaterThanOrEqual(0);
      });

      it('should handle level 1', () => {
        const progress = getLevelProgress(50);
        expect(progress.level).toBe(1);
        expect(progress.xpIntoLevel).toBe(50);
        expect(progress.xpToNextLevel).toBe(50);
      });
    });
  });

  describe('Streak System', () => {
    describe('createEmptyStreak', () => {
      it('should initialize streak correctly', () => {
        const streak = createEmptyStreak();
        expect(streak.currentStreak).toBe(0);
        expect(streak.longestStreak).toBe(0);
        expect(streak.freezesAvailable).toBe(1);
        expect(streak.weeklyPractice.length).toBe(7);
        expect(streak.weeklyPractice.every((p) => !p)).toBe(true);
      });
    });

    describe('isPracticedToday', () => {
      it('should return false for empty streak', () => {
        const streak = createEmptyStreak();
        expect(isPracticedToday(streak)).toBe(false);
      });

      it('should return true for today practice', () => {
        const today = new Date().toISOString().split('T')[0];
        const streak = { ...createEmptyStreak(), lastPracticeDate: today };
        expect(isPracticedToday(streak)).toBe(true);
      });

      it('should return false for yesterday practice', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const streak = { ...createEmptyStreak(), lastPracticeDate: yesterdayStr };
        expect(isPracticedToday(streak)).toBe(false);
      });
    });

    describe('daysSinceLastPractice', () => {
      it('should return Infinity for no practice', () => {
        const streak = createEmptyStreak();
        expect(daysSinceLastPractice(streak)).toBe(Infinity);
      });

      it('should return 0 for today', () => {
        const today = new Date().toISOString().split('T')[0];
        const streak = { ...createEmptyStreak(), lastPracticeDate: today };
        expect(daysSinceLastPractice(streak)).toBe(0);
      });

      it('should return 1 for yesterday', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const streak = { ...createEmptyStreak(), lastPracticeDate: yesterdayStr };
        const days = daysSinceLastPractice(streak);
        expect(days).toBe(1);
      });
    });

    describe('recordPracticeSession', () => {
      it('should initialize streak on first practice', () => {
        const streak = createEmptyStreak();
        const updated = recordPracticeSession(streak);
        expect(updated.currentStreak).toBe(1);
        expect(updated.longestStreak).toBe(1);
        expect(updated.lastPracticeDate).toBe(new Date().toISOString().split('T')[0]);
      });

      it('should not update if practiced today', () => {
        const today = new Date().toISOString().split('T')[0];
        const streak = { ...createEmptyStreak(), lastPracticeDate: today, currentStreak: 5 };
        const updated = recordPracticeSession(streak);
        expect(updated.currentStreak).toBe(5);
      });

      it('should extend streak if practiced yesterday', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const streak = { ...createEmptyStreak(), lastPracticeDate: yesterdayStr, currentStreak: 3 };
        const updated = recordPracticeSession(streak);
        expect(updated.currentStreak).toBe(4);
      });

      it('should use freeze if available when missing a day', () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
        const streak = {
          ...createEmptyStreak(),
          lastPracticeDate: twoDaysAgoStr,
          currentStreak: 3,
          freezesAvailable: 1,
        };
        const updated = recordPracticeSession(streak);
        expect(updated.currentStreak).toBe(4); // Maintained by freeze
        expect(updated.freezesAvailable).toBe(0);
      });

      it('should break streak if no freeze available', () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
        const streak = {
          ...createEmptyStreak(),
          lastPracticeDate: twoDaysAgoStr,
          currentStreak: 5,
          freezesAvailable: 0,
        };
        const updated = recordPracticeSession(streak);
        expect(updated.currentStreak).toBe(1); // Reset to 1
      });

      it('should break streak on multi-day gap even with freeze available', () => {
        // User missed 5+ days — freeze should NOT save a multi-day gap
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];
        const streak = {
          ...createEmptyStreak(),
          lastPracticeDate: fiveDaysAgoStr,
          currentStreak: 1,
          freezesAvailable: 1,
        };
        const updated = recordPracticeSession(streak);
        expect(updated.currentStreak).toBe(1); // Reset, freeze not used
        expect(updated.freezesAvailable).toBe(1); // Freeze preserved
      });

      it('should award freeze every 7 days', () => {
        // Simulate 7 consecutive days of practice by manually constructing streak state
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Build up streak to 6 days (as if practiced 6 consecutive days ending yesterday)
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let streak: ReturnType<typeof createEmptyStreak> = {
          ...createEmptyStreak(),
          currentStreak: 6,
          longestStreak: 6,
          lastPracticeDate: yesterdayStr,
          freezesAvailable: 1,
        };

        // Day 7 practice (today)
        streak = recordPracticeSession(streak);
        expect(streak.currentStreak).toBe(7);
        expect(streak.freezesAvailable).toBe(2); // Original 1 + 1 for 7-day milestone
      });

      it('should update weekly practice log', () => {
        const streak = createEmptyStreak();
        const updated = recordPracticeSession(streak);
        expect(updated.weeklyPractice[6]).toBe(true);
      });
    });
  });

  describe('Exercise XP Calculation', () => {
    it('should award base XP', () => {
      const xp = calculateExerciseXp(50, 0, false, 0);
      expect(xp).toBeGreaterThanOrEqual(XP_REWARDS.exerciseComplete);
    });

    it('should award star bonuses', () => {
      const baseXp = calculateExerciseXp(50, 0, false, 0);
      const oneStarXp = calculateExerciseXp(70, 1, false, 0);
      const twoStarXp = calculateExerciseXp(80, 2, false, 0);
      const threeStarXp = calculateExerciseXp(95, 3, false, 0);

      expect(oneStarXp).toBeGreaterThan(baseXp);
      expect(twoStarXp).toBeGreaterThan(oneStarXp);
      expect(threeStarXp).toBeGreaterThan(twoStarXp);
    });

    it('should award first completion bonus', () => {
      const repeatXp = calculateExerciseXp(50, 0, false, 0);
      const firstXp = calculateExerciseXp(50, 0, true, 0);
      expect(firstXp).toBeGreaterThan(repeatXp);
    });

    it('should award streak bonus', () => {
      const noStreakXp = calculateExerciseXp(50, 0, false, 0);
      const streakXp = calculateExerciseXp(50, 0, false, 5);
      expect(streakXp).toBeGreaterThan(noStreakXp);
    });

    it('should award increasing streak bonuses', () => {
      const streak1Xp = calculateExerciseXp(50, 0, false, 1);
      const streak7Xp = calculateExerciseXp(50, 0, false, 7);
      expect(streak7Xp).toBeGreaterThan(streak1Xp);
    });
  });

  describe('Achievement System', () => {
    it('should check achievement unlock conditions', () => {
      const hasFirstNote = hasAchievement(1, 0, 'FIRST_NOTE');
      expect(hasFirstNote).toBe(true);
    });

    it('should check multiple conditions', () => {
      const hasLevel10 = hasAchievement(10, 11685, 'LEVEL_10');
      expect(hasLevel10).toBe(true);

      const doesNotHave = hasAchievement(9, 10000, 'LEVEL_10');
      expect(doesNotHave).toBe(false);
    });

    it('should handle special achievements', () => {
      const perfectScore = hasAchievement(1, 0, 'PERFECT_SCORE');
      expect(perfectScore).toBe(false); // Tracked separately
    });
  });

  describe('Daily Goals', () => {
    describe('createDailyGoal', () => {
      it('should create goal with defaults', () => {
        const goal = createDailyGoal();
        expect(goal.minutesTarget).toBe(10);
        expect(goal.exercisesTarget).toBe(3);
        expect(goal.minutesPracticed).toBe(0);
        expect(goal.exercisesCompleted).toBe(0);
      });

      it('should accept custom targets', () => {
        const goal = createDailyGoal(20, 5);
        expect(goal.minutesTarget).toBe(20);
        expect(goal.exercisesTarget).toBe(5);
      });

      it('should set today date', () => {
        const goal = createDailyGoal();
        const today = new Date().toISOString().split('T')[0];
        expect(goal.date).toBe(today);
      });
    });

    describe('isDailyGoalMet', () => {
      it('should return false for incomplete goal', () => {
        const goal = createDailyGoal(10, 3);
        expect(isDailyGoalMet(goal)).toBe(false);
      });

      it('should return true when both targets met', () => {
        const goal = createDailyGoal(10, 3);
        goal.minutesPracticed = 10;
        goal.exercisesCompleted = 3;
        expect(isDailyGoalMet(goal)).toBe(true);
      });

      it('should require both conditions', () => {
        const goal1 = createDailyGoal(10, 3);
        goal1.minutesPracticed = 10;
        expect(isDailyGoalMet(goal1)).toBe(false);

        const goal2 = createDailyGoal(10, 3);
        goal2.exercisesCompleted = 3;
        expect(isDailyGoalMet(goal2)).toBe(false);
      });

      it('should handle exceeding targets', () => {
        const goal = createDailyGoal(10, 3);
        goal.minutesPracticed = 15;
        goal.exercisesCompleted = 5;
        expect(isDailyGoalMet(goal)).toBe(true);
      });
    });
  });
});
