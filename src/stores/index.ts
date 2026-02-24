/**
 * Store Exports and Initialization
 * Central export point for all state management
 */

// Store instances
export { useExerciseStore } from './exerciseStore';
export { useProgressStore } from './progressStore';
export { useSettingsStore } from './settingsStore';
export { useAchievementStore } from './achievementStore';
export { useLearnerProfileStore } from './learnerProfileStore';
export { useSongStore, hydrateSongStore } from './songStore';

// Store types
export type { ExerciseSessionState } from './types';
export type { ProgressStoreState, StreakData, DailyGoalData } from './types';
export type { NoteResult, ExerciseResult, Skills, LearnerProfileState } from './types';
export type {
  SettingsStoreState,
  AudioSettings,
  DisplaySettings,
  NotificationSettings,
  MidiSettings,
} from './types';

// Hooks
export {
  // Exercise hooks
  useExerciseSessionDuration,
  useExerciseNotesPlayed,
  useExerciseInProgress,
  useExerciseCompletionPercent,
  // Progress hooks
  useLevelProgress,
  useDailyGoalComplete,
  useTodaysPracticeDuration,
  useTodaysExercisesCompleted,
  useHasActiveStreak,
  useStreakFreezes,
  // Settings hooks
  useAudioSettings,
  useDisplaySettings,
  useNotificationSettings,
  useMidiDevice,
  useLearningPreferences,
  // Multi-store hooks
  useUserProfile,
} from './hooks';

// Achievement store types
export type { AchievementStoreState, UnlockedAchievement } from './achievementStore';
export { computeAchievementXpReward } from './achievementStore';

// Persistence utilities (for advanced usage)
export { PersistenceManager, STORAGE_KEYS, createDebouncedSave } from './persistence';
