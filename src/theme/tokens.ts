import { Platform } from 'react-native';

// ─────────────────────────────────────────────────
// COLORS — Concert Hall: black + crimson red
// ─────────────────────────────────────────────────

export const COLORS = {
  // Core surfaces (true blacks, neutral — no purple tint)
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1C1C1C',
  surfaceOverlay: 'rgba(0, 0, 0, 0.85)',

  // Primary (crimson)
  primary: '#DC143C',
  primaryLight: '#FF2D55',
  primaryDark: '#8B0000',

  // Cards (neutral dark greys)
  cardSurface: '#181818',
  cardBorder: '#2A2A2A',
  cardHighlight: '#222222',

  // Text (clean whites and greys — no lavender)
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  textAccent: '#DC143C',

  // Status
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  // Gamification
  starGold: '#FFD700',
  starEmpty: '#444444',
  gemGold: '#FFD700',
  gemDiamond: '#4FC3F7',
  evolutionGlow: '#FFD54F',
  evolutionFlash: '#FFFFFF',

  // Streak
  streakFlame: '#FF6B35',
  streakFlameWarm: '#FF9800',
  streakFlameMedium: '#FF6B00',
  streakFlameHot: '#FF4500',

  // Exercise feedback
  feedbackPerfect: '#00E676',
  feedbackGood: '#69F0AE',
  feedbackOk: '#FFD740',
  feedbackEarly: '#40C4FF',
  feedbackLate: '#FFAB40',
  feedbackMiss: '#FF5252',
  feedbackDefault: '#757575',

  // Combo
  comboGold: '#FFD700',
} as const;

// ─────────────────────────────────────────────────
// GRADIENTS
// ─────────────────────────────────────────────────

export const GRADIENTS = {
  dark: ['#141414', '#0A0A0A'] as const,
  gold: ['#FFD700', '#FFA500'] as const,
  success: ['#4CAF50', '#2E7D32'] as const,
  crimson: ['#DC143C', '#8B0000'] as const,
  header: ['#1C1C1C', '#0A0A0A'] as const,
  gem: ['#FFD700', '#FF8C00'] as const,
  evolution: ['#FFD54F', '#FF8C00'] as const,
  heroGlow: ['#2A0A0A', '#1A0A0A', '#0A0A0A'] as const,
  cardWarm: ['#1C1C1C', '#181818'] as const,

  // Lava lamp keyframes — 4 palettes that cycle slowly
  // Each palette is a 3-stop gradient [top, mid, bottom]
  lavaLamp: {
    duration: 8000, // full cycle time in ms
    palettes: [
      ['#1A0000', '#0A0A0A', '#0A0A0A'] as const,   // subtle deep red bleed at top
      ['#0A0A0A', '#1A0505', '#0A0A0A'] as const,   // crimson ember in center
      ['#0A0A0A', '#0A0A0A', '#1A0000'] as const,   // red glow settling to bottom
      ['#120000', '#0E0303', '#0A0A0A'] as const,   // warm dark red wash
    ] as const,
  },
} as const;

// ─────────────────────────────────────────────────
// GLOW
// ─────────────────────────────────────────────────

export const GLOW = {
  crimson: 'rgba(220, 20, 60, 0.3)',
  gold: 'rgba(255, 215, 0, 0.3)',
  dark: 'rgba(28, 28, 28, 0.3)',
  success: 'rgba(76, 175, 80, 0.3)',
} as const;

/** Create a glow color from any hex */
export function glowColor(hex: string, opacity = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// ─────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────

export const TYPOGRAPHY = {
  display: {
    lg: { fontSize: 36, lineHeight: 44, fontWeight: '800' as const },
    md: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const },
    sm: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
  },
  heading: {
    lg: { fontSize: 20, lineHeight: 28, fontWeight: '700' as const },
    md: { fontSize: 18, lineHeight: 26, fontWeight: '600' as const },
    sm: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  },
  body: {
    lg: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
    md: { fontSize: 14, lineHeight: 22, fontWeight: '400' as const },
    sm: { fontSize: 13, lineHeight: 20, fontWeight: '400' as const },
  },
  caption: {
    lg: { fontSize: 12, lineHeight: 18, fontWeight: '400' as const },
    md: { fontSize: 11, lineHeight: 16, fontWeight: '400' as const },
    sm: { fontSize: 10, lineHeight: 14, fontWeight: '400' as const },
  },
  button: {
    lg: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
    md: { fontSize: 14, lineHeight: 22, fontWeight: '600' as const },
    sm: { fontSize: 12, lineHeight: 18, fontWeight: '600' as const },
  },
  special: {
    score: { fontSize: 48, lineHeight: 56, fontWeight: '800' as const },
    badge: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, textTransform: 'uppercase' as const },
  },
} as const;

// ─────────────────────────────────────────────────
// SHADOWS
// ─────────────────────────────────────────────────

export const SHADOWS = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    android: { elevation: 2 },
    default: {},
  }) as Record<string, unknown>,

  md: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
    },
    android: { elevation: 4 },
    default: {},
  }) as Record<string, unknown>,

  lg: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
    },
    android: { elevation: 8 },
    default: {},
  }) as Record<string, unknown>,
} as const;

/** Colored glow shadow (iOS only — Android uses elevation) */
export function shadowGlow(color: string, radius = 12) {
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: radius,
    },
    android: { elevation: 6 },
    default: {},
  });
}

// ─────────────────────────────────────────────────
// SPACING
// ─────────────────────────────────────────────────

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ─────────────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────────────

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// ─────────────────────────────────────────────────
// ANIMATION CONFIG
// ─────────────────────────────────────────────────

export const ANIMATION_CONFIG = {
  // Legacy presets (preserved for backward compat)
  spring: { damping: 15, stiffness: 150 },
  bounce: { damping: 8, stiffness: 200 },
  fadeIn: { duration: 300 },
  slideUp: { duration: 400 },
  celebration: { duration: 2000 },

  // Duration tokens
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
  },

  // Spring presets (Reanimated withSpring config)
  springSnappy: { damping: 20, stiffness: 300 },
  springBouncy: { damping: 8, stiffness: 200 },
  springGentle: { damping: 15, stiffness: 100 },

  // Stagger delays for list animations
  stagger: {
    fast: 50,
    normal: 80,
    slow: 120,
  },
} as const;

// ─────────────────────────────────────────────────
// COMBO TIER SYSTEM (ExercisePlayer escalation)
// ─────────────────────────────────────────────────

export interface ComboTier {
  name: string;
  minCombo: number;
  color: string;
  glowColor: string;
  borderColor: string;
  label: string;
}

export const COMBO_TIERS: readonly ComboTier[] = [
  { name: 'NORMAL',    minCombo: 0,  color: '#FFFFFF',  glowColor: 'transparent',          borderColor: 'transparent',  label: '' },
  { name: 'GOOD',      minCombo: 5,  color: '#FFD700',  glowColor: 'rgba(255,215,0,0.3)',  borderColor: '#FFD700',      label: 'GOOD!' },
  { name: 'FIRE',      minCombo: 10, color: '#FF6B35',  glowColor: 'rgba(255,107,53,0.4)', borderColor: '#FF4500',      label: 'FIRE!' },
  { name: 'SUPER',     minCombo: 15, color: '#FFD700',  glowColor: 'rgba(255,215,0,0.5)',  borderColor: '#FFD700',      label: 'SUPER!' },
  { name: 'LEGENDARY', minCombo: 20, color: '#FF2D55',  glowColor: 'rgba(255,45,85,0.6)',  borderColor: '#FF2D55',      label: 'LEGENDARY!' },
] as const;

/** Get the active combo tier for a given combo count */
export function getComboTier(comboCount: number): ComboTier {
  for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
    if (comboCount >= COMBO_TIERS[i].minCombo) return COMBO_TIERS[i];
  }
  return COMBO_TIERS[0];
}

// ─────────────────────────────────────────────────
// RARITY SYSTEM (Game cards, chests, cat borders)
// ─────────────────────────────────────────────────

export const RARITY = {
  common: {
    borderColor: '#555555',
    glowColor: 'rgba(100,100,100,0.2)',
    label: 'Common',
    gradient: ['#3A3A3A', '#2A2A2A'] as const,
  },
  rare: {
    borderColor: '#4FC3F7',
    glowColor: 'rgba(79,195,247,0.3)',
    label: 'Rare',
    gradient: ['#1A3A5C', '#0D2137'] as const,
  },
  epic: {
    borderColor: '#CE93D8',
    glowColor: 'rgba(206,147,216,0.4)',
    label: 'Epic',
    gradient: ['#3A1A4A', '#1F0A2A'] as const,
  },
  legendary: {
    borderColor: '#FFD700',
    glowColor: 'rgba(255,215,0,0.5)',
    label: 'Legendary',
    gradient: ['#4A3A0A', '#2A1F00'] as const,
  },
} as const;

export type RarityLevel = keyof typeof RARITY;
