import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { getComboTier } from '../../theme/tokens';
import { soundManager } from '../../audio/SoundManager';
import type { SoundName } from '../../audio/SoundManager';

export interface ComboMeterProps {
  combo: number;
}

const COMBO_SOUNDS: Record<string, SoundName> = {
  GOOD: 'combo_5',
  FIRE: 'combo_10',
  SUPER: 'combo_10',
  LEGENDARY: 'combo_20',
};

const TIER_ICONS: Record<string, string> = {
  NORMAL: '',
  GOOD: '\uD83D\uDD25',
  FIRE: '\uD83D\uDC80',
  SUPER: '\uD83D\uDC51',
  LEGENDARY: '\uD83C\uDF08',
};

export function ComboMeter({ combo }: ComboMeterProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const prevTierRef = useRef('NORMAL');
  const tier = getComboTier(combo);
  const icon = TIER_ICONS[tier.name] || '';

  // Animate + play sound on tier change
  useEffect(() => {
    if (tier.name !== prevTierRef.current && tier.name !== 'NORMAL') {
      const sound = COMBO_SOUNDS[tier.name];
      if (sound) soundManager.play(sound);

      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.4,
          useNativeDriver: true,
          speed: 20,
          bounciness: 15,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 12,
          bounciness: 8,
        }),
      ]).start();
    }
    prevTierRef.current = tier.name;
  }, [tier.name, scale]);

  // Small pulse on every combo increment
  useEffect(() => {
    if (combo >= 3) {
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.12,
          useNativeDriver: true,
          speed: 20,
          bounciness: 10,
        }),
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 15,
          bounciness: 8,
        }),
      ]).start();
    }
  }, [combo, scale]);

  if (combo < 3) return null;

  return (
    <View testID="combo-meter" style={styles.container}>
      <Animated.View
        style={[
          styles.badge,
          {
            backgroundColor: tier.color,
            transform: [{ scale }],
            ...Platform.select({
              ios: {
                shadowColor: tier.glowColor !== 'transparent' ? tier.borderColor : 'transparent',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 8,
              },
              android: { elevation: tier.name !== 'NORMAL' ? 6 : 2 },
              default: {},
            }),
          },
        ]}
      >
        <View style={styles.badgeRow}>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={styles.count}>{combo}x</Text>
        </View>
      </Animated.View>
      {tier.label ? (
        <Text style={[styles.label, { color: tier.color }]}>{tier.label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 10,
  },
  badge: {
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 56,
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 16,
  },
  count: {
    color: '#000',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 3,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
});
