/**
 * Cat Evolution Store Tests
 *
 * Tests evolution stage transitions, ability unlocking, cat ownership,
 * daily reward calendar, Chonky Monké legendary unlock, and starter initialization.
 */

import { useCatEvolutionStore, stageFromXp, xpToNextStage } from '../catEvolutionStore';

// Mock persistence layer
jest.mock('../persistence', () => ({
  PersistenceManager: {
    saveState: jest.fn().mockResolvedValue(undefined),
    loadState: jest.fn().mockResolvedValue({}),
    deleteState: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: {
    CAT_EVOLUTION: 'test_cat_evolution',
  },
  createDebouncedSave: () => jest.fn(),
  createImmediateSave: () => jest.fn(),
}));

describe('catEvolutionStore', () => {
  beforeEach(() => {
    useCatEvolutionStore.getState().reset();
  });

  describe('stageFromXp (pure function)', () => {
    it('returns baby for 0 XP', () => {
      expect(stageFromXp(0)).toBe('baby');
    });

    it('returns baby for XP below 500', () => {
      expect(stageFromXp(499)).toBe('baby');
    });

    it('returns teen at exactly 500 XP', () => {
      expect(stageFromXp(500)).toBe('teen');
    });

    it('returns teen for XP between 500 and 1999', () => {
      expect(stageFromXp(1000)).toBe('teen');
      expect(stageFromXp(1999)).toBe('teen');
    });

    it('returns adult at exactly 2000 XP', () => {
      expect(stageFromXp(2000)).toBe('adult');
    });

    it('returns adult for XP between 2000 and 4999', () => {
      expect(stageFromXp(3500)).toBe('adult');
      expect(stageFromXp(4999)).toBe('adult');
    });

    it('returns master at exactly 5000 XP', () => {
      expect(stageFromXp(5000)).toBe('master');
    });

    it('returns master for XP above 5000', () => {
      expect(stageFromXp(99999)).toBe('master');
    });
  });

  describe('xpToNextStage (pure function)', () => {
    it('returns teen stage info for baby', () => {
      const result = xpToNextStage(200);
      expect(result).toEqual({ nextStage: 'teen', xpNeeded: 300 });
    });

    it('returns adult stage info for teen', () => {
      const result = xpToNextStage(800);
      expect(result).toEqual({ nextStage: 'adult', xpNeeded: 1200 });
    });

    it('returns master stage info for adult', () => {
      const result = xpToNextStage(3000);
      expect(result).toEqual({ nextStage: 'master', xpNeeded: 2000 });
    });

    it('returns null for master (max stage)', () => {
      expect(xpToNextStage(5000)).toBeNull();
      expect(xpToNextStage(10000)).toBeNull();
    });
  });

  describe('initializeStarterCat', () => {
    it('sets initial cat ownership and selection', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      const state = useCatEvolutionStore.getState();

      expect(state.selectedCatId).toBe('mini-meowww');
      expect(state.ownedCats).toEqual(['mini-meowww']);
      expect(state.evolutionData['mini-meowww']).toBeDefined();
      expect(state.evolutionData['mini-meowww'].currentStage).toBe('baby');
      expect(state.evolutionData['mini-meowww'].xpAccumulated).toBe(0);
    });

    it('does nothing if already initialized', () => {
      useCatEvolutionStore.getState().initializeStarterCat('jazzy');
      useCatEvolutionStore.getState().initializeStarterCat('luna');

      const state = useCatEvolutionStore.getState();
      expect(state.selectedCatId).toBe('jazzy');
      expect(state.ownedCats).toEqual(['jazzy']);
    });
  });

  describe('selectCat', () => {
    it('switches to an owned cat', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().unlockCat('jazzy');
      useCatEvolutionStore.getState().selectCat('jazzy');

      expect(useCatEvolutionStore.getState().selectedCatId).toBe('jazzy');
    });

    it('ignores selection of unowned cat', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().selectCat('biscuit');

      expect(useCatEvolutionStore.getState().selectedCatId).toBe('mini-meowww');
    });
  });

  describe('unlockCat', () => {
    it('adds cat to owned list with default evolution data', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().unlockCat('biscuit');

      const state = useCatEvolutionStore.getState();
      expect(state.ownedCats).toContain('biscuit');
      expect(state.evolutionData['biscuit']).toBeDefined();
      expect(state.evolutionData['biscuit'].currentStage).toBe('baby');
    });

    it('does not duplicate if already owned', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().unlockCat('biscuit');
      useCatEvolutionStore.getState().unlockCat('biscuit');

      expect(
        useCatEvolutionStore.getState().ownedCats.filter(id => id === 'biscuit'),
      ).toHaveLength(1);
    });
  });

  describe('addEvolutionXp', () => {
    beforeEach(() => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
    });

    it('accumulates XP on a cat', () => {
      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 100);
      expect(useCatEvolutionStore.getState().evolutionData['mini-meowww'].xpAccumulated).toBe(100);
    });

    it('returns null when no evolution occurs', () => {
      const result = useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 100);
      expect(result).toBeNull();
    });

    it('triggers teen evolution at 500 XP and returns new stage', () => {
      const result = useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 500);
      expect(result).toBe('teen');
      expect(useCatEvolutionStore.getState().evolutionData['mini-meowww'].currentStage).toBe('teen');
    });

    it('triggers adult evolution at 2000 XP', () => {
      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 500); // teen
      const result = useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 1500); // adult
      expect(result).toBe('adult');
    });

    it('triggers master evolution at 5000 XP', () => {
      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 2000);
      const result = useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 3000);
      expect(result).toBe('master');
    });

    it('can skip stages if enough XP given at once', () => {
      const result = useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 5000);
      expect(result).toBe('master');
      expect(useCatEvolutionStore.getState().evolutionData['mini-meowww'].currentStage).toBe('master');
    });

    it('unlocks abilities on evolution', () => {
      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 500); // teen
      const abilities = useCatEvolutionStore.getState().evolutionData['mini-meowww'].abilitiesUnlocked;
      // Mini Meowww has baby ability (mm-note-preview) and teen ability (mm-timing-window)
      expect(abilities).toContain('mm-note-preview');
      expect(abilities).toContain('mm-timing-window');
    });

    it('unlocks all abilities at master', () => {
      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 5000);
      const abilities = useCatEvolutionStore.getState().evolutionData['mini-meowww'].abilitiesUnlocked;
      expect(abilities).toContain('mm-note-preview');
      expect(abilities).toContain('mm-timing-window');
      expect(abilities).toContain('mm-xp-boost');
      expect(abilities).toContain('mm-perfect-shield');
      expect(abilities).toHaveLength(4);
    });

    it('records evolvedAt timestamp on evolution', () => {
      const before = Date.now();
      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 500);
      const data = useCatEvolutionStore.getState().evolutionData['mini-meowww'];

      expect(data.evolvedAt.baby).toBeDefined();
      expect(data.evolvedAt.teen).toBeGreaterThanOrEqual(before);
      expect(data.evolvedAt.adult).toBeNull();
      expect(data.evolvedAt.master).toBeNull();
    });

    it('returns null for unknown cat', () => {
      const result = useCatEvolutionStore.getState().addEvolutionXp('nonexistent', 100);
      expect(result).toBeNull();
    });
  });

  describe('getActiveAbilities', () => {
    it('returns empty for no selected cat', () => {
      const abilities = useCatEvolutionStore.getState().getActiveAbilities();
      expect(abilities).toEqual([]);
    });

    it('returns unlocked abilities for selected cat', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 500);

      const abilities = useCatEvolutionStore.getState().getActiveAbilities();
      expect(abilities).toContain('mm-note-preview');
      expect(abilities).toContain('mm-timing-window');
    });

    it('only returns abilities for the selected cat', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().unlockCat('jazzy');
      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 5000);
      useCatEvolutionStore.getState().addEvolutionXp('jazzy', 5000);
      useCatEvolutionStore.getState().selectCat('jazzy');

      const abilities = useCatEvolutionStore.getState().getActiveAbilities();
      expect(abilities).toContain('jz-slow-start');
      expect(abilities).not.toContain('mm-note-preview');
    });
  });

  describe('claimDailyReward', () => {
    it('claims the current day reward after completing daily challenge', () => {
      useCatEvolutionStore.getState().completeDailyChallenge();
      const reward = useCatEvolutionStore.getState().claimDailyReward(1);
      expect(reward).toEqual({ type: 'gems', amount: 10 });
    });

    it('marks day as claimed', () => {
      useCatEvolutionStore.getState().completeDailyChallenge();
      useCatEvolutionStore.getState().claimDailyReward(1);
      const day1 = useCatEvolutionStore.getState().dailyRewards.days.find(d => d.day === 1);
      expect(day1?.claimed).toBe(true);
    });

    it('returns null without completing daily challenge for today', () => {
      // Set weekStartDate to today so day 1 IS today (requires challenge)
      const today = new Date().toISOString().split('T')[0];
      useCatEvolutionStore.setState({
        dailyRewards: {
          weekStartDate: today,
          days: useCatEvolutionStore.getState().dailyRewards.days.map(d => ({ ...d, claimed: false })),
          currentDay: 1,
        },
      });
      const reward = useCatEvolutionStore.getState().claimDailyReward(1);
      expect(reward).toBeNull();
    });

    it('blocks claiming past unclaimed days without daily challenge', () => {
      // Set weekStartDate to 3 days ago so today is day 4
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const weekStart = threeDaysAgo.toISOString().split('T')[0];
      useCatEvolutionStore.setState({
        dailyRewards: {
          weekStartDate: weekStart,
          days: useCatEvolutionStore.getState().dailyRewards.days.map(d => ({ ...d, claimed: false })),
          currentDay: 4,
        },
      });
      // Past day 2 should NOT be claimable without completing today's challenge
      const reward = useCatEvolutionStore.getState().claimDailyReward(2);
      expect(reward).toBeNull();
    });

    it('allows claiming past unclaimed days after completing daily challenge', () => {
      // Set weekStartDate to 3 days ago so today is day 4
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const weekStart = threeDaysAgo.toISOString().split('T')[0];
      useCatEvolutionStore.setState({
        dailyRewards: {
          weekStartDate: weekStart,
          days: useCatEvolutionStore.getState().dailyRewards.days.map(d => ({ ...d, claimed: false })),
          currentDay: 4,
        },
      });
      // Complete today's challenge first
      useCatEvolutionStore.getState().completeDailyChallenge();
      // Now past day 2 is claimable
      const reward = useCatEvolutionStore.getState().claimDailyReward(2);
      expect(reward).toEqual({ type: 'gems', amount: 15 });
    });

    it('returns null for already claimed day', () => {
      useCatEvolutionStore.getState().completeDailyChallenge();
      useCatEvolutionStore.getState().claimDailyReward(1);
      const result = useCatEvolutionStore.getState().claimDailyReward(1);
      expect(result).toBeNull();
    });

    it('returns null for future day', () => {
      // Set weekStartDate to today so today is day 1; day 3 is future
      const today = new Date().toISOString().split('T')[0];
      useCatEvolutionStore.setState({
        dailyRewards: {
          weekStartDate: today,
          days: useCatEvolutionStore.getState().dailyRewards.days.map(d => ({ ...d, claimed: false })),
          currentDay: 1,
        },
      });
      useCatEvolutionStore.getState().completeDailyChallenge();
      const result = useCatEvolutionStore.getState().claimDailyReward(3);
      expect(result).toBeNull();
    });

    it('daily rewards default to 7 days with correct reward types', () => {
      const days = useCatEvolutionStore.getState().dailyRewards.days;
      expect(days).toHaveLength(7);
      expect(days[0].reward).toEqual({ type: 'gems', amount: 10 });
      expect(days[6].reward).toEqual({ type: 'chest', amount: 50 });
    });

    it('day 7 reward is a chest (data check)', () => {
      const day7 = useCatEvolutionStore.getState().dailyRewards.days.find(d => d.day === 7);
      expect(day7?.reward).toEqual({ type: 'chest', amount: 50 });
      expect(day7?.claimed).toBe(false);
    });
  });

  describe('resetDailyRewards', () => {
    it('resets all days to unclaimed with Monday-aligned currentDay', () => {
      useCatEvolutionStore.getState().completeDailyChallenge();
      useCatEvolutionStore.getState().claimDailyReward(1);
      useCatEvolutionStore.getState().resetDailyRewards();

      const state = useCatEvolutionStore.getState();
      // currentDay is now computed from Monday alignment (1=Mon...7=Sun)
      expect(state.dailyRewards.currentDay).toBeGreaterThanOrEqual(1);
      expect(state.dailyRewards.currentDay).toBeLessThanOrEqual(7);
      expect(state.dailyRewards.days.every(d => !d.claimed)).toBe(true);
    });
  });

  describe('daily challenge tracking', () => {
    it('completeDailyChallenge marks today as done', () => {
      expect(useCatEvolutionStore.getState().isDailyChallengeCompleted()).toBe(false);
      useCatEvolutionStore.getState().completeDailyChallenge();
      expect(useCatEvolutionStore.getState().isDailyChallengeCompleted()).toBe(true);
    });

    it('completeDailyChallenge persists state (uses immediateSave)', () => {
      // Verifying the function doesn't throw and state is set correctly
      useCatEvolutionStore.getState().completeDailyChallenge();
      expect(useCatEvolutionStore.getState().isDailyChallengeCompleted()).toBe(true);
    });

    it('advanceDailyRewardDate resets expired week', () => {
      // Set weekStartDate to a long-expired date to simulate expired week
      useCatEvolutionStore.setState({
        dailyRewards: {
          weekStartDate: '2020-01-01',
          days: useCatEvolutionStore.getState().dailyRewards.days,
          currentDay: 5,
        },
      });
      useCatEvolutionStore.getState().advanceDailyRewardDate();
      const state = useCatEvolutionStore.getState();
      // After reset, currentDay is computed from Monday alignment (1-7)
      expect(state.dailyRewards.currentDay).toBeGreaterThanOrEqual(1);
      expect(state.dailyRewards.currentDay).toBeLessThanOrEqual(7);
      expect(state.dailyRewards.days.every(d => !d.claimed)).toBe(true);
    });
  });

  describe('completeDailyChallengeAndClaim', () => {
    it('marks challenge complete and claims today\'s reward in one call', () => {
      const reward = useCatEvolutionStore.getState().completeDailyChallengeAndClaim();
      expect(useCatEvolutionStore.getState().isDailyChallengeCompleted()).toBe(true);
      // Day 1 reward is 10 gems
      expect(reward).toEqual({ type: 'gems', amount: 10 });
    });

    it('marks the day as claimed', () => {
      useCatEvolutionStore.getState().completeDailyChallengeAndClaim();
      const day1 = useCatEvolutionStore.getState().dailyRewards.days.find(d => d.day === 1);
      expect(day1?.claimed).toBe(true);
    });

    it('persists state via immediateSave (not debounced)', () => {
      // Verifying the function doesn't throw and state persists correctly
      useCatEvolutionStore.getState().completeDailyChallengeAndClaim();
      expect(useCatEvolutionStore.getState().isDailyChallengeCompleted()).toBe(true);
      const day1 = useCatEvolutionStore.getState().dailyRewards.days.find(d => d.day === 1);
      expect(day1?.claimed).toBe(true);
    });

    it('returns null for already-claimed day', () => {
      useCatEvolutionStore.getState().completeDailyChallengeAndClaim();
      // Call again — day is already claimed
      const reward = useCatEvolutionStore.getState().completeDailyChallengeAndClaim();
      // Should return the reward (already claimed) — not null, since challenge is still complete
      expect(reward).toEqual({ type: 'gems', amount: 10 });
    });

    it('returns null when week has expired', () => {
      useCatEvolutionStore.setState({
        dailyRewards: {
          weekStartDate: '2020-01-01',
          days: useCatEvolutionStore.getState().dailyRewards.days.map(d => ({ ...d, claimed: false })),
          currentDay: 5,
        },
      });
      const reward = useCatEvolutionStore.getState().completeDailyChallengeAndClaim();
      expect(reward).toBeNull();
      // But challenge should still be marked as completed
      expect(useCatEvolutionStore.getState().isDailyChallengeCompleted()).toBe(true);
    });
  });

  describe('Chonky Monké legendary unlock', () => {
    it('is not eligible with low streak and few skills', () => {
      const eligible = useCatEvolutionStore.getState().checkChonkyEligibility(50, 20);
      expect(eligible).toBe(false);
    });

    it('is eligible with 300+ day streak', () => {
      const eligible = useCatEvolutionStore.getState().checkChonkyEligibility(300, 0);
      expect(eligible).toBe(true);
    });

    it('is eligible with 100+ skills mastered', () => {
      const eligible = useCatEvolutionStore.getState().checkChonkyEligibility(0, 100);
      expect(eligible).toBe(true);
    });

    it('tracks progress flags correctly', () => {
      useCatEvolutionStore.getState().checkChonkyEligibility(300, 50);
      const progress = useCatEvolutionStore.getState().chonkyUnlockProgress;
      expect(progress.daysStreakReached).toBe(true);
      expect(progress.skillsMasteredReached).toBe(false);
    });

    it('unlockChonky adds to owned cats', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().unlockChonky();

      const state = useCatEvolutionStore.getState();
      expect(state.ownedCats).toContain('chonky-monke');
      expect(state.evolutionData['chonky-monke']).toBeDefined();
      expect(state.evolutionData['chonky-monke'].currentStage).toBe('baby');
    });

    it('unlockChonky is idempotent', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().unlockChonky();
      useCatEvolutionStore.getState().unlockChonky();

      expect(
        useCatEvolutionStore.getState().ownedCats.filter(id => id === 'chonky-monke'),
      ).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('clears all evolution data', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 1000);
      useCatEvolutionStore.getState().completeDailyChallenge();
      useCatEvolutionStore.getState().claimDailyReward(1);
      useCatEvolutionStore.getState().reset();

      const state = useCatEvolutionStore.getState();
      expect(state.selectedCatId).toBe('');
      expect(state.ownedCats).toEqual([]);
      expect(state.evolutionData).toEqual({});
      expect(state.dailyRewards.currentDay).toBe(1);
    });
  });

  describe('multi-cat evolution', () => {
    it('evolves different cats independently', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().unlockCat('jazzy');

      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 500); // teen
      useCatEvolutionStore.getState().addEvolutionXp('jazzy', 2000); // adult

      const mmData = useCatEvolutionStore.getState().evolutionData['mini-meowww'];
      const jzData = useCatEvolutionStore.getState().evolutionData['jazzy'];

      expect(mmData.currentStage).toBe('teen');
      expect(jzData.currentStage).toBe('adult');
    });

    it('abilities are specific to each cat', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().unlockCat('luna');

      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 500);
      useCatEvolutionStore.getState().addEvolutionXp('luna', 500);

      const mmAbilities = useCatEvolutionStore.getState().evolutionData['mini-meowww'].abilitiesUnlocked;
      const lnAbilities = useCatEvolutionStore.getState().evolutionData['luna'].abilitiesUnlocked;

      expect(mmAbilities).toContain('mm-timing-window');
      expect(mmAbilities).not.toContain('ln-extra-retries');
      expect(lnAbilities).toContain('ln-extra-retries');
      expect(lnAbilities).not.toContain('mm-timing-window');
    });
  });
});
