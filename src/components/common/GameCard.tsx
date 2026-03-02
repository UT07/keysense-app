/**
 * GameCard Component
 *
 * A reusable card with rarity-based border colors, background, and shadows.
 * When tappable (onPress provided), wraps content in PressableScale for
 * spring animation + sound. When static, renders as a plain View.
 */

import React from 'react';
import { View, type ViewStyle, type StyleProp } from 'react-native';
import { PressableScale } from './PressableScale';
import {
  RARITY,
  type RarityLevel,
  BORDER_RADIUS,
  SHADOWS,
  SPACING,
} from '../../theme/tokens';

export interface GameCardProps {
  rarity: RarityLevel;
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function GameCard({
  rarity,
  children,
  onPress,
  style,
  testID,
}: GameCardProps): React.JSX.Element {
  const rarityConfig = RARITY[rarity] ?? RARITY.common;

  const cardStyle: ViewStyle = {
    borderWidth: 1.5,
    borderColor: rarityConfig.borderColor,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: 'rgba(26, 22, 40, 0.85)',
    padding: SPACING.md,
    ...SHADOWS.md,
  };

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        glowOnPress
        testID={testID}
        style={[cardStyle, style]}
      >
        {children}
      </PressableScale>
    );
  }

  return (
    <View style={[cardStyle, style]} testID={testID}>
      {children}
    </View>
  );
}
