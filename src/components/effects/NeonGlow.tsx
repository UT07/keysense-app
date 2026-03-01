/**
 * Animated neon glow border using Reanimated opacity pulsing.
 * Wraps children with a glowing border that pulses in intensity.
 */
import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface NeonGlowProps {
  children: React.ReactNode;
  /** Glow color (default: crimson) */
  color?: string;
  /** Border radius (default: 16) */
  borderRadius?: number;
  /** Pulse speed in ms (default: 2000) */
  pulseSpeed?: number;
  /** Whether glow is active (default: true) */
  active?: boolean;
  style?: ViewStyle;
}

export function NeonGlow({
  children,
  color = '#DC143C',
  borderRadius = 16,
  pulseSpeed = 2000,
  active = true,
  style,
}: NeonGlowProps) {
  const glowOpacity = useSharedValue(active ? 0.6 : 0);

  useEffect(() => {
    if (active) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: pulseSpeed / 2 }),
          withTiming(0.4, { duration: pulseSpeed / 2 }),
        ),
        -1,
        true,
      );
    } else {
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [active, pulseSpeed, glowOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          borderRadius,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 12,
          elevation: 8,
        },
        animatedStyle,
        style,
      ]}
    >
      <View style={{ borderRadius, overflow: 'hidden' }}>{children}</View>
    </Animated.View>
  );
}
