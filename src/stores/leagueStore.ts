/**
 * League Store
 *
 * Manages league membership and standings:
 * - Current league membership (tier, weekly XP, rank)
 * - Standings leaderboard (transient, not persisted)
 * - Only membership is persisted to AsyncStorage
 */

import { create } from 'zustand';
import type { LeagueMembership } from './types';
import { PersistenceManager, STORAGE_KEYS, createDebouncedSave } from './persistence';

export interface LeagueStandingEntry {
  uid: string;
  displayName: string;
  selectedCatId: string;
  weeklyXp: number;
  rank: number;
}

export interface LeagueStoreState {
  membership: LeagueMembership | null;
  standings: LeagueStandingEntry[];
  isLoadingStandings: boolean;

  // Actions
  setMembership: (membership: LeagueMembership | null) => void;
  setStandings: (standings: LeagueStandingEntry[]) => void;
  setLoadingStandings: (loading: boolean) => void;
  updateWeeklyXp: (xp: number) => void;
  reset: () => void;
}

type LeagueData = Pick<LeagueStoreState, 'membership'>;

const defaultData: LeagueData = {
  membership: null,
};

const defaultState: Omit<LeagueStoreState, 'setMembership' | 'setStandings' | 'setLoadingStandings' | 'updateWeeklyXp' | 'reset'> = {
  membership: null,
  standings: [],
  isLoadingStandings: false,
};

const debouncedSave = createDebouncedSave<LeagueData>(STORAGE_KEYS.LEAGUE, 500);

export const useLeagueStore = create<LeagueStoreState>((set, get) => ({
  ...defaultState,

  setMembership: (membership: LeagueMembership | null) => {
    set({ membership });
    debouncedSave({ membership });
  },

  setStandings: (standings: LeagueStandingEntry[]) => {
    set({ standings });
  },

  setLoadingStandings: (loading: boolean) => {
    set({ isLoadingStandings: loading });
  },

  updateWeeklyXp: (xp: number) => {
    const { membership } = get();
    if (!membership) return;
    const updated = { ...membership, weeklyXp: xp };
    set({ membership: updated });
    debouncedSave({ membership: updated });
  },

  reset: () => {
    set(defaultState);
    PersistenceManager.deleteState(STORAGE_KEYS.LEAGUE);
  },
}));

/** Hydrate league store from AsyncStorage on app launch */
export async function hydrateLeagueStore(): Promise<void> {
  const data = await PersistenceManager.loadState<LeagueData>(STORAGE_KEYS.LEAGUE, defaultData);
  useLeagueStore.setState({ ...data, standings: [], isLoadingStandings: false });
}
