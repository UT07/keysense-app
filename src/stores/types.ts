/**
 * Centralized type definitions for store interfaces
 * All types are pure TypeScript (no React imports)
 */

import type { Exercise, ExerciseScore, MidiNoteEvent, LessonProgress, ExerciseProgress } from '@/core/exercises/types';
import type { ExerciseChallengeContext } from '@/core/challenges/challengeSystem';

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

  // Sticky score: survives clearSession() so callers can capture it after navigation
  lastCompletedScore: ExerciseScore | null;

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
  clearLastCompletedScore: () => void;
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

export interface TierTestResult {
  passed: boolean;
  score: number;
  attempts: number;
}

export interface ProgressStoreState {
  // User progression
  totalXp: number;
  level: number;
  streakData: StreakData;
  lessonProgress: Record<string, LessonProgress>;
  dailyGoalData: Record<string, DailyGoalData>; // ISO date -> goal data
  tierTestResults: Record<string, TierTestResult>; // "tier-N" -> result
  streakMilestonesClaimed: number[]; // Streak counts already rewarded (e.g. [7, 30])

  // Actions
  addXp: (amount: number) => void;
  setLevel: (level: number) => void;
  updateStreakData: (data: Partial<StreakData>) => void;
  updateLessonProgress: (lessonId: string, progress: LessonProgress) => void;
  updateExerciseProgress: (lessonId: string, exerciseId: string, progress: ExerciseProgress) => void;
  getLessonProgress: (lessonId: string) => LessonProgress | null;
  getExerciseProgress: (lessonId: string, exerciseId: string) => ExerciseProgress | null;
  recordPracticeSession: (duration: number) => void;
  recordExerciseCompletion: (exerciseId: string, score: number, xpEarned: number, challengeContext?: ExerciseChallengeContext) => void;
  recordTierTestResult: (tier: number, passed: boolean, score: number) => void;
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

export type PlaybackSpeed = 0.25 | 0.5 | 0.75 | 1.0;

export interface AudioSettings {
  masterVolume: number; // 0-1
  soundEnabled: boolean;
  hapticEnabled: boolean;
  metronomeVolume: number; // 0-1
  keyboardVolume: number; // 0-1
  audioBufferSize: number;
  playbackSpeed: PlaybackSpeed; // Exercise tempo multiplier
  uiSoundEnabled: boolean; // SoundManager game UI sounds (separate from piano audio)
  uiSoundVolume: number; // 0-1, SoundManager volume
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

export type PreferredInputMethod = 'auto' | 'midi' | 'mic' | 'touch';

export type MicDetectionMode = 'monophonic' | 'polyphonic';

export interface MidiSettings {
  lastMidiDeviceId: string | null;
  lastMidiDeviceName: string | null;
  autoConnectMidi: boolean;
  preferredInputMethod: PreferredInputMethod;
  micDetectionMode: MicDetectionMode;
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
  setUiSoundEnabled: (enabled: boolean) => void;
  setUiSoundVolume: (vol: number) => void;
  setShowFingerNumbers: (show: boolean) => void;
  setShowNoteNames: (show: boolean) => void;
  setPreferredHand: (hand: 'right' | 'left' | 'both') => void;
  setReminderTime: (time: string | null) => void;
  setDailyGoalMinutes: (minutes: number) => void;
  setLastMidiDevice: (deviceId: string | null, deviceName: string | null) => void;
  setPreferredInputMethod: (method: PreferredInputMethod) => void;
  setMicDetectionMode: (mode: MicDetectionMode) => void;
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

export interface SkillMasteryRecord {
  masteredAt: number;        // epoch ms when first mastered
  lastPracticedAt: number;   // epoch ms when last exercised
  completionCount: number;   // successful completions toward mastery
  decayScore: number;        // 1.0 = fresh, 0.0 = fully decayed
}

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
  skillMasteryData: Record<string, SkillMasteryRecord>;  // per-skill mastery tracking
  recentExerciseIds: string[];  // last 10 exercise IDs (prevent same-day repeats)

  // Actions
  updateNoteAccuracy: (midiNote: number, accuracy: number) => void;
  updateSkill: (skill: keyof Skills, value: number) => void;
  recalculateWeakAreas: () => void;
  recordExerciseResult: (result: ExerciseResult) => void;
  markSkillMastered: (skillId: string) => void;
  recordSkillPractice: (skillId: string, passed: boolean) => void;
  calculateDecayedSkills: () => string[];
  addRecentExercise: (exerciseId: string) => void;
  reset: () => void;
}

/**
 * ============================================================================
 * EVOLUTION & GEM TYPES
 * ============================================================================
 */

export type EvolutionStage = 'baby' | 'teen' | 'adult' | 'master';

export const EVOLUTION_XP_THRESHOLDS: Record<EvolutionStage, number> = {
  baby: 0,
  teen: 500,
  adult: 2000,
  master: 5000,
};

/** Discriminated union for ability effects */
export type AbilityEffect =
  | { type: 'timing_window_multiplier'; multiplier: number }
  | { type: 'tempo_reduction'; bpmReduction: number }
  | { type: 'xp_multiplier'; multiplier: number }
  | { type: 'combo_shield'; missesForgivenPerExercise: number }
  | { type: 'score_boost'; percentageBoost: number }
  | { type: 'hint_frequency_boost'; multiplier: number }
  | { type: 'streak_saver'; freeSavesPerWeek: number }
  | { type: 'gem_magnet'; bonusGemChance: number }
  | { type: 'extra_retries'; extraRetries: number }
  | { type: 'ghost_notes_extended'; extraFailsBeforeTrigger: number }
  | { type: 'daily_xp_boost'; multiplier: number }
  | { type: 'note_preview'; previewBeats: number }
  | { type: 'perfect_shield'; shieldsPerExercise: number }
  | { type: 'lucky_gems'; bonusGemMultiplier: number }
  | { type: 'all_abilities_half'; description: string };

export interface CatAbility {
  id: string;
  name: string;
  description: string;
  icon: string; // MaterialCommunityIcons name
  effect: AbilityEffect;
  unlockedAtStage: EvolutionStage;
}

export interface CatStageVisuals {
  accessories: string[];   // SVG accessory identifiers to render
  hasGlow: boolean;
  hasParticles: boolean;
  hasCrown: boolean;
  auraIntensity: number;   // 0-1
}

export interface CatEvolutionData {
  catId: string;
  currentStage: EvolutionStage;
  xpAccumulated: number;
  abilitiesUnlocked: string[];
  evolvedAt: Record<EvolutionStage, number | null>; // epoch ms or null
}

export interface GemTransaction {
  amount: number;
  source: string;
  timestamp: number;
  balance: number;
}

export interface DailyRewardDay {
  day: number; // 1-7
  reward: {
    type: 'gems' | 'xp_boost' | 'streak_freeze' | 'chest';
    amount: number;
  };
  claimed: boolean;
}

/**
 * ============================================================================
 * SOCIAL & LEAGUE TYPES
 * ============================================================================
 */

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export type FriendStatus = 'pending_outgoing' | 'pending_incoming' | 'accepted';

export interface FriendConnection {
  uid: string;
  displayName: string;
  selectedCatId: string;
  status: FriendStatus;
  connectedAt: number; // epoch ms
}

export interface ActivityFeedItem {
  id: string;
  friendUid: string;
  friendDisplayName: string;
  friendCatId: string;
  type: 'streak_milestone' | 'level_up' | 'evolution' | 'song_mastered' | 'league_promoted';
  detail: string;
  timestamp: number;
}

export interface LeagueMembership {
  leagueId: string;
  tier: LeagueTier;
  weekStart: string; // ISO date
  weeklyXp: number;
  rank: number;
  totalMembers: number;
}

export interface FriendChallenge {
  id: string;
  fromUid: string;
  fromDisplayName: string;
  fromCatId: string;
  toUid: string;
  exerciseId: string;
  exerciseTitle: string;
  fromScore: number;
  toScore: number | null;
  status: 'pending' | 'completed' | 'expired';
  createdAt: number;
  expiresAt: number;
}

export interface ShareCardData {
  type: 'score' | 'streak' | 'evolution' | 'league';
  title: string;
  subtitle: string;
  value: string;
  catId: string;
  evolutionStage: number;
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
