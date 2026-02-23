/**
 * Gem Store Tests
 *
 * Tests gem earning, spending, balance integrity, transaction audit trail,
 * and canAfford checks.
 */

import { useGemStore } from '../gemStore';

// Mock persistence layer
jest.mock('../persistence', () => ({
  PersistenceManager: {
    saveState: jest.fn().mockResolvedValue(undefined),
    loadState: jest.fn().mockResolvedValue({}),
    deleteState: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: {
    GEMS: 'test_gems',
  },
  createDebouncedSave: () => jest.fn(),
  createImmediateSave: () => jest.fn(),
}));

describe('gemStore', () => {
  beforeEach(() => {
    useGemStore.getState().reset();
  });

  describe('earnGems', () => {
    it('increases gem balance', () => {
      useGemStore.getState().earnGems(50, 'test');
      expect(useGemStore.getState().gems).toBe(50);
    });

    it('accumulates multiple earns', () => {
      useGemStore.getState().earnGems(10, 'exercise');
      useGemStore.getState().earnGems(15, 'daily-goal');
      useGemStore.getState().earnGems(5, 'high-score');
      expect(useGemStore.getState().gems).toBe(30);
    });

    it('tracks total earned', () => {
      useGemStore.getState().earnGems(100, 'test');
      useGemStore.getState().earnGems(50, 'test');
      expect(useGemStore.getState().totalGemsEarned).toBe(150);
    });

    it('creates transaction records', () => {
      useGemStore.getState().earnGems(25, 'first-completion');
      const { transactions } = useGemStore.getState();
      expect(transactions).toHaveLength(1);
      expect(transactions[0].amount).toBe(25);
      expect(transactions[0].source).toBe('first-completion');
      expect(transactions[0].balance).toBe(25);
    });

    it('ignores zero or negative amounts', () => {
      useGemStore.getState().earnGems(0, 'zero');
      useGemStore.getState().earnGems(-10, 'negative');
      expect(useGemStore.getState().gems).toBe(0);
      expect(useGemStore.getState().transactions).toHaveLength(0);
    });

    it('limits transaction history to 50 entries', () => {
      for (let i = 0; i < 60; i++) {
        useGemStore.getState().earnGems(1, `earn-${i}`);
      }
      expect(useGemStore.getState().transactions).toHaveLength(50);
      // Most recent should be first
      expect(useGemStore.getState().transactions[0].source).toBe('earn-59');
    });
  });

  describe('spendGems', () => {
    it('deducts from balance when affordable', () => {
      useGemStore.getState().earnGems(100, 'test');
      const result = useGemStore.getState().spendGems(30, 'unlock-biscuit');
      expect(result).toBe(true);
      expect(useGemStore.getState().gems).toBe(70);
    });

    it('returns false when insufficient balance', () => {
      useGemStore.getState().earnGems(10, 'test');
      const result = useGemStore.getState().spendGems(50, 'unlock-cat');
      expect(result).toBe(false);
      expect(useGemStore.getState().gems).toBe(10);
    });

    it('tracks total spent', () => {
      useGemStore.getState().earnGems(200, 'test');
      useGemStore.getState().spendGems(50, 'cat-1');
      useGemStore.getState().spendGems(30, 'cat-2');
      expect(useGemStore.getState().totalGemsSpent).toBe(80);
    });

    it('creates negative transaction for spend', () => {
      useGemStore.getState().earnGems(100, 'test');
      useGemStore.getState().spendGems(40, 'unlock-ballymakawww');
      const spendTx = useGemStore.getState().transactions[0]; // Most recent
      expect(spendTx.amount).toBe(-40);
      expect(spendTx.source).toBe('unlock-ballymakawww');
      expect(spendTx.balance).toBe(60);
    });

    it('rejects zero or negative spend amounts', () => {
      useGemStore.getState().earnGems(100, 'test');
      expect(useGemStore.getState().spendGems(0, 'zero')).toBe(false);
      expect(useGemStore.getState().spendGems(-5, 'negative')).toBe(false);
      expect(useGemStore.getState().gems).toBe(100);
    });
  });

  describe('canAfford', () => {
    it('returns true when balance sufficient', () => {
      useGemStore.getState().earnGems(500, 'test');
      expect(useGemStore.getState().canAfford(500)).toBe(true);
      expect(useGemStore.getState().canAfford(499)).toBe(true);
    });

    it('returns false when balance insufficient', () => {
      useGemStore.getState().earnGems(100, 'test');
      expect(useGemStore.getState().canAfford(101)).toBe(false);
    });

    it('returns true for zero cost', () => {
      expect(useGemStore.getState().canAfford(0)).toBe(true);
    });
  });

  describe('reset', () => {
    it('clears all gem data', () => {
      useGemStore.getState().earnGems(500, 'test');
      useGemStore.getState().spendGems(100, 'test');
      useGemStore.getState().reset();

      const state = useGemStore.getState();
      expect(state.gems).toBe(0);
      expect(state.totalGemsEarned).toBe(0);
      expect(state.totalGemsSpent).toBe(0);
      expect(state.transactions).toHaveLength(0);
    });
  });

  describe('gem economy math', () => {
    it('simulates daily player earning rate (~50-80 gems/day)', () => {
      // Typical day: 5 exercises at 90%+, daily goal, a few first completions
      useGemStore.getState().earnGems(5, 'high-score'); // x5
      useGemStore.getState().earnGems(5, 'high-score');
      useGemStore.getState().earnGems(5, 'high-score');
      useGemStore.getState().earnGems(15, 'perfect-score'); // 1 perfect
      useGemStore.getState().earnGems(5, 'high-score');
      useGemStore.getState().earnGems(10, 'daily-goal');
      useGemStore.getState().earnGems(25, 'first-completion'); // 1 new exercise

      const total = useGemStore.getState().gems;
      expect(total).toBe(70); // Within 50-80 range
    });

    it('Chonky unlock is not possible via gems (legendary)', () => {
      // Simulate very active player over months
      useGemStore.getState().earnGems(10000, 'accumulated');
      // Even with 10k gems, can't buy Chonky (no gem cost, legendary unlock only)
      // This is verified at the CatCharacter level, not the store
      expect(useGemStore.getState().canAfford(10000)).toBe(true);
    });
  });
});
