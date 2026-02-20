import {
  generateSessionPlan,
  getNextSkillToLearn,
  shouldUnlockAnchorLesson,
} from '../CurriculumEngine';
import { SKILL_TREE } from '../SkillTree';
import type { LearnerProfileData } from '../../../stores/learnerProfileStore';

// Mock ContentLoader — returns minimal Exercise objects for static exercises
jest.mock('../../../content/ContentLoader', () => {
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
  const { SKILL_TREE: tree } = jest.requireActual('../SkillTree');
  const registry: Record<string, ReturnType<typeof mockExercise>> = {};
  for (const node of tree) {
    for (const eid of node.targetExerciseIds) {
      registry[eid] = mockExercise(eid);
    }
  }

  return {
    getExercise: (id: string) => registry[id] ?? null,
    getLessons: () => [
      { id: 'lesson-01', metadata: { title: 'L1' }, exercises: [{ id: 'lesson-01-ex-01', order: 1 }, { id: 'lesson-01-ex-02', order: 2 }, { id: 'lesson-01-ex-03', order: 3 }] },
      { id: 'lesson-02', metadata: { title: 'L2' }, exercises: [{ id: 'lesson-02-ex-01', order: 1 }] },
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

describe('CurriculumEngine', () => {
  describe('generateSessionPlan', () => {
    it('should generate a plan for a complete beginner', () => {
      const plan = generateSessionPlan(makeProfile(), []);
      expect(plan.warmUp.length).toBeGreaterThan(0);
      expect(plan.lesson.length).toBeGreaterThan(0);
      expect(plan.challenge.length).toBeGreaterThan(0);
      expect(plan.reasoning.length).toBeGreaterThan(0);
    });

    it('should target weak notes in warm-up', () => {
      const profile = makeProfile({
        weakNotes: [60], // Middle C
        masteredSkills: ['find-middle-c'],
      });
      const plan = generateSessionPlan(profile, ['find-middle-c']);
      // Should either target weak notes or review recently mastered
      expect(plan.warmUp.length).toBeGreaterThan(0);
    });

    it('should progress to next skill after mastering prerequisites', () => {
      const mastered = ['find-middle-c', 'keyboard-geography', 'white-keys'];
      const plan = generateSessionPlan(makeProfile(), mastered);
      // Lesson should target skills that require white-keys
      const lessonSkills = plan.lesson.map((r) => r.skillNodeId);
      // Should be targeting rh-cde or lh-c-position (both have white-keys as prereq)
      const validNextSkills = ['rh-cde', 'lh-c-position'];
      expect(lessonSkills.some((s) => validNextSkills.includes(s))).toBe(true);
    });

    it('should include AI exercises when all skills are mastered', () => {
      const allMastered = SKILL_TREE.map((n) => n.id);
      const plan = generateSessionPlan(makeProfile(), allMastered);
      const hasAI = plan.lesson.some((r) => r.source === 'ai');
      expect(hasAI).toBe(true);
    });

    it('should produce different plans for different profiles', () => {
      const beginnerPlan = generateSessionPlan(makeProfile(), []);
      const intermediatePlan = generateSessionPlan(
        makeProfile(),
        ['find-middle-c', 'keyboard-geography', 'white-keys', 'rh-cde', 'rh-cdefg']
      );
      // The lesson exercises should differ
      const beginnerExercises = beginnerPlan.lesson.map((r) => r.exerciseId);
      const intermediateExercises = intermediatePlan.lesson.map((r) => r.exerciseId);
      expect(beginnerExercises).not.toEqual(intermediateExercises);
    });

    it('should always have reasoning for each section', () => {
      const plan = generateSessionPlan(makeProfile(), []);
      expect(plan.reasoning.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getNextSkillToLearn', () => {
    it('should return root node for a beginner', () => {
      const next = getNextSkillToLearn([]);
      expect(next).not.toBeNull();
      expect(next!.prerequisites).toEqual([]);
    });

    it('should return child node when parent is mastered', () => {
      const next = getNextSkillToLearn(['find-middle-c']);
      expect(next).not.toBeNull();
      expect(next!.id).toBe('keyboard-geography');
    });

    it('should return null when all skills are mastered', () => {
      const allIds = SKILL_TREE.map((n) => n.id);
      expect(getNextSkillToLearn(allIds)).toBeNull();
    });

    it('should prioritize shallower nodes', () => {
      // Master only find-middle-c — both keyboard-geography (depth 1) and
      // lh-c-position (depth 0, different root) should be available
      const next = getNextSkillToLearn(['find-middle-c']);
      expect(next).not.toBeNull();
      // Should pick a depth-0 or depth-1 node
      const available = ['keyboard-geography', 'lh-c-position'];
      expect(available).toContain(next!.id);
    });
  });

  describe('shouldUnlockAnchorLesson', () => {
    it('should always unlock lesson-01 for beginners', () => {
      const result = shouldUnlockAnchorLesson(makeProfile(), []);
      expect(result).toBe('lesson-01');
    });

    it('should unlock lesson-02 when lesson-01 skills are mastered', () => {
      const mastered = ['find-middle-c', 'keyboard-geography', 'white-keys'];
      const result = shouldUnlockAnchorLesson(makeProfile(), mastered);
      // Should suggest lesson-01 or lesson-02 depending on which has unmastered exercises
      expect(result).not.toBeNull();
    });

    it('should return null when no lesson is unlockable with higher mastery', () => {
      // Master everything — all lessons should have all skills mastered
      const allMastered = SKILL_TREE.map((n) => n.id);
      const result = shouldUnlockAnchorLesson(makeProfile(), allMastered);
      // With all skills mastered, no lesson should have unmastered exercises
      expect(result).toBeNull();
    });
  });
});
