/**
 * Cat Accessory Definitions
 *
 * 48 accessories across 6 categories, with rarity-based pricing
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
  // Hats (9)
  { id: 'hat-beret', name: 'Beret', category: 'hats', rarity: 'common', gemCost: 15, minStage: 'teen', icon: 'hat-fedora' },
  { id: 'hat-tophat', name: 'Top Hat', category: 'hats', rarity: 'rare', gemCost: 40, minStage: 'teen', icon: 'hat-fedora' },
  { id: 'hat-santa', name: 'Santa Hat', category: 'hats', rarity: 'rare', gemCost: 35, minStage: 'baby', icon: 'snowflake' },
  { id: 'hat-wizard', name: 'Wizard Hat', category: 'hats', rarity: 'epic', gemCost: 75, minStage: 'adult', icon: 'wizard-hat' },
  { id: 'hat-pirate', name: 'Pirate Hat', category: 'hats', rarity: 'epic', gemCost: 80, minStage: 'adult', icon: 'pirate' },
  { id: 'hat-crown', name: 'Crown', category: 'hats', rarity: 'legendary', gemCost: 150, minStage: 'master', icon: 'crown' },
  { id: 'hat-headphones', name: 'Golden Headphones', category: 'hats', rarity: 'rare', gemCost: 30, minStage: 'teen', icon: 'headphones' },
  { id: 'hat-nightcap', name: 'Night Cap', category: 'hats', rarity: 'common', gemCost: 10, minStage: 'baby', icon: 'weather-night' },
  { id: 'hat-tinycrown', name: 'Tiny Crown', category: 'hats', rarity: 'rare', gemCost: 45, minStage: 'teen', icon: 'crown' },

  // Glasses (8)
  { id: 'glass-round', name: 'Round Glasses', category: 'glasses', rarity: 'common', gemCost: 10, minStage: 'baby', icon: 'glasses' },
  { id: 'glass-sunglasses', name: 'Sunglasses', category: 'glasses', rarity: 'common', gemCost: 15, minStage: 'teen', icon: 'sunglasses' },
  { id: 'glass-monocle', name: 'Monocle', category: 'glasses', rarity: 'rare', gemCost: 35, minStage: 'adult', icon: 'circle-outline' },
  { id: 'glass-star', name: 'Star Glasses', category: 'glasses', rarity: 'epic', gemCost: 60, minStage: 'adult', icon: 'star-four-points' },
  { id: 'glass-heart', name: 'Heart Glasses', category: 'glasses', rarity: 'epic', gemCost: 65, minStage: 'teen', icon: 'heart' },
  { id: 'glass-opera', name: 'Opera Glasses', category: 'glasses', rarity: 'rare', gemCost: 40, minStage: 'adult', icon: 'binoculars' },
  { id: 'glass-nerd', name: 'Thick Frames', category: 'glasses', rarity: 'common', gemCost: 10, minStage: 'baby', icon: 'glasses' },
  { id: 'glass-3d', name: '3D Glasses', category: 'glasses', rarity: 'rare', gemCost: 30, minStage: 'teen', icon: 'glasses' },

  // Outfits (8)
  { id: 'outfit-tuxedo', name: 'Tuxedo', category: 'outfits', rarity: 'rare', gemCost: 50, minStage: 'adult', icon: 'tshirt-crew' },
  { id: 'outfit-hawaiian', name: 'Hawaiian Shirt', category: 'outfits', rarity: 'common', gemCost: 20, minStage: 'teen', icon: 'flower' },
  { id: 'outfit-hoodie', name: 'Hoodie', category: 'outfits', rarity: 'common', gemCost: 15, minStage: 'baby', icon: 'tshirt-crew' },
  { id: 'outfit-superhero', name: 'Superhero Suit', category: 'outfits', rarity: 'epic', gemCost: 100, minStage: 'adult', icon: 'shield-star' },
  { id: 'outfit-robe', name: 'Royal Robe', category: 'outfits', rarity: 'legendary', gemCost: 150, minStage: 'master', icon: 'crown' },
  { id: 'outfit-conductor', name: 'Conductor Coat', category: 'outfits', rarity: 'epic', gemCost: 85, minStage: 'adult', icon: 'music-clef-treble' },
  { id: 'outfit-kimono', name: 'Kimono', category: 'outfits', rarity: 'rare', gemCost: 45, minStage: 'teen', icon: 'flower-tulip' },
  { id: 'outfit-jersey', name: 'Sports Jersey', category: 'outfits', rarity: 'common', gemCost: 15, minStage: 'baby', icon: 'tshirt-crew' },

  // Capes / Back (8)
  { id: 'cape-red', name: 'Red Cape', category: 'capes', rarity: 'common', gemCost: 20, minStage: 'teen', icon: 'shield-half-full' },
  { id: 'cape-wings', name: 'Angel Wings', category: 'capes', rarity: 'epic', gemCost: 90, minStage: 'adult', icon: 'bird' },
  { id: 'cape-guitar', name: 'Guitar Case', category: 'capes', rarity: 'rare', gemCost: 40, minStage: 'teen', icon: 'guitar-electric' },
  { id: 'cape-notes', name: 'Music Trail', category: 'capes', rarity: 'rare', gemCost: 45, minStage: 'adult', icon: 'music-note' },
  { id: 'cape-rainbow', name: 'Rainbow Cape', category: 'capes', rarity: 'legendary', gemCost: 130, minStage: 'master', icon: 'weather-sunny' },
  { id: 'cape-butterfly', name: 'Butterfly Wings', category: 'capes', rarity: 'epic', gemCost: 95, minStage: 'adult', icon: 'butterfly' },
  { id: 'cape-conductor', name: 'Conductor Tails', category: 'capes', rarity: 'rare', gemCost: 35, minStage: 'teen', icon: 'music-clef-treble' },
  { id: 'cape-starry', name: 'Starry Cloak', category: 'capes', rarity: 'legendary', gemCost: 140, minStage: 'master', icon: 'star-shooting' },

  // Collars / Neck (8)
  { id: 'collar-bowtie', name: 'Bow Tie', category: 'collars', rarity: 'common', gemCost: 10, minStage: 'baby', icon: 'bow-tie' },
  { id: 'collar-scarf', name: 'Scarf', category: 'collars', rarity: 'common', gemCost: 12, minStage: 'baby', icon: 'scarf' },
  { id: 'collar-bandana', name: 'Bandana', category: 'collars', rarity: 'rare', gemCost: 25, minStage: 'teen', icon: 'bandage' },
  { id: 'collar-necklace', name: 'Necklace', category: 'collars', rarity: 'rare', gemCost: 30, minStage: 'teen', icon: 'necklace' },
  { id: 'collar-medal', name: 'Gold Medal', category: 'collars', rarity: 'epic', gemCost: 70, minStage: 'adult', icon: 'medal' },
  { id: 'collar-bell', name: 'Bell Charm', category: 'collars', rarity: 'common', gemCost: 8, minStage: 'baby', icon: 'bell' },
  { id: 'collar-musicnote', name: 'Music Note Pendant', category: 'collars', rarity: 'rare', gemCost: 30, minStage: 'teen', icon: 'music-note' },
  { id: 'collar-choker', name: 'Choker', category: 'collars', rarity: 'rare', gemCost: 25, minStage: 'teen', icon: 'circle' },

  // Effects (7)
  { id: 'effect-sparkle', name: 'Sparkle Aura', category: 'effects', rarity: 'rare', gemCost: 40, minStage: 'teen', icon: 'creation' },
  { id: 'effect-fire', name: 'Fire Aura', category: 'effects', rarity: 'epic', gemCost: 85, minStage: 'adult', icon: 'fire' },
  { id: 'effect-rainbow', name: 'Rainbow Glow', category: 'effects', rarity: 'epic', gemCost: 90, minStage: 'adult', icon: 'looks' },
  { id: 'effect-lightning', name: 'Lightning', category: 'effects', rarity: 'legendary', gemCost: 120, minStage: 'master', icon: 'lightning-bolt' },
  { id: 'effect-notes', name: 'Musical Notes', category: 'effects', rarity: 'rare', gemCost: 45, minStage: 'teen', icon: 'music-note-eighth' },
  { id: 'effect-hearts', name: 'Love Hearts', category: 'effects', rarity: 'rare', gemCost: 40, minStage: 'teen', icon: 'heart-multiple' },
  { id: 'effect-snowflake', name: 'Snowfall', category: 'effects', rarity: 'epic', gemCost: 80, minStage: 'adult', icon: 'snowflake' },
];

/**
 * Map shop accessory IDs → CatAccessories3D render names.
 * null = no 3D geometry (effects, some outfits).
 */
export const ACCESSORY_RENDER_NAMES: Record<string, string | null> = {
  // Hats
  'hat-beret': 'beanie',
  'hat-tophat': 'fedora',
  'hat-santa': 'beanie',
  'hat-wizard': 'fedora',
  'hat-pirate': 'fedora',
  'hat-crown': 'crown',
  'hat-headphones': 'golden-headphones',
  'hat-nightcap': 'beanie',
  'hat-tinycrown': 'tiny-crown',
  // Glasses
  'glass-round': 'round-glasses',
  'glass-sunglasses': 'sunglasses',
  'glass-monocle': 'monocle',
  'glass-star': 'pixel-glasses',
  'glass-heart': 'round-glasses',
  'glass-opera': 'monocle',
  'glass-nerd': 'round-glasses',
  'glass-3d': 'racing-goggles',
  // Outfits
  'outfit-tuxedo': 'bow-tie',
  'outfit-hawaiian': null,
  'outfit-hoodie': null,
  'outfit-superhero': 'cape',
  'outfit-robe': 'royal-robe',
  'outfit-conductor': 'conductor-coat',
  'outfit-kimono': 'kimono-sash',
  'outfit-jersey': null,
  // Capes
  'cape-red': 'cape',
  'cape-wings': 'cape',
  'cape-guitar': null,
  'cape-notes': null,
  'cape-rainbow': 'golden-cape',
  'cape-butterfly': 'cape',
  'cape-conductor': 'cape',
  'cape-starry': 'cape-purple',
  // Collars
  'collar-bowtie': 'bow-tie',
  'collar-scarf': 'scarf',
  'collar-bandana': 'scarf',
  'collar-necklace': 'pearl-necklace',
  'collar-medal': 'gem-pendant',
  'collar-bell': 'temple-bell',
  'collar-musicnote': 'gem-pendant',
  'collar-choker': 'crescent-collar',
  // Effects (auras — no 3D geometry)
  'effect-sparkle': null,
  'effect-fire': null,
  'effect-rainbow': null,
  'effect-lightning': null,
  'effect-notes': null,
  'effect-hearts': null,
  'effect-snowflake': null,
};

/** Convert equipped accessory IDs to 3D render names (filtering out nulls) */
export function getEquippedRenderNames(equippedAccessories: Record<string, string>): string[] {
  return Object.values(equippedAccessories)
    .map((id) => ACCESSORY_RENDER_NAMES[id])
    .filter((name): name is string => name != null);
}

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
