/**
 * Progress Store Tests
 * Tests XP progression, streak tracking, lesson progress, and daily goals
 */

// Mock Firebase config (imported transitively via socialService/leagueService)
jest.mock('../../services/firebase/config', () => ({
  auth: { currentUser: null },
  db: {},
  functions: {},
}));

jest.mock('../../services/firebase/socialService', () => ({
  postActivity: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/firebase/leagueService', () => ({
  addLeagueXp: jest.fn().mockResolvedValue(undefined),
}));

import { useProgressStore } from '../progressStore';
import { useCatEvolutionStore } from '../catEvolutionStore';
import { PersistenceManager, STORAGE_KEYS } from '../persistence';
import type { LessonProgress, ExerciseProgress } from '@/core/exercises/types';

describe('Progress Store', () => {
  beforeEach(() => {
    useProgressStore.setState({
      totalXp: 0,
      level: 1,
      streakData: {
        currentStreak: 0,
        longestStreak: 0,
        lastPracticeDate: new Date().toISOString().split('T')[0],
        freezesAvailable: 1,
        freezesUsed: 0,
        weeklyPractice: [false, false, false, false, false, false, false],
      },
      lessonProgress: {},
      dailyGoalData: {},
      streakMilestonesClaimed: [],
    });
    // Mark daily challenge completed to isolate XP tests from challenge multiplier
    useCatEvolutionStore.setState({ lastDailyChallengeDate: new Date().toISOString().split('T')[0] });
    PersistenceManager.deleteState(STORAGE_KEYS.PROGRESS);
  });

  describe('XP System', () => {
    it('should initialize with 0 XP and level 1', () => {
      const state = useProgressStore.getState();
      expect(state.totalXp).toBe(0);
      expect(state.level).toBe(1);
    });

    it('should add XP correctly', () => {
      useProgressStore.getState().addXp(50);
      expect(useProgressStore.getState().totalXp).toBe(50);

      useProgressStore.getState().addXp(30);
      expect(useProgressStore.getState().totalXp).toBe(80);
    });

    it('should set level', () => {
      useProgressStore.getState().setLevel(5);
      expect(useProgressStore.getState().level).toBe(5);
    });

    it('should handle large XP values', () => {
      useProgressStore.getState().addXp(10000);
      expect(useProgressStore.getState().totalXp).toBe(10000);
    });
  });

  describe('Streak Data', () => {
    it('should initialize streak data', () => {
      const streakData = useProgressStore.getState().streakData;
      expect(streakData.currentStreak).toBe(0);
      expect(streakData.longestStreak).toBe(0);
      expect(streakData.freezesAvailable).toBe(1);
      expect(streakData.weeklyPractice).toHaveLength(7);
    });

    it('should update streak data', () => {
      useProgressStore.getState().updateStreakData({
        currentStreak: 5,
        longestStreak: 10,
      });

      const streakData = useProgressStore.getState().streakData;
      expect(streakData.currentStreak).toBe(5);
      expect(streakData.longestStreak).toBe(10);
      expect(streakData.freezesAvailable).toBe(1); // Should preserve other properties
    });

    it('should track weekly practice', () => {
      const newWeekly = [true, false, true, false, true, false, true];
      useProgressStore.getState().updateStreakData({
        weeklyPractice: newWeekly,
      });

      expect(useProgressStore.getState().streakData.weeklyPractice).toEqual(newWeekly);
    });
  });

  describe('Lesson Progress', () => {
    it('should update lesson progress', () => {
      const progress: LessonProgress = {
        lessonId: 'lesson-1',
        status: 'in_progress',
        exerciseScores: {},
        bestScore: 0,
        totalAttempts: 0,
        totalTimeSpentSeconds: 0,
      };

      useProgressStore.getState().updateLessonProgress('lesson-1', progress);

      const retrieved = useProgressStore.getState().getLessonProgress('lesson-1');
      expect(retrieved).toEqual(progress);
    });

    it('should return null for missing lesson', () => {
      const result = useProgressStore.getState().getLessonProgress('non-existent');
      expect(result).toBeNull();
    });

    it('should store multiple lessons', () => {
      const lesson1: LessonProgress = {
        lessonId: 'lesson-1',
        status: 'completed',
        exerciseScores: {},
        bestScore: 90,
        totalAttempts: 3,
        totalTimeSpentSeconds: 600,
      };

      const lesson2: LessonProgress = {
        lessonId: 'lesson-2',
        status: 'in_progress',
        exerciseScores: {},
        bestScore: 70,
        totalAttempts: 2,
        totalTimeSpentSeconds: 400,
      };

      useProgressStore.getState().updateLessonProgress('lesson-1', lesson1);
      useProgressStore.getState().updateLessonProgress('lesson-2', lesson2);

      expect(useProgressStore.getState().getLessonProgress('lesson-1')).toEqual(lesson1);
      expect(useProgressStore.getState().getLessonProgress('lesson-2')).toEqual(lesson2);
    });
  });

  describe('Exercise Progress', () => {
    it('should update exercise progress within a lesson', () => {
      const lessonProgress: LessonProgress = {
        lessonId: 'lesson-1',
        status: 'in_progress',
        exerciseScores: {},
        bestScore: 0,
        totalAttempts: 0,
        totalTimeSpentSeconds: 0,
      };

      useProgressStore.getState().updateLessonProgress('lesson-1', lessonProgress);

      const exerciseProgress: ExerciseProgress = {
        exerciseId: 'ex-1',
        highScore: 85,
        stars: 2,
        attempts: 3,
        lastAttemptAt: Date.now(),
        averageScore: 75,
        completedAt: Date.now(),
      };

      useProgressStore.getState().updateExerciseProgress('lesson-1', 'ex-1', exerciseProgress);

      const retrieved = useProgressStore.getState().getExerciseProgress('lesson-1', 'ex-1');
      expect(retrieved).toEqual(exerciseProgress);
    });

    it('should return null for missing exercise', () => {
      const result = useProgressStore.getState().getExerciseProgress('lesson-1', 'ex-1');
      expect(result).toBeNull();
    });
  });

  describe('Daily Goals', () => {
    it('should initialize empty daily goal data', () => {
      expect(useProgressStore.getState().dailyGoalData).toEqual({});
    });

    it('should update daily goal', () => {
      const today = new Date().toISOString().split('T')[0];
      useProgressStore.getState().updateDailyGoal(today, {
        minutesTarget: 15,
        minutesPracticed: 10,
      });

      const goal = useProgressStore.getState().dailyGoalData[today];
      expect(goal.minutesTarget).toBe(15);
      expect(goal.minutesPracticed).toBe(10);
    });

    it('should record practice session', () => {
      const today = new Date().toISOString().split('T')[0];
      useProgressStore.getState().recordPracticeSession(5);

      const goal = useProgressStore.getState().dailyGoalData[today];
      expect(goal.minutesPracticed).toBe(5);
    });

    it('should accumulate practice time', () => {
      const today = new Date().toISOString().split('T')[0];
      useProgressStore.getState().recordPracticeSession(5);
      useProgressStore.getState().recordPracticeSession(3);
      useProgressStore.getState().recordPracticeSession(2);

      const goal = useProgressStore.getState().dailyGoalData[today];
      expect(goal.minutesPracticed).toBe(10);
    });

    it('should mark goal complete when targets met', () => {
      const today = new Date().toISOString().split('T')[0];
      useProgressStore.getState().updateDailyGoal(today, {
        minutesTarget: 10,
        exercisesTarget: 2,
      });

      useProgressStore.getState().recordPracticeSession(10);
      useProgressStore.getState().recordExerciseCompletion('ex-1', 85, 50);
      useProgressStore.getState().recordExerciseCompletion('ex-2', 90, 60);

      const goal = useProgressStore.getState().dailyGoalData[today];
      expect(goal.isComplete).toBe(true);
    });
  });

  describe('Exercise Completion Recording', () => {
    it('should record exercise completion and award XP', () => {
      const initialXp = useProgressStore.getState().totalXp;
      useProgressStore.getState().recordExerciseCompletion('ex-1', 85, 50);

      expect(useProgressStore.getState().totalXp).toBe(initialXp + 50);
    });

    it('should increment exercises completed', () => {
      const today = new Date().toISOString().split('T')[0];
      useProgressStore.getState().recordExerciseCompletion('ex-1', 85, 50);

      const goal = useProgressStore.getState().dailyGoalData[today];
      expect(goal.exercisesCompleted).toBe(1);
    });

    it('should handle multiple exercise completions', () => {
      const initialXp = useProgressStore.getState().totalXp;
      useProgressStore.getState().recordExerciseCompletion('ex-1', 85, 50);
      useProgressStore.getState().recordExerciseCompletion('ex-2', 90, 60);
      useProgressStore.getState().recordExerciseCompletion('ex-3', 75, 40);

      expect(useProgressStore.getState().totalXp).toBe(initialXp + 150);

      const today = new Date().toISOString().split('T')[0];
      const goal = useProgressStore.getState().dailyGoalData[today];
      expect(goal.exercisesCompleted).toBe(3);
    });
  });

  describe('Level Auto-Calculation', () => {
    it('should recalculate level when XP is added', () => {
      // levelFromXp: level 1 needs 0 XP, level 2 needs 100, level 3 needs 250
      useProgressStore.getState().addXp(100);
      expect(useProgressStore.getState().level).toBe(2);
    });

    it('should recalculate level on exercise completion', () => {
      useProgressStore.getState().recordExerciseCompletion('ex-1', 90, 100);
      expect(useProgressStore.getState().totalXp).toBe(100);
      expect(useProgressStore.getState().level).toBe(2);
    });

    it('should not regress level when XP is below current level', () => {
      // Start at level 2 with 100 XP
      useProgressStore.getState().addXp(100);
      expect(useProgressStore.getState().level).toBe(2);

      // Adding 0 XP should keep level 2
      useProgressStore.getState().addXp(0);
      expect(useProgressStore.getState().level).toBe(2);
    });

    it('should level up through multiple levels at once', () => {
      // Adding enough XP to jump straight to level 4 (475 XP threshold)
      useProgressStore.getState().addXp(500);
      expect(useProgressStore.getState().level).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Practice Time Tracking', () => {
    it('should accumulate practice time across sessions', () => {
      const today = new Date().toISOString().split('T')[0];
      useProgressStore.getState().recordPracticeSession(2);
      useProgressStore.getState().recordPracticeSession(3);
      useProgressStore.getState().recordPracticeSession(5);

      const goal = useProgressStore.getState().dailyGoalData[today];
      expect(goal.minutesPracticed).toBe(10);
    });

    it('should track practice time independently from exercise completion', () => {
      const today = new Date().toISOString().split('T')[0];

      // Record a practice session (time)
      useProgressStore.getState().recordPracticeSession(5);
      // Record an exercise completion (count)
      useProgressStore.getState().recordExerciseCompletion('ex-1', 80, 10);

      const goal = useProgressStore.getState().dailyGoalData[today];
      expect(goal.minutesPracticed).toBe(5);
      expect(goal.exercisesCompleted).toBe(1);
    });
  });

  describe('Lesson Completion Flow', () => {
    it('should track exercise progress within a lesson', () => {
      const lessonProgress = {
        lessonId: 'lesson-01',
        status: 'in_progress' as const,
        exerciseScores: {},
        bestScore: 0,
        totalAttempts: 0,
        totalTimeSpentSeconds: 0,
      };

      useProgressStore.getState().updateLessonProgress('lesson-01', lessonProgress);

      const ex1Progress = {
        exerciseId: 'lesson-01-ex-01',
        highScore: 85,
        stars: 2 as 0 | 1 | 2 | 3,
        attempts: 1,
        lastAttemptAt: Date.now(),
        averageScore: 85,
        completedAt: Date.now(),
      };

      useProgressStore.getState().updateExerciseProgress('lesson-01', 'lesson-01-ex-01', ex1Progress);

      const retrieved = useProgressStore.getState().getExerciseProgress('lesson-01', 'lesson-01-ex-01');
      expect(retrieved?.highScore).toBe(85);
      expect(retrieved?.completedAt).toBeDefined();
    });

    it('should mark lesson completed when all exercises are done', () => {
      // Initialize lesson
      useProgressStore.getState().updateLessonProgress('lesson-01', {
        lessonId: 'lesson-01',
        status: 'in_progress',
        exerciseScores: {},
        bestScore: 0,
        totalAttempts: 0,
        totalTimeSpentSeconds: 0,
      });

      // Complete all 3 exercises
      const now = Date.now();
      for (const exId of ['lesson-01-ex-01', 'lesson-01-ex-02', 'lesson-01-ex-03']) {
        useProgressStore.getState().updateExerciseProgress('lesson-01', exId, {
          exerciseId: exId,
          highScore: 90,
          stars: 2,
          attempts: 1,
          lastAttemptAt: now,
          averageScore: 90,
          completedAt: now,
        });
      }

      // Now mark the lesson completed
      const lp = useProgressStore.getState().lessonProgress['lesson-01'];
      useProgressStore.getState().updateLessonProgress('lesson-01', {
        ...lp,
        status: 'completed',
        completedAt: now,
      });

      const final = useProgressStore.getState().getLessonProgress('lesson-01');
      expect(final?.status).toBe('completed');
      expect(final?.completedAt).toBeDefined();
    });
  });

  describe('Reset', () => {
    it('should reset all state', () => {
      useProgressStore.getState().addXp(100);
      useProgressStore.getState().setLevel(5);
      useProgressStore.getState().updateStreakData({ currentStreak: 10 });

      useProgressStore.getState().reset();

      const state = useProgressStore.getState();
      expect(state.totalXp).toBe(0);
      expect(state.level).toBe(1);
      expect(state.streakData.currentStreak).toBe(0);
      expect(state.lessonProgress).toEqual({});
      expect(state.dailyGoalData).toEqual({});
    });
  });
});
