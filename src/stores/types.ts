/**
 * Centralized type definitions for store interfaces
 * All types are pure TypeScript (no React imports)
 */

import type { Exercise, ExerciseScore, MidiNoteEvent, LessonProgress, ExerciseProgress } from '@/core/exercises/types';

/**
 * ============================================================================
 * EXERCISE STORE TYPES
 * ============================================================================
 */

export interface ExerciseSessionState {
  // Current exercise
  currentExercise: Exercise | null;
  currentExerciseId: string | null;

  // Session progress
  playedNotes: MidiNoteEvent[];
  isPlaying: boolean;
  currentBeat: number;
  score: ExerciseScore | null;
  sessionStartTime: number | null;
  sessionEndTime: number | null;

  // Session actions
  setCurrentExercise: (exercise: Exercise) => void;
  addPlayedNote: (note: MidiNoteEvent) => void;
  clearSession: () => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentBeat: (beat: number) => void;
  setScore: (score: ExerciseScore) => void;
  setSessionTime: (startTime: number, endTime?: number) => void;
  reset: () => void;
}

/**
 * ============================================================================
 * PROGRESS STORE TYPES
 * ============================================================================
 */

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string; // ISO date
  freezesAvailable: number;
  freezesUsed: number;
  weeklyPractice: boolean[]; // Last 7 days
}

export interface ProgressStoreState {
  // User progression
  totalXp: number;
  level: number;
  streakData: StreakData;
  lessonProgress: Record<string, LessonProgress>;
  dailyGoalData: Record<string, DailyGoalData>; // ISO date -> goal data

  // Actions
  addXp: (amount: number) => void;
  setLevel: (level: number) => void;
  updateStreakData: (data: Partial<StreakData>) => void;
  updateLessonProgress: (lessonId: string, progress: LessonProgress) => void;
  updateExerciseProgress: (lessonId: string, exerciseId: string, progress: ExerciseProgress) => void;
  getLessonProgress: (lessonId: string) => LessonProgress | null;
  getExerciseProgress: (lessonId: string, exerciseId: string) => ExerciseProgress | null;
  recordPracticeSession: (duration: number) => void;
  recordExerciseCompletion: (exerciseId: string, score: number, xpEarned: number) => void;
  updateDailyGoal: (date: string, data: Partial<DailyGoalData>) => void;
  reset: () => void;
}

export interface DailyGoalData {
  date: string;
  minutesTarget: number;
  minutesPracticed: number;
  exercisesTarget: number;
  exercisesCompleted: number;
  isComplete: boolean;
}

/**
 * ============================================================================
 * SETTINGS STORE TYPES
 * ============================================================================
 */

export interface AudioSettings {
  masterVolume: number; // 0-1
  soundEnabled: boolean;
  hapticEnabled: boolean;
  metronomeVolume: number; // 0-1
  keyboardVolume: number; // 0-1
  audioBufferSize: number;
}

export interface DisplaySettings {
  showFingerNumbers: boolean;
  showNoteNames: boolean;
  preferredHand: 'right' | 'left' | 'both';
  darkMode: boolean;
  showPianoRoll: boolean;
  showStaffNotation: boolean;
}

export interface NotificationSettings {
  reminderTime: string | null; // "09:00" format
  reminderEnabled: boolean;
  dailyGoalMinutes: number;
  completionNotifications: boolean;
}

export interface MidiSettings {
  lastMidiDeviceId: string | null;
  lastMidiDeviceName: string | null;
  autoConnectMidi: boolean;
}

export interface OnboardingSettings {
  hasCompletedOnboarding: boolean;
  experienceLevel: 'beginner' | 'intermediate' | 'returning' | null;
  learningGoal: 'songs' | 'technique' | 'exploration' | null;
}

export interface SettingsStoreState extends AudioSettings, DisplaySettings, NotificationSettings, MidiSettings, OnboardingSettings {
  // Actions
  updateAudioSettings: (settings: Partial<AudioSettings>) => void;
  updateDisplaySettings: (settings: Partial<DisplaySettings>) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  updateMidiSettings: (settings: Partial<MidiSettings>) => void;
  setMasterVolume: (volume: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setShowFingerNumbers: (show: boolean) => void;
  setShowNoteNames: (show: boolean) => void;
  setPreferredHand: (hand: 'right' | 'left' | 'both') => void;
  setReminderTime: (time: string | null) => void;
  setDailyGoalMinutes: (minutes: number) => void;
  setLastMidiDevice: (deviceId: string | null, deviceName: string | null) => void;
  setDarkMode: (enabled: boolean) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  setExperienceLevel: (level: 'beginner' | 'intermediate' | 'returning') => void;
  setLearningGoal: (goal: 'songs' | 'technique' | 'exploration') => void;
  reset: () => void;
}

/**
 * ============================================================================
 * DERIVED STATE UTILITIES
 * ============================================================================
 */

export interface LevelProgressInfo {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  percentToNextLevel: number;
}
