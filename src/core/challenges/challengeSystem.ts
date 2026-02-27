/**
 * Challenge System — Pure TypeScript, no React imports
 *
 * Generates deterministic daily/weekly/monthly challenges based on date hashes.
 * Each challenge type has a validation function that checks if the condition
 * is satisfied when an exercise completes.
 */

import { SKILL_TREE } from '../curriculum/SkillTree';
import type { SkillCategory } from '../curriculum/SkillTree';

// ============================================================================
// Types
// ============================================================================

export type DailyChallengeType =
  | 'any-exercise'
  | 'specific-category'
  | 'score-threshold'
  | 'combo-streak'
  | 'speed-run'
  | 'perfect-notes'
  | 'practice-minutes';

export interface DailyChallenge {
  type: DailyChallengeType;
  label: string;
  description: string;
  icon: string; // MaterialCommunityIcons name
  category?: SkillCategory;
  threshold?: number;
  reward: { gems: number; xpMultiplier: number };
}

export interface WeeklyChallenge {
  weekStartDate: string;
  challengeDay: number; // 1-7 (which day it appears)
  type: DailyChallengeType;
  label: string;
  description: string;
  icon: string;
  threshold?: number;
  reward: { gems: number; xpMultiplier: number };
}

export interface MonthlyChallenge {
  month: string; // "2026-02"
  challengeDay: number; // 1-28
  exercisesRequired: number; // 3-5
  label: string;
  description: string;
  icon: string;
  reward: { gems: number; xpMultiplier: number };
  durationHours: number; // 48
}

/** Data passed to challenge validation when an exercise completes */
export interface ExerciseChallengeContext {
  score: number; // 0-100
  maxCombo: number;
  perfectNotes: number;
  playbackSpeed: number; // 1.0 = normal
  category?: SkillCategory;
  minutesPracticedToday: number;
}

// ============================================================================
// Hash utility — deterministic pseudo-random from a string
// ============================================================================

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ============================================================================
// Challenge Definitions
// ============================================================================

const CATEGORY_LABELS: Partial<Record<SkillCategory, string>> = {
  'note-finding': 'note finding',
  'intervals': 'interval',
  'scales': 'scale',
  'chords': 'chord',
  'rhythm': 'rhythm',
  'hand-independence': 'both-hands',
  'songs': 'song',
  'black-keys': 'black key',
  'key-signatures': 'key signature',
  'expression': 'expression',
  'arpeggios': 'arpeggio',
  'sight-reading': 'sight reading',
};

const CHALLENGE_CATEGORIES: SkillCategory[] = [
  'scales', 'chords', 'rhythm', 'songs', 'hand-independence',
  'black-keys', 'key-signatures', 'arpeggios', 'expression',
];

/** All daily challenge templates — rotated by date hash */
const DAILY_TEMPLATES: Omit<DailyChallenge, 'category'>[] = [
  {
    type: 'any-exercise',
    label: 'Complete any exercise',
    description: 'Play any exercise today to earn your reward!',
    icon: 'music-note',
    reward: { gems: 10, xpMultiplier: 2 },
  },
  {
    type: 'score-threshold',
    label: 'Score 85% or higher',
    description: 'Push for excellence today!',
    icon: 'star-shooting',
    threshold: 85,
    reward: { gems: 15, xpMultiplier: 2 },
  },
  {
    type: 'combo-streak',
    label: 'Get a 5-note combo',
    description: 'Hit 5 notes in a row perfectly!',
    icon: 'fire',
    threshold: 5,
    reward: { gems: 15, xpMultiplier: 2 },
  },
  {
    type: 'speed-run',
    label: 'Play at full speed',
    description: 'Complete an exercise at 1.0x speed!',
    icon: 'speedometer',
    threshold: 1.0,
    reward: { gems: 12, xpMultiplier: 2 },
  },
  {
    type: 'perfect-notes',
    label: 'Hit 3 perfect notes',
    description: 'Nail at least 3 notes with perfect timing!',
    icon: 'bullseye-arrow',
    threshold: 3,
    reward: { gems: 15, xpMultiplier: 2 },
  },
  {
    type: 'practice-minutes',
    label: 'Practice for 5 minutes',
    description: 'Spend some quality time at the keyboard today.',
    icon: 'clock-check-outline',
    threshold: 5,
    reward: { gems: 12, xpMultiplier: 2 },
  },
  // Category-specific ones are generated dynamically below
];

// ============================================================================
// Daily Challenge
// ============================================================================

/**
 * Get categories the user has actually encountered (has at least one mastered
 * skill in that category, OR the category appears in their current/next tier).
 */
function getAccessibleCategories(masteredSkills: string[]): SkillCategory[] {
  if (masteredSkills.length === 0) {
    // Brand new user — only allow note-finding
    return ['note-finding'];
  }

  const masteredSet = new Set(masteredSkills);

  // Find the user's current tier (highest tier with at least one mastered skill)
  let currentTier = 1;
  for (const skill of SKILL_TREE) {
    if (masteredSet.has(skill.id) && skill.tier > currentTier) {
      currentTier = skill.tier;
    }
  }

  // Collect categories from tiers up to currentTier + 1 (allow one tier ahead)
  const accessibleCats = new Set<SkillCategory>();
  for (const skill of SKILL_TREE) {
    if (skill.tier <= currentTier + 1) {
      accessibleCats.add(skill.category);
    }
  }

  return Array.from(accessibleCats);
}

/**
 * Generate today's daily challenge. When `masteredSkills` is provided, category-
 * specific challenges are filtered to categories the user has actually reached.
 */
export function getDailyChallengeForDate(
  dateISO: string,
  masteredSkills?: string[],
): DailyChallenge {
  const hash = hashString(`daily-${dateISO}`);

  // 40% chance of category-specific, 60% chance of template
  const useCategoryChallenge = (hash % 10) < 4;

  if (useCategoryChallenge) {
    // Filter to categories the user can actually play
    const pool = masteredSkills
      ? getAccessibleCategories(masteredSkills).filter((c) =>
          CHALLENGE_CATEGORIES.includes(c),
        )
      : CHALLENGE_CATEGORIES;

    if (pool.length > 0) {
      const catIdx = hash % pool.length;
      const category = pool[catIdx];
      const catLabel = CATEGORY_LABELS[category] ?? category;
      return {
        type: 'specific-category',
        label: `Play a ${catLabel} exercise`,
        description: `Focus on ${catLabel} skills today!`,
        icon: 'tag-outline',
        category,
        reward: { gems: 15, xpMultiplier: 2 },
      };
    }
    // No accessible category-specific challenges — fall through to template
  }

  const templateIdx = (hash >> 4) % DAILY_TEMPLATES.length;
  return { ...DAILY_TEMPLATES[templateIdx] };
}

// ============================================================================
// Weekly Challenge
// ============================================================================

const WEEKLY_TEMPLATES: { type: DailyChallengeType; label: string; description: string; icon: string; threshold?: number }[] = [
  { type: 'score-threshold', label: 'Score 90% or higher', description: 'Aim for near-perfection this week!', icon: 'medal', threshold: 90 },
  { type: 'combo-streak', label: 'Get a 10-note combo', description: 'An epic streak of perfect notes!', icon: 'fire', threshold: 10 },
  { type: 'perfect-notes', label: 'Hit 8 perfect notes', description: 'Precision at its finest!', icon: 'bullseye-arrow', threshold: 8 },
];

export function getWeeklyChallengeForWeek(weekStartDateISO: string): WeeklyChallenge {
  const hash = hashString(`weekly-${weekStartDateISO}`);
  const challengeDay = (hash % 7) + 1; // 1-7
  const templateIdx = (hash >> 3) % WEEKLY_TEMPLATES.length;
  const template = WEEKLY_TEMPLATES[templateIdx];

  return {
    weekStartDate: weekStartDateISO,
    challengeDay,
    type: template.type,
    label: template.label,
    description: template.description,
    icon: template.icon,
    threshold: template.threshold,
    reward: { gems: 50, xpMultiplier: 3 },
  };
}

/** Check if today is the weekly challenge day */
export function isWeeklyChallengeDay(weekStartDateISO: string): boolean {
  const challenge = getWeeklyChallengeForWeek(weekStartDateISO);
  const start = new Date(weekStartDateISO + 'T00:00:00');
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const dayOfWeek = Math.floor(diffMs / 86400000) + 1;
  return dayOfWeek === challenge.challengeDay;
}

// ============================================================================
// Monthly Challenge
// ============================================================================

export function getMonthlyChallengeForMonth(monthISO: string): MonthlyChallenge {
  const hash = hashString(`monthly-${monthISO}`);
  const challengeDay = (hash % 26) + 2; // 2-27 (avoid 1st and last days)
  const exercisesRequired = 3 + (hash % 3); // 3-5

  return {
    month: monthISO,
    challengeDay,
    exercisesRequired,
    label: `Complete ${exercisesRequired} exercises`,
    description: `A grand monthly challenge! Finish ${exercisesRequired} exercises within 48 hours.`,
    icon: 'calendar-star',
    reward: { gems: 150, xpMultiplier: 3 },
    durationHours: 48,
  };
}

/** Check if the monthly challenge is currently active (within 48h window) */
export function isMonthlyChallengeActive(monthISO: string): boolean {
  const challenge = getMonthlyChallengeForMonth(monthISO);
  const year = parseInt(monthISO.split('-')[0], 10);
  const month = parseInt(monthISO.split('-')[1], 10) - 1;
  const startDate = new Date(year, month, challenge.challengeDay, 0, 0, 0);
  const endDate = new Date(startDate.getTime() + challenge.durationHours * 3600000);
  const now = new Date();
  return now >= startDate && now < endDate;
}

// ============================================================================
// Challenge Validation
// ============================================================================

/**
 * Check if an exercise completion satisfies the daily challenge condition.
 * Returns true if the challenge is now complete.
 */
export function isDailyChallengeComplete(
  challenge: DailyChallenge,
  ctx: ExerciseChallengeContext,
): boolean {
  switch (challenge.type) {
    case 'any-exercise':
      return true;

    case 'specific-category':
      return ctx.category === challenge.category;

    case 'score-threshold':
      return ctx.score >= (challenge.threshold ?? 85);

    case 'combo-streak':
      return ctx.maxCombo >= (challenge.threshold ?? 5);

    case 'speed-run':
      return ctx.playbackSpeed >= (challenge.threshold ?? 1.0);

    case 'perfect-notes':
      return ctx.perfectNotes >= (challenge.threshold ?? 3);

    case 'practice-minutes':
      return ctx.minutesPracticedToday >= (challenge.threshold ?? 5);

    default:
      return true;
  }
}

/**
 * Check if an exercise completion satisfies the weekly challenge.
 * Same logic as daily but with typically harder thresholds.
 */
export function isWeeklyChallengeComplete(
  challenge: WeeklyChallenge,
  ctx: ExerciseChallengeContext,
): boolean {
  switch (challenge.type) {
    case 'score-threshold':
      return ctx.score >= (challenge.threshold ?? 90);

    case 'combo-streak':
      return ctx.maxCombo >= (challenge.threshold ?? 10);

    case 'perfect-notes':
      return ctx.perfectNotes >= (challenge.threshold ?? 8);

    default:
      return true;
  }
}
