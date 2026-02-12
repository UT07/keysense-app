/**
 * AI Coaching service using Gemini
 */

import type { ExerciseScore } from '@/core/exercises/types';

export interface CoachFeedback {
  feedback: string;
  suggestedAction: 'retry' | 'continue' | 'practice_specific';
  practiceExerciseId?: string;
}

export interface CoachingInput {
  exerciseTitle: string;
  score: ExerciseScore;
  userLevel: number;
  attemptNumber: number;
  recentScores: number[];
}

export class CoachingService {
  apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
  }

  async generateFeedback(input: CoachingInput): Promise<CoachFeedback> {
    try {
      // TODO: Implement Gemini API call
      // For now, return placeholder feedback
      return {
        feedback: `Great job on ${input.exerciseTitle}! Keep practicing to improve your score.`,
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
