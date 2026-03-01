/**
 * Glassmorphism card — semi-transparent background with frosted appearance.
 * Uses subtle border and tinted background for the glass effect.
 */
import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

interface GlassmorphismCardProps {
  children: React.ReactNode;
  /** Background tint color (default: rgba(255,255,255,0.08)) */
  tint?: string;
  /** Border color (default: rgba(255,255,255,0.12)) */
  borderColor?: string;
  /** Border radius (default: 16) */
  borderRadius?: number;
  style?: ViewStyle;
}

export function GlassmorphismCard({
  children,
  tint = 'rgba(255,255,255,0.08)',
  borderColor = 'rgba(255,255,255,0.12)',
  borderRadius = 16,
  style,
}: GlassmorphismCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tint,
          borderColor,
          borderRadius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
  },
});
