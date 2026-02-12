/**
 * Scoring Engine
 * Calculate timing scores, accuracy, and final exercise scores
 * Pure functions - no side effects
 */

import {
  NoteScore,
  ExerciseScore,
  TimingResult,
  ExerciseScoringConfig,
} from './types';

/**
 * Timing Score Calculation
 * Score curve based on offset from expected timing
 *
 * Score curve:
 *   100 |████████
 *       |        ████
 *    70 |            ████████
 *       |                    ████
 *    40 |                        ████████
 *       |                                ████
 *     0 |____________________________________████████
 *       0   25   75       150           300        ms
 *       ↑    ↑    ↑         ↑             ↑
 *    perfect good ok       ok           missed
 */
export function calculateTimingScore(
  offsetMs: number,
  toleranceMs: number = 25,
  gracePeriodMs: number = 75
): TimingResult {
  const absOffset = Math.abs(offsetMs);

  // Perfect timing: within tolerance
  if (absOffset <= toleranceMs) {
    return {
      score: 100,
      status: 'perfect',
    };
  }

  // Good timing: linear interpolation from perfect to ok
  if (absOffset < toleranceMs + gracePeriodMs) {
    const scoreDecay = ((absOffset - toleranceMs) / gracePeriodMs) * 30;
    return {
      score: Math.max(0, 100 - scoreDecay),
      status: 'good',
    };
  }

  // OK timing: exponential decay
  const okRange = gracePeriodMs * 2;
  if (absOffset <= toleranceMs + okRange) {
    const distanceFromGrace = absOffset - (toleranceMs + gracePeriodMs);
    // Start just under 70 to ensure clean boundary separation
    const score = 69.9 * Math.exp(-(distanceFromGrace / gracePeriodMs));
    return {
      score: Math.max(0, score),
      status: 'ok',
    };
  }

  // Missed: too far off
  return {
    score: 0,
    status: offsetMs < 0 ? 'early' : 'late',
  };
}

/**
 * Calculate timing score with dynamic difficulty adjustment
 * Harder exercises have stricter timing requirements
 */
export function calculateTimingScoreWithDifficulty(
  offsetMs: number,
  difficulty: 1 | 2 | 3 | 4 | 5
): TimingResult {
  // Difficulty-based tolerances
  const tolerances: Record<number, [number, number]> = {
    1: [75, 200],    // Beginner: 75ms perfect, 200ms grace
    2: [50, 150],    // Easy: 50ms perfect, 150ms grace
    3: [40, 125],    // Medium: 40ms perfect, 125ms grace
    4: [30, 100],    // Hard: 30ms perfect, 100ms grace
    5: [20, 75],     // Expert: 20ms perfect, 75ms grace
  };

  const [tolerance, grace] = tolerances[difficulty] || tolerances[3];
  return calculateTimingScore(offsetMs, tolerance, grace);
}

/**
 * Calculate accuracy score
 * Percentage of correct notes out of expected notes
 */
export function calculateAccuracy(
  correctNotes: number,
  totalExpectedNotes: number
): number {
  if (totalExpectedNotes === 0) {
    return 100;
  }
  return Math.round((correctNotes / totalExpectedNotes) * 100);
}

/**
 * Calculate completeness score
 * Percentage of expected notes attempted (played at any time)
 */
export function calculateCompleteness(
  attemptedNotes: number,
  totalExpectedNotes: number
): number {
  if (totalExpectedNotes === 0) {
    return 100;
  }
  return Math.round((attemptedNotes / totalExpectedNotes) * 100);
}

/**
 * Calculate precision score
 * Penalty for extra notes played that weren't expected
 * Returns 0-100, where 100 means no extra notes
 */
export function calculatePrecision(
  extraNotes: number,
  totalExpectedNotes: number
): number {
  if (totalExpectedNotes === 0) {
    return 100;
  }

  // Each extra note reduces precision by 10 points (or extraNotes/total * 100, whichever is less)
  const penaltyPerNote = 10;
  const maxPenalty = 50; // Don't penalize below 50%
  const totalPenalty = Math.min(extraNotes * penaltyPerNote, maxPenalty);

  return Math.max(50, 100 - totalPenalty);
}

/**
 * Calculate average timing score from note scores
 */
export function calculateAverageTimingScore(noteScores: NoteScore[]): number {
  if (noteScores.length === 0) {
    return 0;
  }

  const total = noteScores.reduce((sum, ns) => sum + ns.timingScore, 0);
  return Math.round(total / noteScores.length);
}

/**
 * Calculate final exercise score from component scores
 * Weighting: accuracy 40%, timing 35%, completeness 15%, precision 10%
 */
export function calculateFinalScore(
  accuracy: number,
  timing: number,
  completeness: number,
  precision: number
): number {
  const weights = {
    accuracy: 0.4,
    timing: 0.35,
    completeness: 0.15,
    precision: 0.1,
  };

  const score =
    accuracy * weights.accuracy +
    timing * weights.timing +
    completeness * weights.completeness +
    precision * weights.precision;

  return Math.round(score);
}

/**
 * Determine star rating based on score and thresholds
 */
export function calculateStars(
  score: number,
  thresholds: [number, number, number] = [70, 85, 95]
): 0 | 1 | 2 | 3 {
  if (score >= thresholds[2]) return 3;
  if (score >= thresholds[1]) return 2;
  if (score >= thresholds[0]) return 1;
  return 0;
}

/**
 * Check if score passes
 */
export function isPassed(score: number, passingScore: number): boolean {
  return score >= passingScore;
}

/**
 * Calculate XP earned from exercise
 * Sources:
 * - Base: 10 XP per completed exercise
 * - Stars: 10 XP per star (0-30)
 * - Perfect: 20 bonus XP for explicit perfect (isPerfect flag)
 * - High score: 10 bonus XP for 95%+ score (when not perfect)
 * - First time: 25 bonus XP
 */
export function calculateXpEarned(
  score: number,
  stars: 0 | 1 | 2 | 3,
  isFirstCompletion: boolean = true,
  isPerfect: boolean = false
): number {
  let xp = 10; // Base

  // Stars bonus
  xp += stars * 10;

  // Perfect bonus (explicit perfect flag)
  if (isPerfect) {
    xp += 20;
  } else if (score >= 95) {
    // High score bonus (when not explicitly perfect)
    xp += 10;
  }

  // First completion bonus
  if (isFirstCompletion) {
    xp += 25;
  }

  return xp;
}

/**
 * Create note score summary from array of note scores
 */
export interface NoteSummary {
  perfectNotes: number;
  goodNotes: number;
  okNotes: number;
  missedNotes: number;
  extraNotes: number;
  wrongNotes: number;
}

export function summarizeNoteScores(noteScores: NoteScore[]): NoteSummary {
  return noteScores.reduce(
    (acc, ns) => {
      if (ns.isExtraNote) {
        acc.extraNotes++;
      } else if (ns.isMissedNote) {
        acc.missedNotes++;
      } else if (!ns.isCorrectPitch) {
        acc.wrongNotes++;
      } else {
        // Note was played with correct pitch
        if (ns.status === 'perfect') {
          acc.perfectNotes++;
        } else if (ns.status === 'good') {
          acc.goodNotes++;
        } else if (ns.status === 'ok') {
          acc.okNotes++;
        }
      }
      return acc;
    },
    {
      perfectNotes: 0,
      goodNotes: 0,
      okNotes: 0,
      missedNotes: 0,
      extraNotes: 0,
      wrongNotes: 0,
    }
  );
}

/**
 * Build complete exercise score from note scores and configuration
 */
export function buildExerciseScore(
  noteScores: NoteScore[],
  config: ExerciseScoringConfig,
  previousHighScore: number = 0
): ExerciseScore {
  const summary = summarizeNoteScores(noteScores);

  // Calculate component scores
  const correctNotes = summary.perfectNotes + summary.goodNotes + summary.okNotes;
  const totalExpectedNotes = noteScores.length - summary.extraNotes;

  const accuracy = calculateAccuracy(correctNotes, totalExpectedNotes);
  const timingAvg = calculateAverageTimingScore(noteScores);
  const completeness = calculateCompleteness(
    correctNotes + summary.missedNotes,
    totalExpectedNotes
  );
  const precision = calculatePrecision(summary.extraNotes, totalExpectedNotes);

  // Calculate final score
  const overall = calculateFinalScore(accuracy, timingAvg, completeness, precision);
  const stars = calculateStars(overall, config.starThresholds);
  const passed = isPassed(overall, config.passingScore);

  // Calculate XP
  const xpEarned = calculateXpEarned(overall, stars, true, overall >= 95);

  return {
    overall,
    stars,
    breakdown: {
      accuracy,
      timing: timingAvg,
      completeness,
      extraNotes: precision,
    },
    details: noteScores,
    perfectNotes: summary.perfectNotes,
    goodNotes: summary.goodNotes,
    okNotes: summary.okNotes,
    missedNotes: summary.missedNotes,
    extraNotes: summary.extraNotes,
    xpEarned,
    isNewHighScore: overall > previousHighScore,
    isPassed: passed,
  };
}
