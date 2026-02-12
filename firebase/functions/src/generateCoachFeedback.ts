/**
 * Cloud Function: Generate Coach Feedback
 * Called from client when user completes an exercise
 * Returns AI-generated coaching feedback using Gemini 1.5 Flash
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// Type Definitions
// ============================================================================

interface CoachFeedbackRequest {
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

interface CoachFeedbackResponse {
  feedback: string;
  suggestedNextAction: 'retry' | 'continue' | 'practice_specific';
  practiceExerciseId?: string;
  cached: boolean;
}

// ============================================================================
// System Prompt
// ============================================================================

const COACH_SYSTEM_PROMPT = `You are a friendly, encouraging piano teacher helping beginners learn keyboard.

PERSONALITY:
- Warm and patient, like a supportive friend
- Celebrates small wins enthusiastically
- Focuses on progress over perfection
- Uses simple, non-technical language

RULES:
1. Keep responses to 2-3 SHORT sentences max
2. Focus on exactly ONE improvement area
3. Give a SPECIFIC, actionable tip
4. Always end with encouragement
5. Reference specific notes/beats when helpful
6. Never contradict the scoring data provided
7. Never mention "AI" or that you're a computer
8. Adapt enthusiasm to match the score (don't be overly excited for poor scores)`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build prompt from request data
 */
function buildPrompt(request: CoachFeedbackRequest): string {
  const { score, issues, context } = request;

  let prompt = `The student just played "${request.exerciseTitle}" (difficulty ${request.difficulty}/5).\n\n`;

  // Score summary
  prompt += `SCORE: ${score.overall}% overall\n`;
  prompt += `- Accuracy: ${score.accuracy}% (right notes)\n`;
  prompt += `- Timing: ${score.timing}% (on beat)\n`;
  prompt += `- Completeness: ${score.completeness}% (notes played)\n\n`;

  // Specific issues
  if (issues.pitchErrors.length > 0) {
    prompt += `PITCH ISSUES:\n`;
    for (const error of issues.pitchErrors.slice(0, 2)) {
      prompt += `- Played ${error.played} instead of ${error.expected} on beat ${error.beatPosition}\n`;
    }
    prompt += '\n';
  }

  if (issues.timingErrors.length > 0) {
    prompt += `TIMING ISSUES:\n`;
    for (const error of issues.timingErrors.slice(0, 2)) {
      const direction = error.offsetMs < 0 ? 'early' : 'late';
      const ms = Math.abs(error.offsetMs);
      prompt += `- ${error.note} was ${ms}ms ${direction} on beat ${error.beatPosition}\n`;
    }
    prompt += '\n';
  }

  if (issues.missedCount > 0) {
    prompt += `Missed ${issues.missedCount} notes completely.\n\n`;
  }

  // Context
  prompt += `CONTEXT:\n`;
  prompt += `- Attempt #${context.attemptNumber} at this exercise\n`;
  if (context.previousScore) {
    const change = score.overall - context.previousScore;
    prompt += `- Previous score: ${context.previousScore}% (${change >= 0 ? '+' : ''}${change}%)\n`;
  }
  prompt += `- User is level ${context.userLevel}\n`;
  prompt += `- Session time: ${context.sessionMinutes} minutes\n\n`;

  prompt += `Give brief, encouraging feedback with one specific tip to improve.`;

  return prompt;
}

/**
 * Get fallback feedback when API is unavailable
 */
function getFallbackFeedback(request: CoachFeedbackRequest): CoachFeedbackResponse {
  const { score, issues } = request;

  let feedback = '';

  if (score.overall >= 90) {
    feedback =
      "Excellent work! You're really getting the hang of this. Ready for the next challenge?";
  } else if (score.overall >= 80) {
    feedback =
      "Great effort! A little more practice and you'll have it mastered. Keep going!";
  } else if (score.overall >= 70) {
    feedback =
      "Good progress! Focus on one measure at a time. You're learning the right notes!";
  } else if (issues.timingErrors.length > issues.pitchErrors.length) {
    feedback =
      "Try counting along with the beat—timing takes practice. You're learning the right notes!";
  } else {
    feedback = "Take it slow and focus on one measure at a time. You've got this!";
  }

  return {
    feedback,
    suggestedNextAction: score.overall >= 80 ? 'continue' : 'retry',
    cached: false,
  };
}

/**
 * Validate AI response quality
 */
function validateResponse(text: string): boolean {
  const forbiddenPhrases = [
    'as an ai',
    'i am a language model',
    'i cannot',
    'metacarpal',
    'proprioception',
  ];

  const lowerText = text.toLowerCase();
  for (const phrase of forbiddenPhrases) {
    if (lowerText.includes(phrase)) {
      return false;
    }
  }

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 5) {
    return false;
  }

  return sentences.length > 0;
}

// ============================================================================
// Cloud Function
// ============================================================================

export const generateCoachFeedback = functions
  .region('us-central1')
  .https.onCall(async (data: CoachFeedbackRequest, context: functions.https.CallableContext) => {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated to call this function'
      );
    }

    const uid = context.auth.uid;

    try {
      // Check cache first (Firestore cache)
      const cacheKey = `${data.exerciseId}:${Math.floor(data.score.overall / 10) * 10}`;
      const cacheDocRef = admin
        .firestore()
        .collection('cache')
        .doc('coachFeedback')
        .collection('responses')
        .doc(cacheKey);

      const cachedDoc = await cacheDocRef.get();
      if (cachedDoc.exists) {
        const cached = cachedDoc.data();
        if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
          // Return cached response
          return {
            feedback: cached.feedback,
            suggestedNextAction: cached.suggestedNextAction,
            cached: true,
          } as CoachFeedbackResponse;
        }
      }

      // Call Gemini API
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: COACH_SYSTEM_PROMPT,
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.7,
        },
      });

      const prompt = buildPrompt(data);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Validate response
      if (!validateResponse(text)) {
        functions.logger.warn('Invalid AI response, using fallback', {
          userId: uid,
          exerciseId: data.exerciseId,
        });
        return getFallbackFeedback(data);
      }

      // Cache the response
      await cacheDocRef.set(
        {
          feedback: text,
          suggestedNextAction: data.score.overall >= 80 ? 'continue' : 'retry',
          timestamp: Date.now(),
        },
        { merge: true }
      );

      // Log the call for monitoring
      functions.logger.info('Coach feedback generated', {
        userId: uid,
        exerciseId: data.exerciseId,
        score: data.score.overall,
      });

      return {
        feedback: text,
        suggestedNextAction: data.score.overall >= 80 ? 'continue' : 'retry',
        cached: false,
      } as CoachFeedbackResponse;
    } catch (error) {
      functions.logger.error('Error generating coach feedback', {
        userId: uid,
        exerciseId: data.exerciseId,
        error: String(error),
      });

      // Return fallback on error
      return getFallbackFeedback(data);
    }
  });

// ============================================================================
// Cleanup: Remove old cache entries daily
// ============================================================================

export const cleanupCoachFeedbackCache = functions
  .region('us-central1')
  .pubsub.schedule('every day 02:00')
  .timeZone('UTC')
  .onRun(async () => {
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days old

    try {
      const cacheRef = admin
        .firestore()
        .collection('cache')
        .doc('coachFeedback')
        .collection('responses');

      const oldDocs = await cacheRef.where('timestamp', '<', cutoffTime).get();

      const batch = admin.firestore().batch();
      oldDocs.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => batch.delete(doc.ref));
      await batch.commit();

      functions.logger.info('Coach feedback cache cleanup completed', {
        deletedDocs: oldDocs.docs.length,
      });
    } catch (error) {
      functions.logger.error('Error cleaning up coach feedback cache', {
        error: String(error),
      });
    }
  });
