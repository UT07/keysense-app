/**
 * Wraps a promise with a timeout. Rejects if the promise doesn't
 * resolve within `timeoutMs` milliseconds. Cleans up the timer
 * regardless of outcome to prevent leaks.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle != null) {
      clearTimeout(timeoutHandle);
    }
  }
}
