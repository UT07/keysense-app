/**
 * Gemini AI Exercise Generation Service
 *
 * Generates piano exercises using Google Gemini 2.0 Flash based on a learner's
 * profile. Validates AI output for playability, retries once on failure, and
 * returns null if generation is not possible.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerationHints } from '../core/curriculum/SkillTree';

// ============================================================================
// Type Definitions
// ============================================================================

export interface GenerationParams {
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
  /** Explicit key signature override (e.g. from free play analysis). When set, takes priority over difficulty-based key selection. */
  keySignature?: string;
  /** Skill-specific generation hints from the SkillTree. When provided, these drive targeted exercise content. */
  generationHints?: GenerationHints;
}

export interface AIExercise {
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
// Constants
// ============================================================================

const MIDI_MIN = 36;
const MIDI_MAX = 96;
const MAX_NOTES = 32;
const MAX_INTERVAL_FAST_TEMPO = 24; // 2 octaves at > 120 BPM
const MAX_INTERVAL_ANY_TEMPO = 36; // 3 octaves absolute limit
const FAST_TEMPO_THRESHOLD = 120;
const TEMPO_MIN = 30;
const TEMPO_MAX = 200;

/**
 * Environment variable name built via concatenation so that Babel's
 * inline-environment-variables transform (from babel-preset-expo) cannot
 * statically resolve the key and replace it with a build-time literal.
 */
const API_KEY_ENV = ['EXPO', 'PUBLIC', 'GEMINI', 'API', 'KEY'].join('_');

// ============================================================================
// Validation
// ============================================================================

export function validateAIExercise(exercise: unknown, allowedMidi?: number[]): exercise is AIExercise {
  if (exercise == null || typeof exercise !== 'object') {
    return false;
  }

  const ex = exercise as Record<string, unknown>;

  // Must have notes array and settings object
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

  // Validate tempo
  if (
    typeof settings.tempo !== 'number' ||
    settings.tempo < TEMPO_MIN ||
    settings.tempo > TEMPO_MAX
  ) {
    return false;
  }

  // Validate timeSignature
  if (!Array.isArray(settings.timeSignature) || settings.timeSignature.length !== 2) {
    return false;
  }
  const [beats, beatValue] = settings.timeSignature as unknown[];
  if (typeof beats !== 'number' || typeof beatValue !== 'number' || beats <= 0 || beatValue <= 0) {
    return false;
  }

  const tempo = settings.tempo;
  const notes = ex.notes as Array<Record<string, unknown>>;

  // Validate each note and check intervals
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];

    if (typeof n.note !== 'number' || n.note < MIDI_MIN || n.note > MIDI_MAX) {
      return false;
    }

    // Reject notes outside the allowed set (from generationHints.targetMidi)
    if (allowedMidi && allowedMidi.length > 0 && !allowedMidi.includes(n.note as number)) {
      return false;
    }

    if (typeof n.startBeat !== 'number' || n.startBeat < 0) {
      return false;
    }

    if (typeof n.durationBeats !== 'number' || n.durationBeats <= 0) {
      return false;
    }

    // Check interval from previous note
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

  return true;
}

// ============================================================================
// Prompt Builder
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

export function buildPrompt(params: GenerationParams): string {
  const hints = params.generationHints;
  const tempo = calculateTempo(params);
  const keySignature =
    hints?.keySignature ?? params.keySignature ?? keySignatureForDifficulty(params.difficulty);
  const difficulty = hints?.minDifficulty ?? params.difficulty;
  const hand = hints?.hand ?? 'right';

  let prompt = `Generate a piano exercise as JSON for a student with this profile:
- Weak notes (MIDI): ${JSON.stringify(params.weakNotes)} (focus extra repetitions on these)
- Timing accuracy: ${Math.round(params.skills.timingAccuracy * 100)}%
- Comfortable tempo: ${params.tempoRange.min}-${params.tempoRange.max} BPM
- Difficulty: ${difficulty}/5
- Target note count: ${params.noteCount}`;

  // Inject skill-specific generation hints (highest priority context)
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

  // Add skill context if provided (from CurriculumEngine)
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
- Notes should flow melodically (mostly stepwise motion, occasional skips)
- Include at least 2 repetitions of each weak note
- All notes should use hand: "${hand}"

Return JSON: { notes: [{note, startBeat, durationBeats, hand}], settings: {tempo, timeSignature, keySignature}, metadata: {title, difficulty, skills}, scoring: {passingScore, timingToleranceMs, starThresholds} }`;

  return prompt;
}

/**
 * Generate a warm-up exercise targeting the learner's weak areas.
 */
export async function generateWarmUp(profile: {
  weakNotes: number[];
  tempoRange: { min: number; max: number };
  skills: GenerationParams['skills'];
}): Promise<AIExercise | null> {
  return generateExercise({
    weakNotes: profile.weakNotes,
    tempoRange: profile.tempoRange,
    difficulty: 1,
    noteCount: 8,
    skills: profile.skills,
    exerciseType: 'warmup',
    skillContext: profile.weakNotes.length > 0
      ? `Warm up with focus on weak notes: MIDI ${profile.weakNotes.slice(0, 3).join(', ')}`
      : 'General warm-up with C major patterns',
  });
}

/**
 * Generate a challenge exercise that pushes the learner slightly above comfort zone.
 */
export async function generateChallenge(profile: {
  weakNotes: number[];
  tempoRange: { min: number; max: number };
  skills: GenerationParams['skills'];
  targetSkillId?: string;
  skillContext?: string;
}): Promise<AIExercise | null> {
  return generateExercise({
    weakNotes: profile.weakNotes,
    tempoRange: {
      min: profile.tempoRange.min + 5,
      max: profile.tempoRange.max + 10,
    },
    difficulty: 3,
    noteCount: 16,
    skills: profile.skills,
    exerciseType: 'challenge',
    targetSkillId: profile.targetSkillId,
    skillContext: profile.skillContext ?? 'Challenge: slightly faster tempo with more notes',
  });
}

// ============================================================================
// Exercise Generation
// ============================================================================

export async function generateExercise(params: GenerationParams): Promise<AIExercise | null> {
  try {
    // Dynamic access prevents Babel from inlining the env var at build time
    const apiKey = process.env[API_KEY_ENV];
    if (!apiKey) {
      console.warn('[GeminiExercise] EXPO_PUBLIC_GEMINI_API_KEY is not set');
      return null;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const prompt = buildPrompt(params);
    const allowedMidi = params.generationHints?.targetMidi;

    // First attempt
    const exercise = await attemptGeneration(model, prompt, allowedMidi);
    if (exercise) {
      return exercise;
    }

    // Retry with stronger guidance
    const midiHint = allowedMidi?.length
      ? ` Use ONLY these MIDI notes: ${JSON.stringify(allowedMidi)}.`
      : '';
    const retryPrompt =
      prompt +
      `\n\nPrevious attempt was invalid. Ensure all MIDI notes are 36-96 and intervals are reasonable.${midiHint}`;
    const retryExercise = await attemptGeneration(model, retryPrompt, allowedMidi);
    if (retryExercise) {
      return retryExercise;
    }

    console.warn('[GeminiExercise] Both generation attempts failed validation');
    return null;
  } catch (error) {
    console.warn(
      '[GeminiExercise] Generation failed:',
      (error as Error)?.message ?? error
    );
    return null;
  }
}

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
