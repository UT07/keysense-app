/**
 * WeakSpotDetector - Analyzes learner profiles to identify weak patterns
 *
 * Detects weak individual notes, transitions, timing issues, and hand-specific
 * problems. Generates drill parameters for AI exercise generation targeting
 * the identified weaknesses.
 *
 * Pure TypeScript - no React imports.
 */

import type { GenerationParams } from '../../services/geminiExerciseService';

// ============================================================================
// Types
// ============================================================================

export type WeakPatternType = 'note' | 'transition' | 'timing' | 'hand';

export interface WeakPattern {
  type: WeakPatternType;
  description: string;
  severity: number; // 0-1
  targetMidi: number[];
}

/** Subset of LearnerProfileState used for analysis (avoids store dependency) */
export interface WeakSpotProfile {
  noteAccuracy: Record<number, number>;
  weakNotes: number[];
  skills: {
    timingAccuracy: number;
    pitchAccuracy: number;
  };
  tempoRange: { min: number; max: number };
}

// ============================================================================
// Constants
// ============================================================================

const WEAK_NOTE_THRESHOLD = 0.7;
const WEAK_TIMING_THRESHOLD = 0.6;
const LEFT_HAND_UPPER_BOUND = 60; // MIDI notes below 60 are left-hand range
const MAX_PATTERNS = 5;
const HAND_ACCURACY_DIFFERENCE_THRESHOLD = 0.15;

// ============================================================================
// Detection
// ============================================================================

/**
 * Analyze a learner profile and detect weak patterns sorted by severity.
 * Returns at most 5 patterns, worst first.
 */
export function detectWeakPatterns(profile: WeakSpotProfile): WeakPattern[] {
  const patterns: WeakPattern[] = [];

  // 1. Detect weak individual notes (accuracy < 0.7)
  const weakNoteEntries = Object.entries(profile.noteAccuracy)
    .filter(([, acc]) => acc < WEAK_NOTE_THRESHOLD)
    .map(([note, acc]) => ({ midi: Number(note), accuracy: acc }))
    .sort((a, b) => a.accuracy - b.accuracy);

  for (const entry of weakNoteEntries) {
    patterns.push({
      type: 'note',
      description: `Weak note: MIDI ${entry.midi} (${Math.round(entry.accuracy * 100)}% accuracy)`,
      severity: 1 - entry.accuracy,
      targetMidi: [entry.midi],
    });
  }

  // 2. Detect weak transitions (adjacent weak notes)
  const sortedWeakNotes = weakNoteEntries
    .map((e) => e.midi)
    .sort((a, b) => a - b);

  for (let i = 0; i < sortedWeakNotes.length - 1; i++) {
    const noteA = sortedWeakNotes[i];
    const noteB = sortedWeakNotes[i + 1];
    const interval = noteB - noteA;

    // Adjacent notes (within a fifth / 7 semitones) with both weak
    if (interval <= 7) {
      const accA = profile.noteAccuracy[noteA] ?? 0;
      const accB = profile.noteAccuracy[noteB] ?? 0;
      const avgAcc = (accA + accB) / 2;

      patterns.push({
        type: 'transition',
        description: `Weak transition: MIDI ${noteA} to ${noteB} (avg ${Math.round(avgAcc * 100)}% accuracy)`,
        severity: 1 - avgAcc,
        targetMidi: [noteA, noteB],
      });
    }
  }

  // 3. Detect timing issues
  if (profile.skills.timingAccuracy < WEAK_TIMING_THRESHOLD) {
    patterns.push({
      type: 'timing',
      description: `Timing accuracy is low (${Math.round(profile.skills.timingAccuracy * 100)}%)`,
      severity: 1 - profile.skills.timingAccuracy,
      targetMidi: profile.weakNotes.slice(0, 4),
    });
  }

  // 4. Detect hand-specific issues
  const leftHandNotes: number[] = [];
  const rightHandNotes: number[] = [];
  let leftHandTotal = 0;
  let rightHandTotal = 0;

  for (const [noteStr, acc] of Object.entries(profile.noteAccuracy)) {
    const midi = Number(noteStr);
    if (midi < LEFT_HAND_UPPER_BOUND) {
      leftHandNotes.push(midi);
      leftHandTotal += acc;
    } else {
      rightHandNotes.push(midi);
      rightHandTotal += acc;
    }
  }

  const leftAvg = leftHandNotes.length > 0 ? leftHandTotal / leftHandNotes.length : 1;
  const rightAvg = rightHandNotes.length > 0 ? rightHandTotal / rightHandNotes.length : 1;

  if (
    leftHandNotes.length > 0 &&
    rightHandNotes.length > 0 &&
    Math.abs(leftAvg - rightAvg) > HAND_ACCURACY_DIFFERENCE_THRESHOLD
  ) {
    const weakHand = leftAvg < rightAvg ? 'left' : 'right';
    const weakAvg = Math.min(leftAvg, rightAvg);
    const weakMidi = weakHand === 'left' ? leftHandNotes : rightHandNotes;

    patterns.push({
      type: 'hand',
      description: `${weakHand} hand is weaker (${Math.round(weakAvg * 100)}% vs ${Math.round(Math.max(leftAvg, rightAvg) * 100)}%)`,
      severity: 1 - weakAvg,
      targetMidi: weakMidi.sort((a, b) => {
        const accA = profile.noteAccuracy[a] ?? 0;
        const accB = profile.noteAccuracy[b] ?? 0;
        return accA - accB;
      }).slice(0, 4),
    });
  }

  // Sort by severity (worst first) and return at most 5
  patterns.sort((a, b) => b.severity - a.severity);
  return patterns.slice(0, MAX_PATTERNS);
}

// ============================================================================
// Drill Generation
// ============================================================================

/**
 * Convert a WeakPattern into GenerationParams for AI exercise generation.
 */
export function generateDrillParams(pattern: WeakPattern): GenerationParams {
  const baseParams: GenerationParams = {
    weakNotes: pattern.targetMidi,
    tempoRange: { min: 50, max: 80 },
    difficulty: 1,
    noteCount: 8,
    skills: {
      timingAccuracy: 0.5,
      pitchAccuracy: 0.5,
      sightReadSpeed: 0.5,
      chordRecognition: 0.5,
    },
    exerciseType: 'warmup',
  };

  switch (pattern.type) {
    case 'note':
      return {
        ...baseParams,
        difficulty: 1,
        noteCount: 8,
        skillContext: `Drill: practice weak note(s) MIDI ${pattern.targetMidi.join(', ')}`,
      };

    case 'transition':
      return {
        ...baseParams,
        difficulty: 2,
        noteCount: 12,
        skillContext: `Drill: practice transition between MIDI ${pattern.targetMidi.join(' and ')}`,
      };

    case 'timing':
      return {
        ...baseParams,
        difficulty: 1,
        noteCount: 6,
        tempoRange: { min: 40, max: 60 },
        skillContext: 'Drill: slow tempo timing practice',
      };

    case 'hand':
      // Determine hand from MIDI range
      const isLeftHand = pattern.targetMidi.length > 0 && pattern.targetMidi[0] < LEFT_HAND_UPPER_BOUND;
      return {
        ...baseParams,
        difficulty: 1,
        noteCount: 8,
        skillContext: `Drill: ${isLeftHand ? 'left' : 'right'} hand strengthening`,
      };
  }
}
