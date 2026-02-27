import { getChestType, getChestReward, type ChestType } from '../chestSystem';

describe('chestSystem', () => {
  describe('getChestType', () => {
    it('returns epic chest for 3-star first completion', () => {
      expect(getChestType(3, true)).toBe('epic');
    });

    it('returns rare chest for 3-star repeat', () => {
      expect(getChestType(3, false)).toBe('rare');
    });

    it('returns common chest for 2-star first completion', () => {
      expect(getChestType(2, true)).toBe('common');
    });

    it('returns common chest for 2-star repeat', () => {
      expect(getChestType(2, false)).toBe('common');
    });

    it('returns none for 1 star', () => {
      expect(getChestType(1, true)).toBe('none');
    });

    it('returns none for 0 stars', () => {
      expect(getChestType(0, false)).toBe('none');
    });
  });

  describe('getChestReward', () => {
    it('epic chest gives 25 gems + catXpBoost', () => {
      const reward = getChestReward('epic');
      expect(reward.gems).toBe(25);
      expect(reward.catXpBoost).toBe(true);
    });

    it('rare chest gives 10 gems', () => {
      const reward = getChestReward('rare');
      expect(reward.gems).toBe(10);
      expect(reward.catXpBoost).toBe(false);
    });

    it('common chest gives 5 gems', () => {
      const reward = getChestReward('common');
      expect(reward.gems).toBe(5);
      expect(reward.catXpBoost).toBe(false);
    });

    it('none gives 0 gems', () => {
      const reward = getChestReward('none');
      expect(reward.gems).toBe(0);
      expect(reward.catXpBoost).toBe(false);
    });
  });

  describe('types', () => {
    it('ChestType includes all expected values', () => {
      const types: ChestType[] = ['none', 'common', 'rare', 'epic'];
      expect(types).toHaveLength(4);
    });
  });
});
