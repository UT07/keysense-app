/**
 * Cat Accessory Definitions
 *
 * 30 accessories across 6 categories, with rarity-based pricing
 * and evolution stage requirements.
 */

import type { EvolutionStage } from '../stores/types';

export type AccessoryCategory = 'hats' | 'glasses' | 'outfits' | 'capes' | 'collars' | 'effects';

export type AccessoryRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Accessory {
  id: string;
  name: string;
  category: AccessoryCategory;
  rarity: AccessoryRarity;
  gemCost: number;
  /** Minimum evolution stage to equip */
  minStage: EvolutionStage;
  /** MaterialCommunityIcons name for grid display */
  icon: string;
}

export const ACCESSORY_CATEGORIES: { key: AccessoryCategory; label: string; icon: string }[] = [
  { key: 'hats', label: 'Hats', icon: 'hat-fedora' },
  { key: 'glasses', label: 'Glasses', icon: 'glasses' },
  { key: 'outfits', label: 'Outfits', icon: 'tshirt-crew' },
  { key: 'capes', label: 'Capes', icon: 'shield-half-full' },
  { key: 'collars', label: 'Collars', icon: 'bow-tie' },
  { key: 'effects', label: 'Effects', icon: 'creation' },
];

export const ACCESSORIES: Accessory[] = [
  // Hats (6)
  { id: 'hat-beret', name: 'Beret', category: 'hats', rarity: 'common', gemCost: 15, minStage: 'teen', icon: 'hat-fedora' },
  { id: 'hat-tophat', name: 'Top Hat', category: 'hats', rarity: 'rare', gemCost: 40, minStage: 'teen', icon: 'hat-fedora' },
  { id: 'hat-santa', name: 'Santa Hat', category: 'hats', rarity: 'rare', gemCost: 35, minStage: 'baby', icon: 'snowflake' },
  { id: 'hat-wizard', name: 'Wizard Hat', category: 'hats', rarity: 'epic', gemCost: 75, minStage: 'adult', icon: 'wizard-hat' },
  { id: 'hat-pirate', name: 'Pirate Hat', category: 'hats', rarity: 'epic', gemCost: 80, minStage: 'adult', icon: 'pirate' },
  { id: 'hat-crown', name: 'Crown', category: 'hats', rarity: 'legendary', gemCost: 150, minStage: 'master', icon: 'crown' },

  // Glasses (5)
  { id: 'glass-round', name: 'Round Glasses', category: 'glasses', rarity: 'common', gemCost: 10, minStage: 'baby', icon: 'glasses' },
  { id: 'glass-sunglasses', name: 'Sunglasses', category: 'glasses', rarity: 'common', gemCost: 15, minStage: 'teen', icon: 'sunglasses' },
  { id: 'glass-monocle', name: 'Monocle', category: 'glasses', rarity: 'rare', gemCost: 35, minStage: 'adult', icon: 'circle-outline' },
  { id: 'glass-star', name: 'Star Glasses', category: 'glasses', rarity: 'epic', gemCost: 60, minStage: 'adult', icon: 'star-four-points' },
  { id: 'glass-heart', name: 'Heart Glasses', category: 'glasses', rarity: 'epic', gemCost: 65, minStage: 'teen', icon: 'heart' },

  // Outfits (5)
  { id: 'outfit-tuxedo', name: 'Tuxedo', category: 'outfits', rarity: 'rare', gemCost: 50, minStage: 'adult', icon: 'tshirt-crew' },
  { id: 'outfit-hawaiian', name: 'Hawaiian Shirt', category: 'outfits', rarity: 'common', gemCost: 20, minStage: 'teen', icon: 'flower' },
  { id: 'outfit-hoodie', name: 'Hoodie', category: 'outfits', rarity: 'common', gemCost: 15, minStage: 'baby', icon: 'tshirt-crew' },
  { id: 'outfit-superhero', name: 'Superhero Suit', category: 'outfits', rarity: 'epic', gemCost: 100, minStage: 'adult', icon: 'shield-star' },
  { id: 'outfit-robe', name: 'Royal Robe', category: 'outfits', rarity: 'legendary', gemCost: 150, minStage: 'master', icon: 'crown' },

  // Capes / Back (5)
  { id: 'cape-red', name: 'Red Cape', category: 'capes', rarity: 'common', gemCost: 20, minStage: 'teen', icon: 'shield-half-full' },
  { id: 'cape-wings', name: 'Angel Wings', category: 'capes', rarity: 'epic', gemCost: 90, minStage: 'adult', icon: 'bird' },
  { id: 'cape-guitar', name: 'Guitar Case', category: 'capes', rarity: 'rare', gemCost: 40, minStage: 'teen', icon: 'guitar-electric' },
  { id: 'cape-notes', name: 'Music Trail', category: 'capes', rarity: 'rare', gemCost: 45, minStage: 'adult', icon: 'music-note' },
  { id: 'cape-rainbow', name: 'Rainbow Cape', category: 'capes', rarity: 'legendary', gemCost: 130, minStage: 'master', icon: 'weather-sunny' },

  // Collars / Neck (5)
  { id: 'collar-bowtie', name: 'Bow Tie', category: 'collars', rarity: 'common', gemCost: 10, minStage: 'baby', icon: 'bow-tie' },
  { id: 'collar-scarf', name: 'Scarf', category: 'collars', rarity: 'common', gemCost: 12, minStage: 'baby', icon: 'scarf' },
  { id: 'collar-bandana', name: 'Bandana', category: 'collars', rarity: 'rare', gemCost: 25, minStage: 'teen', icon: 'bandage' },
  { id: 'collar-necklace', name: 'Necklace', category: 'collars', rarity: 'rare', gemCost: 30, minStage: 'teen', icon: 'necklace' },
  { id: 'collar-medal', name: 'Gold Medal', category: 'collars', rarity: 'epic', gemCost: 70, minStage: 'adult', icon: 'medal' },

  // Effects (4)
  { id: 'effect-sparkle', name: 'Sparkle Aura', category: 'effects', rarity: 'rare', gemCost: 40, minStage: 'teen', icon: 'creation' },
  { id: 'effect-fire', name: 'Fire Aura', category: 'effects', rarity: 'epic', gemCost: 85, minStage: 'adult', icon: 'fire' },
  { id: 'effect-rainbow', name: 'Rainbow Glow', category: 'effects', rarity: 'epic', gemCost: 90, minStage: 'adult', icon: 'looks' },
  { id: 'effect-lightning', name: 'Lightning', category: 'effects', rarity: 'legendary', gemCost: 120, minStage: 'master', icon: 'lightning-bolt' },
];

/** Get accessories by category */
export function getAccessoriesByCategory(category: AccessoryCategory): Accessory[] {
  return ACCESSORIES.filter((a) => a.category === category);
}

/** Get a specific accessory by ID */
export function getAccessoryById(id: string): Accessory | undefined {
  return ACCESSORIES.find((a) => a.id === id);
}

/** Evolution stage order for comparison */
const STAGE_ORDER: Record<EvolutionStage, number> = {
  baby: 0,
  teen: 1,
  adult: 2,
  master: 3,
};

/** Check if a cat can equip an accessory based on evolution stage */
export function canEquipAccessory(accessory: Accessory, currentStage: EvolutionStage): boolean {
  return STAGE_ORDER[currentStage] >= STAGE_ORDER[accessory.minStage];
}
