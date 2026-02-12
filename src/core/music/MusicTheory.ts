/**
 * Music theory utilities
 * Pure TypeScript - no React imports
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const INTERVAL_NAMES: Record<number, string> = {
  0: 'unison',
  1: 'minor second',
  2: 'major second',
  3: 'minor third',
  4: 'major third',
  5: 'perfect fourth',
  6: 'tritone',
  7: 'perfect fifth',
  8: 'minor sixth',
  9: 'major sixth',
  10: 'minor seventh',
  11: 'major seventh',
  12: 'octave',
};

/**
 * Get note name from MIDI note number
 * e.g., 60 = "C4", 61 = "C#4"
 */
export function getMidiNoteName(midiNote: number): string {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Alias for getMidiNoteName
 */
export function midiToNoteName(midiNote: number): string {
  return getMidiNoteName(midiNote);
}

/**
 * Get MIDI note number from note name
 * e.g., "C4" = 60, "C#4" = 61
 */
export function getNoteFromName(noteName: string): number {
  const match = noteName.match(/([A-G])(#|b)?(\d+)/);
  if (!match) throw new Error(`Invalid note name: ${noteName}`);

  const [, note, accidental, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);

  // Get base note index
  const baseIndex = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].indexOf(note);
  if (baseIndex === -1) throw new Error(`Unknown note: ${note}`);

  // Adjust for accidentals and find in NOTE_NAMES
  let noteIndex = -1;
  if (!accidental) {
    // Natural notes
    const semitones = [0, 2, 4, 5, 7, 9, 11]; // Semitone positions
    noteIndex = semitones[baseIndex];
  } else if (accidental === '#') {
    const semitones = [1, 3, 6, 6, 8, 10, 0]; // Sharp positions (note: E# is F, B# is C)
    noteIndex = semitones[baseIndex];
  } else if (accidental === 'b') {
    const semitones = [11, 1, 3, 4, 6, 8, 10]; // Flat positions (note: Cb is B, Fb is E)
    noteIndex = semitones[baseIndex];
  }

  return (octave + 1) * 12 + noteIndex;
}

/**
 * Alias for getNoteFromName
 */
export function noteNameToMidi(noteName: string): number {
  return getNoteFromName(noteName);
}

/**
 * Convert beats to milliseconds based on tempo
 * @param beats Number of beats
 * @param tempo Tempo in BPM (beats per minute)
 * @returns Duration in milliseconds
 */
export function beatToMs(beats: number, tempo: number): number {
  return (beats / tempo) * 60 * 1000;
}

/**
 * Convert milliseconds to beats based on tempo
 * @param ms Duration in milliseconds
 * @param tempo Tempo in BPM (beats per minute)
 * @returns Duration in beats
 */
export function msToBeat(ms: number, tempo: number): number {
  return (ms * tempo) / (60 * 1000);
}

/**
 * Get frequency in Hz from MIDI note
 * A4 (MIDI 69) = 440 Hz
 */
export function getFrequencyFromMidi(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Alias for getFrequencyFromMidi
 */
export function midiToFrequency(midiNote: number): number {
  return getFrequencyFromMidi(midiNote);
}

/**
 * Get MIDI note from frequency
 */
export function getMidiFromFrequency(frequency: number): number {
  return Math.round(69 + 12 * Math.log2(frequency / 440));
}

/**
 * Alias for getMidiFromFrequency
 */
export function frequencyToMidi(frequency: number): number {
  return getMidiFromFrequency(frequency);
}

/**
 * Get the interval in semitones between two notes
 */
export function getInterval(midiNote1: number, midiNote2: number): number {
  return midiNote2 - midiNote1;
}

/**
 * Get the name of an interval in semitones
 */
export function intervalName(semitones: number): string {
  const abs = Math.abs(semitones);
  // Check for octaves (12, 24, 36, etc.)
  if (abs % 12 === 0 && abs !== 0) {
    return 'octave';
  }
  const normalized = abs % 12;
  return INTERVAL_NAMES[normalized] || `${normalized} semitones`;
}

/**
 * Check if a MIDI note is in a given key
 * keySignature: "C", "G", "F", etc.
 */
export function isNoteInKey(midiNote: number, keySignature: string): boolean {
  const noteIndex = midiNote % 12;

  const majorScales: Record<string, number[]> = {
    C: [0, 2, 4, 5, 7, 9, 11],
    G: [7, 9, 11, 0, 2, 4, 6],
    D: [2, 4, 6, 7, 9, 11, 1],
    A: [9, 11, 1, 2, 4, 6, 8],
    E: [4, 6, 8, 9, 11, 1, 3],
    B: [11, 1, 3, 4, 6, 8, 10],
    F: [5, 7, 9, 10, 0, 2, 4],
    Bb: [10, 0, 2, 3, 5, 7, 9],
    Eb: [3, 5, 7, 8, 10, 0, 2],
    Ab: [8, 10, 0, 1, 3, 5, 7],
    Db: [1, 3, 5, 6, 8, 10, 0],
    Gb: [6, 8, 10, 11, 1, 3, 5],
  };

  const scale = majorScales[keySignature];
  if (!scale) throw new Error(`Unknown key signature: ${keySignature}`);

  return scale.includes(noteIndex);
}

/**
 * Get all notes in a key
 */
export function getNotesInKey(keySignature: string, startOctave: number, endOctave: number): number[] {
  const majorScales: Record<string, number[]> = {
    C: [0, 2, 4, 5, 7, 9, 11],
    G: [7, 9, 11, 0, 2, 4, 6],
    D: [2, 4, 6, 7, 9, 11, 1],
    A: [9, 11, 1, 2, 4, 6, 8],
    E: [4, 6, 8, 9, 11, 1, 3],
    B: [11, 1, 3, 4, 6, 8, 10],
    F: [5, 7, 9, 10, 0, 2, 4],
    Bb: [10, 0, 2, 3, 5, 7, 9],
    Eb: [3, 5, 7, 8, 10, 0, 2],
    Ab: [8, 10, 0, 1, 3, 5, 7],
    Db: [1, 3, 5, 6, 8, 10, 0],
    Gb: [6, 8, 10, 11, 1, 3, 5],
  };

  const scale = majorScales[keySignature];
  if (!scale) throw new Error(`Unknown key signature: ${keySignature}`);

  const notes: number[] = [];
  for (let octave = startOctave; octave <= endOctave; octave++) {
    for (const noteIndex of scale) {
      notes.push(octave * 12 + noteIndex);
    }
  }

  return notes;
}

/**
 * Check if a note is in a specific scale
 */
export function isNoteInScale(midiNote: number, rootPitch: number, scaleType: 'major' | 'minor' | 'pentatonic'): boolean {
  const noteIndex = midiNote % 12;
  const rootIndex = rootPitch % 12;

  // Scale intervals (in semitones from root)
  const scales: Record<string, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
  };

  const scale = scales[scaleType] || scales['major'];
  const relativeIndex = (noteIndex - rootIndex + 12) % 12;

  return scale.includes(relativeIndex);
}

/**
 * Get all notes in a specific scale
 */
export function getScaleNotes(rootPitch: number, scaleType: 'major' | 'minor' | 'pentatonic', minMidi: number, maxMidi: number): number[] {
  const notes: number[] = [];

  const scales: Record<string, number[]> = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
  };

  const scale = scales[scaleType] || scales['major'];
  const rootIndex = rootPitch % 12;

  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const noteIndex = midi % 12;
    const relativeIndex = (noteIndex - rootIndex + 12) % 12;
    if (scale.includes(relativeIndex)) {
      notes.push(midi);
    }
  }

  return notes;
}

/**
 * Calculate semitones between two notes
 */
export function getSemitones(midiNote1: number, midiNote2: number): number {
  return Math.abs(midiNote2 - midiNote1);
}

/**
 * Get the pitch class (0-11) of a MIDI note
 */
export function getPitchClass(midiNote: number): number {
  return midiNote % 12;
}

/**
 * Get the octave of a MIDI note
 */
export function getOctave(midiNote: number): number {
  return Math.floor(midiNote / 12) - 1;
}

/**
 * Check if two MIDI notes are enharmonically equivalent
 */
export function areEnharmonic(midiNote1: number, midiNote2: number): boolean {
  return getPitchClass(midiNote1) === getPitchClass(midiNote2);
}

/**
 * Check if a MIDI note is within valid piano range
 */
export function isValidMidiNote(midiNote: number): boolean {
  return midiNote >= 21 && midiNote <= 108; // A0 to C8
}

/**
 * Get a note and its enharmonic equivalent
 */
export function getNoteWithEnharmonic(midiNote: number): { note: string; enharmonic: string } {
  const pitchClass = getPitchClass(midiNote);
  const octave = getOctave(midiNote);

  const sharp = NOTE_NAMES[pitchClass];
  const flat = FLAT_NAMES[pitchClass];

  // Use sharp as primary, flat as enharmonic
  const primary = sharp !== flat ? sharp : NOTE_NAMES[pitchClass];
  const secondary = sharp !== flat ? flat : FLAT_NAMES[pitchClass];

  return {
    note: `${primary}${octave}`,
    enharmonic: `${secondary}${octave}`,
  };
}
