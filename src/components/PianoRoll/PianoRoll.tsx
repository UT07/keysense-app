/**
 * Piano Roll Component
 * Scrolling note visualization for exercises
 * Uses transform-based scrolling (not ScrollView) for smooth 60fps playback
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Text, Dimensions } from 'react-native';
import { midiToNoteName } from '@/core/music/MusicTheory';
import type { NoteEvent } from '@/core/exercises/types';

export interface PianoRollProps {
  notes: NoteEvent[];
  currentBeat?: number;
  tempo?: number;
  timeSignature?: [number, number];
  visibleBeats?: number;
  guideMode?: 'marker' | 'pressRelease';
  showBeatGrid?: boolean;
  releaseGuideOffsetBeats?: number;
  onNoteHighlight?: (noteIndex: number) => void;
  testID?: string;
}

const NOTE_HEIGHT = 44;
const PIXELS_PER_BEAT = 140;
const DEFAULT_TIMING_GRACE_MS = 220;

// Default MIDI range used when no notes are provided
const DEFAULT_MIDI_MIN = 48; // C3
const DEFAULT_MIDI_MAX = 72; // C5

/**
 * Derive MIDI display range from the exercise notes.
 * Adds a 2-semitone margin above/below the note range
 * for visual breathing room, with a minimum span of 12 semitones.
 */
function deriveMidiRange(notes: NoteEvent[]): { min: number; max: number; range: number } {
  if (notes.length === 0) {
    return { min: DEFAULT_MIDI_MIN, max: DEFAULT_MIDI_MAX, range: DEFAULT_MIDI_MAX - DEFAULT_MIDI_MIN };
  }
  const midiNotes = notes.map(n => n.note);
  const rawMin = Math.min(...midiNotes);
  const rawMax = Math.max(...midiNotes);
  // Add 2-semitone margin, enforce minimum 12-semitone span
  const margin = 2;
  const span = Math.max(12, rawMax - rawMin + margin * 2);
  const center = (rawMin + rawMax) / 2;
  const min = Math.round(center - span / 2);
  const max = min + span;
  return { min, max, range: span };
}

const COLORS = {
  upcoming: '#5C6BC0', // Indigo
  active: '#FF5252', // Bright red
  activeGlow: 'rgba(255, 82, 82, 0.3)',
  past: '#66BB6A', // Green
  pastFaded: 'rgba(102, 187, 106, 0.4)',
  staff: '#E8E8E8',
  staffAccent: '#D0D0D0',
  marker: '#FF1744',
  markerGlow: 'rgba(255, 23, 68, 0.2)',
  pressLine: '#FF1744',
  releaseLine: '#40C4FF',
  background: '#1A1A2E',
  beatLine: 'rgba(255, 255, 255, 0.08)',
  beatLineAccent: 'rgba(255, 255, 255, 0.15)',
};

/**
 * Calculate the visual Y position for a note based on MIDI number
 * Notes are laid out bottom-to-top (low notes at bottom, high notes at top)
 * Adds vertical padding so notes at the extremes aren't clipped
 */
const VERTICAL_PADDING = NOTE_HEIGHT / 2 + 2; // Half a note height + small gap

function calculateNoteY(
  midiNote: number,
  containerHeight: number,
  midiMin: number,
  midiRange: number,
): number {
  const noteInRange = Math.max(midiMin, Math.min(midiMin + midiRange, midiNote));
  const normalized = (noteInRange - midiMin) / midiRange;
  // Usable height excludes top and bottom padding
  const usableHeight = containerHeight - VERTICAL_PADDING * 2;
  return VERTICAL_PADDING + usableHeight * (1 - normalized) - NOTE_HEIGHT / 2;
}

/**
 * PianoRoll Component
 * Displays notes that scroll from right to left toward a fixed playback marker.
 * Uses transform translateX instead of ScrollView for reliable 60fps scrolling.
 */
export const PianoRoll = React.memo(
  ({
    notes,
    currentBeat = 0,
    tempo = 120,
    timeSignature = [4, 4],
    visibleBeats: _visibleBeats = 8,
    guideMode = 'marker',
    showBeatGrid = true,
    releaseGuideOffsetBeats,
    onNoteHighlight: _onNoteHighlight,
    testID,
  }: PianoRollProps) => {
    const screenWidth = Dimensions.get('window').width;
    const containerHeight = 200;

    // Derive MIDI range from the actual notes in this exercise
    const { min: midiMin, range: midiRange } = useMemo(() => deriveMidiRange(notes), [notes]);

    // The playback marker sits at 1/3 of the screen
    const markerX = screenWidth / 3;
    const msPerBeat = 60000 / tempo;
    const derivedReleaseGuideOffsetBeats = Math.max(
      0.2,
      releaseGuideOffsetBeats ?? DEFAULT_TIMING_GRACE_MS / msPerBeat,
    );
    const releaseLineX = markerX + derivedReleaseGuideOffsetBeats * PIXELS_PER_BEAT;
    const shouldRenderBeatGrid = guideMode === 'pressRelease' ? false : showBeatGrid;

    // Calculate the translateX offset to keep currentBeat aligned with the marker
    const translateX = -currentBeat * PIXELS_PER_BEAT;

    // Total content width based on notes
    const maxBeat = notes.length > 0
      ? Math.max(...notes.map((n) => n.startBeat + n.durationBeats))
      : 4;

    // Generate beat lines for visual grid
    const beatsPerMeasure = timeSignature[0];
    const totalBeats = Math.ceil(maxBeat) + 4;
    const beatLines = useMemo(() => {
      const lines = [];
      for (let beat = 0; beat <= totalBeats; beat++) {
        const isMeasureLine = beat % beatsPerMeasure === 0;
        lines.push({ beat, isMeasureLine });
      }
      return lines;
    }, [totalBeats, beatsPerMeasure]);

    // Calculate visual notes with color/state based on currentBeat
    const visualNotes = useMemo(() => {
      return notes.map((note, index) => {
        const topPosition = calculateNoteY(note.note, containerHeight, midiMin, midiRange);
        // Position relative to beat 0 (markerX offset added via parent transform)
        const leftPosition = markerX + note.startBeat * PIXELS_PER_BEAT;
        const width = Math.max(20, note.durationBeats * PIXELS_PER_BEAT);

        const noteEnd = note.startBeat + note.durationBeats;
        const isPast = noteEnd < currentBeat;
        const isActive = note.startBeat <= currentBeat && currentBeat < noteEnd;

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
          topPosition,
          leftPosition,
          width,
          color,
          borderColor,
          isActive,
          isPast,
          noteName,
        };
      });
    }, [notes, currentBeat, containerHeight, markerX, midiMin, midiRange]);

    return (
      <View
        style={[styles.container, { height: containerHeight }]}
        testID={testID}
      >
        {/* Dark background with gradient feel */}
        <View style={styles.background} />

        {/* Content layer — moves via translateX */}
        <View
          style={[
            styles.contentLayer,
            { transform: [{ translateX }] },
          ]}
        >
          {/* Beat grid lines */}
          {shouldRenderBeatGrid && beatLines.map(({ beat, isMeasureLine }) => (
            <View
              key={`beat-${beat}`}
              testID={`piano-roll-beat-line-${beat}`}
              style={[
                styles.beatLine,
                {
                  left: markerX + beat * PIXELS_PER_BEAT,
                  backgroundColor: isMeasureLine
                    ? COLORS.beatLineAccent
                    : COLORS.beatLine,
                  width: isMeasureLine ? 2 : 1,
                },
              ]}
            />
          ))}

          {/* Note blocks */}
          {visualNotes.map((vn) => (
            <View key={`note-${vn.index}`}>
              {/* Active glow behind the note */}
              {guideMode !== 'pressRelease' && vn.isActive && (
                <View
                  style={[
                    styles.noteGlow,
                    {
                      left: vn.leftPosition - 4,
                      top: vn.topPosition - 4,
                      width: vn.width + 8,
                      height: NOTE_HEIGHT + 8,
                    },
                  ]}
                />
              )}
              <View
                style={[
                  styles.note,
                  {
                    left: vn.leftPosition,
                    top: vn.topPosition,
                    width: vn.width,
                    height: NOTE_HEIGHT,
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
                {vn.note.hand && (
                  <Text style={styles.handLabel}>
                    {vn.note.hand === 'left' ? 'L' : 'R'}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Guide lines */}
        {guideMode === 'marker' ? (
          <>
            <View style={[styles.markerGlow, { left: markerX - 8 }]} />
            <View style={[styles.playbackMarker, { left: markerX - 1 }]} testID="marker-line" />
          </>
        ) : (
          <>
            <View style={[styles.pressLine, { left: markerX - 1.5 }]} testID="press-line" />
            <View style={[styles.releaseLine, { left: releaseLineX - 1.5 }]} testID="release-line" />
          </>
        )}

        {/* Beat counter */}
        <View style={styles.beatCounter}>
          <Text style={styles.beatText}>
            {currentBeat < 0
              ? `Count: ${Math.ceil(-currentBeat)}`
              : `Beat ${Math.floor(currentBeat) + 1}`}
          </Text>
        </View>
      </View>
    );
  }
);

PianoRoll.displayName = 'PianoRoll';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  contentLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  beatLine: {
    position: 'absolute',
    height: '100%',
  },
  noteGlow: {
    position: 'absolute',
    borderRadius: 8,
    backgroundColor: COLORS.activeGlow,
  },
  note: {
    position: 'absolute',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
  },
  noteLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  noteLabelActive: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  handLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  playbackMarker: {
    position: 'absolute',
    width: 3,
    height: '100%',
    backgroundColor: COLORS.marker,
    zIndex: 20,
  },
  markerGlow: {
    position: 'absolute',
    width: 16,
    height: '100%',
    backgroundColor: COLORS.markerGlow,
    zIndex: 19,
  },
  pressLine: {
    position: 'absolute',
    width: 3,
    height: '100%',
    backgroundColor: COLORS.pressLine,
    zIndex: 20,
  },
  releaseLine: {
    position: 'absolute',
    width: 3,
    height: '100%',
    backgroundColor: COLORS.releaseLine,
    zIndex: 20,
  },
  beatCounter: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    zIndex: 15,
  },
  beatText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default PianoRoll;
