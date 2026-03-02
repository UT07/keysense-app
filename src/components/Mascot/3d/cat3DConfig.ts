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
import { logger } from '../../../utils/logger';
import type { EvolutionStage } from '@/stores/types';
import { CAT_CHARACTERS } from '../catCharacters';
import { getCatColors } from '../catColorPalette';

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
// Per-cat configs (colors sourced from shared palette)
// ────────────────────────────────────────────────

function paletteToMaterials(catId: string): Cat3DMaterials {
  const c = getCatColors(catId);
  return {
    body: c.body,
    belly: c.belly,
    earInner: c.earInner,
    eye: c.eye,
    nose: c.nose,
    blush: c.blush ?? undefined,
    accent: c.accent,
  };
}

const CAT_3D_CONFIGS: Record<string, Cat3DConfig> = {
  // ─── Starters ───────────────────────────────
  'mini-meowww': { bodyType: 'slim', hasBlush: true, materials: paletteToMaterials('mini-meowww') },
  'jazzy': { bodyType: 'slim', hasBlush: false, materials: paletteToMaterials('jazzy') },
  'luna': { bodyType: 'standard', hasBlush: false, materials: paletteToMaterials('luna') },

  // ─── Gem-unlockable ─────────────────────────
  'biscuit': { bodyType: 'round', hasBlush: true, materials: paletteToMaterials('biscuit') },
  'ballymakawww': { bodyType: 'round', hasBlush: true, materials: paletteToMaterials('ballymakawww') },
  'aria': { bodyType: 'slim', hasBlush: false, materials: paletteToMaterials('aria') },
  'tempo': { bodyType: 'slim', hasBlush: false, materials: paletteToMaterials('tempo') },
  'shibu': { bodyType: 'slim', hasBlush: true, materials: paletteToMaterials('shibu') },
  'bella': { bodyType: 'round', hasBlush: true, materials: paletteToMaterials('bella') },
  'sable': { bodyType: 'slim', hasBlush: false, materials: paletteToMaterials('sable') },
  'coda': { bodyType: 'standard', hasBlush: false, materials: paletteToMaterials('coda') },

  // ─── Legendary ──────────────────────────────
  'chonky-monke': { bodyType: 'chonky', hasBlush: true, materials: paletteToMaterials('chonky-monke') },

  // ─── Coach NPC ──────────────────────────────
  'salsa': { bodyType: 'standard', hasBlush: true, materials: paletteToMaterials('salsa') },
};

/** Get 3D config for a cat by ID, falling back to Salsa's config.
 *  Validates that the resolved body type has a corresponding MODEL_PATHS entry
 *  to prevent error loops if a GLB model is missing. Falls through body types
 *  until a valid one is found, ultimately defaulting to 'standard' (salsa-cat.glb).
 */
export function getCat3DConfig(catId: string): Cat3DConfig {
  const config = CAT_3D_CONFIGS[catId] ?? CAT_3D_CONFIGS['salsa'];

  // BUG-7: Validate the body type has a loadable model path.
  // If the resolved body type's GLB failed to require() (would be undefined/0),
  // fall back to 'standard' which maps to salsa-cat.glb.
  if (!MODEL_PATHS[config.bodyType]) {
    logger.warn(
      `[cat3DConfig] No model for bodyType '${config.bodyType}' (cat: ${catId}), falling back to 'standard'`
    );
    return { ...config, bodyType: 'standard' };
  }

  return config;
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
