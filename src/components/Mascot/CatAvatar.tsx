/**
 * CatAvatar - Animated cat character avatar component
 * Renders the cat as a themed SVG (Salsa variant) with idle pulse animation
 * Each cat character gets the SVG mascot tinted in their unique color
 * Tapping shows the cat's name and music skill in a tooltip
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
  Easing,
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
}

function useIdlePulse(): Animated.AnimateStyle<{ transform: { scale: number }[] }> {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [scale]);

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
}

export function CatAvatar({
  catId,
  size = 'medium',
  showTooltipOnTap = true,
  onPress,
}: CatAvatarProps): ReactElement {
  const cat: CatCharacter = getCatById(catId) ?? getDefaultCat();
  const [showTooltip, setShowTooltip] = useState(false);
  const pulseStyle = useIdlePulse();

  const dimension = SIZE_MAP[size];

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
        <Animated.View
          style={[
            styles.circle,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
              backgroundColor: cat.color + '15',
              borderColor: cat.color + '55',
            },
            pulseStyle,
          ]}
          testID="cat-avatar"
        >
          <KeysieSvg
            mood="encouraging"
            size="medium"
            accentColor={cat.color}
            pixelSize={Math.round(dimension * 0.75)}
          />
        </Animated.View>
      </Pressable>

      {showTooltip && (
        <View style={[styles.tooltip, { backgroundColor: cat.color + 'DD' }]}>
          <Text style={styles.tooltipName}>{cat.name}</Text>
          <Text style={styles.tooltipSkill}>{cat.musicSkill}</Text>
        </View>
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
