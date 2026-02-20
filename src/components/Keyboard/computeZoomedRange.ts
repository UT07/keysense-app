/**
 * Smart Zoomed Keyboard Range
 *
 * Computes a 2-octave (default) keyboard range centered on active MIDI notes,
 * with sticky behavior to prevent jittery keyboard scrolling during play.
 *
 * Used by ExercisePlayer to dynamically zoom the keyboard to the relevant
 * octaves as notes scroll through the VerticalPianoRoll.
 */

/** Keyboard range defined by start note and number of octaves */
export interface KeyboardRange {
  startNote: number;
  octaveCount: number;
}

/** Minimum MIDI note (A0 on a standard piano) */
const MIDI_FLOOR = 21;

/**
 * Compute a keyboard range centered on the given MIDI notes.
 * Snaps startNote to nearest C for clean octave boundaries.
 *
 * @param activeNotes - Array of MIDI note numbers currently in the active window
 * @param maxOctaves - Number of octaves to show (default 2)
 * @returns KeyboardRange with startNote snapped to C and octaveCount
 */
export function computeZoomedRange(
  activeNotes: number[],
  maxOctaves: number = 2,
): KeyboardRange {
  if (activeNotes.length === 0) {
    return { startNote: 48, octaveCount: maxOctaves };
  }

  const minNote = Math.min(...activeNotes);
  const maxNote = Math.max(...activeNotes);
  const center = (minNote + maxNote) / 2;
  let octaves = maxOctaves;
  let totalSemitones = octaves * 12;

  // If the note span exceeds the available range, widen to fit.
  // This prevents the oscillation bug where shift-up for maxNote and
  // shift-down for minNote fight each other endlessly.
  const span = maxNote - minNote;
  if (span >= totalSemitones) {
    octaves = Math.ceil((span + 1) / 12);
    totalSemitones = octaves * 12;
  }

  const halfSpan = totalSemitones / 2;

  // Start by centering the range on the midpoint of active notes
  let startNote = Math.round(center - halfSpan);

  // Snap down to nearest C (startNote % 12 === 0)
  startNote = Math.floor(startNote / 12) * 12;

  // Ensure all active notes fit within the range
  // If maxNote exceeds the range end, shift startNote up
  if (startNote + totalSemitones <= maxNote) {
    startNote = Math.ceil((maxNote + 1 - totalSemitones) / 12) * 12;
  }

  // If minNote is below startNote after adjustment, shift down
  if (startNote > minNote) {
    startNote = Math.floor(minNote / 12) * 12;
  }

  // Floor at MIDI 21 (A0)
  if (startNote < MIDI_FLOOR) {
    startNote = MIDI_FLOOR;
    // If we're floored at 21 and can't snap to C, snap up to C1 (24)
    // unless that would exclude notes below 24
    if (startNote % 12 !== 0 && minNote >= 24) {
      startNote = 24;
    }
  }

  return { startNote, octaveCount: octaves };
}

/**
 * Sticky range: only shift the keyboard when a note is >= stickyThreshold
 * semitones outside the current visible range. Prevents jittery scrolling
 * during normal play where notes hover near range boundaries.
 *
 * @param activeNotes - Array of MIDI note numbers currently in the active window
 * @param currentRange - The current keyboard range being displayed
 * @param stickyThreshold - Semitones outside range before triggering a shift (default 3)
 * @returns KeyboardRange -- either currentRange unchanged or a new computed range
 */
export function computeStickyRange(
  activeNotes: number[],
  currentRange: KeyboardRange,
  stickyThreshold: number = 3,
): KeyboardRange {
  if (activeNotes.length === 0) {
    return currentRange;
  }

  const rangeMin = currentRange.startNote;
  const rangeMax = currentRange.startNote + currentRange.octaveCount * 12 - 1;

  const minNote = Math.min(...activeNotes);
  const maxNote = Math.max(...activeNotes);

  const belowBy = rangeMin - minNote;
  const aboveBy = maxNote - rangeMax;

  // Only shift if a note is outside the range by >= threshold semitones
  if (belowBy >= stickyThreshold || aboveBy >= stickyThreshold) {
    return computeZoomedRange(activeNotes, currentRange.octaveCount);
  }

  return currentRange;
}
