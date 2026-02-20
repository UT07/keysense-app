/**
 * Count-In Animation Component
 * Full-screen countdown animation before exercise starts
 * Shows beats with visual and haptic feedback
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';

export interface CountInAnimationProps {
  countIn: number; // Number of beats in count-in
  tempo: number; // BPM
  elapsedTime: number; // Current elapsed time in ms
  coachingTip?: string; // Brief pre-exercise coaching tip
  testID?: string;
}

/**
 * CountInAnimation - Full-screen count-in before exercise
 * Shows visual feedback with haptic cues
 */
export const CountInAnimation: React.FC<CountInAnimationProps> = ({
  countIn,
  tempo,
  elapsedTime,
  coachingTip,
  testID,
}) => {
  const [currentBeat, setCurrentBeat] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const lastBeatRef = useRef(-1);

  // Update current beat based on elapsed time
  useEffect(() => {
    const msPerBeat = (60000 / tempo);
    const beat = Math.floor(elapsedTime / msPerBeat);
    const nextBeat = Math.min(beat, countIn - 1);

    setCurrentBeat(nextBeat);

    // Trigger animation when beat changes
    if (nextBeat !== lastBeatRef.current && nextBeat < countIn) {
      lastBeatRef.current = nextBeat;

      // Visual animation
      scaleAnim.setValue(0);
      opacityAnim.setValue(1);

      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Haptic feedback on each beat
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, [elapsedTime, tempo, countIn]);

  const scaleStyle = {
    transform: [{ scale: scaleAnim }],
  };

  return (
    <View
      style={styles.overlay}
      testID={testID}
      pointerEvents="none"
    >
      {/* Animated beat circle */}
      <Animated.View
        style={[
          styles.beatCircle,
          scaleStyle,
          { opacity: opacityAnim },
        ]}
      >
        <Text style={styles.beatNumber}>
          {currentBeat + 1}
        </Text>
      </Animated.View>

      {/* Coaching tip during count-in */}
      {coachingTip && currentBeat < countIn - 1 && (
        <Text style={styles.coachingTip}>{coachingTip}</Text>
      )}

      {/* "Ready" text when count-in complete */}
      {currentBeat === countIn - 1 && (
        <Text style={styles.readyText}>Ready...</Text>
      )}
    </View>
  );
};

CountInAnimation.displayName = 'CountInAnimation';

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 100,
    pointerEvents: 'none',
  },
  beatCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#DC143C',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  beatNumber: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  coachingTip: {
    position: 'absolute',
    bottom: 140,
    fontSize: 15,
    fontWeight: '500',
    color: '#CCCCCC',
    textAlign: 'center',
    paddingHorizontal: 32,
    maxWidth: 320,
  },
  readyText: {
    position: 'absolute',
    bottom: 100,
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CountInAnimation;
