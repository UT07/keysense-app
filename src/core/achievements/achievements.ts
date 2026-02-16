/**
 * Achievement Definitions
 * Pure TypeScript - no React imports
 *
 * Defines all achievements, their conditions, and checking logic.
 * Achievements are grouped into categories: milestone, streak, score, xp, practice, collection.
 */

/**
 * Achievement condition types
 */
export type AchievementConditionType =
  | 'lessons_completed'
  | 'exercises_completed'
  | 'current_streak'
  | 'perfect_scores'
  | 'high_score_count'
  | 'total_xp'
  | 'level'
  | 'total_notes_played'
  | 'cats_unlocked'
  | 'session_exercises'
  | 'exercises_with_same_cat'
  | 'early_practice'
  | 'late_practice';

export interface AchievementCondition {
  type: AchievementConditionType;
  threshold: number;
}

export type AchievementCategory = 'milestone' | 'streak' | 'score' | 'xp' | 'practice' | 'collection';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // MaterialCommunityIcons name
  category: AchievementCategory;
  condition: AchievementCondition;
  xpReward: number;
}

/**
 * Context provided when checking achievements.
 * Aggregates the relevant stats from various stores.
 */
export interface AchievementContext {
  totalXp: number;
  level: number;
  currentStreak: number;
  lessonsCompleted: number;
  perfectScores: number;
  totalExercisesCompleted: number;
  totalNotesPlayed: number;
  catsUnlocked: number;
  highScoreExercises: number; // exercises scored 90%+
  sessionExercises: number; // exercises in current session
  exercisesWithSameCat: number; // exercises with one cat companion
  isEarlyPractice: boolean; // practiced before 8am today
  isLatePractice: boolean; // practiced after 10pm today
}

/**
 * All achievements in the app (32 total)
 */
export const ACHIEVEMENTS: Achievement[] = [
  // === Milestones (6) ===
  {
    id: 'first-exercise',
    title: 'First Note',
    description: 'Complete your first exercise',
    icon: 'music-note',
    category: 'milestone',
    condition: { type: 'exercises_completed', threshold: 1 },
    xpReward: 10,
  },
  {
    id: 'first-lesson',
    title: 'First Lesson',
    description: 'Complete your first lesson',
    icon: 'book-check',
    category: 'milestone',
    condition: { type: 'lessons_completed', threshold: 1 },
    xpReward: 25,
  },
  {
    id: 'ten-exercises',
    title: 'Practice Makes Purrrfect',
    description: 'Complete 10 exercises',
    icon: 'repeat',
    category: 'milestone',
    condition: { type: 'exercises_completed', threshold: 10 },
    xpReward: 50,
  },
  {
    id: 'twenty-exercises',
    title: 'Dedicated Learner',
    description: 'Complete 20 exercises',
    icon: 'arm-flex',
    category: 'milestone',
    condition: { type: 'exercises_completed', threshold: 20 },
    xpReward: 75,
  },
  {
    id: 'fifty-exercises',
    title: 'Half Century',
    description: 'Complete 50 exercises',
    icon: 'medal',
    category: 'milestone',
    condition: { type: 'exercises_completed', threshold: 50 },
    xpReward: 150,
  },
  {
    id: 'five-lessons',
    title: 'Getting Serious',
    description: 'Complete 5 lessons',
    icon: 'school',
    category: 'milestone',
    condition: { type: 'lessons_completed', threshold: 5 },
    xpReward: 100,
  },
  {
    id: 'all-lessons',
    title: 'Curriculum Complete',
    description: 'Complete all 6 lessons',
    icon: 'certificate',
    category: 'milestone',
    condition: { type: 'lessons_completed', threshold: 6 },
    xpReward: 250,
  },

  // === Streaks (5) ===
  {
    id: 'streak-3',
    title: '3-Day Streak',
    description: 'Practice for 3 days in a row',
    icon: 'fire',
    category: 'streak',
    condition: { type: 'current_streak', threshold: 3 },
    xpReward: 30,
  },
  {
    id: 'streak-7',
    title: 'Week Warrior',
    description: 'Practice for 7 days in a row',
    icon: 'fire',
    category: 'streak',
    condition: { type: 'current_streak', threshold: 7 },
    xpReward: 75,
  },
  {
    id: 'streak-14',
    title: 'Two-Week Streak',
    description: 'Practice for 14 days in a row',
    icon: 'fire',
    category: 'streak',
    condition: { type: 'current_streak', threshold: 14 },
    xpReward: 150,
  },
  {
    id: 'streak-30',
    title: 'Monthly Maestro',
    description: 'Practice for 30 days in a row',
    icon: 'fire',
    category: 'streak',
    condition: { type: 'current_streak', threshold: 30 },
    xpReward: 300,
  },
  {
    id: 'streak-100',
    title: 'Century',
    description: 'Practice for 100 days in a row',
    icon: 'trophy-award',
    category: 'streak',
    condition: { type: 'current_streak', threshold: 100 },
    xpReward: 500,
  },

  // === Scores (5) ===
  {
    id: 'first-perfect',
    title: 'Purrrfection',
    description: 'Get a perfect score on any exercise',
    icon: 'star-circle',
    category: 'score',
    condition: { type: 'perfect_scores', threshold: 1 },
    xpReward: 50,
  },
  {
    id: 'five-perfects',
    title: 'Gold Standard',
    description: 'Get 5 perfect scores',
    icon: 'star-shooting',
    category: 'score',
    condition: { type: 'perfect_scores', threshold: 5 },
    xpReward: 100,
  },
  {
    id: 'ten-perfects',
    title: 'Flawless',
    description: 'Get 10 perfect scores',
    icon: 'diamond-stone',
    category: 'score',
    condition: { type: 'perfect_scores', threshold: 10 },
    xpReward: 200,
  },
  {
    id: 'high-score-10',
    title: 'Consistent Player',
    description: 'Score 90%+ on 10 exercises',
    icon: 'chart-line',
    category: 'score',
    condition: { type: 'high_score_count', threshold: 10 },
    xpReward: 75,
  },
  {
    id: 'high-score-20',
    title: 'High Achiever',
    description: 'Score 90%+ on 20 exercises',
    icon: 'chart-areaspline',
    category: 'score',
    condition: { type: 'high_score_count', threshold: 20 },
    xpReward: 150,
  },

  // === XP & Levels (5) ===
  {
    id: 'level-5',
    title: 'Rising Star',
    description: 'Reach Level 5',
    icon: 'trending-up',
    category: 'xp',
    condition: { type: 'level', threshold: 5 },
    xpReward: 50,
  },
  {
    id: 'level-10',
    title: 'Keyboard Master',
    description: 'Reach Level 10',
    icon: 'trophy',
    category: 'xp',
    condition: { type: 'level', threshold: 10 },
    xpReward: 100,
  },
  {
    id: 'level-20',
    title: 'Grand Master',
    description: 'Reach Level 20',
    icon: 'crown',
    category: 'xp',
    condition: { type: 'level', threshold: 20 },
    xpReward: 200,
  },
  {
    id: 'xp-1000',
    title: 'XP Collector',
    description: 'Earn 1,000 total XP',
    icon: 'lightning-bolt',
    category: 'xp',
    condition: { type: 'total_xp', threshold: 1000 },
    xpReward: 50,
  },
  {
    id: 'xp-5000',
    title: 'XP Hoarder',
    description: 'Earn 5,000 total XP',
    icon: 'lightning-bolt-circle',
    category: 'xp',
    condition: { type: 'total_xp', threshold: 5000 },
    xpReward: 100,
  },

  // === Practice (7) ===
  {
    id: 'notes-100',
    title: 'Busy Paws',
    description: 'Play 100 notes total',
    icon: 'piano',
    category: 'practice',
    condition: { type: 'total_notes_played', threshold: 100 },
    xpReward: 25,
  },
  {
    id: 'notes-500',
    title: 'Note Machine',
    description: 'Play 500 notes total',
    icon: 'piano',
    category: 'practice',
    condition: { type: 'total_notes_played', threshold: 500 },
    xpReward: 75,
  },
  {
    id: 'notes-1000',
    title: 'Thousand Keys',
    description: 'Play 1,000 notes total',
    icon: 'music-note-eighth',
    category: 'practice',
    condition: { type: 'total_notes_played', threshold: 1000 },
    xpReward: 100,
  },
  {
    id: 'notes-5000',
    title: 'Key Crusher',
    description: 'Play 5,000 notes total',
    icon: 'music-note-whole',
    category: 'practice',
    condition: { type: 'total_notes_played', threshold: 5000 },
    xpReward: 200,
  },
  {
    id: 'session-marathon',
    title: 'Marathon',
    description: 'Play 10 exercises in one session',
    icon: 'run-fast',
    category: 'practice',
    condition: { type: 'session_exercises', threshold: 10 },
    xpReward: 75,
  },
  {
    id: 'early-bird',
    title: 'Early Bird',
    description: 'Practice before 8am',
    icon: 'weather-sunset-up',
    category: 'practice',
    condition: { type: 'early_practice', threshold: 1 },
    xpReward: 30,
  },
  {
    id: 'night-owl',
    title: 'Night Owl',
    description: 'Practice after 10pm',
    icon: 'weather-night',
    category: 'practice',
    condition: { type: 'late_practice', threshold: 1 },
    xpReward: 30,
  },

  // === Collection (4) ===
  {
    id: 'cats-3',
    title: 'Cat Collector',
    description: 'Unlock 3 cat characters',
    icon: 'cat',
    category: 'collection',
    condition: { type: 'cats_unlocked', threshold: 3 },
    xpReward: 50,
  },
  {
    id: 'cats-all',
    title: 'Cat Whisperer',
    description: 'Unlock all 8 cat characters',
    icon: 'cat',
    category: 'collection',
    condition: { type: 'cats_unlocked', threshold: 8 },
    xpReward: 200,
  },
  {
    id: 'best-friends',
    title: 'Best Friends',
    description: 'Play 100 exercises with the same cat companion',
    icon: 'heart',
    category: 'collection',
    condition: { type: 'exercises_with_same_cat', threshold: 100 },
    xpReward: 100,
  },
  {
    id: 'cat-duo',
    title: 'Purrrfect Duo',
    description: 'Play 50 exercises with the same cat companion',
    icon: 'handshake',
    category: 'collection',
    condition: { type: 'exercises_with_same_cat', threshold: 50 },
    xpReward: 50,
  },
];

/**
 * Get an achievement by ID
 */
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Get all achievements in a category
 */
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.category === category);
}

/**
 * Check if a single achievement condition is met
 */
export function isConditionMet(condition: AchievementCondition, context: AchievementContext): boolean {
  switch (condition.type) {
    case 'lessons_completed':
      return context.lessonsCompleted >= condition.threshold;
    case 'exercises_completed':
      return context.totalExercisesCompleted >= condition.threshold;
    case 'current_streak':
      return context.currentStreak >= condition.threshold;
    case 'perfect_scores':
      return context.perfectScores >= condition.threshold;
    case 'high_score_count':
      return context.highScoreExercises >= condition.threshold;
    case 'total_xp':
      return context.totalXp >= condition.threshold;
    case 'level':
      return context.level >= condition.threshold;
    case 'total_notes_played':
      return context.totalNotesPlayed >= condition.threshold;
    case 'cats_unlocked':
      return context.catsUnlocked >= condition.threshold;
    case 'session_exercises':
      return context.sessionExercises >= condition.threshold;
    case 'exercises_with_same_cat':
      return context.exercisesWithSameCat >= condition.threshold;
    case 'early_practice':
      return context.isEarlyPractice ? 1 >= condition.threshold : false;
    case 'late_practice':
      return context.isLatePractice ? 1 >= condition.threshold : false;
    default:
      return false;
  }
}

/**
 * Check all achievements against context, returning IDs of newly unlocked ones.
 * Already-unlocked achievement IDs should be passed in to avoid re-triggering.
 */
export function checkAchievements(
  context: AchievementContext,
  alreadyUnlocked: ReadonlySet<string>
): string[] {
  const newlyUnlocked: string[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (alreadyUnlocked.has(achievement.id)) {
      continue;
    }
    if (isConditionMet(achievement.condition, context)) {
      newlyUnlocked.push(achievement.id);
    }
  }

  return newlyUnlocked;
}
