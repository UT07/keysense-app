/**
 * Time and duration utility functions
 */

/**
 * Format milliseconds to MM:SS
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format milliseconds to HH:MM:SS
 */
export function formatLongDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours === 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Get current date as local ISO string (YYYY-MM-DD).
 * Uses local timezone so the "day" aligns with the user's wall clock —
 * prevents streaks from breaking at midnight UTC instead of midnight local.
 * BUG-008 fix: was using toISOString() which gives UTC dates.
 */
export function getTodayDateString(): string {
  return getLocalDateString(new Date());
}

/**
 * Get date string for a given date in local timezone (YYYY-MM-DD).
 * BUG-008 fix: was using toISOString() which gives UTC dates.
 */
export function getDateString(date: Date): string {
  return getLocalDateString(date);
}

/**
 * Format a Date as YYYY-MM-DD in the local timezone.
 */
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if two dates are on the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return getDateString(date1) === getDateString(date2);
}

/**
 * Check if date is yesterday
 */
export function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

/**
 * Get days since a given date
 */
export function daysSince(date: Date | string): number {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - targetDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
