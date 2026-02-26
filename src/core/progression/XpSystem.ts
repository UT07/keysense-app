/**
 * XP and Level Progression System
 * Manages user experience points, levels, and streaks
 * Pure functions - no side effects
 */

/**
 * XP Reward Sources
 */
export const XP_REWARDS = {
  exerciseComplete: 10,        // Base XP for completing an exercise
  exerciseFirstTime: 25,       // Bonus for first completion
  exercisePerfect: 50,         // Bonus for 3-star (95%+) score
  dailyGoalMet: 30,            // Bonus for reaching daily goal
  lessonComplete: 100,         // Bonus for completing a lesson
  streakBonus: (days: number) => Math.min(days * 5, 50), // Increasing bonus for streaks
};

/**
 * Calculate XP required to reach a specific level
 * Uses exponential curve: 100 * 1.5^(level-1)
 *
 * Examples:
 * Level 1: 100 XP
 * Level 2: 150 XP (250 total)
 * Level 3: 225 XP (475 total)
 * Level 5: 506 XP (1,268 total)
 * Level 10: 3,844 XP (11,685 total)
 */
export function xpForLevel(level: number): number {
  if (level < 1) {
    return 0;
  }
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

/**
 * Calculate total XP required to reach a level
 */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

/**
 * Determine level from total XP
 */
export function levelFromXp(totalXp: number): number {
  let level = 1;
  while (totalXpForLevel(level + 1) <= totalXp) {
    level++;
  }
  return level;
}

/**
 * Calculate progress to next level
 * Returns { currentLevelXp, nextLevelXp, xpIntoLevel, xpToNextLevel }
 */
export interface LevelProgress {
  level: number;
  totalXp: number;
  currentLevelXp: number; // XP required for current level
  nextLevelXp: number;    // XP required for next level
  xpIntoLevel: number;    // XP earned toward next level
  xpToNextLevel: number;  // XP needed to reach next level
  percentToNextLevel: number; // 0-100
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const level = levelFromXp(totalXp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpAtCurrentLevel = totalXpForLevel(level);
  const xpIntoLevel = totalXp - xpAtCurrentLevel;
  const xpToNextLevel = currentLevelXp - xpIntoLevel;
  const percentToNextLevel = Math.round((xpIntoLevel / currentLevelXp) * 100);

  return {
    level,
    totalXp,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpToNextLevel,
    percentToNextLevel: Math.max(0, Math.min(100, percentToNextLevel)),
  };
}

/**
 * Streak Data
 */
export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string; // ISO date string
  freezesAvailable: number;
  freezesUsed: number;
  weeklyPractice: boolean[]; // Last 7 days
}

/**
 * Initialize empty streak data
 */
export function createEmptyStreak(): StreakData {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastPracticeDate: '',
    freezesAvailable: 1,
    freezesUsed: 0,
    weeklyPractice: [false, false, false, false, false, false, false],
  };
}

/**
 * Check if user practiced today
 */
export function isPracticedToday(streak: StreakData): boolean {
  const today = new Date().toISOString().split('T')[0];
  return streak.lastPracticeDate === today;
}

/**
 * Get days since last practice
 */
export function daysSinceLastPractice(streak: StreakData): number {
  if (!streak.lastPracticeDate) {
    return Infinity;
  }

  const lastDate = new Date(streak.lastPracticeDate + 'T00:00:00');
  const today = new Date();
  const todayDate = new Date(today.toISOString().split('T')[0] + 'T00:00:00');
  const diffTime = todayDate.getTime() - lastDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Record a practice session
 * Updates streak, handles freezes, records daily practice
 */
export function recordPracticeSession(streak: StreakData): StreakData {
  const today = new Date().toISOString().split('T')[0];
  const daysAgo = daysSinceLastPractice(streak);

  const updated: StreakData = { ...streak };

  // If already practiced today, no streak update
  if (streak.lastPracticeDate === today) {
    return updated;
  }

  // First ever practice (no previous date)
  if (!streak.lastPracticeDate) {
    updated.currentStreak = 1;
    updated.lastPracticeDate = today;
    updated.weeklyPractice = [...updated.weeklyPractice.slice(1), true];
    if (updated.currentStreak > updated.longestStreak) {
      updated.longestStreak = updated.currentStreak;
    }
    return updated;
  }

  if (daysAgo === 1) {
    // Practiced yesterday — extend streak
    updated.currentStreak++;
  } else if (daysAgo === 2 && updated.freezesAvailable > 0) {
    // Missed exactly 1 day — use a freeze to maintain streak
    updated.freezesAvailable--;
    updated.freezesUsed++;
    updated.currentStreak++; // Count today as continuation
  } else {
    // Missed 2+ days (or 1 day with no freeze) — streak broken
    updated.currentStreak = 1;
  }

  // Update longest streak
  if (updated.currentStreak > updated.longestStreak) {
    updated.longestStreak = updated.currentStreak;
  }

  // Record practice date and weekly activity
  updated.lastPracticeDate = today;
  updated.weeklyPractice = [
    ...updated.weeklyPractice.slice(1),
    true,
  ];

  // Award freeze at end of week (every 7 days)
  if (updated.currentStreak > 0 && updated.currentStreak % 7 === 0) {
    updated.freezesAvailable++;
  }

  return updated;
}

/**
 * Calculate XP earned from an exercise
 * Takes into account:
 * - Base completion
 * - Star rating
 * - First-time bonus
 * - Streak bonus
 */
export function calculateExerciseXp(
  _score: number,
  stars: 0 | 1 | 2 | 3,
  isFirstCompletion: boolean = true,
  currentStreak: number = 0
): number {
  let xp = XP_REWARDS.exerciseComplete;

  // Star bonus (10 XP per star)
  xp += stars * 10;

  // Perfect bonus
  if (stars === 3) {
    xp += XP_REWARDS.exercisePerfect - 30; // Already counted stars
  }

  // First completion bonus
  if (isFirstCompletion) {
    xp += XP_REWARDS.exerciseFirstTime;
  }

  // Streak bonus
  if (currentStreak > 0) {
    xp += XP_REWARDS.streakBonus(currentStreak);
  }

  return xp;
}

/**
 * Achievement unlocks at specific levels
 */
export const ACHIEVEMENTS = {
  FIRST_NOTE: { level: 1, xp: 0, id: 'first-note', name: 'First Note' },
  TEN_EXERCISES: { level: 3, xp: 475, id: 'ten-exercises', name: '10 Exercises' },
  FIRST_SONG: { level: 5, xp: 1268, id: 'first-song', name: 'First Song' },
  PERFECT_SCORE: { level: 0, xp: Infinity, id: 'perfect-score', name: 'Perfect Score' },
  WEEK_STREAK: { level: 0, xp: Infinity, id: 'week-streak', name: 'Week Streak' },
  LEVEL_10: { level: 10, xp: 11685, id: 'level-10', name: 'Level 10' },
  LEVEL_25: { level: 25, xp: Infinity, id: 'level-25', name: 'Level 25' },
};

/**
 * Check if user has unlocked an achievement
 */
export function hasAchievement(
  currentLevel: number,
  totalXp: number,
  achievementKey: keyof typeof ACHIEVEMENTS
): boolean {
  const achievement = ACHIEVEMENTS[achievementKey];

  if (achievementKey === 'PERFECT_SCORE') {
    // This is tracked separately, not by level
    return false;
  }

  if (achievementKey === 'WEEK_STREAK') {
    // This is tracked separately, not by level
    return false;
  }

  return currentLevel >= achievement.level && totalXp >= achievement.xp;
}

/**
 * Daily goal tracking
 */
export interface DailyGoal {
  date: string;
  minutesTarget: number;
  minutesPracticed: number;
  exercisesTarget: number;
  exercisesCompleted: number;
}

/**
 * Check if daily goal is met
 */
export function isDailyGoalMet(goal: DailyGoal): boolean {
  return (
    goal.minutesPracticed >= goal.minutesTarget &&
    goal.exercisesCompleted >= goal.exercisesTarget
  );
}

/**
 * Create daily goal
 */
export function createDailyGoal(minutesTarget: number = 10, exercisesTarget: number = 3): DailyGoal {
  const today = new Date().toISOString().split('T')[0];
  return {
    date: today,
    minutesTarget,
    minutesPracticed: 0,
    exercisesTarget,
    exercisesCompleted: 0,
  };
}
