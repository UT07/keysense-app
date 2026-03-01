/**
 * Animated gradient mesh background — slow-drifting color gradients
 * unique per screen. Uses Reanimated opacity crossfade between palettes.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

export type ScreenAccent = 'home' | 'social' | 'learn' | 'songs' | 'catStudio' | 'exercise';

const ACCENT_PALETTES: Record<ScreenAccent, [string, string, string]> = {
  home: ['#2D1B4E', '#1A0A2E', '#0E0B1A'],
  social: ['#0D2B3E', '#0A1F2E', '#0E0B1A'],
  learn: ['#0D2E1A', '#0A2315', '#0E0B1A'],
  songs: ['#2E2000', '#231A00', '#0E0B1A'],
  catStudio: ['#2E0D2B', '#1F0A20', '#0E0B1A'],
  exercise: ['#1A0A2E', '#0E0B1A', '#0A0A14'],
};

interface GradientMeshBackgroundProps {
  accent?: ScreenAccent;
  /** Speed multiplier (default: 1) */
  speed?: number;
}

export function GradientMeshBackground({
  accent = 'home',
  speed = 1,
}: GradientMeshBackgroundProps) {
  const opacity1 = useSharedValue(1);
  const opacity2 = useSharedValue(0);

  const palette = ACCENT_PALETTES[accent];
  // Secondary palette: shift hues slightly for crossfade variety
  const palette2 = palette.map((c) => {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const nr = Math.min(255, r + 15);
    const nb = Math.max(0, b - 10);
    return `#${nr.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
  }) as [string, string, string];

  useEffect(() => {
    const duration = 8000 / speed;
    opacity1.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    opacity2.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [speed, opacity1, opacity2]);

  const style1 = useAnimatedStyle(() => ({ opacity: opacity1.value }));
  const style2 = useAnimatedStyle(() => ({ opacity: opacity2.value }));

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, style1]} pointerEvents="none">
        <LinearGradient colors={palette} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, style2]} pointerEvents="none">
        <LinearGradient
          colors={palette2}
          style={StyleSheet.absoluteFill}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      </Animated.View>
    </>
  );
}
