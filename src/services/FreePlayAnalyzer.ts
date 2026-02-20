/**
 * FreePlayAnalyzer - Analyzes free play sessions to detect patterns,
 * keys, intervals, and provide actionable feedback.
 *
 * Also provides `suggestDrill` to convert an analysis into AI exercise
 * generation parameters targeting the notes played during free play.
 *
 * Pure TypeScript - no React imports.
 */

import type { GenerationParams } from './geminiExerciseService';

// ============================================================================
// Types
// ============================================================================

export interface PlayedNote {
  note: number;
  timestamp: number;
  velocity: number;
}

export interface FreePlayAnalysis {
  /** Total notes played */
  notesPlayed: number;
  /** Unique MIDI notes played (sorted ascending) */
  uniqueNotes: number[];
  /** Detected musical key (e.g., "C major", "A minor"), or null if indeterminate */
  detectedKey: string | null;
  /** Intervals between consecutive notes, sorted by count descending */
  commonIntervals: Array<{ interval: number; count: number }>;
  /** Suggested drill type based on playing patterns */
  suggestedDrillType: string;
  /** Human-readable summary of the session */
  summary: string;

  // Legacy fields kept for backward compatibility with PlayScreen
  /** @deprecated Use notesPlayed */
  noteCount: number;
  /** @deprecated Use uniqueNotes.length */
  uniquePitches: number;
  /** Duration of the session in seconds */
  durationSeconds: number;
  /** Average notes per second */
  notesPerSecond: number;
  /** Most frequently played note name */
  mostPlayedNote: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/**
 * Scale definitions: pitch classes (0-11) for each key.
 * Covers the most common beginner keys.
 */
const SCALE_DEFINITIONS: Array<{ name: string; pitchClasses: Set<number> }> = [
  { name: 'C major',  pitchClasses: new Set([0, 2, 4, 5, 7, 9, 11]) },
  { name: 'G major',  pitchClasses: new Set([7, 9, 11, 0, 2, 4, 6]) },
  { name: 'F major',  pitchClasses: new Set([5, 7, 9, 10, 0, 2, 4]) },
  { name: 'D minor',  pitchClasses: new Set([2, 4, 5, 7, 9, 10, 0]) },
  { name: 'A minor',  pitchClasses: new Set([9, 11, 0, 2, 4, 5, 7]) },
];

const INTERVAL_NAMES: Record<number, string> = {
  1: 'minor seconds',
  2: 'major seconds',
  3: 'minor thirds',
  4: 'major thirds',
  5: 'fourths',
  7: 'fifths',
  12: 'octaves',
};

// ============================================================================
// Key Detection
// ============================================================================

function detectKeySignature(notes: PlayedNote[]): string | null {
  if (notes.length < 3) return null;

  // Count occurrences of each pitch class (0-11)
  const pitchClassCounts = new Array<number>(12).fill(0);
  for (const n of notes) {
    pitchClassCounts[n.note % 12]++;
  }

  let bestScale: string | null = null;
  let bestScore = -1;

  for (const scale of SCALE_DEFINITIONS) {
    let score = 0;
    for (const pc of scale.pitchClasses) {
      score += pitchClassCounts[pc];
    }
    if (score > bestScore) {
      bestScore = score;
      bestScale = scale.name;
    }
  }

  // Only return if at least 60% of notes fit the detected key
  const fitRatio = bestScore / notes.length;
  if (fitRatio < 0.6) return null;

  return bestScale;
}

// ============================================================================
// Interval Analysis
// ============================================================================

function countIntervals(notes: PlayedNote[]): Array<{ interval: number; count: number }> {
  const intervalCounts = new Map<number, number>();

  for (let i = 1; i < notes.length; i++) {
    const interval = Math.abs(notes[i].note - notes[i - 1].note);
    if (interval > 0) {
      intervalCounts.set(interval, (intervalCounts.get(interval) ?? 0) + 1);
    }
  }

  return [...intervalCounts.entries()]
    .map(([interval, count]) => ({ interval, count }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// Drill Type Suggestion
// ============================================================================

function determineDrillType(
  uniqueNotes: number[],
  intervals: Array<{ interval: number; count: number }>,
): string {
  // If very few unique notes, suggest exploring more keys
  if (uniqueNotes.length <= 3) {
    return 'note-exploration';
  }

  const totalIntervals = intervals.reduce((sum, i) => sum + i.count, 0);
  if (totalIntervals === 0) return 'warmup';

  // If mostly stepwise motion (intervals 1-2), suggest scale practice
  const stepwiseCount = intervals
    .filter((i) => i.interval <= 2)
    .reduce((sum, i) => sum + i.count, 0);

  if (stepwiseCount / totalIntervals > 0.6) {
    return 'scale-practice';
  }

  // If lots of thirds/fifths, suggest chord practice
  const chordIntervals = intervals
    .filter((i) => i.interval === 3 || i.interval === 4 || i.interval === 7)
    .reduce((sum, i) => sum + i.count, 0);

  if (chordIntervals / totalIntervals > 0.4) {
    return 'chord-practice';
  }

  // Default: interval practice
  return 'interval-practice';
}

// ============================================================================
// Summary Builder
// ============================================================================

function buildSummary(
  noteCount: number,
  detectedKey: string | null,
  intervals: Array<{ interval: number; count: number }>,
): string {
  let summary = `You played ${noteCount} note${noteCount === 1 ? '' : 's'}`;

  if (detectedKey) {
    summary += `, mostly in ${detectedKey}`;
  }

  summary += '.';

  // Mention the most common interval
  if (intervals.length > 0) {
    const topInterval = intervals[0];
    const intervalName = INTERVAL_NAMES[topInterval.interval] ?? `intervals of ${topInterval.interval} semitones`;
    summary += ` You used lots of ${intervalName}.`;
  }

  return summary;
}

// ============================================================================
// Main Analysis
// ============================================================================

/**
 * Analyze a free play session and return insights about what was played.
 */
export function analyzeSession(notes: PlayedNote[]): FreePlayAnalysis {
  if (notes.length === 0) {
    return {
      notesPlayed: 0,
      uniqueNotes: [],
      detectedKey: null,
      commonIntervals: [],
      suggestedDrillType: 'warmup',
      summary: 'No notes were played in this session.',
      // Legacy fields
      noteCount: 0,
      uniquePitches: 0,
      durationSeconds: 0,
      notesPerSecond: 0,
      mostPlayedNote: null,
    };
  }

  // Unique MIDI notes (sorted ascending)
  const uniqueNotes = [...new Set(notes.map((n) => n.note))].sort((a, b) => a - b);

  // Detect key signature
  const detectedKey = detectKeySignature(notes);

  // Count intervals between consecutive notes
  const commonIntervals = countIntervals(notes);

  // Determine suggested drill type
  const suggestedDrillType = determineDrillType(uniqueNotes, commonIntervals);

  // Duration and rate
  const timestamps = notes.map((n) => n.timestamp);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const durationSeconds = Math.max((maxTime - minTime) / 1000, 0.1);
  const notesPerSecond = notes.length / durationSeconds;

  // Most played note
  const countByPitch = new Map<number, number>();
  for (const n of notes) {
    countByPitch.set(n.note, (countByPitch.get(n.note) ?? 0) + 1);
  }
  let maxCount = 0;
  let mostPlayedMidi = notes[0].note;
  for (const [midi, count] of countByPitch) {
    if (count > maxCount) {
      maxCount = count;
      mostPlayedMidi = midi;
    }
  }

  // Generate summary
  const summary = buildSummary(notes.length, detectedKey, commonIntervals);

  return {
    notesPlayed: notes.length,
    uniqueNotes,
    detectedKey,
    commonIntervals,
    suggestedDrillType,
    summary,
    // Legacy fields
    noteCount: notes.length,
    uniquePitches: uniqueNotes.length,
    durationSeconds: Math.round(durationSeconds * 10) / 10,
    notesPerSecond: Math.round(notesPerSecond * 10) / 10,
    mostPlayedNote: midiToNoteName(mostPlayedMidi),
  };
}

// ============================================================================
// Drill Generation
// ============================================================================

/**
 * Convert a FreePlayAnalysis into GenerationParams for AI exercise generation.
 */
export function suggestDrill(analysis: FreePlayAnalysis): GenerationParams {
  const weakNotes = analysis.uniqueNotes.slice(0, 6);

  const baseTempo = 60;

  let skillContext: string;
  switch (analysis.suggestedDrillType) {
    case 'note-exploration':
      skillContext = 'Explore more notes on the keyboard, expanding beyond the few played';
      break;
    case 'scale-practice':
      skillContext = `Practice scales${analysis.detectedKey ? ` in ${analysis.detectedKey}` : ''}`;
      break;
    case 'chord-practice':
      skillContext = 'Practice chord progressions and arpeggios';
      break;
    default:
      skillContext = 'Practice interval jumps for accuracy';
      break;
  }

  return {
    weakNotes,
    tempoRange: { min: baseTempo - 10, max: baseTempo + 20 },
    difficulty: 2,
    noteCount: 12,
    skills: {
      timingAccuracy: 0.5,
      pitchAccuracy: 0.5,
      sightReadSpeed: 0.5,
      chordRecognition: 0.5,
    },
    exerciseType: 'lesson',
    skillContext,
  };
}
