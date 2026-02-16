/**
 * Achievement Store
 * Tracks unlocked achievements with timestamps and provides checking logic.
 *
 * Persisted to AsyncStorage via PersistenceManager.
 * Uses the same debounced save pattern as settingsStore and progressStore.
 */

import { create } from 'zustand';
import type { AchievementContext } from '@/core/achievements/achievements';
import {
  checkAchievements,
  getAchievementById,
  ACHIEVEMENTS,
} from '@/core/achievements/achievements';
import { PersistenceManager, STORAGE_KEYS, createDebouncedSave } from './persistence';

/**
 * Record of achievement ID -> unlock timestamp (ISO string)
 */
export interface UnlockedAchievement {
  id: string;
  unlockedAt: string; // ISO date string
}

/** Data-only shape (excludes actions) */
interface AchievementData {
  unlockedIds: Record<string, string>; // id -> ISO timestamp
  totalNotesPlayed: number;
  perfectScoreCount: number;
  highScoreCount: number; // exercises scored 90%+
}

export interface AchievementStoreState extends AchievementData {
  // Queries
  isUnlocked: (achievementId: string) => boolean;
  getUnlockedAchievements: () => UnlockedAchievement[];
  getUnlockedCount: () => number;
  getTotalCount: () => number;

  // Mutations
  checkAndUnlock: (context: AchievementContext) => UnlockedAchievement[];
  incrementNotesPlayed: (count: number) => void;
  recordPerfectScore: () => void;
  recordHighScore: () => void;

  // Hydration
  hydrate: () => Promise<void>;

  // Reset
  reset: () => void;
}

const defaultData: AchievementData = {
  unlockedIds: {},
  totalNotesPlayed: 0,
  perfectScoreCount: 0,
  highScoreCount: 0,
};

// Create debounced save function
const debouncedSave = createDebouncedSave<AchievementData>(STORAGE_KEYS.ACHIEVEMENTS, 500);

export const useAchievementStore = create<AchievementStoreState>((set, get) => ({
  ...defaultData,

  isUnlocked: (achievementId: string): boolean => {
    return achievementId in get().unlockedIds;
  },

  getUnlockedAchievements: (): UnlockedAchievement[] => {
    const { unlockedIds } = get();
    return Object.entries(unlockedIds)
      .map(([id, unlockedAt]) => ({ id, unlockedAt }))
      .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt)); // newest first
  },

  getUnlockedCount: (): number => {
    return Object.keys(get().unlockedIds).length;
  },

  getTotalCount: (): number => {
    return ACHIEVEMENTS.length;
  },

  checkAndUnlock: (context: AchievementContext): UnlockedAchievement[] => {
    const state = get();
    const alreadyUnlocked = new Set(Object.keys(state.unlockedIds));

    // Merge store-tracked stats into context
    const enrichedContext: AchievementContext = {
      ...context,
      totalNotesPlayed: state.totalNotesPlayed,
      perfectScores: state.perfectScoreCount,
      highScoreExercises: state.highScoreCount,
    };

    const newlyUnlockedIds = checkAchievements(enrichedContext, alreadyUnlocked);

    if (newlyUnlockedIds.length === 0) {
      return [];
    }

    const now = new Date().toISOString();
    const newUnlocks: UnlockedAchievement[] = [];
    const updatedIds = { ...state.unlockedIds };

    for (const id of newlyUnlockedIds) {
      updatedIds[id] = now;
      newUnlocks.push({ id, unlockedAt: now });
    }

    set({ unlockedIds: updatedIds });
    debouncedSave({
      unlockedIds: updatedIds,
      totalNotesPlayed: state.totalNotesPlayed,
      perfectScoreCount: state.perfectScoreCount,
      highScoreCount: state.highScoreCount,
    });

    return newUnlocks;
  },

  incrementNotesPlayed: (count: number): void => {
    set((state) => {
      const updated = state.totalNotesPlayed + count;
      return { totalNotesPlayed: updated };
    });
    const s = get();
    debouncedSave({
      unlockedIds: s.unlockedIds,
      totalNotesPlayed: s.totalNotesPlayed,
      perfectScoreCount: s.perfectScoreCount,
      highScoreCount: s.highScoreCount,
    });
  },

  recordPerfectScore: (): void => {
    set((state) => ({
      perfectScoreCount: state.perfectScoreCount + 1,
    }));
    const s = get();
    debouncedSave({
      unlockedIds: s.unlockedIds,
      totalNotesPlayed: s.totalNotesPlayed,
      perfectScoreCount: s.perfectScoreCount,
      highScoreCount: s.highScoreCount,
    });
  },

  recordHighScore: (): void => {
    set((state) => ({
      highScoreCount: state.highScoreCount + 1,
    }));
    const s = get();
    debouncedSave({
      unlockedIds: s.unlockedIds,
      totalNotesPlayed: s.totalNotesPlayed,
      perfectScoreCount: s.perfectScoreCount,
      highScoreCount: s.highScoreCount,
    });
  },

  hydrate: async (): Promise<void> => {
    const loaded = await PersistenceManager.loadState<AchievementData>(
      STORAGE_KEYS.ACHIEVEMENTS,
      defaultData
    );
    set({
      unlockedIds: loaded.unlockedIds ?? {},
      totalNotesPlayed: loaded.totalNotesPlayed ?? 0,
      perfectScoreCount: loaded.perfectScoreCount ?? 0,
      highScoreCount: loaded.highScoreCount ?? 0,
    });
  },

  reset: (): void => {
    set(defaultData);
    PersistenceManager.deleteState(STORAGE_KEYS.ACHIEVEMENTS);
  },
}));

/**
 * Helper: compute total XP reward for newly unlocked achievements
 */
export function computeAchievementXpReward(unlockedIds: string[]): number {
  let total = 0;
  for (const id of unlockedIds) {
    const achievement = getAchievementById(id);
    if (achievement) {
      total += achievement.xpReward;
    }
  }
  return total;
}

/**
 * Build an AchievementContext from the current progress and achievement stores.
 * This is a non-hook utility (uses getState()) safe to call from callbacks.
 *
 * Requires progressStore and catCharacters to be imported at call site,
 * so we accept them as parameters to keep this file free of circular deps.
 */
export function buildAchievementContext(progress: {
  totalXp: number;
  level: number;
  streakData: { currentStreak: number };
  lessonProgress: Record<string, { status: string }>;
  dailyGoalData: Record<string, { exercisesCompleted: number }>;
}, catsUnlocked: number, extras?: {
  sessionExercises?: number;
  exercisesWithSameCat?: number;
}): AchievementContext {
  const achievementState = useAchievementStore.getState();

  // Count completed lessons
  const lessonsCompleted = Object.values(progress.lessonProgress).filter(
    (lp) => lp.status === 'completed'
  ).length;

  // Count total exercises completed across all days
  const totalExercisesCompleted = Object.values(progress.dailyGoalData).reduce(
    (sum, day) => sum + day.exercisesCompleted,
    0
  );

  // Time-of-day checks
  const hour = new Date().getHours();

  return {
    totalXp: progress.totalXp,
    level: progress.level,
    currentStreak: progress.streakData.currentStreak,
    lessonsCompleted,
    perfectScores: achievementState.perfectScoreCount,
    totalExercisesCompleted,
    totalNotesPlayed: achievementState.totalNotesPlayed,
    catsUnlocked,
    highScoreExercises: achievementState.highScoreCount,
    sessionExercises: extras?.sessionExercises ?? 0,
    exercisesWithSameCat: extras?.exercisesWithSameCat ?? 0,
    isEarlyPractice: hour < 8,
    isLatePractice: hour >= 22,
  };
}
