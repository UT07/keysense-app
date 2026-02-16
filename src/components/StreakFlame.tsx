/**
 * StreakFlame - Animated flame icon that scales with streak length
 * Small (<7 days), Medium (7-30 days), Large (30+ days)
 * Flickers continuously using reanimated shared values
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface StreakFlameProps {
  streak: number;
  showCount?: boolean;
  size?: 'small' | 'medium' | 'large';
}

function getFlameConfig(streak: number, sizeOverride?: 'small' | 'medium' | 'large') {
  if (sizeOverride) {
    const sizes = { small: 24, medium: 36, large: 48 };
    return {
      iconSize: sizes[sizeOverride],
      color: streak >= 30 ? '#FF4500' : streak >= 7 ? '#FF6B00' : '#FF9800',
      glowColor: streak >= 30 ? 'rgba(255, 69, 0, 0.4)' : streak >= 7 ? 'rgba(255, 107, 0, 0.3)' : 'rgba(255, 152, 0, 0.2)',
      intensity: streak >= 30 ? 1.15 : streak >= 7 ? 1.1 : 1.05,
    };
  }
  if (streak >= 30) {
    return { iconSize: 48, color: '#FF4500', glowColor: 'rgba(255, 69, 0, 0.4)', intensity: 1.15 };
  }
  if (streak >= 7) {
    return { iconSize: 36, color: '#FF6B00', glowColor: 'rgba(255, 107, 0, 0.3)', intensity: 1.1 };
  }
  return { iconSize: 24, color: '#FF9800', glowColor: 'rgba(255, 152, 0, 0.2)', intensity: 1.05 };
}

export function StreakFlame({ streak, showCount = true, size }: StreakFlameProps): React.ReactElement | null {
  if (streak <= 0) return null;

  const config = getFlameConfig(streak, size);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.8);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(config.intensity, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.7, { duration: 300, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [scale, opacity, config.intensity]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.flameWrap, flameStyle]}>
        <View style={[styles.glow, { backgroundColor: config.glowColor, width: config.iconSize + 16, height: config.iconSize + 16, borderRadius: (config.iconSize + 16) / 2 }]} />
        <MaterialCommunityIcons name="fire" size={config.iconSize} color={config.color} />
      </Animated.View>
      {showCount && (
        <Text style={[styles.count, { color: config.color }]}>{streak}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  count: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
});
