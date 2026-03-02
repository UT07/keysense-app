import { withTimeout } from '../withTimeout';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the promise value when it completes before timeout', async () => {
    const promise = Promise.resolve('hello');
    const result = await withTimeout(promise, 5000, 'test');
    expect(result).toBe('hello');
  });

  it('rejects with timeout error when promise takes too long', async () => {
    const neverResolve = new Promise<string>(() => {});
    const promise = withTimeout(neverResolve, 100, 'slowOperation');

    jest.advanceTimersByTime(101);

    await expect(promise).rejects.toThrow('slowOperation timed out after 100ms');
  });

  it('includes label and duration in the error message', async () => {
    const neverResolve = new Promise<string>(() => {});
    const promise = withTimeout(neverResolve, 5000, 'GeminiAPI');

    jest.advanceTimersByTime(5001);

    await expect(promise).rejects.toThrow('GeminiAPI timed out after 5000ms');
  });

  it('cleans up the timeout when promise resolves first', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const promise = Promise.resolve(42);
    await withTimeout(promise, 5000, 'test');

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('cleans up the timeout when promise rejects first', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const promise = Promise.reject(new Error('original error'));
    await expect(withTimeout(promise, 5000, 'test')).rejects.toThrow('original error');

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('preserves the original rejection when promise rejects before timeout', async () => {
    const error = new Error('network failure');
    const promise = Promise.reject(error);

    await expect(withTimeout(promise, 5000, 'test')).rejects.toBe(error);
  });

  it('works with different return types', async () => {
    expect(await withTimeout(Promise.resolve(42), 100, 'num')).toBe(42);
    expect(await withTimeout(Promise.resolve(null), 100, 'null')).toBeNull();
    expect(await withTimeout(Promise.resolve([1, 2]), 100, 'arr')).toEqual([1, 2]);
  });
});
