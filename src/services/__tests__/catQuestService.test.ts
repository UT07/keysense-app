/**
 * Cat Quest Service Tests
 * Tests quest generation, signature exercises, and deterministic daily rotation.
 */

import {
  generateDailyQuest,
  getSignatureExercise,
  getAllSignatureExercises,
} from '../catQuestService';
import type { CatQuest } from '../catQuestService';
import type { Skills } from '../../stores/types';

describe('Cat Quest Service', () => {
  describe('generateDailyQuest', () => {
    it('should generate a quest for a known cat', () => {
      const quest = generateDailyQuest('mini-meowww', [], []);
      expect(quest.catId).toBe('mini-meowww');
      expect(quest.catName).toBe('Mini Meowww');
      expect(quest.title.length).toBeGreaterThan(0);
      expect(quest.description.length).toBeGreaterThan(0);
    });

    it('should generate a weak_note quest when weak notes exist', () => {
      // Run multiple times to check that at least one targets a note
      const quests: CatQuest[] = [];
      for (const catId of ['mini-meowww', 'jazzy', 'chonky-monke', 'luna', 'biscuit', 'vinyl', 'aria', 'tempo']) {
        quests.push(generateDailyQuest(catId, [60, 62, 64], []));
      }
      const noteQuests = quests.filter(q => q.targetType === 'weak_note');
      expect(noteQuests.length).toBeGreaterThan(0);
      for (const q of noteQuests) {
        expect(q.targetValue).toBeDefined();
        expect(q.xpMultiplier).toBe(1.5);
      }
    });

    it('should generate a weak_skill quest when weak skills exist', () => {
      const weakSkills: (keyof Skills)[] = ['timingAccuracy', 'pitchAccuracy'];
      const quests: CatQuest[] = [];
      for (const catId of ['mini-meowww', 'jazzy', 'chonky-monke', 'luna', 'biscuit', 'vinyl', 'aria', 'tempo']) {
        quests.push(generateDailyQuest(catId, [], weakSkills));
      }
      const skillQuests = quests.filter(q => q.targetType === 'weak_skill');
      expect(skillQuests.length).toBeGreaterThan(0);
      for (const q of skillQuests) {
        expect(q.targetValue).toBeDefined();
        expect(q.xpMultiplier).toBe(1.5);
      }
    });

    it('should generate general quests when no weak areas', () => {
      const quest = generateDailyQuest('mini-meowww', [], []);
      expect(quest.targetType).toBe('general');
      expect(quest.xpMultiplier).toBe(1.0);
    });

    it('should handle unknown cat IDs gracefully', () => {
      const quest = generateDailyQuest('unknown-cat', [60], []);
      expect(quest.catName).toBe('Your Cat');
      expect(quest.title.length).toBeGreaterThan(0);
    });

    it('should produce consistent quests for the same day and cat', () => {
      const quest1 = generateDailyQuest('jazzy', [60, 62], ['timingAccuracy']);
      const quest2 = generateDailyQuest('jazzy', [60, 62], ['timingAccuracy']);
      expect(quest1.title).toBe(quest2.title);
      expect(quest1.description).toBe(quest2.description);
      expect(quest1.targetType).toBe(quest2.targetType);
    });

    it('should produce different quests for different cats', () => {
      const quest1 = generateDailyQuest('mini-meowww', [60], []);
      const quest2 = generateDailyQuest('tempo', [60], []);
      // Different cats should have different descriptions (same note target)
      expect(quest1.description).not.toBe(quest2.description);
    });

    it('should produce quests with all 8 cat personalities', () => {
      const catIds = ['mini-meowww', 'jazzy', 'chonky-monke', 'luna', 'biscuit', 'vinyl', 'aria', 'tempo'];
      for (const catId of catIds) {
        const quest = generateDailyQuest(catId, [], []);
        expect(quest.catId).toBe(catId);
        expect(quest.title.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getSignatureExercise', () => {
    it('should return a signature exercise for each cat', () => {
      const catIds = ['mini-meowww', 'jazzy', 'chonky-monke', 'luna', 'biscuit', 'vinyl', 'aria', 'tempo'];
      for (const catId of catIds) {
        const sig = getSignatureExercise(catId);
        expect(sig).toBeDefined();
        expect(sig!.catId).toBe(catId);
        expect(sig!.exerciseId).toMatch(/^sig-/);
        expect(sig!.title.length).toBeGreaterThan(0);
        expect(sig!.description.length).toBeGreaterThan(0);
      }
    });

    it('should return undefined for unknown cat', () => {
      expect(getSignatureExercise('unknown')).toBeUndefined();
    });
  });

  describe('getAllSignatureExercises', () => {
    it('should return 8 signature exercises', () => {
      const all = getAllSignatureExercises();
      expect(all.length).toBe(8);
    });

    it('should have unique exercise IDs', () => {
      const all = getAllSignatureExercises();
      const ids = new Set(all.map(se => se.exerciseId));
      expect(ids.size).toBe(8);
    });
  });
});
