/**
 * Expo Audio Engine
 * Uses expo-av for audio playback on Expo Go / simulator
 *
 * Strategy: Generates a sine wave WAV in-memory, writes it to cache,
 * then plays it with different rates for pitch shifting.
 *
 * Middle C (MIDI 60) = 261.63 Hz is the base note.
 * Other notes are played by adjusting the playback rate:
 *   rate = 2^((targetMidi - 60) / 12)
 */

import { Audio, AVPlaybackSource } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import type { IAudioEngine, NoteHandle, AudioContextState } from './types';

const BASE_MIDI_NOTE = 60; // Middle C
const BASE_FREQUENCY = 261.63; // Hz
const SAMPLE_RATE = 44100;
const DURATION = 1.5; // seconds
const MAX_POLYPHONY = 8;

/**
 * Generate a WAV file buffer containing a piano-like tone
 * (sine wave with exponential decay and harmonics)
 */
function generatePianoWav(): ArrayBuffer {
  const numSamples = Math.floor(SAMPLE_RATE * DURATION);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM format chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate piano-like waveform: fundamental + harmonics with decay
  const freq = BASE_FREQUENCY;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    // Exponential decay envelope
    const envelope = Math.exp(-t * 3.0);

    // Attack (first 10ms ramp)
    const attack = Math.min(1.0, t / 0.01);

    // Fundamental + harmonics for richer tone
    const fundamental = Math.sin(2 * Math.PI * freq * t);
    const harmonic2 = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t);
    const harmonic3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);
    const harmonic4 = 0.1 * Math.sin(2 * Math.PI * freq * 4 * t);

    const sample = (fundamental + harmonic2 + harmonic3 + harmonic4) / 1.85;
    const amplitude = sample * envelope * attack * 0.8;

    // Clamp and convert to 16-bit
    const clamped = Math.max(-1, Math.min(1, amplitude));
    const int16 = Math.floor(clamped * 32767);
    view.setInt16(headerSize + i * 2, int16, true);
  }

  return buffer;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface ActiveSound {
  sound: Audio.Sound;
  note: number;
  startTime: number;
}

// Pre-loaded sound pool for instant replay (no async gap)
interface PooledSound {
  sound: Audio.Sound;
  note: number;
  ready: boolean;
}

// Notes to pre-load: C4 (60) through B4 (71) — covers Lesson 1 range
const PRELOAD_NOTES = [48, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72];

export class ExpoAudioEngine implements IAudioEngine {
  private initialized = false;
  private volume = 0.8;
  private activeSounds: Map<number, ActiveSound> = new Map();
  private soundSource: AVPlaybackSource | null = null;
  private soundPool: Map<number, PooledSound> = new Map();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Configure audio session for low-latency playback
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      console.log('[ExpoAudioEngine] Audio mode configured');

      // Generate the base piano tone WAV and write to temp file
      // (iOS AVURLAsset does not support data: URIs — must use file://)
      const wavBuffer = generatePianoWav();
      console.log(`[ExpoAudioEngine] WAV generated: ${wavBuffer.byteLength} bytes`);

      const base64 = arrayBufferToBase64(wavBuffer);
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        throw new Error('FileSystem.cacheDirectory is null — cannot write audio file');
      }
      const fileUri = cacheDir + 'piano-tone.wav';
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Verify the file was written
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      console.log(`[ExpoAudioEngine] WAV file written: ${fileUri}, exists=${fileInfo.exists}, size=${fileInfo.exists ? (fileInfo as { size: number }).size : 0}`);

      this.soundSource = { uri: fileUri };

      // Pre-create sound objects for common notes (sound pool)
      await this.preloadSoundPool();

      this.initialized = true;
      console.log(`[ExpoAudioEngine] Initialized successfully with ${this.soundPool.size}/${PRELOAD_NOTES.length} pre-loaded sounds`);

      // Play a brief silent test to warm up the audio pipeline
      await this.warmUpAudio();
    } catch (error) {
      console.error('[ExpoAudioEngine] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Warm up the audio pipeline by playing a note at zero volume.
   * iOS requires the first audio play to happen from a user gesture context,
   * but in Expo Go this usually works from initialization.
   */
  private async warmUpAudio(): Promise<void> {
    try {
      const pooled = this.soundPool.get(60); // Middle C
      if (pooled) {
        await pooled.sound.setStatusAsync({
          positionMillis: 0,
          volume: 0.01, // Near-silent
          shouldPlay: true,
        });
        // Stop after a brief moment
        setTimeout(() => {
          pooled.sound.stopAsync().catch(() => {});
        }, 50);
        console.log('[ExpoAudioEngine] Audio warm-up complete');
      }
    } catch (error) {
      console.warn('[ExpoAudioEngine] Audio warm-up failed (non-critical):', error);
    }
  }

  /**
   * Pre-load Audio.Sound objects for the most-used note range.
   * These can be replayed instantly via replayAsync() without
   * the async overhead of Audio.Sound.createAsync().
   */
  private async preloadSoundPool(): Promise<void> {
    if (!this.soundSource) return;

    const loadPromises = PRELOAD_NOTES.map(async (note) => {
      try {
        const rate = Math.pow(2, (note - BASE_MIDI_NOTE) / 12);
        const clampedRate = Math.max(0.25, Math.min(4.0, rate));

        const { sound } = await Audio.Sound.createAsync(
          this.soundSource!,
          {
            shouldPlay: false,
            volume: this.volume,
            rate: clampedRate,
            shouldCorrectPitch: false,
          }
        );

        this.soundPool.set(note, { sound, note, ready: true });
      } catch (error) {
        console.warn(`[ExpoAudioEngine] Failed to pre-load note ${note}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  async suspend(): Promise<void> {
    // Pause all active sounds
    for (const [, active] of this.activeSounds) {
      try {
        await active.sound.pauseAsync();
      } catch {
        // Already stopped
      }
    }
  }

  async resume(): Promise<void> {
    // Nothing to resume - sounds are one-shot
  }

  dispose(): void {
    this.releaseAllNotes();
    // Unload pooled sounds
    for (const [, pooled] of this.soundPool) {
      pooled.sound.unloadAsync().catch(() => {});
    }
    this.soundPool.clear();
    this.soundSource = null;
    this.initialized = false;
    console.log('[ExpoAudioEngine] Disposed');
  }

  playNote(note: number, velocity: number = 0.8): NoteHandle {
    if (!this.initialized || !this.soundSource) {
      console.warn(`[ExpoAudioEngine] Not initialized (init=${this.initialized}, source=${!!this.soundSource}), skipping note ${note}`);
      return {
        note,
        startTime: Date.now() / 1000,
        release: () => {},
      };
    }

    // Enforce polyphony limit — evict by oldest startTime
    if (this.activeSounds.size >= MAX_POLYPHONY) {
      let oldestNote = -1;
      let oldestTime = Infinity;
      for (const [n, active] of this.activeSounds) {
        if (active.startTime < oldestTime) {
          oldestTime = active.startTime;
          oldestNote = n;
        }
      }
      if (oldestNote >= 0) {
        this.doRelease(oldestNote);
      }
    }

    // Stop existing note at same pitch
    if (this.activeSounds.has(note)) {
      this.doRelease(note);
    }

    const clampedVelocity = Math.max(0.1, Math.min(1.0, velocity));
    const startTime = Date.now() / 1000;

    // Try sound pool first (near-synchronous replay)
    const pooled = this.soundPool.get(note);
    if (pooled?.ready) {
      this.replayPooledSound(pooled, note, clampedVelocity, startTime);
    } else {
      // Fallback: fire-and-forget async sound creation for non-pooled notes
      const rate = Math.pow(2, (note - BASE_MIDI_NOTE) / 12);
      const clampedRate = Math.max(0.25, Math.min(4.0, rate));
      this.createAndPlaySound(note, clampedRate, clampedVelocity);
    }

    const handle: NoteHandle = {
      note,
      startTime,
      release: () => this.doRelease(note),
    };

    return handle;
  }

  /**
   * Replay a pre-loaded sound from the pool (minimal latency).
   */
  private replayPooledSound(
    pooled: PooledSound,
    note: number,
    velocity: number,
    startTime: number
  ): void {
    pooled.ready = false;

    // setPositionAsync(0) + playAsync is faster than createAsync
    const vol = velocity * this.volume;
    pooled.sound
      .setStatusAsync({
        positionMillis: 0,
        volume: vol,
        shouldPlay: true,
      })
      .then(() => {
        this.activeSounds.set(note, {
          sound: pooled.sound,
          note,
          startTime,
        });
        pooled.ready = true;
      })
      .catch((err) => {
        console.warn(`[ExpoAudioEngine] Pool replay failed for note ${note} (vol=${vol}):`, err);
        pooled.ready = true;
        // Fallback: try creating a fresh sound
        const rate = Math.pow(2, (note - BASE_MIDI_NOTE) / 12);
        const clampedRate = Math.max(0.25, Math.min(4.0, rate));
        this.createAndPlaySound(note, clampedRate, velocity);
      });
  }

  private async createAndPlaySound(
    note: number,
    rate: number,
    velocity: number
  ): Promise<void> {
    if (!this.soundSource) return;

    try {
      const { sound } = await Audio.Sound.createAsync(
        this.soundSource,
        {
          shouldPlay: true,
          volume: velocity * this.volume,
          rate,
          shouldCorrectPitch: false, // We want pitch to change with rate
        }
      );

      // Track the active sound
      this.activeSounds.set(note, {
        sound,
        note,
        startTime: Date.now() / 1000,
      });

      // Auto-cleanup when playback finishes
      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          this.activeSounds.delete(note);
        }
      });
    } catch (error) {
      console.error(`[ExpoAudioEngine] Failed to play note ${note}:`, error);
    }
  }

  private doRelease(note: number): void {
    const active = this.activeSounds.get(note);
    if (active) {
      if (this.soundPool.has(note)) {
        // Pooled sound: stop only, never unload (it will be reused)
        active.sound.stopAsync().catch(() => {});
      } else {
        // Dynamic sound: stop and unload to free memory
        active.sound.stopAsync().then(() => {
          active.sound.unloadAsync().catch(() => {});
        }).catch(() => {});
      }
      this.activeSounds.delete(note);
    }
  }

  releaseNote(handle: NoteHandle): void {
    this.doRelease(handle.note);
  }

  releaseAllNotes(): void {
    for (const [note, active] of this.activeSounds) {
      if (this.soundPool.has(note)) {
        // Pooled sound: stop only, preserve for reuse
        active.sound.stopAsync().catch(() => {});
      } else {
        // Dynamic sound: fully unload
        active.sound.unloadAsync().catch(() => {});
      }
    }
    this.activeSounds.clear();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  getLatency(): number {
    return 30; // expo-av has higher latency than native audio
  }

  isReady(): boolean {
    return this.initialized;
  }

  getState(): AudioContextState {
    return this.initialized ? 'running' : 'closed';
  }

  getActiveNoteCount(): number {
    return this.activeSounds.size;
  }

  getMemoryUsage(): { samples: number; total: number } {
    return { samples: 0, total: 0 };
  }
}

let expoAudioEngineInstance: ExpoAudioEngine | null = null;

export function getAudioEngine(): ExpoAudioEngine {
  if (!expoAudioEngineInstance) {
    expoAudioEngineInstance = new ExpoAudioEngine();
  }
  return expoAudioEngineInstance;
}

export function resetAudioEngine(): void {
  if (expoAudioEngineInstance) {
    expoAudioEngineInstance.dispose();
  }
  expoAudioEngineInstance = null;
}
