/**
 * pitchUtils tests — frequency ↔ MIDI conversion, cents offset, range checks
 */

import {
  frequencyToMidi,
  frequencyToNearestMidi,
  midiToFrequency,
  frequencyCentsOffset,
  isInPianoRange,
} from '../pitchUtils';

describe('pitchUtils', () => {
  // =========================================================================
  // frequencyToMidi
  // =========================================================================

  describe('frequencyToMidi', () => {
    it('converts A4 (440 Hz) to MIDI 69', () => {
      expect(frequencyToMidi(440)).toBeCloseTo(69, 5);
    });

    it('converts Middle C (261.63 Hz) to MIDI 60', () => {
      expect(frequencyToMidi(261.63)).toBeCloseTo(60, 1);
    });

    it('converts C5 (523.25 Hz) to MIDI 72', () => {
      expect(frequencyToMidi(523.25)).toBeCloseTo(72, 1);
    });

    it('converts A3 (220 Hz) to MIDI 57', () => {
      expect(frequencyToMidi(220)).toBeCloseTo(57, 5);
    });

    it('converts A5 (880 Hz) to MIDI 81', () => {
      expect(frequencyToMidi(880)).toBeCloseTo(81, 5);
    });

    it('returns NaN for 0 Hz', () => {
      expect(frequencyToMidi(0)).toBeNaN();
    });

    it('returns NaN for negative frequency', () => {
      expect(frequencyToMidi(-100)).toBeNaN();
    });
  });

  // =========================================================================
  // frequencyToNearestMidi
  // =========================================================================

  describe('frequencyToNearestMidi', () => {
    it('rounds 440 Hz to MIDI 69', () => {
      expect(frequencyToNearestMidi(440)).toBe(69);
    });

    it('rounds slightly sharp A4 (442 Hz) to MIDI 69', () => {
      expect(frequencyToNearestMidi(442)).toBe(69);
    });

    it('rounds 261 Hz to MIDI 60 (Middle C)', () => {
      expect(frequencyToNearestMidi(261)).toBe(60);
    });

    it('returns null for 0 Hz', () => {
      expect(frequencyToNearestMidi(0)).toBeNull();
    });

    it('returns null for frequency below piano range', () => {
      // MIDI 20 = ~26 Hz (below A0 = 27.5 Hz)
      expect(frequencyToNearestMidi(10)).toBeNull();
    });

    it('returns null for frequency above piano range', () => {
      // MIDI 109+ = above C8
      expect(frequencyToNearestMidi(5000)).toBeNull();
    });

    it('handles A0 (27.5 Hz) = MIDI 21', () => {
      expect(frequencyToNearestMidi(27.5)).toBe(21);
    });

    it('handles C8 (4186 Hz) = MIDI 108', () => {
      expect(frequencyToNearestMidi(4186)).toBe(108);
    });
  });

  // =========================================================================
  // midiToFrequency
  // =========================================================================

  describe('midiToFrequency', () => {
    it('converts MIDI 69 to 440 Hz', () => {
      expect(midiToFrequency(69)).toBeCloseTo(440, 2);
    });

    it('converts MIDI 60 to ~261.63 Hz', () => {
      expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
    });

    it('converts MIDI 57 to 220 Hz (A3)', () => {
      expect(midiToFrequency(57)).toBeCloseTo(220, 2);
    });

    it('converts MIDI 81 to 880 Hz (A5)', () => {
      expect(midiToFrequency(81)).toBeCloseTo(880, 2);
    });

    it('roundtrips: midiToFrequency(frequencyToMidi(f)) ≈ f', () => {
      const freqs = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
      for (const f of freqs) {
        expect(midiToFrequency(frequencyToMidi(f))).toBeCloseTo(f, 1);
      }
    });
  });

  // =========================================================================
  // frequencyCentsOffset
  // =========================================================================

  describe('frequencyCentsOffset', () => {
    it('returns 0 for perfectly tuned A4 (440 Hz)', () => {
      expect(frequencyCentsOffset(440)).toBeCloseTo(0, 1);
    });

    it('returns positive cents for sharp A4', () => {
      // 441 Hz is slightly sharp of A4
      const cents = frequencyCentsOffset(441);
      expect(cents).toBeGreaterThan(0);
      expect(cents).toBeLessThan(10);
    });

    it('returns negative cents for flat A4', () => {
      // 438 Hz is slightly flat of A4
      const cents = frequencyCentsOffset(438);
      expect(cents).toBeLessThan(0);
      expect(cents).toBeGreaterThan(-10);
    });

    it('returns ~0 for 0 Hz', () => {
      expect(frequencyCentsOffset(0)).toBe(0);
    });

    it('returns value between -50 and +50 for near-note frequencies', () => {
      // C4 is 261.63 Hz; 265 Hz is slightly sharp
      const cents = frequencyCentsOffset(265);
      expect(Math.abs(cents)).toBeLessThanOrEqual(50);
    });
  });

  // =========================================================================
  // isInPianoRange
  // =========================================================================

  describe('isInPianoRange', () => {
    it('returns true for A4 (440 Hz)', () => {
      expect(isInPianoRange(440)).toBe(true);
    });

    it('returns true for A0 (27.5 Hz)', () => {
      expect(isInPianoRange(27.5)).toBe(true);
    });

    it('returns true for C8 (4186 Hz)', () => {
      expect(isInPianoRange(4186)).toBe(true);
    });

    it('returns false for 20 Hz (below piano)', () => {
      expect(isInPianoRange(20)).toBe(false);
    });

    it('returns false for 5000 Hz (above piano)', () => {
      expect(isInPianoRange(5000)).toBe(false);
    });
  });
});
