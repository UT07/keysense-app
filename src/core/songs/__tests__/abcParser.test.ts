/**
 * ABC Parser Tests
 *
 * Validates conversion of ABC notation → NoteEvent[] arrays.
 */

import { parseABC, abcPitchToMidi, abcDurationToBeats } from '../abcParser';
import type { ABCParseResult } from '../abcParser';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function expectSuccess(result: ReturnType<typeof parseABC>): ABCParseResult {
  expect(result).not.toHaveProperty('error');
  return result as ABCParseResult;
}

function expectError(result: ReturnType<typeof parseABC>): string {
  expect(result).toHaveProperty('error');
  return (result as { error: string }).error;
}

// ---------------------------------------------------------------------------
// abcPitchToMidi
// ---------------------------------------------------------------------------

describe('abcPitchToMidi', () => {
  const noKeyAcc = new Map<number, number>();

  it('converts middle C (pitch 0) to MIDI 60', () => {
    expect(abcPitchToMidi(0, undefined, noKeyAcc)).toBe(60);
  });

  it('converts D4 (pitch 1) to MIDI 62', () => {
    expect(abcPitchToMidi(1, undefined, noKeyAcc)).toBe(62);
  });

  it('converts B4 (pitch 6) to MIDI 71', () => {
    expect(abcPitchToMidi(6, undefined, noKeyAcc)).toBe(71);
  });

  it('converts C5 (pitch 7) to MIDI 72', () => {
    expect(abcPitchToMidi(7, undefined, noKeyAcc)).toBe(72);
  });

  it('converts C3 (pitch -7) to MIDI 48', () => {
    expect(abcPitchToMidi(-7, undefined, noKeyAcc)).toBe(48);
  });

  it('applies sharp accidental', () => {
    expect(abcPitchToMidi(0, 'sharp', noKeyAcc)).toBe(61); // C#4
  });

  it('applies flat accidental', () => {
    expect(abcPitchToMidi(2, 'flat', noKeyAcc)).toBe(63); // Eb4
  });

  it('applies natural override (ignores key sig)', () => {
    const gMajor = new Map([[3, 1]]); // F# in key
    expect(abcPitchToMidi(3, 'natural', gMajor)).toBe(65); // F natural
  });

  it('applies key signature accidentals when no explicit accidental', () => {
    const gMajor = new Map([[3, 1]]); // F#
    expect(abcPitchToMidi(3, undefined, gMajor)).toBe(66); // F#4
  });
});

// ---------------------------------------------------------------------------
// abcDurationToBeats
// ---------------------------------------------------------------------------

describe('abcDurationToBeats', () => {
  it('converts quarter note (0.25) to 1 beat in 4/4', () => {
    expect(abcDurationToBeats(0.25, 4)).toBe(1);
  });

  it('converts half note (0.5) to 2 beats in 4/4', () => {
    expect(abcDurationToBeats(0.5, 4)).toBe(2);
  });

  it('converts eighth note (0.125) to 0.5 beats in 4/4', () => {
    expect(abcDurationToBeats(0.125, 4)).toBe(0.5);
  });

  it('converts quarter note to 1 beat in 3/4', () => {
    expect(abcDurationToBeats(0.25, 4)).toBe(1);
  });

  it('converts dotted quarter (0.375) to 1.5 beats in 4/4', () => {
    expect(abcDurationToBeats(0.375, 4)).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// parseABC — successful parsing
// ---------------------------------------------------------------------------

describe('parseABC', () => {
  it('parses a 4-bar C major melody correctly', () => {
    const abc = 'X:1\nT:Simple Melody\nM:4/4\nL:1/4\nK:C\nCDEF|GABc|';
    const result = expectSuccess(parseABC(abc));

    expect(result.title).toBe('Simple Melody');
    expect(result.timeSignature).toEqual([4, 4]);
    expect(result.keySignature).toBe('C');
    expect(result.notes).toHaveLength(8);

    // Check MIDI values: C4=60, D4=62, E4=64, F4=65, G4=67, A4=69, B4=71, C5=72
    expect(result.notes.map((n) => n.note)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('extracts 3/4 time signature', () => {
    const abc = 'X:1\nT:Waltz\nM:3/4\nL:1/4\nK:C\nCDE|';
    const result = expectSuccess(parseABC(abc));

    expect(result.timeSignature).toEqual([3, 4]);
    expect(result.notes).toHaveLength(3);
  });

  it('applies G major key signature (F#)', () => {
    const abc = 'X:1\nT:G Major\nM:4/4\nL:1/4\nK:G\nGABc|deFG|';
    const result = expectSuccess(parseABC(abc));

    // F notes should be F#: MIDI 66 (F#4) and 78 (F#5)
    // G4=67, A4=69, B4=71, C5=72, D5=74, E5=76, F#4=66, G4=67
    const midiValues = result.notes.map((n) => n.note);
    // "e" in the second bar is E5=76 (no accidental applies to E in G major)
    // "F" in the second bar is F4 but with G major key sig → F#4=66
    expect(midiValues[5]).toBe(76); // E5
    expect(midiValues[6]).toBe(66); // F#4 (key signature applied)
  });

  it('handles octave modifiers correctly', () => {
    const abc = "X:1\nT:Octaves\nM:4/4\nL:1/4\nK:C\nC,D,E,F,|c'd'e'f'|";
    const result = expectSuccess(parseABC(abc));

    // C, = C3 (MIDI 48), D, = D3 (MIDI 50), etc.
    expect(result.notes[0].note).toBe(48); // C3
    expect(result.notes[1].note).toBe(50); // D3
    // c' = C6 (MIDI 84), d' = D6 (MIDI 86)
    expect(result.notes[4].note).toBe(84); // C6
    expect(result.notes[5].note).toBe(86); // D6
  });

  it('handles explicit accidentals (^=sharp, _=flat, ==natural)', () => {
    const abc = 'X:1\nT:Accidentals\nM:4/4\nL:1/4\nK:C\n^C_EGA|';
    const result = expectSuccess(parseABC(abc));

    expect(result.notes[0].note).toBe(61); // C#4
    expect(result.notes[1].note).toBe(63); // Eb4
    expect(result.notes[2].note).toBe(67); // G4 (no accidental)
    expect(result.notes[3].note).toBe(69); // A4 (no accidental)
  });

  it('handles note durations (C2=half, C/2=eighth)', () => {
    const abc = 'X:1\nT:Durations\nM:4/4\nL:1/4\nK:C\nC2E/2F/2G|';
    const result = expectSuccess(parseABC(abc));

    expect(result.notes[0].durationBeats).toBe(2); // half note
    expect(result.notes[1].durationBeats).toBe(0.5); // eighth note
    expect(result.notes[2].durationBeats).toBe(0.5); // eighth note
    expect(result.notes[3].durationBeats).toBe(1); // quarter note
  });

  it('handles ties (C-C → combined duration)', () => {
    const abc = 'X:1\nT:Ties\nM:4/4\nL:1/4\nK:C\nC-C E G|';
    const result = expectSuccess(parseABC(abc));

    // Tied C should become one note with duration 2 beats
    expect(result.notes[0].note).toBe(60);
    expect(result.notes[0].durationBeats).toBe(2);
    // Only 3 note events (tie merged into one)
    expect(result.notes).toHaveLength(3);
  });

  it('handles chords ([CEG] → three simultaneous notes)', () => {
    const abc = 'X:1\nT:Chords\nM:4/4\nL:1/4\nK:C\n[CEG]2|';
    const result = expectSuccess(parseABC(abc));

    expect(result.notes).toHaveLength(3);
    // All three notes at the same startBeat
    expect(result.notes[0].startBeat).toBe(0);
    expect(result.notes[1].startBeat).toBe(0);
    expect(result.notes[2].startBeat).toBe(0);
    // C=60, E=64, G=67
    expect(result.notes.map((n) => n.note)).toEqual([60, 64, 67]);
    // All should be half notes (2 beats)
    expect(result.notes[0].durationBeats).toBe(2);
  });

  it('extracts tempo from Q: header', () => {
    const abc = 'X:1\nT:Fast\nM:4/4\nL:1/4\nQ:1/4=140\nK:C\nCDEF|';
    const result = expectSuccess(parseABC(abc));

    expect(result.tempo).toBe(140);
  });

  it('defaults tempo to 120 when Q: is absent', () => {
    const abc = 'X:1\nT:No Tempo\nM:4/4\nL:1/4\nK:C\nCDEF|';
    const result = expectSuccess(parseABC(abc));

    expect(result.tempo).toBe(120);
  });

  it('beat positions are monotonically non-decreasing', () => {
    const abc = 'X:1\nT:Monotonic\nM:4/4\nL:1/8\nK:C\nCDEFGABc|cBAGFEDC|';
    const result = expectSuccess(parseABC(abc));

    for (let i = 1; i < result.notes.length; i++) {
      expect(result.notes[i].startBeat).toBeGreaterThanOrEqual(
        result.notes[i - 1].startBeat,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// parseABC — error cases
// ---------------------------------------------------------------------------

describe('parseABC — errors', () => {
  it('returns error for empty string', () => {
    const msg = expectError(parseABC(''));
    expect(msg).toContain('Empty');
  });

  it('returns error for whitespace-only string', () => {
    const msg = expectError(parseABC('   \n  '));
    expect(msg).toContain('Empty');
  });

  it('returns error when no notes are present', () => {
    const abc = 'X:1\nT:No Notes\nM:4/4\nK:C\n';
    const msg = expectError(parseABC(abc));
    expect(msg).toContain('No');
  });

  it('returns error for missing K: header (no key = no staff)', () => {
    const abc = 'X:1\nT:Missing Key\nM:4/4\n';
    const result = parseABC(abc);
    expect(result).toHaveProperty('error');
  });
});
