/**
 * FeedbackText — Animated scoring feedback label (PERFECT!, GOOD!, MISS, etc.)
 *
 * Each feedback type has a unique entrance animation:
 * - PERFECT: Large scale-bounce with neon glow + gold sparkle
 * - GOOD: Quick zoom-in with green glow
 * - OK/EARLY/LATE: Subtle fade-slide
 * - MISS: Shake-wobble with red flash
 */
import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import Animated, {
  ZoomIn,
  ZoomInEasyDown,
  FadeInUp,
  FadeIn,
  SlideInUp,
} from 'react-native-reanimated';
import { COLORS } from '../../theme/tokens';

interface FeedbackTextProps {
  type: 'perfect' | 'good' | 'ok' | 'early' | 'late' | 'miss';
  /** Change to re-trigger animation */
  trigger: number;
  /** Timing offset in ms (negative=early, positive=late) */
  timingOffsetMs?: number;
}

const LABEL: Record<string, string> = {
  perfect: 'PERFECT!',
  good: 'GOOD!',
  ok: 'OK',
  early: 'EARLY',
  late: 'LATE',
  miss: 'MISS',
};

const COLOR: Record<string, string> = {
  perfect: COLORS.feedbackPerfect,
  good: COLORS.feedbackGood,
  ok: COLORS.feedbackOk,
  early: COLORS.feedbackEarly,
  late: COLORS.feedbackLate,
  miss: COLORS.feedbackMiss,
};

// Per-type entering animations — all springified for overshoot bounce
function getEntering(type: string) {
  switch (type) {
    case 'perfect':
      // Big dramatic bounce from center
      return ZoomIn.duration(250).springify().damping(8).stiffness(300);
    case 'good':
      // Quick upward zoom
      return ZoomInEasyDown.duration(200).springify().damping(10).stiffness(250);
    case 'ok':
    case 'early':
    case 'late':
      // Subtle slide up + fade
      return FadeInUp.duration(150).springify().damping(14);
    case 'miss':
      // Fast fade with wobble feel
      return FadeIn.duration(100).springify().damping(6).stiffness(400);
    default:
      return SlideInUp.duration(150);
  }
}

// Font size varies by importance
function getFontSize(type: string): number {
  switch (type) {
    case 'perfect': return 32;
    case 'good': return 28;
    case 'miss': return 26;
    default: return 22;
  }
}

// Glow radius varies by type
function getGlowRadius(type: string): number {
  switch (type) {
    case 'perfect': return 20;
    case 'good': return 12;
    case 'miss': return 10;
    default: return 4;
  }
}

export function FeedbackText({ type, trigger, timingOffsetMs }: FeedbackTextProps) {
  const color = COLOR[type] ?? COLORS.feedbackDefault;
  const label = LABEL[type] ?? '';
  const fontSize = getFontSize(type);
  const glowRadius = getGlowRadius(type);

  // Show timing offset for early/late
  const offsetLabel =
    (type === 'early' || type === 'late') && timingOffsetMs != null
      ? ` ${Math.abs(Math.round(timingOffsetMs))}ms`
      : '';

  return (
    <Animated.Text
      key={trigger}
      entering={getEntering(type)}
      style={[
        styles.text,
        {
          color,
          fontSize,
          textShadowColor: color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: glowRadius,
        },
        type === 'perfect' && styles.perfectExtra,
        type === 'miss' && styles.missExtra,
      ]}
    >
      {label}{offsetLabel}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        // Double text shadow for stronger neon glow on iOS
      },
      default: {},
    }),
  },
  perfectExtra: {
    letterSpacing: 4,
    // iOS gets extra glow layer
    ...Platform.select({
      ios: {
        shadowColor: COLORS.feedbackPerfect,
        shadowOpacity: 0.8,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
      },
      default: {},
    }),
  },
  missExtra: {
    letterSpacing: 2,
    opacity: 0.9,
  },
});
