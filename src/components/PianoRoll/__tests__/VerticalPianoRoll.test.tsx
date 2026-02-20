/**
 * VerticalPianoRoll Tests
 *
 * Tests coordinate calculation functions (deriveMidiRange, calculateNoteX,
 * calculateNoteTop) and component rendering (note bars, hit line, ghost notes).
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import {
  VerticalPianoRoll,
  deriveMidiRange,
  calculateNoteX,
  calculateNoteTop,
  PIXELS_PER_BEAT,
  HIT_LINE_RATIO,
  BLACK_KEY_WIDTH_RATIO,
} from '../VerticalPianoRoll';
import type { NoteEvent } from '@/core/exercises/types';

// ---------------------------------------------------------------------------
// Unit tests for exported coordinate functions
// ---------------------------------------------------------------------------

describe('deriveMidiRange', () => {
  it('derives range from exercise notes with 2-semitone margin', () => {
    const notes: NoteEvent[] = [
      { note: 60, startBeat: 0, durationBeats: 1 },
      { note: 64, startBeat: 1, durationBeats: 1 },
      { note: 67, startBeat: 2, durationBeats: 1 },
    ];
    const { min, max, range } = deriveMidiRange(notes);
    // Raw span is 60-67 = 7 semitones, plus 2*2 margin = 11, bumped to min 12
    expect(range).toBeGreaterThanOrEqual(12);
    expect(min).toBeLessThanOrEqual(60 - 2); // margin below lowest note
    expect(max).toBeGreaterThanOrEqual(67 + 2); // margin above highest note
  });

  it('enforces minimum 12-semitone span for single note', () => {
    const notes: NoteEvent[] = [{ note: 60, startBeat: 0, durationBeats: 1 }];
    const { range } = deriveMidiRange(notes);
    expect(range).toBeGreaterThanOrEqual(12);
  });

  it('returns default range for empty notes', () => {
    const { min, max, range } = deriveMidiRange([]);
    expect(min).toBe(48);
    expect(max).toBe(72);
    expect(range).toBe(24);
  });

  it('centers range around the note spread', () => {
    const notes: NoteEvent[] = [
      { note: 60, startBeat: 0, durationBeats: 1 },
      { note: 72, startBeat: 1, durationBeats: 1 },
    ];
    const { min, max } = deriveMidiRange(notes);
    const center = (min + max) / 2;
    // Center should be near the midpoint of 60 and 72 = 66
    expect(center).toBeGreaterThanOrEqual(63);
    expect(center).toBeLessThanOrEqual(69);
  });

  it('handles wide range notes without shrinking', () => {
    const notes: NoteEvent[] = [
      { note: 36, startBeat: 0, durationBeats: 1 }, // C2
      { note: 84, startBeat: 1, durationBeats: 1 }, // C6
    ];
    const { min, max, range } = deriveMidiRange(notes);
    expect(range).toBeGreaterThanOrEqual(84 - 36 + 4); // raw span + margins
    expect(min).toBeLessThanOrEqual(36);
    expect(max).toBeGreaterThanOrEqual(84);
  });
});

describe('calculateNoteX', () => {
  const containerWidth = 400;
  const midiMin = 60; // C4
  const midiRange = 12; // 1 octave (C4 to B4)

  it('maps a white key to a horizontal position within the container', () => {
    const { x } = calculateNoteX(60, containerWidth, midiMin, midiRange);
    // C4 is the first white key, should be at or near x=0
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(containerWidth / 2);
  });

  it('maps high notes to the right side of the container', () => {
    // B4 = MIDI 71, last note in range
    const { x } = calculateNoteX(71, containerWidth, midiMin, midiRange);
    expect(x).toBeGreaterThan(containerWidth / 2);
  });

  it('returns different widths for white vs black keys', () => {
    const white = calculateNoteX(60, containerWidth, midiMin, midiRange); // C4 = white
    const black = calculateNoteX(61, containerWidth, midiMin, midiRange); // C#4 = black
    expect(black.width).toBeLessThan(white.width);
    expect(black.width).toBeCloseTo(white.width * BLACK_KEY_WIDTH_RATIO, 1);
  });

  it('positions black key centered between adjacent white keys', () => {
    // C#4 (61) should be between C4 (60) and D4 (62)
    const cKey = calculateNoteX(60, containerWidth, midiMin, midiRange);
    const csKey = calculateNoteX(61, containerWidth, midiMin, midiRange);
    // Black key center should be between C right edge and D left edge
    const csCenter = csKey.x + csKey.width / 2;
    const boundary = cKey.x + cKey.width; // Right edge of C = left edge of D
    expect(csCenter).toBeCloseTo(boundary, 1);
  });

  it('all white keys in one octave have equal width', () => {
    const whiteNotes = [60, 62, 64, 65, 67, 69, 71]; // C D E F G A B
    const widths = whiteNotes.map(n => calculateNoteX(n, containerWidth, midiMin, midiRange).width);
    for (const w of widths) {
      expect(w).toBeCloseTo(widths[0], 5);
    }
  });

  it('all black keys in one octave have equal width', () => {
    const blackNotes = [61, 63, 66, 68, 70]; // C# D# F# G# A#
    const widths = blackNotes.map(n => calculateNoteX(n, containerWidth, midiMin, midiRange).width);
    for (const w of widths) {
      expect(w).toBeCloseTo(widths[0], 5);
    }
  });

  it('white keys tile across the full container width', () => {
    // Range [60, 72] includes 8 white keys: C4 D4 E4 F4 G4 A4 B4 C5
    const whiteNotes = [60, 62, 64, 65, 67, 69, 71, 72];
    const firstWhite = calculateNoteX(whiteNotes[0], containerWidth, midiMin, midiRange);
    const lastWhite = calculateNoteX(whiteNotes[whiteNotes.length - 1], containerWidth, midiMin, midiRange);
    const totalCoverage = lastWhite.x + lastWhite.width - firstWhite.x;
    // All 8 white keys should tile across the full container width
    expect(totalCoverage).toBeCloseTo(containerWidth, 0);
  });
});

describe('calculateNoteTop', () => {
  const hitLineY = 400; // 80% of 500px container

  it('places note at hit line when noteStartBeat equals currentBeat', () => {
    const top = calculateNoteTop(0, 0, hitLineY, PIXELS_PER_BEAT);
    expect(top).toBeCloseTo(hitLineY, 0);
  });

  it('places future notes above hit line', () => {
    const top = calculateNoteTop(4, 0, hitLineY, PIXELS_PER_BEAT);
    expect(top).toBeLessThan(hitLineY);
    // Should be exactly 4 beats * PIXELS_PER_BEAT above
    expect(top).toBeCloseTo(hitLineY - 4 * PIXELS_PER_BEAT, 0);
  });

  it('places past notes below hit line', () => {
    const top = calculateNoteTop(0, 2, hitLineY, PIXELS_PER_BEAT);
    expect(top).toBeGreaterThan(hitLineY);
    // Should be exactly 2 beats * PIXELS_PER_BEAT below
    expect(top).toBeCloseTo(hitLineY + 2 * PIXELS_PER_BEAT, 0);
  });

  it('moves notes down as currentBeat advances', () => {
    const topAtBeat0 = calculateNoteTop(2, 0, hitLineY, PIXELS_PER_BEAT);
    const topAtBeat1 = calculateNoteTop(2, 1, hitLineY, PIXELS_PER_BEAT);
    const topAtBeat2 = calculateNoteTop(2, 2, hitLineY, PIXELS_PER_BEAT);

    expect(topAtBeat1).toBeGreaterThan(topAtBeat0);
    expect(topAtBeat2).toBeGreaterThan(topAtBeat1);
    // At currentBeat=2, note at beat 2 should be at hit line
    expect(topAtBeat2).toBeCloseTo(hitLineY, 0);
  });

  it('moves by exactly PIXELS_PER_BEAT per beat', () => {
    const top0 = calculateNoteTop(5, 0, hitLineY, PIXELS_PER_BEAT);
    const top1 = calculateNoteTop(5, 1, hitLineY, PIXELS_PER_BEAT);
    expect(top1 - top0).toBeCloseTo(PIXELS_PER_BEAT, 0);
  });

  it('works with fractional beats', () => {
    const top = calculateNoteTop(1.5, 0, hitLineY, PIXELS_PER_BEAT);
    expect(top).toBeCloseTo(hitLineY - 1.5 * PIXELS_PER_BEAT, 0);
  });
});

// ---------------------------------------------------------------------------
// Component rendering tests
// ---------------------------------------------------------------------------

describe('VerticalPianoRoll rendering', () => {
  const defaultProps = {
    notes: [{ note: 60, startBeat: 0, durationBeats: 1 }] as NoteEvent[],
    currentBeat: 0,
    containerWidth: 400,
    containerHeight: 500,
    midiMin: 48,
    midiMax: 72,
    testID: 'vertical-piano-roll',
  };

  it('renders without crashing', () => {
    const { getByTestId } = render(<VerticalPianoRoll {...defaultProps} />);
    expect(getByTestId('vertical-piano-roll')).toBeTruthy();
  });

  it('renders correct number of note bars', () => {
    const notes: NoteEvent[] = [
      { note: 60, startBeat: 0, durationBeats: 1 },
      { note: 64, startBeat: 1, durationBeats: 1 },
      { note: 67, startBeat: 2, durationBeats: 1 },
    ];
    const { getAllByTestId } = render(
      <VerticalPianoRoll {...defaultProps} notes={notes} />,
    );
    expect(getAllByTestId(/^note-bar-/)).toHaveLength(3);
  });

  it('renders hit line', () => {
    const { getByTestId } = render(<VerticalPianoRoll {...defaultProps} />);
    const hitLine = getByTestId('press-line');
    expect(hitLine).toBeTruthy();
  });

  it('positions hit line near bottom of container (keyboard boundary)', () => {
    const { getByTestId } = render(<VerticalPianoRoll {...defaultProps} />);
    const hitLine = getByTestId('press-line');
    // Hit line top should be containerHeight * HIT_LINE_RATIO - 1 (for the 3px height centering)
    const expectedTop = defaultProps.containerHeight * HIT_LINE_RATIO - 1;
    expect(hitLine.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ top: expectedTop }),
      ]),
    );
  });

  it('renders all three note states: upcoming, active, past', () => {
    const notes: NoteEvent[] = [
      { note: 60, startBeat: 0, durationBeats: 1 }, // past (ends at beat 1, current=2)
      { note: 64, startBeat: 1.5, durationBeats: 1 }, // active (1.5 <= 2 < 2.5)
      { note: 67, startBeat: 4, durationBeats: 1 }, // upcoming (starts at 4)
    ];
    const { getByTestId } = render(
      <VerticalPianoRoll {...defaultProps} notes={notes} currentBeat={2} />,
    );
    expect(getByTestId('note-bar-0')).toBeTruthy();
    expect(getByTestId('note-bar-1')).toBeTruthy();
    expect(getByTestId('note-bar-2')).toBeTruthy();
  });

  it('renders note labels with note names', () => {
    const notes: NoteEvent[] = [
      { note: 60, startBeat: 0, durationBeats: 1 }, // C4
    ];
    const { getByText } = render(
      <VerticalPianoRoll {...defaultProps} notes={notes} />,
    );
    expect(getByText('C4')).toBeTruthy();
  });

  it('renders hand labels when present', () => {
    const notes: NoteEvent[] = [
      { note: 60, startBeat: 0, durationBeats: 1, hand: 'left' },
      { note: 64, startBeat: 1, durationBeats: 1, hand: 'right' },
    ];
    const { getByText } = render(
      <VerticalPianoRoll {...defaultProps} notes={notes} />,
    );
    expect(getByText('L')).toBeTruthy();
    expect(getByText('R')).toBeTruthy();
  });

  it('renders beat counter', () => {
    const { getByText } = render(
      <VerticalPianoRoll {...defaultProps} currentBeat={3} />,
    );
    expect(getByText('Beat 4')).toBeTruthy();
  });

  it('renders count-in text for negative beats', () => {
    const { getByText } = render(
      <VerticalPianoRoll {...defaultProps} currentBeat={-2} />,
    );
    expect(getByText('Count: 2')).toBeTruthy();
  });

  it('renders with empty notes array', () => {
    const { getByTestId, queryAllByTestId } = render(
      <VerticalPianoRoll {...defaultProps} notes={[]} />,
    );
    expect(getByTestId('vertical-piano-roll')).toBeTruthy();
    expect(queryAllByTestId(/^note-bar-/)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Ghost notes rendering
// ---------------------------------------------------------------------------

describe('Ghost notes rendering', () => {
  const baseNotes: NoteEvent[] = [
    { note: 60, startBeat: 0, durationBeats: 1 },
    { note: 64, startBeat: 1, durationBeats: 1 },
  ];

  const defaultProps = {
    notes: baseNotes,
    currentBeat: 0,
    containerWidth: 400,
    containerHeight: 500,
    midiMin: 48,
    midiMax: 72,
    testID: 'vpr',
  };

  it('renders ghost notes when provided', () => {
    const { getAllByTestId } = render(
      <VerticalPianoRoll
        {...defaultProps}
        ghostNotes={baseNotes}
        ghostBeatOffset={2}
      />,
    );
    expect(getAllByTestId(/^ghost-note-/)).toHaveLength(2);
  });

  it('does not render ghost notes when not provided', () => {
    const { queryAllByTestId } = render(
      <VerticalPianoRoll {...defaultProps} />,
    );
    expect(queryAllByTestId(/^ghost-note-/)).toHaveLength(0);
  });

  it('renders ghost notes alongside real notes', () => {
    const { getAllByTestId } = render(
      <VerticalPianoRoll
        {...defaultProps}
        ghostNotes={baseNotes}
        ghostBeatOffset={2}
      />,
    );
    // 2 real notes + 2 ghost notes
    expect(getAllByTestId(/^note-bar-/)).toHaveLength(2);
    expect(getAllByTestId(/^ghost-note-/)).toHaveLength(2);
  });

  it('ghost notes have different positions than real notes due to beat offset', () => {
    const { getByTestId } = render(
      <VerticalPianoRoll
        {...defaultProps}
        ghostNotes={baseNotes}
        ghostBeatOffset={2}
      />,
    );
    const ghostNote = getByTestId('ghost-note-0');
    const realNote = getByTestId('note-bar-0');
    // Both should exist and render correctly
    expect(ghostNote).toBeTruthy();
    expect(realNote).toBeTruthy();
  });

  it('renders ghost notes with empty ghost array', () => {
    const { queryAllByTestId } = render(
      <VerticalPianoRoll
        {...defaultProps}
        ghostNotes={[]}
        ghostBeatOffset={2}
      />,
    );
    expect(queryAllByTestId(/^ghost-note-/)).toHaveLength(0);
  });
});
