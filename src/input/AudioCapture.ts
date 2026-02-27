/**
 * AudioCapture — Microphone audio capture pipeline
 *
 * Uses react-native-audio-api's AudioRecorder for native mic access.
 * Streams audio buffers to registered callbacks for pitch detection.
 *
 * Lifecycle: initialize() → start() → [onAudioBuffer callbacks] → stop() → dispose()
 */

import { AudioRecorder } from 'react-native-audio-api';

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

  constructor(config?: Partial<AudioCaptureConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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

      const samples = event.buffer.getChannelData(0);
      const timestamp = event.when * 1000; // Convert seconds to ms

      this.bufferCount++;
      // Log first few buffers for diagnostics
      if (this.bufferCount <= 3) {
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
// Mic permission helper (expo-av)
// ---------------------------------------------------------------------------

/**
 * Request microphone permission.
 * Returns true if granted, false otherwise.
 * Uses expo-av's Audio.requestPermissionsAsync for cross-platform support.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    // Dynamic import to avoid hard dependency when mic isn't used
    const { Audio } = require('expo-av');
    const { status } = await Audio.requestPermissionsAsync();
    console.log(`[AudioCapture] Mic permission request result: ${status}`);
    return status === 'granted';
  } catch (error) {
    console.error('[AudioCapture] Mic permission request failed:', error);
    return false;
  }
}

/**
 * Check if microphone permission is already granted.
 */
export async function checkMicrophonePermission(): Promise<boolean> {
  try {
    const { Audio } = require('expo-av');
    const { status } = await Audio.getPermissionsAsync();
    console.log(`[AudioCapture] Mic permission check: ${status}`);
    return status === 'granted';
  } catch (error) {
    console.error('[AudioCapture] Mic permission check failed:', error);
    return false;
  }
}
