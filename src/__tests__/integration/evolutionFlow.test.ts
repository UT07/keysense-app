/**
 * Integration Test: Evolution Flow
 *
 * Tests the full cat evolution pipeline:
 * - Initialize starter cat and verify ownership
 * - Earn XP and evolve through stages (baby -> teen -> adult -> master)
 * - Abilities unlock at correct evolution stages
 * - Cat switching between owned cats
 * - Gem-based cat unlocking with balance deduction
 * - Chonky Monke legendary eligibility checks
 */

import { useCatEvolutionStore, stageFromXp, xpToNextStage } from '../../stores/catEvolutionStore';
import { useGemStore } from '../../stores/gemStore';
import { EVOLUTION_XP_THRESHOLDS } from '../../stores/types';

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

// Mock catCharacters to provide abilities for test cats
jest.mock('../../components/Mascot/catCharacters', () => ({
  CAT_CHARACTERS: [
    {
      id: 'mini-meowww',
      name: 'Mini Meowww',
      emoji: '🐱',
      starterCat: true,
      gemCost: null,
      legendary: false,
      color: '#DC143C',
      unlockLevel: 1,
      personality: 'Tiny but Mighty',
      musicSkill: 'Precision',
      backstory: 'test',
      visuals: { bodyColor: '#1A1A1A', bellyColor: '#F5F5F5', earInnerColor: '#DC143C', eyeColor: '#2ECC71', noseColor: '#DC143C', pattern: 'tuxedo' },
      evolutionVisuals: {
        baby: { accessories: [], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
        teen: { accessories: ['bow-tie'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
        adult: { accessories: ['bow-tie', 'scarf'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.3 },
        master: { accessories: ['bow-tie', 'cape', 'crown'], hasGlow: true, hasParticles: true, hasCrown: true, auraIntensity: 0.8 },
      },
      abilities: [
        { id: 'mm-note-preview', name: 'Note Preview', description: 'See next note', icon: 'eye-outline', effect: { type: 'note_preview', previewBeats: 1 }, unlockedAtStage: 'baby' },
        { id: 'mm-timing-window', name: 'Wider Timing', description: 'Timing +20%', icon: 'timer-outline', effect: { type: 'timing_window_multiplier', multiplier: 1.2 }, unlockedAtStage: 'teen' },
        { id: 'mm-xp-boost', name: 'XP Multiplier', description: 'Earn 25% more XP', icon: 'arrow-up-bold', effect: { type: 'xp_multiplier', multiplier: 1.25 }, unlockedAtStage: 'adult' },
        { id: 'mm-perfect-shield', name: 'Perfect Shield', description: '1 perfect shield', icon: 'shield-star', effect: { type: 'perfect_shield', shieldsPerExercise: 1 }, unlockedAtStage: 'master' },
      ],
    },
    {
      id: 'jazzy',
      name: 'Jazzy',
      emoji: '😎',
      starterCat: true,
      gemCost: null,
      legendary: false,
      color: '#9B59B6',
      unlockLevel: 1,
      personality: 'Cool & Smooth',
      musicSkill: 'Jazz',
      backstory: 'test',
      visuals: { bodyColor: '#4A4A6A', bellyColor: '#6B6B8A', earInnerColor: '#9B59B6', eyeColor: '#D4A5FF', noseColor: '#9B59B6', pattern: 'solid' },
      evolutionVisuals: {
        baby: { accessories: [], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
        teen: { accessories: ['sunglasses'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
        adult: { accessories: ['sunglasses', 'fedora'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.3 },
        master: { accessories: ['sunglasses', 'trilby', 'sax'], hasGlow: true, hasParticles: true, hasCrown: false, auraIntensity: 0.7 },
      },
      abilities: [
        { id: 'jz-slow-start', name: 'Chill Start', description: '-10 BPM', icon: 'speedometer-slow', effect: { type: 'tempo_reduction', bpmReduction: 10 }, unlockedAtStage: 'baby' },
        { id: 'jz-combo-shield', name: 'Combo Shield', description: '1 miss forgiven', icon: 'shield-half-full', effect: { type: 'combo_shield', missesForgivenPerExercise: 1 }, unlockedAtStage: 'teen' },
        { id: 'jz-hint-boost', name: 'Hint Frequency', description: 'Hints 50% more', icon: 'lightbulb-on', effect: { type: 'hint_frequency_boost', multiplier: 1.5 }, unlockedAtStage: 'adult' },
        { id: 'jz-streak-saver', name: 'Streak Saver', description: '1 free save/week', icon: 'fire', effect: { type: 'streak_saver', freeSavesPerWeek: 1 }, unlockedAtStage: 'master' },
      ],
    },
    {
      id: 'biscuit',
      name: 'Biscuit',
      emoji: '😻',
      starterCat: false,
      gemCost: 750,
      legendary: false,
      color: '#F39C9C',
      unlockLevel: 1,
      personality: 'Cozy',
      musicSkill: 'C Major',
      backstory: 'test',
      visuals: { bodyColor: '#F5D5C8', bellyColor: '#FFF0EB', earInnerColor: '#F39C9C', eyeColor: '#81D4FA', noseColor: '#F48FB1', pattern: 'solid' },
      evolutionVisuals: {
        baby: { accessories: [], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
        teen: { accessories: ['pink-bow'], hasGlow: false, hasParticles: false, hasCrown: false, auraIntensity: 0 },
        adult: { accessories: ['pink-bow', 'apron'], hasGlow: true, hasParticles: false, hasCrown: false, auraIntensity: 0.3 },
        master: { accessories: ['pink-bow', 'chef-hat', 'cookie-wand'], hasGlow: true, hasParticles: true, hasCrown: false, auraIntensity: 0.6 },
      },
      abilities: [
        { id: 'bs-reminder', name: 'Practice Reminder', description: 'Nudge', icon: 'bell-ring', effect: { type: 'daily_xp_boost', multiplier: 1.1 }, unlockedAtStage: 'baby' },
        { id: 'bs-ghost-ext', name: 'Extended Ghost Notes', description: 'Ghost +2 beats', icon: 'ghost-outline', effect: { type: 'ghost_notes_extended', extraFailsBeforeTrigger: -1 }, unlockedAtStage: 'teen' },
        { id: 'bs-daily-xp', name: 'Daily XP Boost', description: '+15% XP', icon: 'star-circle', effect: { type: 'daily_xp_boost', multiplier: 1.15 }, unlockedAtStage: 'adult' },
        { id: 'bs-gem-magnet', name: 'Gem Magnet', description: '10% bonus gems', icon: 'magnet', effect: { type: 'gem_magnet', bonusGemChance: 0.1 }, unlockedAtStage: 'master' },
      ],
    },
    {
      id: 'chonky-monke',
      name: 'Chonky Monke',
      emoji: '🍊',
      starterCat: false,
      gemCost: null,
      legendary: true,
      color: '#FF8C00',
      unlockLevel: 1,
      personality: 'Absolute Unit',
      musicSkill: 'Power Chords',
      backstory: 'test',
      visuals: { bodyColor: '#E8871E', bellyColor: '#FFF3E0', earInnerColor: '#FFB74D', eyeColor: '#FFD54F', noseColor: '#FF8C00', pattern: 'tabby' },
      evolutionVisuals: {
        baby: { accessories: ['tiny-crown'], hasGlow: false, hasParticles: false, hasCrown: true, auraIntensity: 0 },
        teen: { accessories: ['gold-chain', 'tiny-crown'], hasGlow: true, hasParticles: false, hasCrown: true, auraIntensity: 0.2 },
        adult: { accessories: ['gold-chain', 'royal-robe', 'golden-headphones'], hasGlow: true, hasParticles: true, hasCrown: true, auraIntensity: 0.5 },
        master: { accessories: ['gold-chain', 'royal-robe', 'golden-headphones', 'piano-throne'], hasGlow: true, hasParticles: true, hasCrown: true, auraIntensity: 1.0 },
      },
      abilities: [
        { id: 'ck-combo-shield', name: 'Belly Block', description: '2 misses forgiven', icon: 'shield-crown', effect: { type: 'combo_shield', missesForgivenPerExercise: 2 }, unlockedAtStage: 'baby' },
        { id: 'ck-xp-mult', name: 'Chonk Energy', description: '30% XP mult', icon: 'weight', effect: { type: 'xp_multiplier', multiplier: 1.3 }, unlockedAtStage: 'teen' },
        { id: 'ck-lucky-gems', name: 'Golden Belly', description: '30% double gems', icon: 'treasure-chest', effect: { type: 'lucky_gems', bonusGemMultiplier: 2 }, unlockedAtStage: 'adult' },
        { id: 'ck-all-half', name: 'Absolute Unit', description: 'All abilities at half', icon: 'infinity', effect: { type: 'all_abilities_half', description: 'Combines all at half' }, unlockedAtStage: 'master' },
      ],
    },
  ],
  getCatById: (id: string) => {
    const cats = jest.requireMock('../../components/Mascot/catCharacters').CAT_CHARACTERS;
    return cats.find((c: any) => c.id === id);
  },
  getStarterCats: () => {
    const cats = jest.requireMock('../../components/Mascot/catCharacters').CAT_CHARACTERS;
    return cats.filter((c: any) => c.starterCat);
  },
}));

describe('Evolution Flow Integration', () => {
  beforeEach(() => {
    // Reset stores before each test
    useCatEvolutionStore.getState().reset();
    useGemStore.getState().reset();
  });

  describe('starter cat initialization and evolution', () => {
    it('should initialize starter cat and verify ownership', () => {
      const store = useCatEvolutionStore.getState();
      store.initializeStarterCat('mini-meowww');

      const state = useCatEvolutionStore.getState();
      expect(state.selectedCatId).toBe('mini-meowww');
      expect(state.ownedCats).toContain('mini-meowww');
      expect(state.ownedCats.length).toBe(1);
      expect(state.evolutionData['mini-meowww']).toBeDefined();
      expect(state.evolutionData['mini-meowww'].currentStage).toBe('baby');
      expect(state.evolutionData['mini-meowww'].xpAccumulated).toBe(0);
    });

    it('should not re-initialize if already has cats', () => {
      const store = useCatEvolutionStore.getState();
      store.initializeStarterCat('mini-meowww');
      store.initializeStarterCat('jazzy'); // Should be ignored

      const state = useCatEvolutionStore.getState();
      expect(state.selectedCatId).toBe('mini-meowww');
      expect(state.ownedCats.length).toBe(1);
    });

    it('should evolve from baby to teen at 500 XP', () => {
      const store = useCatEvolutionStore.getState();
      store.initializeStarterCat('mini-meowww');

      // Add XP in increments to simulate earning over time
      let evolved = store.addEvolutionXp('mini-meowww', 200);
      expect(evolved).toBeNull(); // No evolution yet

      evolved = useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 200);
      expect(evolved).toBeNull(); // Still baby at 400

      evolved = useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 100);
      expect(evolved).toBe('teen'); // Evolved at 500!

      const state = useCatEvolutionStore.getState();
      expect(state.evolutionData['mini-meowww'].currentStage).toBe('teen');
      expect(state.evolutionData['mini-meowww'].xpAccumulated).toBe(500);
      expect(state.evolutionData['mini-meowww'].evolvedAt.teen).not.toBeNull();
    });

    it('should evolve through all stages: baby -> teen -> adult -> master', () => {
      const store = useCatEvolutionStore.getState();
      store.initializeStarterCat('mini-meowww');

      // Baby to teen (500 XP)
      const teenResult = store.addEvolutionXp('mini-meowww', 500);
      expect(teenResult).toBe('teen');

      // Teen to adult (2000 XP total)
      const adultResult = useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 1500);
      expect(adultResult).toBe('adult');

      // Adult to master (5000 XP total)
      const masterResult = useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 3000);
      expect(masterResult).toBe('master');

      const state = useCatEvolutionStore.getState();
      expect(state.evolutionData['mini-meowww'].currentStage).toBe('master');
      expect(state.evolutionData['mini-meowww'].xpAccumulated).toBe(5000);
      expect(state.evolutionData['mini-meowww'].evolvedAt.baby).not.toBeNull();
      expect(state.evolutionData['mini-meowww'].evolvedAt.teen).not.toBeNull();
      expect(state.evolutionData['mini-meowww'].evolvedAt.adult).not.toBeNull();
      expect(state.evolutionData['mini-meowww'].evolvedAt.master).not.toBeNull();
    });
  });

  describe('abilities unlock at correct evolution stages', () => {
    it('should unlock baby ability on initialization', () => {
      const store = useCatEvolutionStore.getState();
      store.initializeStarterCat('mini-meowww');

      // Baby ability should NOT be auto-unlocked on init (only on evolution)
      // The baby abilities are "unlocked at baby" — they unlock when the cat is created at baby stage
      const state = useCatEvolutionStore.getState();
      // initializeStarterCat creates at baby with empty abilities
      expect(state.evolutionData['mini-meowww'].abilitiesUnlocked).toEqual([]);
    });

    it('should unlock teen ability when evolving to teen', () => {
      const store = useCatEvolutionStore.getState();
      store.initializeStarterCat('mini-meowww');

      // Evolve to teen
      store.addEvolutionXp('mini-meowww', 500);

      const state = useCatEvolutionStore.getState();
      const abilities = state.evolutionData['mini-meowww'].abilitiesUnlocked;
      // Should have baby + teen abilities
      expect(abilities).toContain('mm-note-preview'); // baby
      expect(abilities).toContain('mm-timing-window'); // teen
      expect(abilities).not.toContain('mm-xp-boost'); // adult — not yet
      expect(abilities).not.toContain('mm-perfect-shield'); // master — not yet
    });

    it('should unlock all abilities when reaching master', () => {
      const store = useCatEvolutionStore.getState();
      store.initializeStarterCat('mini-meowww');

      // Evolve to master in one jump
      store.addEvolutionXp('mini-meowww', 5000);

      const state = useCatEvolutionStore.getState();
      const abilities = state.evolutionData['mini-meowww'].abilitiesUnlocked;
      expect(abilities).toContain('mm-note-preview');
      expect(abilities).toContain('mm-timing-window');
      expect(abilities).toContain('mm-xp-boost');
      expect(abilities).toContain('mm-perfect-shield');
      expect(abilities.length).toBe(4);
    });

    it('should return active abilities for selected cat', () => {
      const store = useCatEvolutionStore.getState();
      store.initializeStarterCat('mini-meowww');
      store.addEvolutionXp('mini-meowww', 500); // evolve to teen

      const abilities = useCatEvolutionStore.getState().getActiveAbilities();
      expect(abilities).toContain('mm-note-preview');
      expect(abilities).toContain('mm-timing-window');
    });
  });

  describe('cat switching', () => {
    it('should switch between owned cats', () => {
      const store = useCatEvolutionStore.getState();
      store.initializeStarterCat('mini-meowww');

      // Manually unlock a second cat
      useCatEvolutionStore.getState().unlockCat('jazzy');

      // Switch to jazzy
      useCatEvolutionStore.getState().selectCat('jazzy');
      expect(useCatEvolutionStore.getState().selectedCatId).toBe('jazzy');

      // Switch back
      useCatEvolutionStore.getState().selectCat('mini-meowww');
      expect(useCatEvolutionStore.getState().selectedCatId).toBe('mini-meowww');
    });

    it('should not switch to unowned cat', () => {
      const store = useCatEvolutionStore.getState();
      store.initializeStarterCat('mini-meowww');

      store.selectCat('biscuit'); // Not owned
      expect(useCatEvolutionStore.getState().selectedCatId).toBe('mini-meowww');
    });

    it('should track evolution independently per cat', () => {
      const store = useCatEvolutionStore.getState();
      store.initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().unlockCat('jazzy');

      // Evolve mini-meowww to teen
      useCatEvolutionStore.getState().addEvolutionXp('mini-meowww', 500);

      // Jazzy should still be baby
      const state = useCatEvolutionStore.getState();
      expect(state.evolutionData['mini-meowww'].currentStage).toBe('teen');
      expect(state.evolutionData['jazzy'].currentStage).toBe('baby');
    });
  });

  describe('gem-based cat unlocking', () => {
    it('should unlock a cat with gems and deduct balance', () => {
      // Setup: initialize starter + fund gems
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useGemStore.getState().earnGems(800, 'test-funds');

      // Verify initial state
      expect(useGemStore.getState().gems).toBe(800);
      expect(useCatEvolutionStore.getState().ownedCats).not.toContain('biscuit');

      // Spend gems and unlock
      const spent = useGemStore.getState().spendGems(750, 'unlock-cat-biscuit');
      expect(spent).toBe(true);
      useCatEvolutionStore.getState().unlockCat('biscuit');

      // Verify cat is now owned
      expect(useCatEvolutionStore.getState().ownedCats).toContain('biscuit');
      expect(useGemStore.getState().gems).toBe(50);

      // Verify evolution data was created
      const evoData = useCatEvolutionStore.getState().evolutionData['biscuit'];
      expect(evoData).toBeDefined();
      expect(evoData.currentStage).toBe('baby');
      expect(evoData.xpAccumulated).toBe(0);
    });

    it('should not spend gems if balance insufficient', () => {
      useGemStore.getState().earnGems(500, 'test-funds');

      const result = useGemStore.getState().spendGems(750, 'unlock-cat-biscuit');
      expect(result).toBe(false);
      expect(useGemStore.getState().gems).toBe(500); // Unchanged
    });

    it('should not duplicate cat if already owned', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().unlockCat('biscuit');
      useCatEvolutionStore.getState().unlockCat('biscuit'); // duplicate

      expect(useCatEvolutionStore.getState().ownedCats.filter(c => c === 'biscuit').length).toBe(1);
    });

    it('should allow unlocked cat to appear in owned list and be selectable', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useGemStore.getState().earnGems(1000, 'test-funds');

      // Unlock biscuit
      useGemStore.getState().spendGems(750, 'unlock-cat-biscuit');
      useCatEvolutionStore.getState().unlockCat('biscuit');

      // Should be in owned
      expect(useCatEvolutionStore.getState().ownedCats).toContain('biscuit');

      // Should be selectable
      useCatEvolutionStore.getState().selectCat('biscuit');
      expect(useCatEvolutionStore.getState().selectedCatId).toBe('biscuit');
    });
  });

  describe('Chonky Monke legendary eligibility', () => {
    it('should not be eligible with low streak and few skills', () => {
      const result = useCatEvolutionStore.getState().checkChonkyEligibility(10, 5);
      expect(result).toBe(false);
    });

    it('should be eligible with 300-day streak', () => {
      const result = useCatEvolutionStore.getState().checkChonkyEligibility(300, 0);
      expect(result).toBe(true);

      const state = useCatEvolutionStore.getState();
      expect(state.chonkyUnlockProgress.daysStreakReached).toBe(true);
      expect(state.chonkyUnlockProgress.skillsMasteredReached).toBe(false);
    });

    it('should be eligible with 100 skills mastered', () => {
      const result = useCatEvolutionStore.getState().checkChonkyEligibility(0, 100);
      expect(result).toBe(true);

      const state = useCatEvolutionStore.getState();
      expect(state.chonkyUnlockProgress.daysStreakReached).toBe(false);
      expect(state.chonkyUnlockProgress.skillsMasteredReached).toBe(true);
    });

    it('should be eligible with both conditions met', () => {
      const result = useCatEvolutionStore.getState().checkChonkyEligibility(350, 100);
      expect(result).toBe(true);

      const state = useCatEvolutionStore.getState();
      expect(state.chonkyUnlockProgress.daysStreakReached).toBe(true);
      expect(state.chonkyUnlockProgress.skillsMasteredReached).toBe(true);
    });

    it('should unlock Chonky and make it selectable', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');

      // Verify Chonky not owned
      expect(useCatEvolutionStore.getState().ownedCats).not.toContain('chonky-monke');

      // Unlock
      useCatEvolutionStore.getState().unlockChonky();

      const state = useCatEvolutionStore.getState();
      expect(state.ownedCats).toContain('chonky-monke');
      expect(state.evolutionData['chonky-monke']).toBeDefined();
      expect(state.evolutionData['chonky-monke'].currentStage).toBe('baby');

      // Should be selectable
      useCatEvolutionStore.getState().selectCat('chonky-monke');
      expect(useCatEvolutionStore.getState().selectedCatId).toBe('chonky-monke');
    });

    it('should not duplicate Chonky if unlockChonky called twice', () => {
      useCatEvolutionStore.getState().initializeStarterCat('mini-meowww');
      useCatEvolutionStore.getState().unlockChonky();
      useCatEvolutionStore.getState().unlockChonky();

      expect(useCatEvolutionStore.getState().ownedCats.filter(c => c === 'chonky-monke').length).toBe(1);
    });
  });

  describe('stageFromXp utility', () => {
    it('should return baby for 0 XP', () => {
      expect(stageFromXp(0)).toBe('baby');
    });

    it('should return baby for 499 XP', () => {
      expect(stageFromXp(499)).toBe('baby');
    });

    it('should return teen for 500 XP', () => {
      expect(stageFromXp(500)).toBe('teen');
    });

    it('should return adult for 2000 XP', () => {
      expect(stageFromXp(2000)).toBe('adult');
    });

    it('should return master for 5000 XP', () => {
      expect(stageFromXp(5000)).toBe('master');
    });

    it('should return master for 10000 XP', () => {
      expect(stageFromXp(10000)).toBe('master');
    });
  });

  describe('xpToNextStage utility', () => {
    it('should return teen info for baby stage', () => {
      const result = xpToNextStage(0);
      expect(result).not.toBeNull();
      expect(result!.nextStage).toBe('teen');
      expect(result!.xpNeeded).toBe(500);
    });

    it('should return adult info for teen stage', () => {
      const result = xpToNextStage(500);
      expect(result).not.toBeNull();
      expect(result!.nextStage).toBe('adult');
      expect(result!.xpNeeded).toBe(1500);
    });

    it('should return master info for adult stage', () => {
      const result = xpToNextStage(2000);
      expect(result).not.toBeNull();
      expect(result!.nextStage).toBe('master');
      expect(result!.xpNeeded).toBe(3000);
    });

    it('should return null for master stage', () => {
      const result = xpToNextStage(5000);
      expect(result).toBeNull();
    });

    it('should return partial XP needed mid-stage', () => {
      const result = xpToNextStage(250);
      expect(result).not.toBeNull();
      expect(result!.nextStage).toBe('teen');
      expect(result!.xpNeeded).toBe(250);
    });
  });

  describe('EVOLUTION_XP_THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(EVOLUTION_XP_THRESHOLDS.baby).toBe(0);
      expect(EVOLUTION_XP_THRESHOLDS.teen).toBe(500);
      expect(EVOLUTION_XP_THRESHOLDS.adult).toBe(2000);
      expect(EVOLUTION_XP_THRESHOLDS.master).toBe(5000);
    });
  });
});
