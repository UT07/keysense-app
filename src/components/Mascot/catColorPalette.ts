/**
 * Shared Cat Color Palette — Single Source of Truth
 *
 * All 13 cat color definitions live here. Both the 3D material system
 * (cat3DConfig.ts) and SVG profile system (catProfiles.ts / catCharacters.ts)
 * import from this file to guarantee visual consistency.
 *
 * Palette follows the chibi anime redesign: anime-vivid versions of real
 * cat breed coats with neon eye/accent pops.
 */

export interface CatColors {
  body: string;
  belly: string;
  earInner: string;
  eye: string;
  nose: string;
  blush: string | null;
  accent: string;
}

const PALETTE: Record<string, CatColors> = {
  // ─── Starters ───────────────────────────────
  'mini-meowww': {
    body: '#1A1A2E',
    belly: '#F0F0F5',
    earInner: '#FF4D6A',
    eye: '#3DFF88',
    nose: '#FF4D6A',
    blush: '#FF8FA0',
    accent: '#3DFF88',
  },
  jazzy: {
    body: '#6B7B9E',
    belly: '#A8B8D0',
    earInner: '#9B59FF',
    eye: '#B06EFF',
    nose: '#8E7CC3',
    blush: null,
    accent: '#9B59FF',
  },
  luna: {
    body: '#8A95A8',
    belly: '#C8D0DC',
    earInner: '#5BA8FF',
    eye: '#5BA8FF',
    nose: '#7088AA',
    blush: null,
    accent: '#5BA8FF',
  },

  // ─── Gem-unlockable ─────────────────────────
  biscuit: {
    body: '#F5D5B8',
    belly: '#FFF0E0',
    earInner: '#FF7EB3',
    eye: '#FF7EB3',
    nose: '#E8A88A',
    blush: '#FFB0C8',
    accent: '#FF7EB3',
  },
  ballymakawww: {
    body: '#E8873A',
    belly: '#FFF0D0',
    earInner: '#2ECC71',
    eye: '#2ECC71',
    nose: '#D4763A',
    blush: '#FFB07C',
    accent: '#2ECC71',
  },
  aria: {
    body: '#D4A855',
    belly: '#F5E8C8',
    earInner: '#FFB020',
    eye: '#FFBE44',
    nose: '#C09040',
    blush: null,
    accent: '#FFD700',
  },
  tempo: {
    body: '#E86840',
    belly: '#FFD8C0',
    earInner: '#FF4500',
    eye: '#FF6B20',
    nose: '#D04020',
    blush: null,
    accent: '#FF4500',
  },
  shibu: {
    body: '#F5E6D3',
    belly: '#FFF8F0',
    earInner: '#20B2AA',
    eye: '#20CCBB',
    nose: '#C8A088',
    blush: '#FFD0B8',
    accent: '#20B2AA',
  },
  bella: {
    body: '#F8F8FF',
    belly: '#FFFFFF',
    earInner: '#FF80A0',
    eye: '#4488FF',
    nose: '#FFB0C0',
    blush: '#FFD0DC',
    accent: '#4488FF',
  },
  sable: {
    body: '#5A3828',
    belly: '#8A6848',
    earInner: '#C060FF',
    eye: '#C060FF',
    nose: '#4A2818',
    blush: null,
    accent: '#C060FF',
  },
  coda: {
    body: '#6E8898',
    belly: '#90A8B8',
    earInner: '#44AAFF',
    eye: '#44AAFF',
    nose: '#506878',
    blush: null,
    accent: '#44AAFF',
  },

  // ─── Legendary ──────────────────────────────
  'chonky-monke': {
    body: '#F0922E',
    belly: '#FFF5E8',
    earInner: '#FFB74D',
    eye: '#FFD54F',
    nose: '#E08020',
    blush: '#FFB74D',
    accent: '#FF8C00',
  },

  // ─── Coach NPC ──────────────────────────────
  salsa: {
    body: '#484858',
    belly: '#707080',
    earInner: '#FF5252',
    eye: '#2ECC71',
    nose: '#FF5252',
    blush: '#FF5252',
    accent: '#2ECC71',
  },
};

export const ALL_CAT_IDS = Object.keys(PALETTE);

export function getCatColors(catId: string): CatColors {
  return PALETTE[catId] ?? PALETTE['salsa'];
}
