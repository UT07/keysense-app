/**
 * Screen shake effect — wraps children and shakes when triggered.
 * Uses Reanimated translateX/Y for performant native-driven shake.
 */
import React, { useImperativeHandle, forwardRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export interface ScreenShakeRef {
  shake: (intensity?: 'light' | 'medium' | 'heavy') => void;
}

interface ScreenShakeProps {
  children: React.ReactNode;
}

const INTENSITIES = {
  light: { amount: 2, duration: 50, count: 3 },
  medium: { amount: 4, duration: 40, count: 5 },
  heavy: { amount: 8, duration: 30, count: 7 },
};

export const ScreenShake = forwardRef<ScreenShakeRef, ScreenShakeProps>(
  ({ children }, ref) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    useImperativeHandle(ref, () => ({
      shake: (intensity = 'medium') => {
        const { amount, duration, count } = INTENSITIES[intensity];
        const sequence: number[] = [];
        for (let i = 0; i < count; i++) {
          const sign = i % 2 === 0 ? 1 : -1;
          const decay = 1 - i / count;
          sequence.push(sign * amount * decay);
        }
        sequence.push(0);

        translateX.value = withSequence(
          ...sequence.map((v) => withTiming(v, { duration })),
        );
        translateY.value = withSequence(
          ...sequence.map((v) => withTiming(v * 0.5, { duration })),
        );

        Haptics.impactAsync(
          intensity === 'heavy'
            ? Haptics.ImpactFeedbackStyle.Heavy
            : intensity === 'medium'
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light,
        );
      },
    }));

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    }));

    return <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>;
  },
);
