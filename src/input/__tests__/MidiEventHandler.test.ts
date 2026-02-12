/**
 * MIDI Event Handler Tests
 * Tests for velocity mapping, sustain pedal, and event processing
 */

import { MidiEventHandler } from '../MidiEventHandler';
import type { MidiNoteEvent } from '../../core/exercises/types';

describe('MidiEventHandler', () => {
  let handler: MidiEventHandler;
  let mockCallbacks: {
    onNoteOn: jest.Mock;
    onNoteOff: jest.Mock;
    onSustainChange: jest.Mock;
  };

  beforeEach(() => {
    handler = new MidiEventHandler({
      sustainCCNumber: 64,
      velocitySensitivity: 'linear',
      logPerformance: false,
    });

    mockCallbacks = {
      onNoteOn: jest.fn(),
      onNoteOff: jest.fn(),
      onSustainChange: jest.fn(),
    };

    handler.registerCallbacks(mockCallbacks);
  });

  describe('Configuration', () => {
    it('should use default config', () => {
      const defaultHandler = new MidiEventHandler();
      expect(defaultHandler).toBeDefined();
    });

    it('should accept custom sustain CC number', () => {
      const customHandler = new MidiEventHandler({
        sustainCCNumber: 66, // Custom sustain CC
      });
      expect(customHandler).toBeDefined();
    });

    it('should support logarithmic velocity sensitivity', () => {
      const logHandler = new MidiEventHandler({
        velocitySensitivity: 'logarithmic',
      });
      expect(logHandler).toBeDefined();
    });

    it('should enable performance logging', () => {
      const logHandler = new MidiEventHandler({
        logPerformance: true,
      });
      expect(logHandler).toBeDefined();
    });
  });

  describe('Velocity Mapping', () => {
    it('should treat velocity 0 as note off (MIDI spec)', () => {
      // Per MIDI spec, noteOn with velocity 0 is equivalent to noteOff.
      // First send a real noteOn so the note is active.
      handler.processMidiNote({
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      });

      expect(mockCallbacks.onNoteOn).toHaveBeenCalledWith(60, 100 / 127, expect.any(Number));

      // Now send velocity 0 — should be treated as noteOff
      handler.processMidiNote({
        type: 'noteOn',
        note: 60,
        velocity: 0,
        timestamp: Date.now(),
        channel: 0,
      });

      expect(mockCallbacks.onNoteOff).toHaveBeenCalledWith(60, expect.any(Number), false);
      expect(handler.isNoteActive(60)).toBe(false);
    });

    it('should map velocity 127 to gain 1', () => {
      const note: MidiNoteEvent = {
        type: 'noteOn',
        note: 60,
        velocity: 127,
        timestamp: Date.now(),
        channel: 0,
      };

      handler.processMidiNote(note);

      expect(mockCallbacks.onNoteOn).toHaveBeenCalledWith(60, 1, expect.any(Number));
    });

    it('should map velocity 64 to approximately 0.5', () => {
      const note: MidiNoteEvent = {
        type: 'noteOn',
        note: 60,
        velocity: 64,
        timestamp: Date.now(),
        channel: 0,
      };

      handler.processMidiNote(note);

      const calls = mockCallbacks.onNoteOn.mock.calls;
      const gain = calls[0][1]; // Second argument is velocity/gain
      expect(gain).toBeCloseTo(64 / 127, 2);
    });

    it('should clamp velocity to 0-127 range', () => {
      const invalidNote: MidiNoteEvent = {
        type: 'noteOn',
        note: 60,
        velocity: 200, // Out of range
        timestamp: Date.now(),
        channel: 0,
      };

      handler.processMidiNote(invalidNote);

      expect(mockCallbacks.onNoteOn).toHaveBeenCalledWith(60, 1, expect.any(Number));
    });

    it('should support logarithmic velocity mapping', () => {
      const logHandler = new MidiEventHandler({
        velocitySensitivity: 'logarithmic',
      });
      logHandler.registerCallbacks(mockCallbacks);

      const note: MidiNoteEvent = {
        type: 'noteOn',
        note: 60,
        velocity: 64,
        timestamp: Date.now(),
        channel: 0,
      };

      logHandler.processMidiNote(note);

      const calls = mockCallbacks.onNoteOn.mock.calls;
      const logGain = calls[0][1];
      const expectedLogGain = Math.log(65) / Math.log(128);
      expect(logGain).toBeCloseTo(expectedLogGain, 3);
    });
  });

  describe('Note On/Off Events', () => {
    it('should handle note on with velocity > 0', () => {
      const note: MidiNoteEvent = {
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      };

      handler.processMidiNote(note);

      expect(mockCallbacks.onNoteOn).toHaveBeenCalledWith(60, 100 / 127, expect.any(Number));
      expect(mockCallbacks.onNoteOff).not.toHaveBeenCalled();
    });

    it('should route velocity 0 noteOn to noteOff handler', () => {
      // First play the note so it's active
      handler.processMidiNote({
        type: 'noteOn',
        note: 60,
        velocity: 80,
        timestamp: Date.now(),
        channel: 0,
      });

      expect(handler.isNoteActive(60)).toBe(true);

      // Now send noteOn with velocity 0 (MIDI "running status" note off)
      handler.processMidiNote({
        type: 'noteOn',
        note: 60,
        velocity: 0,
        timestamp: Date.now() + 100,
        channel: 0,
      });

      // Should have called noteOff and deactivated the note
      expect(mockCallbacks.onNoteOff).toHaveBeenCalledWith(60, expect.any(Number), false);
      expect(handler.isNoteActive(60)).toBe(false);
    });

    it('should handle explicit note off', () => {
      const noteOn: MidiNoteEvent = {
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      };

      const noteOff: MidiNoteEvent = {
        type: 'noteOff',
        note: 60,
        velocity: 0,
        timestamp: Date.now() + 100,
        channel: 0,
      };

      handler.processMidiNote(noteOn);
      handler.processMidiNote(noteOff);

      expect(mockCallbacks.onNoteOn).toHaveBeenCalled();
      expect(mockCallbacks.onNoteOff).toHaveBeenCalled();
    });

    it('should track active notes', () => {
      const note: MidiNoteEvent = {
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      };

      handler.processMidiNote(note);

      expect(handler.isNoteActive(60)).toBe(true);
      expect(handler.isNoteActive(61)).toBe(false);
    });

    it('should handle multiple simultaneous notes (polyphony)', () => {
      const notes = [60, 64, 67]; // C major chord

      notes.forEach((note, index) => {
        handler.processMidiNote({
          type: 'noteOn',
          note,
          velocity: 100,
          timestamp: Date.now() + index * 10,
          channel: 0,
        });
      });

      notes.forEach((note) => {
        expect(handler.isNoteActive(note)).toBe(true);
      });

      const activeNotes = handler.getActiveNotes();
      expect(activeNotes.size).toBe(3);
    });
  });

  describe('Sustain Pedal (CC64)', () => {
    it('should handle sustain pedal press (CC64 >= 64)', () => {
      handler.processMidiControlChange(64, 127, 0);

      expect(mockCallbacks.onSustainChange).toHaveBeenCalledWith(true, expect.any(Number));
      expect(handler.isSustainActive()).toBe(true);
    });

    it('should handle sustain pedal release (CC64 < 64)', () => {
      // Press sustain
      handler.processMidiControlChange(64, 127, 0);
      expect(handler.isSustainActive()).toBe(true);

      // Release sustain
      handler.processMidiControlChange(64, 0, 0);
      expect(handler.isSustainActive()).toBe(false);
      expect(mockCallbacks.onSustainChange).toHaveBeenLastCalledWith(false, expect.any(Number));
    });

    it('should sustain notes when pedal pressed', () => {
      // Play a note
      handler.processMidiNote({
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      });

      // Press sustain pedal
      handler.processMidiControlChange(64, 127, 0);

      // Release note (should stay active due to sustain)
      handler.processMidiNote({
        type: 'noteOff',
        note: 60,
        velocity: 0,
        timestamp: Date.now() + 100,
        channel: 0,
      });

      // Note should still be marked as sustained
      const activeNotes = handler.getActiveNotes();
      expect(activeNotes.has(60)).toBe(true);
      expect(activeNotes.get(60)?.isSustained).toBe(true);
    });

    it('should release sustained notes when sustain pedal released', () => {
      // Play note and press sustain
      handler.processMidiNote({
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      });

      handler.processMidiControlChange(64, 127, 0);

      // Release note (will be sustained)
      handler.processMidiNote({
        type: 'noteOff',
        note: 60,
        velocity: 0,
        timestamp: Date.now() + 100,
        channel: 0,
      });

      expect(handler.isNoteActive(60)).toBe(true);

      // Release sustain pedal
      handler.processMidiControlChange(64, 0, 0);

      // Now note should be released
      expect(handler.isNoteActive(60)).toBe(false);
      expect(mockCallbacks.onNoteOff).toHaveBeenLastCalledWith(60, expect.any(Number), false);
    });

    it('should handle multiple sustained notes', () => {
      const notes = [60, 64, 67];

      // Play notes
      notes.forEach((note) => {
        handler.processMidiNote({
          type: 'noteOn',
          note,
          velocity: 100,
          timestamp: Date.now(),
          channel: 0,
        });
      });

      // Press sustain
      handler.processMidiControlChange(64, 127, 0);

      // Release all notes
      notes.forEach((note) => {
        handler.processMidiNote({
          type: 'noteOff',
          note,
          velocity: 0,
          timestamp: Date.now() + 100,
          channel: 0,
        });
      });

      // All should be sustained
      notes.forEach((note) => {
        expect(handler.isNoteActive(note)).toBe(true);
      });

      // Release sustain
      handler.processMidiControlChange(64, 0, 0);

      // All should be released
      notes.forEach((note) => {
        expect(handler.isNoteActive(note)).toBe(false);
      });
    });

    it('should use custom sustain CC number', () => {
      const customHandler = new MidiEventHandler({
        sustainCCNumber: 66,
      });
      customHandler.registerCallbacks(mockCallbacks);

      // CC 66 should activate sustain
      customHandler.processMidiControlChange(66, 127, 0);
      expect(customHandler.isSustainActive()).toBe(true);

      // CC 64 (default) should not affect custom sustain
      mockCallbacks.onSustainChange.mockClear();
      customHandler.processMidiControlChange(64, 127, 0);
      expect(mockCallbacks.onSustainChange).not.toHaveBeenCalled();
    });

    it('should handle sustain boundary value correctly', () => {
      // CC64 value of 63 should not activate sustain
      handler.processMidiControlChange(64, 63, 0);
      expect(handler.isSustainActive()).toBe(false);

      // CC64 value of 64 should activate sustain
      handler.processMidiControlChange(64, 64, 0);
      expect(handler.isSustainActive()).toBe(true);
    });
  });

  describe('Note State Management', () => {
    it('should return map of active notes', () => {
      const notes = [60, 64, 67];

      notes.forEach((note) => {
        handler.processMidiNote({
          type: 'noteOn',
          note,
          velocity: 100,
          timestamp: Date.now(),
          channel: 0,
        });
      });

      const activeNotes = handler.getActiveNotes();
      expect(activeNotes.size).toBe(3);

      notes.forEach((note) => {
        expect(activeNotes.has(note)).toBe(true);
      });
    });

    it('should provide deep copy of active notes', () => {
      handler.processMidiNote({
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      });

      const activeNotes1 = handler.getActiveNotes();
      const activeNotes2 = handler.getActiveNotes();

      expect(activeNotes1).not.toBe(activeNotes2);
      expect(activeNotes1.size).toBe(activeNotes2.size);
    });

    it('should clear active notes', () => {
      handler.processMidiNote({
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      });

      expect(handler.isNoteActive(60)).toBe(true);

      handler.clearActiveNotes();

      expect(handler.isNoteActive(60)).toBe(false);
      expect(handler.getActiveNotes().size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle events without registered callbacks', () => {
      const noCallbackHandler = new MidiEventHandler();

      const note: MidiNoteEvent = {
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      };

      // Should not throw
      expect(() => {
        noCallbackHandler.processMidiNote(note);
      }).not.toThrow();
    });

    it('should handle callback errors gracefully', () => {
      mockCallbacks.onNoteOn.mockImplementation(() => {
        throw new Error('Callback error');
      });

      const note: MidiNoteEvent = {
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      };

      // Should not throw
      expect(() => {
        handler.processMidiNote(note);
      }).not.toThrow();
    });

    it('should handle invalid channel gracefully', () => {
      const note: MidiNoteEvent = {
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 15, // Max MIDI channel
      };

      // Should not throw
      expect(() => {
        handler.processMidiNote(note);
      }).not.toThrow();

      expect(mockCallbacks.onNoteOn).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle realistic practice session', () => {
      const events: Array<{ event: string; note: number; time: number }> = [];

      // Track all events for verification
      mockCallbacks.onNoteOn.mockImplementation((note) => {
        events.push({ event: 'noteOn', note, time: Date.now() });
      });

      mockCallbacks.onNoteOff.mockImplementation((note) => {
        events.push({ event: 'noteOff', note, time: Date.now() });
      });

      const baseTime = Date.now();

      // Play C major scale
      const scaleNotes = [60, 62, 64, 65, 67, 69, 71, 72];

      scaleNotes.forEach((note, index) => {
        // Note on
        handler.processMidiNote({
          type: 'noteOn',
          note,
          velocity: 100,
          timestamp: baseTime + index * 200,
          channel: 0,
        });

        // Note off
        handler.processMidiNote({
          type: 'noteOff',
          note,
          velocity: 0,
          timestamp: baseTime + index * 200 + 150,
          channel: 0,
        });
      });

      expect(events.length).toBe(scaleNotes.length * 2);
      expect(handler.getActiveNotes().size).toBe(0);
    });

    it('should handle sustain through chord progression', () => {
      const baseTime = Date.now();

      // Chord 1: C major
      const chord1 = [60, 64, 67];
      chord1.forEach((note) => {
        handler.processMidiNote({
          type: 'noteOn',
          note,
          velocity: 100,
          timestamp: baseTime,
          channel: 0,
        });
      });

      // Press sustain
      handler.processMidiControlChange(64, 127, baseTime + 10);

      // Release chord 1 (will sustain)
      chord1.forEach((note) => {
        handler.processMidiNote({
          type: 'noteOff',
          note,
          velocity: 0,
          timestamp: baseTime + 100,
          channel: 0,
        });
      });

      // All notes should be sustained
      expect(handler.getActiveNotes().size).toBe(3);

      // Play chord 2: G major (overlapping with sustain)
      const chord2 = [67, 71, 74];
      chord2.forEach((note) => {
        handler.processMidiNote({
          type: 'noteOn',
          note,
          velocity: 100,
          timestamp: baseTime + 200,
          channel: 0,
        });
      });

      // Release sustain
      handler.processMidiControlChange(64, 0, baseTime + 300);

      // Chord 1 released, Chord 2 should remain active
      expect(handler.getActiveNotes().size).toBe(3);
    });

    it('should maintain note timing accuracy', () => {
      const timestamps: number[] = [];

      mockCallbacks.onNoteOn.mockImplementation((_note, _velocity, timestamp) => {
        timestamps.push(timestamp);
      });

      const baseTime = Date.now();
      const noteTimings = [0, 50, 100, 150, 200];

      noteTimings.forEach((offset) => {
        handler.processMidiNote({
          type: 'noteOn',
          note: 60 + noteTimings.indexOf(offset),
          velocity: 100,
          timestamp: baseTime + offset,
          channel: 0,
        });
      });

      // Verify timestamp accuracy
      timestamps.forEach((timestamp, index) => {
        expect(timestamp).toBe(baseTime + noteTimings[index]);
      });
    });
  });

  describe('Performance', () => {
    it('should process note events quickly', () => {
      const startTime = Date.now();
      const iterationCount = 1000;

      for (let i = 0; i < iterationCount; i++) {
        handler.processMidiNote({
          type: 'noteOn',
          note: 60 + (i % 88),
          velocity: 50 + (i % 77),
          timestamp: Date.now(),
          channel: 0,
        });
      }

      const duration = Date.now() - startTime;
      const avgMs = duration / iterationCount;

      // Should process notes in <3ms average (practical limit)
      expect(avgMs).toBeLessThan(3);
    });

    it('should handle CC events quickly', () => {
      const startTime = Date.now();
      const iterationCount = 100;

      for (let i = 0; i < iterationCount; i++) {
        handler.processMidiControlChange(64, i % 128, 0);
      }

      const duration = Date.now() - startTime;
      const avgMs = duration / iterationCount;

      // Should process CC events very quickly
      expect(avgMs).toBeLessThan(1);
    });
  });
});
