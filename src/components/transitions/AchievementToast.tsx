/**
 * AchievementToast Component
 * Small non-blocking toast notification for XP, streak, level-up, and star events
 * Slides in from top of screen with auto-dismiss
 */

import React, { useEffect, useCallback } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { soundManager } from '../../audio/SoundManager';

export type AchievementType = 'xp' | 'streak' | 'level-up' | 'star';

export interface AchievementToastProps {
  type: AchievementType;
  value: number | string;
  onDismiss?: () => void;
  autoDismissMs?: number;
}

const TOAST_COLORS: Record<AchievementType, { bg: string; border: string }> = {
  xp: { bg: 'rgba(255, 215, 0, 0.15)', border: 'rgba(255, 215, 0, 0.3)' },
  streak: { bg: 'rgba(255, 152, 0, 0.15)', border: 'rgba(255, 152, 0, 0.3)' },
  'level-up': { bg: 'rgba(220, 20, 60, 0.2)', border: 'rgba(220, 20, 60, 0.4)' },
  star: { bg: 'rgba(76, 175, 80, 0.15)', border: 'rgba(76, 175, 80, 0.3)' },
};

const TOAST_ICONS: Record<AchievementType, string> = {
  xp: '\u26A1',       // lightning bolt
  streak: '\uD83D\uDD25',  // fire
  'level-up': '\uD83C\uDF1F', // star2
  star: '\u2B50',      // star
};

const TOAST_TEXT_COLORS: Record<AchievementType, string> = {
  xp: '#FFD700',
  streak: '#FF9800',
  'level-up': '#DC143C',
  star: '#4CAF50',
};

/**
 * AchievementToast - Slides in from top, auto-dismisses
 * Non-blocking: does not cover interactive UI
 */
export function AchievementToast({
  type,
  value,
  onDismiss,
  autoDismissMs = 3000,
}: AchievementToastProps): React.JSX.Element {
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  useEffect(() => {
    // Play sound effect based on toast type
    if (type === 'level-up') {
      soundManager.play('level_up');
    } else if (type === 'star') {
      soundManager.play('star_earn');
    } else if (type === 'xp') {
      soundManager.play('xp_tick');
    }

    // Slide in
    translateY.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
    // Fade in, hold, then fade out and slide up
    opacity.value = withSequence(
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
      withDelay(
        autoDismissMs - 600,
        withTiming(0, { duration: 300, easing: Easing.in(Easing.cubic) })
      )
    );
    // Slide back up on dismiss
    translateY.value = withDelay(
      autoDismissMs - 300,
      withTiming(-80, {
        duration: 300,
        easing: Easing.in(Easing.cubic),
      })
    );

    // Fire onDismiss callback after animation completes
    const timer = setTimeout(() => {
      runOnJS(handleDismiss)();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [translateY, opacity, autoDismissMs, handleDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const colors = TOAST_COLORS[type];
  const icon = TOAST_ICONS[type];
  const textColor = TOAST_TEXT_COLORS[type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
        },
        animatedStyle,
      ]}
      testID="achievement-toast"
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.text, { color: textColor }]}>
        {typeof value === 'number' ? `+${value}` : value}
      </Text>
    </Animated.View>
  );
}

AchievementToast.displayName = 'AchievementToast';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    zIndex: 2000,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: {
    fontSize: 18,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
