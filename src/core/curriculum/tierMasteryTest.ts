/**
 * Tier Mastery Test utilities
 *
 * Provides functions to check mastery test availability and pass status
 * for all 15 tiers. Tiers 1-6 use static test exercises from lesson JSON;
 * tiers 7-15 use AI-generated exercises via the tier's most advanced skill.
 *
 * Pure TypeScript — no React imports.
 */

import { SKILL_TREE } from './SkillTree';

/** The number of static lesson tiers that have JSON test exercises */
export const STATIC_LESSON_TIERS = 6;

/**
 * Get the skill ID to use for a tier mastery test (AI-generated).
 * Returns the last (most advanced) skill in the tier, which has the broadest
 * GenerationHints covering the whole tier's material.
 *
 * Returns null if the tier has no skills.
 */
export function getTierMasteryTestSkillId(tier: number): string | null {
  const tierSkills = SKILL_TREE.filter((s) => s.tier === tier);
  if (tierSkills.length === 0) return null;
  // The last skill in the tier is the most advanced
  return tierSkills[tierSkills.length - 1].id;
}

/**
 * Check if a tier's mastery test should be available.
 * Requires ALL skills in the tier to be mastered.
 */
export function isTierMasteryTestAvailable(
  tier: number,
  masteredSkills: string[],
): boolean {
  const masteredSet = new Set(masteredSkills);
  const tierSkills = SKILL_TREE.filter((s) => s.tier === tier);
  if (tierSkills.length === 0) return false;
  return tierSkills.every((s) => masteredSet.has(s.id));
}

/**
 * Check if a tier's mastery test has been passed.
 */
export function hasTierMasteryTestPassed(
  tier: number,
  tierTestResults: Record<string, { passed: boolean; score: number; attempts: number }>,
): boolean {
  const key = `tier-${tier}`;
  return tierTestResults[key]?.passed === true;
}
