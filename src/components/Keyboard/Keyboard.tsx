/**
 * Interactive piano keyboard component
 * Renders 2-4 octaves of keys with multi-touch input handling.
 * Performance target: <16ms touch-to-visual feedback
 *
 * Multi-touch: A single View acts as the touch responder for the entire
 * keyboard. nativeEvent.touches provides all active touch points, which
 * are mapped to piano keys via geometric hit-testing. This avoids the
 * single-responder limitation of React Native's Pressable/Touchable.
 *
 * Auto-scroll: when a focusNote is provided, the keyboard automatically
 * scrolls to center that note in view.
 */

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { PianoKey } from './PianoKey';
import { hitTestPianoKey, getWhiteKeysInRange } from './keyboardHitTest';
import type { MidiNoteEvent } from '@/core/exercises/types';

export interface KeyboardProps {
  startNote?: number; // Default: C3 (48)
  octaveCount?: number; // Default: 2 (min: 1, max: 4)
  onNoteOn?: (note: MidiNoteEvent) => void;
  onNoteOff?: (midiNote: number) => void;
  highlightedNotes?: Set<number>;
  expectedNotes?: Set<number>;
  enabled?: boolean;
  hapticEnabled?: boolean;
  showLabels?: boolean;
  scrollable?: boolean;
  scrollEnabled?: boolean; // Allow manual scroll (default: true). Set false during exercises.
  keyHeight?: number;
  focusNote?: number; // MIDI note to auto-center on (for auto-scroll)
  testID?: string;
}

/**
 * Keyboard Component
 * Full piano keyboard with 2-4 octaves, true multi-touch support
 */
export const Keyboard = React.memo(
  ({
    startNote = 48, // C3
    octaveCount = 2,
    onNoteOn,
    onNoteOff,
    highlightedNotes = new Set(),
    expectedNotes = new Set(),
    enabled = true,
    hapticEnabled = false,
    showLabels = false,
    scrollable = true,
    scrollEnabled = true,
    keyHeight = 80,
    focusNote,
    testID,
  }: KeyboardProps) => {
    // Validate octave count
    const validOctaveCount = Math.max(1, Math.min(4, octaveCount));
    const endNote = startNote + validOctaveCount * 12 - 1;

    const scrollViewRef = useRef<ScrollView>(null);
    const containerRef = useRef<View>(null);
    const scrollOffsetRef = useRef(0);
    const keyboardLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
    const hasMeasuredRef = useRef(false);

    // Track which notes are pressed via multi-touch
    const [pressedNotes, setPressedNotes] = useState<Set<number>>(new Set());
    // Map of touchId → midiNote for tracking active touches
    const touchMapRef = useRef<Map<number, number>>(new Map());

    // Generate notes for the keyboard
    const notes = useMemo(() => {
      const noteArray: number[] = [];
      for (let i = startNote; i <= endNote; i++) {
        noteArray.push(i);
      }
      return noteArray;
    }, [startNote, endNote]);

    // Separate white and black keys for layout
    const whiteKeys = useMemo(() => {
      return getWhiteKeysInRange(startNote, endNote);
    }, [startNote, endNote]);

    const whiteKeyWidth = keyHeight * 0.7;
    const keyboardWidth = whiteKeys.length * whiteKeyWidth;

    // Auto-scroll to center the focusNote when it changes.
    // First mount uses requestAnimationFrame + no animation to ensure
    // the ScrollView content is laid out before scrolling.
    const hasInitiallyScrolledRef = useRef(false);
    useEffect(() => {
      if (!scrollable || !focusNote || !scrollViewRef.current) return undefined;
      if (focusNote < startNote || focusNote > endNote) return undefined;

      // Find the white key index for this note (or the nearest white key)
      const targetNote = [1, 3, 6, 8, 10].includes(focusNote % 12)
        ? focusNote - 1 // Black key → use the white key just below
        : focusNote;
      const whiteKeyIndex = whiteKeys.indexOf(targetNote);
      if (whiteKeyIndex < 0) return undefined;

      // Calculate the scroll offset to center this key
      const { width: screenWidth } = Dimensions.get('window');
      const targetX = whiteKeyIndex * whiteKeyWidth - screenWidth / 2 + whiteKeyWidth / 2;
      const clampedX = Math.max(0, Math.min(targetX, keyboardWidth - screenWidth));

      if (!hasInitiallyScrolledRef.current) {
        // First mount: defer scroll to ensure layout is complete, no animation
        hasInitiallyScrolledRef.current = true;
        const raf = requestAnimationFrame(() => {
          scrollViewRef.current?.scrollTo({ x: clampedX, animated: false });
        });
        return () => cancelAnimationFrame(raf);
      }
      scrollViewRef.current.scrollTo({ x: clampedX, animated: true });
      return undefined;
    }, [focusNote, scrollable, startNote, endNote, whiteKeys, whiteKeyWidth, keyboardWidth]);

    // Note on/off callbacks
    const fireNoteOn = useCallback(
      (midiNote: number) => {
        if (!enabled || !onNoteOn) return;
        const noteEvent: MidiNoteEvent = {
          type: 'noteOn',
          note: midiNote,
          velocity: 80,
          timestamp: Date.now(),
          channel: 0,
        };
        onNoteOn(noteEvent);
      },
      [enabled, onNoteOn]
    );

    const fireNoteOff = useCallback(
      (midiNote: number) => {
        if (!enabled || !onNoteOff) return;
        onNoteOff(midiNote);
      },
      [enabled, onNoteOff]
    );

    // Track keyboard layout for page→local coordinate conversion.
    // measureInWindow gives absolute screen coordinates, but may return
    // stale values during screen transition animations.
    const remeasure = useCallback(() => {
      containerRef.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          keyboardLayoutRef.current = { x, y, width, height };
          hasMeasuredRef.current = true;
        }
      });
    }, []);

    const handleLayout = useCallback(() => {
      remeasure();
    }, [remeasure]);

    // Re-measure after mount + delay to catch post-navigation animation shifts.
    // Screen transitions on iOS can take 300-500ms, so measuring during
    // handleLayout (which fires during the animation) gives stale y-coordinates.
    useEffect(() => {
      const timer = setTimeout(remeasure, 500);
      return () => clearTimeout(timer);
    }, [remeasure]);

    // Hit-test config for the current layout
    const hitTestConfig = useMemo(
      () => ({
        startNote,
        endNote,
        whiteKeys,
        totalWidth: scrollable ? keyboardWidth : keyboardLayoutRef.current.width || keyboardWidth,
        totalHeight: keyHeight,
      }),
      [startNote, endNote, whiteKeys, keyboardWidth, keyHeight, scrollable]
    );

    /**
     * Process all active touches and diff against previous state.
     * Fires onNoteOn for new presses and glissandos, onNoteOff for releases.
     */
    const processTouches = useCallback(
      (event: GestureResponderEvent) => {
        if (!enabled) return;
        // Guard: if measureInWindow hasn't completed yet, keyboardLayoutRef is
        // still {x:0, y:0} which makes localY = pageY (e.g. 750px) far exceed
        // totalHeight (120px), causing hitTestPianoKey to return null for every touch.
        if (!hasMeasuredRef.current) return;

        const touches = event.nativeEvent.touches ?? [];
        const newTouchMap = new Map<number, number>();

        // Map each active touch to a piano key
        for (const touch of touches) {
          // Always use pageX/pageY (screen-relative) with measured layout offset.
          // IMPORTANT: locationX/locationY are relative to the TOUCH TARGET
          // (the individual PianoKey view the touch landed on), NOT the keyboard
          // container. This makes them useless for keyboard-wide hit testing.
          let localX = touch.pageX - keyboardLayoutRef.current.x;
          let localY = touch.pageY - keyboardLayoutRef.current.y;
          if (scrollable) {
            localX += scrollOffsetRef.current;
          }

          const config = {
            ...hitTestConfig,
            totalWidth: scrollable ? keyboardWidth : keyboardLayoutRef.current.width || keyboardWidth,
          };

          const midiNote = hitTestPianoKey(localX, localY, config);
          if (midiNote !== null) {
            newTouchMap.set(Number(touch.identifier), midiNote);
          } else if (__DEV__) {
            // Diagnostic: log when a touch doesn't map to any key
            console.warn(
              '[Keyboard] hitTest miss',
              `localX=${localX.toFixed(1)} localY=${localY.toFixed(1)}`,
              `pageX=${touch.pageX.toFixed(1)} pageY=${touch.pageY.toFixed(1)}`,
              `layout=${JSON.stringify(keyboardLayoutRef.current)}`,
              `scroll=${scrollOffsetRef.current}`,
              `configW=${config.totalWidth} configH=${config.totalHeight}`,
            );
          }
        }

        const prevMap = touchMapRef.current;

        // Detect new presses and glissandos
        const newPressedSet = new Set<number>();
        for (const [touchId, midiNote] of newTouchMap) {
          newPressedSet.add(midiNote);
          const prevNote = prevMap.get(touchId);

          if (prevNote === undefined) {
            // New touch → note on
            fireNoteOn(midiNote);
            if (hapticEnabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
          } else if (prevNote !== midiNote) {
            // Glissando: moved to different key → off old, on new
            fireNoteOff(prevNote);
            fireNoteOn(midiNote);
            if (hapticEnabled) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }
          }
        }

        // Detect releases (touchId no longer present)
        for (const [touchId, midiNote] of prevMap) {
          if (!newTouchMap.has(touchId)) {
            fireNoteOff(midiNote);
          }
        }

        touchMapRef.current = newTouchMap;
        setPressedNotes(newPressedSet);
      },
      [enabled, hitTestConfig, keyboardWidth, scrollable, fireNoteOn, fireNoteOff, hapticEnabled]
    );

    /**
     * Handle all touches released (responder terminate or final release)
     */
    const releaseAllTouches = useCallback(() => {
      for (const [, midiNote] of touchMapRef.current) {
        fireNoteOff(midiNote);
      }
      touchMapRef.current.clear();
      setPressedNotes(new Set());
    }, [fireNoteOff]);

    // ── Multi-touch handlers ──────────────────────────────────────────
    // Uses raw touch events (onTouchStart/End/Move) instead of the responder
    // system, because the responder's onResponderGrant only fires ONCE (first
    // finger). Additional fingers are invisible until they MOVE. Touch events
    // fire for EVERY finger down/up, enabling true multi-touch.

    const handleTouchStart = useCallback(
      (event: GestureResponderEvent) => {
        // Re-measure on every touch start to handle post-navigation position shifts.
        // measureInWindow is async but very fast (~1ms native call). The current
        // touch uses existing coordinates; the measurement updates for subsequent
        // moves/touches within the same gesture.
        remeasure();
        processTouches(event);
      },
      [processTouches, remeasure]
    );

    const handleTouchMove = useCallback(
      (event: GestureResponderEvent) => processTouches(event),
      [processTouches]
    );

    const handleTouchEnd = useCallback(
      (event: GestureResponderEvent) => processTouches(event),
      [processTouches]
    );

    const handleTouchCancel = useCallback(
      () => releaseAllTouches(),
      [releaseAllTouches]
    );

    // Track scroll offset for hit-testing in scrollable mode
    const handleScroll = useCallback(
      (event: { nativeEvent: { contentOffset: { x: number } } }) => {
        scrollOffsetRef.current = event.nativeEvent.contentOffset.x;
      },
      []
    );

    // Merge pressed notes from touch with highlighted notes from parent
    const mergedPressedNotes = useMemo(() => {
      const merged = new Set(highlightedNotes);
      for (const note of pressedNotes) {
        merged.add(note);
      }
      return merged;
    }, [highlightedNotes, pressedNotes]);

    const KeyboardContent = (
      <View
        style={[
          styles.keyboard,
          {
            height: keyHeight,
            width: scrollable ? keyboardWidth : '100%',
          },
        ]}
        testID={testID && `${testID}-keyboard`}
      >
        {/* White keys as base layout */}
        {whiteKeys.map((note) => (
          <View
            key={`white-${note}`}
            style={[
              styles.whiteKeyContainer,
              {
                height: keyHeight,
              },
            ]}
            testID={`key-${note}`}
          >
            <PianoKey
              midiNote={note}
              isBlackKey={false}
              isHighlighted={mergedPressedNotes.has(note)}
              isExpected={expectedNotes.has(note)}
              isPressed={pressedNotes.has(note)}
              showLabels={showLabels}
            />
          </View>
        ))}

        {/* Black keys overlaid — overlay width = one white key, so PianoKey's
             inner 60% width + right:-30% centers the visible key on the boundary
             between adjacent white keys, matching the hit-test geometry exactly. */}
        {notes.map((note) => {
          if (![1, 3, 6, 8, 10].includes(note % 12)) {
            return null;
          }

          // Black key sits between the white key below it and the next white key.
          // midi - 1 is always the white key immediately below a black key.
          const whiteKeyIndex = whiteKeys.indexOf(note - 1);
          if (whiteKeyIndex < 0) return null;

          const oneKeyPercent = 100 / whiteKeys.length;

          return (
            <View
              key={`black-${note}`}
              style={[
                styles.blackKeyOverlay,
                {
                  left: `${whiteKeyIndex * oneKeyPercent}%`,
                  width: `${oneKeyPercent}%`,
                },
              ]}
              testID={`key-${note}`}
            >
              <PianoKey
                midiNote={note}
                isBlackKey={true}
                isHighlighted={mergedPressedNotes.has(note)}
                isExpected={expectedNotes.has(note)}
                isPressed={pressedNotes.has(note)}
                showLabels={showLabels}
              />
            </View>
          );
        })}
      </View>
    );

    // Touch event props for true multi-touch support
    const touchProps = {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    };

    // When scroll is disabled (exercises), claim the gesture responder to
    // prevent the parent ScrollView from intercepting multi-touch gestures.
    // When scroll is enabled (free play), let ScrollView handle scrolling
    // and rely on auto-release timers for missed onTouchEnd events.
    const gestureGuardProps = scrollable && !scrollEnabled ? {
      onStartShouldSetResponder: () => true as boolean,
      onMoveShouldSetResponder: () => true as boolean,
      onResponderTerminationRequest: () => false as boolean,
      onResponderTerminate: releaseAllTouches,
    } : {};

    if (scrollable) {
      return (
        <View ref={containerRef} style={styles.container} testID={testID} onLayout={handleLayout}>
          <ScrollView
            ref={scrollViewRef}
            horizontal
            scrollEnabled={scrollEnabled}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            showsHorizontalScrollIndicator={false}
            scrollsToTop={false}
          >
            <View {...touchProps} {...gestureGuardProps}>
              {KeyboardContent}
            </View>
          </ScrollView>
        </View>
      );
    }

    return (
      <View
        ref={containerRef}
        style={styles.container}
        testID={testID}
        onLayout={handleLayout}
        {...touchProps}
      >
        {KeyboardContent}
      </View>
    );
  }
);

Keyboard.displayName = 'Keyboard';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    overflow: 'hidden',
  },
  keyboard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    position: 'relative',
  },
  whiteKeyContainer: {
    flex: 1,
    position: 'relative',
    minWidth: 48,
  },
  blackKeyOverlay: {
    position: 'absolute',
    top: 0,
    // width is set inline per-key as (100 / whiteKeys.length)% to match hit-test geometry
    height: '65%',
    zIndex: 10,
  },
});

export default Keyboard;
