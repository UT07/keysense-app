/**
 * Sync Service Tests
 * Tests SyncManager including:
 * - Offline queue (queueChange, max 100 items, drops oldest)
 * - flushQueue (flush via syncProgress, retry logic, max retries)
 * - syncAfterExercise (queues + flushes)
 * - Periodic sync (start/stop/isActive)
 * - syncAll (returns SyncResult, prevents concurrent syncs)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('../config', () => ({
  auth: { currentUser: { uid: 'test-user' } },
  db: {},
}));

jest.mock('../firestore', () => ({
  syncProgress: jest.fn(),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { syncProgress } from '../firestore';
import { SyncManager, SyncChange } from '../syncService';

const mockSyncProgress = syncProgress as jest.Mock;
const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

// ============================================================================
// Helpers
// ============================================================================

function createChange(overrides: Partial<SyncChange> = {}): SyncChange {
  return {
    type: 'exercise_completed',
    data: { exerciseId: 'lesson-01-ex-01', score: 85 },
    timestamp: Date.now(),
    retryCount: 0,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SyncManager', () => {
  let manager: SyncManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    manager = new SyncManager();

    // Default: empty queue in AsyncStorage
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    manager.stopPeriodicSync();
    jest.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // 1. Offline Queue
  // --------------------------------------------------------------------------

  describe('queueChange', () => {
    it('should save a change to AsyncStorage', async () => {
      const change = createChange();

      await manager.queueChange(change);

      expect(mockSetItem).toHaveBeenCalledWith(
        'keysense_sync_queue',
        expect.any(String)
      );

      // Verify the saved data contains the change
      const savedJson = mockSetItem.mock.calls[0][1];
      const savedQueue = JSON.parse(savedJson);
      expect(savedQueue).toHaveLength(1);
      expect(savedQueue[0].type).toBe('exercise_completed');
    });

    it('should append to existing queue', async () => {
      const existingQueue = [createChange({ timestamp: 1000 })];
      mockGetItem.mockResolvedValue(JSON.stringify(existingQueue));

      const newChange = createChange({ timestamp: 2000 });
      await manager.queueChange(newChange);

      const savedJson = mockSetItem.mock.calls[0][1];
      const savedQueue = JSON.parse(savedJson);
      expect(savedQueue).toHaveLength(2);
    });

    it('should enforce max 100 items by dropping oldest', async () => {
      // Create a queue of 100 items
      const fullQueue = Array.from({ length: 100 }, (_, i) =>
        createChange({ timestamp: i })
      );
      mockGetItem.mockResolvedValue(JSON.stringify(fullQueue));

      const newChange = createChange({ timestamp: 999 });
      await manager.queueChange(newChange);

      const savedJson = mockSetItem.mock.calls[0][1];
      const savedQueue = JSON.parse(savedJson);
      expect(savedQueue).toHaveLength(100);

      // Oldest item (timestamp: 0) should be dropped
      expect(savedQueue[0].timestamp).toBe(1);
      // Newest item should be the one we just added
      expect(savedQueue[savedQueue.length - 1].timestamp).toBe(999);
    });

    it('should handle different change types', async () => {
      await manager.queueChange(createChange({ type: 'xp_earned', data: { amount: 50 } }));

      const savedJson = mockSetItem.mock.calls[0][1];
      const savedQueue = JSON.parse(savedJson);
      expect(savedQueue[0].type).toBe('xp_earned');
    });

    it('should initialize retryCount to 0', async () => {
      const change = createChange();
      await manager.queueChange(change);

      const savedJson = mockSetItem.mock.calls[0][1];
      const savedQueue = JSON.parse(savedJson);
      expect(savedQueue[0].retryCount).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. flushQueue
  // --------------------------------------------------------------------------

  describe('flushQueue', () => {
    it('should call syncProgress with queued changes', async () => {
      const queue = [createChange()];
      mockGetItem.mockResolvedValue(JSON.stringify(queue));
      mockSyncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      await manager.flushQueue();

      expect(mockSyncProgress).toHaveBeenCalledWith(
        'test-user',
        expect.objectContaining({
          localChanges: expect.any(Array),
        })
      );
    });

    it('should clear queue on successful flush', async () => {
      const queue = [createChange()];
      mockGetItem.mockResolvedValue(JSON.stringify(queue));
      mockSyncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      await manager.flushQueue();

      // Should clear queue after success
      expect(mockRemoveItem).toHaveBeenCalledWith('keysense_sync_queue');
    });

    it('should increment retryCount on failure', async () => {
      const queue = [createChange({ retryCount: 0 })];
      mockGetItem.mockResolvedValue(JSON.stringify(queue));
      mockSyncProgress.mockRejectedValue(new Error('Network error'));

      await manager.flushQueue();

      // Queue should be saved back with incremented retryCount
      const savedJson = mockSetItem.mock.calls[0][1];
      const savedQueue = JSON.parse(savedJson);
      expect(savedQueue[0].retryCount).toBe(1);
    });

    it('should drop items that exceed max retries (3)', async () => {
      const queue = [
        createChange({ retryCount: 3, timestamp: 1 }),
        createChange({ retryCount: 1, timestamp: 2 }),
      ];
      mockGetItem.mockResolvedValue(JSON.stringify(queue));
      mockSyncProgress.mockRejectedValue(new Error('Network error'));

      await manager.flushQueue();

      // Only item with retryCount < 3 should remain (with incremented count)
      const savedJson = mockSetItem.mock.calls[0][1];
      const savedQueue = JSON.parse(savedJson);
      expect(savedQueue).toHaveLength(1);
      expect(savedQueue[0].timestamp).toBe(2);
      expect(savedQueue[0].retryCount).toBe(2);
    });

    it('should do nothing if queue is empty', async () => {
      mockGetItem.mockResolvedValue(null);

      await manager.flushQueue();

      expect(mockSyncProgress).not.toHaveBeenCalled();
    });

    it('should do nothing if no authenticated user', async () => {
      // Override auth mock to have no user
      const config = require('../config');
      const originalUser = config.auth.currentUser;
      config.auth.currentUser = null;

      const queue = [createChange()];
      mockGetItem.mockResolvedValue(JSON.stringify(queue));

      await manager.flushQueue();

      expect(mockSyncProgress).not.toHaveBeenCalled();

      // Restore
      config.auth.currentUser = originalUser;
    });

    it('should save last sync timestamp on success', async () => {
      const queue = [createChange()];
      mockGetItem.mockResolvedValue(JSON.stringify(queue));
      const now = Date.now();
      mockSyncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: now,
        conflicts: [],
      });

      await manager.flushQueue();

      // Should save the new sync timestamp
      expect(mockSetItem).toHaveBeenCalledWith(
        'keysense_last_sync',
        expect.any(String)
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. syncAfterExercise
  // --------------------------------------------------------------------------

  describe('syncAfterExercise', () => {
    it('should queue an exercise_completed change', async () => {
      mockSyncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      await manager.syncAfterExercise('lesson-01-ex-01', { overall: 85, stars: 2 });

      // Should have saved to queue
      expect(mockSetItem).toHaveBeenCalledWith(
        'keysense_sync_queue',
        expect.any(String)
      );

      // Verify queued change
      const savedJson = mockSetItem.mock.calls[0][1];
      const savedQueue = JSON.parse(savedJson);
      expect(savedQueue[0].type).toBe('exercise_completed');
      expect(savedQueue[0].data.exerciseId).toBe('lesson-01-ex-01');
    });

    it('should attempt to flush immediately after queuing', async () => {
      // Start with a change already queued
      const existingQueue = [createChange()];
      mockGetItem
        .mockResolvedValueOnce(JSON.stringify([])) // queueChange reads empty
        .mockResolvedValueOnce(JSON.stringify(existingQueue)); // flushQueue reads

      mockSyncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      await manager.syncAfterExercise('lesson-01-ex-01', { overall: 90, stars: 3 });

      // syncProgress should be called (from flush)
      expect(mockSyncProgress).toHaveBeenCalled();
    });

    it('should not throw if flush fails', async () => {
      mockSyncProgress.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(
        manager.syncAfterExercise('lesson-01-ex-01', { overall: 50, stars: 1 })
      ).resolves.not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Periodic Sync
  // --------------------------------------------------------------------------

  describe('Periodic Sync', () => {
    it('should not be active initially', () => {
      expect(manager.isPeriodicSyncActive()).toBe(false);
    });

    it('should start periodic sync', () => {
      manager.startPeriodicSync(60000);

      expect(manager.isPeriodicSyncActive()).toBe(true);
    });

    it('should stop periodic sync', () => {
      manager.startPeriodicSync(60000);
      manager.stopPeriodicSync();

      expect(manager.isPeriodicSyncActive()).toBe(false);
    });

    it('should use default interval of 300000ms (5 min) if not specified', () => {
      manager.startPeriodicSync();

      expect(manager.isPeriodicSyncActive()).toBe(true);

      // Advance less than 5 minutes -- should not flush
      jest.advanceTimersByTime(299999);
      expect(mockSyncProgress).not.toHaveBeenCalled();
    });

    it('should flush on each interval tick', async () => {
      const queue = [createChange()];
      mockGetItem.mockResolvedValue(JSON.stringify(queue));
      mockSyncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      manager.startPeriodicSync(1000);

      // Advance past one interval
      jest.advanceTimersByTime(1001);

      // Wait for async operations
      await Promise.resolve();

      expect(mockGetItem).toHaveBeenCalled();
    });

    it('should not start multiple timers if called twice', () => {
      manager.startPeriodicSync(1000);
      manager.startPeriodicSync(1000);

      // Stop once should be enough
      manager.stopPeriodicSync();
      expect(manager.isPeriodicSyncActive()).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. syncAll
  // --------------------------------------------------------------------------

  describe('syncAll', () => {
    it('should return a SyncResult on success', async () => {
      mockGetItem.mockResolvedValue(null); // empty queue
      mockSyncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      const result = await manager.syncAll();

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          changesUploaded: expect.any(Number),
          changesDownloaded: expect.any(Number),
          conflicts: expect.any(Number),
        })
      );
    });

    it('should prevent concurrent syncs', async () => {
      // Make syncProgress hang
      let resolveSync: (value: unknown) => void;
      const hangingPromise = new Promise(resolve => { resolveSync = resolve; });
      mockSyncProgress.mockReturnValue(hangingPromise);

      const queue = [createChange()];
      mockGetItem.mockResolvedValue(JSON.stringify(queue));

      // Start first sync
      const sync1Promise = manager.syncAll();

      // Start second sync immediately
      const sync2Result = await manager.syncAll();

      // Second sync should return failure (concurrent guard)
      expect(sync2Result.success).toBe(false);

      // Clean up
      resolveSync!({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });
      await sync1Promise;
    });

    it('should report changesUploaded from flushed queue', async () => {
      const queue = [createChange(), createChange({ timestamp: 2000 })];
      mockGetItem.mockResolvedValue(JSON.stringify(queue));
      mockSyncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      const result = await manager.syncAll();

      expect(result.changesUploaded).toBe(2);
    });

    it('should report changesDownloaded from server response', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([createChange()]));
      mockSyncProgress.mockResolvedValue({
        serverChanges: [
          { id: 's1', type: 'xp_earned' },
          { id: 's2', type: 'streak_updated' },
        ],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      const result = await manager.syncAll();

      expect(result.changesDownloaded).toBe(2);
    });

    it('should report conflicts from server response', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify([createChange()]));
      mockSyncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [
          { field: 'exercise_completed', resolution: 'server' },
        ],
      });

      const result = await manager.syncAll();

      expect(result.conflicts).toBe(1);
    });

    it('should return success: false if flush fails', async () => {
      const queue = [createChange()];
      mockGetItem.mockResolvedValue(JSON.stringify(queue));
      mockSyncProgress.mockRejectedValue(new Error('Server down'));

      const result = await manager.syncAll();

      expect(result.success).toBe(false);
    });

    it('should flush queue before sync', async () => {
      const queue = [createChange()];
      mockGetItem.mockResolvedValue(JSON.stringify(queue));
      mockSyncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      await manager.syncAll();

      expect(mockSyncProgress).toHaveBeenCalled();
    });
  });
});
