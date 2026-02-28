/**
 * League Service Tests
 *
 * Tests the pure utility functions in leagueService:
 * - getCurrentWeekMonday() date format and correctness
 * - assignToLeague() — transaction-based league assignment
 * - getLeagueStandings() — ranked member list
 * - addLeagueXp() — atomic XP increment
 */

// Mock firebase/firestore with runTransaction support
jest.mock('firebase/firestore', () => {
  const transactionGet = jest.fn();
  const transactionSet = jest.fn();
  const transactionUpdate = jest.fn();

  return {
    doc: jest.fn((...args: string[]) => ({ id: args[args.length - 1] || 'mock-id' })),
    collection: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    updateDoc: jest.fn(),
    increment: jest.fn((n: number) => n),
    runTransaction: jest.fn(async (_db: unknown, fn: (t: unknown) => Promise<unknown>) => {
      const transaction = {
        get: transactionGet,
        set: transactionSet,
        update: transactionUpdate,
      };
      return fn(transaction);
    }),
    __mockTransaction: { get: transactionGet, set: transactionSet, update: transactionUpdate },
  };
});

jest.mock('../config', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
}));

import {
  getCurrentWeekMonday,
  assignToLeague,
  getLeagueStandings,
  addLeagueXp,
} from '../leagueService';
import { getDocs, updateDoc, increment, runTransaction } from 'firebase/firestore';

// Access the transaction mock helpers
const firestoreMock = jest.requireMock('firebase/firestore');
const mockTx = firestoreMock.__mockTransaction as {
  get: jest.Mock;
  set: jest.Mock;
  update: jest.Mock;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('leagueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentWeekMonday', () => {
    it('returns a string in YYYY-MM-DD format', () => {
      const monday = getCurrentWeekMonday();
      expect(monday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns a Monday (day 1 in UTC)', () => {
      const monday = getCurrentWeekMonday();
      const date = new Date(monday + 'T00:00:00Z');
      expect(date.getUTCDay()).toBe(1);
    });

    it('returns a date in the past or today', () => {
      const monday = getCurrentWeekMonday();
      const mondayDate = new Date(monday + 'T00:00:00Z');
      const now = new Date();

      expect(mondayDate.getTime()).toBeLessThanOrEqual(now.getTime());
    });

    it('returns the same Monday within a single week', () => {
      const first = getCurrentWeekMonday();
      const second = getCurrentWeekMonday();
      expect(first).toBe(second);
    });

    it('returns a date at most 6 days before today', () => {
      const monday = getCurrentWeekMonday();
      const mondayDate = new Date(monday + 'T00:00:00Z');
      const now = new Date();

      const diffMs = now.getTime() - mondayDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeLessThan(7);
      expect(diffDays).toBeGreaterThanOrEqual(0);
    });
  });

  describe('assignToLeague', () => {
    it('creates a new league via transaction when none have space', async () => {
      // No open leagues found
      (getDocs as jest.Mock).mockResolvedValue({ empty: true, docs: [] });

      const membership = await assignToLeague('user-1', 'Alice', 'luna', 'bronze');

      expect(membership.tier).toBe('bronze');
      expect(membership.weeklyXp).toBe(0);
      // Transaction used
      expect(runTransaction).toHaveBeenCalledTimes(1);
      // transaction.set called twice: league doc + member doc
      expect(mockTx.set).toHaveBeenCalledTimes(2);
    });

    it('joins existing league via transaction when space available', async () => {
      const mockLeagueSnap = {
        empty: false,
        docs: [
          {
            id: 'existing-league',
            data: () => ({
              tier: 'bronze',
              weekStart: getCurrentWeekMonday(),
              memberCount: 15,
              createdAt: Date.now(),
            }),
          },
        ],
      };
      (getDocs as jest.Mock).mockResolvedValue(mockLeagueSnap);
      mockTx.get.mockResolvedValue({
        exists: () => true,
        data: () => ({
          tier: 'bronze',
          weekStart: getCurrentWeekMonday(),
          memberCount: 15,
          createdAt: Date.now(),
        }),
      });

      const membership = await assignToLeague('user-2', 'Bob', 'jazzy');

      expect(membership.rank).toBe(16); // memberCount + 1
      expect(runTransaction).toHaveBeenCalledTimes(1);
      // transaction.set for member doc, transaction.update for memberCount increment
      expect(mockTx.set).toHaveBeenCalledTimes(1);
      expect(mockTx.update).toHaveBeenCalledTimes(1);
    });

    it('creates new league when candidate is full at transaction time', async () => {
      const mockLeagueSnap = {
        empty: false,
        docs: [
          {
            id: 'full-league',
            data: () => ({
              tier: 'bronze',
              weekStart: getCurrentWeekMonday(),
              memberCount: 28,
              createdAt: Date.now(),
            }),
          },
        ],
      };
      (getDocs as jest.Mock).mockResolvedValue(mockLeagueSnap);
      // At transaction time, league is full
      mockTx.get.mockResolvedValue({
        exists: () => true,
        data: () => ({
          tier: 'bronze',
          weekStart: getCurrentWeekMonday(),
          memberCount: 30,
          createdAt: Date.now(),
        }),
      });

      const membership = await assignToLeague('user-3', 'Carol', 'mini-meowww');

      expect(membership.rank).toBe(1); // First in new league
      // Creates new league + member
      expect(mockTx.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('getLeagueStandings', () => {
    it('returns members ranked by weeklyXp descending', async () => {
      const mockMembers = [
        { uid: 'u1', displayName: 'Alice', selectedCatId: 'luna', weeklyXp: 300, joinedAt: 1000 },
        { uid: 'u2', displayName: 'Bob', selectedCatId: 'jazzy', weeklyXp: 200, joinedAt: 2000 },
        { uid: 'u3', displayName: 'Carol', selectedCatId: 'mini-meowww', weeklyXp: 100, joinedAt: 3000 },
      ];
      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockMembers.map((m) => ({ data: () => m })),
      });

      const standings = await getLeagueStandings('league-abc');

      expect(standings).toHaveLength(3);
      expect(standings[0].rank).toBe(1);
      expect(standings[0].uid).toBe('u1');
      expect(standings[1].rank).toBe(2);
      expect(standings[2].rank).toBe(3);
    });

    it('returns empty array for empty league', async () => {
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

      const standings = await getLeagueStandings('empty-league');
      expect(standings).toEqual([]);
    });
  });

  describe('addLeagueXp', () => {
    it('calls updateDoc with increment for the member', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await addLeagueXp('league-abc', 'user-1', 50);

      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(increment).toHaveBeenCalledWith(50);
    });
  });
});
