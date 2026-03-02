/**
 * 3D Cat Model Configuration
 *
 * Maps each cat character to its 3D model file, body type, material colors,
 * and animation mappings. Used by CatModel3D to render the correct GLB model
 * with per-cat color overrides.
 *
 * Body type → GLB mapping:
 *   slim     → slim-cat.glb
 *   standard → salsa-cat.glb
 *   round    → round-cat.glb
 *   chonky   → chonky-cat.glb
 */

import type { CatPose } from '../animations/catAnimations';
import type { EvolutionStage } from '@/stores/types';
import { CAT_CHARACTERS } from '../catCharacters';

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

export type BodyType3D = 'slim' | 'standard' | 'round' | 'chonky';

export interface Cat3DMaterials {
  body: string;      // hex color for body mesh
  belly: string;     // hex color for belly mesh
  earInner: string;  // hex color for inner ear
  eye: string;       // hex color for iris
  nose: string;      // hex color for nose
  blush?: string;    // hex color for blush marks (if present)
  accent: string;    // UI accent / glow color
}

export interface Cat3DConfig {
  bodyType: BodyType3D;
  materials: Cat3DMaterials;
  hasBlush: boolean;
}

// ────────────────────────────────────────────────
// GLB paths (loaded via require for Metro bundler)
// ────────────────────────────────────────────────

export const MODEL_PATHS: Record<BodyType3D, number> = {
  slim: require('../../../../assets/models/slim-cat.glb'),
  standard: require('../../../../assets/models/salsa-cat.glb'),
  round: require('../../../../assets/models/round-cat.glb'),
  chonky: require('../../../../assets/models/chonky-cat.glb'),
};

// ────────────────────────────────────────────────
// Animation name mapping
// Each body type has NLA tracks prefixed with the body type name.
// Map CatPose → GLB animation clip name.
// ────────────────────────────────────────────────

const ANIMATION_PREFIXES: Record<BodyType3D, string> = {
  slim: 'Slim',
  standard: 'Cat',
  round: 'Round',
  chonky: 'Chonk',
};

const POSE_TO_ANIM: Record<CatPose, string> = {
  idle: 'Idle',
  celebrate: 'Celebrate',
  teach: 'Teach',
  sleep: 'Sleep',
  play: 'Play',
  sad: 'Sad',
  curious: 'Curious',
};

/** Get the GLB animation clip name for a given body type and pose */
export function getAnimationName(bodyType: BodyType3D, pose: CatPose): string {
  const prefix = ANIMATION_PREFIXES[bodyType];
  const anim = POSE_TO_ANIM[pose];
  return `${prefix}_${anim}_Track`;
}

// ────────────────────────────────────────────────
// Per-cat configs
// ────────────────────────────────────────────────

const CAT_3D_CONFIGS: Record<string, Cat3DConfig> = {
  // ─── Starters ───────────────────────────────
  'mini-meowww': {
    bodyType: 'slim',
    hasBlush: true,
    materials: {
      body: '#555555',   // Charcoal grey (visible on dark BG)
      belly: '#F5F5F5',
      earInner: '#FF3355',
      eye: '#3DFF88',    // Brighter green for pop
      nose: '#FF3355',
      blush: '#FF9999',
      accent: '#FF3355',
    },
  },
  'jazzy': {
    bodyType: 'slim',
    hasBlush: false,
    materials: {
      body: '#5D5D80',   // Brighter purple-grey
      belly: '#8888A8',
      earInner: '#B06EDE',
      eye: '#E0B8FF',
      nose: '#B06EDE',
      accent: '#B06EDE',
    },
  },
  'luna': {
    bodyType: 'standard',
    hasBlush: false,
    materials: {
      body: '#454580',   // Brighter midnight blue
      belly: '#5E5EA0',
      earInner: '#7088CC',
      eye: '#99CCFF',
      nose: '#5568AA',
      accent: '#7088CC',
    },
  },

  // ─── Gem-unlockable ─────────────────────────
  'biscuit': {
    bodyType: 'round',
    hasBlush: true,
    materials: {
      body: '#F5D5C8',
      belly: '#FFF0EB',
      earInner: '#F39C9C',
      eye: '#81D4FA',
      nose: '#F48FB1',
      blush: '#FFAAAA',
      accent: '#F39C9C',
    },
  },
  'ballymakawww': {
    bodyType: 'round',
    hasBlush: true,
    materials: {
      body: '#D4763A',
      belly: '#FFF3E0',
      earInner: '#1ABC9C',
      eye: '#1ABC9C',
      nose: '#C0713B',
      blush: '#FFB07C',
      accent: '#1ABC9C',
    },
  },
  'aria': {
    bodyType: 'slim',
    hasBlush: false,
    materials: {
      body: '#F5E6D3',
      belly: '#FFF8F0',
      earInner: '#8B6914',
      eye: '#4FC3F7',
      nose: '#8B6914',
      accent: '#FFD700',
    },
  },
  'tempo': {
    bodyType: 'slim',
    hasBlush: false,
    materials: {
      body: '#D4553A',
      belly: '#FFCCBC',
      earInner: '#E74C3C',
      eye: '#FFEB3B',
      nose: '#E74C3C',
      accent: '#E74C3C',
    },
  },
  'shibu': {
    bodyType: 'slim',
    hasBlush: true,
    materials: {
      body: '#F5E6D3',
      belly: '#FFF8F0',
      earInner: '#FF7043',
      eye: '#80DEEA',
      nose: '#FFAB91',
      blush: '#FFCCAA',
      accent: '#FF7043',
    },
  },
  'bella': {
    bodyType: 'round',
    hasBlush: true,
    materials: {
      body: '#F5F5F5',
      belly: '#FFFFFF',
      earInner: '#FFB6C1',
      eye: '#64B5F6',
      nose: '#FFB6C1',
      blush: '#FFD1DC',
      accent: '#90CAF9',
    },
  },
  'sable': {
    bodyType: 'slim',
    hasBlush: false,
    materials: {
      body: '#5A5A5A',   // Medium grey (visible on dark BG)
      belly: '#787878',
      earInner: '#C060D8',
      eye: '#E0A8F0',
      nose: '#9540B0',
      accent: '#C060D8',
    },
  },
  'coda': {
    bodyType: 'standard',
    hasBlush: false,
    materials: {
      body: '#546E7A',
      belly: '#78909C',
      earInner: '#42A5F5',
      eye: '#BBDEFB',
      nose: '#37474F',
      accent: '#42A5F5',
    },
  },

  // ─── Legendary ──────────────────────────────
  'chonky-monke': {
    bodyType: 'chonky',
    hasBlush: true,
    materials: {
      body: '#E8871E',
      belly: '#FFF3E0',
      earInner: '#FFB74D',
      eye: '#FFD54F',
      nose: '#FF8C00',
      blush: '#FFB74D',
      accent: '#FF8C00',
    },
  },

  // ─── Coach NPC ──────────────────────────────
  'salsa': {
    bodyType: 'standard',
    hasBlush: true,
    materials: {
      body: '#7A7A8A',
      belly: '#B0B0BE',
      earInner: '#FF5252',
      eye: '#2ECC71',
      nose: '#FF5252',
      blush: '#FF5252',
      accent: '#FF5252',
    },
  },
};

/** Get 3D config for a cat by ID, falling back to Salsa's config */
export function getCat3DConfig(catId: string): Cat3DConfig {
  return CAT_3D_CONFIGS[catId] ?? CAT_3D_CONFIGS['salsa'];
}

/** Get all cat IDs that have 3D configs */
export function getAllCat3DIds(): string[] {
  return Object.keys(CAT_3D_CONFIGS);
}

// ────────────────────────────────────────────────
// Accessory props from evolution stage
// ────────────────────────────────────────────────

export interface AccessoryProps {
  accessories: string[];
  accentColor: string;
  hasGlow: boolean;
  auraIntensity: number;
}

/**
 * Look up the evolution-stage accessories for a cat from catCharacters.ts.
 * Returns null for 'salsa' (NPC coach, no evolution).
 */
export function getAccessoryProps(catId: string, stage: EvolutionStage): AccessoryProps | null {
  if (catId === 'salsa') return null;

  const character = CAT_CHARACTERS.find(c => c.id === catId);
  if (!character) return null;

  const stageVisuals = character.evolutionVisuals[stage];
  if (!stageVisuals || stageVisuals.accessories.length === 0) return null;

  const config = CAT_3D_CONFIGS[catId];
  return {
    accessories: stageVisuals.accessories,
    accentColor: config?.materials.accent ?? '#9B59B6',
    hasGlow: stageVisuals.hasGlow,
    auraIntensity: stageVisuals.auraIntensity,
  };
}
