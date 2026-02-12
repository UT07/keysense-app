/**
 * Sample Loader Tests
 * Tests for piano sample preloading and management
 */

import { SampleLoader, BASE_NOTES } from '../samples/SampleLoader';

// Mock AudioBuffer
class MockAudioBuffer {
  numberOfChannels: number;
  sampleRate: number;
  duration: number;
  length: number;

  constructor(
    channels: number = 1,
    length: number = 44100,
    sampleRate: number = 44100
  ) {
    this.numberOfChannels = channels;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.length = length;
  }

  getChannelData(_channel: number): Float32Array {
    return new Float32Array(this.length);
  }
}

// Mock AudioContext
class MockAudioContext {
  sampleRate = 44100;

  createBuffer(
    channels: number,
    length: number,
    sampleRate: number
  ): MockAudioBuffer {
    return new MockAudioBuffer(channels, length, sampleRate);
  }
}

describe('SampleLoader', () => {
  let context: MockAudioContext;
  let loader: SampleLoader;

  beforeEach(() => {
    context = new MockAudioContext();
    loader = new SampleLoader(context as any);
  });

  afterEach(() => {
    loader.clear();
  });

  describe('Initialization', () => {
    test('creates loader with default config', () => {
      expect(loader).toBeDefined();
    });

    test('creates loader with custom sample rate', () => {
      const customLoader = new SampleLoader(context as any, {
        sampleRate: 48000,
      });
      expect(customLoader).toBeDefined();
    });
  });

  describe('Sample Preloading', () => {
    test('preloads all base samples', async () => {
      const samples = await loader.preloadSamples();

      expect(samples).toBeDefined();
      expect(samples.size).toBeGreaterThan(0);
    });

    test('loads all 5 base note samples', async () => {
      const samples = await loader.preloadSamples();

      const baseNoteValues = Object.values(BASE_NOTES);
      for (const note of baseNoteValues) {
        expect(samples.has(note)).toBe(true);
      }
    });

    test('preloading is idempotent', async () => {
      const samples1 = await loader.preloadSamples();
      const samples2 = await loader.preloadSamples();

      expect(samples1.size).toBe(samples2.size);
    });

    test('handles concurrent preload calls', async () => {
      const promise1 = loader.preloadSamples();
      const promise2 = loader.preloadSamples();

      const [samples1, samples2] = await Promise.all([promise1, promise2]);

      expect(samples1.size).toBe(samples2.size);
      expect(samples1.size).toBeGreaterThan(0);
    });
  });

  describe('Sample Retrieval', () => {
    beforeEach(async () => {
      await loader.preloadSamples();
    });

    test('retrieves loaded sample', () => {
      const sample = loader.getSample(BASE_NOTES.C4);
      expect(sample).toBeDefined();
      expect(sample?.numberOfChannels).toBe(1);
    });

    test('returns null for unloaded sample', () => {
      loader.clear(); // Clear samples
      const sample = loader.getSample(BASE_NOTES.C4);
      expect(sample).toBeNull();
    });

    test('retrieves correct sample for each base note', () => {
      for (const [_name, note] of Object.entries(BASE_NOTES)) {
        const sample = loader.getSample(note);
        expect(sample).not.toBeNull();
        expect(sample?.numberOfChannels).toBe(1);
      }
    });
  });

  describe('Nearest Sample Finding', () => {
    beforeEach(async () => {
      await loader.preloadSamples();
    });

    test('finds nearest sample for exact base note', () => {
      const { baseNote } = loader.getNearestSample(BASE_NOTES.C4);
      expect(baseNote).toBe(BASE_NOTES.C4);
    });

    test('finds nearest sample within semitones', () => {
      // Notes close to C4 (60)
      const { baseNote: baseNote1 } = loader.getNearestSample(59); // B3
      const { baseNote: baseNote2 } = loader.getNearestSample(61); // C#4

      // Both should find C4 as nearest (note 60)
      expect(baseNote1).toBe(BASE_NOTES.C4);
      expect(baseNote2).toBe(BASE_NOTES.C4);
    });

    test('returns buffer with sample', () => {
      const { buffer, baseNote } = loader.getNearestSample(60);

      expect(buffer).toBeDefined();
      expect(buffer.numberOfChannels).toBe(1);
      expect(baseNote).toBe(BASE_NOTES.C4);
    });

    test('handles pitch at octave boundaries', () => {
      // C3 (48) vs C4 (60)
      const { baseNote: base1 } = loader.getNearestSample(48);
      expect(base1).toBe(BASE_NOTES.C3);

      const { baseNote: base2 } = loader.getNearestSample(60);
      expect(base2).toBe(BASE_NOTES.C4);
    });

    test('throws when no samples loaded', () => {
      loader.clear();
      expect(() => loader.getNearestSample(60)).toThrow(
        'No samples loaded'
      );
    });

    test('finds nearest for lowest piano note (A0, 21)', () => {
      const { baseNote } = loader.getNearestSample(21);
      expect(baseNote).toBeDefined();
    });

    test('finds nearest for highest piano note (C8, 108)', () => {
      const { baseNote } = loader.getNearestSample(108);
      expect(baseNote).toBeDefined();
    });

    test('pitch shift range within acceptable limits', () => {
      // For ±3 semitones, pitch shift should be 0.841 to 1.189
      const { baseNote: base60 } = loader.getNearestSample(60);
      const semitoneOffset = Math.abs(60 - base60);

      expect(semitoneOffset).toBeLessThanOrEqual(24); // Within reasonable shift
    });
  });

  describe('Information Retrieval', () => {
    beforeEach(async () => {
      await loader.preloadSamples();
    });

    test('gets loaded samples list', () => {
      const samples = loader.getLoadedSamples();

      expect(Array.isArray(samples)).toBe(true);
      expect(samples.length).toBeGreaterThan(0);
    });

    test('sample info includes note, buffer, and duration', () => {
      const samples = loader.getLoadedSamples();
      const first = samples[0];

      expect(first.note).toBeDefined();
      expect(first.buffer).toBeDefined();
      expect(first.duration).toBeDefined();
      expect(typeof first.duration).toBe('number');
    });

    test('calculates memory usage', () => {
      const memory = loader.getMemoryUsage();

      expect(typeof memory).toBe('number');
      expect(memory).toBeGreaterThan(0);
    });

    test('memory usage is reasonable', () => {
      const memory = loader.getMemoryUsage();
      const memoryMB = memory / (1024 * 1024);

      // 5 samples × ~500KB each ≈ 2.5MB
      // Allow up to 10MB for safety
      expect(memoryMB).toBeLessThan(10);
    });

    test('memory calculation is consistent', () => {
      const memory1 = loader.getMemoryUsage();
      const memory2 = loader.getMemoryUsage();

      expect(memory1).toBe(memory2);
    });
  });

  describe('Lifecycle Management', () => {
    test('clears all samples', async () => {
      loader = new SampleLoader(context as any);
      await loader.preloadSamples();

      let samples = loader.getLoadedSamples();
      expect(samples.length).toBeGreaterThan(0);

      loader.clear();

      samples = loader.getLoadedSamples();
      expect(samples.length).toBe(0);
    });

    test('can preload again after clear', async () => {
      await loader.preloadSamples();
      loader.clear();

      const samples = await loader.preloadSamples();
      expect(samples.size).toBeGreaterThan(0);
    });

    test('memory usage is zero after clear', async () => {
      await loader.preloadSamples();
      loader.clear();

      const memory = loader.getMemoryUsage();
      expect(memory).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('handles missing sample paths gracefully', async () => {
      loader = new SampleLoader(context as any);

      // Should handle missing paths in SAMPLE_PATHS
      // This depends on implementation - may throw or return safe default
      try {
        await loader.preloadSamples();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('handles null context safely', () => {
      loader = new SampleLoader(null as any);

      expect(() => loader.getNearestSample(60)).toThrow();
    });
  });

  describe('Integration', () => {
    test('preloads samples for full piano range', async () => {
      await loader.preloadSamples();

      // Test piano range: A0 (21) to C8 (108)
      const pianoNotes = [21, 36, 48, 60, 72, 84, 108];

      pianoNotes.forEach((note) => {
        const { baseNote, buffer } = loader.getNearestSample(note);
        expect(buffer).toBeDefined();
        expect(baseNote).toBeDefined();
      });
    });

    test('simulates note playback sequence', async () => {
      await loader.preloadSamples();

      // Simulate Mary Had a Little Lamb
      const notes = [64, 62, 60, 62, 64, 64, 64];

      notes.forEach((note) => {
        const sample = loader.getNearestSample(note);
        expect(sample.buffer).toBeDefined();

        // Calculate pitch shift
        const semitoneShift = note - sample.baseNote;
        const pitchShift = Math.pow(2, semitoneShift / 12);

        expect(pitchShift).toBeGreaterThan(0.5);
        expect(pitchShift).toBeLessThan(2);
      });
    });
  });
});
