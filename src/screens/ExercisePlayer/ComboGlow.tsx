import React, { useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { getComboTier } from '../../theme/tokens';

interface ComboGlowProps {
  combo: number;
}

export function ComboGlow({ combo }: ComboGlowProps): React.ReactElement | null {
  const tier = getComboTier(combo);
  const opacity = useSharedValue(0);

  const shouldShow = tier.name !== 'NORMAL' && combo >= 5;

  // Faster pulse at higher tiers
  const pulseDuration = tier.name === 'LEGENDARY' ? 500 : tier.name === 'SUPER' ? 600 : 800;

  useEffect(() => {
    if (shouldShow) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.85, { duration: pulseDuration }),
          withTiming(0.25, { duration: pulseDuration }),
        ),
        -1,
        true,
      );
    } else {
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [shouldShow, opacity, pulseDuration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    borderColor: tier.borderColor,
  }));

  if (!shouldShow) return null;

  return (
    <Animated.View
      testID="combo-glow"
      pointerEvents="none"
      style={[
        styles.glow,
        animatedStyle,
        Platform.OS === 'ios' && {
          shadowColor: tier.borderColor,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 20,
          shadowOpacity: 0.5,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderRadius: 0,
    zIndex: 5,
  },
});
