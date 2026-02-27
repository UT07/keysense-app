/**
 * Reward Chest System
 * Determines chest type and rewards based on exercise completion.
 * Pure logic — no React, no side effects.
 */

export type ChestType = 'none' | 'common' | 'rare' | 'epic';

export interface ChestReward {
  gems: number;
  catXpBoost: boolean;
}

/**
 * Determine chest type based on stars earned and whether this is the first completion.
 *
 * Rules:
 * - 3 stars + first completion → epic
 * - 3 stars + repeat → rare
 * - 2 stars (any) → common
 * - 1 star or 0 stars → none
 */
export function getChestType(stars: number, isFirstCompletion: boolean): ChestType {
  if (stars >= 3 && isFirstCompletion) return 'epic';
  if (stars >= 3) return 'rare';
  if (stars >= 2) return 'common';
  return 'none';
}

/**
 * Get the reward contents for a chest type.
 */
export function getChestReward(chestType: ChestType): ChestReward {
  switch (chestType) {
    case 'epic':
      return { gems: 25, catXpBoost: true };
    case 'rare':
      return { gems: 10, catXpBoost: false };
    case 'common':
      return { gems: 5, catXpBoost: false };
    case 'none':
      return { gems: 0, catXpBoost: false };
  }
}
