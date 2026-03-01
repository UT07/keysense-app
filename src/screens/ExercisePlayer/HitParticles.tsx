/**
 * HitParticles — brief particle burst on note hit.
 * Renders N particles that expand outward and fade over 400ms.
 * Uses RN Animated for native-driver performance.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export interface HitParticlesProps {
  /** Screen X position of the burst center */
  x: number;
  /** Screen Y position of the burst center */
  y: number;
  /** Particle color (matches feedback type) */
  color: string;
  /** Change this value to spawn a new burst */
  trigger: number;
}

const PARTICLE_COUNT = 8;
const DURATION = 400;

export function HitParticles({ x, y, color, trigger }: HitParticlesProps) {
  const anims = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      progress: new Animated.Value(0),
      angle: Math.random() * Math.PI * 2,
      distance: 20 + Math.random() * 30,
    })),
  ).current;

  useEffect(() => {
    if (trigger === 0) return;
    anims.forEach((a) => {
      a.progress.setValue(0);
      a.angle = Math.random() * Math.PI * 2;
      a.distance = 20 + Math.random() * 30;
      Animated.timing(a.progress, {
        toValue: 1,
        duration: DURATION,
        useNativeDriver: true,
      }).start();
    });
  }, [trigger, anims]);

  if (trigger === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="hit-particles">
      {anims.map((a, i) => {
        const translateX = a.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(a.angle) * a.distance],
        });
        const translateY = a.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(a.angle) * a.distance],
        });
        const opacity = a.progress.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 0.5, 0],
        });
        const scale = a.progress.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0.5, 1.2, 0.3],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: x - 4,
              top: y - 4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: color,
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}
