/**
 * Tests for tier mastery test utilities
 */

import {
  getTierMasteryTestSkillId,
  isTierMasteryTestAvailable,
  hasTierMasteryTestPassed,
  STATIC_LESSON_TIERS,
} from '../tierMasteryTest';
import { SKILL_TREE } from '../SkillTree';

describe('tierMasteryTest', () => {
  describe('getTierMasteryTestSkillId', () => {
    it('returns a skill ID for each tier 1-15', () => {
      for (let tier = 1; tier <= 15; tier++) {
        const skillId = getTierMasteryTestSkillId(tier);
        expect(skillId).not.toBeNull();
        // The returned skill should actually be in the specified tier
        const skill = SKILL_TREE.find((s) => s.id === skillId);
        expect(skill).toBeDefined();
        expect(skill!.tier).toBe(tier);
      }
    });

    it('returns the last (most advanced) skill in the tier', () => {
      for (let tier = 1; tier <= 15; tier++) {
        const tierSkills = SKILL_TREE.filter((s) => s.tier === tier);
        if (tierSkills.length === 0) continue;
        const expected = tierSkills[tierSkills.length - 1].id;
        expect(getTierMasteryTestSkillId(tier)).toBe(expected);
      }
    });

    it('returns null for a tier with no skills', () => {
      expect(getTierMasteryTestSkillId(99)).toBeNull();
    });
  });

  describe('isTierMasteryTestAvailable', () => {
    it('returns false when no skills are mastered', () => {
      expect(isTierMasteryTestAvailable(1, [])).toBe(false);
    });

    it('returns false when only some skills in tier are mastered', () => {
      const tier1Skills = SKILL_TREE.filter((s) => s.tier === 1);
      if (tier1Skills.length <= 1) return; // Skip if tier 1 has only 1 skill
      // Master all but the last skill
      const partialMastery = tier1Skills.slice(0, -1).map((s) => s.id);
      expect(isTierMasteryTestAvailable(1, partialMastery)).toBe(false);
    });

    it('returns true when ALL skills in tier are mastered', () => {
      const tier1Skills = SKILL_TREE.filter((s) => s.tier === 1);
      const allMastered = tier1Skills.map((s) => s.id);
      expect(isTierMasteryTestAvailable(1, allMastered)).toBe(true);
    });

    it('returns true even when extra skills from other tiers are mastered', () => {
      const tier1Skills = SKILL_TREE.filter((s) => s.tier === 1);
      const tier2Skills = SKILL_TREE.filter((s) => s.tier === 2);
      const allMastered = [...tier1Skills, ...tier2Skills].map((s) => s.id);
      expect(isTierMasteryTestAvailable(1, allMastered)).toBe(true);
      expect(isTierMasteryTestAvailable(2, allMastered)).toBe(true);
    });

    it('returns false for a tier with no skills', () => {
      expect(isTierMasteryTestAvailable(99, [])).toBe(false);
    });

    it('works for all 15 tiers with full mastery', () => {
      const allSkillIds = SKILL_TREE.map((s) => s.id);
      for (let tier = 1; tier <= 15; tier++) {
        expect(isTierMasteryTestAvailable(tier, allSkillIds)).toBe(true);
      }
    });
  });

  describe('hasTierMasteryTestPassed', () => {
    it('returns false when no test results exist', () => {
      expect(hasTierMasteryTestPassed(1, {})).toBe(false);
    });

    it('returns false when the test was attempted but not passed', () => {
      expect(
        hasTierMasteryTestPassed(1, {
          'tier-1': { passed: false, score: 50, attempts: 1 },
        }),
      ).toBe(false);
    });

    it('returns true when the test was passed', () => {
      expect(
        hasTierMasteryTestPassed(1, {
          'tier-1': { passed: true, score: 85, attempts: 2 },
        }),
      ).toBe(true);
    });

    it('returns false for a different tier', () => {
      expect(
        hasTierMasteryTestPassed(2, {
          'tier-1': { passed: true, score: 85, attempts: 1 },
        }),
      ).toBe(false);
    });

    it('works for all 15 tiers', () => {
      const results: Record<string, { passed: boolean; score: number; attempts: number }> = {};
      for (let tier = 1; tier <= 15; tier++) {
        results[`tier-${tier}`] = { passed: true, score: 90, attempts: 1 };
      }
      for (let tier = 1; tier <= 15; tier++) {
        expect(hasTierMasteryTestPassed(tier, results)).toBe(true);
      }
    });
  });

  describe('STATIC_LESSON_TIERS', () => {
    it('is 6 (tiers 1-6 have static lessons)', () => {
      expect(STATIC_LESSON_TIERS).toBe(6);
    });
  });
});
