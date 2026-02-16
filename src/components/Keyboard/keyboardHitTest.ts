/**
 * Piano keyboard hit-test logic
 * Maps touch coordinates to MIDI note numbers.
 * Extracted for testability and reuse.
 */

const BLACK_KEY_OFFSETS = [1, 3, 6, 8, 10]; // semitone offsets within an octave

/**
 * Determine if a MIDI note is a black key
 */
export function isBlackKeyNote(midiNote: number): boolean {
  return BLACK_KEY_OFFSETS.includes(midiNote % 12);
}

/**
 * Get white keys in a given MIDI range
 */
export function getWhiteKeysInRange(startNote: number, endNote: number): number[] {
  const keys: number[] = [];
  for (let i = startNote; i <= endNote; i++) {
    if (!isBlackKeyNote(i)) {
      keys.push(i);
    }
  }
  return keys;
}

export interface HitTestConfig {
  startNote: number;
  endNote: number;
  whiteKeys: number[];
  totalWidth: number;
  totalHeight: number;
}

/**
 * Hit-test a touch point against the piano keyboard layout.
 * Returns the MIDI note number at the given (x, y) coordinates, or null if outside bounds.
 *
 * Black keys are checked first when y is in the upper 65% of the keyboard,
 * since they overlap white keys visually.
 */
export function hitTestPianoKey(
  x: number,
  y: number,
  config: HitTestConfig
): number | null {
  const { startNote, endNote, whiteKeys, totalWidth, totalHeight } = config;

  if (x < 0 || x >= totalWidth || y < 0 || y >= totalHeight) {
    return null;
  }

  const whiteKeyCount = whiteKeys.length;
  const whiteKeyWidth = totalWidth / whiteKeyCount;
  const blackKeyHeight = totalHeight * 0.65;

  // Check black keys first if touch is in the upper portion
  if (y < blackKeyHeight) {
    // For each black key, check if the touch falls within its bounds
    for (let midi = startNote; midi <= endNote; midi++) {
      if (!isBlackKeyNote(midi)) continue;

      // Find the white key just below this black key
      const lowerWhiteKey = midi - 1; // black keys are always 1 semitone above a white key
      const whiteKeyIndex = whiteKeys.indexOf(lowerWhiteKey);
      if (whiteKeyIndex < 0) continue;

      // Black key is centered between two white keys, width = 12% of total / whiteKeyCount * totalWidth
      // In the CSS, it's positioned at (whiteKeyIndex + 1) * (100/N) - 6  with width 12%
      const blackKeyWidthPercent = 0.12;
      const blackKeyWidth = blackKeyWidthPercent * totalWidth;
      const blackKeyLeft = (whiteKeyIndex + 1) * whiteKeyWidth - blackKeyWidth / 2;

      if (x >= blackKeyLeft && x < blackKeyLeft + blackKeyWidth) {
        return midi;
      }
    }
  }

  // White key: simple division
  const whiteKeyIndex = Math.min(
    Math.floor(x / whiteKeyWidth),
    whiteKeyCount - 1
  );

  if (whiteKeyIndex >= 0 && whiteKeyIndex < whiteKeys.length) {
    return whiteKeys[whiteKeyIndex];
  }

  return null;
}
