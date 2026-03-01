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
import { LinearGradient } from 'expo-linear-gradient';
import { midiToNoteName } from '@/core/music/MusicTheory';
import type { NoteEvent } from '@/core/exercises/types';

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

/** Default vertical pixels per beat (fallback when container size unavailable) */
export const PIXELS_PER_BEAT = 100;

/** Hit line position as a ratio of container height — near the keyboard edge */
export const HIT_LINE_RATIO = 0.95;

/** How many beats ahead of the hit line should be visible (Tetris-like cascade) */
export const LOOK_AHEAD_BEATS = 4;

/** Black keys are 60% the width of white keys */
export const BLACK_KEY_WIDTH_RATIO = 0.6;

// Default MIDI range when no notes are provided
const DEFAULT_MIDI_MIN = 48; // C3
const DEFAULT_MIDI_MAX = 72; // C5

// ---------------------------------------------------------------------------
// Color palette (matches horizontal PianoRoll)
// ---------------------------------------------------------------------------

const COLORS = {
  // Right hand: blue-purple
  rightUpcoming: '#7C4DFF',
  rightUpcomingLight: '#7C4DFF',
  rightUpcomingDark: '#536DFE',
  rightActive: '#E040FB',
  rightActiveLight: '#E040FB',
  rightActiveDark: '#AA00FF',
  rightPastLight: 'rgba(124, 77, 255, 0.3)',
  rightPastDark: 'rgba(83, 109, 254, 0.2)',
  // Left hand: teal-green
  leftUpcoming: '#26C6DA',
  leftUpcomingLight: '#26C6DA',
  leftUpcomingDark: '#00BFA5',
  leftActive: '#69F0AE',
  leftActiveLight: '#69F0AE',
  leftActiveDark: '#00E676',
  leftPastLight: 'rgba(38, 198, 218, 0.3)',
  leftPastDark: 'rgba(0, 191, 165, 0.2)',
  // Generic (when hand not specified)
  upcoming: '#7986CB',
  upcomingLight: '#7986CB',
  upcomingDark: '#3949AB',
  active: '#FF8A80',
  activeLight: '#FF8A80',
  activeDark: '#D32F2F',
  activeGlow: 'rgba(224, 64, 251, 0.35)',
  activeHalo: 'rgba(224, 64, 251, 0.15)',
  pastFaded: 'rgba(102, 187, 106, 0.4)',
  pastLight: 'rgba(129, 199, 132, 0.5)',
  pastDark: 'rgba(76, 175, 80, 0.3)',
  pressLine: '#40C4FF',
  pressLineGlow: 'rgba(64, 196, 255, 0.3)',
  beatLine: 'rgba(255, 255, 255, 0.06)',
  beatLineAccent: 'rgba(255, 255, 255, 0.15)',
  background: 'transparent',
  ghost: 'rgba(255, 255, 255, 0.15)',
  ghostBorder: 'rgba(255, 255, 255, 0.08)',
  innerHighlight: 'rgba(255, 255, 255, 0.25)',
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
  timingGracePeriodMs?: number;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VerticalPianoRoll = React.memo(
  ({
    notes,
    currentBeat = 0,
    tempo = 120,
    timeSignature = [4, 4],
    containerWidth,
    containerHeight,
    midiMin,
    midiMax,
    ghostNotes,
    ghostBeatOffset = 2,
    timingGracePeriodMs = 200,
    testID,
  }: VerticalPianoRollProps) => {
    const midiRange = midiMax - midiMin;
    const hitLineY = containerHeight * HIT_LINE_RATIO;

    // Dynamic pixels-per-beat: fill the visible area above the hit line
    // with LOOK_AHEAD_BEATS worth of notes for a Tetris-like cascade.
    const pixelsPerBeat = Math.max(30, hitLineY / LOOK_AHEAD_BEATS);

    // Timing zone: convert grace period from ms to pixels via beats.
    // At 120 BPM with 200ms grace: 200 / 500 = 0.4 beats ≈ 40-50px per side.
    const msPerBeat = 60000 / tempo;
    const zoneHalfBeats = timingGracePeriodMs / msPerBeat;
    const zoneHalfPx = zoneHalfBeats * pixelsPerBeat;
    const releaseLineGapPx = Math.max(24, zoneHalfPx * 2);

    // translateY drives the scrolling. As currentBeat increases the content
    // layer shifts down so that notes at currentBeat align with the hit line.
    // During countdown (currentBeat < 0), negative translateY pushes notes
    // ABOVE the hit line so they cascade down like Tetris during count-in.
    const translateY = currentBeat * pixelsPerBeat;

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
        const noteHeight = Math.max(16, note.durationBeats * pixelsPerBeat);

        // Position in the content layer (before translateY).
        // Bottom-edge alignment: the BOTTOM of the note block reaches the
        // hit line at currentBeat === startBeat. This matches the Synthesia
        // convention where the leading (bottom) edge is the attack point.
        const topPosition = hitLineY - note.startBeat * pixelsPerBeat - noteHeight;

        const noteEnd = note.startBeat + note.durationBeats;
        // During countdown (currentBeat < 0), all notes are upcoming (none active/past)
        const isPast = currentBeat >= 0 && noteEnd < currentBeat;
        const isActive = currentBeat >= 0 && note.startBeat <= currentBeat && currentBeat < noteEnd;

        // Per-hand coloring: right=purple, left=teal, unspecified=indigo
        const hand = note.hand;
        let color = hand === 'right' ? COLORS.rightUpcoming : hand === 'left' ? COLORS.leftUpcoming : COLORS.upcoming;
        let gradientTop = hand === 'right' ? COLORS.rightUpcomingLight : hand === 'left' ? COLORS.leftUpcomingLight : COLORS.upcomingLight;
        let gradientBottom = hand === 'right' ? COLORS.rightUpcomingDark : hand === 'left' ? COLORS.leftUpcomingDark : COLORS.upcomingDark;
        let borderColor = 'rgba(255, 255, 255, 0.2)';
        if (isPast) {
          color = COLORS.pastFaded;
          gradientTop = hand === 'right' ? COLORS.rightPastLight : hand === 'left' ? COLORS.leftPastLight : COLORS.pastLight;
          gradientBottom = hand === 'right' ? COLORS.rightPastDark : hand === 'left' ? COLORS.leftPastDark : COLORS.pastDark;
          borderColor = 'transparent';
        }
        if (isActive) {
          color = hand === 'right' ? COLORS.rightActive : hand === 'left' ? COLORS.leftActive : COLORS.active;
          gradientTop = hand === 'right' ? COLORS.rightActiveLight : hand === 'left' ? COLORS.leftActiveLight : COLORS.activeLight;
          gradientBottom = hand === 'right' ? COLORS.rightActiveDark : hand === 'left' ? COLORS.leftActiveDark : COLORS.activeDark;
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
          gradientTop,
          gradientBottom,
          borderColor,
          isPast,
          isActive,
          noteName,
          hand: note.hand,
        };
      });
    }, [notes, currentBeat, containerWidth, containerHeight, midiMin, midiRange, hitLineY, pixelsPerBeat]);

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
        const noteHeight = Math.max(16, note.durationBeats * pixelsPerBeat);
        // Ghost notes are offset ahead by ghostBeatOffset beats.
        // Same bottom-edge alignment as real notes.
        const topPosition =
          hitLineY - (note.startBeat - ghostBeatOffset) * pixelsPerBeat - noteHeight;
        return { index, x, width, noteHeight, topPosition };
      });
    }, [ghostNotes, ghostBeatOffset, containerWidth, midiMin, midiRange, hitLineY, pixelsPerBeat]);

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
                  top: hitLineY - beat * pixelsPerBeat,
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
            >
              <View style={styles.ghostNoteInner} />
            </View>
          ))}

          {/* Note bars — 3D capsule style with gradient fills */}
          {visualNotes.map((vn) => (
            <React.Fragment key={`note-${vn.index}`}>
              {/* Outer halo for active notes */}
              {vn.isActive && (
                <View
                  style={[
                    styles.noteHalo,
                    {
                      left: vn.x - 8,
                      top: vn.topPosition - 8,
                      width: vn.width + 16,
                      height: vn.noteHeight + 16,
                    },
                  ]}
                />
              )}
              {/* Inner glow for active notes */}
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
              {/* Note capsule with gradient fill */}
              <View
                testID={`note-bar-${vn.index}`}
                style={[
                  styles.note,
                  {
                    left: vn.x,
                    top: vn.topPosition,
                    width: vn.width,
                    height: vn.noteHeight,
                    borderColor: vn.borderColor,
                    opacity: vn.isPast ? 0.5 : 1,
                  },
                  vn.isActive && styles.noteActive,
                ]}
              >
                <LinearGradient
                  colors={[vn.gradientTop, vn.gradientBottom]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.noteGradient}
                >
                  {/* Inner top highlight for 3D depth */}
                  <View style={styles.noteInnerHighlight} />
                  <View style={styles.noteLabelContainer}>
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
                </LinearGradient>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Timing zone: gradient fade below press line */}
        <LinearGradient
          colors={['rgba(64, 196, 255, 0.15)', 'rgba(64, 196, 255, 0)']}
          style={[styles.timingZoneFill, {
            top: hitLineY,
            height: releaseLineGapPx,
          }]}
          testID="timing-zone-fill"
        />

        {/* Press line (key down) */}
        <View
          style={[styles.hitLineGlow, { top: hitLineY - 8 }]}
          testID="hit-line-glow"
        />
        <View
          style={[styles.hitLine, { top: hitLineY - 1 }]}
          testID="press-line"
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
    borderRadius: 8,
    borderWidth: 1.5,
    overflow: 'hidden',
    zIndex: 10,
    // 3D shadow for depth
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  noteActive: {
    shadowColor: COLORS.active,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  noteGradient: {
    flex: 1,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteInnerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: COLORS.innerHighlight,
  },
  noteLabelContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  noteHalo: {
    position: 'absolute',
    borderRadius: 12,
    backgroundColor: COLORS.activeHalo,
    zIndex: 8,
  },
  noteGlow: {
    position: 'absolute',
    borderRadius: 10,
    backgroundColor: COLORS.activeGlow,
    zIndex: 9,
  },
  ghostNote: {
    position: 'absolute',
    borderRadius: 8,
    backgroundColor: COLORS.ghost,
    borderWidth: 1,
    borderColor: COLORS.ghostBorder,
    zIndex: 5,
    overflow: 'hidden',
  },
  ghostNoteInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  noteLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  noteLabelActive: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
  },
  handLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 8,
    fontWeight: '600',
    marginTop: 1,
  },
  timingZoneFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 16,
  },
  hitLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: COLORS.pressLine,
    zIndex: 20,
  },
  hitLineGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 16,
    backgroundColor: COLORS.pressLineGlow,
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
