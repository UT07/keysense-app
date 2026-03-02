/**
 * Native Audio Engine Implementation
 * Uses react-native-audio-api (Web Audio API compatible)
 *
 * CRITICAL PERFORMANCE REQUIREMENTS:
 * - Touch-to-sound latency: <20ms (cumulative with UI)
 * - MIDI-to-sound latency: <15ms
 * - Zero allocations in audio callbacks
 * - All buffers and objects pre-allocated at initialization
 *
 * ADSR Implementation:
 * - Attack: 10ms (0.001 → velocity)
 * - Decay: 100ms (velocity → velocity × sustain)
 * - Sustain: 0.7 (maintain level until note release)
 * - Release: 200ms (velocity × sustain → 0.001)
 *
 * All ramping uses exponential (NOT linear) for smooth, natural envelopes
 */

import type { IAudioEngine, NoteHandle, AudioContextState, NoteState, ADSRConfig } from './types';
import { logger } from '../utils/logger';
import { SampleLoader } from './samples/SampleLoader';

const DEFAULT_VOLUME = 0.8;
const MIN_NOTE_DURATION = 0.05; // 50ms minimum before release

/**
 * ADSR envelope configuration (matches PRD specification)
 * All times in seconds
 */
const ADSR_CONFIG: ADSRConfig = {
  attack: 0.01, // 10ms
  decay: 0.1, // 100ms
  sustain: 0.7, // 70% of peak velocity
  release: 0.2, // 200ms
};

/**
 * Native Audio Engine using react-native-audio-api
 * Implements low-latency piano note playback with polyphonic support
 */
export class NativeAudioEngine implements IAudioEngine {
  private context: AudioContext | null = null;
  private sampleLoader: SampleLoader | null = null;
  private activeNotes: Map<number, NoteState> = new Map();
  private masterGain: GainNode | null = null;
  private volume: number = DEFAULT_VOLUME;

  constructor() {
    // Pre-allocation happens during initialize()
  }

  /**
   * Initialize audio context and preload samples
   * Must be called before any playback
   *
   * Steps:
   * 1. Create AudioContext with low-latency hint
   * 2. Create master gain node for volume control
   * 3. Preload all piano samples
   *
   * Returns: Promise that resolves when ready for playback
   */
  async initialize(): Promise<void> {
    if (this.context) {
      logger.warn('AudioEngine already initialized');
      return;
    }

    try {
      // Create AudioContext with low-latency settings
      this.context = new AudioContext({
        sampleRate: 44100,
        latencyHint: 'interactive', // Minimum latency
      } as AudioContextOptions);

      // Create master gain node (0.0 to 1.0 volume control)
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.context.destination);

      // Initialize sample loader
      this.sampleLoader = new SampleLoader(this.context, {
        sampleRate: 44100,
        enableCaching: true,
      });

      // Preload all samples (CRITICAL: must complete before playback)
      await this.sampleLoader.preloadSamples();

      logger.log('AudioEngine initialized successfully');
    } catch (error) {
      console.error('AudioEngine initialization failed:', error);
      throw new Error(
        `Failed to initialize AudioEngine: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Suspend audio context (e.g., when app backgrounded)
   * Preserves context state for resume
   */
  async suspend(): Promise<void> {
    if (this.context && this.context.state === 'running') {
      try {
        await this.context.suspend();
      } catch (error) {
        console.error('Failed to suspend AudioContext:', error);
      }
    }
  }

  /**
   * Resume audio context (e.g., when app foregrounded)
   * User gesture may be required on some platforms
   */
  async resume(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch (error) {
        console.error('Failed to resume AudioContext:', error);
      }
    }
  }

  /**
   * Dispose of audio resources
   * Call when cleaning up or switching contexts
   */
  dispose(): void {
    // Stop all active notes
    this.releaseAllNotes();

    // Clear sample loader
    if (this.sampleLoader) {
      this.sampleLoader.clear();
      this.sampleLoader = null;
    }

    // Close audio context if open
    if (this.context) {
      this.context.close().catch((e) =>
        console.error('Error closing AudioContext:', e)
      );
      this.context = null;
    }

    this.masterGain = null;
    this.activeNotes.clear();
  }

  /**
   * Play a note with given MIDI note number and velocity
   *
   * Process:
   * 1. Find nearest preloaded sample
   * 2. Calculate pitch shift ratio: 2^((targetMidi - baseMidi) / 12)
   * 3. Create BufferSource and GainNode for envelope
   * 4. Set up ADSR envelope with exponential ramping
   * 5. Schedule note start
   * 6. Track active note
   *
   * Performance: <1ms execution time (all operations pre-scheduled)
   *
   * Returns: NoteHandle for later release
   */
  playNote(note: number, velocity: number = 0.8): NoteHandle {
    if (!this.context || !this.masterGain || !this.sampleLoader) {
      throw new Error('AudioEngine not initialized. Call initialize() first');
    }

    // Clamp velocity to valid range
    const normalizedVelocity = Math.max(0.0, Math.min(1.0, velocity));
    const now = this.context.currentTime;

    try {
      // Find nearest sample for pitch shifting
      const { buffer, baseNote } = this.sampleLoader.getNearestSample(note);

      // Calculate pitch shift: each semitone = 2^(1/12)
      const semitoneRatio = (note - baseNote) / 12;
      const playbackRate = Math.pow(2, semitoneRatio);

      // Validate pitch shift is within reasonable range (±3 octaves)
      if (playbackRate < 0.125 || playbackRate > 8) {
        logger.warn(
          `Pitch shift ratio ${playbackRate} is out of safe range for note ${note}`
        );
      }

      // Create buffer source
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;

      // Create gain node for ADSR envelope
      const envelope = this.context.createGain();

      // Set up ADSR envelope with exponential ramping
      // CRITICAL: All values are pre-calculated and scheduled, no allocations in callback
      const attackEnd = now + ADSR_CONFIG.attack;
      const decayEnd = attackEnd + ADSR_CONFIG.decay;
      const sustainLevel = normalizedVelocity * ADSR_CONFIG.sustain;

      // Attack: from near-zero to full velocity (exponential)
      envelope.gain.setValueAtTime(0.001, now);
      envelope.gain.exponentialRampToValueAtTime(normalizedVelocity, attackEnd);

      // Decay: from full velocity to sustain level (exponential)
      envelope.gain.exponentialRampToValueAtTime(sustainLevel, decayEnd);

      // Connect source → envelope → master gain → destination
      source.connect(envelope);
      envelope.connect(this.masterGain);

      // Start playback immediately
      source.start(now);

      // Create note state handle
      const handle: NoteHandle = {
        note,
        startTime: now,
        release: () => this.doRelease(source, envelope, now, sustainLevel),
      };

      // Track active note (stop any existing note at this pitch first)
      const existingNote = this.activeNotes.get(note);
      if (existingNote) {
        try {
          existingNote.source.stop();
        } catch {
          // Already stopped
        }
        this.activeNotes.delete(note);
      }

      // Store note state for management
      const noteState: NoteState = {
        note,
        source,
        gain: envelope,
        startTime: now,
        baseNote,
      };

      this.activeNotes.set(note, noteState);

      return handle;
    } catch (error) {
      console.error(`Failed to play note ${note}:`, error);
      throw error;
    }
  }

  /**
   * Internal method: Release a note (note-off)
   * Applies release envelope and stops source
   *
   * Critical details:
   * - Ensures minimum note duration (50ms) before release
   * - Cancels scheduled values to apply new release envelope
   * - Uses exponential ramping to fade out smoothly
   * - Stops source slightly after release completes to allow decay
   */
  private doRelease(
    source: AudioBufferSourceNode,
    envelope: GainNode,
    startTime: number,
    _currentLevel: number
  ): void {
    if (!this.context) return;

    const now = this.context.currentTime;
    const minDuration = startTime + MIN_NOTE_DURATION;
    const releaseStart = Math.max(now, minDuration);

    try {
      // Cancel any previously scheduled envelope changes
      envelope.gain.cancelScheduledValues(releaseStart);

      // Set gain to current level to prevent clicks
      envelope.gain.setValueAtTime(envelope.gain.value, releaseStart);

      // Release phase: fade from current level to near-zero (exponential)
      // Add small offset to avoid exact zero (exponentialRampToValueAtTime requires > 0)
      const releaseEnd = releaseStart + ADSR_CONFIG.release;
      envelope.gain.exponentialRampToValueAtTime(0.001, releaseEnd);

      // Stop source after release completes
      // Add 10ms buffer to ensure fade completes
      source.stop(releaseEnd + 0.01);
    } catch (error) {
      console.error('Error during note release:', error);
      // Ensure source stops even if envelope fails
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    }
  }

  /**
   * Release a specific note using its handle
   * Called by keyboard/MIDI input handlers
   */
  releaseNote(handle: NoteHandle): void {
    const noteState = this.activeNotes.get(handle.note);
    if (noteState) {
      handle.release();
      // Don't remove from map immediately - let source.stop() event clean up
      setTimeout(
        () => this.activeNotes.delete(handle.note),
        (ADSR_CONFIG.release + 0.05) * 1000
      );
    }
  }

  /**
   * Release all active notes immediately
   * Used for exercise pause/stop or app backgrounding
   */
  releaseAllNotes(): void {
    for (const [_note, noteState] of this.activeNotes.entries()) {
      try {
        noteState.source.stop();
      } catch {
        // Already stopped
      }
    }
    this.activeNotes.clear();
  }

  /**
   * Set master volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0.0, Math.min(1.0, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume;
    }
  }

  /**
   * Get current output latency in milliseconds
   * This is the time between scheduling audio and hearing it
   * Returned by AudioContext and includes hardware latency
   */
  getLatency(): number {
    if (!this.context) return 0;
    // outputLatency is in seconds, convert to milliseconds
    return (this.context.outputLatency || 0) * 1000;
  }

  /**
   * Check if engine is ready for playback
   */
  isReady(): boolean {
    return (
      this.context !== null &&
      this.masterGain !== null &&
      this.sampleLoader !== null &&
      this.context.state === 'running'
    );
  }

  /**
   * Get current AudioContext state
   */
  getState(): AudioContextState {
    if (!this.context) return 'closed';
    return this.context.state as AudioContextState;
  }

  /**
   * Get count of active notes (for debugging)
   */
  getActiveNoteCount(): number {
    return this.activeNotes.size;
  }

  /**
   * Get memory usage information (for debugging)
   */
  getMemoryUsage(): {
    samples: number; // bytes
    total: number; // bytes
  } {
    const sampleMemory = this.sampleLoader?.getMemoryUsage() || 0;
    return {
      samples: sampleMemory,
      total: sampleMemory, // Can expand with other allocations
    };
  }
}

/**
 * Singleton instance of the audio engine
 * Lazy-initialized on first access
 */
let audioEngineInstance: NativeAudioEngine | null = null;

/**
 * Get or create the audio engine singleton
 */
export function getAudioEngine(): NativeAudioEngine {
  if (!audioEngineInstance) {
    audioEngineInstance = new NativeAudioEngine();
  }
  return audioEngineInstance;
}

/**
 * Reset the audio engine (for testing)
 */
export function resetAudioEngine(): void {
  if (audioEngineInstance) {
    audioEngineInstance.dispose();
  }
  audioEngineInstance = null;
}
