/**
 * Social Service Tests
 *
 * Tests the pure utility functions in socialService:
 * - generateFriendCode() character set and length
 * - Code uniqueness across many generations
 * - Batch operations for friend requests / removal
 */

// Mock firebase/firestore with writeBatch support
jest.mock('firebase/firestore', () => {
  const batchSet = jest.fn();
  const batchUpdate = jest.fn();
  const batchDelete = jest.fn();
  const batchCommit = jest.fn().mockResolvedValue(undefined);

  return {
    doc: jest.fn(),
    collection: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    writeBatch: jest.fn(() => ({
      set: batchSet,
      update: batchUpdate,
      delete: batchDelete,
      commit: batchCommit,
    })),
    __mockBatch: { set: batchSet, update: batchUpdate, delete: batchDelete, commit: batchCommit },
  };
});

jest.mock('../config', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
}));

import {
  generateFriendCode,
  registerFriendCode,
  lookupFriendCode,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendConnection,
  getFriends,
} from '../socialService';
import { doc, getDoc, setDoc, getDocs, writeBatch } from 'firebase/firestore';

// Access the batch mock helpers
const firestoreMock = jest.requireMock('firebase/firestore');
const mockBatch = firestoreMock.__mockBatch as {
  set: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  commit: jest.Mock;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const EXCLUDED_CHARS = ['I', 'O', '0', '1'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('socialService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateFriendCode', () => {
    it('generates a 6-character code', () => {
      const code = generateFriendCode();
      expect(code).toHaveLength(6);
    });

    it('only uses characters from the allowed alphabet', () => {
      for (let i = 0; i < 100; i++) {
        const code = generateFriendCode();
        for (const char of code) {
          expect(VALID_CHARS).toContain(char);
        }
      }
    });

    it('never includes ambiguous characters (I, O, 0, 1)', () => {
      for (let i = 0; i < 200; i++) {
        const code = generateFriendCode();
        for (const excluded of EXCLUDED_CHARS) {
          expect(code).not.toContain(excluded);
        }
      }
    });

    it('generates mostly unique codes (>90% unique in 100 iterations)', () => {
      const codes = new Set<string>();
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        codes.add(generateFriendCode());
      }

      const uniqueRatio = codes.size / iterations;
      expect(uniqueRatio).toBeGreaterThan(0.9);
    });

    it('generates only uppercase letters and digits', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateFriendCode();
        expect(code).toMatch(/^[A-Z2-9]+$/);
      }
    });
  });

  describe('registerFriendCode', () => {
    it('registers a code when no collision occurs', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const code = await registerFriendCode('user-123');

      expect(code).toHaveLength(6);
      expect(setDoc).toHaveBeenCalledTimes(1);
    });

    it('retries on collision and succeeds', async () => {
      // First attempt: collision, second: success
      (getDoc as jest.Mock)
        .mockResolvedValueOnce({ exists: () => true })
        .mockResolvedValueOnce({ exists: () => false });
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const code = await registerFriendCode('user-123');

      expect(code).toHaveLength(6);
      expect(getDoc).toHaveBeenCalledTimes(2);
    });

    it('throws after max retries on persistent collision', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => true });

      await expect(registerFriendCode('user-123')).rejects.toThrow(
        'Failed to generate unique friend code',
      );
      expect(getDoc).toHaveBeenCalledTimes(5); // MAX_CODE_RETRIES
    });
  });

  describe('lookupFriendCode', () => {
    it('returns uid when code exists', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ uid: 'found-user' }),
      });

      const result = await lookupFriendCode('ABC123');
      expect(result).toBe('found-user');
    });

    it('returns null when code does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      const result = await lookupFriendCode('XXXXXX');
      expect(result).toBeNull();
    });

    it('normalizes code to uppercase', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      await lookupFriendCode('abc123');
      expect(doc).toHaveBeenCalledWith(expect.anything(), 'friendCodes', 'ABC123');
    });
  });

  describe('sendFriendRequest', () => {
    it('uses a batch to write both friend subcollections atomically', async () => {
      await sendFriendRequest(
        'user-a', 'user-b',
        'Alice', 'luna',
        'Bob', 'jazzy',
      );

      // Should create a writeBatch and commit it
      expect(writeBatch).toHaveBeenCalledTimes(1);
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);

      // Verify outgoing connection (first call)
      const outgoingData = mockBatch.set.mock.calls[0][1];
      expect(outgoingData.uid).toBe('user-b');
      expect(outgoingData.status).toBe('pending_outgoing');
      expect(outgoingData.displayName).toBe('Bob');
      // Verify incoming connection (second call)
      const incomingData = mockBatch.set.mock.calls[1][1];
      expect(incomingData.uid).toBe('user-a');
      expect(incomingData.status).toBe('pending_incoming');
      expect(incomingData.displayName).toBe('Alice');
    });
  });

  describe('acceptFriendRequest', () => {
    it('uses a batch to update both sides atomically', async () => {
      await acceptFriendRequest('my-uid', 'friend-uid');

      expect(writeBatch).toHaveBeenCalledTimes(1);
      expect(mockBatch.update).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);

      const call1 = mockBatch.update.mock.calls[0][1];
      const call2 = mockBatch.update.mock.calls[1][1];
      expect(call1.status).toBe('accepted');
      expect(call2.status).toBe('accepted');
    });
  });

  describe('removeFriendConnection', () => {
    it('uses a batch to delete both sides atomically', async () => {
      await removeFriendConnection('my-uid', 'friend-uid');

      expect(writeBatch).toHaveBeenCalledTimes(1);
      expect(mockBatch.delete).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFriends', () => {
    it('returns array of friend connections', async () => {
      const mockFriends = [
        { uid: 'f1', displayName: 'Alice', selectedCatId: 'luna', status: 'accepted', connectedAt: 1000 },
        { uid: 'f2', displayName: 'Bob', selectedCatId: 'jazzy', status: 'pending_incoming', connectedAt: 2000 },
      ];
      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockFriends.map((f) => ({ data: () => f })),
      });

      const result = await getFriends('user-123');

      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe('f1');
      expect(result[1].status).toBe('pending_incoming');
    });

    it('returns empty array when no friends', async () => {
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

      const result = await getFriends('lonely-user');
      expect(result).toEqual([]);
    });
  });
});
