/**
 * ABC Notation Parser
 *
 * Converts ABC notation strings into NoteEvent[] arrays compatible with the
 * existing ExercisePlayer pipeline. Uses abcjs.parseOnly() for tokenisation,
 * then walks the tune object to produce MIDI note events.
 *
 * Pure TypeScript — no React imports.
 */

import abcjs from 'abcjs';
import type { NoteEvent } from '@/core/exercises/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ABCParseResult {
  notes: NoteEvent[];
  tempo: number;
  timeSignature: [number, number];
  keySignature: string;
  title: string;
}

export type ABCParseOutput = ABCParseResult | { error: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** C major scale semitone offsets from C for each diatonic step. */
const DIATONIC_SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

/** Maps note letter (lowercase) to diatonic index 0-6. */
const LETTER_TO_INDEX: Record<string, number> = {
  c: 0,
  d: 1,
  e: 2,
  f: 3,
  g: 4,
  a: 5,
  b: 6,
};

// ---------------------------------------------------------------------------
// Helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Convert an abcjs pitch value + accidental to a MIDI note number.
 *
 * abcjs pitch system: middle C (C4) = 0, D4 = 1, … B4 = 6, C5 = 7, etc.
 * Negative values go below middle C.
 *
 * @param pitch    abcjs pitch value (diatonic steps from middle C)
 * @param accidental  'sharp' | 'flat' | 'natural' | undefined
 * @param keyAccidentals  Map of diatonic index → semitone shift from key signature
 */
export function abcPitchToMidi(
  pitch: number,
  accidental: string | undefined,
  keyAccidentals: Map<number, number>,
): number {
  // Split pitch into octave offset and diatonic step within octave
  const octaveOffset = Math.floor(pitch / 7);
  const diatonicStep = ((pitch % 7) + 7) % 7; // always 0-6

  // Base MIDI: C4=60, each octave = 12 semitones
  let midi = 60 + octaveOffset * 12 + DIATONIC_SEMITONES[diatonicStep];

  // Apply key signature accidentals (unless overridden by explicit accidental)
  if (accidental === 'sharp') {
    midi += 1;
  } else if (accidental === 'flat') {
    midi -= 1;
  } else if (accidental === 'natural') {
    // Explicit natural — no key sig applied
  } else if (keyAccidentals.has(diatonicStep)) {
    midi += keyAccidentals.get(diatonicStep)!;
  }

  return midi;
}

/**
 * Convert abcjs duration (fraction of a whole note) to beats.
 * A quarter note in 4/4 has abcjs duration 0.25 → 1 beat.
 *
 * @param abcDuration  abcjs duration value (fraction of whole note)
 * @param beatValue    denominator of time signature (4 = quarter note gets 1 beat)
 */
export function abcDurationToBeats(abcDuration: number, beatValue: number): number {
  // abcjs duration is fraction of whole note
  // A whole note = beatValue beats (e.g. 4 beats in 4/4)
  return abcDuration * beatValue;
}

// ---------------------------------------------------------------------------
// Key signature parsing
// ---------------------------------------------------------------------------

/**
 * Build a map of diatonic index → semitone adjustment from abcjs key accidentals.
 */
function buildKeyAccidentals(
  keyAccidentals: Array<{ acc: string; note: string }>,
): Map<number, number> {
  const map = new Map<number, number>();
  for (const ka of keyAccidentals) {
    const idx = LETTER_TO_INDEX[ka.note.toLowerCase()];
    if (idx === undefined) continue;
    if (ka.acc === 'sharp') map.set(idx, 1);
    else if (ka.acc === 'flat') map.set(idx, -1);
    else if (ka.acc === 'dblsharp') map.set(idx, 2);
    else if (ka.acc === 'dblflat') map.set(idx, -2);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseABC(abcString: string): ABCParseOutput {
  if (!abcString || abcString.trim().length === 0) {
    return { error: 'Empty ABC string' };
  }

  let tunes: ReturnType<typeof abcjs.parseOnly>;
  try {
    tunes = abcjs.parseOnly(abcString);
  } catch {
    return { error: 'Failed to parse ABC notation' };
  }

  if (!tunes || tunes.length === 0) {
    return { error: 'No tunes found in ABC notation' };
  }

  const tune = tunes[0];

  if (!tune.lines || tune.lines.length === 0) {
    return { error: 'No music lines in ABC notation' };
  }

  // --- Extract metadata -----------------------------------------------

  const title = tune.metaText?.title ?? '';

  // Tempo: from Q: header, default 120
  const tempo = tune.metaText?.tempo?.bpm ?? 120;

  // Time signature: from staff.meter
  let timeSignature: [number, number] = [4, 4];
  const firstStaff = tune.lines[0]?.staff?.[0];
  if (firstStaff?.meter?.value?.[0]) {
    const meterVal = firstStaff.meter.value[0];
    const num = parseInt(String(meterVal.num), 10);
    const den = parseInt(String(meterVal.den), 10);
    if (!isNaN(num) && !isNaN(den) && num > 0 && den > 0) {
      timeSignature = [num, den];
    }
  }

  // Key signature
  const keyInfo = firstStaff?.key;
  const keySignature = keyInfo?.root ?? 'C';
  const keyAccidentals = buildKeyAccidentals(keyInfo?.accidentals ?? []);

  // Beat value (denominator of time signature) determines beat conversion
  const beatValue = timeSignature[1];

  // --- Walk voice elements --------------------------------------------

  const notes: NoteEvent[] = [];
  let currentBeat = 0;

  // Track active ties: MIDI note number → index in notes[] of the tied note
  const activeTies = new Map<number, number>();

  for (const line of tune.lines) {
    if (!line.staff) continue;
    for (const staff of line.staff) {
      if (!staff.voices) continue;
      for (const voice of staff.voices) {
        for (const element of voice) {
          if (element.el_type !== 'note') continue;
          if (!element.pitches || element.pitches.length === 0) continue;

          const beatsForElement = abcDurationToBeats(element.duration, beatValue);

          for (const p of element.pitches) {
            const midi = abcPitchToMidi(p.pitch, p.accidental, keyAccidentals);

            // Handle tie continuation: extend the previous note's duration
            if (p.endTie && activeTies.has(midi)) {
              const tiedIdx = activeTies.get(midi)!;
              notes[tiedIdx].durationBeats += beatsForElement;
              // If this note also starts a new tie, keep tracking
              if (p.startTie) {
                activeTies.set(midi, tiedIdx);
              } else {
                activeTies.delete(midi);
              }
              continue;
            }

            // New note
            const noteEvent: NoteEvent = {
              note: midi,
              startBeat: currentBeat,
              durationBeats: beatsForElement,
            };
            notes.push(noteEvent);

            // Track if this note starts a tie
            if (p.startTie) {
              activeTies.set(midi, notes.length - 1);
            }
          }

          currentBeat += beatsForElement;
        }
      }
    }
  }

  if (notes.length === 0) {
    return { error: 'No notes found in ABC notation' };
  }

  return {
    notes,
    tempo,
    timeSignature,
    keySignature,
    title,
  };
}
