/**
 * Production-safe logger — no-ops in release builds.
 * Drop-in replacement for console.log that prevents
 * performance overhead and info leaks in production.
 */

export const logger = {
  log: (...args: unknown[]): void => {
    if (__DEV__) console.log(...args);
  },
  warn: (...args: unknown[]): void => {
    if (__DEV__) console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    // Always log errors (for Crashlytics/Sentry to pick up)
    console.error(...args);
  },
};
