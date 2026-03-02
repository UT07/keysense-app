/**
 * MicrophoneInput — High-level microphone-based note input
 *
 * Composes AudioCapture (mic streaming) + YINPitchDetector (pitch detection)
 * + NoteTracker (hysteresis) to emit MidiNoteEvent via the same interface
 * as MidiInput. This allows seamless integration with useExercisePlayback
 * and the scoring engine without any changes.
 *
 * Usage:
 *   const mic = new MicrophoneInput();
 *   await mic.initialize();
 *   mic.onNoteEvent((event) => { ... });
 *   await mic.start();
 *   // ... later
 *   await mic.stop();
 *   mic.dispose();
 */

import type { MidiNoteEvent } from '../core/exercises/types';
import { AudioCapture, requestMicrophonePermission } from './AudioCapture';
import { YINPitchDetector, NoteTracker } from './PitchDetector';
import type { PitchDetectorConfig, NoteTrackerConfig } from './PitchDetector';
import { PolyphonicDetector } from './PolyphonicDetector';
import { MultiNoteTracker } from './MultiNoteTracker';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MicNoteCallback = (event: MidiNoteEvent) => void;

export interface MicrophoneInputConfig {
  /** Pitch detector configuration */
  pitch?: Partial<PitchDetectorConfig>;
  /** Note tracker (hysteresis) configuration */
  tracker?: Partial<NoteTrackerConfig>;
  /** Default velocity for mic-detected notes (0-127, default: 80) */
  defaultVelocity: number;
  /** Extra timing compensation in ms added to timestamps (default: 0) */
  latencyCompensationMs: number;
  /** Detection mode: monophonic (YIN) or polyphonic (ONNX Basic Pitch) */
  mode?: 'monophonic' | 'polyphonic';
}

const DEFAULT_CONFIG: MicrophoneInputConfig = {
  defaultVelocity: 80,
  latencyCompensationMs: 0,
};

/**
 * Relaxed pitch detection preset for ambient mic detection.
 * Speaker-to-mic audio has lower SNR, so we relax thresholds.
 */
const AMBIENT_PITCH_OVERRIDES: Partial<PitchDetectorConfig> = {
  threshold: 0.25,       // Default 0.15 — relaxed for room noise
  minConfidence: 0.5,    // Default 0.7 — speaker audio has lower confidence
};

/**
 * Relaxed tracker preset for ambient mic detection.
 * Longer onset hold prevents false triggers from noise bursts.
 */
const AMBIENT_TRACKER_OVERRIDES: Partial<NoteTrackerConfig> = {
  onsetHoldMs: 60,       // Default 40 — slightly longer to reject noise
  releaseHoldMs: 120,    // Default 80 — speaker resonance sustains longer
};

// ---------------------------------------------------------------------------
// MicrophoneInput
// ---------------------------------------------------------------------------

export class MicrophoneInput {
  private readonly config: MicrophoneInputConfig;
  private readonly capture: AudioCapture;
  private readonly detector: YINPitchDetector;
  private readonly tracker: NoteTracker;
  private polyDetector: PolyphonicDetector | null = null;
  private multiTracker: MultiNoteTracker | null = null;
  private mode: 'monophonic' | 'polyphonic';
  private callbacks: Set<MicNoteCallback> = new Set();
  private unsubCapture: (() => void) | null = null;
  private unsubTracker: (() => void) | null = null;
  private unsubMultiTracker: (() => void) | null = null;
  private isActive = false;
  private detectionCount = 0;
  private voicedCount = 0;
  private polyBusy = false; // BUG-016 fix: back-pressure flag for async polyphonic detection

  constructor(config?: Partial<MicrophoneInputConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.mode = config?.mode ?? 'monophonic';

    const sampleRate = this.config.pitch?.sampleRate ?? 44100;
    const bufferSize = this.config.pitch?.bufferSize ?? 2048;

    this.capture = new AudioCapture({ sampleRate, bufferSize });

    // Merge user overrides with ambient presets for better speaker-to-mic detection
    const pitchConfig = {
      sampleRate,
      bufferSize,
      ...AMBIENT_PITCH_OVERRIDES,
      ...this.config.pitch,
    };
    const trackerConfig = {
      ...AMBIENT_TRACKER_OVERRIDES,
      ...this.config.tracker,
    };

    this.detector = new YINPitchDetector(pitchConfig);
    this.tracker = new NoteTracker(trackerConfig);

    logger.log(
      `[MicrophoneInput] Created in ${this.mode} mode, pitchConfig: threshold=${pitchConfig.threshold}, ` +
      `minConfidence=${pitchConfig.minConfidence}, trackerConfig: onsetHold=${trackerConfig.onsetHoldMs}ms`
    );
  }

  /** Get the current detection mode */
  getMode(): 'monophonic' | 'polyphonic' {
    return this.mode;
  }

  /**
   * Initialize microphone capture and pitch detection pipeline.
   * Does NOT request permission — call requestMicrophonePermission() first.
   */
  async initialize(): Promise<void> {
    await this.capture.initialize();

    // Try polyphonic mode if requested
    if (this.mode === 'polyphonic') {
      try {
        this.polyDetector = new PolyphonicDetector();
        await this.polyDetector.initialize();
        this.multiTracker = new MultiNoteTracker({ onsetHoldMs: 30, releaseHoldMs: 60 });
        logger.log('[MicrophoneInput] Polyphonic detection initialized (ONNX Basic Pitch)');
      } catch (err) {
        logger.warn('[MicrophoneInput] Polyphonic detection unavailable, falling back to monophonic:', err);
        this.polyDetector?.dispose();
        this.polyDetector = null;
        this.multiTracker = null;
        this.mode = 'monophonic';
      }
    }

    if (this.mode === 'polyphonic' && this.polyDetector && this.multiTracker) {
      // Wire: AudioCapture → PolyphonicDetector → MultiNoteTracker → callbacks
      // BUG-016 fix: Drop incoming buffers when ONNX inference is still running
      // to prevent unbounded promise pile-up and latency growth
      this.unsubCapture = this.capture.onAudioBuffer((samples) => {
        this.detectionCount++;
        if (this.polyBusy) return; // Drop buffer — previous inference still running
        this.polyBusy = true;
        this.polyDetector!.detect(samples).then((frames) => {
          this.polyBusy = false;
          for (const frame of frames) {
            if (frame.notes.length > 0) this.voicedCount++;
            this.multiTracker!.update(frame);
          }
        }).catch(() => {
          this.polyBusy = false;
        });
      });

      this.unsubMultiTracker = this.multiTracker.onNoteEvent((noteEvent) => {
        this._emitNoteEvent(noteEvent);
      });

      logger.log('[MicrophoneInput] Pipeline: AudioCapture → PolyphonicDetector → MultiNoteTracker');
    } else {
      // Wire: AudioCapture → YIN → NoteTracker → callbacks (monophonic)
      this.unsubCapture = this.capture.onAudioBuffer((samples) => {
        const result = this.detector.detect(samples);
        this.detectionCount++;
        if (result.voiced) this.voicedCount++;

        if (this.detectionCount % 100 === 0) {
          logger.log(
            `[MicrophoneInput] Detection stats: ${this.voicedCount}/${this.detectionCount} voiced ` +
            `(${((this.voicedCount / this.detectionCount) * 100).toFixed(1)}%), ` +
            `currentNote=${this.tracker.getCurrentNote()}`
          );
        }

        this.tracker.update(result);
      });

      this.unsubTracker = this.tracker.onNoteEvent((noteEvent) => {
        this._emitNoteEvent(noteEvent);
      });

      logger.log('[MicrophoneInput] Pipeline: AudioCapture → YIN → NoteTracker');
    }
  }

  private _emitNoteEvent(noteEvent: import('./PitchDetector').NoteEvent): void {
    const midiEvent: MidiNoteEvent = {
      type: noteEvent.type,
      note: noteEvent.midiNote,
      velocity: noteEvent.type === 'noteOn' ? this.config.defaultVelocity : 0,
      timestamp: noteEvent.timestamp - this.config.latencyCompensationMs,
      channel: 0,
      inputSource: 'mic',
    };

    for (const cb of this.callbacks) {
      cb(midiEvent);
    }
  }

  /**
   * Start listening for notes via microphone.
   */
  async start(): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;
    this.detectionCount = 0;
    this.voicedCount = 0;
    await this.capture.start();
    logger.log('[MicrophoneInput] Started listening');
  }

  /**
   * Stop listening.
   */
  async stop(): Promise<void> {
    if (!this.isActive) return;
    this.isActive = false;
    this.tracker.reset();
    this.multiTracker?.reset();
    await this.capture.stop();
    logger.log(
      `[MicrophoneInput] Stopped. Final stats: ${this.voicedCount}/${this.detectionCount} voiced`
    );
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    this.stop();
    this.unsubCapture?.();
    this.unsubTracker?.();
    this.unsubMultiTracker?.();
    this.polyDetector?.dispose();
    this.capture.dispose();
    this.callbacks.clear();
    this.unsubCapture = null;
    this.unsubTracker = null;
    this.unsubMultiTracker = null;
    this.polyDetector = null;
    this.multiTracker = null;
  }

  /**
   * Register callback for note events (same shape as MidiInput.onNoteEvent).
   * Returns an unsubscribe function.
   */
  onNoteEvent(callback: MicNoteCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /** Whether the mic is currently active */
  getIsActive(): boolean {
    return this.isActive;
  }

  /** Get estimated latency of the full pipeline in ms */
  getEstimatedLatencyMs(): number {
    // Buffer fill time + detection time + tracker onset hold
    return this.capture.getLatencyMs() + 5 + (this.config.tracker?.onsetHoldMs ?? 60);
  }
}

/**
 * Request mic permission and create a ready-to-use MicrophoneInput.
 * Returns null if permission denied.
 */
export async function createMicrophoneInput(
  config?: Partial<MicrophoneInputConfig>
): Promise<MicrophoneInput | null> {
  logger.log('[MicrophoneInput] Requesting mic permission...');
  const granted = await requestMicrophonePermission();
  if (!granted) {
    logger.warn(
      '[MicrophoneInput] Mic permission denied. ' +
      'Check that NSMicrophoneUsageDescription is set in Info.plist ' +
      'and the user has granted permission in Settings.'
    );
    return null;
  }

  logger.log('[MicrophoneInput] Permission granted, creating MicrophoneInput...');
  try {
    const mic = new MicrophoneInput(config);
    await mic.initialize();
    logger.log('[MicrophoneInput] Ready');
    return mic;
  } catch (error) {
    logger.error('[MicrophoneInput] Failed to create MicrophoneInput:', error);
    return null;
  }
}
