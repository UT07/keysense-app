/**
 * Song Generation Service
 *
 * Uses Gemini 2.0 Flash to generate simplified piano arrangements.
 * Pure assembly/validation logic lives in @/core/songs/songAssembler.ts.
 * This service adds Gemini API calls, Firestore save, and rate limiting.
 *
 * Rate-limited to 5 requests per user per day.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/config';
import {
  buildSongPrompt,
  validateGeneratedSong,
  assembleSong,
  type GeneratedSongABC,
} from '@/core/songs/songAssembler';
import type { Song, SongRequestParams } from '@/core/songs/songTypes';
import { saveSongToFirestore, getUserSongRequestCount, incrementSongRequestCount } from './songService';
import { withTimeout } from '../utils/withTimeout';
import { logger } from '../utils/logger';

// Re-export pure functions for backward compatibility
export { buildSongPrompt, validateGeneratedSong, assembleSong, type GeneratedSongABC };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_REQUESTS_PER_DAY = 5;

const API_KEY_ENV = ['EXPO', 'PUBLIC', 'GEMINI', 'API', 'KEY'].join('_');

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

export async function generateAndSaveSong(
  params: SongRequestParams,
  uid: string,
): Promise<Song | null> {
  // Try Cloud Function first
  try {
    const fn = httpsCallable<SongRequestParams, GeneratedSongABC>(functions, 'generateSong', { timeout: 5000 });
    const result = await fn(params);
    const rawSong = result.data;

    if (rawSong && validateGeneratedSong(rawSong)) {
      const song = assembleSong(rawSong, 'gemini');
      if (song) {
        // Save to Firestore and increment counter
        await saveSongToFirestore(song);
        const today = new Date().toISOString().split('T')[0];
        await incrementSongRequestCount(uid, today);
        return song;
      }
    }
  } catch (cfError) {
    logger.warn('[SongGen] Cloud Function unavailable, using direct API:', (cfError as Error)?.message ?? cfError);
  }

  // Fall back to direct Gemini API call
  // Rate limit check
  const today = new Date().toISOString().split('T')[0];
  const count = await getUserSongRequestCount(uid, today);
  if (count >= MAX_REQUESTS_PER_DAY) {
    logger.warn('[SongGen] Daily request limit reached');
    return null;
  }

  const apiKey = process.env[API_KEY_ENV];
  if (!apiKey) {
    logger.warn('[SongGen] EXPO_PUBLIC_GEMINI_API_KEY is not set');
    return null;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.8,
    },
  });

  const prompt = buildSongPrompt(params);

  try {
    // First attempt
    let song = await attemptGeneration(model, prompt);
    if (!song) {
      // Retry with guidance
      const retryPrompt = prompt + '\n\nPrevious attempt failed. Ensure each section has valid ABC notation with all required headers (X:, T:, M:, L:, K:).';
      song = await attemptGeneration(model, retryPrompt);
    }

    if (!song) {
      logger.warn('[SongGen] Both generation attempts failed');
      return null;
    }

    // Save to Firestore and increment counter
    await saveSongToFirestore(song);
    await incrementSongRequestCount(uid, today);

    return song;
  } catch (error) {
    logger.warn('[SongGen] Generation failed:', (error as Error)?.message ?? error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface GenerativeModel {
  generateContent(prompt: string): Promise<{
    response: { text(): string };
  }>;
}

async function attemptGeneration(
  model: GenerativeModel,
  prompt: string,
): Promise<Song | null> {
  const result = await withTimeout(
    model.generateContent(prompt),
    30000,
    'SongGeneration.generateContent',
  );
  const text = result.response.text();
  const parsed: unknown = JSON.parse(text);

  if (!validateGeneratedSong(parsed)) {
    return null;
  }

  return assembleSong(parsed, 'gemini');
}
