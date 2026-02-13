/**
 * Piano Roll Component
 * Scrolling note visualization for exercises
 * Shows upcoming, active, and past notes with color coding
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import type { NoteEvent } from '@/core/exercises/types';

export interface PianoRollProps {
  notes: NoteEvent[];
  currentBeat?: number;
  tempo?: number;
  timeSignature?: [number, number];
  visibleBeats?: number;
  onNoteHighlight?: (noteIndex: number) => void;
  testID?: string;
}

interface VisualNote {
  index: number;
  note: NoteEvent;
  topPosition: number;
  leftPosition: number;
  width: number;
  height: number;
  color: string;
  isActive: boolean;
  isPast: boolean;
}

const MIDI_MIN = 48; // C3
const MIDI_MAX = 72; // C5
const MIDI_RANGE = MIDI_MAX - MIDI_MIN;

const COLORS = {
  upcoming: '#64B5F6', // Blue
  active: '#EF5350', // Red
  past: '#81C784', // Green
  staff: '#E0E0E0',
};

/**
 * Calculate the visual Y position for a note based on MIDI number
 */
function calculateNoteY(midiNote: number, containerHeight: number): number {
  const noteInRange = Math.max(MIDI_MIN, Math.min(MIDI_MAX, midiNote));
  const normalized = (noteInRange - MIDI_MIN) / MIDI_RANGE;
  return containerHeight - normalized * containerHeight;
}

/**
 * PianoRoll Component
 * Displays notes in a scrollable piano roll format
 */
export const PianoRoll = React.memo(
  ({
    notes,
    currentBeat = 0,
    tempo: _tempo = 120,
    timeSignature: _timeSignature = [4, 4],
    visibleBeats: _visibleBeats = 8,
    onNoteHighlight,
    testID,
  }: PianoRollProps) => {
    const screenWidth = Dimensions.get('window').width;
    const containerHeight = 200;

    // Convert beat to pixel position
    // Assumption: 100 pixels per beat for visualization
    const pixelsPerBeat = 100;
    // Padding so the first note starts at the playback marker (1/3 of screen)
    const contentPadding = screenWidth / 3;
    const totalWidth = notes.length > 0
      ? Math.max(
          screenWidth,
          (Math.max(...notes.map((n) => n.startBeat + n.durationBeats)) + 2) *
            pixelsPerBeat + contentPadding
        )
      : screenWidth;

    // Calculate visual notes
    const visualNotes = useMemo(() => {
      return notes.map((note, index) => {
        const topPosition = calculateNoteY(note.note, containerHeight);
        const leftPosition = contentPadding + note.startBeat * pixelsPerBeat;
        const width = Math.max(8, note.durationBeats * pixelsPerBeat);
        const height = 20;

        // Determine color based on position relative to current beat
        const noteEnd = note.startBeat + note.durationBeats;
        const isPast = noteEnd < currentBeat;
        const isActive =
          note.startBeat <= currentBeat && currentBeat < noteEnd;

        let color = COLORS.upcoming;
        if (isPast) color = COLORS.past;
        if (isActive) color = COLORS.active;

        return {
          index,
          note,
          topPosition,
          leftPosition,
          width,
          height,
          color,
          isActive,
          isPast,
        } as VisualNote;
      });
    }, [notes, currentBeat, containerHeight, pixelsPerBeat, contentPadding]);

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const scrollX = event.nativeEvent.contentOffset.x;

        // Highlight notes near the current position marker
        const markerPosition = screenWidth / 3;
        visualNotes.forEach((visualNote) => {
          const noteScreenPosition = visualNote.leftPosition - scrollX;
          const isNearMarker =
            Math.abs(noteScreenPosition - markerPosition) < 50;

          if (isNearMarker && onNoteHighlight) {
            onNoteHighlight(visualNote.index);
          }
        });
      },
      [visualNotes, screenWidth, onNoteHighlight]
    );

    // Scroll so the current beat aligns with the playback marker (1/3 of screen).
    // With contentPadding = screenWidth/3, beat 0 is already at the marker
    // at scrollX=0, so we simply scroll by currentBeat * pixelsPerBeat.
    const currentScrollX = Math.max(0, currentBeat * pixelsPerBeat);

    // Ref for programmatic scrolling
    const scrollViewRef = useRef<ScrollView>(null);

    // Scroll to current beat position whenever it changes
    useEffect(() => {
      scrollViewRef.current?.scrollTo({ x: currentScrollX, animated: false });
    }, [currentScrollX]);

    return (
      <View style={[styles.container, { height: containerHeight }]} testID={testID}>
        {/* Staff lines background */}
        <View style={styles.staffLines}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View
              key={`staff-${i}`}
              style={[
                styles.staffLine,
                {
                  top: `${i * 25}%`,
                },
              ]}
            />
          ))}
        </View>

        {/* Notes container */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          scrollEventThrottle={16}
          onScroll={handleScroll}
          showsHorizontalScrollIndicator={false}
          scrollsToTop={false}
        >
          <View
            style={[
              styles.notesContainer,
              {
                width: totalWidth,
                height: containerHeight,
              },
            ]}
          >
            {/* Render notes */}
            {visualNotes.map((visualNote) => (
              <View
                key={`note-${visualNote.index}`}
                style={[
                  styles.note,
                  {
                    left: visualNote.leftPosition,
                    top: visualNote.topPosition,
                    width: visualNote.width,
                    height: visualNote.height,
                    backgroundColor: visualNote.color,
                    opacity: visualNote.isPast ? 0.5 : 1,
                  },
                ]}
              >
                {visualNote.note.hand && (
                  <Text style={styles.handLabel}>
                    {visualNote.note.hand === 'left' ? 'L' : 'R'}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Playback position indicator (vertical line at 1/3 of screen) */}
        <View
          style={[
            styles.playbackMarker,
            {
              left: screenWidth / 3,
            },
          ]}
        />

        {/* Beat counter */}
        <View style={styles.beatCounter}>
          <Text style={styles.beatText}>Beat {Math.ceil(currentBeat)}</Text>
        </View>
      </View>
    );
  }
);

PianoRoll.displayName = 'PianoRoll';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  staffLines: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  staffLine: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.staff,
    position: 'absolute',
  },
  notesContainer: {
    position: 'relative',
  },
  note: {
    position: 'absolute',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  handLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  playbackMarker: {
    position: 'absolute',
    width: 2,
    height: '100%',
    backgroundColor: '#F44336',
    zIndex: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  beatCounter: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 15,
  },
  beatText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333333',
  },
});

export default PianoRoll;
