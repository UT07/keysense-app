/**
 * Core exercise type definitions
 * These are platform-agnostic and contain no React imports
 */

export interface NoteEvent {
  note: number; // MIDI note number (0-127)
  startBeat: number; // Beat position (float for subdivisions)
  durationBeats: number; // Note length in beats
  hand?: 'left' | 'right';
  finger?: 1 | 2 | 3 | 4 | 5;
  optional?: boolean; // Extra credit, not required for passing
}

export interface ExerciseScoringConfig {
  timingToleranceMs: number; // ±ms for "perfect"
  timingGracePeriodMs: number; // ±ms for "good"
  passingScore: number; // 0-100
  starThresholds: [number, number, number]; // 1-star, 2-star, 3-star thresholds
}

export interface ExerciseMetadata {
  title: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes: number;
  skills: string[]; // e.g., ["right-hand", "c-major", "quarter-notes"]
  prerequisites: string[]; // Exercise IDs
}

export interface ExerciseSettings {
  tempo: number; // BPM
  timeSignature: [number, number]; // e.g., [4, 4]
  keySignature: string; // e.g., "C", "G", "F"
  countIn: number; // Beats before start
  metronomeEnabled: boolean;
  loopEnabled?: boolean; // Allow looping for practice
}

export interface CommonMistake {
  pattern: string;
  advice: string;
  triggerCondition?: {
    type: 'timing' | 'pitch' | 'sequence';
    threshold: number;
  };
}

export interface ExerciseHints {
  beforeStart: string;
  commonMistakes: CommonMistake[];
  successMessage: string;
}

export interface DisplaySettings {
  showFingerNumbers: boolean;
  showNoteNames: boolean;
  highlightHands?: boolean;
  showPianoRoll?: boolean;
  showStaffNotation?: boolean;
}

export interface Exercise {
  id: string;
  version: number;
  metadata: ExerciseMetadata;
  settings: ExerciseSettings;
  notes: NoteEvent[];
  scoring: ExerciseScoringConfig;
  hints: ExerciseHints;
  display?: DisplaySettings;
}

// Scored note details
export interface NoteScore {
  expected: NoteEvent;
  played: MidiNoteEvent | null;
  timingOffsetMs: number; // Negative = early, positive = late
  timingScore: number; // 0-100
  durationScore?: number; // 0-100 — how close to expected note duration
  velocityScore?: number; // 0-100 (optional, for dynamics exercises)
  isCorrectPitch: boolean;
  isExtraNote: boolean; // Played but not expected
  isMissedNote: boolean; // Expected but not played
  status?: 'perfect' | 'good' | 'ok' | 'early' | 'late' | 'missed' | 'wrong';
}

export interface ExerciseScoreBreakdown {
  accuracy: number; // % correct notes
  timing: number; // Average timing score
  completeness: number; // % of notes attempted
  extraNotes: number; // Penalty for wrong notes (0-100)
  duration: number; // Average duration accuracy (0-100)
}

// Alias for backwards compatibility
export type ScoreBreakdown = ExerciseScoreBreakdown;

// Config type for scoring functions
export interface ScoringConfig extends ExerciseScoringConfig {}

export interface ExerciseScore {
  overall: number; // 0-100
  stars: 0 | 1 | 2 | 3;
  breakdown: ExerciseScoreBreakdown;
  details: NoteScore[];
  perfectNotes?: number;
  goodNotes?: number;
  okNotes?: number;
  missedNotes?: number;
  extraNotes?: number;
  xpEarned: number;
  isNewHighScore: boolean;
  isPassed: boolean;
}

// MIDI note input
export interface MidiNoteEvent {
  type: 'noteOn' | 'noteOff';
  note: number; // MIDI note number (0-127)
  velocity: number; // 0-127
  timestamp: number; // High-resolution timestamp
  channel: number; // MIDI channel (usually 0)
  durationMs?: number; // Time held (noteOff - noteOn), only for noteOn events used in scoring
}

// Progress tracking
export interface ExerciseProgress {
  exerciseId: string;
  highScore: number;
  stars: 0 | 1 | 2 | 3;
  attempts: number;
  lastAttemptAt: number; // timestamp
  averageScore: number;
  completedAt?: number; // timestamp
}

export interface LessonProgress {
  lessonId: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  exerciseScores: Record<string, ExerciseProgress>;
  bestScore: number;
  completedAt?: number;
  totalAttempts: number;
  totalTimeSpentSeconds: number;
}

// Timing calculation result
export interface TimingResult {
  score: number; // 0-100
  status: 'perfect' | 'good' | 'ok' | 'early' | 'late' | 'missed';
}
