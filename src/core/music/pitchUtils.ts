/**
 * Pitch detection utilities — frequency ↔ MIDI conversion
 * Pure TypeScript, no React imports.
 *
 * Reference: A4 = 440 Hz = MIDI note 69
 * Formula: midi = 12 * log2(freq / 440) + 69
 */

/** A4 reference frequency in Hz */
const A4_FREQ = 440;

/** A4 MIDI note number */
const A4_MIDI = 69;

/**
 * Convert frequency (Hz) to MIDI note number (continuous, not rounded).
 * Returns NaN for non-positive frequencies.
 */
export function frequencyToMidi(frequency: number): number {
  if (frequency <= 0) return NaN;
  return 12 * Math.log2(frequency / A4_FREQ) + A4_MIDI;
}

/**
 * Convert frequency (Hz) to the nearest integer MIDI note number.
 * Returns null for non-positive or out-of-range frequencies.
 */
export function frequencyToNearestMidi(frequency: number): number | null {
  const midi = frequencyToMidi(frequency);
  if (isNaN(midi)) return null;
  const rounded = Math.round(midi);
  // Piano range: 21 (A0) to 108 (C8)
  if (rounded < 21 || rounded > 108) return null;
  return rounded;
}

/**
 * Convert MIDI note number to frequency (Hz).
 */
export function midiToFrequency(midiNote: number): number {
  return A4_FREQ * Math.pow(2, (midiNote - A4_MIDI) / 12);
}

/**
 * Get the cents deviation from the nearest MIDI note.
 * Positive = sharp, negative = flat.
 * 100 cents = 1 semitone.
 */
export function frequencyCentsOffset(frequency: number): number {
  const midi = frequencyToMidi(frequency);
  if (isNaN(midi)) return 0;
  return (midi - Math.round(midi)) * 100;
}

/**
 * Check if a frequency is within a reasonable piano range.
 * A0 (27.5 Hz) to C8 (4186 Hz).
 */
export function isInPianoRange(frequency: number): boolean {
  return frequency >= 27.5 && frequency <= 4186;
}
