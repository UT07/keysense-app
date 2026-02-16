/**
 * PianoKey Component
 * Renders a single piano key as a purely visual element.
 * Touch handling is managed by the parent Keyboard's multi-touch responder.
 * Performance: Optimized for <16ms visual feedback via isPressed prop
 */

import React, { useMemo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';

export interface PianoKeyProps {
  midiNote: number;
  isBlackKey: boolean;
  label?: string;
  isHighlighted?: boolean;
  isExpected?: boolean;
  isPressed?: boolean;
  showLabels?: boolean;
}

/**
 * Map MIDI note to visual position
 * Middle C = 60, displayed at visual position based on octave
 */
function getNoteLabel(midiNote: number, showLabels: boolean): string {
  if (!showLabels) return '';
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const noteName = noteNames[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 1;
  return `${noteName}${octave}`;
}

function isBlackKeyNote(midiNote: number): boolean {
  const noteInOctave = midiNote % 12;
  return [1, 3, 6, 8, 10].includes(noteInOctave);
}

/**
 * PianoKey - A single piano key component (visual only)
 * Touch input is handled at the Keyboard container level for multi-touch support.
 */
export const PianoKey = React.memo(
  ({
    midiNote,
    isBlackKey: isBlackKeyProp,
    isHighlighted = false,
    isExpected = false,
    isPressed = false,
    showLabels = false,
  }: PianoKeyProps) => {
    const isBlackKey = useMemo(
      () => isBlackKeyProp || isBlackKeyNote(midiNote),
      [isBlackKeyProp, midiNote]
    );

    // Shared values for key press animation
    const scale = useSharedValue(1);
    const yOffset = useSharedValue(0);

    // Drive animation from isPressed prop
    useEffect(() => {
      if (isPressed) {
        scale.value = withSpring(0.95, { damping: 8, mass: 1, overshootClamping: false });
        yOffset.value = withSpring(isBlackKey ? -2 : -3, { damping: 8, mass: 1 });
      } else {
        scale.value = withSpring(1, { damping: 8, mass: 1 });
        yOffset.value = withSpring(0, { damping: 8, mass: 1 });
      }
    }, [isPressed, isBlackKey, scale, yOffset]);

    // Animated style for key depression
    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: scale.value },
        { translateY: yOffset.value },
      ],
    }));

    const noteLabel = getNoteLabel(midiNote, showLabels);

    if (isBlackKey) {
      return (
        <Animated.View
          style={[
            styles.blackKeyContainer,
            animatedStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.blackKey,
              isExpected && styles.expectedBlackKey,
              isHighlighted && styles.highlightedBlackKey,
              isPressed && styles.pressedBlackKey,
            ]}
          >
            {showLabels && (
              <Animated.Text style={styles.blackKeyLabel}>
                {noteLabel}
              </Animated.Text>
            )}
          </Animated.View>
        </Animated.View>
      );
    }

    return (
      <Animated.View
        style={[
          styles.whiteKeyContainer,
          animatedStyle,
        ]}
      >
        <Animated.View
          style={[
            styles.whiteKey,
            isExpected && styles.expectedWhiteKey,
            isHighlighted && styles.highlightedWhiteKey,
            isPressed && styles.pressedWhiteKey,
          ]}
        >
          {showLabels && (
            <Animated.Text style={styles.whiteKeyLabel}>
              {noteLabel}
            </Animated.Text>
          )}
        </Animated.View>
      </Animated.View>
    );
  }
);

PianoKey.displayName = 'PianoKey';

const styles = StyleSheet.create({
  whiteKeyContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },
  whiteKey: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 4,
  },
  whiteKeyLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  highlightedWhiteKey: {
    backgroundColor: '#FFE6CC',
    borderColor: '#FF9800',
  },
  expectedWhiteKey: {
    backgroundColor: '#C8E6C9',
    borderColor: '#2E7D32',
    borderWidth: 2,
  },
  pressedWhiteKey: {
    backgroundColor: '#E0E0E0',
    borderColor: '#999999',
  },
  blackKeyContainer: {
    position: 'absolute',
    zIndex: 10,
    width: '60%',
    height: '65%',
    right: '-30%',
    justifyContent: 'flex-end',
  },
  blackKey: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 3,
  },
  blackKeyLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  highlightedBlackKey: {
    backgroundColor: '#B8860B',
    borderColor: '#DAA520',
  },
  expectedBlackKey: {
    backgroundColor: '#2E7D32',
    borderColor: '#1B5E20',
  },
  pressedBlackKey: {
    backgroundColor: '#333333',
    borderColor: '#444444',
  },
});
