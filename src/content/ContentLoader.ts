/**
 * Content Loader
 * Static registry for exercise and lesson JSON content.
 * Metro requires static require() strings — no dynamic imports.
 */

import type { Exercise } from '../core/exercises/types';

// ============================================================================
// Lesson manifest type (matches content/lessons/*.json structure)
// ============================================================================

export interface LessonManifest {
  id: string;
  version: number;
  metadata: {
    title: string;
    description: string;
    difficulty: 1 | 2 | 3 | 4 | 5;
    estimatedMinutes: number;
    skills: string[];
  };
  exercises: Array<{
    id: string;
    title: string;
    order: number;
    required: boolean;
  }>;
  unlockRequirement: {
    type: string;
    lessonId: string;
  } | null;
  xpReward: number;
  estimatedMinutes: number;
}

// ============================================================================
// Static exercise registry (Metro-compatible)
// ============================================================================

const EXERCISE_REGISTRY: Record<string, Exercise> = {
  // Lesson 01
  'lesson-01-ex-01': require('../../content/exercises/lesson-01/exercise-01-find-middle-c.json'),
  'lesson-01-ex-02': require('../../content/exercises/lesson-01/exercise-02-keyboard-geography.json'),
  'lesson-01-ex-03': require('../../content/exercises/lesson-01/exercise-03-white-keys.json'),

  // Lesson 02
  'lesson-02-ex-01': require('../../content/exercises/lesson-02/exercise-01-cde-simple.json'),
  'lesson-02-ex-02': require('../../content/exercises/lesson-02/exercise-02-cdefg.json'),
  'lesson-02-ex-03': require('../../content/exercises/lesson-02/exercise-03-c-major-octave.json'),
  'lesson-02-ex-04': require('../../content/exercises/lesson-02/exercise-04-mary-snippet.json'),
  'lesson-02-ex-05': require('../../content/exercises/lesson-02/exercise-05-broken-c-chord.json'),
  'lesson-02-ex-06': require('../../content/exercises/lesson-02/exercise-06-twinkle-twinkle.json'),
  'lesson-02-ex-07': require('../../content/exercises/lesson-02/exercise-07-eighth-note-drill.json'),
  'lesson-02-ex-08': require('../../content/exercises/lesson-02/exercise-08-c-position-review.json'),

  // Lesson 03
  'lesson-03-ex-01': require('../../content/exercises/lesson-03/exercise-01-left-c-position.json'),
  'lesson-03-ex-02': require('../../content/exercises/lesson-03/exercise-02-left-scale-down.json'),
  'lesson-03-ex-03': require('../../content/exercises/lesson-03/exercise-03-bass-notes.json'),
  'lesson-03-ex-04': require('../../content/exercises/lesson-03/exercise-04-broken-f-chord-left.json'),
  'lesson-03-ex-05': require('../../content/exercises/lesson-03/exercise-05-steady-bass-pattern.json'),

  // Lesson 04
  'lesson-04-ex-01': require('../../content/exercises/lesson-04/exercise-01-hands-melody-bass.json'),
  'lesson-04-ex-02': require('../../content/exercises/lesson-04/exercise-02-mary-full-version.json'),
  'lesson-04-ex-03': require('../../content/exercises/lesson-04/exercise-03-hand-independence-drill.json'),
  'lesson-04-ex-04': require('../../content/exercises/lesson-04/exercise-04-ode-to-joy-intro.json'),
  'lesson-04-ex-05': require('../../content/exercises/lesson-04/exercise-05-blocked-c-f-chords.json'),
  'lesson-04-ex-06': require('../../content/exercises/lesson-04/exercise-06-both-hands-review.json'),

  // Lesson 05
  'lesson-05-ex-01': require('../../content/exercises/lesson-05/exercise-01-scale-technique.json'),
  'lesson-05-ex-02': require('../../content/exercises/lesson-05/exercise-02-parallel-scales.json'),
  'lesson-05-ex-03': require('../../content/exercises/lesson-05/exercise-03-scale-speed-drill.json'),
  'lesson-05-ex-04': require('../../content/exercises/lesson-05/exercise-04-scale-review.json'),

  // Lesson 06
  'lesson-06-ex-01': require('../../content/exercises/lesson-06/exercise-01-jingle-bells.json'),
  'lesson-06-ex-02': require('../../content/exercises/lesson-06/exercise-02-happy-birthday.json'),
  'lesson-06-ex-03': require('../../content/exercises/lesson-06/exercise-03-amazing-grace.json'),
  'lesson-06-ex-04': require('../../content/exercises/lesson-06/exercise-04-let-it-go-snippet.json'),
};

// ============================================================================
// Static lesson registry
// ============================================================================

const LESSON_REGISTRY: Record<string, LessonManifest> = {
  'lesson-01': require('../../content/lessons/lesson-01.json'),
  'lesson-02': require('../../content/lessons/lesson-02.json'),
  'lesson-03': require('../../content/lessons/lesson-03.json'),
  'lesson-04': require('../../content/lessons/lesson-04.json'),
  'lesson-05': require('../../content/lessons/lesson-05.json'),
  'lesson-06': require('../../content/lessons/lesson-06.json'),
};

// Ordered list of lesson IDs (determines display order)
const LESSON_ORDER = [
  'lesson-01',
  'lesson-02',
  'lesson-03',
  'lesson-04',
  'lesson-05',
  'lesson-06',
];

// ============================================================================
// Public API
// ============================================================================

export function getExercise(exerciseId: string): Exercise | null {
  return EXERCISE_REGISTRY[exerciseId] ?? null;
}

export function getLessons(): LessonManifest[] {
  return LESSON_ORDER.map((id) => LESSON_REGISTRY[id]).filter(Boolean);
}

export function getLesson(lessonId: string): LessonManifest | null {
  return LESSON_REGISTRY[lessonId] ?? null;
}

export function getLessonExercises(lessonId: string): Exercise[] {
  const lesson = LESSON_REGISTRY[lessonId];
  if (!lesson) return [];

  return lesson.exercises
    .sort((a, b) => a.order - b.order)
    .map((entry) => EXERCISE_REGISTRY[entry.id])
    .filter(Boolean);
}

export function getNextExerciseId(
  lessonId: string,
  currentExerciseId: string
): string | null {
  const lesson = LESSON_REGISTRY[lessonId];
  if (!lesson) return null;

  const sorted = [...lesson.exercises].sort((a, b) => a.order - b.order);
  const currentIndex = sorted.findIndex((e) => e.id === currentExerciseId);
  if (currentIndex === -1 || currentIndex >= sorted.length - 1) return null;

  return sorted[currentIndex + 1].id;
}

export function getLessonIdForExercise(exerciseId: string): string | null {
  for (const [lessonId, lesson] of Object.entries(LESSON_REGISTRY)) {
    if (lesson.exercises.some((e) => e.id === exerciseId)) {
      return lessonId;
    }
  }
  return null;
}
