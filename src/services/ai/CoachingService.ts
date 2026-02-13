/**
 * AI Coaching service
 * Delegates to GeminiCoach for actual AI feedback with caching and fallbacks.
 */

import type { ExerciseScore } from '@/core/exercises/types';
import { GeminiCoach, type CoachRequest } from './GeminiCoach';

export interface CoachFeedback {
  feedback: string;
  suggestedAction: 'retry' | 'continue' | 'practice_specific';
  practiceExerciseId?: string;
}

export interface CoachingInput {
  exerciseId: string;
  exerciseTitle: string;
  difficulty: number;
  score: ExerciseScore;
  userLevel: number;
  attemptNumber: number;
  recentScores: number[];
}

/**
 * Convert a CoachingInput to the CoachRequest format used by GeminiCoach
 */
function toCoachRequest(input: CoachingInput): CoachRequest {
  // Extract timing and pitch errors from score details
  const pitchErrors = (input.score.details ?? [])
    .filter((d) => !d.isCorrectPitch && !d.isExtraNote && !d.isMissedNote)
    .slice(0, 3)
    .map((d) => ({
      expected: `MIDI ${d.expected.note}`,
      played: d.played ? `MIDI ${d.played.note}` : 'none',
      beatPosition: d.expected.startBeat,
    }));

  const timingErrors = (input.score.details ?? [])
    .filter((d) => d.isCorrectPitch && Math.abs(d.timingOffsetMs) > 50)
    .sort((a, b) => Math.abs(b.timingOffsetMs) - Math.abs(a.timingOffsetMs))
    .slice(0, 3)
    .map((d) => ({
      note: `MIDI ${d.expected.note}`,
      offsetMs: d.timingOffsetMs,
      beatPosition: d.expected.startBeat,
    }));

  return {
    exerciseId: input.exerciseId,
    exerciseTitle: input.exerciseTitle,
    difficulty: input.difficulty,
    score: {
      overall: input.score.overall,
      accuracy: input.score.breakdown.accuracy,
      timing: input.score.breakdown.timing,
      completeness: input.score.breakdown.completeness,
    },
    issues: {
      pitchErrors,
      timingErrors,
      missedCount: input.score.missedNotes ?? 0,
      extraCount: input.score.extraNotes ?? 0,
    },
    context: {
      attemptNumber: input.attemptNumber,
      previousScore:
        input.recentScores.length > 0
          ? input.recentScores[input.recentScores.length - 1]
          : null,
      userLevel: input.userLevel,
      sessionMinutes: 0,
    },
  };
}

export class CoachingService {
  async generateFeedback(input: CoachingInput): Promise<CoachFeedback> {
    try {
      const request = toCoachRequest(input);
      const feedbackText = await GeminiCoach.getFeedback(request);

      return {
        feedback: feedbackText,
        suggestedAction: input.score.isPassed ? 'continue' : 'retry',
      };
    } catch (error) {
      console.error('Failed to generate coaching feedback:', error);
      return {
        feedback: 'Keep practicing! You are making progress.',
        suggestedAction: 'retry',
      };
    }
  }
}

export const coachingService = new CoachingService();
