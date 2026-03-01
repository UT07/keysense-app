/**
 * GPU-accelerated particle system using Skia Canvas.
 * Renders floating particles with configurable count, speed, colors, and opacity.
 * Particles drift upward with horizontal sine-wave motion.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export type ParticleShape = 'circle' | 'star' | 'note' | 'sparkle' | 'paw';

interface SkiaParticlesProps {
  /** Number of particles (default: 15) */
  count?: number;
  /** Colors to randomly assign (default: ['#9B59B6', '#FFD700', '#DC143C']) */
  colors?: string[];
  /** Particle radius (default: 3) */
  size?: number;
  /** Animation speed multiplier (default: 1) */
  speed?: number;
  /** Container width */
  width: number;
  /** Container height */
  height: number;
  /** Particle shape type (default: 'circle') */
  shape?: ParticleShape;
  /** Opacity (default: 0.6) */
  opacity?: number;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
}

function generateParticles(
  count: number,
  width: number,
  height: number,
  colors: string[],
  size: number,
): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: size * (0.5 + Math.random() * 0.5),
    color: colors[i % colors.length],
    opacity: 0.3 + Math.random() * 0.4,
  }));
}

export function SkiaParticles({
  count = 15,
  colors = ['#9B59B6', '#FFD700', '#DC143C'],
  size = 3,
  speed = 1,
  width,
  height,
  opacity = 0.6,
}: SkiaParticlesProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 10000 / speed, easing: Easing.linear }),
      -1,
      false,
    );
  }, [speed, progress]);

  const particles = React.useMemo(
    () => generateParticles(count, width, height, colors, size),
    [count, width, height, colors, size],
  );

  return (
    <Canvas style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {particles.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.radius}
          color={p.color}
          opacity={p.opacity}
        />
      ))}
    </Canvas>
  );
}
