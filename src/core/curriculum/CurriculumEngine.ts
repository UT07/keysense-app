/**
 * CurriculumEngine — AI-powered session planner
 *
 * Takes a LearnerProfile + mastered skills → generates a daily session plan
 * with warm-up, lesson, and challenge exercises. Replaces static lesson
 * ordering with dynamic, adaptive paths.
 *
 * Pure TypeScript — no React imports.
 */

import type { LearnerProfileData } from '../../stores/learnerProfileStore';
import {
  SKILL_TREE,
  getAvailableSkills,
  getSkillById,
  getSkillDepth,
  type SkillNode,
} from './SkillTree';
import { getExercise, getLessons, getLessonExercises } from '../../content/ContentLoader';

// ============================================================================
// Types
// ============================================================================

export interface ExerciseRef {
  exerciseId: string;
  source: 'static' | 'ai';
  skillNodeId: string;
  reason: string;
}

export interface SessionPlan {
  warmUp: ExerciseRef[];
  lesson: ExerciseRef[];
  challenge: ExerciseRef[];
  reasoning: string[];
}

// ============================================================================
// Session Plan Generation
// ============================================================================

/**
 * Generate a practice session plan based on the learner's current profile
 * and mastered skills.
 *
 * Structure:
 * - Warm-up (1-2 exercises): targets weakest notes or recently learned skills
 * - Lesson (2-3 exercises): next unmastered skill node's exercises
 * - Challenge (1 exercise): slightly above comfort zone
 */
export function generateSessionPlan(
  profile: LearnerProfileData,
  masteredSkills: string[]
): SessionPlan {
  const reasoning: string[] = [];
  const warmUp = generateWarmUp(profile, masteredSkills, reasoning);
  const lesson = generateLesson(profile, masteredSkills, reasoning);
  const challenge = generateChallenge(profile, masteredSkills, reasoning);

  return { warmUp, lesson, challenge, reasoning };
}

/**
 * Get the next skill the learner should work on.
 * Uses BFS through the skill tree, prioritizing lower-depth nodes.
 */
export function getNextSkillToLearn(masteredSkills: string[]): SkillNode | null {
  const available = getAvailableSkills(masteredSkills);
  if (available.length === 0) return null;

  // Sort by depth (shallowest first), then by category priority
  const categoryPriority: Record<string, number> = {
    'note-finding': 0,
    intervals: 1,
    rhythm: 2,
    scales: 3,
    chords: 4,
    'hand-independence': 5,
    songs: 6,
  };

  return available.sort((a, b) => {
    const depthDiff = getSkillDepth(a.id) - getSkillDepth(b.id);
    if (depthDiff !== 0) return depthDiff;
    return (categoryPriority[a.category] ?? 99) - (categoryPriority[b.category] ?? 99);
  })[0];
}

/**
 * Check if a static anchor lesson should be unlocked based on mastered skills.
 * Anchor lessons are milestone lessons (1-6) that serve as checkpoints.
 */
export function shouldUnlockAnchorLesson(
  _profile: LearnerProfileData,
  masteredSkills: string[]
): string | null {
  const lessonPrereqs: Record<string, string[]> = {
    'lesson-01': [],
    'lesson-02': ['find-middle-c', 'keyboard-geography', 'white-keys'],
    'lesson-03': ['rh-cde', 'rh-cdefg'],
    'lesson-04': ['c-position-review', 'lh-scale-descending', 'steady-bass'],
    'lesson-05': ['both-hands-review'],
    'lesson-06': ['scale-review', 'both-hands-review'],
  };

  const masteredSet = new Set(masteredSkills);
  const lessons = getLessons();

  for (const lesson of lessons) {
    const prereqs = lessonPrereqs[lesson.id] ?? [];
    const allMet = prereqs.every((p) => masteredSet.has(p));
    if (allMet) {
      // Check if the lesson has unmastered exercises
      const exercises = getLessonExercises(lesson.id);
      const hasUnmastered = exercises.some((ex) => {
        const skillNodes = SKILL_TREE.filter((n) =>
          n.targetExerciseIds.includes(ex.id)
        );
        return skillNodes.some((n) => !masteredSet.has(n.id));
      });
      if (hasUnmastered) return lesson.id;
    }
  }
  return null;
}

// ============================================================================
// Internal Generators
// ============================================================================

function generateWarmUp(
  profile: LearnerProfileData,
  masteredSkills: string[],
  reasoning: string[]
): ExerciseRef[] {
  const refs: ExerciseRef[] = [];

  // Strategy 1: Target weak notes with exercises from mastered skills
  if (profile.weakNotes.length > 0) {
    const weakNoteExercise = findExerciseForWeakNotes(profile.weakNotes, masteredSkills);
    if (weakNoteExercise) {
      refs.push(weakNoteExercise);
      reasoning.push(
        `Warm-up targets weak notes: MIDI ${profile.weakNotes.slice(0, 3).join(', ')}`
      );
    }
  }

  // Strategy 2: Review a recently mastered skill
  if (refs.length < 2 && masteredSkills.length > 0) {
    const recentSkillId = masteredSkills[masteredSkills.length - 1];
    const recentSkill = getSkillById(recentSkillId);
    if (recentSkill && recentSkill.targetExerciseIds.length > 0) {
      const exerciseId = recentSkill.targetExerciseIds[0];
      if (getExercise(exerciseId) && !refs.some((r) => r.exerciseId === exerciseId)) {
        refs.push({
          exerciseId,
          source: 'static',
          skillNodeId: recentSkillId,
          reason: `Review recently learned: ${recentSkill.name}`,
        });
        reasoning.push(`Warm-up reviews recent skill: ${recentSkill.name}`);
      }
    }
  }

  // Fallback: use first exercise if nothing else
  if (refs.length === 0) {
    refs.push({
      exerciseId: 'lesson-01-ex-01',
      source: 'static',
      skillNodeId: 'find-middle-c',
      reason: 'Basic warm-up: Find Middle C',
    });
    reasoning.push('Warm-up fallback: Find Middle C');
  }

  return refs;
}

function generateLesson(
  _profile: LearnerProfileData,
  masteredSkills: string[],
  reasoning: string[]
): ExerciseRef[] {
  const refs: ExerciseRef[] = [];
  const nextSkill = getNextSkillToLearn(masteredSkills);

  if (!nextSkill) {
    reasoning.push('All skills mastered — lesson uses AI-generated exercises');
    refs.push({
      exerciseId: 'ai-generated',
      source: 'ai',
      skillNodeId: 'review',
      reason: 'All skills mastered, generating review exercise',
    });
    return refs;
  }

  reasoning.push(`Lesson focuses on: ${nextSkill.name} (${nextSkill.category})`);

  // Add all static exercises for this skill
  for (const exerciseId of nextSkill.targetExerciseIds) {
    if (getExercise(exerciseId)) {
      refs.push({
        exerciseId,
        source: 'static',
        skillNodeId: nextSkill.id,
        reason: `Learn: ${nextSkill.name}`,
      });
    }
  }

  // If the skill has few exercises, also add from parallel available skills
  if (refs.length < 2) {
    const available = getAvailableSkills(masteredSkills);
    const parallel = available.find(
      (s) => s.id !== nextSkill.id && s.targetExerciseIds.length > 0
    );
    if (parallel) {
      const exerciseId = parallel.targetExerciseIds[0];
      if (getExercise(exerciseId)) {
        refs.push({
          exerciseId,
          source: 'static',
          skillNodeId: parallel.id,
          reason: `Also working on: ${parallel.name}`,
        });
        reasoning.push(`Parallel skill added: ${parallel.name}`);
      }
    }
  }

  // If still no exercises, request AI generation
  if (refs.length === 0) {
    refs.push({
      exerciseId: 'ai-generated',
      source: 'ai',
      skillNodeId: nextSkill.id,
      reason: `AI exercise for: ${nextSkill.name}`,
    });
    reasoning.push(`No static exercises for ${nextSkill.name} — requesting AI generation`);
  }

  return refs;
}

function generateChallenge(
  profile: LearnerProfileData,
  masteredSkills: string[],
  reasoning: string[]
): ExerciseRef[] {
  const refs: ExerciseRef[] = [];

  // Find a skill slightly above current level
  const available = getAvailableSkills(masteredSkills);
  const deeper = available
    .filter((s) => s.targetExerciseIds.length > 0)
    .sort((a, b) => getSkillDepth(b.id) - getSkillDepth(a.id));

  if (deeper.length > 0) {
    const challengeSkill = deeper[0];
    const exerciseId = challengeSkill.targetExerciseIds[0];
    if (getExercise(exerciseId)) {
      refs.push({
        exerciseId,
        source: 'static',
        skillNodeId: challengeSkill.id,
        reason: `Challenge: ${challengeSkill.name}`,
      });
      reasoning.push(`Challenge targets advanced skill: ${challengeSkill.name}`);
    }
  }

  // Fallback: AI-generated challenge at higher tempo
  if (refs.length === 0) {
    const tempoStr = `${profile.tempoRange.max + 10} BPM`;
    refs.push({
      exerciseId: 'ai-generated',
      source: 'ai',
      skillNodeId: 'tempo-challenge',
      reason: `Tempo challenge at ${tempoStr}`,
    });
    reasoning.push(`Challenge: AI exercise at elevated tempo (${tempoStr})`);
  }

  return refs;
}

// ============================================================================
// Helpers
// ============================================================================

function findExerciseForWeakNotes(
  weakNotes: number[],
  masteredSkills: string[]
): ExerciseRef | null {
  // Look for exercises from mastered skills that contain weak notes
  for (const skillId of [...masteredSkills].reverse()) {
    const skill = getSkillById(skillId);
    if (!skill) continue;

    for (const exerciseId of skill.targetExerciseIds) {
      const exercise = getExercise(exerciseId);
      if (!exercise) continue;

      const exerciseNotes = new Set(exercise.notes.map((n) => n.note));
      const hasWeakNote = weakNotes.some((wn) => exerciseNotes.has(wn));
      if (hasWeakNote) {
        return {
          exerciseId,
          source: 'static',
          skillNodeId: skillId,
          reason: `Strengthens weak notes in ${skill.name}`,
        };
      }
    }
  }
  return null;
}
