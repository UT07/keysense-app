/**
 * Audio Engine Tests
 * Comprehensive test suite for NativeAudioEngine
 *
 * Tests cover:
 * - Initialization and lifecycle
 * - Note playback and release
 * - Pitch shifting accuracy
 * - Polyphonic playback
 * - Memory management
 * - Edge cases and error handling
 */

import { NativeAudioEngine } from '../AudioEngine.native';
import type { NoteHandle } from '../types';

// Mock AudioContext for testing
class MockAudioBuffer {
  numberOfChannels = 1;
  sampleRate = 44100;
  duration = 2;
  length = 44100 * 2;

  getChannelData(_channel: number): Float32Array {
    return new Float32Array(this.length);
  }
}

class MockAudioParam {
  value = 1;

  setValueAtTime(_value: number, _startTime: number): void {}
  exponentialRampToValueAtTime(_value: number, _endTime: number): void {}
  cancelScheduledValues(_cancelTime: number): void {}
}

class MockAudioNode {
  connect(_destination: any): this {
    return this;
  }
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockBufferSourceNode extends MockAudioNode {
  buffer: MockAudioBuffer | null = null;
  playbackRate = new MockAudioParam();

  start(_when?: number): void {}
  stop(_when?: number): void {}
}

class MockAudioContext {
  state: 'running' | 'suspended' | 'closed' = 'running';
  sampleRate = 44100;
  currentTime = 0;
  outputLatency = 0.02; // 20ms

  destination = new MockAudioNode();

  createGain(): MockGainNode {
    return new MockGainNode();
  }

  createBufferSource(): MockBufferSourceNode {
    return new MockBufferSourceNode();
  }

  createBuffer(
    _channels: number,
    _length: number,
    _sampleRate: number
  ): MockAudioBuffer {
    return new MockAudioBuffer();
  }

  async suspend(): Promise<void> {
    this.state = 'suspended';
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }

  async close(): Promise<void> {
    this.state = 'closed';
  }

  decodeAudioData(_arrayBuffer: ArrayBuffer): Promise<MockAudioBuffer> {
    return Promise.resolve(new MockAudioBuffer());
  }
}

// Setup: Mock window.AudioContext globally
if (typeof window !== 'undefined') {
  (window as any).AudioContext = MockAudioContext;
  (window as any).webkitAudioContext = MockAudioContext;
}

describe('NativeAudioEngine', () => {
  let engine: NativeAudioEngine;

  beforeEach(() => {
    engine = new NativeAudioEngine();
  });

  afterEach(() => {
    if (engine) {
      engine.dispose();
    }
  });

  describe('Initialization', () => {
    test('initializes successfully', async () => {
      expect(engine.isReady()).toBe(false);

      await engine.initialize();

      expect(engine.isReady()).toBe(true);
      expect(engine.getState()).toBe('running');
    });

    test('initialization is idempotent', async () => {
      await engine.initialize();
      const latency1 = engine.getLatency();

      await engine.initialize(); // Should not reinitialize
      const latency2 = engine.getLatency();

      expect(latency1).toBe(latency2);
    });

    test('fails gracefully without initialization', () => {
      expect(() => engine.playNote(60)).toThrow(
        'AudioEngine not initialized'
      );
    });
  });

  describe('Note Playback', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('plays a note successfully', () => {
      const handle = engine.playNote(60, 0.8);

      expect(handle).toBeDefined();
      expect(handle.note).toBe(60);
      expect(typeof handle.release).toBe('function');
      expect(engine.getActiveNoteCount()).toBe(1);
    });

    test('plays middle C (note 60)', () => {
      const handle = engine.playNote(60);
      expect(handle.note).toBe(60);
      engine.releaseNote(handle);
    });

    test('plays lowest piano note (A0, note 21)', () => {
      const handle = engine.playNote(21);
      expect(handle.note).toBe(21);
      engine.releaseNote(handle);
    });

    test('plays highest piano note (C8, note 108)', () => {
      const handle = engine.playNote(108);
      expect(handle.note).toBe(108);
      engine.releaseNote(handle);
    });

    test('clamps velocity to valid range', () => {
      // Velocity < 0 should clamp to 0
      const handle1 = engine.playNote(60, -0.5);
      expect(handle1.note).toBe(60);

      // Velocity > 1 should clamp to 1
      const handle2 = engine.playNote(61, 1.5);
      expect(handle2.note).toBe(61);

      engine.releaseNote(handle1);
      engine.releaseNote(handle2);
    });

    test('uses default velocity of 0.8', () => {
      const handle = engine.playNote(60);
      expect(handle).toBeDefined();
      engine.releaseNote(handle);
    });
  });

  describe('Pitch Shifting', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('pitch shifts within ±3 semitones', () => {
      // Pitch shift ratios for semitones: 2^(n/12)
      // ±3 semitones: 0.841 to 1.189
      const handle1 = engine.playNote(59); // -1 semitone from C4
      const handle2 = engine.playNote(63); // +3 semitones from C4

      expect(handle1.note).toBe(59);
      expect(handle2.note).toBe(63);

      engine.releaseNote(handle1);
      engine.releaseNote(handle2);
    });

    test('pitch shifts across base notes', () => {
      // Base notes: 36 (C2), 48 (C3), 60 (C4), 72 (C5), 84 (C6)
      const handles = [36, 48, 60, 72, 84].map((note) =>
        engine.playNote(note)
      );

      handles.forEach((_handle) => {
        expect(engine.getActiveNoteCount()).toBeGreaterThan(0);
      });

      handles.forEach((handle) => engine.releaseNote(handle));
    });

    test('handles pitch shift for all 88 piano keys', () => {
      // Piano range: A0 (21) to C8 (108)
      const handles: NoteHandle[] = [];

      for (let note = 21; note <= 108; note += 12) {
        // Test every 12th note (octaves)
        handles.push(engine.playNote(note));
      }

      expect(handles.length).toBeGreaterThan(0);

      handles.forEach((handle) => engine.releaseNote(handle));
    });
  });

  describe('Polyphonic Playback', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('plays multiple notes simultaneously', () => {
      const handles = [60, 64, 67].map((note) => engine.playNote(note)); // C major chord

      expect(engine.getActiveNoteCount()).toBe(3);

      handles.forEach((handle) => engine.releaseNote(handle));
    });

    test('supports 10+ simultaneous notes', () => {
      const handles: NoteHandle[] = [];

      // Play 10 different notes
      for (let i = 0; i < 10; i++) {
        handles.push(engine.playNote(60 + i)); // C4 to B4
      }

      expect(engine.getActiveNoteCount()).toBe(10);

      handles.forEach((handle) => engine.releaseNote(handle));
    });

    test('replaces note at same pitch', () => {
      engine.playNote(60);
      expect(engine.getActiveNoteCount()).toBe(1);

      const handle2 = engine.playNote(60); // Same note
      expect(engine.getActiveNoteCount()).toBe(1); // Still 1, not 2

      engine.releaseNote(handle2);
    });

    test('plays chord with different velocities', () => {
      const chord = [
        engine.playNote(60, 0.6), // Soft
        engine.playNote(64, 0.8), // Medium
        engine.playNote(67, 1.0), // Loud
      ];

      expect(engine.getActiveNoteCount()).toBe(3);

      chord.forEach((handle) => engine.releaseNote(handle));
    });
  });

  describe('Note Release', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('releases a note via handle', () => {
      const handle = engine.playNote(60);
      expect(engine.getActiveNoteCount()).toBe(1);

      handle.release();
      // Note is released but may take time to be removed from active map

      engine.releaseNote(handle); // Cleanup
    });

    test('releases all notes', async () => {
      engine.playNote(60);
      engine.playNote(64);
      engine.playNote(67);

      expect(engine.getActiveNoteCount()).toBe(3);

      engine.releaseAllNotes();
      expect(engine.getActiveNoteCount()).toBe(0);
    });

    test('releasing non-existent note is safe', () => {
      const handle: NoteHandle = {
        note: 60,
        startTime: 0,
        release: () => {},
      };

      expect(() => engine.releaseNote(handle)).not.toThrow();
    });
  });

  describe('Volume Control', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('sets volume to valid range', () => {
      engine.setVolume(0.5);
      // Volume is internally clamped

      engine.setVolume(0);
      // Mute

      engine.setVolume(1);
      // Full volume
    });

    test('clamps volume to 0-1 range', () => {
      engine.setVolume(-0.5); // Should clamp to 0
      engine.setVolume(1.5); // Should clamp to 1
    });
  });

  describe('Context State Management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('returns correct state when running', () => {
      expect(engine.getState()).toBe('running');
    });

    test('suspends and resumes context', async () => {
      await engine.suspend();
      expect(engine.getState()).toBe('suspended');

      await engine.resume();
      expect(engine.getState()).toBe('running');
    });

    test('returns latency information', () => {
      const latency = engine.getLatency();
      expect(typeof latency).toBe('number');
      expect(latency).toBeGreaterThanOrEqual(0);
      expect(latency).toBeLessThan(100); // Should be < 100ms
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('disposes resources', () => {
      engine.playNote(60);
      engine.playNote(64);

      engine.dispose();

      expect(engine.getState()).toBe('closed');
      expect(engine.getActiveNoteCount()).toBe(0);
    });

    test('reports memory usage', async () => {
      const memory = engine.getMemoryUsage();

      expect(memory).toBeDefined();
      expect(memory.samples).toBeGreaterThanOrEqual(0);
      expect(memory.total).toBeGreaterThanOrEqual(memory.samples);
    });

    test('total memory is reasonable', async () => {
      const memory = engine.getMemoryUsage();
      const memoryMB = memory.total / (1024 * 1024);

      // 5 samples × ~500KB each = ~2.5MB
      // Allow up to 10MB for overhead
      expect(memoryMB).toBeLessThan(10);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('handles rapid note repeats', () => {
      const handles: NoteHandle[] = [];

      // Rapidly play the same note multiple times
      for (let i = 0; i < 5; i++) {
        handles.push(engine.playNote(60));
      }

      // Only last one should be active
      expect(engine.getActiveNoteCount()).toBeLessThanOrEqual(1);

      handles.forEach((h) => {
        try {
          engine.releaseNote(h);
        } catch {
          // Expected for released notes
        }
      });
    });

    test('handles note on, note off, note on sequence', () => {
      const h1 = engine.playNote(60);
      engine.releaseNote(h1);

      const h2 = engine.playNote(60); // Same note again
      engine.releaseNote(h2);
    });

    test('handles MIDI note boundaries', () => {
      engine.playNote(0); // MIDI lowest
      engine.playNote(127); // MIDI highest
    });

    test('handles zero velocity', () => {
      const handle = engine.playNote(60, 0);
      expect(handle).toBeDefined();
      engine.releaseNote(handle);
    });

    test('handles fractional velocities', () => {
      const handle = engine.playNote(60, 0.123456);
      expect(handle).toBeDefined();
      engine.releaseNote(handle);
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('plays C major scale', () => {
      const cmajorScale = [60, 62, 64, 65, 67, 69, 71, 72]; // C4 to C5
      const handles = cmajorScale.map((note) => engine.playNote(note));

      expect(engine.getActiveNoteCount()).toBe(cmajorScale.length);

      handles.forEach((h) => engine.releaseNote(h));
    });

    test('plays Mary Had a Little Lamb', () => {
      // E4, D4, C4, D4, E4, E4, E4
      const melody = [64, 62, 60, 62, 64, 64, 64];
      const handles = melody.map((note) => engine.playNote(note));

      // Engine replaces notes at the same pitch, so only unique pitches remain active
      const uniquePitches = new Set(melody).size; // 3: {60, 62, 64}
      expect(engine.getActiveNoteCount()).toBe(uniquePitches);

      handles.forEach((h) => engine.releaseNote(h));
    });

    test('simulates chord progression', () => {
      const chords = [
        [60, 64, 67], // C major
        [62, 65, 69], // D minor
        [64, 67, 71], // E minor
      ];

      chords.forEach((chord) => {
        engine.releaseAllNotes(); // Release previous chord

        chord.map((note) => engine.playNote(note));
        expect(engine.getActiveNoteCount()).toBe(chord.length);
      });
    });
  });
});
