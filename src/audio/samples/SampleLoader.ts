/**
 * Sample loader for piano samples
 * Handles preloading and decoding of audio samples
 *
 * CRITICAL: All samples must be pre-allocated at initialization
 * to prevent memory allocations during audio callbacks
 */

import type { SampleInfo } from '../types';

// Base piano sample notes (MIDI note numbers)
export const BASE_NOTES = {
  C2: 36,
  C3: 48,
  C4: 60,
  C5: 72,
  C6: 84,
} as const;

// Sample file paths (relative to assets)
const SAMPLE_PATHS: Record<number, string> = {
  [BASE_NOTES.C2]: 'assets/samples/piano-c2.wav',
  [BASE_NOTES.C3]: 'assets/samples/piano-c3.wav',
  [BASE_NOTES.C4]: 'assets/samples/piano-c4.wav',
  [BASE_NOTES.C5]: 'assets/samples/piano-c5.wav',
  [BASE_NOTES.C6]: 'assets/samples/piano-c6.wav',
};

export interface SampleLoaderConfig {
  sampleRate?: number;
  enableCaching?: boolean;
}

/**
 * Manages loading and caching of audio samples
 * Uses AudioContext for decoding to maintain Web Audio API compatibility
 */
export class SampleLoader {
  private context: AudioContext | null = null;
  private samples: Map<number, AudioBuffer> = new Map();
  private isLoading = false;
  private loadPromise: Promise<Map<number, AudioBuffer>> | null = null;
  config: Required<SampleLoaderConfig>;

  constructor(context: AudioContext, config: SampleLoaderConfig = {}) {
    this.context = context;
    this.config = {
      sampleRate: config.sampleRate || 44100,
      enableCaching: config.enableCaching ?? true,
    };
  }

  /**
   * Preload all base samples
   * Returns promise that resolves when all samples are decoded
   *
   * CRITICAL: Must complete before audio playback begins
   */
  async preloadSamples(): Promise<Map<number, AudioBuffer>> {
    // Return cached promise if already loading
    if (this.loadPromise) {
      return this.loadPromise;
    }

    if (this.isLoading) {
      // Wait for loading to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isLoading && this.samples.size > 0) {
            clearInterval(checkInterval);
            resolve(this.samples);
          }
        }, 10);
      });
    }

    this.isLoading = true;

    this.loadPromise = (async () => {
      try {
        const noteNumbers = Object.values(BASE_NOTES);

        // Fetch and decode all samples in parallel
        const decodePromises = noteNumbers.map((note) =>
          this.loadSample(note)
        );

        await Promise.all(decodePromises);

        return this.samples;
      } catch (error) {
        console.error('Failed to preload samples:', error);
        throw new Error(`Sample preloading failed: ${error}`);
      } finally {
        this.isLoading = false;
      }
    })();

    return this.loadPromise;
  }

  /**
   * Load a single sample by MIDI note number
   * Uses mock fetch for compatibility (replace with actual asset loading)
   */
  private async loadSample(note: number): Promise<void> {
    if (!this.context) {
      throw new Error('AudioContext not initialized');
    }

    if (this.samples.has(note)) {
      return; // Already loaded
    }

    const path = SAMPLE_PATHS[note];
    if (!path) {
      throw new Error(`No sample path defined for MIDI note ${note}`);
    }

    try {
      // Mock fetch - in production, use Expo's file system API
      // const response = await fetch(path);
      // const arrayBuffer = await response.arrayBuffer();

      // For testing, create a minimal valid AudioBuffer
      // In production, this would load actual WAV files
      const audioBuffer = this.context.createBuffer(
        1, // mono
        this.context.sampleRate * 2, // 2 seconds
        this.context.sampleRate
      );

      this.samples.set(note, audioBuffer);
    } catch (error) {
      console.error(`Failed to load sample for note ${note}:`, error);
      throw error;
    }
  }

  /**
   * Get a preloaded sample for a specific note
   * Returns the sample or null if not loaded
   */
  getSample(note: number): AudioBuffer | null {
    return this.samples.get(note) || null;
  }

  /**
   * Find nearest preloaded sample and return both sample and base note
   * Uses closest matching sample for pitch shifting
   */
  getNearestSample(targetNote: number): {
    buffer: AudioBuffer;
    baseNote: number;
  } {
    const baseNotes = Array.from(this.samples.keys()).sort();

    if (baseNotes.length === 0) {
      throw new Error('No samples loaded. Call preloadSamples() first');
    }

    // Find nearest base note
    let nearest = baseNotes[0];
    let minDistance = Math.abs(targetNote - nearest);

    for (const baseNote of baseNotes) {
      const distance = Math.abs(targetNote - baseNote);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = baseNote;
      }
    }

    const buffer = this.samples.get(nearest);
    if (!buffer) {
      throw new Error(`Sample for note ${nearest} not found`);
    }

    return { buffer, baseNote: nearest };
  }

  /**
   * Get all loaded samples
   * For monitoring and debugging
   */
  getLoadedSamples(): SampleInfo[] {
    return Array.from(this.samples.entries()).map(([note, buffer]) => ({
      note,
      buffer,
      duration: buffer.duration,
    }));
  }

  /**
   * Clear cached samples from memory
   * Use before creating a new AudioContext
   */
  clear(): void {
    this.samples.clear();
    this.isLoading = false;
    this.loadPromise = null;
  }

  /**
   * Get total memory usage of loaded samples
   * Each sample is roughly: channels × sampleRate × duration × 4 bytes (float32)
   */
  getMemoryUsage(): number {
    let total = 0;
    for (const buffer of this.samples.values()) {
      // Approximate: channels × frames × 4 bytes per float32
      total += buffer.numberOfChannels * buffer.length * 4;
    }
    return total; // bytes
  }
}
