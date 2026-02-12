/**
 * Persistence Layer Tests
 * Tests MMKV integration and state serialization
 */

import { PersistenceManager, STORAGE_KEYS, createDebouncedSave } from '../persistence';

describe('Persistence Manager', () => {
  beforeEach(async () => {
    // Clear all data before each test
    await PersistenceManager.clearAll();
  });

  describe('saveState and loadState', () => {
    it('should save and load simple state', async () => {
      const testData = {
        count: 42,
        name: 'test',
        active: true,
      };

      await PersistenceManager.saveState('test-key', testData);
      const loaded = await PersistenceManager.loadState('test-key', { count: 0, name: '', active: false });

      expect(loaded).toEqual(testData);
    });

    it('should handle complex objects', async () => {
      const testData = {
        user: {
          id: 'user-1',
          profile: {
            name: 'John',
            email: 'john@example.com',
          },
        },
        settings: {
          theme: 'dark',
          notifications: true,
        },
      };

      await PersistenceManager.saveState('complex-key', testData);
      const loaded = await PersistenceManager.loadState('complex-key', {});

      expect(loaded).toEqual(testData);
    });

    it('should handle arrays', async () => {
      const testData = {
        items: [
          { id: 1, name: 'item1' },
          { id: 2, name: 'item2' },
          { id: 3, name: 'item3' },
        ],
      };

      await PersistenceManager.saveState('array-key', testData);
      const loaded = await PersistenceManager.loadState('array-key', { items: [] });

      expect(loaded).toEqual(testData);
    });

    it('should return default value if key not found', async () => {
      const defaultValue = { count: 0, name: 'default' };
      const loaded = await PersistenceManager.loadState('non-existent', defaultValue);

      expect(loaded).toEqual(defaultValue);
    });

    it('should overwrite previous data', async () => {
      await PersistenceManager.saveState('key', { value: 1 });
      await PersistenceManager.saveState('key', { value: 2 });

      const loaded = await PersistenceManager.loadState('key', { value: 0 });
      expect(loaded).toEqual({ value: 2 });
    });
  });

  describe('deleteState', () => {
    it('should delete saved state', async () => {
      await PersistenceManager.saveState('delete-key', { value: 42 });
      expect(await PersistenceManager.loadState('delete-key', { value: 0 })).toEqual({ value: 42 });

      await PersistenceManager.deleteState('delete-key');
      expect(await PersistenceManager.loadState('delete-key', { value: 0 })).toEqual({ value: 0 });
    });

    it('should handle deleting non-existent keys gracefully', async () => {
      await expect(async () => {
        await PersistenceManager.deleteState('non-existent-key');
      }).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('should clear all KeySense data', async () => {
      await PersistenceManager.saveState(STORAGE_KEYS.EXERCISE, { exerciseId: 'ex-1' });
      await PersistenceManager.saveState(STORAGE_KEYS.PROGRESS, { totalXp: 100 });
      await PersistenceManager.saveState(STORAGE_KEYS.SETTINGS, { volume: 0.8 });

      await PersistenceManager.clearAll();

      expect(await PersistenceManager.loadState(STORAGE_KEYS.EXERCISE, null)).toBeNull();
      expect(await PersistenceManager.loadState(STORAGE_KEYS.PROGRESS, null)).toBeNull();
      expect(await PersistenceManager.loadState(STORAGE_KEYS.SETTINGS, null)).toBeNull();
    });
  });

  describe('Migration versioning', () => {
    it('should track migration version', async () => {
      expect(await PersistenceManager.getMigrationVersion()).toBe(0);

      await PersistenceManager.setMigrationVersion(1);
      expect(await PersistenceManager.getMigrationVersion()).toBe(1);

      await PersistenceManager.setMigrationVersion(2);
      expect(await PersistenceManager.getMigrationVersion()).toBe(2);
    });

    it('should persist migration version across operations', async () => {
      await PersistenceManager.setMigrationVersion(3);

      // Save and load other data
      await PersistenceManager.saveState('test', { data: 'value' });
      await PersistenceManager.loadState('test', {});

      // Version should still be preserved
      expect(await PersistenceManager.getMigrationVersion()).toBe(3);
    });
  });
});

describe('Debounced Save', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should debounce save calls', async () => {
    const mockSaveState = jest.spyOn(PersistenceManager, 'saveState').mockResolvedValue();
    const debouncedSave = createDebouncedSave('test-key', 500);

    // Multiple calls
    debouncedSave({ value: 1 });
    debouncedSave({ value: 2 });
    debouncedSave({ value: 3 });

    // Nothing saved yet
    expect(mockSaveState).not.toHaveBeenCalled();

    // Advance time and flush promises
    jest.advanceTimersByTime(500);
    await Promise.resolve(); // Flush promises

    // Only one save should have happened (with latest value)
    expect(mockSaveState).toHaveBeenCalledTimes(1);
    expect(mockSaveState).toHaveBeenCalledWith('test-key', { value: 3 });

    mockSaveState.mockRestore();
  });

  it('should respect debounce delay', async () => {
    const mockSaveState = jest.spyOn(PersistenceManager, 'saveState').mockResolvedValue();
    const debouncedSave = createDebouncedSave('test-key', 1000);

    debouncedSave({ value: 1 });

    // Advance less than delay
    jest.advanceTimersByTime(500);
    await Promise.resolve();
    expect(mockSaveState).not.toHaveBeenCalled();

    // Advance to full delay
    jest.advanceTimersByTime(500);
    await Promise.resolve(); // Flush promises
    expect(mockSaveState).toHaveBeenCalledTimes(1);

    mockSaveState.mockRestore();
  });

  it('should reset timer on new calls', async () => {
    const mockSaveState = jest.spyOn(PersistenceManager, 'saveState').mockResolvedValue();
    const debouncedSave = createDebouncedSave('test-key', 500);

    debouncedSave({ value: 1 });
    jest.advanceTimersByTime(400);
    await Promise.resolve();

    // Call again before timer expires
    debouncedSave({ value: 2 });
    jest.advanceTimersByTime(400);
    await Promise.resolve();

    // Still shouldn't have saved
    expect(mockSaveState).not.toHaveBeenCalled();

    // Advance to new timer expiry
    jest.advanceTimersByTime(100);
    await Promise.resolve(); // Flush promises
    expect(mockSaveState).toHaveBeenCalledTimes(1);
    expect(mockSaveState).toHaveBeenCalledWith('test-key', { value: 2 });

    mockSaveState.mockRestore();
  });

  it('should handle large delays', async () => {
    const mockSaveState = jest.spyOn(PersistenceManager, 'saveState').mockResolvedValue();
    const debouncedSave = createDebouncedSave('test-key', 5000);

    debouncedSave({ value: 'large-delay' });

    jest.advanceTimersByTime(4999);
    await Promise.resolve();
    expect(mockSaveState).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await Promise.resolve(); // Flush promises
    expect(mockSaveState).toHaveBeenCalledTimes(1);

    mockSaveState.mockRestore();
  });
});
