/**
 * ExerciseLoadingScreen
 *
 * Full-screen loading interstitial shown while exercises load (especially
 * AI-generated ones). Features Salsa the coach cat with a practice tip or
 * fun fact, plus a subtle pulsing dot animation at the bottom.
 *
 * Enforces a minimum 2-second display to prevent jarring flash-of-content,
 * then calls onReady once both the timer has elapsed AND the exercise is loaded.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { SalsaCoach } from '../../components/Mascot/SalsaCoach';
import { FunFactCard } from '../../components/FunFact/FunFactCard';
import { getRandomFact } from '../../content/funFactSelector';
import { getRandomLoadingTip } from '../../content/loadingTips';
import { ttsService } from '../../services/tts/TTSService';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../theme/tokens';

const MIN_DISPLAY_MS = 1000;

export interface ExerciseLoadingScreenProps {
  /** Controls visibility — returns null when false */
  visible: boolean;
  /** Whether the real exercise has finished loading */
  exerciseReady: boolean;
  /** Called when both minimum timer AND exercise ready */
  onReady: () => void;
}

export function ExerciseLoadingScreen({
  visible,
  exerciseReady,
  onReady,
}: ExerciseLoadingScreenProps): React.ReactElement | null {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Decide once on mount whether to show a fun fact or a loading tip (50/50)
  const showFunFact = useMemo(() => Math.random() < 0.5, []);
  const funFact = useMemo(() => (showFunFact ? getRandomFact() : null), [showFunFact]);
  const loadingTip = useMemo(() => (showFunFact ? '' : getRandomLoadingTip()), [showFunFact]);

  // Speak the displayed tip/fact via TTS (delay to let animation settle)
  const hasSpokenRef = useRef(false);
  const spokenText = showFunFact ? funFact?.text : loadingTip;
  useEffect(() => {
    if (!spokenText || hasSpokenRef.current) return;
    hasSpokenRef.current = true;
    const timer = setTimeout(() => {
      ttsService.speak(spokenText, { catId: 'salsa' });
    }, 600);
    return () => {
      clearTimeout(timer);
      // Stop TTS when screen is dismissed to prevent audio overlap with gameplay
      ttsService.stop();
    };
  }, [spokenText]);

  // Minimum display timer
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // Dismiss once both conditions are met
  useEffect(() => {
    if (minTimeElapsed && exerciseReady) {
      onReady();
    }
  }, [minTimeElapsed, exerciseReady, onReady]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.overlay}
      testID="exercise-loading-screen"
    >
      <View style={styles.content}>
        {/* Salsa the coach */}
        <SalsaCoach size="large" mood="teaching" showCatchphrase speakCatchphrase={false} />

        {/* Fun fact card OR loading tip */}
        <View style={styles.tipContainer}>
          {showFunFact && funFact ? (
            <FunFactCard fact={funFact} animationDelay={400} compact />
          ) : (
            <View style={styles.tipCard} testID="loading-tip">
              <Text style={styles.tipLabel}>Salsa's Tip</Text>
              <Text style={styles.tipText}>{loadingTip}</Text>
            </View>
          )}
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>Preparing your exercise...</Text>

        {/* Pulsing dots */}
        <View style={styles.dotsRow}>
          <PulsingDot delay={0} />
          <PulsingDot delay={200} />
          <PulsingDot delay={400} />
        </View>
      </View>
    </Animated.View>
  );
}

/** A single pulsing dot with a staggered animation delay */
function PulsingDot({ delay }: { delay: number }): React.ReactElement {
  const [opacity, setOpacity] = useState(0.3);

  useEffect(() => {
    let mounted = true;
    const interval = setInterval(() => {
      if (mounted) setOpacity((prev) => (prev === 0.3 ? 1 : 0.3));
    }, 600);
    const timeout = setTimeout(() => {
      // Kick off the first toggle after the delay
      if (mounted) setOpacity(1);
    }, delay);
    return () => {
      mounted = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [delay]);

  return (
    <View style={[styles.dot, { opacity }]} />
  );
}

ExerciseLoadingScreen.displayName = 'ExerciseLoadingScreen';

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.lg,
    maxWidth: 360,
    width: '100%',
  },
  tipContainer: {
    width: '100%',
  },
  tipCard: {
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: SPACING.xs,
  },
  tipLabel: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tipText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textPrimary,
    fontStyle: 'italic',
  },
  subtitle: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textSecondary,
  },
});
