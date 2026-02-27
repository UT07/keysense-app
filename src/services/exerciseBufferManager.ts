/**
 * Exercise Buffer Manager
 *
 * Manages a skill-aware FIFO queue of pre-generated AI exercises stored in
 * AsyncStorage. Each buffered exercise is tagged with a `targetSkillId` so the
 * ExercisePlayer can request an exercise for a specific skill. Falls back to
 * any-skill dequeue when no skill match is found.
 *
 * After each exercise completion, the app checks the buffer and triggers
 * background generation if it's running low. This decouples AI generation
 * latency from the user experience.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AIExercise, GenerationParams } from './geminiExerciseService';
import { generateExercise } from './geminiExerciseService';
import { getGenerationHints } from '../core/curriculum/SkillTree';

// ============================================================================
// Types
// ============================================================================

/** A buffered exercise with its target skill context. */
export interface BufferedExercise {
  exercise: AIExercise;
  targetSkillId: string;
}

/** Request to pre-generate exercises for a specific skill. */
export interface SkillBufferRequest {
  skillId: string;
  params: GenerationParams;
  count?: number; // defaults to 1
}

// ============================================================================
// Constants
// ============================================================================

/** Desired buffer size — fillBuffer will generate up to this many */
export const BUFFER_TARGET = 5;

/** Trigger a fill when the buffer drops below this threshold */
export const BUFFER_MIN_THRESHOLD = 3;

/** Hard cap — evict oldest exercises when exceeding this */
export const BUFFER_MAX_SIZE = 10;

const STORAGE_KEY = 'keysense_exercise_buffer';

// ============================================================================
// Internal Helpers
// ============================================================================

async function loadBuffer(): Promise<BufferedExercise[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);

    // Migrate legacy format: plain AIExercise[] → BufferedExercise[]
    if (Array.isArray(parsed) && parsed.length > 0 && !('exercise' in (parsed[0] as object))) {
      return (parsed as AIExercise[]).map((ex) => ({
        exercise: ex,
        targetSkillId: 'unknown',
      }));
    }

    return parsed as BufferedExercise[];
  } catch {
    console.warn('[ExerciseBuffer] Failed to load buffer from storage');
    return [];
  }
}

async function saveBuffer(buffer: BufferedExercise[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(buffer));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the next exercise targeting a specific skill.
 * Scans the buffer for the first match and removes it. Falls back to
 * `getNextExercise()` (any skill) if no match is found.
 */
export async function getNextExerciseForSkill(
  skillId: string
): Promise<AIExercise | null> {
  try {
    const buffer = await loadBuffer();
    const index = buffer.findIndex((b) => b.targetSkillId === skillId);
    if (index === -1) {
      // No skill match — return null so caller uses template fallback.
      // Previously fell back to getNextExercise() (any skill), causing
      // mismatched titles/notes when a different-skill exercise was served.
      return null;
    }

    const [entry] = buffer.splice(index, 1);
    await saveBuffer(buffer);
    return entry.exercise;
  } catch (error) {
    console.warn(
      '[ExerciseBuffer] Failed to get exercise for skill:',
      (error as Error)?.message ?? error
    );
    return null;
  }
}

/**
 * Get next exercise from buffer (FIFO — dequeue from front).
 * Returns null if the buffer is empty.
 */
export async function getNextExercise(): Promise<AIExercise | null> {
  try {
    const buffer = await loadBuffer();
    if (buffer.length === 0) {
      return null;
    }

    const entry = buffer.shift()!;
    await saveBuffer(buffer);
    return entry.exercise;
  } catch (error) {
    console.warn(
      '[ExerciseBuffer] Failed to get next exercise:',
      (error as Error)?.message ?? error
    );
    return null;
  }
}

/**
 * Add an exercise to the back of the buffer.
 * If the buffer exceeds BUFFER_MAX_SIZE, the oldest exercises are evicted.
 */
export async function addExercise(
  exercise: AIExercise,
  targetSkillId: string = 'unknown'
): Promise<void> {
  try {
    const buffer = await loadBuffer();
    buffer.push({ exercise, targetSkillId });

    // Trim from front if we exceed the max
    while (buffer.length > BUFFER_MAX_SIZE) {
      buffer.shift();
    }

    await saveBuffer(buffer);
  } catch (error) {
    console.warn(
      '[ExerciseBuffer] Failed to add exercise:',
      (error as Error)?.message ?? error
    );
  }
}

/**
 * Get current buffer size.
 */
export async function getBufferSize(): Promise<number> {
  const buffer = await loadBuffer();
  return buffer.length;
}

/**
 * Fill buffer up to target size using AI generation.
 * Silently handles failures (null results from generateExercise).
 */
export async function fillBuffer(params: GenerationParams): Promise<void> {
  try {
    const buffer = await loadBuffer();
    let currentSize = buffer.length;
    const skillId = params.targetSkillId ?? 'unknown';

    while (currentSize < BUFFER_TARGET) {
      try {
        const exercise = await generateExercise(params);
        if (exercise) {
          buffer.push({ exercise, targetSkillId: skillId });
          currentSize++;
        } else {
          // Generation returned null — skip but keep trying
          currentSize++; // Prevent infinite loop
        }
      } catch {
        console.warn('[ExerciseBuffer] Single generation attempt failed, continuing');
        currentSize++; // Prevent infinite loop
      }
    }

    await saveBuffer(buffer);
  } catch (error) {
    console.warn(
      '[ExerciseBuffer] Failed to fill buffer:',
      (error as Error)?.message ?? error
    );
  }
}

/**
 * Fill the buffer with exercises for specific skills. Used to pre-generate
 * exercises targeting the learner's next 2-3 skills so they're ready when
 * the CurriculumEngine assigns them.
 */
export async function fillBufferForSkills(
  requests: SkillBufferRequest[]
): Promise<void> {
  try {
    const buffer = await loadBuffer();

    for (const req of requests) {
      const count = req.count ?? 1;
      for (let i = 0; i < count; i++) {
        if (buffer.length >= BUFFER_MAX_SIZE) break;

        try {
          const exercise = await generateExercise(req.params);
          if (exercise) {
            buffer.push({ exercise, targetSkillId: req.skillId });
          }
        } catch {
          console.warn(
            `[ExerciseBuffer] Failed to generate for skill ${req.skillId}, skipping`
          );
        }
      }
    }

    await saveBuffer(buffer);
  } catch (error) {
    console.warn(
      '[ExerciseBuffer] Failed to fill buffer for skills:',
      (error as Error)?.message ?? error
    );
  }
}

/**
 * Pre-fill buffer with exercises for the first 3 skill nodes (tier 1).
 * Called once after onboarding to ensure first-time users have exercises
 * ready even if Gemini generation is slow.
 */
export async function prefillOnboardingBuffer(): Promise<void> {
  const ONBOARDING_SKILLS = ['find-middle-c', 'keyboard-geography', 'white-keys'];

  const requests: SkillBufferRequest[] = ONBOARDING_SKILLS
    .map((skillId): SkillBufferRequest | null => {
      const hints = getGenerationHints(skillId);
      if (!hints) return null;
      return {
        skillId,
        params: {
          weakNotes: [] as number[],
          tempoRange: { min: 50, max: 65 },
          difficulty: 1,
          noteCount: 8,
          skills: { timingAccuracy: 0.5, pitchAccuracy: 0.5, sightReadSpeed: 0.5, chordRecognition: 0.5 },
          targetSkillId: skillId,
          generationHints: hints,
        },
        count: 1,
      };
    })
    .filter((r): r is SkillBufferRequest => r !== null);

  if (requests.length > 0) {
    await fillBufferForSkills(requests);
  }
}

/**
 * Clear entire buffer.
 */
export async function clearBuffer(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn(
      '[ExerciseBuffer] Failed to clear buffer:',
      (error as Error)?.message ?? error
    );
  }
}
