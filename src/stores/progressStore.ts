/**
 * User progress and gamification state management with MMKV persistence
 *
 * Manages:
 * - XP tracking and level progression
 * - Daily/weekly streaks with freeze mechanics
 * - Lesson and exercise completion history
 * - Daily goal tracking
 *
 * All state is automatically persisted to MMKV
 */

import { create } from 'zustand';
import type { LessonProgress, ExerciseProgress } from '@/core/exercises/types';
import type { ProgressStoreState, StreakData, DailyGoalData } from './types';
import { PersistenceManager, STORAGE_KEYS, createDebouncedSave } from './persistence';
import { levelFromXp } from '@/core/progression/XpSystem';

const defaultStreakData: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastPracticeDate: '', // Empty so first exercise triggers streak
  freezesAvailable: 1,
  freezesUsed: 0,
  weeklyPractice: [false, false, false, false, false, false, false],
};

const defaultDailyGoal: DailyGoalData = {
  date: new Date().toISOString().split('T')[0],
  minutesTarget: 10,
  minutesPracticed: 0,
  exercisesTarget: 3,
  exercisesCompleted: 0,
  isComplete: false,
};

/** Data-only shape of progress state (excludes actions) */
type ProgressData = Pick<
  ProgressStoreState,
  'totalXp' | 'level' | 'streakData' | 'lessonProgress' | 'dailyGoalData'
>;

const defaultData: ProgressData = {
  totalXp: 0,
  level: 1,
  streakData: defaultStreakData,
  lessonProgress: {},
  dailyGoalData: {},
};

// Create debounced save function
const debouncedSave = createDebouncedSave(STORAGE_KEYS.PROGRESS, 1000);

export const useProgressStore = create<ProgressStoreState>((set, get) => ({
  ...defaultData,

  addXp: (amount: number) => {
    set((state) => {
      const newTotalXp = state.totalXp + amount;
      return {
        totalXp: newTotalXp,
        level: levelFromXp(newTotalXp),
      };
    });
    debouncedSave(get());
  },

  setLevel: (level: number) => {
    set({ level });
    debouncedSave(get());
  },

  updateStreakData: (data: Partial<StreakData>) => {
    set((state) => ({
      streakData: { ...state.streakData, ...data },
    }));
    debouncedSave(get());
  },

  updateLessonProgress: (lessonId: string, progress: LessonProgress) => {
    set((state) => ({
      lessonProgress: {
        ...state.lessonProgress,
        [lessonId]: progress,
      },
    }));
    debouncedSave(get());
  },

  updateExerciseProgress: (lessonId: string, exerciseId: string, progress: ExerciseProgress) => {
    set((state) => {
      const lesson = state.lessonProgress[lessonId] ?? {
        lessonId,
        status: 'in_progress' as const,
        exerciseScores: {},
        bestScore: 0,
        totalAttempts: 0,
        totalTimeSpentSeconds: 0,
      };

      return {
        lessonProgress: {
          ...state.lessonProgress,
          [lessonId]: {
            ...lesson,
            exerciseScores: {
              ...lesson.exerciseScores,
              [exerciseId]: progress,
            },
          },
        },
      };
    });
    debouncedSave(get());
  },

  getLessonProgress: (lessonId: string) => {
    const state = get();
    return state.lessonProgress[lessonId] || null;
  },

  getExerciseProgress: (lessonId: string, exerciseId: string) => {
    const state = get();
    const lesson = state.lessonProgress[lessonId];
    if (!lesson) {
      return null;
    }
    return lesson.exerciseScores[exerciseId] || null;
  },

  recordPracticeSession: (duration: number) => {
    const today = new Date().toISOString().split('T')[0];
    set((state) => {
      const dailyGoal = state.dailyGoalData[today] || {
        ...defaultDailyGoal,
        date: today,
      };

      return {
        dailyGoalData: {
          ...state.dailyGoalData,
          [today]: {
            ...dailyGoal,
            minutesPracticed: dailyGoal.minutesPracticed + duration,
            isComplete:
              dailyGoal.minutesPracticed + duration >= dailyGoal.minutesTarget &&
              dailyGoal.exercisesCompleted >= dailyGoal.exercisesTarget,
          },
        },
      };
    });
    debouncedSave(get());
  },

  recordExerciseCompletion: (_exerciseId: string, _score: number, xpEarned: number) => {
    const today = new Date().toISOString().split('T')[0];
    set((state) => {
      const dailyGoal = state.dailyGoalData[today] || {
        ...defaultDailyGoal,
        date: today,
      };
      const newTotalXp = state.totalXp + xpEarned;

      return {
        totalXp: newTotalXp,
        level: levelFromXp(newTotalXp),
        dailyGoalData: {
          ...state.dailyGoalData,
          [today]: {
            ...dailyGoal,
            exercisesCompleted: dailyGoal.exercisesCompleted + 1,
            isComplete:
              dailyGoal.minutesPracticed >= dailyGoal.minutesTarget &&
              dailyGoal.exercisesCompleted + 1 >= dailyGoal.exercisesTarget,
          },
        },
      };
    });
    debouncedSave(get());
  },

  updateDailyGoal: (date: string, data: Partial<DailyGoalData>) => {
    set((state) => ({
      dailyGoalData: {
        ...state.dailyGoalData,
        [date]: {
          ...(state.dailyGoalData[date] || { ...defaultDailyGoal, date }),
          ...data,
        },
      },
    }));
    debouncedSave(get());
  },

  reset: () => {
    set({
      totalXp: 0,
      level: 1,
      streakData: defaultStreakData,
      lessonProgress: {},
      dailyGoalData: {},
    });
    PersistenceManager.deleteState(STORAGE_KEYS.PROGRESS);
  },
}));
