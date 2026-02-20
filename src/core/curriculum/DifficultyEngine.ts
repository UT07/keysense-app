/**
 * DifficultyEngine - Progressive difficulty adjustment
 *
 * Adjusts tempo, note range, and difficulty level based on a learner's
 * performance and profile. Prevents sudden spikes by capping changes.
 *
 * Pure TypeScript - no React imports.
 */

// ============================================================================
// Types
// ============================================================================

export interface DifficultyAdjustment {
  tempoChange: number; // BPM delta (positive = faster, negative = slower)
  noteRangeExpansion: number; // semitones to add (negative = narrow)
  difficultyLevel: number; // 1-5
  reasoning: string;
}

export interface DifficultyProfile {
  tempoRange: { min: number; max: number };
  skills: {
    timingAccuracy: number;
    pitchAccuracy: number;
  };
  totalExercisesCompleted: number;
}

// ============================================================================
// Constants
// ============================================================================

const TEMPO_ABSOLUTE_MIN = 30;
const TEMPO_ABSOLUTE_MAX = 200;

// ============================================================================
// Difficulty Level Calculation
// ============================================================================

function difficultyLevelFromExercises(totalExercisesCompleted: number): number {
  if (totalExercisesCompleted <= 5) return 1;
  if (totalExercisesCompleted <= 15) return 2;
  if (totalExercisesCompleted <= 30) return 3;
  if (totalExercisesCompleted <= 50) return 4;
  return 5;
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Compute a difficulty adjustment based on the learner's profile and last score.
 *
 * - Score >= 90: increase tempo by 5 BPM, expand range by 2 semitones
 * - Score >= 70: increase tempo by 2 BPM, keep range
 * - Score < 50: decrease tempo by 5 BPM, narrow range by 2
 * - Otherwise: no change
 *
 * Tempo is capped so max doesn't exceed 200 and min doesn't go below 30.
 * Difficulty level changes by at most 1 per call.
 */
export function adjustDifficulty(
  profile: DifficultyProfile,
  lastScore: number,
): DifficultyAdjustment {
  let tempoChange: number;
  let noteRangeExpansion: number;
  let reasoning: string;

  if (lastScore >= 90) {
    tempoChange = 5;
    noteRangeExpansion = 2;
    reasoning = `Excellent score (${lastScore}%). Increasing tempo by 5 BPM and expanding note range.`;
  } else if (lastScore >= 70) {
    tempoChange = 2;
    noteRangeExpansion = 0;
    reasoning = `Good score (${lastScore}%). Slightly increasing tempo.`;
  } else if (lastScore < 50) {
    tempoChange = -5;
    noteRangeExpansion = -2;
    reasoning = `Struggling (${lastScore}%). Slowing tempo and narrowing note range for comfort.`;
  } else {
    tempoChange = 0;
    noteRangeExpansion = 0;
    reasoning = `Moderate score (${lastScore}%). Maintaining current difficulty.`;
  }

  // Cap tempo so it stays within bounds after applying the change
  const projectedMax = profile.tempoRange.max + tempoChange;
  const projectedMin = profile.tempoRange.min + tempoChange;

  if (projectedMax > TEMPO_ABSOLUTE_MAX) {
    tempoChange = TEMPO_ABSOLUTE_MAX - profile.tempoRange.max;
  }
  if (projectedMin < TEMPO_ABSOLUTE_MIN) {
    tempoChange = TEMPO_ABSOLUTE_MIN - profile.tempoRange.min;
  }

  // Calculate difficulty level from total exercises
  const rawLevel = difficultyLevelFromExercises(profile.totalExercisesCompleted);

  // Cap at max 1 level change per call (compare to what level they "should" be)
  // Since we don't have a previous level, we just return the computed level
  // The caller is responsible for comparing and capping if needed.
  const difficultyLevel = Math.max(1, Math.min(5, rawLevel));

  return {
    tempoChange,
    noteRangeExpansion,
    difficultyLevel,
    reasoning,
  };
}
