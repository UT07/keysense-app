/**
 * Integration Test: Adaptive Learning Flow
 *
 * Tests the full adaptive learning pipeline:
 * - CurriculumEngine session planning based on learner profile
 * - LearnerProfileStore updates from exercise results
 * - Skill mastery progression through the SkillTree
 * - Session plan adaptation as profile changes
 */

import { generateSessionPlan, getNextSkillToLearn } from '../../core/curriculum/CurriculumEngine';
import { getAvailableSkills, SKILL_TREE } from '../../core/curriculum/SkillTree';
import { useLearnerProfileStore } from '../../stores/learnerProfileStore';
import type { LearnerProfileData } from '../../stores/learnerProfileStore';

// Mock ContentLoader — returns minimal Exercise objects for static exercises
jest.mock('../../content/ContentLoader', () => {
  const mockExercise = (id: string) => ({
    id,
    version: 1,
    metadata: { title: id, description: '', difficulty: 1, estimatedMinutes: 2, skills: [], prerequisites: [] },
    settings: { tempo: 60, timeSignature: [4, 4], keySignature: 'C', countIn: 4, metronomeEnabled: true },
    notes: [{ note: 60, startBeat: 0, durationBeats: 1 }],
    scoring: { timingToleranceMs: 50, timingGracePeriodMs: 150, passingScore: 70, starThresholds: [70, 85, 95] },
    hints: { beforeStart: '', commonMistakes: [], successMessage: '' },
  });

  // Build registry from SKILL_TREE exercise IDs
  const { SKILL_TREE: tree } = jest.requireActual('../../core/curriculum/SkillTree');
  const registry: Record<string, ReturnType<typeof mockExercise>> = {};
  for (const node of tree) {
    for (const eid of (node as { targetExerciseIds: string[] }).targetExerciseIds) {
      registry[eid] = mockExercise(eid);
    }
  }

  return {
    getExercise: (id: string) => registry[id] ?? null,
    getLessons: () => [
      { id: 'lesson-01', metadata: { title: 'L1' }, exercises: [{ id: 'lesson-01-ex-01', order: 1 }, { id: 'lesson-01-ex-02', order: 2 }, { id: 'lesson-01-ex-03', order: 3 }] },
      { id: 'lesson-02', metadata: { title: 'L2' }, exercises: [{ id: 'lesson-02-ex-01', order: 1 }, { id: 'lesson-02-ex-02', order: 2 }] },
      { id: 'lesson-03', metadata: { title: 'L3' }, exercises: [{ id: 'lesson-03-ex-01', order: 1 }] },
      { id: 'lesson-04', metadata: { title: 'L4' }, exercises: [{ id: 'lesson-04-ex-01', order: 1 }] },
      { id: 'lesson-05', metadata: { title: 'L5' }, exercises: [{ id: 'lesson-05-ex-01', order: 1 }] },
      { id: 'lesson-06', metadata: { title: 'L6' }, exercises: [{ id: 'lesson-06-ex-01', order: 1 }] },
    ],
    getLessonExercises: (lessonId: string) => {
      const map: Record<string, string[]> = {
        'lesson-01': ['lesson-01-ex-01', 'lesson-01-ex-02', 'lesson-01-ex-03'],
        'lesson-02': ['lesson-02-ex-01', 'lesson-02-ex-02', 'lesson-02-ex-03'],
        'lesson-03': ['lesson-03-ex-01'],
        'lesson-04': ['lesson-04-ex-01'],
        'lesson-05': ['lesson-05-ex-01'],
        'lesson-06': ['lesson-06-ex-01'],
      };
      return (map[lessonId] ?? []).map((id) => registry[id]).filter(Boolean);
    },
    isPostCurriculum: () => false,
  };
});

function makeProfile(overrides: Partial<LearnerProfileData> = {}): LearnerProfileData {
  return {
    noteAccuracy: {},
    noteAttempts: {},
    skills: { timingAccuracy: 0.5, pitchAccuracy: 0.5, sightReadSpeed: 0.5, chordRecognition: 0.5 },
    tempoRange: { min: 40, max: 80 },
    weakNotes: [],
    weakSkills: [],
    totalExercisesCompleted: 0,
    lastAssessmentDate: '',
    assessmentScore: 0,
    masteredSkills: [],
    ...overrides,
  };
}

describe('Adaptive Learning Integration', () => {
  beforeEach(() => {
    // Reset the learner profile store before each test
    useLearnerProfileStore.getState().reset();
  });

  describe('generates beginner session for new user', () => {
    it('should produce a plan with warm-up, lesson, and challenge sections', () => {
      const profile = makeProfile();
      const plan = generateSessionPlan(profile, []);

      expect(plan.warmUp.length).toBeGreaterThan(0);
      expect(plan.lesson.length).toBeGreaterThan(0);
      expect(plan.challenge.length).toBeGreaterThan(0);
      expect(plan.reasoning.length).toBeGreaterThanOrEqual(3);
    });

    it('should target the root skill node (find-middle-c) for beginners', () => {
      const nextSkill = getNextSkillToLearn([]);
      expect(nextSkill).not.toBeNull();
      expect(nextSkill!.id).toBe('find-middle-c');
      expect(nextSkill!.prerequisites).toEqual([]);
    });

    it('should include lesson-01-ex-01 in the lesson section', () => {
      const profile = makeProfile();
      const plan = generateSessionPlan(profile, []);
      const lessonExerciseIds = plan.lesson.map((r) => r.exerciseId);
      expect(lessonExerciseIds).toContain('lesson-01-ex-01');
    });
  });

  describe('adapts after exercise completion', () => {
    it('should update profile with exercise result and produce different plan', () => {
      const store = useLearnerProfileStore.getState();

      // Record a good exercise result on the first exercise
      store.recordExerciseResult({
        tempo: 60,
        score: 0.9,
        noteResults: [
          { midiNote: 60, accuracy: 0.95 },
          { midiNote: 62, accuracy: 0.88 },
          { midiNote: 64, accuracy: 0.92 },
        ],
      });

      // Verify profile updated
      const updatedState = useLearnerProfileStore.getState();
      expect(updatedState.totalExercisesCompleted).toBe(1);
      expect(updatedState.noteAccuracy[60]).toBeGreaterThan(0);

      // Now mark the first skill as mastered
      store.markSkillMastered('find-middle-c');

      // Generate two plans: before and after mastery
      const profileBefore = makeProfile();
      const planBefore = generateSessionPlan(profileBefore, []);

      const profileAfter = makeProfile({ masteredSkills: ['find-middle-c'] });
      const planAfter = generateSessionPlan(profileAfter, ['find-middle-c']);

      // Plans should differ in their lesson exercises
      const beforeExercises = planBefore.lesson.map((r) => r.exerciseId);
      const afterExercises = planAfter.lesson.map((r) => r.exerciseId);
      expect(beforeExercises).not.toEqual(afterExercises);
    });

    it('should target weak notes in warm-up when profile has weakness', () => {
      const profile = makeProfile({
        noteAccuracy: { 60: 0.4, 62: 0.3 },
        weakNotes: [60, 62],
        masteredSkills: ['find-middle-c'],
      });

      const plan = generateSessionPlan(profile, ['find-middle-c']);
      expect(plan.warmUp.length).toBeGreaterThan(0);
      // Warm-up should mention weak notes in reasoning
      const warmUpReasons = plan.reasoning.filter((r) => r.includes('Warm-up'));
      expect(warmUpReasons.length).toBeGreaterThan(0);
    });
  });

  describe('skill mastery unlocks new skills', () => {
    it('should unlock keyboard-geography after mastering find-middle-c', () => {
      const available = getAvailableSkills(['find-middle-c']);
      const availableIds = available.map((s) => s.id);
      expect(availableIds).toContain('keyboard-geography');
    });

    it('should unlock rh-cde after mastering note-finding chain', () => {
      const mastered = ['find-middle-c', 'keyboard-geography', 'white-keys'];
      const available = getAvailableSkills(mastered);
      const availableIds = available.map((s) => s.id);
      expect(availableIds).toContain('rh-cde');
      expect(availableIds).toContain('lh-c-position');
    });

    it('should not unlock skills with unmet prerequisites', () => {
      const available = getAvailableSkills(['find-middle-c']);
      const availableIds = available.map((s) => s.id);
      // rh-cde requires white-keys which requires keyboard-geography
      expect(availableIds).not.toContain('rh-cde');
      // hands-together requires deep chain
      expect(availableIds).not.toContain('hands-together-basic');
    });

    it('should return progressively deeper skills as more are mastered', () => {
      // Master level 0
      let next = getNextSkillToLearn([]);
      expect(next).not.toBeNull();
      expect(next!.id).toBe('find-middle-c');

      // Master level 1
      next = getNextSkillToLearn(['find-middle-c']);
      expect(next).not.toBeNull();
      expect(next!.id).toBe('keyboard-geography');

      // Master level 2
      next = getNextSkillToLearn(['find-middle-c', 'keyboard-geography']);
      expect(next).not.toBeNull();
      expect(next!.id).toBe('white-keys');
    });
  });

  describe('full progression through skill tree', () => {
    it('should iterate through skills until all are mastered', () => {
      const mastered: string[] = [];
      let iterations = 0;
      const maxIterations = SKILL_TREE.length + 5; // Safety limit

      while (iterations < maxIterations) {
        const next = getNextSkillToLearn(mastered);
        if (!next) break;
        mastered.push(next.id);
        iterations++;
      }

      // All skills in the tree should eventually be mastered
      const allSkillIds = SKILL_TREE.map((n) => n.id);
      for (const id of allSkillIds) {
        expect(mastered).toContain(id);
      }

      // Should have visited exactly the number of skills
      expect(mastered.length).toBe(SKILL_TREE.length);
    });

    it('should respect prerequisite ordering', () => {
      const mastered: string[] = [];
      let iterations = 0;

      while (iterations < SKILL_TREE.length + 5) {
        const next = getNextSkillToLearn(mastered);
        if (!next) break;

        // All prerequisites of this skill must already be mastered
        for (const prereq of next.prerequisites) {
          expect(mastered).toContain(prereq);
        }

        mastered.push(next.id);
        iterations++;
      }
    });
  });

  describe('handles fully mastered tree', () => {
    it('should return AI exercises in lesson when all skills are mastered', () => {
      const allMastered = SKILL_TREE.map((n) => n.id);
      const profile = makeProfile({ masteredSkills: allMastered });
      const plan = generateSessionPlan(profile, allMastered);

      // Lesson section should have AI-generated exercises
      const hasAI = plan.lesson.some((r) => r.source === 'ai');
      expect(hasAI).toBe(true);

      // Reasoning should mention all skills mastered
      const aiReasoning = plan.reasoning.find((r) => r.includes('mastered'));
      expect(aiReasoning).toBeDefined();
    });

    it('should return null from getNextSkillToLearn when all mastered', () => {
      const allMastered = SKILL_TREE.map((n) => n.id);
      expect(getNextSkillToLearn(allMastered)).toBeNull();
    });

    it('should return empty from getAvailableSkills when all mastered', () => {
      const allMastered = SKILL_TREE.map((n) => n.id);
      expect(getAvailableSkills(allMastered)).toEqual([]);
    });
  });

  describe('learnerProfileStore integration', () => {
    it('should track mastered skills across multiple calls', () => {
      const store = useLearnerProfileStore.getState();
      store.markSkillMastered('find-middle-c');
      store.markSkillMastered('keyboard-geography');

      const state = useLearnerProfileStore.getState();
      expect(state.masteredSkills).toContain('find-middle-c');
      expect(state.masteredSkills).toContain('keyboard-geography');
      expect(state.masteredSkills.length).toBe(2);
    });

    it('should not duplicate mastered skills', () => {
      const store = useLearnerProfileStore.getState();
      store.markSkillMastered('find-middle-c');
      store.markSkillMastered('find-middle-c');

      const state = useLearnerProfileStore.getState();
      expect(state.masteredSkills.length).toBe(1);
    });

    it('should recalculate weak areas after exercise result', () => {
      const store = useLearnerProfileStore.getState();
      store.recordExerciseResult({
        tempo: 60,
        score: 0.5,
        noteResults: [
          { midiNote: 60, accuracy: 0.3 },
          { midiNote: 62, accuracy: 0.4 },
          { midiNote: 64, accuracy: 0.9 },
        ],
      });

      const state = useLearnerProfileStore.getState();
      // Notes below 0.7 accuracy should be weak
      expect(state.weakNotes).toContain(60);
      expect(state.weakNotes).toContain(62);
      // Note 64 should not be weak (0.9 > 0.7)
      expect(state.weakNotes).not.toContain(64);
    });
  });
});
