/**
 * Integration Test: Gem Economy
 *
 * Tests the full gem economy system:
 * - Daily player earning rate (~50-80 gems/day from various sources)
 * - Earning enough for cheapest unlock (500 gems starter)
 * - Balance integrity across multiple earn/spend operations
 * - Transaction audit trail correctness
 */

// Mock Firebase (imported transitively via catEvolutionStore -> socialService)
jest.mock('../../services/firebase/config', () => ({
  auth: { currentUser: null },
  db: {},
  functions: {},
}));
jest.mock('../../services/firebase/socialService', () => ({
  postActivity: jest.fn().mockResolvedValue(undefined),
}));

import { useGemStore } from '../../stores/gemStore';
import { useCatEvolutionStore } from '../../stores/catEvolutionStore';

// Mock persistence to avoid AsyncStorage in tests
jest.mock('../../stores/persistence', () => ({
  PersistenceManager: {
    saveState: jest.fn().mockResolvedValue(undefined),
    loadState: jest.fn().mockResolvedValue({}),
    deleteState: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: {
    GEMS: 'test_gems',
    CAT_EVOLUTION: 'test_cat_evolution',
  },
  createDebouncedSave: () => jest.fn(),
  createImmediateSave: () => jest.fn(),
}));

// Mock catCharacters for evolution store
jest.mock('../../components/Mascot/catCharacters', () => ({
  CAT_CHARACTERS: [
    {
      id: 'mini-meowww',
      name: 'Mini Meowww',
      starterCat: true,
      gemCost: null,
      legendary: false,
      abilities: [],
    },
    {
      id: 'biscuit',
      name: 'Biscuit',
      starterCat: false,
      gemCost: 750,
      legendary: false,
      abilities: [],
    },
    {
      id: 'ballymakawww',
      name: 'Ballymakawww',
      starterCat: false,
      gemCost: 1000,
      legendary: false,
      abilities: [],
    },
    {
      id: 'coda',
      name: 'Coda',
      starterCat: false,
      gemCost: 3000,
      legendary: false,
      abilities: [],
    },
  ],
  getCatById: (id: string) => {
    const cats = jest.requireMock('../../components/Mascot/catCharacters').CAT_CHARACTERS;
    return cats.find((c: any) => c.id === id);
  },
}));

describe('Gem Economy Integration', () => {
  beforeEach(() => {
    useGemStore.getState().reset();
    useCatEvolutionStore.getState().reset();
  });

  describe('daily player earning rate', () => {
    it('should simulate a typical daily earning of ~50-80 gems from various sources', () => {
      const store = useGemStore.getState();

      // Exercise completions: ~5 exercises per day x 5 gems each = 25 gems
      for (let i = 0; i < 5; i++) {
        store.earnGems(5, `exercise-completion-${i}`);
      }

      // Daily goal completion: 10 gems
      useGemStore.getState().earnGems(10, 'daily-goal-complete');

      // Streak bonus: 5 gems for maintaining streak
      useGemStore.getState().earnGems(5, 'streak-bonus');

      // Daily reward calendar: average ~10 gems
      useGemStore.getState().earnGems(10, 'daily-reward');

      // Perfect score bonus: 10 gems for one perfect exercise
      useGemStore.getState().earnGems(10, 'perfect-score');

      const state = useGemStore.getState();
      const totalEarned = state.totalGemsEarned;
      expect(totalEarned).toBe(60);
      expect(totalEarned).toBeGreaterThanOrEqual(50);
      expect(totalEarned).toBeLessThanOrEqual(80);
      expect(state.gems).toBe(60);
    });

    it('should simulate a week of daily earning', () => {
      const dailyEarnings = [55, 72, 48, 65, 80, 60, 70]; // 7 days
      let expectedTotal = 0;

      for (const daily of dailyEarnings) {
        useGemStore.getState().earnGems(daily, 'daily-total');
        expectedTotal += daily;
      }

      const state = useGemStore.getState();
      expect(state.gems).toBe(expectedTotal);
      expect(state.totalGemsEarned).toBe(expectedTotal);
      expect(state.totalGemsSpent).toBe(0);
    });
  });

  describe('earning enough for cheapest unlock', () => {
    it('should accumulate 500 gems for cheapest starter cat over ~8-10 days', () => {
      // Simulate earning ~60 gems/day for 9 days (540 total)
      const DAILY_EARN = 60;
      const STARTER_COST = 500;

      for (let day = 1; day <= 9; day++) {
        useGemStore.getState().earnGems(DAILY_EARN, `day-${day}-earnings`);
      }

      const state = useGemStore.getState();
      expect(state.gems).toBe(DAILY_EARN * 9); // 540
      expect(state.canAfford(STARTER_COST)).toBe(true);

      // Purchase the starter cat
      const result = useGemStore.getState().spendGems(STARTER_COST, 'unlock-starter');
      expect(result).toBe(true);

      const afterPurchase = useGemStore.getState();
      expect(afterPurchase.gems).toBe(40); // 540 - 500
      expect(afterPurchase.totalGemsSpent).toBe(500);
    });

    it('should not be able to afford 750-gem cat until enough earned', () => {
      const BISCUIT_COST = 750;

      // Earn 600 gems
      useGemStore.getState().earnGems(600, 'test-earnings');
      expect(useGemStore.getState().canAfford(BISCUIT_COST)).toBe(false);

      // Earn 150 more
      useGemStore.getState().earnGems(150, 'more-earnings');
      expect(useGemStore.getState().canAfford(BISCUIT_COST)).toBe(true);

      // Purchase
      const result = useGemStore.getState().spendGems(BISCUIT_COST, 'unlock-biscuit');
      expect(result).toBe(true);
      expect(useGemStore.getState().gems).toBe(0);
    });

    it('should handle saving up for the most expensive cat (3000 gems)', () => {
      const CODA_COST = 3000;
      const DAILY_EARN = 65;
      const DAYS_NEEDED = Math.ceil(CODA_COST / DAILY_EARN); // ~47 days

      for (let day = 1; day <= DAYS_NEEDED; day++) {
        useGemStore.getState().earnGems(DAILY_EARN, `day-${day}`);
      }

      expect(useGemStore.getState().canAfford(CODA_COST)).toBe(true);
      const result = useGemStore.getState().spendGems(CODA_COST, 'unlock-coda');
      expect(result).toBe(true);
      expect(useGemStore.getState().gems).toBe(DAILY_EARN * DAYS_NEEDED - CODA_COST);
    });
  });

  describe('balance integrity across multiple earn/spend operations', () => {
    it('should maintain correct balance through alternating earn/spend', () => {
      const operations: Array<{ type: 'earn' | 'spend'; amount: number }> = [
        { type: 'earn', amount: 100 },
        { type: 'earn', amount: 50 },
        { type: 'spend', amount: 30 },
        { type: 'earn', amount: 75 },
        { type: 'spend', amount: 100 },
        { type: 'earn', amount: 200 },
        { type: 'spend', amount: 50 },
      ];

      let expectedBalance = 0;
      let expectedEarned = 0;
      let expectedSpent = 0;

      for (const op of operations) {
        if (op.type === 'earn') {
          useGemStore.getState().earnGems(op.amount, 'test');
          expectedBalance += op.amount;
          expectedEarned += op.amount;
        } else {
          const result = useGemStore.getState().spendGems(op.amount, 'test');
          expect(result).toBe(true);
          expectedBalance -= op.amount;
          expectedSpent += op.amount;
        }
      }

      const state = useGemStore.getState();
      expect(state.gems).toBe(expectedBalance);
      expect(state.totalGemsEarned).toBe(expectedEarned);
      expect(state.totalGemsSpent).toBe(expectedSpent);
    });

    it('should not go negative on balance', () => {
      useGemStore.getState().earnGems(100, 'test');

      // Try to spend more than balance
      const result = useGemStore.getState().spendGems(150, 'test');
      expect(result).toBe(false);
      expect(useGemStore.getState().gems).toBe(100); // Unchanged
    });

    it('should handle zero-amount earn gracefully', () => {
      useGemStore.getState().earnGems(100, 'test');
      useGemStore.getState().earnGems(0, 'zero-earn');

      expect(useGemStore.getState().gems).toBe(100);
      expect(useGemStore.getState().totalGemsEarned).toBe(100);
    });

    it('should handle negative-amount earn gracefully', () => {
      useGemStore.getState().earnGems(100, 'test');
      useGemStore.getState().earnGems(-50, 'negative-earn');

      expect(useGemStore.getState().gems).toBe(100); // Negative should be ignored
    });

    it('should handle zero-amount spend gracefully', () => {
      useGemStore.getState().earnGems(100, 'test');
      const result = useGemStore.getState().spendGems(0, 'zero-spend');

      expect(result).toBe(false);
      expect(useGemStore.getState().gems).toBe(100);
    });

    it('should handle 100 rapid transactions without losing data', () => {
      for (let i = 0; i < 100; i++) {
        useGemStore.getState().earnGems(10, `rapid-earn-${i}`);
      }

      expect(useGemStore.getState().gems).toBe(1000);
      expect(useGemStore.getState().totalGemsEarned).toBe(1000);

      // Spend half
      for (let i = 0; i < 50; i++) {
        const result = useGemStore.getState().spendGems(10, `rapid-spend-${i}`);
        expect(result).toBe(true);
      }

      expect(useGemStore.getState().gems).toBe(500);
      expect(useGemStore.getState().totalGemsSpent).toBe(500);
    });
  });

  describe('transaction audit trail correctness', () => {
    it('should record earn transactions with correct fields', () => {
      useGemStore.getState().earnGems(50, 'exercise-completion');

      const state = useGemStore.getState();
      expect(state.transactions.length).toBe(1);

      const tx = state.transactions[0];
      expect(tx.amount).toBe(50);
      expect(tx.source).toBe('exercise-completion');
      expect(tx.balance).toBe(50);
      expect(tx.timestamp).toBeGreaterThan(0);
      expect(typeof tx.timestamp).toBe('number');
    });

    it('should record spend transactions with negative amount', () => {
      useGemStore.getState().earnGems(100, 'test');
      useGemStore.getState().spendGems(30, 'unlock-cat');

      const state = useGemStore.getState();
      expect(state.transactions.length).toBe(2);

      // Most recent transaction is first (prepended)
      const spendTx = state.transactions[0];
      expect(spendTx.amount).toBe(-30);
      expect(spendTx.source).toBe('unlock-cat');
      expect(spendTx.balance).toBe(70);
    });

    it('should maintain chronological order (newest first)', () => {
      useGemStore.getState().earnGems(10, 'first');
      useGemStore.getState().earnGems(20, 'second');
      useGemStore.getState().earnGems(30, 'third');

      const state = useGemStore.getState();
      expect(state.transactions.length).toBe(3);
      expect(state.transactions[0].source).toBe('third');
      expect(state.transactions[1].source).toBe('second');
      expect(state.transactions[2].source).toBe('first');
    });

    it('should track running balance in each transaction', () => {
      useGemStore.getState().earnGems(100, 'earn-1');
      useGemStore.getState().earnGems(50, 'earn-2');
      useGemStore.getState().spendGems(30, 'spend-1');
      useGemStore.getState().earnGems(20, 'earn-3');

      const state = useGemStore.getState();
      // Newest first: earn-3(140), spend-1(120), earn-2(150), earn-1(100)
      expect(state.transactions[0].balance).toBe(140);
      expect(state.transactions[1].balance).toBe(120);
      expect(state.transactions[2].balance).toBe(150);
      expect(state.transactions[3].balance).toBe(100);
    });

    it('should cap transaction history at 50 entries', () => {
      for (let i = 0; i < 60; i++) {
        useGemStore.getState().earnGems(1, `tx-${i}`);
      }

      const state = useGemStore.getState();
      expect(state.transactions.length).toBe(50);
      // Newest should be tx-59, oldest should be tx-10 (first 10 pruned)
      expect(state.transactions[0].source).toBe('tx-59');
      expect(state.transactions[49].source).toBe('tx-10');
    });

    it('should not create transaction for failed spend', () => {
      useGemStore.getState().earnGems(10, 'initial');
      const result = useGemStore.getState().spendGems(100, 'failed-spend');

      expect(result).toBe(false);
      const state = useGemStore.getState();
      expect(state.transactions.length).toBe(1); // Only the earn
      expect(state.transactions[0].source).toBe('initial');
    });

    it('should record correct source labels for different earning methods', () => {
      useGemStore.getState().earnGems(5, 'exercise-completion');
      useGemStore.getState().earnGems(10, 'daily-reward');
      useGemStore.getState().earnGems(5, 'streak-bonus');
      useGemStore.getState().earnGems(10, 'perfect-score');
      useGemStore.getState().earnGems(10, 'daily-goal-complete');

      const state = useGemStore.getState();
      const sources = state.transactions.map(tx => tx.source);
      expect(sources).toContain('exercise-completion');
      expect(sources).toContain('daily-reward');
      expect(sources).toContain('streak-bonus');
      expect(sources).toContain('perfect-score');
      expect(sources).toContain('daily-goal-complete');
    });
  });

  describe('end-to-end gem lifecycle', () => {
    it('should support full earn -> afford check -> spend -> verify cycle', () => {
      // Start with no gems
      expect(useGemStore.getState().gems).toBe(0);
      expect(useGemStore.getState().canAfford(500)).toBe(false);

      // Earn gems over several "days"
      const dailyEarnings = [60, 55, 70, 65, 50, 75, 60, 55, 70];
      for (const amount of dailyEarnings) {
        useGemStore.getState().earnGems(amount, 'daily');
      }

      const totalEarned = dailyEarnings.reduce((a, b) => a + b, 0);
      expect(useGemStore.getState().gems).toBe(totalEarned);
      expect(useGemStore.getState().canAfford(500)).toBe(true);

      // Unlock a cat
      const catCost = 500;
      const spentOk = useGemStore.getState().spendGems(catCost, 'unlock-starter-cat');
      expect(spentOk).toBe(true);

      // Verify final state
      const finalState = useGemStore.getState();
      expect(finalState.gems).toBe(totalEarned - catCost);
      expect(finalState.totalGemsEarned).toBe(totalEarned);
      expect(finalState.totalGemsSpent).toBe(catCost);
      expect(finalState.transactions.length).toBe(dailyEarnings.length + 1);
    });

    it('should integrate gem spending with cat evolution store unlock', () => {
      // Setup: starter cat + gems
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useGemStore.getState().earnGems(2000, 'test-funds');

      // Unlock multiple cats
      const catsToUnlock = [
        { id: 'biscuit', cost: 750 },
        { id: 'ballymakawww', cost: 1000 },
      ];

      for (const cat of catsToUnlock) {
        const success = useGemStore.getState().spendGems(cat.cost, `unlock-${cat.id}`);
        expect(success).toBe(true);
        useCatEvolutionStore.getState().unlockCat(cat.id);
      }

      // Verify gem state
      expect(useGemStore.getState().gems).toBe(250); // 2000 - 750 - 1000
      expect(useGemStore.getState().totalGemsSpent).toBe(1750);

      // Verify cats owned
      const owned = useCatEvolutionStore.getState().ownedCats;
      expect(owned).toContain('mini-meowww');
      expect(owned).toContain('biscuit');
      expect(owned).toContain('ballymakawww');
      expect(owned.length).toBe(3);

      // Verify remaining balance insufficient for coda (3000)
      expect(useGemStore.getState().canAfford(3000)).toBe(false);
    });
  });
});
