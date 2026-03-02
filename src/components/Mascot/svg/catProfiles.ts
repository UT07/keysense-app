/**
 * Per-Cat Visual Profiles
 *
 * Each cat gets a unique combination of body type, eye shape, ear type,
 * tail style, and optional features (blush, cheek fluff, freckles).
 * This maps catCharacters.ts IDs → composable SVG part selections.
 */

import type { BodyType, EarType, EyeShape, TailType } from './CatParts';
import { getCatColors } from '../catColorPalette';

export interface CatProfile {
  body: BodyType;
  ears: EarType;
  eyes: EyeShape;
  tail: TailType;
  cheekFluff: boolean;
  blush: boolean;
  blushColor?: string;
}

/** Default profile for unknown cats */
const DEFAULT_PROFILE: CatProfile = {
  body: 'standard',
  ears: 'pointed',
  eyes: 'round',
  tail: 'curled',
  cheekFluff: false,
  blush: false,
};

export const CAT_PROFILES: Record<string, CatProfile> = {
  // ─── Starters ───────────────────────────────
  'mini-meowww': {
    body: 'slim',
    ears: 'pointed',
    eyes: 'big-sparkly',
    tail: 'curled',
    cheekFluff: false,
    blush: true,
    blushColor: getCatColors('mini-meowww').blush ?? undefined,
  },
  'jazzy': {
    body: 'slim',
    ears: 'pointed',
    eyes: 'almond',
    tail: 'straight',
    cheekFluff: false,
    blush: false,
  },
  'luna': {
    body: 'standard',
    ears: 'pointed',
    eyes: 'almond',
    tail: 'fluffy',
    cheekFluff: false,
    blush: false,
  },

  // ─── Gem-unlockable ─────────────────────────
  'biscuit': {
    body: 'round',
    ears: 'rounded',
    eyes: 'round',
    tail: 'curled',
    cheekFluff: true,
    blush: true,
    blushColor: getCatColors('biscuit').blush ?? undefined,
  },
  'ballymakawww': {
    body: 'round',
    ears: 'rounded',
    eyes: 'round',
    tail: 'straight',
    cheekFluff: true,
    blush: true,
    blushColor: getCatColors('ballymakawww').blush ?? undefined,
  },
  'aria': {
    body: 'slim',
    ears: 'pointed',
    eyes: 'big-sparkly',
    tail: 'fluffy',
    cheekFluff: false,
    blush: false,
  },
  'tempo': {
    body: 'slim',
    ears: 'pointed',
    eyes: 'round',
    tail: 'straight',
    cheekFluff: false,
    blush: false,
  },
  'shibu': {
    body: 'slim',
    ears: 'pointed',
    eyes: 'almond',
    tail: 'curled',
    cheekFluff: false,
    blush: true,
    blushColor: getCatColors('shibu').blush ?? undefined,
  },
  'bella': {
    body: 'round',
    ears: 'rounded',
    eyes: 'big-sparkly',
    tail: 'fluffy',
    cheekFluff: true,
    blush: true,
    blushColor: getCatColors('bella').blush ?? undefined,
  },
  'sable': {
    body: 'slim',
    ears: 'pointed',
    eyes: 'almond',
    tail: 'fluffy',
    cheekFluff: false,
    blush: false,
  },
  'coda': {
    body: 'standard',
    ears: 'rounded',
    eyes: 'round',
    tail: 'curled',
    cheekFluff: true,
    blush: false,
  },

  // ─── Legendary ──────────────────────────────
  'chonky-monke': {
    body: 'chonky',
    ears: 'rounded',
    eyes: 'round',
    tail: 'fluffy',
    cheekFluff: true,
    blush: true,
    blushColor: getCatColors('chonky-monke').blush ?? undefined,
  },

  // ─── Coach NPC ──────────────────────────────
  'salsa': {
    body: 'standard',
    ears: 'pointed',
    eyes: 'big-sparkly',
    tail: 'curled',
    cheekFluff: false,
    blush: true,
    blushColor: getCatColors('salsa').blush ?? undefined,
  },
};

/** Look up a cat's visual profile, falling back to default */
export function getCatProfile(catId: string): CatProfile {
  return CAT_PROFILES[catId] ?? DEFAULT_PROFILE;
}
