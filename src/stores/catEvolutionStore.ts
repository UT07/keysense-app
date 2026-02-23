/**
 * Cat Evolution & Collection Store
 *
 * Manages:
 * - Cat ownership and active cat selection
 * - Per-cat evolution XP tracking with stage transitions
 * - Ability unlocks per evolution stage
 * - 7-day daily reward calendar
 *
 * 12 cats total:
 *   3 starters (pick 1 free, 2 others cost 500 gems each)
 *   8 unlockable via gems (750-3000)
 *   1 legendary (Chonky Monké) — requires 300+ days streak or 100 skills mastered
 */

import { create } from 'zustand';
import type { EvolutionStage, CatEvolutionData, DailyRewardDay } from './types';
import { EVOLUTION_XP_THRESHOLDS } from './types';
import { PersistenceManager, STORAGE_KEYS, createDebouncedSave, createImmediateSave } from './persistence';
import { CAT_CHARACTERS } from '@/components/Mascot/catCharacters';

/** Calculate evolution stage from accumulated XP */
export function stageFromXp(xp: number): EvolutionStage {
  if (xp >= EVOLUTION_XP_THRESHOLDS.master) return 'master';
  if (xp >= EVOLUTION_XP_THRESHOLDS.adult) return 'adult';
  if (xp >= EVOLUTION_XP_THRESHOLDS.teen) return 'teen';
  return 'baby';
}

/** Get XP needed for the next evolution stage, or null if at master */
export function xpToNextStage(xp: number): { nextStage: EvolutionStage; xpNeeded: number } | null {
  const current = stageFromXp(xp);
  const stages: EvolutionStage[] = ['baby', 'teen', 'adult', 'master'];
  const idx = stages.indexOf(current);
  if (idx >= stages.length - 1) return null;
  const next = stages[idx + 1];
  return { nextStage: next, xpNeeded: EVOLUTION_XP_THRESHOLDS[next] - xp };
}

const DEFAULT_DAILY_REWARDS: DailyRewardDay[] = [
  { day: 1, reward: { type: 'gems', amount: 10 }, claimed: false },
  { day: 2, reward: { type: 'gems', amount: 15 }, claimed: false },
  { day: 3, reward: { type: 'xp_boost', amount: 2 }, claimed: false },
  { day: 4, reward: { type: 'gems', amount: 20 }, claimed: false },
  { day: 5, reward: { type: 'streak_freeze', amount: 1 }, claimed: false },
  { day: 6, reward: { type: 'gems', amount: 30 }, claimed: false },
  { day: 7, reward: { type: 'chest', amount: 50 }, claimed: false },
];

function createDefaultEvolutionData(catId: string): CatEvolutionData {
  return {
    catId,
    currentStage: 'baby',
    xpAccumulated: 0,
    abilitiesUnlocked: [],
    evolvedAt: { baby: Date.now(), teen: null, adult: null, master: null },
  };
}

export interface CatEvolutionStoreState {
  selectedCatId: string;
  ownedCats: string[];
  evolutionData: Record<string, CatEvolutionData>;
  dailyRewards: {
    weekStartDate: string; // ISO date of week start
    days: DailyRewardDay[];
    currentDay: number; // 1-7 (derived from date, kept for compat)
  };

  /** ISO date when the daily challenge was last completed */
  lastDailyChallengeDate: string;

  // Chonky Monké unlock tracking
  chonkyUnlockProgress: {
    daysStreakReached: boolean;    // 300+ day streak
    skillsMasteredReached: boolean; // 100 skills mastered
  };

  // Actions
  selectCat: (catId: string) => void;
  unlockCat: (catId: string) => void;
  addEvolutionXp: (catId: string, amount: number) => EvolutionStage | null;
  getActiveAbilities: () => string[];
  claimDailyReward: (day: number) => DailyRewardDay['reward'] | null;
  resetDailyRewards: () => void;
  /** Advance the daily reward calendar based on the current date */
  advanceDailyRewardDate: () => void;
  /** Mark today's daily challenge as completed */
  completeDailyChallenge: () => void;
  /** Mark today's challenge as completed AND auto-claim today's reward.
   *  Returns the reward if successfully claimed, or null. */
  completeDailyChallengeAndClaim: () => DailyRewardDay['reward'] | null;
  /** Check if today's daily challenge has been completed */
  isDailyChallengeCompleted: () => boolean;
  checkChonkyEligibility: (streakDays: number, skillsMastered: number) => boolean;
  unlockChonky: () => void;
  initializeStarterCat: (catId: string) => void;
  reset: () => void;
}

type EvolutionData = Pick<
  CatEvolutionStoreState,
  'selectedCatId' | 'ownedCats' | 'evolutionData' | 'dailyRewards' | 'chonkyUnlockProgress' | 'lastDailyChallengeDate'
>;

const defaultData: EvolutionData = {
  selectedCatId: '',
  ownedCats: [],
  evolutionData: {},
  dailyRewards: {
    weekStartDate: getMondayOfWeek(),
    days: DEFAULT_DAILY_REWARDS.map(d => ({ ...d })),
    currentDay: 1,
  },
  lastDailyChallengeDate: '',
  chonkyUnlockProgress: {
    daysStreakReached: false,
    skillsMasteredReached: false,
  },
};

const debouncedSave = createDebouncedSave<EvolutionData>(STORAGE_KEYS.CAT_EVOLUTION, 500);
const immediateSave = createImmediateSave<EvolutionData>(STORAGE_KEYS.CAT_EVOLUTION);

/** Get today's ISO date string */
function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Get the Monday of the current week as ISO date string.
 *  This ensures day labels (Mon-Sun) always match real weekdays. */
function getMondayOfWeek(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

/** Calculate which day of the reward week it is (1=Mon ... 7=Sun), or 0 if week has expired */
function calcCurrentDay(weekStartDate: string): number {
  const start = new Date(weekStartDate + 'T00:00:00');
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0 || diffDays >= 7) return 0; // week expired or future
  return diffDays + 1; // 1-indexed (Mon=1 when weekStartDate is Monday)
}

export const useCatEvolutionStore = create<CatEvolutionStoreState>((set, get) => ({
  ...defaultData,

  selectCat: (catId: string) => {
    const state = get();
    if (!state.ownedCats.includes(catId)) return;
    set({ selectedCatId: catId });
    debouncedSave(get());
  },

  unlockCat: (catId: string) => {
    set((state) => {
      if (state.ownedCats.includes(catId)) return state;
      const newOwned = [...state.ownedCats, catId];
      const newEvolution = {
        ...state.evolutionData,
        [catId]: createDefaultEvolutionData(catId),
      };
      return { ownedCats: newOwned, evolutionData: newEvolution };
    });
    debouncedSave(get());
  },

  addEvolutionXp: (catId: string, amount: number) => {
    const state = get();
    let data = state.evolutionData[catId];
    // Auto-create evolution data if cat is owned but entry is missing
    if (!data) {
      if (!state.ownedCats.includes(catId)) return null;
      data = createDefaultEvolutionData(catId);
      set((prev) => ({
        evolutionData: { ...prev.evolutionData, [catId]: data! },
      }));
    }

    const oldStage = data.currentStage;
    const newXp = data.xpAccumulated + amount;
    const newStage = stageFromXp(newXp);
    const evolved = newStage !== oldStage;

    const updatedData: CatEvolutionData = {
      ...data,
      xpAccumulated: newXp,
      currentStage: newStage,
      evolvedAt: evolved
        ? { ...data.evolvedAt, [newStage]: Date.now() }
        : data.evolvedAt,
      abilitiesUnlocked: evolved
        ? unlockAbilitiesForStage(catId, newStage, data.abilitiesUnlocked)
        : data.abilitiesUnlocked,
    };

    set((prev) => ({
      evolutionData: {
        ...prev.evolutionData,
        [catId]: updatedData,
      },
    }));
    debouncedSave(get());

    return evolved ? newStage : null;
  },

  getActiveAbilities: () => {
    const state = get();
    const data = state.evolutionData[state.selectedCatId];
    if (!data) return [];
    return data.abilitiesUnlocked;
  },

  claimDailyReward: (day: number) => {
    const state = get();

    // Calculate which day it actually is based on the calendar
    const actualDay = calcCurrentDay(state.dailyRewards.weekStartDate);
    if (actualDay === 0) return null; // week expired — need reset first
    if (day > actualDay) return null; // can't claim future days

    // Claiming ANY reward (today or past catch-up) requires completing
    // today's daily challenge first — prevents free-tapping the whole week
    if (state.lastDailyChallengeDate !== todayISO()) return null;

    const dayData = state.dailyRewards.days.find(d => d.day === day);
    if (!dayData || dayData.claimed) return null;

    set((prev) => ({
      dailyRewards: {
        ...prev.dailyRewards,
        days: prev.dailyRewards.days.map(d =>
          d.day === day ? { ...d, claimed: true } : d,
        ),
        currentDay: actualDay,
      },
    }));
    debouncedSave(get());
    return dayData.reward;
  },

  resetDailyRewards: () => {
    const monday = getMondayOfWeek();
    const actualDay = calcCurrentDay(monday);
    set({
      dailyRewards: {
        weekStartDate: monday,
        days: DEFAULT_DAILY_REWARDS.map(d => ({ ...d })),
        currentDay: actualDay || 1,
      },
    });
    debouncedSave(get());
  },

  advanceDailyRewardDate: () => {
    const state = get();
    const monday = getMondayOfWeek();
    const storedStart = state.dailyRewards.weekStartDate;

    // If the stored weekStartDate isn't the current week's Monday, reset
    if (storedStart !== monday) {
      const actualDay = calcCurrentDay(monday);
      set({
        dailyRewards: {
          weekStartDate: monday,
          days: DEFAULT_DAILY_REWARDS.map(d => ({ ...d })),
          currentDay: actualDay || 1,
        },
      });
      debouncedSave(get());
      return;
    }

    const actualDay = calcCurrentDay(storedStart);
    if (actualDay === 0) {
      // Week has expired — auto-reset to current Monday
      set({
        dailyRewards: {
          weekStartDate: monday,
          days: DEFAULT_DAILY_REWARDS.map(d => ({ ...d })),
          currentDay: 1,
        },
      });
    } else if (actualDay !== state.dailyRewards.currentDay) {
      // Advance currentDay + sanitize stale future claims
      set((prev) => ({
        dailyRewards: {
          ...prev.dailyRewards,
          currentDay: actualDay,
          days: prev.dailyRewards.days.map(d =>
            d.day > actualDay ? { ...d, claimed: false } : d,
          ),
        },
      }));
    }
    debouncedSave(get());
  },

  completeDailyChallenge: () => {
    set({ lastDailyChallengeDate: todayISO() });
    // Critical: save immediately so the date isn't lost if user navigates away
    immediateSave(get());
  },

  completeDailyChallengeAndClaim: () => {
    // 1. Mark challenge as completed
    set({ lastDailyChallengeDate: todayISO() });

    // 2. Auto-claim today's reward
    const state = get();
    const actualDay = calcCurrentDay(state.dailyRewards.weekStartDate);
    if (actualDay === 0) {
      immediateSave(state);
      return null;
    }

    const dayData = state.dailyRewards.days.find(d => d.day === actualDay);
    if (!dayData || dayData.claimed) {
      immediateSave(state);
      return dayData?.claimed ? dayData.reward : null;
    }

    set((prev) => ({
      dailyRewards: {
        ...prev.dailyRewards,
        days: prev.dailyRewards.days.map(d =>
          d.day === actualDay ? { ...d, claimed: true } : d,
        ),
        currentDay: actualDay,
      },
    }));
    immediateSave(get());
    return dayData.reward;
  },

  isDailyChallengeCompleted: () => {
    return get().lastDailyChallengeDate === todayISO();
  },

  checkChonkyEligibility: (streakDays: number, skillsMastered: number) => {
    const daysReached = streakDays >= 300;
    const skillsReached = skillsMastered >= 100;

    set({
      chonkyUnlockProgress: {
        daysStreakReached: daysReached,
        skillsMasteredReached: skillsReached,
      },
    });

    // Either condition unlocks Chonky
    return daysReached || skillsReached;
  },

  unlockChonky: () => {
    const state = get();
    if (state.ownedCats.includes('chonky-monke')) return;

    set((prev) => ({
      ownedCats: [...prev.ownedCats, 'chonky-monke'],
      evolutionData: {
        ...prev.evolutionData,
        'chonky-monke': createDefaultEvolutionData('chonky-monke'),
      },
    }));
    debouncedSave(get());
  },

  initializeStarterCat: (catId: string) => {
    const state = get();
    if (state.ownedCats.length > 0) return; // Already initialized

    set({
      selectedCatId: catId,
      ownedCats: [catId],
      evolutionData: {
        [catId]: createDefaultEvolutionData(catId),
      },
    });
    debouncedSave(get());
  },

  reset: () => {
    set(defaultData);
    PersistenceManager.deleteState(STORAGE_KEYS.CAT_EVOLUTION);
  },
}));

/** Unlock abilities for a cat at a given stage */
function unlockAbilitiesForStage(
  catId: string,
  stage: EvolutionStage,
  currentAbilities: string[],
): string[] {
  const cat = CAT_CHARACTERS.find(c => c.id === catId);
  if (!cat?.abilities) return currentAbilities;

  const stageOrder: EvolutionStage[] = ['baby', 'teen', 'adult', 'master'];
  const stageIdx = stageOrder.indexOf(stage);

  const eligible = cat.abilities
    .filter(a => stageOrder.indexOf(a.unlockedAtStage) <= stageIdx)
    .map(a => a.id);

  const merged = new Set([...currentAbilities, ...eligible]);
  return Array.from(merged);
}

/** Validate persisted cat ownership — strip legendary cats without valid unlock */
function validateOwnedCats(data: EvolutionData): EvolutionData {
  const validCatIds = new Set(CAT_CHARACTERS.map(c => c.id));
  const legendaryIds = new Set(
    CAT_CHARACTERS.filter(c => c.legendary).map(c => c.id),
  );

  const validOwned = data.ownedCats.filter(catId => {
    // Remove cats that no longer exist in the roster
    if (!validCatIds.has(catId)) return false;

    // Legendary cats require proof of unlock (chonkyUnlockProgress flags)
    if (legendaryIds.has(catId)) {
      const progress = data.chonkyUnlockProgress;
      return progress.daysStreakReached || progress.skillsMasteredReached;
    }

    return true;
  });

  // If selected cat was removed, fall back to first owned cat
  const selectedValid = validOwned.includes(data.selectedCatId);
  const selectedCatId = selectedValid
    ? data.selectedCatId
    : (validOwned[0] ?? '');

  // Ensure every owned cat has evolution data (auto-create if missing)
  const cleanedEvolution: Record<string, CatEvolutionData> = {};
  for (const catId of validOwned) {
    cleanedEvolution[catId] = data.evolutionData[catId] ?? createDefaultEvolutionData(catId);
  }

  return {
    ...data,
    ownedCats: validOwned,
    selectedCatId,
    evolutionData: cleanedEvolution,
  };
}

/** Hydrate evolution store from AsyncStorage on app launch */
export async function hydrateCatEvolutionStore(): Promise<void> {
  const data = await PersistenceManager.loadState<EvolutionData>(
    STORAGE_KEYS.CAT_EVOLUTION,
    defaultData,
  );
  const validated = validateOwnedCats(data);
  useCatEvolutionStore.setState(validated);
}
