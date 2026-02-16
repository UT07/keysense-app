/**
 * XpPopup - Floating "+X XP" animation that rises and fades out
 * Triggered on exercise completion or achievement unlock
 */

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface XpPopupProps {
  amount: number;
  onComplete?: () => void;
  color?: string;
  startY?: number;
}

export function XpPopup({
  amount,
  onComplete,
  color = '#FFD700',
  startY = 0,
}: XpPopupProps): React.ReactElement {
  const translateY = useSharedValue(startY);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    // Pop in
    scale.value = withTiming(1.2, { duration: 200, easing: Easing.out(Easing.back(2)) });

    // Float up
    translateY.value = withTiming(startY - 80, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });

    // Settle scale
    scale.value = withDelay(
      200,
      withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) }),
    );

    // Fade out after delay
    opacity.value = withDelay(
      700,
      withTiming(0, { duration: 500, easing: Easing.in(Easing.cubic) }, () => {
        if (onComplete) {
          runOnJS(onComplete)();
        }
      }),
    );
  }, [translateY, opacity, scale, startY, onComplete]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.text, { color }, animatedStyle]}>
      +{amount} XP
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    position: 'absolute',
    fontSize: 20,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    zIndex: 9999,
  },
});
