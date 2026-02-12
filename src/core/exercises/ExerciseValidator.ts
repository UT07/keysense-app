/**
 * Exercise validation and scoring engine
 * Pure TypeScript - no React imports
 * Core business logic for scoring exercises
 */

import type {
  Exercise,
  MidiNoteEvent,
  NoteEvent,
  ExerciseScore,
  NoteScore,
  ExerciseScoreBreakdown,
} from './types';

const SCORE_WEIGHTS = {
  accuracy: 0.4, // Did you play the right notes?
  timing: 0.35, // Did you play them at the right time?
  completeness: 0.15, // Did you play all the notes?
  extraNotes: 0.1, // Penalty for extra notes (inverted)
};

/**
 * Calculate timing score based on offset from expected timing
 */
export function calculateTimingScore(
  offsetMs: number,
  tolerance: number,
  gracePeriod: number
): number {
  const absOffset = Math.abs(offsetMs);

  if (absOffset <= tolerance) {
    return 100; // Perfect
  }

  if (absOffset <= gracePeriod) {
    // Linear interpolation between perfect and good
    return 100 - ((absOffset - tolerance) / (gracePeriod - tolerance)) * 30;
  }

  if (absOffset <= gracePeriod * 2) {
    // Exponential decay for "okay" timing
    return 70 * Math.exp(-(absOffset - gracePeriod) / gracePeriod);
  }

  return 0; // Missed
}

/**
 * Match played notes to expected notes within a time window
 */
function matchNotes(
  expectedNotes: NoteEvent[],
  playedNotes: MidiNoteEvent[],
  tempoMs: number // milliseconds per beat
): Map<number, MidiNoteEvent> {
  const matched = new Map<number, MidiNoteEvent>();
  const usedPlayedIndices = new Set<number>();

  // For each expected note, find the best matching played note
  for (let i = 0; i < expectedNotes.length; i++) {
    const expected = expectedNotes[i];
    const expectedTimeMs = expected.startBeat * tempoMs;

    let bestMatch: { index: number; distance: number } | null = null;
    const maxTimeDistance = 200; // ms

    for (let j = 0; j < playedNotes.length; j++) {
      if (usedPlayedIndices.has(j)) continue;

      const played = playedNotes[j];
      if (played.note === expected.note) {
        const timeDistance = Math.abs(played.timestamp - expectedTimeMs);
        if (timeDistance < maxTimeDistance) {
          if (!bestMatch || timeDistance < bestMatch.distance) {
            bestMatch = { index: j, distance: timeDistance };
          }
        }
      }
    }

    if (bestMatch) {
      matched.set(i, playedNotes[bestMatch.index]);
      usedPlayedIndices.add(bestMatch.index);
    }
  }

  return matched;
}

/**
 * Score individual notes
 */
function scoreNotes(
  exercise: Exercise,
  expectedNotes: NoteEvent[],
  playedNotes: MidiNoteEvent[],
  tempoMs: number
): NoteScore[] {
  const matched = matchNotes(expectedNotes, playedNotes, tempoMs);
  const noteScores: NoteScore[] = [];
  const usedPlayedIndices = new Set<number>();

  // Score each expected note
  for (let i = 0; i < expectedNotes.length; i++) {
    const expected = expectedNotes[i];
    const played = matched.get(i);

    if (played) {
      usedPlayedIndices.add(playedNotes.indexOf(played));
      const expectedTimeMs = expected.startBeat * tempoMs;
      const timingOffsetMs = played.timestamp - expectedTimeMs;

      const timingScore = calculateTimingScore(
        timingOffsetMs,
        exercise.scoring.timingToleranceMs,
        exercise.scoring.timingGracePeriodMs
      );

      // Velocity score (100 = perfect velocity)
      const velocityScore = Math.max(0, 100 - Math.abs(played.velocity - 64) / 0.64);

      noteScores.push({
        expected,
        played,
        timingOffsetMs,
        timingScore,
        velocityScore,
        isCorrectPitch: true,
        isExtraNote: false,
        isMissedNote: false,
      });
    } else {
      // Missed note
      noteScores.push({
        expected,
        played: null,
        timingOffsetMs: 0,
        timingScore: 0,
        velocityScore: 0,
        isCorrectPitch: false,
        isExtraNote: false,
        isMissedNote: true,
      });
    }
  }

  // Mark extra notes
  for (let i = 0; i < playedNotes.length; i++) {
    if (!usedPlayedIndices.has(i)) {
      noteScores.push({
        expected: { note: 0, startBeat: 0, durationBeats: 0 },
        played: playedNotes[i],
        timingOffsetMs: 0,
        timingScore: 0,
        velocityScore: 0,
        isCorrectPitch: false,
        isExtraNote: true,
        isMissedNote: false,
      });
    }
  }

  return noteScores;
}

/**
 * Calculate score breakdown percentages
 */
function calculateBreakdown(
  noteScores: NoteScore[],
  totalExpected: number
): ExerciseScoreBreakdown {
  if (noteScores.length === 0) {
    return {
      accuracy: 0,
      timing: 0,
      completeness: 0,
      extraNotes: 0,
    };
  }

  // Accuracy: correct pitch notes / total expected
  const correctNotes = noteScores.filter((n) => n.isCorrectPitch && !n.isExtraNote).length;
  const accuracy = (correctNotes / totalExpected) * 100;

  // Timing: average timing score of correctly pitched notes
  const correctNoteScores = noteScores.filter((n) => n.isCorrectPitch && !n.isExtraNote);
  const timing =
    correctNoteScores.length > 0
      ? correctNoteScores.reduce((sum, n) => sum + n.timingScore, 0) / correctNoteScores.length
      : 0;

  // Completeness: notes played / total expected
  const playedCount = noteScores.filter((n) => !n.isMissedNote && !n.isExtraNote).length;
  const completeness = (playedCount / totalExpected) * 100;

  // Extra notes penalty: 0-100 based on number of extra notes
  const extraCount = noteScores.filter((n) => n.isExtraNote).length;
  const extraNotes = Math.max(0, 100 - extraCount * 10);

  return {
    accuracy,
    timing,
    completeness,
    extraNotes,
  };
}

/**
 * Main scoring function
 */
export function scoreExercise(
  exercise: Exercise,
  playedNotes: MidiNoteEvent[],
  previousHighScore: number = 0
): ExerciseScore {
  // Convert tempo to milliseconds per beat
  // Assuming quarter note = 1 beat
  const msPerBeat = (60 * 1000) / exercise.settings.tempo;

  // Score all notes
  const noteScores = scoreNotes(exercise, exercise.notes, playedNotes, msPerBeat);

  // Calculate breakdown
  const breakdown = calculateBreakdown(noteScores, exercise.notes.length);

  // Weighted overall score
  const overall =
    breakdown.accuracy * SCORE_WEIGHTS.accuracy +
    breakdown.timing * SCORE_WEIGHTS.timing +
    breakdown.completeness * SCORE_WEIGHTS.completeness +
    breakdown.extraNotes * SCORE_WEIGHTS.extraNotes;

  // Determine stars
  const starThresholds = exercise.scoring.starThresholds;
  let stars: 0 | 1 | 2 | 3 = 0;
  if (overall >= starThresholds[0]) stars = 1;
  if (overall >= starThresholds[1]) stars = 2;
  if (overall >= starThresholds[2]) stars = 3;

  // Calculate XP earned
  const baseXp = 10;
  const accuracyBonus = (breakdown.accuracy / 100) * 10;
  const timingBonus = (breakdown.timing / 100) * 10;
  const firstTimeBonus = previousHighScore === 0 ? 25 : 0;
  const perfectBonus = stars === 3 ? 50 : 0;

  const xpEarned = Math.floor(baseXp + accuracyBonus + timingBonus + firstTimeBonus + perfectBonus);

  const isPassed = overall >= exercise.scoring.passingScore;
  const isNewHighScore = overall > previousHighScore;

  return {
    overall: Math.round(overall * 100) / 100,
    stars,
    breakdown,
    details: noteScores,
    xpEarned,
    isPassed,
    isNewHighScore,
  };
}

/**
 * Validate that an exercise definition is valid
 */
export function validateExercise(exercise: Exercise): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!exercise.id) errors.push('Exercise must have an id');
  if (!exercise.metadata.title) errors.push('Exercise must have a title');
  if (exercise.notes.length === 0) errors.push('Exercise must have at least one note');
  if (exercise.settings.tempo <= 0) errors.push('Tempo must be positive');
  if (exercise.scoring.passingScore < 0 || exercise.scoring.passingScore > 100) {
    errors.push('Passing score must be between 0 and 100');
  }

  // Validate MIDI note range
  for (let i = 0; i < exercise.notes.length; i++) {
    const note = exercise.notes[i];
    if (note.note < 21 || note.note > 108) {
      errors.push(`Note ${i}: MIDI note ${note.note} is outside piano range (21-108)`);
    }
    if (note.startBeat < 0) {
      errors.push(`Note ${i}: startBeat cannot be negative`);
    }
    if (note.durationBeats <= 0) {
      errors.push(`Note ${i}: durationBeats must be positive`);
    }
  }

  // Validate star thresholds
  const [one, two, three] = exercise.scoring.starThresholds;
  if (!(one < two && two < three)) {
    errors.push('Star thresholds must be in ascending order');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get note sequence from expected notes
 */
export function getExpectedNoteSequence(exercise: Exercise): number[] {
  return exercise.notes.map((n) => n.note);
}

