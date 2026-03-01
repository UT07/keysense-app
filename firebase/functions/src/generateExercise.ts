/**
 * Cloud Function: Generate AI Exercise
 * Generates piano exercises using Gemini 2.0 Flash, moving the API key server-side.
 * Rate-limited to 30 requests per user per day.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ============================================================================
// Type Definitions (mirrored from client geminiExerciseService.ts)
// ============================================================================

interface GenerationHints {
  keySignature?: string;
  targetMidi?: number[];
  hand?: 'left' | 'right' | 'both';
  exerciseTypes?: ('scale' | 'melody' | 'chord' | 'rhythm' | 'arpeggio')[];
  minDifficulty?: number;
  maxDifficulty?: number;
  promptHint: string;
}

interface GenerationParams {
  weakNotes: number[];
  tempoRange: { min: number; max: number };
  difficulty: number;
  noteCount: number;
  skills: {
    timingAccuracy: number;
    pitchAccuracy: number;
    sightReadSpeed: number;
    chordRecognition: number;
  };
  targetSkillId?: string;
  skillContext?: string;
  exerciseType?: 'warmup' | 'lesson' | 'challenge';
  keySignature?: string;
  generationHints?: GenerationHints;
}

interface AIExercise {
  notes: Array<{
    note: number;
    startBeat: number;
    durationBeats: number;
    hand?: string;
  }>;
  settings: {
    tempo: number;
    timeSignature: [number, number];
    keySignature: string;
  };
  metadata?: {
    title?: string;
    difficulty?: number;
    skills?: string[];
  };
  scoring?: {
    passingScore?: number;
    timingToleranceMs?: number;
    starThresholds?: number[];
  };
}

// ============================================================================
// Constants (mirrored from client geminiExerciseService.ts)
// ============================================================================

const MIDI_MIN = 36;
const MIDI_MAX = 96;
const MAX_NOTES = 64;
const MAX_INTERVAL_FAST_TEMPO = 24;
const MAX_INTERVAL_ANY_TEMPO = 36;
const FAST_TEMPO_THRESHOLD = 120;
const TEMPO_MIN = 30;
const TEMPO_MAX = 200;
const VALID_DURATIONS = new Set([0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]);
const MAX_EXERCISE_BEATS = 128;

const MAX_REQUESTS_PER_DAY = 30;

// ============================================================================
// Validation (copied from client geminiExerciseService.ts)
// ============================================================================

function validateAIExercise(exercise: unknown, allowedMidi?: number[]): exercise is AIExercise {
  if (exercise == null || typeof exercise !== 'object') {
    return false;
  }

  const ex = exercise as Record<string, unknown>;

  if (!Array.isArray(ex.notes) || ex.notes.length === 0) {
    return false;
  }

  if (ex.notes.length > MAX_NOTES) {
    return false;
  }

  if (ex.settings == null || typeof ex.settings !== 'object') {
    return false;
  }

  const settings = ex.settings as Record<string, unknown>;

  if (
    typeof settings.tempo !== 'number' ||
    settings.tempo < TEMPO_MIN ||
    settings.tempo > TEMPO_MAX
  ) {
    return false;
  }

  if (!Array.isArray(settings.timeSignature) || settings.timeSignature.length !== 2) {
    return false;
  }
  const [beats, beatValue] = settings.timeSignature as unknown[];
  if (typeof beats !== 'number' || typeof beatValue !== 'number' || beats <= 0 || beatValue <= 0) {
    return false;
  }

  const tempo = settings.tempo;
  const notes = ex.notes as Array<Record<string, unknown>>;

  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];

    if (typeof n.note !== 'number' || n.note < MIDI_MIN || n.note > MIDI_MAX) {
      return false;
    }

    if (allowedMidi && allowedMidi.length > 0 && !allowedMidi.includes(n.note as number)) {
      return false;
    }

    if (typeof n.startBeat !== 'number' || n.startBeat < 0) {
      return false;
    }

    if (typeof n.durationBeats !== 'number' || n.durationBeats <= 0) {
      return false;
    }

    // Validate duration is a musically sensible value
    if (!VALID_DURATIONS.has(n.durationBeats as number)) {
      const closest = Array.from(VALID_DURATIONS).find(
        (d) => Math.abs(d - (n.durationBeats as number)) < 0.05,
      );
      if (!closest) return false;
    }

    if (i > 0) {
      const prevNote = notes[i - 1].note as number;
      const interval = Math.abs(n.note as number - prevNote);

      if (interval > MAX_INTERVAL_ANY_TEMPO) {
        return false;
      }

      if (tempo > FAST_TEMPO_THRESHOLD && interval > MAX_INTERVAL_FAST_TEMPO) {
        return false;
      }
    }
  }

  // Check total exercise length is reasonable
  const lastNote = notes[notes.length - 1];
  const totalBeats = (lastNote.startBeat as number) + (lastNote.durationBeats as number);
  if (totalBeats > MAX_EXERCISE_BEATS || totalBeats <= 0) {
    return false;
  }

  return true;
}

// ============================================================================
// Prompt Builder (copied from client geminiExerciseService.ts)
// ============================================================================

function calculateTempo(params: GenerationParams): number {
  const midTempo = (params.tempoRange.min + params.tempoRange.max) / 2;
  const difficultyScale = 0.6 + (params.difficulty / 5) * 0.4;
  return Math.round(midTempo * difficultyScale);
}

function keySignatureForDifficulty(difficulty: number): string {
  switch (difficulty) {
    case 1:
    case 2:
      return 'C major';
    case 3:
      return 'G major';
    case 4:
      return 'F major';
    default:
      return 'mixed';
  }
}

function buildPrompt(params: GenerationParams): string {
  const hints = params.generationHints;
  const tempo = calculateTempo(params);
  const keySignature =
    hints?.keySignature ?? params.keySignature ?? keySignatureForDifficulty(params.difficulty);
  const difficulty = hints?.minDifficulty ?? params.difficulty;
  const hand = hints?.hand ?? 'right';
  const totalBeats = Math.ceil(params.noteCount * 1.5);

  let prompt = `Generate a piano exercise as JSON for a student with this profile:
- Weak notes (MIDI): ${JSON.stringify(params.weakNotes)} (focus extra repetitions on these)
- Timing accuracy: ${Math.round(params.skills.timingAccuracy * 100)}%
- Comfortable tempo: ${params.tempoRange.min}-${params.tempoRange.max} BPM
- Difficulty: ${difficulty}/5
- Target note count: ${params.noteCount}`;

  if (hints) {
    prompt += `\n- SKILL OBJECTIVE: ${hints.promptHint}`;
    if (hints.targetMidi && hints.targetMidi.length > 0) {
      prompt += `\n- Use ONLY these MIDI notes: ${JSON.stringify(hints.targetMidi)}`;
    }
    prompt += `\n- Hand: ${hand}`;
    if (hints.exerciseTypes && hints.exerciseTypes.length > 0) {
      prompt += `\n- Exercise style: ${hints.exerciseTypes.join(' or ')}`;
    }
  }

  if (params.skillContext) {
    prompt += `\n- Skill focus: ${params.skillContext}`;
  }

  if (params.exerciseType) {
    const typeDescriptions: Record<string, string> = {
      warmup: 'This is a warm-up exercise. Keep it simple, focus on familiar patterns and weak areas.',
      lesson: 'This is a lesson exercise. Introduce the target skill progressively with clear patterns.',
      challenge: 'This is a challenge exercise. Push slightly beyond their comfort zone with faster tempo or wider intervals.',
    };
    prompt += `\n- Exercise purpose: ${typeDescriptions[params.exerciseType]}`;
  }

  prompt += `

Requirements:
- Tempo: ${tempo} BPM (middle of their range, scaled by difficulty)
- Time signature: 4/4
- Key signature: ${keySignature}
- All MIDI notes between 48-84 (C3 to C6)
- All notes should use hand: "${hand}"
- Include at least 2 repetitions of each weak note
- Exercise should span approximately ${totalBeats} beats (${Math.ceil(totalBeats / 4)} measures of 4/4)

Musical quality rules (IMPORTANT):
- Structure in 4-bar phrases with question-and-answer patterns
- End each phrase on a stable scale degree (tonic or dominant)
- End the exercise on the tonic note of the key
- Use rhythmic variety: mix quarter notes (1 beat), half notes (2 beats), eighth notes (0.5 beats), and dotted quarters (1.5 beats). Do NOT use only quarter notes.
- Use mostly stepwise motion (seconds) with occasional thirds and one or two wider skips per phrase
- durationBeats must be a standard musical value: 0.25, 0.5, 0.75, 1, 1.5, 2, 3, or 4
- startBeat values must not cause overlapping notes for the same hand
- First note should start on beat 0

Return ONLY valid JSON (no markdown, no explanation):
{ "notes": [{"note": <midi>, "startBeat": <number>, "durationBeats": <number>, "hand": "${hand}"}], "settings": {"tempo": ${tempo}, "timeSignature": [4,4], "keySignature": "${keySignature}"}, "metadata": {"title": "<descriptive title>", "difficulty": ${difficulty}, "skills": ["<relevant-skill>"]}, "scoring": {"passingScore": ${difficulty <= 2 ? 60 : difficulty <= 4 ? 70 : 80}, "timingToleranceMs": ${difficulty <= 2 ? 75 : difficulty <= 4 ? 50 : 30}, "starThresholds": [70, 85, 95]} }`;

  return prompt;
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
    .collection('exercises')
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
    .collection('exercises')
    .doc(today);

  await rateLimitRef.set(
    { count: admin.firestore.FieldValue.increment(1), updatedAt: Date.now() },
    { merge: true },
  );
}

// ============================================================================
// Cloud Function
// ============================================================================

export const generateExercise = functions
  .region('us-central1')
  .https.onCall(async (data: GenerationParams, context: functions.https.CallableContext) => {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated to generate exercises',
      );
    }

    const uid = context.auth.uid;

    // Rate limit check
    const withinLimit = await checkRateLimit(uid);
    if (!withinLimit) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        'Daily exercise generation limit reached (30/day)',
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
          temperature: 0.7,
        },
      });

      const prompt = buildPrompt(data);
      const allowedMidi = data.generationHints?.targetMidi;

      // First attempt
      let exercise = await attemptGeneration(model, prompt, allowedMidi);

      // Retry once with stronger guidance on failure
      if (!exercise) {
        const midiHint = allowedMidi?.length
          ? ` Use ONLY these MIDI notes: ${JSON.stringify(allowedMidi)}.`
          : '';
        const retryPrompt =
          prompt +
          `\n\nPrevious attempt was invalid. Ensure all MIDI notes are 36-96 and intervals are reasonable.${midiHint}`;
        exercise = await attemptGeneration(model, retryPrompt, allowedMidi);
      }

      if (!exercise) {
        throw new functions.https.HttpsError(
          'internal',
          'Both generation attempts failed validation',
        );
      }

      // Increment rate limit counter on success
      await incrementRateLimit(uid);

      functions.logger.info('Exercise generated', {
        userId: uid,
        difficulty: data.difficulty,
        noteCount: data.noteCount,
      });

      return exercise;
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error('Exercise generation error', {
        userId: uid,
        error: String(error),
      });
      throw new functions.https.HttpsError(
        'internal',
        'Failed to generate exercise',
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
  allowedMidi?: number[],
): Promise<AIExercise | null> {
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed: unknown = JSON.parse(text);

  if (validateAIExercise(parsed, allowedMidi)) {
    return parsed;
  }

  return null;
}
