/**
 * Cloud Function: Generate Song
 * Generates simplified piano arrangements using Gemini 2.0 Flash.
 * Rate-limited to 5 requests per user per day.
 *
 * Note: ABC parsing (abcjs) is not available in Cloud Functions,
 * so we validate the raw Gemini response and return it for client-side assembly.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// Type Definitions (mirrored from client songTypes.ts & songAssembler.ts)
// ============================================================================

interface SongRequestParams {
  title: string;
  artist?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}

interface GeneratedSongABC {
  title: string;
  artist: string;
  genre: string;
  difficulty: number;
  attribution: string;
  sections: Array<{
    label: string;
    melodyABC: string;
    accompanimentABC?: string;
  }>;
  tempo: number;
  key: string;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_REQUESTS_PER_DAY = 5;

// ============================================================================
// Validation (copied from client songAssembler.ts)
// ============================================================================

function validateGeneratedSong(raw: unknown): raw is GeneratedSongABC {
  if (raw === null || raw === undefined || typeof raw !== 'object') return false;

  const obj = raw as Record<string, unknown>;

  if (typeof obj.title !== 'string' || obj.title.length === 0) return false;
  if (typeof obj.artist !== 'string') return false;
  if (typeof obj.genre !== 'string') return false;
  if (typeof obj.difficulty !== 'number' || obj.difficulty < 1 || obj.difficulty > 5) return false;
  if (typeof obj.attribution !== 'string') return false;
  if (typeof obj.tempo !== 'number' || obj.tempo < 30 || obj.tempo > 240) return false;
  if (typeof obj.key !== 'string') return false;

  if (!Array.isArray(obj.sections) || obj.sections.length === 0) return false;

  for (const section of obj.sections) {
    if (typeof section !== 'object' || section === null || section === undefined) return false;
    const s = section as Record<string, unknown>;
    if (typeof s.label !== 'string' || s.label.length === 0) return false;
    if (typeof s.melodyABC !== 'string' || s.melodyABC.length === 0) return false;
  }

  return true;
}

// ============================================================================
// Prompt Builder (copied from client songAssembler.ts)
// ============================================================================

function difficultyGuide(d: number): string {
  switch (d) {
    case 1: return 'whole/half notes only, C major, very slow';
    case 2: return 'quarter notes, C/G major, simple rhythms';
    case 3: return 'eighth notes OK, any major key, moderate tempo';
    case 4: return 'sixteenth notes, minor keys OK, faster tempo';
    case 5: return 'complex rhythms, any key, performance tempo';
    default: return 'moderate difficulty';
  }
}

function buildSongPrompt(params: SongRequestParams): string {
  const artistHint = params.artist ? ` by ${params.artist}` : '';

  return `Generate a simplified beginner piano arrangement of "${params.title}"${artistHint}.

Return JSON with this exact structure:
{
  "title": "Song Title",
  "artist": "Original Artist",
  "genre": "pop|classical|folk|film|game|holiday",
  "difficulty": ${params.difficulty},
  "attribution": "AI arrangement — simplified for learning",
  "tempo": <BPM 60-160>,
  "key": "<key signature letter, e.g. C, G, F, Am>",
  "sections": [
    {
      "label": "Verse 1",
      "melodyABC": "X:1\\nT:Verse 1\\nM:4/4\\nL:1/8\\nK:C\\n<ABC notes here>|",
      "accompanimentABC": "X:1\\nT:Verse 1 LH\\nM:4/4\\nL:1/4\\nK:C\\n<optional LH notes>|"
    }
  ]
}

RULES:
- Each section's melodyABC must be complete, valid ABC notation with X:, T:, M:, L:, K: headers
- Keep MIDI range 48-84 (C3 to C6)
- Melody should be right hand, mostly stepwise motion
- Accompaniment (optional) should be left hand, simple chords or bass notes
- Split into 2-4 sections (verse, chorus, bridge, etc.)
- Each section should be 4-16 bars
- Difficulty ${params.difficulty}/5: ${difficultyGuide(params.difficulty)}
- Use common time signatures (4/4 or 3/4)
- For well-known songs, preserve the recognizable melody
- Attribution must always say "AI arrangement"`;
}

// ============================================================================
// Rate Limiting
// ============================================================================

async function checkRateLimit(uid: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  const rateLimitRef = admin
    .firestore()
    .collection('rateLimit')
    .doc(uid)
    .collection('songs')
    .doc(today);

  const doc = await rateLimitRef.get();
  const count = doc.exists ? (doc.data()?.count ?? 0) : 0;
  return count < MAX_REQUESTS_PER_DAY;
}

async function incrementRateLimit(uid: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const rateLimitRef = admin
    .firestore()
    .collection('rateLimit')
    .doc(uid)
    .collection('songs')
    .doc(today);

  await rateLimitRef.set(
    { count: admin.firestore.FieldValue.increment(1), updatedAt: Date.now() },
    { merge: true },
  );
}

// ============================================================================
// Cloud Function
// ============================================================================

export const generateSong = functions
  .region('us-central1')
  .https.onCall(async (data: SongRequestParams, context: functions.https.CallableContext) => {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated to generate songs',
      );
    }

    const uid = context.auth.uid;

    // Rate limit check
    const withinLimit = await checkRateLimit(uid);
    if (!withinLimit) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Daily song generation limit reached (5/day)',
      );
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Gemini API key not configured',
        );
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.8,
        },
      });

      const prompt = buildSongPrompt(data);

      // First attempt
      let validatedSong = await attemptGeneration(model, prompt);

      // Retry once with stronger guidance on failure
      if (!validatedSong) {
        const retryPrompt = prompt +
          '\n\nPrevious attempt failed. Ensure each section has valid ABC notation with all required headers (X:, T:, M:, L:, K:).';
        validatedSong = await attemptGeneration(model, retryPrompt);
      }

      if (!validatedSong) {
        throw new functions.https.HttpsError(
          'internal',
          'Both song generation attempts failed validation',
        );
      }

      // Increment rate limit counter on success
      await incrementRateLimit(uid);

      functions.logger.info('Song generated', {
        userId: uid,
        title: data.title,
        difficulty: data.difficulty,
      });

      // Return the validated GeneratedSongABC for client-side assembly
      // (ABC parsing via abcjs is only available on the client)
      return validatedSong;
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error('Song generation error', {
        userId: uid,
        error: String(error),
      });
      throw new functions.https.HttpsError(
        'internal',
        'Failed to generate song',
      );
    }
  });

// ============================================================================
// Internal Helpers
// ============================================================================

interface GenerativeModel {
  generateContent(prompt: string): Promise<{
    response: { text(): string };
  }>;
}

async function attemptGeneration(
  model: GenerativeModel,
  prompt: string,
): Promise<GeneratedSongABC | null> {
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed: unknown = JSON.parse(text);

  if (validateGeneratedSong(parsed)) {
    return parsed;
  }

  return null;
}
