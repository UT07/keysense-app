/**
 * Expo Audio Engine — Round-Robin Sound Pool
 *
 * Uses expo-av with a round-robin pool of Audio.Sound objects per note.
 * Each note gets VOICES_PER_NOTE sound objects. On each play, we cycle
 * to the next voice using replayAsync() which atomically resets and plays.
 * This eliminates the stop/play race condition that caused dropped notes.
 * Notes sustain until released (key up stops the sound).
 *
 * Middle C (MIDI 60) = 261.63 Hz is the base note.
 * Other notes use playback rate shifting: rate = 2^((note - 60) / 12)
 */

import { Audio, AVPlaybackSource } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import type { IAudioEngine, NoteHandle, AudioContextState } from './types';

const BASE_MIDI_NOTE = 60;
const BASE_FREQUENCY = 261.63;
const SAMPLE_RATE = 44100;
const DURATION = 5.0; // seconds — long enough for sustained key holds
const VOICES_PER_NOTE = 2; // Round-robin voices per note

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

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const freq = BASE_FREQUENCY;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 1.0);
    const attack = Math.min(1.0, t / 0.01);
    const fundamental = Math.sin(2 * Math.PI * freq * t);
    const harmonic2 = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t);
    const harmonic3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);
    const harmonic4 = 0.1 * Math.sin(2 * Math.PI * freq * 4 * t);
    const sample = (fundamental + harmonic2 + harmonic3 + harmonic4) / 1.85;
    const amplitude = sample * envelope * attack * 0.8;
    const clamped = Math.max(-1, Math.min(1, amplitude));
    view.setInt16(headerSize + i * 2, Math.floor(clamped * 32767), true);
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;

    output += alphabet[(triple >> 18) & 0x3f];
    output += alphabet[(triple >> 12) & 0x3f];
    output += i + 1 < bytes.length ? alphabet[(triple >> 6) & 0x3f] : '=';
    output += i + 2 < bytes.length ? alphabet[triple & 0x3f] : '=';
  }

  return output;
}

/**
 * Round-robin voice pool for a single note.
 * Contains VOICES_PER_NOTE sound objects that cycle on each play.
 */
interface NoteVoicePool {
  sounds: Audio.Sound[];
  nextVoice: number; // Index of the next voice to use
}

// Notes to pre-load: C3 through C5 — covers all lesson ranges
const PRELOAD_NOTES = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
                       60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72];

export class ExpoAudioEngine implements IAudioEngine {
  private initialized = false;
  private volume = 0.8;
  private soundSource: AVPlaybackSource | null = null;
  private voicePools: Map<number, NoteVoicePool> = new Map();
  private activeNotes: Set<number> = new Set();
  /** Track which voice is currently playing for each note, so release can stop it */
  private activeVoices: Map<number, Audio.Sound> = new Map();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const totalStart = Date.now();

    try {
      const audioModeStart = Date.now();
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      console.log(`[ExpoAudioEngine] Audio mode configured (${Date.now() - audioModeStart}ms)`);

      // Generate and write base WAV
      const wavStart = Date.now();
      const wavBuffer = generatePianoWav();
      console.log(`[ExpoAudioEngine] WAV generated: ${wavBuffer.byteLength} bytes (${Date.now() - wavStart}ms)`);

      const writeStart = Date.now();
      const base64 = arrayBufferToBase64(wavBuffer);
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        throw new Error('FileSystem.cacheDirectory is null');
      }
      const fileUri = cacheDir + 'piano-tone.wav';
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      console.log(`[ExpoAudioEngine] WAV written: ${fileUri}, exists=${fileInfo.exists} (${Date.now() - writeStart}ms)`);

      this.soundSource = { uri: fileUri };

      // Pre-create round-robin voice pools
      const poolStart = Date.now();
      await this.preloadVoicePools();
      const poolMs = Date.now() - poolStart;

      this.initialized = true;

      // Pool health report
      const loadedCount = this.voicePools.size;
      const expectedCount = PRELOAD_NOTES.length;
      const totalVoices = loadedCount * VOICES_PER_NOTE;
      console.log(
        `[ExpoAudioEngine] Pool health: ${loadedCount}/${expectedCount} notes loaded, ` +
        `${totalVoices} total voices (${poolMs}ms)`
      );

      const totalMs = Date.now() - totalStart;
      console.log(`[ExpoAudioEngine] Initialized in ${totalMs}ms (${loadedCount} notes x ${VOICES_PER_NOTE} voices)`);

      await this.warmUpAudio();
    } catch (error) {
      console.error('[ExpoAudioEngine] Initialization failed:', error);
      throw error;
    }
  }

  private async warmUpAudio(): Promise<void> {
    const warmStart = Date.now();
    try {
      const pool = this.voicePools.get(60);
      if (pool) {
        await pool.sounds[0].replayAsync({
          positionMillis: 0,
          volume: 0.01,
          shouldPlay: true,
        });
        setTimeout(() => {
          pool.sounds[0].stopAsync().catch(() => {});
        }, 50);
        console.log(`[ExpoAudioEngine] Audio warm-up complete (${Date.now() - warmStart}ms)`);
      } else {
        console.warn('[ExpoAudioEngine] Warm-up skipped: no pool for note 60');
      }
    } catch (error) {
      console.warn(`[ExpoAudioEngine] Warm-up failed after ${Date.now() - warmStart}ms (non-critical):`, error);
    }
  }

  /**
   * Create VOICES_PER_NOTE Audio.Sound objects per note, each pre-configured
   * with the correct playback rate. On play, we just call replayAsync().
   */
  private async preloadVoicePools(): Promise<void> {
    if (!this.soundSource) return;

    const loadPromises = PRELOAD_NOTES.map(async (note) => {
      try {
        const rate = Math.pow(2, (note - BASE_MIDI_NOTE) / 12);
        const clampedRate = Math.max(0.25, Math.min(4.0, rate));
        const sounds: Audio.Sound[] = [];

        for (let v = 0; v < VOICES_PER_NOTE; v++) {
          const { sound } = await Audio.Sound.createAsync(
            this.soundSource!,
            {
              shouldPlay: false,
              volume: this.volume,
              rate: clampedRate,
              shouldCorrectPitch: false,
            }
          );
          sounds.push(sound);
        }

        this.voicePools.set(note, { sounds, nextVoice: 0 });
      } catch (error) {
        console.warn(`[ExpoAudioEngine] Failed to pre-load note ${note}:`, error);
      }
    });

    await Promise.all(loadPromises);

    const loadedCount = this.voicePools.size;
    const expectedCount = PRELOAD_NOTES.length;
    if (loadedCount < expectedCount) {
      const missingNotes = PRELOAD_NOTES.filter(n => !this.voicePools.has(n));
      console.error(
        `[ExpoAudioEngine] WARNING: Only ${loadedCount}/${expectedCount} note pools loaded. ` +
        `Missing notes: [${missingNotes.join(', ')}]. Audio may be unreliable on these notes.`
      );
    }
  }

  async suspend(): Promise<void> {
    for (const [, pool] of this.voicePools) {
      for (const sound of pool.sounds) {
        sound.stopAsync().catch(() => {});
      }
    }
  }

  async resume(): Promise<void> {
    // One-shot sounds, nothing to resume
  }

  dispose(): void {
    for (const [, pool] of this.voicePools) {
      for (const sound of pool.sounds) {
        sound.unloadAsync().catch(() => {});
      }
    }
    this.voicePools.clear();
    this.activeNotes.clear();
    this.activeVoices.clear();
    this.soundSource = null;
    this.initialized = false;
    console.log('[ExpoAudioEngine] Disposed');
  }

  /**
   * Play a note using the round-robin voice pool.
   *
   * Key design: replayAsync() is a SINGLE atomic bridge call that resets
   * position and starts playback. No race condition between stop + play.
   * Round-robin ensures rapid re-triggers of the same note always have
   * a fresh voice available (voice 0 may still be fading while voice 1 plays).
   */
  playNote(note: number, velocity: number = 0.8): NoteHandle {
    if (!this.initialized || !this.soundSource) {
      console.warn(`[ExpoAudioEngine] playNote(${note}) skipped: initialized=${this.initialized}, soundSource=${!!this.soundSource}, pools=${this.voicePools.size}`);
      return {
        note,
        startTime: Date.now() / 1000,
        release: () => {},
      };
    }

    const clampedVelocity = Math.max(0.1, Math.min(1.0, velocity));
    const startTime = Date.now() / 1000;
    const vol = clampedVelocity * this.volume;

    const pool = this.voicePools.get(note);
    if (pool) {
      // Round-robin: pick the next voice and advance the index
      const voice = pool.sounds[pool.nextVoice];
      pool.nextVoice = (pool.nextVoice + 1) % pool.sounds.length;

      // Track which voice is playing this note so release can stop it
      this.activeVoices.set(note, voice);

      // Fire-and-forget: replayAsync atomically resets and plays
      voice.replayAsync({
        positionMillis: 0,
        volume: vol,
        shouldPlay: true,
      }).catch(() => {
        // If replay fails, try the other voice
        const fallbackVoice = pool.sounds[pool.nextVoice];
        this.activeVoices.set(note, fallbackVoice);
        fallbackVoice.replayAsync({
          positionMillis: 0,
          volume: vol,
          shouldPlay: true,
        }).catch(() => {});
      });

      this.activeNotes.add(note);
    } else {
      // Non-pooled note: create on the fly (higher latency)
      const rate = Math.pow(2, (note - BASE_MIDI_NOTE) / 12);
      const clampedRate = Math.max(0.25, Math.min(4.0, rate));
      this.createAndPlaySound(note, clampedRate, clampedVelocity);
    }

    return {
      note,
      startTime,
      release: () => this.doRelease(note),
    };
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
          shouldCorrectPitch: false,
        }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if ('didJustFinish' in status && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          this.activeNotes.delete(note);
        }
      });

      this.activeNotes.add(note);
    } catch (error) {
      console.error(`[ExpoAudioEngine] Failed to play note ${note}:`, error);
    }
  }

  private doRelease(note: number): void {
    this.activeNotes.delete(note);

    // Stop the voice that's playing this note
    const voice = this.activeVoices.get(note);
    if (voice) {
      this.activeVoices.delete(note);
      voice.stopAsync().catch(() => {});
    }
  }

  releaseNote(handle: NoteHandle): void {
    this.doRelease(handle.note);
  }

  releaseAllNotes(): void {
    for (const [, pool] of this.voicePools) {
      for (const sound of pool.sounds) {
        sound.stopAsync().catch(() => {});
      }
    }
    this.activeNotes.clear();
    this.activeVoices.clear();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  getLatency(): number {
    return 20;
  }

  isReady(): boolean {
    return this.initialized;
  }

  getState(): AudioContextState {
    return this.initialized ? 'running' : 'closed';
  }

  getActiveNoteCount(): number {
    return this.activeNotes.size;
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
