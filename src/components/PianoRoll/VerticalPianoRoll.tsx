/**
 * Vertical Piano Roll Component
 *
 * Falling-notes visualization for piano exercises (Synthesia-style).
 * Notes scroll top-to-bottom toward a hit line at 80% from the top.
 * X axis = pitch (MIDI notes), Y axis = time (beats).
 *
 * Uses transform-based scrolling (translateY on content layer) for smooth
 * 60fps playback — no ScrollView.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { midiToNoteName } from '@/core/music/MusicTheory';
import type { NoteEvent } from '@/core/exercises/types';

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

/** Vertical pixels per beat of music */
export const PIXELS_PER_BEAT = 100;

/** Hit line position as a ratio of container height (0.8 = 80% from top) */
export const HIT_LINE_RATIO = 0.8;

/** Black keys are 60% the width of white keys */
export const BLACK_KEY_WIDTH_RATIO = 0.6;

// Default MIDI range when no notes are provided
const DEFAULT_MIDI_MIN = 48; // C3
const DEFAULT_MIDI_MAX = 72; // C5

// ---------------------------------------------------------------------------
// Color palette (matches horizontal PianoRoll)
// ---------------------------------------------------------------------------

const COLORS = {
  upcoming: '#5C6BC0', // Indigo
  active: '#FF5252', // Bright red
  activeGlow: 'rgba(255, 82, 82, 0.3)',
  pastFaded: 'rgba(102, 187, 106, 0.4)',
  marker: '#FF1744', // Hit line
  markerGlow: 'rgba(255, 23, 68, 0.2)',
  beatLine: 'rgba(255, 255, 255, 0.08)',
  beatLineAccent: 'rgba(255, 255, 255, 0.2)',
  background: '#0D0D0D',
  ghost: 'rgba(255, 255, 255, 0.3)',
};

// ---------------------------------------------------------------------------
// Piano key helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the given MIDI note is a black key (sharp/flat).
 * Pitch classes 1, 3, 6, 8, 10 correspond to C#, D#, F#, G#, A#.
 */
function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

/**
 * Returns an array of MIDI note numbers for all white keys in [min, max].
 */
function whiteKeysInRange(min: number, max: number): number[] {
  const keys: number[] = [];
  for (let m = min; m <= max; m++) {
    if (!isBlackKey(m)) {
      keys.push(m);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Exported coordinate functions (used by tests and ExercisePlayer)
// ---------------------------------------------------------------------------

/**
 * Derive a display MIDI range from exercise notes.
 * Adds a 2-semitone margin and enforces a minimum 12-semitone span.
 */
export function deriveMidiRange(
  notes: NoteEvent[],
): { min: number; max: number; range: number } {
  if (notes.length === 0) {
    return {
      min: DEFAULT_MIDI_MIN,
      max: DEFAULT_MIDI_MAX,
      range: DEFAULT_MIDI_MAX - DEFAULT_MIDI_MIN,
    };
  }
  const midiNotes = notes.map((n) => n.note);
  const rawMin = Math.min(...midiNotes);
  const rawMax = Math.max(...midiNotes);
  const margin = 2;
  const span = Math.max(12, rawMax - rawMin + margin * 2);
  const center = (rawMin + rawMax) / 2;
  const min = Math.round(center - span / 2);
  const max = min + span;
  return { min, max, range: span };
}

/**
 * Calculate the horizontal position and width of a note bar.
 *
 * White keys are evenly spaced across the container width.
 * Black keys are BLACK_KEY_WIDTH_RATIO (60%) the width of white keys,
 * centered on the boundary between adjacent white keys.
 *
 * @returns `{ x, width }` in pixels within the container
 */
export function calculateNoteX(
  midiNote: number,
  containerWidth: number,
  midiMin: number,
  midiRange: number,
): { x: number; width: number } {
  const midiMax = midiMin + midiRange;
  const whites = whiteKeysInRange(midiMin, midiMax);
  const whiteKeyWidth = containerWidth / whites.length;

  if (!isBlackKey(midiNote)) {
    // White key: find its index among white keys
    const idx = whites.indexOf(midiNote);
    if (idx === -1) {
      // Note outside visible range -- clamp to nearest edge
      const clamped = midiNote < whites[0] ? 0 : whites.length - 1;
      return { x: clamped * whiteKeyWidth, width: whiteKeyWidth };
    }
    return { x: idx * whiteKeyWidth, width: whiteKeyWidth };
  } else {
    // Black key: centered on the boundary between the white key below
    // and the white key above. The white key immediately below a black
    // key is always at midiNote - 1 (chromatic scale property).
    const lowerWhite = midiNote - 1;
    const idx = whites.indexOf(lowerWhite);
    const blackWidth = whiteKeyWidth * BLACK_KEY_WIDTH_RATIO;
    if (idx === -1) {
      // Lower white key not in range -- clamp
      return { x: 0, width: blackWidth };
    }
    const x = (idx + 1) * whiteKeyWidth - blackWidth / 2;
    return { x, width: blackWidth };
  }
}

/**
 * Calculate the Y (top) position of a note in screen coordinates.
 *
 * Notes at `currentBeat` sit at the hit line. Future notes (startBeat >
 * currentBeat) are above the hit line; past notes are below.
 *
 * @param noteStartBeat - The beat at which the note begins
 * @param currentBeat   - The playback position in beats
 * @param hitLineY      - The Y pixel position of the hit line
 * @param pixelsPerBeat - Vertical pixels per beat
 * @returns Y position in pixels (top of the note)
 */
export function calculateNoteTop(
  noteStartBeat: number,
  currentBeat: number,
  hitLineY: number,
  pixelsPerBeat: number,
): number {
  const beatDiff = noteStartBeat - currentBeat;
  return hitLineY - beatDiff * pixelsPerBeat;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VerticalPianoRollProps {
  notes: NoteEvent[];
  currentBeat?: number;
  tempo?: number;
  timeSignature?: [number, number];
  containerWidth: number;
  containerHeight: number;
  midiMin: number;
  midiMax: number;
  ghostNotes?: NoteEvent[];
  ghostBeatOffset?: number;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VerticalPianoRoll = React.memo(
  ({
    notes,
    currentBeat = 0,
    tempo: _tempo = 120,
    timeSignature = [4, 4],
    containerWidth,
    containerHeight,
    midiMin,
    midiMax,
    ghostNotes,
    ghostBeatOffset = 2,
    testID,
  }: VerticalPianoRollProps) => {
    const midiRange = midiMax - midiMin;
    const hitLineY = containerHeight * HIT_LINE_RATIO;

    // translateY drives the scrolling. As currentBeat increases the content
    // layer shifts down so that notes at currentBeat align with the hit line.
    // During countdown (currentBeat < 0) freeze at 0 so notes stay still.
    const translateY = Math.max(0, currentBeat) * PIXELS_PER_BEAT;

    // Total beats in exercise (used for beat line generation)
    const maxBeat =
      notes.length > 0
        ? Math.max(...notes.map((n) => n.startBeat + n.durationBeats))
        : 4;

    // Beat lines (horizontal grid)
    const beatsPerMeasure = timeSignature[0];
    const totalBeats = Math.ceil(maxBeat) + 4;
    const beatLines = useMemo(() => {
      const lines: { beat: number; isMeasureLine: boolean }[] = [];
      for (let beat = 0; beat <= totalBeats; beat++) {
        lines.push({ beat, isMeasureLine: beat % beatsPerMeasure === 0 });
      }
      return lines;
    }, [totalBeats, beatsPerMeasure]);

    // Pre-compute visual notes with positions, colors, and state
    const visualNotes = useMemo(() => {
      return notes.map((note, index) => {
        const { x, width } = calculateNoteX(
          note.note,
          containerWidth,
          midiMin,
          midiRange,
        );
        const noteHeight = Math.max(20, note.durationBeats * PIXELS_PER_BEAT);

        // Position in the content layer (before translateY)
        // Notes are placed relative to beat 0 at hitLineY
        const topPosition = hitLineY - note.startBeat * PIXELS_PER_BEAT;

        const noteEnd = note.startBeat + note.durationBeats;
        // During countdown (currentBeat < 0), no notes are active or past
        const clampedBeat = Math.max(0, currentBeat);
        const isPast = noteEnd < clampedBeat;
        const isActive = clampedBeat >= 0 && note.startBeat <= clampedBeat && clampedBeat < noteEnd;

        let color = COLORS.upcoming;
        let borderColor = 'rgba(255, 255, 255, 0.2)';
        if (isPast) {
          color = COLORS.pastFaded;
          borderColor = 'transparent';
        }
        if (isActive) {
          color = COLORS.active;
          borderColor = '#FFF';
        }

        const noteName = midiToNoteName(note.note);

        return {
          index,
          note,
          x,
          width,
          noteHeight,
          topPosition,
          color,
          borderColor,
          isPast,
          isActive,
          noteName,
          hand: note.hand,
        };
      });
    }, [notes, currentBeat, containerWidth, containerHeight, midiMin, midiRange, hitLineY]);

    // Ghost notes (semi-transparent overlay of upcoming notes)
    const visualGhostNotes = useMemo(() => {
      if (!ghostNotes || ghostNotes.length === 0) return [];
      return ghostNotes.map((note, index) => {
        const { x, width } = calculateNoteX(
          note.note,
          containerWidth,
          midiMin,
          midiRange,
        );
        const noteHeight = Math.max(20, note.durationBeats * PIXELS_PER_BEAT);
        // Ghost notes are offset ahead by ghostBeatOffset beats
        const topPosition =
          hitLineY - (note.startBeat - ghostBeatOffset) * PIXELS_PER_BEAT;
        return { index, x, width, noteHeight, topPosition };
      });
    }, [ghostNotes, ghostBeatOffset, containerWidth, midiMin, midiRange, hitLineY]);

    return (
      <View
        style={[styles.container, { width: containerWidth, height: containerHeight }]}
        testID={testID}
      >
        {/* Dark background */}
        <View style={styles.background} />

        {/* Content layer -- moves via translateY */}
        <View
          style={[
            styles.contentLayer,
            { transform: [{ translateY }] },
          ]}
        >
          {/* Horizontal beat grid lines */}
          {beatLines.map(({ beat, isMeasureLine }) => (
            <View
              key={`beat-${beat}`}
              style={[
                styles.beatLine,
                {
                  top: hitLineY - beat * PIXELS_PER_BEAT,
                  width: containerWidth,
                  height: isMeasureLine ? 2 : 1,
                  backgroundColor: isMeasureLine
                    ? COLORS.beatLineAccent
                    : COLORS.beatLine,
                },
              ]}
            />
          ))}

          {/* Ghost notes layer (rendered below real notes in z-order) */}
          {visualGhostNotes.map((gn) => (
            <View
              key={`ghost-${gn.index}`}
              testID={`ghost-note-${gn.index}`}
              style={[
                styles.ghostNote,
                {
                  left: gn.x,
                  top: gn.topPosition,
                  width: gn.width,
                  height: gn.noteHeight,
                },
              ]}
            />
          ))}

          {/* Note bars */}
          {visualNotes.map((vn) => (
            <React.Fragment key={`note-${vn.index}`}>
              {/* Active glow effect */}
              {vn.isActive && (
                <View
                  style={[
                    styles.noteGlow,
                    {
                      left: vn.x - 4,
                      top: vn.topPosition - 4,
                      width: vn.width + 8,
                      height: vn.noteHeight + 8,
                    },
                  ]}
                />
              )}
              <View
                testID={`note-bar-${vn.index}`}
                style={[
                  styles.note,
                  {
                    left: vn.x,
                    top: vn.topPosition,
                    width: vn.width,
                    height: vn.noteHeight,
                    backgroundColor: vn.color,
                    borderColor: vn.borderColor,
                    opacity: vn.isPast ? 0.5 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.noteLabel,
                    vn.isActive && styles.noteLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {vn.noteName}
                </Text>
                {vn.hand && (
                  <Text style={styles.handLabel}>
                    {vn.hand === 'left' ? 'L' : 'R'}
                  </Text>
                )}
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Fixed hit line with glow (does NOT move with content) */}
        <View
          style={[styles.hitLineGlow, { top: hitLineY - 8 }]}
          testID="hit-line-glow"
        />
        <View
          style={[styles.hitLine, { top: hitLineY - 1 }]}
          testID="hit-line"
        />

        {/* Beat counter (bottom-right corner) */}
        <View style={styles.beatCounter}>
          <Text style={styles.beatText}>
            {currentBeat < 0
              ? `Count: ${Math.ceil(-currentBeat)}`
              : `Beat ${Math.floor(currentBeat) + 1}`}
          </Text>
        </View>
      </View>
    );
  },
);

VerticalPianoRoll.displayName = 'VerticalPianoRoll';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  contentLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  beatLine: {
    position: 'absolute',
    left: 0,
  },
  note: {
    position: 'absolute',
    borderRadius: 6,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  noteGlow: {
    position: 'absolute',
    borderRadius: 8,
    backgroundColor: COLORS.activeGlow,
    zIndex: 9,
  },
  ghostNote: {
    position: 'absolute',
    borderRadius: 6,
    backgroundColor: COLORS.ghost,
    zIndex: 5,
  },
  noteLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '600',
  },
  noteLabelActive: {
    color: '#FFFFFF',
  },
  handLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 8,
    marginTop: 2,
  },
  hitLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.marker,
    zIndex: 20,
  },
  hitLineGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 16,
    backgroundColor: COLORS.markerGlow,
    zIndex: 19,
  },
  beatCounter: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 25,
  },
  beatText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
});

export default VerticalPianoRoll;
