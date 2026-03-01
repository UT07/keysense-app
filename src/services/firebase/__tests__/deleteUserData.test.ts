/**
 * Delete User Data Tests
 *
 * Tests the deleteUserData function and its client-side fallback:
 * - Cloud Function primary path
 * - Client-side fallback when Cloud Function fails
 * - Subcollection deletion
 * - Cross-collection cleanup (friend codes, leagues, challenges, friend lists)
 */

// ============================================================================
// Mocks
// ============================================================================

const mockBatchDelete = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args: string[]) => ({ path: args.join('/'), id: args[args.length - 1] })),
  collection: jest.fn((...args: string[]) => ({ path: args.join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  getDocs: jest.fn(),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn((...args: unknown[]) => ({ type: 'where', args })),
  orderBy: jest.fn(),
  limit: jest.fn((...args: unknown[]) => ({ type: 'limit', args })),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  writeBatch: jest.fn(() => ({
    delete: mockBatchDelete,
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
  Timestamp: { fromMillis: jest.fn((ms: number) => ({ toMillis: () => ms })) },
  FieldValue: {},
  increment: jest.fn((n: number) => ({ type: 'increment', value: n })),
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(),
}));

jest.mock('../config', () => ({
  db: {},
  functions: {},
  auth: { currentUser: { uid: 'test-uid' } },
}));

// Mock leagueStore -- will be required dynamically
jest.mock('../../../stores/leagueStore', () => ({
  useLeagueStore: {
    getState: jest.fn(() => ({
      membership: null,
    })),
  },
}));

// Mock leagueService -- will be required dynamically
jest.mock('../leagueService', () => ({
  getCurrentWeekMonday: jest.fn(() => '2026-02-23'),
}));

// ============================================================================
// Imports
// ============================================================================

import { deleteUserData } from '../firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteDoc, getDocs, getDoc } from 'firebase/firestore';

const mockHttpsCallable = httpsCallable as jest.Mock;
const mockGetDocs = getDocs as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockDeleteDoc = deleteDoc as jest.Mock;

// ============================================================================
// Helpers
// ============================================================================

function mockEmptyQuerySnapshot() {
  return { empty: true, docs: [], size: 0 };
}

function mockQuerySnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map((d) => ({
      id: d.id,
      ref: { path: `mock/${d.id}`, id: d.id, parent: { parent: { path: 'leagues/league-1', id: 'league-1' } } },
      data: () => d.data,
    })),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('deleteUserData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBatchDelete.mockClear();
    mockBatchUpdate.mockClear();
    mockBatchCommit.mockClear().mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
  });

  // --------------------------------------------------------------------------
  // 1. Cloud Function path
  // --------------------------------------------------------------------------

  describe('Cloud Function primary path', () => {
    it('should call Cloud Function and return on success', async () => {
      const mockCallable = jest.fn().mockResolvedValue({
        data: { success: true, deletedDocuments: 42 },
      });
      mockHttpsCallable.mockReturnValue(mockCallable);

      await deleteUserData('test-uid');

      expect(mockHttpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        'deleteUserAllData',
      );
      expect(mockCallable).toHaveBeenCalledWith({});
      // Should NOT call client-side deleteDoc (root document)
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('should fall back to client-side when Cloud Function fails', async () => {
      const mockCallable = jest.fn().mockRejectedValue(new Error('UNAVAILABLE'));
      mockHttpsCallable.mockReturnValue(mockCallable);

      // Mock all client-side getDocs calls to return empty
      mockGetDocs.mockResolvedValue(mockEmptyQuerySnapshot());

      await deleteUserData('test-uid');

      // Should have attempted Cloud Function
      expect(mockCallable).toHaveBeenCalled();
      // Should have fallen back to client-side (deleteDoc for root doc)
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should fall back when Cloud Function returns failure', async () => {
      const mockCallable = jest.fn().mockResolvedValue({
        data: { success: false, deletedDocuments: 0 },
      });
      mockHttpsCallable.mockReturnValue(mockCallable);

      // Mock all client-side getDocs calls to return empty
      mockGetDocs.mockResolvedValue(mockEmptyQuerySnapshot());

      await deleteUserData('test-uid');

      // Should fall back to client-side
      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 2. Client-side fallback
  // --------------------------------------------------------------------------

  describe('Client-side fallback', () => {
    beforeEach(() => {
      // Make Cloud Function always fail so we exercise client-side path
      const mockCallable = jest.fn().mockRejectedValue(new Error('UNAVAILABLE'));
      mockHttpsCallable.mockReturnValue(mockCallable);
    });

    it('should delete all known subcollections', async () => {
      // First call per subcollection returns docs, second returns empty (pagination end)
      let callCount = 0;
      mockGetDocs.mockImplementation(() => {
        callCount++;
        // Odd calls return 1 doc (first page), even calls return empty (end)
        if (callCount % 2 === 1) {
          return Promise.resolve(mockQuerySnapshot([
            { id: `doc-${callCount}`, data: { someField: 'value' } },
          ]));
        }
        return Promise.resolve(mockEmptyQuerySnapshot());
      });

      await deleteUserData('test-uid');

      // Should have called batch.delete for subcollection docs
      expect(mockBatchDelete).toHaveBeenCalled();
      expect(mockBatchCommit).toHaveBeenCalled();

      // Should have deleted the root user doc
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should delete friend codes for the user', async () => {
      // Return a friend code doc for the friendCodes query
      let callIndex = 0;
      mockGetDocs.mockImplementation(() => {
        callIndex++;
        // The friends subcollection read (for removeFromFriendLists) - call 1
        if (callIndex === 1) {
          return Promise.resolve(mockEmptyQuerySnapshot());
        }
        // The friendCodes query - call 2
        if (callIndex === 2) {
          return Promise.resolve(mockQuerySnapshot([
            { id: 'ABC123', data: { uid: 'test-uid' } },
          ]));
        }
        // Everything else empty
        return Promise.resolve(mockEmptyQuerySnapshot());
      });

      await deleteUserData('test-uid');

      // Should have called batch.delete for the friend code
      expect(mockBatchDelete).toHaveBeenCalled();
    });

    it('should delete challenges where user is a participant', async () => {
      let callIndex = 0;
      mockGetDocs.mockImplementation(() => {
        callIndex++;
        // The challenges queries use Promise.all so they come as a pair
        // After friends (1), friendCodes (2), leagues (3), challenges from (4), challenges to (5)
        if (callIndex === 4 || callIndex === 5) {
          return Promise.resolve(mockQuerySnapshot([
            { id: `challenge-${callIndex}`, data: { fromUid: 'test-uid', toUid: 'friend-1' } },
          ]));
        }
        return Promise.resolve(mockEmptyQuerySnapshot());
      });

      await deleteUserData('test-uid');

      // batch.delete should have been called for challenges
      expect(mockBatchDelete).toHaveBeenCalled();
    });

    it('should remove user from other users friend lists', async () => {
      let callIndex = 0;
      mockGetDocs.mockImplementation(() => {
        callIndex++;
        // First call is the friends subcollection read
        if (callIndex === 1) {
          return Promise.resolve(mockQuerySnapshot([
            { id: 'friend-uid-1', data: { uid: 'friend-uid-1', status: 'accepted' } },
            { id: 'friend-uid-2', data: { uid: 'friend-uid-2', status: 'accepted' } },
          ]));
        }
        return Promise.resolve(mockEmptyQuerySnapshot());
      });

      await deleteUserData('test-uid');

      // Should delete reverse friend entries (one per friend)
      expect(mockBatchDelete).toHaveBeenCalled();
    });

    it('should delete league membership when leagueStore has membership', async () => {
      // Mock leagueStore to return a membership
      const { useLeagueStore } = require('../../../stores/leagueStore');
      (useLeagueStore.getState as jest.Mock).mockReturnValue({
        membership: { leagueId: 'league-abc', tier: 'bronze', weekStart: '2026-02-23' },
      });

      // Mock getDoc to return the member doc exists
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ uid: 'test-uid' }) });

      mockGetDocs.mockResolvedValue(mockEmptyQuerySnapshot());

      await deleteUserData('test-uid');

      // Should have called batch.delete for the league member
      expect(mockBatchDelete).toHaveBeenCalled();
      // Should have called batch.update to decrement memberCount
      expect(mockBatchUpdate).toHaveBeenCalled();
    });

    it('should handle empty subcollections gracefully', async () => {
      // All queries return empty
      mockGetDocs.mockResolvedValue(mockEmptyQuerySnapshot());

      await deleteUserData('test-uid');

      // Should still delete root document
      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should continue deletion even if a subcollection fails', async () => {
      let callIndex = 0;
      mockGetDocs.mockImplementation(() => {
        callIndex++;
        // Make one of the subcollection queries throw
        if (callIndex === 8) {
          return Promise.reject(new Error('Permission denied'));
        }
        return Promise.resolve(mockEmptyQuerySnapshot());
      });

      // Should not throw
      await deleteUserData('test-uid');

      // Should still delete root document
      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });
});
