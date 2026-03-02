/**
 * Gemini AI Coach Service
 * Provides personalized coaching feedback using Google Gemini 2.0 Flash
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { getOfflineCoachingText } from '../../content/offlineCoachingTemplates';
import { withTimeout } from '../../utils/withTimeout';
import { logger } from '../../utils/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CoachRequest {
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

// ============================================================================
// System Prompt (from PRD section 3.7.2)
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
8. Adapt enthusiasm to match the score (don't be overly excited for poor scores)

EXAMPLES OF GOOD RESPONSES:
- "The C-E-G chord is tricky—try playing each note separately first, then together. You're getting closer with each try!"
- "Your timing on beat 3 keeps rushing ahead. Try tapping your foot or counting '1-2-3-4' out loud. Almost there!"
- "That was really good! For your next challenge, try playing it a bit faster to build fluency."

EXAMPLES OF BAD RESPONSES:
- "Great job! You did amazing! Keep practicing!" (too vague, no specific feedback)
- "Your accuracy was 73% which means you missed 27% of the notes..." (robotic, discouraging)
- "The issue is your metacarpal positioning..." (too technical)`;

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_PREFIX = 'coach-cache:';
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours — shorter TTL for more response variety

interface CacheEntry {
  response: string;
  timestamp: number;
}

// AsyncStorage cache helpers
const cache = {
  async getString(key: string): Promise<string | undefined> {
    const value = await AsyncStorage.getItem(CACHE_PREFIX + key);
    return value ?? undefined;
  },
  async setString(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(CACHE_PREFIX + key, value);
  },
  async set(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(CACHE_PREFIX + key, value);
  },
  async delete(key: string): Promise<void> {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  },
  async getAllKeys(): Promise<string[]> {
    const allKeys = await AsyncStorage.getAllKeys();
    return allKeys.filter(k => k.startsWith(CACHE_PREFIX)).map(k => k.slice(CACHE_PREFIX.length));
  },
  async clearAll(): Promise<void> {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  },
};

// ============================================================================
// Gemini Coach Service
// ============================================================================

export class GeminiCoach {
  private static genAI: GoogleGenerativeAI | null = null;

  /**
   * Initialize Gemini API client
   */
  private static initialize(): GoogleGenerativeAI {
    if (!this.genAI) {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        logger.warn('[GeminiCoach] EXPO_PUBLIC_GEMINI_API_KEY is not set, using fallback feedback');
        throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not set');
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    return this.genAI;
  }

  /**
   * Build prompt from coach request
   */
  private static buildPrompt(request: CoachRequest): string {
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
   * Generate cache key from request
   */
  private static getCacheKey(request: CoachRequest): string {
    const scoreBucket = Math.floor(request.score.overall / 10) * 10;
    const attemptBucket = Math.min(request.context.attemptNumber, 5);
    const issueHash = this.hashIssues(request.issues);

    return `coach:${request.exerciseId}:${scoreBucket}:${attemptBucket}:${issueHash}`;
  }

  /**
   * Hash function for issues — includes actual error content for cache key entropy.
   * Without content in the hash, every attempt with the same score bucket
   * hits the same cache entry regardless of which notes were missed.
   */
  private static hashIssues(issues: CoachRequest['issues']): string {
    const parts = [
      issues.pitchErrors.map((e) => `${e.expected}@${e.beatPosition}`).join(','),
      issues.timingErrors.map((e) => `${e.note}:${e.offsetMs}@${e.beatPosition}`).join(','),
      `m${issues.missedCount}`,
      `x${issues.extraCount}`,
    ];
    const key = parts.join('|');
    return Math.abs(
      key.split('').reduce((hash, char) => hash * 31 + char.charCodeAt(0), 0)
    )
      .toString(16)
      .slice(0, 8);
  }

  /**
   * Get cached response if available
   */
  private static async getCachedResponse(cacheKey: string): Promise<string | null> {
    const cached = await cache.getString(cacheKey);
    if (!cached) {
      return null;
    }

    try {
      const entry: CacheEntry = JSON.parse(cached);
      if (Date.now() - entry.timestamp < CACHE_TTL) {
        return entry.response;
      }
      // Cache expired, delete it
      await cache.delete(cacheKey);
    } catch {
      await cache.delete(cacheKey);
    }

    return null;
  }

  /**
   * Cache response with timestamp
   */
  private static async cacheResponse(cacheKey: string, response: string): Promise<void> {
    const entry: CacheEntry = {
      response,
      timestamp: Date.now(),
    };
    await cache.set(cacheKey, JSON.stringify(entry));
  }

  /**
   * Get AI-generated feedback for exercise.
   * Tries Cloud Function first, then falls back to direct Gemini API call.
   */
  static async getFeedback(request: CoachRequest): Promise<string> {
    const cacheKey = this.getCacheKey(request);

    // Check cache first
    const cached = await this.getCachedResponse(cacheKey);
    if (cached) {
      return cached;
    }

    // Try Cloud Function first
    try {
      const fn = httpsCallable<CoachRequest, { feedback: string }>(functions, 'generateCoachFeedback', { timeout: 5000 });
      const result = await fn(request);
      const text = result.data.feedback;

      if (text) {
        // Cache successful Cloud Function response
        await this.cacheResponse(cacheKey, text);
        return text;
      }
    } catch (cfError) {
      logger.warn('[GeminiCoach] Cloud Function unavailable, using direct API:', (cfError as Error)?.message ?? cfError);
    }

    // Fall back to direct Gemini API call
    try {
      const genAI = this.initialize();
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: COACH_SYSTEM_PROMPT,
        generationConfig: {
          maxOutputTokens: 150,
          temperature: 0.85,
        },
      });

      const prompt = this.buildPrompt(request);

      const result = await withTimeout(
        model.generateContent(prompt),
        15000,
        'GeminiCoach.generateContent',
      );
      const response = result.response;
      const text = response.text();

      // Validate response
      const validationResult = this.validateResponse(text);
      if (!validationResult.valid) {
        logger.warn('Invalid AI response:', validationResult.reason);
        return this.getFallbackFeedback(request);
      }

      // Cache successful response
      await this.cacheResponse(cacheKey, text);

      return text;
    } catch (error) {
      // Use warn (not error) to avoid Expo error overlay for expected API failures
      logger.warn('[GeminiCoach] API call failed, using fallback:', (error as Error)?.message ?? error);
      return this.getFallbackFeedback(request);
    }
  }

  /**
   * Fallback feedback when API is unavailable or fails.
   * Uses offline coaching templates for varied, context-aware responses.
   */
  private static getFallbackFeedback(request: CoachRequest): string {
    const { score, issues } = request;
    const isPassed = score.overall >= 70;
    const mainIssue: 'timing' | 'pitch' | 'general' =
      issues.timingErrors.length > issues.pitchErrors.length ? 'timing'
        : issues.pitchErrors.length > 0 ? 'pitch'
        : 'general';

    return getOfflineCoachingText(
      score.overall,
      isPassed,
      request.context.attemptNumber,
      mainIssue
    );
  }

  /**
   * Validate AI response for quality and safety
   */
  private static validateResponse(
    text: string
  ): { valid: boolean; reason?: string } {
    const forbiddenPhrases = [
      'as an ai',
      'i am a language model',
      'i cannot',
      'metacarpal',
      'proprioception',
      'as an artificial',
      'as a computer',
    ];

    const lowerText = text.toLowerCase();
    for (const phrase of forbiddenPhrases) {
      if (lowerText.includes(phrase)) {
        return { valid: false, reason: `Contains forbidden phrase: "${phrase}"` };
      }
    }

    // Check length (should be 2-3 sentences)
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length > 5) {
      return { valid: false, reason: 'Response too long (>5 sentences)' };
    }

    if (sentences.length === 0) {
      return { valid: false, reason: 'Response is empty' };
    }

    return { valid: true };
  }

  /**
   * Clear cache for a specific exercise (admin use)
   */
  static async clearExerciseCache(exerciseId: string): Promise<void> {
    const keys = await cache.getAllKeys();
    for (const key of keys) {
      if (key.startsWith(`coach:${exerciseId}:`)) {
        await cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  static async clearAllCache(): Promise<void> {
    await cache.clearAll();
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{ size: number; itemCount: number }> {
    const keys = await cache.getAllKeys();
    let size = 0;
    for (const key of keys) {
      const value = await cache.getString(key);
      if (value) {
        size += value.length;
      }
    }
    return {
      size,
      itemCount: keys.length,
    };
  }
}

// ============================================================================
// Exported functions for convenience
// ============================================================================

export async function getCoachFeedback(request: CoachRequest): Promise<string> {
  return GeminiCoach.getFeedback(request);
}

export function clearCoachCache(exerciseId?: string): void {
  if (exerciseId) {
    GeminiCoach.clearExerciseCache(exerciseId);
  } else {
    GeminiCoach.clearAllCache();
  }
}
