/**
 * League Store Tests
 *
 * Tests league membership, standings, weekly XP updates,
 * reset, and persistence hydration.
 */

import type { LeagueMembership } from '../types';

// Mock persistence layer
jest.mock('../persistence', () => ({
  createDebouncedSave: () => jest.fn(),
  createImmediateSave: () => jest.fn(),
  PersistenceManager: {
    loadState: jest.fn().mockResolvedValue({}),
    saveState: jest.fn().mockResolvedValue(undefined),
    deleteState: jest.fn().mockResolvedValue(undefined),
  },
  STORAGE_KEYS: { SOCIAL: 'test_social', LEAGUE: 'test_league' },
}));

import { useLeagueStore, hydrateLeagueStore } from '../leagueStore';
import type { LeagueStandingEntry } from '../leagueStore';
import { PersistenceManager } from '../persistence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get current week's Monday as ISO date (matches leagueStore.getCurrentWeekMonday) */
function getCurrentWeekMonday(): string {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const daysFromMonday = utcDay === 0 ? 6 : utcDay - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - daysFromMonday);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0];
}

function makeMembership(overrides: Partial<LeagueMembership> = {}): LeagueMembership {
  return {
    leagueId: 'league-abc',
    tier: 'bronze',
    weekStart: getCurrentWeekMonday(),
    weeklyXp: 0,
    rank: 1,
    totalMembers: 10,
    ...overrides,
  };
}

function makeStanding(overrides: Partial<LeagueStandingEntry> = {}): LeagueStandingEntry {
  return {
    uid: 'user-1',
    displayName: 'Player 1',
    selectedCatId: 'jazzy',
    weeklyXp: 500,
    rank: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('leagueStore', () => {
  beforeEach(() => {
    useLeagueStore.getState().reset();
  });

  describe('initial state', () => {
    it('starts with null membership and empty standings', () => {
      const state = useLeagueStore.getState();
      expect(state.membership).toBeNull();
      expect(state.standings).toEqual([]);
      expect(state.isLoadingStandings).toBe(false);
    });
  });

  describe('membership', () => {
    it('sets membership', () => {
      const membership = makeMembership();
      useLeagueStore.getState().setMembership(membership);

      expect(useLeagueStore.getState().membership).toEqual(membership);
    });

    it('clears membership with null', () => {
      useLeagueStore.getState().setMembership(makeMembership());
      useLeagueStore.getState().setMembership(null);

      expect(useLeagueStore.getState().membership).toBeNull();
    });

    it('replaces existing membership', () => {
      useLeagueStore.getState().setMembership(makeMembership({ tier: 'bronze' }));
      useLeagueStore.getState().setMembership(makeMembership({ tier: 'silver' }));

      expect(useLeagueStore.getState().membership?.tier).toBe('silver');
    });
  });

  describe('weekly XP', () => {
    it('updates weekly XP when membership exists', () => {
      useLeagueStore.getState().setMembership(makeMembership({ weeklyXp: 0 }));
      useLeagueStore.getState().updateWeeklyXp(150);

      expect(useLeagueStore.getState().membership?.weeklyXp).toBe(150);
    });

    it('does nothing when no membership', () => {
      // No membership set
      useLeagueStore.getState().updateWeeklyXp(100);

      expect(useLeagueStore.getState().membership).toBeNull();
    });

    it('overwrites previous weekly XP', () => {
      useLeagueStore.getState().setMembership(makeMembership({ weeklyXp: 50 }));
      useLeagueStore.getState().updateWeeklyXp(200);

      expect(useLeagueStore.getState().membership?.weeklyXp).toBe(200);
    });
  });

  describe('standings', () => {
    it('sets standings', () => {
      const standings = [
        makeStanding({ uid: 'u1', rank: 1, weeklyXp: 500 }),
        makeStanding({ uid: 'u2', rank: 2, weeklyXp: 300 }),
      ];
      useLeagueStore.getState().setStandings(standings);

      expect(useLeagueStore.getState().standings).toHaveLength(2);
      expect(useLeagueStore.getState().standings[0].uid).toBe('u1');
    });

    it('replaces existing standings', () => {
      useLeagueStore.getState().setStandings([makeStanding({ uid: 'old' })]);
      useLeagueStore.getState().setStandings([makeStanding({ uid: 'new' })]);

      expect(useLeagueStore.getState().standings).toHaveLength(1);
      expect(useLeagueStore.getState().standings[0].uid).toBe('new');
    });

    it('loading standings flag', () => {
      useLeagueStore.getState().setLoadingStandings(true);
      expect(useLeagueStore.getState().isLoadingStandings).toBe(true);

      useLeagueStore.getState().setLoadingStandings(false);
      expect(useLeagueStore.getState().isLoadingStandings).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets all state to defaults', () => {
      useLeagueStore.getState().setMembership(makeMembership());
      useLeagueStore.getState().setStandings([makeStanding()]);
      useLeagueStore.getState().setLoadingStandings(true);

      useLeagueStore.getState().reset();

      const state = useLeagueStore.getState();
      expect(state.membership).toBeNull();
      expect(state.standings).toEqual([]);
      expect(state.isLoadingStandings).toBe(false);
    });

    it('calls PersistenceManager.deleteState', () => {
      useLeagueStore.getState().reset();
      expect(PersistenceManager.deleteState).toHaveBeenCalled();
    });
  });

  describe('hydration', () => {
    it('hydrates membership from persistence', async () => {
      const savedData = {
        membership: makeMembership({ weeklyXp: 300, rank: 3 }),
      };
      (PersistenceManager.loadState as jest.Mock).mockResolvedValueOnce(savedData);

      await hydrateLeagueStore();

      const state = useLeagueStore.getState();
      expect(state.membership?.weeklyXp).toBe(300);
      expect(state.membership?.rank).toBe(3);
    });

    it('hydration does not restore standings (transient)', async () => {
      const savedData = {
        membership: makeMembership(),
      };
      (PersistenceManager.loadState as jest.Mock).mockResolvedValueOnce(savedData);

      await hydrateLeagueStore();

      const state = useLeagueStore.getState();
      expect(state.standings).toEqual([]);
      expect(state.isLoadingStandings).toBe(false);
    });

    it('hydrates with null membership when storage is empty', async () => {
      (PersistenceManager.loadState as jest.Mock).mockResolvedValueOnce({
        membership: null,
      });

      await hydrateLeagueStore();

      expect(useLeagueStore.getState().membership).toBeNull();
    });
  });
});
