/**
 * PressableScale Component
 * A drop-in replacement for TouchableOpacity that scales down on press
 * with spring animation. Supports optional haptic feedback and glow effect.
 */

import React, { useCallback } from 'react';
import { Pressable, ViewStyle, StyleProp, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { COLORS } from '../../theme/tokens';
import { soundManager } from '../../audio/SoundManager';

let Haptics: typeof import('expo-haptics') | null = null;
try {
   
  Haptics = require('expo-haptics');
} catch {
  Haptics = null;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  scaleDown?: number;
  /** Trigger a light haptic impact on press (default: false) */
  haptic?: boolean;
  /** Show a subtle crimson glow when pressed (default: false) */
  glowOnPress?: boolean;
  /** Play button_press sound + haptic on press via SoundManager (default: true) */
  soundOnPress?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
}

export function PressableScale({
  children,
  scaleDown = 0.97,
  style,
  onPress,
  onLongPress,
  disabled,
  haptic = false,
  glowOnPress = false,
  soundOnPress = true,
  testID,
}: PressableScaleProps): React.JSX.Element {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handlePressIn = useCallback(() => {
    // Snap in fast: high stiffness + damping for immediate response
    scale.value = withSpring(scaleDown, { damping: 20, stiffness: 350, mass: 0.8 });
    if (glowOnPress) {
      glowOpacity.value = withSpring(1, { damping: 20, stiffness: 300 });
    }
    if (soundOnPress) {
      // SoundManager handles both sound + haptic — skip manual Haptics
      soundManager.play('button_press');
    } else if (haptic && Haptics) {
      // Fallback: manual haptic only when soundOnPress is off
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, [scale, scaleDown, glowOnPress, glowOpacity, soundOnPress, haptic]);

  const handlePressOut = useCallback(() => {
    // Bounce back: lower damping for satisfying overshoot on release
    scale.value = withSpring(1, { damping: 10, stiffness: 250, mass: 0.8 });
    if (glowOnPress) {
      glowOpacity.value = withSpring(0, { damping: 15, stiffness: 200 });
    }
  }, [scale, glowOnPress, glowOpacity]);

  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      testID={testID}
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {glowOnPress && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -2,
              left: -2,
              right: -2,
              bottom: -2,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: COLORS.primary,
              ...Platform.select({
                ios: {
                  shadowColor: COLORS.primary,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 8,
                },
                android: {},
                default: {},
              }),
            },
            glowAnimatedStyle,
          ]}
        />
      )}
      {children}
    </AnimatedPressable>
  );
}
