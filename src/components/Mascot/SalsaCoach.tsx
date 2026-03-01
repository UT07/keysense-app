/**
 * SalsaCoach — Dedicated coach character component.
 *
 * Renders Salsa (the grey cat with green eyes — your coach) with:
 * - 3D rendering via Cat3DCanvas (SVG fallback if GL fails)
 * - Context-aware mood (time of day, user progress)
 * - Optional speech bubble with catchphrase (auto-spoken via TTS)
 * - Larger default size than CatAvatar (100px vs 72px)
 * - Teaching pose animation
 *
 * This is NOT a selectable player cat — Salsa is the NPC coach
 * who appears on every screen providing guidance.
 */

import { useMemo, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { SALSA_COACH } from './catCharacters';
import { Cat3DCanvas } from './3d';
import type { MascotMood } from './types';
import type { CatPose } from './animations/catAnimations';
import { COLORS, SPACING, BORDER_RADIUS } from '@/theme/tokens';
import { ttsService } from '@/services/tts/TTSService';

/** Salsa's accent color */
const SALSA_ACCENT = '#FF5252';

type SalsaSize = 'tiny' | 'small' | 'medium' | 'large';

const SIZE_MAP: Record<SalsaSize, number> = {
  tiny: 28,
  small: 48,
  medium: 72,
  large: 100,
};

/** Map mood to CatPose for 3D rendering */
const MOOD_TO_POSE: Record<MascotMood, CatPose> = {
  happy: 'idle',
  celebrating: 'celebrate',
  encouraging: 'teach',
  teaching: 'teach',
  excited: 'play',
};

interface SalsaCoachProps {
  /** Override mood. Auto-detects from time of day if not provided. */
  mood?: MascotMood;
  size?: SalsaSize;
  /** Show a random catchphrase speech bubble */
  showCatchphrase?: boolean;
  /** Override the catchphrase text */
  catchphrase?: string;
  /** Speak the catchphrase via TTS (default: true when showCatchphrase is true) */
  speakCatchphrase?: boolean;
}

/** Pick a Salsa mood based on time of day */
function getTimeMood(): MascotMood {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'teaching';
  if (hour >= 12 && hour < 17) return 'encouraging';
  if (hour >= 17 && hour < 21) return 'happy';
  return 'happy'; // night — relaxed
}

/** Pick a random catchphrase from Salsa's list */
function getRandomCatchphrase(): string {
  const phrases = SALSA_COACH.catchphrases;
  return phrases[Math.floor(Math.random() * phrases.length)];
}

export function SalsaCoach({
  mood,
  size = 'medium',
  showCatchphrase = false,
  catchphrase,
  speakCatchphrase,
}: SalsaCoachProps): ReactElement {
  const effectiveMood = mood ?? getTimeMood();
  const dimension = SIZE_MAP[size];
  const phrase = useMemo(
    () => catchphrase ?? getRandomCatchphrase(),
    [catchphrase],
  );
  const hasSpokenRef = useRef(false);

  // Speak catchphrase via TTS
  const shouldSpeak = speakCatchphrase ?? showCatchphrase;
  useEffect(() => {
    if (!shouldSpeak || !phrase || hasSpokenRef.current) return;
    hasSpokenRef.current = true;
    // Small delay so the bubble is visible first
    const timer = setTimeout(() => {
      ttsService.speak(phrase, { catId: 'salsa' });
    }, 500);
    return () => {
      clearTimeout(timer);
      ttsService.stop();
    };
  }, [shouldSpeak, phrase]);

  // Use 3D for medium+ sizes, SVG for tiny/small (performance)
  // Always use SVG — SalsaCoach is an accent component that appears alongside
  // primary Cat3DCanvas instances. Multiple GL contexts exhaust GPU resources.
  const use3D = false;
  const pose: CatPose = MOOD_TO_POSE[effectiveMood] ?? 'idle';

  return (
    <View style={styles.container} testID="salsa-coach">
      <View
        style={[
          styles.avatar,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
            borderColor: SALSA_COACH.color + '60',
            backgroundColor: SALSA_COACH.color + '18',
          },
        ]}
      >
        <Cat3DCanvas
          catId="salsa"
          size={Math.round(dimension * 0.85)}
          pose={pose}
          mood={effectiveMood}
          forceSVG={!use3D}
        />
      </View>

      {showCatchphrase && (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={styles.bubble}
        >
          <View style={styles.bubblePointer} />
          <View style={styles.bubbleContent}>
            <Text style={styles.bubbleText}>{phrase}</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bubblePointer: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderRightWidth: 7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: COLORS.cardSurface,
  },
  bubbleContent: {
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    flex: 1,
    borderWidth: 1,
    borderColor: SALSA_ACCENT + '30',
  },
  bubbleText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
