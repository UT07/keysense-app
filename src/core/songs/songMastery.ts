/**
 * Song Mastery Calculation
 *
 * Computes mastery tiers based on per-section scores.
 * Pure TypeScript — no React imports.
 */

import type { MasteryTier, SongMastery, SongLayer } from './songTypes';

// ---------------------------------------------------------------------------
// Tier requirements
// ---------------------------------------------------------------------------

export const MASTERY_REQUIREMENTS: ReadonlyArray<{
  tier: MasteryTier;
  minScore: number;
  layer: SongLayer;
}> = [
  { tier: 'bronze', minScore: 70, layer: 'melody' },
  { tier: 'silver', minScore: 80, layer: 'melody' },
  { tier: 'gold', minScore: 90, layer: 'full' },
  { tier: 'platinum', minScore: 95, layer: 'full' },
];

/** Ordered list for comparison (index = rank, higher = better). */
const TIER_ORDER: MasteryTier[] = ['none', 'bronze', 'silver', 'gold', 'platinum'];

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Compute the highest mastery tier earned given per-section scores.
 * ALL sections must meet or exceed the tier's minScore requirement.
 * Gold and Platinum require playing on the "full" layer.
 */
export function computeMasteryTier(
  sectionScores: Record<string, number>,
  sectionIds: string[],
  layer: SongLayer,
): MasteryTier {
  if (sectionIds.length === 0) return 'none';

  // Check if all sections have been played
  const allPlayed = sectionIds.every(
    (id) => sectionScores[id] !== undefined && sectionScores[id] >= 0,
  );
  if (!allPlayed) return 'none';

  const minScore = Math.min(...sectionIds.map((id) => sectionScores[id]));

  // Walk requirements from highest to lowest, return the best matching tier
  for (let i = MASTERY_REQUIREMENTS.length - 1; i >= 0; i--) {
    const req = MASTERY_REQUIREMENTS[i];
    if (minScore >= req.minScore) {
      // Gold/Platinum require full layer
      if (req.layer === 'full' && layer !== 'full') {
        continue;
      }
      return req.tier;
    }
  }

  return 'none';
}

/**
 * Merge new section scores with existing mastery, keeping the best per-section
 * score, and recompute the tier.
 */
export function updateSongMastery(
  existing: SongMastery | null,
  songId: string,
  userId: string,
  newSectionScores: Record<string, number>,
  sectionIds: string[],
  layer: SongLayer,
): SongMastery {
  // Merge: keep the higher score for each section
  const merged: Record<string, number> = { ...(existing?.sectionScores ?? {}) };
  for (const [sectionId, score] of Object.entries(newSectionScores)) {
    merged[sectionId] = Math.max(merged[sectionId] ?? 0, score);
  }

  const tier = computeMasteryTier(merged, sectionIds, layer);

  return {
    songId,
    userId,
    tier,
    sectionScores: merged,
    lastPlayed: Date.now(),
    totalAttempts: (existing?.totalAttempts ?? 0) + 1,
  };
}

/**
 * Returns true if t1 is strictly better than t2.
 */
export function isBetterTier(t1: MasteryTier, t2: MasteryTier): boolean {
  return TIER_ORDER.indexOf(t1) > TIER_ORDER.indexOf(t2);
}

/**
 * Gem reward for reaching a mastery tier.
 */
export function gemRewardForTier(tier: MasteryTier): number {
  switch (tier) {
    case 'bronze':
      return 10;
    case 'silver':
      return 20;
    case 'gold':
      return 40;
    case 'platinum':
      return 75;
    default:
      return 0;
  }
}

/**
 * Human-readable label for a mastery tier.
 */
export function masteryLabel(tier: MasteryTier): string {
  switch (tier) {
    case 'none':
      return 'Unmastered';
    case 'bronze':
      return 'Bronze';
    case 'silver':
      return 'Silver';
    case 'gold':
      return 'Gold';
    case 'platinum':
      return 'Platinum';
  }
}

/**
 * Returns a COLORS token string for the tier badge.
 */
export function masteryColor(tier: MasteryTier): string {
  switch (tier) {
    case 'none':
      return '#666666'; // COLORS.textMuted
    case 'bronze':
      return '#CD7F32';
    case 'silver':
      return '#C0C0C0';
    case 'gold':
      return '#FFD700'; // COLORS.starGold
    case 'platinum':
      return '#E5E4E2';
  }
}
