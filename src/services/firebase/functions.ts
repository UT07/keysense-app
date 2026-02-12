/**
 * Firebase Cloud Functions Client
 * Calls Cloud Functions for AI coaching and heavy operations
 */

import { httpsCallable, HttpsCallableOptions } from 'firebase/functions';
import { functions } from './config';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CoachFeedbackRequest {
  exerciseId: string;
  exerciseTitle: string;
  difficulty: number;
  score: {
    overall: number;
    accuracy: number;
    timing: number;
    completeness: number;
  };
  issues: {
    pitchErrors: Array<{
      expected: string;
      played: string;
      beatPosition: number;
    }>;
    timingErrors: Array<{
      note: string;
      offsetMs: number;
      beatPosition: number;
    }>;
    missedCount: number;
    extraCount: number;
  };
  context: {
    attemptNumber: number;
    previousScore: number | null;
    userLevel: number;
    sessionMinutes: number;
  };
}

export interface CoachFeedbackResponse {
  feedback: string;
  suggestedNextAction: 'retry' | 'continue' | 'practice_specific';
  practiceExerciseId?: string;
  cached: boolean;
}

export interface SyncProgressRequest {
  lastSyncTimestamp: number;
  localChanges: Array<{
    id: string;
    type: 'exercise_completed' | 'xp_earned' | 'level_up' | 'streak_updated';
    exerciseId?: string;
    score?: number;
    xpAmount?: number;
    timestamp: any;
    synced: boolean;
  }>;
}

export interface SyncProgressResponse {
  serverChanges: any[];
  newSyncTimestamp: number;
  conflicts: Array<{
    field: string;
    localValue: any;
    serverValue: any;
    resolution: 'local' | 'server' | 'merged';
    resolvedValue: any;
  }>;
  synced: boolean;
}

// ============================================================================
// Cloud Functions Setup
// ============================================================================

const FUNCTION_OPTIONS: HttpsCallableOptions = {
  timeout: 30000, // 30 seconds
};

// ============================================================================
// Coach Feedback Function
// ============================================================================

/**
 * Get AI-generated coaching feedback for an exercise
 */
export async function getCoachFeedback(
  request: CoachFeedbackRequest
): Promise<CoachFeedbackResponse> {
  try {
    const generateCoachFeedback = httpsCallable<
      CoachFeedbackRequest,
      CoachFeedbackResponse
    >(functions, 'generateCoachFeedback', FUNCTION_OPTIONS);

    const result = await generateCoachFeedback(request);
    return result.data;
  } catch (error) {
    console.error('Error calling generateCoachFeedback:', error);
    // Return fallback feedback
    return getFallbackCoachFeedback(request);
  }
}

/**
 * Fallback feedback when API is unavailable
 */
function getFallbackCoachFeedback(request: CoachFeedbackRequest): CoachFeedbackResponse {
  const { score, issues } = request;

  let feedback = '';

  if (score.overall >= 90) {
    feedback = `Excellent work! You're really getting the hang of this. Ready for the next challenge?`;
  } else if (score.overall >= 80) {
    feedback = `Great effort! A little more practice and you'll have it mastered. Keep going!`;
  } else if (score.overall >= 70) {
    feedback = `Good progress! Focus on one measure at a time. You're learning the right notes!`;
  } else if (issues.timingErrors.length > issues.pitchErrors.length) {
    feedback = `Try counting along with the beat—timing takes practice. You're learning the right notes!`;
  } else {
    feedback = `Take it slow and focus on one measure at a time. You've got this!`;
  }

  return {
    feedback,
    suggestedNextAction: score.overall >= 80 ? 'continue' : 'retry',
    cached: false,
  };
}

// ============================================================================
// Progress Sync Function
// ============================================================================

/**
 * Sync progress with server, handling conflicts
 */
export async function syncProgress(
  request: SyncProgressRequest
): Promise<SyncProgressResponse> {
  try {
    const syncProgressFunction = httpsCallable<SyncProgressRequest, SyncProgressResponse>(
      functions,
      'syncProgress',
      FUNCTION_OPTIONS
    );

    const result = await syncProgressFunction(request);
    return result.data;
  } catch (error) {
    console.error('Error calling syncProgress:', error);
    // Return empty response - data will sync next time
    return {
      serverChanges: [],
      newSyncTimestamp: Date.now(),
      conflicts: [],
      synced: false,
    };
  }
}

// ============================================================================
// Additional Cloud Functions
// ============================================================================

/**
 * Generate exercise recommendations based on user performance
 */
export async function getExerciseRecommendations(
  uid: string
): Promise<Array<{ exerciseId: string; reason: string }>> {
  try {
    const getRecommendations = httpsCallable<
      { uid: string },
      Array<{ exerciseId: string; reason: string }>
    >(functions, 'getExerciseRecommendations', FUNCTION_OPTIONS);

    const result = await getRecommendations({ uid });
    return result.data;
  } catch (error) {
    console.error('Error getting recommendations:', error);
    return [];
  }
}

/**
 * Process weekly summary and generate insights
 */
export async function getWeeklySummary(uid: string): Promise<{
  exercisesCompleted: number;
  minutesPracticed: number;
  xpEarned: number;
  improvements: string[];
  nextWeekGoals: string[];
}> {
  try {
    const getWeeklySummary = httpsCallable<
      { uid: string },
      {
        exercisesCompleted: number;
        minutesPracticed: number;
        xpEarned: number;
        improvements: string[];
        nextWeekGoals: string[];
      }
    >(functions, 'getWeeklySummary', FUNCTION_OPTIONS);

    const result = await getWeeklySummary({ uid });
    return result.data;
  } catch (error) {
    console.error('Error getting weekly summary:', error);
    return {
      exercisesCompleted: 0,
      minutesPracticed: 0,
      xpEarned: 0,
      improvements: [],
      nextWeekGoals: [],
    };
  }
}

/**
 * Handle exercise completion with XP and achievements
 */
export async function completeExercise(uid: string, exerciseData: {
  exerciseId: string;
  score: number;
  timeSpentSeconds: number;
  isPerfect: boolean;
}): Promise<{
  xpEarned: number;
  newLevel?: number;
  achievementsUnlocked: string[];
}> {
  try {
    const completeExerciseFunction = httpsCallable<
      {
        uid: string;
        exerciseData: typeof exerciseData;
      },
      {
        xpEarned: number;
        newLevel?: number;
        achievementsUnlocked: string[];
      }
    >(functions, 'completeExercise', FUNCTION_OPTIONS);

    const result = await completeExerciseFunction({ uid, exerciseData });
    return result.data;
  } catch (error) {
    console.error('Error completing exercise:', error);
    return {
      xpEarned: 0,
      achievementsUnlocked: [],
    };
  }
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

export interface FunctionError {
  code: string;
  message: string;
  details?: any;
}

export function isFunctionError(error: any): error is FunctionError {
  return error.code && error.message;
}

export function handleFunctionError(error: any): FunctionError {
  if (isFunctionError(error)) {
    return error;
  }

  if (error.code) {
    return {
      code: error.code,
      message: error.message || 'An unknown error occurred',
      details: error.details,
    };
  }

  return {
    code: 'UNKNOWN',
    message: String(error),
  };
}

// ============================================================================
// Rate Limiting (Client-side)
// ============================================================================

const functionCallCounts = new Map<string, number[]>();
const RATE_LIMIT_CONFIG = {
  generateCoachFeedback: { maxPerHour: 20, maxPerDay: 100 },
  syncProgress: { maxPerHour: 30, maxPerDay: 200 },
};

export function checkRateLimit(
  functionName: string
): { allowed: boolean; reason?: string } {
  const config = RATE_LIMIT_CONFIG[functionName as keyof typeof RATE_LIMIT_CONFIG];
  if (!config) {
    return { allowed: true }; // No limit for unknown functions
  }

  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const oneDayAgo = now - 86400000;

  let counts = functionCallCounts.get(functionName) || [];
  counts = counts.filter((timestamp) => timestamp > oneDayAgo);

  const hourCounts = counts.filter((timestamp) => timestamp > oneHourAgo).length;
  const dayCounts = counts.length;

  if (hourCounts >= config.maxPerHour) {
    return {
      allowed: false,
      reason: `Hourly limit exceeded (${config.maxPerHour} per hour)`,
    };
  }

  if (dayCounts >= config.maxPerDay) {
    return {
      allowed: false,
      reason: `Daily limit exceeded (${config.maxPerDay} per day)`,
    };
  }

  counts.push(now);
  functionCallCounts.set(functionName, counts);

  return { allowed: true };
}

/**
 * Wrap a function call with rate limiting
 */
export async function withRateLimit<T>(
  functionName: string,
  fn: () => Promise<T>
): Promise<T> {
  const check = checkRateLimit(functionName);
  if (!check.allowed) {
    throw new Error(`Rate limit exceeded: ${check.reason}`);
  }
  return fn();
}
