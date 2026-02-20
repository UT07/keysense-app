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

  // Demo mode & ghost notes (transient, not persisted)
  failCount: number;
  ghostNotesEnabled: boolean;
  ghostNotesSuccessCount: number;
  demoWatched: boolean;

  // Session actions
  setCurrentExercise: (exercise: Exercise) => void;
  addPlayedNote: (note: MidiNoteEvent) => void;
  clearSession: () => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentBeat: (beat: number) => void;
  setScore: (score: ExerciseScore) => void;
  setSessionTime: (startTime: number, endTime?: number) => void;
  incrementFailCount: () => void;
  resetFailCount: () => void;
  setGhostNotesEnabled: (enabled: boolean) => void;
  incrementGhostNotesSuccessCount: () => void;
  setDemoWatched: (watched: boolean) => void;
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

export type PlaybackSpeed = 0.5 | 0.75 | 1.0;

export interface AudioSettings {
  masterVolume: number; // 0-1
  soundEnabled: boolean;
  hapticEnabled: boolean;
  metronomeVolume: number; // 0-1
  keyboardVolume: number; // 0-1
  audioBufferSize: number;
  playbackSpeed: PlaybackSpeed; // Exercise tempo multiplier
}

export interface DisplaySettings {
  showFingerNumbers: boolean;
  showNoteNames: boolean;
  preferredHand: 'right' | 'left' | 'both';
  darkMode: boolean;
  showPianoRoll: boolean;
  showStaffNotation: boolean;
  showTutorials: boolean;
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

export interface ProfileSettings {
  displayName: string;
  avatarEmoji: string; // Emoji used as avatar
  selectedCatId: string; // Cat character avatar ID
}

export interface SettingsStoreState extends AudioSettings, DisplaySettings, NotificationSettings, MidiSettings, OnboardingSettings, ProfileSettings {
  // Actions
  updateAudioSettings: (settings: Partial<AudioSettings>) => void;
  updateDisplaySettings: (settings: Partial<DisplaySettings>) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  updateMidiSettings: (settings: Partial<MidiSettings>) => void;
  setMasterVolume: (volume: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setShowFingerNumbers: (show: boolean) => void;
  setShowNoteNames: (show: boolean) => void;
  setPreferredHand: (hand: 'right' | 'left' | 'both') => void;
  setReminderTime: (time: string | null) => void;
  setDailyGoalMinutes: (minutes: number) => void;
  setLastMidiDevice: (deviceId: string | null, deviceName: string | null) => void;
  setDarkMode: (enabled: boolean) => void;
  setShowTutorials: (show: boolean) => void;
  setHasCompletedOnboarding: (completed: boolean) => void;
  setExperienceLevel: (level: 'beginner' | 'intermediate' | 'returning') => void;
  setLearningGoal: (goal: 'songs' | 'technique' | 'exploration') => void;
  setDisplayName: (name: string) => void;
  setAvatarEmoji: (emoji: string) => void;
  setSelectedCatId: (id: string) => void;
  reset: () => void;
}

/**
 * ============================================================================
 * LEARNER PROFILE STORE TYPES
 * ============================================================================
 */

export interface NoteResult {
  midiNote: number;
  accuracy: number; // 0.0-1.0
}

export interface ExerciseResult {
  tempo: number;
  score: number; // 0.0-1.0
  noteResults: NoteResult[];
}

export interface Skills {
  timingAccuracy: number;    // 0.0-1.0
  pitchAccuracy: number;     // 0.0-1.0
  sightReadSpeed: number;    // notes per minute (normalized 0-1)
  chordRecognition: number;  // 0.0-1.0
}

export interface LearnerProfileState {
  noteAccuracy: Record<number, number>;  // MIDI note -> rolling avg 0.0-1.0
  noteAttempts: Record<number, number>;  // MIDI note -> attempt count
  skills: Skills;
  tempoRange: { min: number; max: number }; // comfortable BPM range
  weakNotes: number[];      // MIDI notes below 70% accuracy
  weakSkills: string[];     // Skills below 60%
  totalExercisesCompleted: number;
  lastAssessmentDate: string;
  assessmentScore: number;
  masteredSkills: string[];  // SkillTree node IDs the learner has mastered

  // Actions
  updateNoteAccuracy: (midiNote: number, accuracy: number) => void;
  updateSkill: (skill: keyof Skills, value: number) => void;
  recalculateWeakAreas: () => void;
  recordExerciseResult: (result: ExerciseResult) => void;
  markSkillMastered: (skillId: string) => void;
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
