/**
 * AudioCapture — Microphone audio capture pipeline
 *
 * Uses react-native-audio-api's AudioRecorder for native mic access.
 * Streams audio buffers to registered callbacks for pitch detection.
 *
 * Lifecycle: initialize() → start() → [onAudioBuffer callbacks] → stop() → dispose()
 *
 * Audio session: Uses react-native-audio-api's AudioManager (NOT expo-av) to
 * configure the iOS audio session for recording. This avoids cross-library
 * conflicts where expo-av and react-native-audio-api fight over session config.
 */

import { AudioRecorder, AudioManager } from 'react-native-audio-api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AudioCaptureConfig {
  /** Sample rate in Hz (default: 44100) */
  sampleRate: number;
  /** Buffer size in samples — larger = more latency but lower CPU (default: 2048) */
  bufferSize: number;
}

export type AudioBufferCallback = (samples: Float32Array, timestamp: number) => void;

const DEFAULT_CONFIG: AudioCaptureConfig = {
  sampleRate: 44100,
  bufferSize: 2048,
};

// ---------------------------------------------------------------------------
// AudioCapture
// ---------------------------------------------------------------------------

export class AudioCapture {
  private readonly config: AudioCaptureConfig;
  private recorder: AudioRecorder | null = null;
  private callbacks: Set<AudioBufferCallback> = new Set();
  private isCapturing = false;
  private isInitialized = false;
  private bufferCount = 0;
  private bufferWatchdogTimer: ReturnType<typeof setTimeout> | null = null;
  /** Pre-allocated copy buffer to avoid GC pressure in the audio callback hot path */
  private copyBuffer: Float32Array;

  constructor(config?: Partial<AudioCaptureConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.copyBuffer = new Float32Array(this.config.bufferSize);
  }

  /**
   * Initialize the audio recorder.
   * Must be called before start(). Mic permission should be requested separately.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.recorder = new AudioRecorder({
        sampleRate: this.config.sampleRate,
        bufferLengthInSamples: this.config.bufferSize,
      });
      console.log(
        `[AudioCapture] AudioRecorder created (sampleRate=${this.config.sampleRate}, bufferSize=${this.config.bufferSize})`
      );
    } catch (error) {
      console.error('[AudioCapture] Failed to create AudioRecorder:', error);
      throw new Error(
        `AudioRecorder creation failed: ${(error as Error).message}. ` +
        'The native module may not be available. Try rebuilding the dev build.'
      );
    }

    this.recorder.onAudioReady((event) => {
      if (!this.isCapturing) return;

      // Defensive copy into pre-allocated buffer: getChannelData() may return
      // a reference to a reusable native buffer. Avoids `new Float32Array()` on
      // every callback (~21x/sec) which would cause GC pressure and audio glitches.
      const rawSamples = event.buffer.getChannelData(0);
      const len = Math.min(rawSamples.length, this.copyBuffer.length);
      this.copyBuffer.set(rawSamples.subarray(0, len));
      const samples = this.copyBuffer.subarray(0, len);
      // event.when may be undefined in some react-native-audio-api versions;
      // fall back to Date.now() for a reasonable timestamp
      const timestamp = typeof event.when === 'number' ? event.when * 1000 : Date.now();

      this.bufferCount++;
      // Log first 5 buffers and then every 200th for ongoing diagnostics
      if (this.bufferCount <= 5 || this.bufferCount % 200 === 0) {
        const maxAmp = samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
        console.log(
          `[AudioCapture] Buffer #${this.bufferCount}: ${samples.length} samples, ` +
          `maxAmplitude=${maxAmp.toFixed(4)}, timestamp=${timestamp.toFixed(0)}ms`
        );
      }

      for (const cb of this.callbacks) {
        cb(samples, timestamp);
      }
    });

    this.isInitialized = true;
    console.log('[AudioCapture] Initialized successfully');
  }

  /**
   * Start capturing audio from the microphone.
   * Requires mic permission and prior initialize() call.
   */
  async start(): Promise<void> {
    if (!this.isInitialized || !this.recorder) {
      throw new Error('AudioCapture not initialized. Call initialize() first.');
    }
    if (this.isCapturing) return;

    this.isCapturing = true;
    this.bufferCount = 0;

    try {
      this.recorder.start();
      console.log('[AudioCapture] Recording started');

      // Watchdog: warn if no audio buffers arrive within 3 seconds.
      // This typically indicates the iOS audio session is misconfigured
      // (e.g., still in Playback mode instead of PlayAndRecord).
      this.bufferWatchdogTimer = setTimeout(() => {
        if (this.isCapturing && this.bufferCount === 0) {
          // Use console.warn (not .error) — this is a diagnostic, not a crash.
          // console.error triggers the red error overlay in dev builds.
          console.warn(
            '[AudioCapture] No audio buffers received after 3s. ' +
            'The iOS audio session may not be configured for recording. ' +
            'Check that ensureAudioModeConfigured(true) was awaited before start().'
          );
        }
      }, 3000);
    } catch (error) {
      this.isCapturing = false;
      console.error('[AudioCapture] Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop capturing audio.
   */
  async stop(): Promise<void> {
    if (!this.isCapturing || !this.recorder) return;
    this.isCapturing = false;

    if (this.bufferWatchdogTimer) {
      clearTimeout(this.bufferWatchdogTimer);
      this.bufferWatchdogTimer = null;
    }

    try {
      this.recorder.stop();
      console.log(`[AudioCapture] Recording stopped after ${this.bufferCount} buffers`);
    } catch (error) {
      console.error('[AudioCapture] Failed to stop recording:', error);
    }
  }

  /**
   * Clean up resources.
   */
  dispose(): void {
    if (this.bufferWatchdogTimer) {
      clearTimeout(this.bufferWatchdogTimer);
      this.bufferWatchdogTimer = null;
    }
    if (this.isCapturing) {
      try {
        this.recorder?.stop();
      } catch {
        // Ignore stop errors during dispose
      }
    }
    this.isCapturing = false;
    this.isInitialized = false;
    this.callbacks.clear();
    this.recorder = null;
  }

  /**
   * Register a callback for incoming audio buffers.
   * Returns an unsubscribe function.
   */
  onAudioBuffer(callback: AudioBufferCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /** Whether the capture is currently active */
  getIsCapturing(): boolean {
    return this.isCapturing;
  }

  /** Whether initialize() has been called */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /** Get the configured sample rate */
  getSampleRate(): number {
    return this.config.sampleRate;
  }

  /** Get the configured buffer size */
  getBufferSize(): number {
    return this.config.bufferSize;
  }

  /** Get one buffer's latency in milliseconds */
  getLatencyMs(): number {
    return (this.config.bufferSize / this.config.sampleRate) * 1000;
  }

  /** Get total buffers received since last start() */
  getBufferCount(): number {
    return this.bufferCount;
  }
}

// ---------------------------------------------------------------------------
// Mic permission + session config (react-native-audio-api)
// ---------------------------------------------------------------------------

/**
 * Configure the iOS audio session for microphone recording.
 *
 * Uses react-native-audio-api's AudioManager rather than expo-av so both
 * playback (AudioContext) and recording (AudioRecorder) use the same native
 * AudioSessionManager. This prevents cross-library session conflicts where
 * expo-av sets PlayAndRecord but react-native-audio-api's internal state
 * still thinks the category is Playback.
 */
export function configureAudioSessionForRecording(): void {
  try {
    AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: 'default',
      iosOptions: ['defaultToSpeaker', 'allowBluetooth'],
      iosAllowHaptics: true,
    });
    console.log('[AudioCapture] Audio session configured for playAndRecord (via AudioManager)');
  } catch (error) {
    console.warn('[AudioCapture] Failed to configure audio session via AudioManager:', error);
  }
}

/**
 * Request microphone permission.
 * Returns true if granted, false otherwise.
 *
 * Uses react-native-audio-api's AudioManager for permissions (same native
 * module as the AudioRecorder), with expo-av fallback for broader compatibility.
 */
/** Race a promise against a timeout. Resolves to the promise value or rejects on timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    // Primary: use react-native-audio-api's own permission API (5s timeout)
    const status = await withTimeout(
      AudioManager.requestRecordingPermissions(),
      5000,
      'AudioManager.requestRecordingPermissions',
    );
    console.log(`[AudioCapture] Mic permission request result (AudioManager): ${status}`);
    return status === 'Granted';
  } catch (error) {
    console.warn('[AudioCapture] AudioManager permission request failed, trying expo-av:', error);
    // Fallback to expo-av (also with 5s timeout)
    try {
      const { Audio } = require('expo-av');
      const { status } = await withTimeout<{ status: string }>(
        Audio.requestPermissionsAsync(),
        5000,
        'Audio.requestPermissionsAsync',
      );
      console.log(`[AudioCapture] Mic permission request result (expo-av): ${status}`);
      return status === 'granted';
    } catch (fallbackError) {
      console.error('[AudioCapture] All mic permission request methods failed:', fallbackError);
      return false;
    }
  }
}

/**
 * Check if microphone permission is already granted.
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  try {
    const status = await withTimeout(
      AudioManager.checkRecordingPermissions(),
      3000,
      'AudioManager.checkRecordingPermissions',
    );
    console.log(`[AudioCapture] Mic permission check (AudioManager): ${status}`);
    return status === 'Granted';
  } catch (error) {
    console.warn('[AudioCapture] AudioManager permission check failed, trying expo-av:', error);
    try {
      const { Audio } = require('expo-av');
      const { status } = await withTimeout<{ status: string }>(
        Audio.getPermissionsAsync(),
        3000,
        'Audio.getPermissionsAsync',
      );
      console.log(`[AudioCapture] Mic permission check (expo-av): ${status}`);
      return status === 'granted';
    } catch (fallbackError) {
      console.error('[AudioCapture] All mic permission check methods failed:', fallbackError);
      return false;
    }
  }
}
