/**
 * CatAvatar - Animated cat character avatar component
 * Renders the cat SVG with per-cat colors, floating idle animation,
 * pulsing glow aura, and bounce entry animation.
 */

import { useEffect, useState, useCallback } from 'react';
import type { ReactElement } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
} from 'react-native-reanimated';

import { getCatById, getDefaultCat } from './catCharacters';
import type { CatCharacter } from './catCharacters';
import { KeysieSvg } from './KeysieSvg';

export type CatAvatarSize = 'small' | 'medium' | 'large';

const SIZE_MAP: Record<CatAvatarSize, number> = {
  small: 48,
  medium: 72,
  large: 120,
};

interface CatAvatarProps {
  catId: string;
  size?: CatAvatarSize;
  showTooltipOnTap?: boolean;
  onPress?: () => void;
  /** Skip entry animation (e.g. in lists) */
  skipEntryAnimation?: boolean;
  /** Show the pulsing glow aura */
  showGlow?: boolean;
}

/** Floating idle: gentle up-down bob + slight scale pulse */
function useFloatingIdle() {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // Infinite loop
      false,
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // Infinite loop
      false,
    );
  }, [translateY, scale]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));
}

/** Bounce entry: springs in from below with overshoot */
function useBounceEntry(skip: boolean) {
  const translateY = useSharedValue(skip ? 0 : 30);
  const scale = useSharedValue(skip ? 1 : 0.5);

  useEffect(() => {
    if (skip) return;
    translateY.value = withSpring(0, { damping: 10, stiffness: 120 });
    scale.value = withSpring(1, { damping: 8, stiffness: 150 });
  }, [translateY, scale, skip]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));
}

/** Pulsing glow aura around the avatar */
function useGlowPulse() {
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.4);

  useEffect(() => {
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // Infinite loop
      false,
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.25, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, // Infinite loop
      false,
    );
  }, [glowScale, glowOpacity]);

  return useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));
}

export function CatAvatar({
  catId,
  size = 'medium',
  showTooltipOnTap = true,
  onPress,
  skipEntryAnimation = false,
  showGlow = false,
}: CatAvatarProps): ReactElement {
  const cat: CatCharacter = getCatById(catId) ?? getDefaultCat();
  const [showTooltip, setShowTooltip] = useState(false);
  const floatingStyle = useFloatingIdle();
  const entryStyle = useBounceEntry(skipEntryAnimation);
  const glowStyle = useGlowPulse();

  const dimension = SIZE_MAP[size];
  const glowSize = dimension + 16;

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    if (showTooltipOnTap) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 2500);
    }
  }, [onPress, showTooltipOnTap]);

  return (
    <View style={styles.wrapper}>
      <Pressable onPress={handlePress}>
        {/* Glow aura behind the avatar */}
        {showGlow && (
          <Animated.View
            style={[
              styles.glow,
              {
                width: glowSize,
                height: glowSize,
                borderRadius: glowSize / 2,
                backgroundColor: cat.color + '40',
                left: -8,
                top: -8,
              },
              glowStyle,
            ]}
          />
        )}

        <Animated.View
          style={[
            styles.circle,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
              backgroundColor: cat.color + '18',
              borderColor: cat.color + '60',
            },
            entryStyle,
          ]}
          testID="cat-avatar"
        >
          <Animated.View style={floatingStyle}>
            <KeysieSvg
              mood="encouraging"
              size="medium"
              accentColor={cat.color}
              pixelSize={Math.round(dimension * 0.75)}
              visuals={cat.visuals}
            />
          </Animated.View>
        </Animated.View>
      </Pressable>

      {showTooltip && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.tooltip, { backgroundColor: cat.color + 'DD' }]}
        >
          <Text style={styles.tooltipName}>{cat.name}</Text>
          <Text style={styles.tooltipSkill}>{cat.musicSkill}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    position: 'relative',
  },
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    zIndex: -1,
  },
  tooltip: {
    position: 'absolute',
    bottom: -44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    zIndex: 10,
  },
  tooltipName: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  tooltipSkill: {
    color: '#FFFFFFCC',
    fontSize: 11,
    marginTop: 1,
  },
});
