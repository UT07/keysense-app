/**
 * EvolutionReveal — Full-screen Pokemon-style evolution animation
 *
 * Sequence:
 * 1. Screen dims, current form centers
 * 2. Cat glows (accent color aura intensifies)
 * 3. Flash of light (full-screen white → fade)
 * 4. New form revealed with particle burst
 * 5. New ability card slides in
 * 6. "Continue" button to dismiss
 * 7. Haptic feedback at key moments
 */

import { useEffect, useState, useCallback } from 'react';
import type { ReactElement } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  runOnJS,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Cat3DCanvas } from '../Mascot/3d';
import { getCatById } from '../Mascot/catCharacters';
import type { EvolutionStage, CatAbility } from '../../stores/types';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme/tokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STAGE_LABELS: Record<EvolutionStage, string> = {
  baby: 'Baby',
  teen: 'Teen',
  adult: 'Adult',
  master: 'Master',
};

interface EvolutionRevealProps {
  catId: string;
  newStage: EvolutionStage;
  newAbility?: CatAbility;
  onDismiss: () => void;
}

export function EvolutionReveal({
  catId,
  newStage,
  newAbility,
  onDismiss,
}: EvolutionRevealProps): ReactElement {
  const cat = getCatById(catId);
  const accentColor = cat?.color ?? COLORS.primary;

  const [phase, setPhase] = useState<'glow' | 'flash' | 'reveal' | 'ability'>('glow');

  // Animation values
  const dimOverlay = useSharedValue(0);
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const catScale = useSharedValue(1);
  const catOpacity = useSharedValue(1);
  const particleBurst = useSharedValue(0);

  const triggerFlash = useCallback(() => setPhase('flash'), []);
  const triggerReveal = useCallback(() => setPhase('reveal'), []);
  const triggerAbility = useCallback(() => setPhase('ability'), []);

  useEffect(() => {
    // Phase 1: Dim background + glow pulse
    dimOverlay.value = withTiming(0.85, { duration: 600 });
    glowOpacity.value = withTiming(0.8, { duration: 800 });
    glowScale.value = withSequence(
      withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      withTiming(1.5, { duration: 400, easing: Easing.inOut(Easing.ease) }),
    );

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Phase 2: Flash after 1.2s
    const flashTimer = setTimeout(() => {
      runOnJS(triggerFlash)();
      flashOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0, { duration: 400 }),
      );
      catScale.value = withSequence(
        withTiming(0.8, { duration: 100 }),
        withSpring(1.1, { damping: 8, stiffness: 150 }),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, 1200);

    // Phase 3: Reveal after 1.8s
    const revealTimer = setTimeout(() => {
      runOnJS(triggerReveal)();
      glowOpacity.value = withTiming(0.3, { duration: 500 });
      particleBurst.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
      catScale.value = withSpring(1, { damping: 12, stiffness: 120 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1800);

    // Phase 4: Show ability after 2.5s
    const abilityTimer = setTimeout(() => {
      runOnJS(triggerAbility)();
    }, 2500);

    return () => {
      clearTimeout(flashTimer);
      clearTimeout(revealTimer);
      clearTimeout(abilityTimer);
    };
  }, [dimOverlay, glowOpacity, glowScale, flashOpacity, catScale, particleBurst, triggerFlash, triggerReveal, triggerAbility]);

  const dimStyle = useAnimatedStyle(() => ({
    opacity: dimOverlay.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const catStyle = useAnimatedStyle(() => ({
    transform: [{ scale: catScale.value }],
    opacity: catOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Dim overlay */}
      <Animated.View style={[styles.dimOverlay, dimStyle]} />

      {/* Glow aura */}
      <Animated.View style={[styles.glowCircle, { backgroundColor: accentColor }, glowStyle]} />

      {/* Cat avatar */}
      <Animated.View style={[styles.catContainer, catStyle]}>
        <Cat3DCanvas
          catId={catId}
          size={120}
          pose={phase === 'reveal' || phase === 'ability' ? 'celebrate' : 'idle'}
          forceSVG
        />
      </Animated.View>

      {/* Flash overlay */}
      <Animated.View style={[styles.flashOverlay, flashStyle]} />

      {/* Stage label */}
      {(phase === 'reveal' || phase === 'ability') && (
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.stageBadge}>
          <Text style={[styles.stageLabel, { color: accentColor }]}>
            {STAGE_LABELS[newStage]}
          </Text>
          <Text style={styles.evolvedText}>Evolved!</Text>
        </Animated.View>
      )}

      {/* New ability card */}
      {phase === 'ability' && newAbility && (
        <Animated.View
          entering={FadeInDown.delay(100).springify().damping(12)}
          style={[styles.abilityCard, { borderColor: accentColor + '60' }]}
        >
          <View style={[styles.abilityIconCircle, { backgroundColor: accentColor + '25' }]}>
            <MaterialCommunityIcons
              name={newAbility.icon as any}
              size={24}
              color={accentColor}
            />
          </View>
          <Text style={styles.abilityLearnedLabel}>New Ability!</Text>
          <Text style={styles.abilityName}>{newAbility.name}</Text>
          <Text style={styles.abilityDescription}>{newAbility.description}</Text>
        </Animated.View>
      )}

      {/* Continue button */}
      {phase === 'ability' && (
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.continueContainer}>
          <Pressable
            style={[styles.continueButton, { backgroundColor: accentColor }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onDismiss();
            }}
          >
            <Text style={styles.continueText}>Continue</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Particle burst */}
      {(phase === 'reveal' || phase === 'ability') && (
        <ParticleBurst color={accentColor} progress={particleBurst} />
      )}
    </View>
  );
}

function ParticleBurst({
  color,
  progress,
}: {
  color: string;
  progress: Animated.SharedValue<number>;
}): ReactElement {
  const particles = Array.from({ length: 16 }, (_, i) => ({
    angle: (i * 22.5) * (Math.PI / 180),
    speed: 60 + (i % 3) * 30,
    size: 4 + (i % 4) * 2,
  }));

  return (
    <View style={styles.particleContainer} pointerEvents="none">
      {particles.map((p, i) => (
        <Particle key={i} angle={p.angle} speed={p.speed} size={p.size} color={color} progress={progress} />
      ))}
    </View>
  );
}

function Particle({
  angle,
  speed,
  size,
  color,
  progress,
}: {
  angle: number;
  speed: number;
  size: number;
  color: string;
  progress: Animated.SharedValue<number>;
}): ReactElement {
  const style = useAnimatedStyle(() => {
    const dist = progress.value * speed;
    const opacity = 1 - progress.value;
    return {
      opacity,
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
        { scale: 1 - progress.value * 0.5 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  glowCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  catContainer: {
    zIndex: 10,
  },
  stageBadge: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.2,
    alignItems: 'center',
  },
  stageLabel: {
    fontSize: 32,
    fontWeight: '900',
  },
  evolvedText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  abilityCard: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.22,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    width: SCREEN_WIDTH * 0.75,
  },
  abilityIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  abilityLearnedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  abilityName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  abilityDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  continueContainer: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.08,
  },
  continueButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: BORDER_RADIUS.md,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
  },
});
