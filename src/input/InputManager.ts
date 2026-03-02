/**
 * InputManager — Unified input source manager
 *
 * Provides a single note event interface regardless of input source (MIDI, Mic, Touch).
 * Priority order for 'auto' mode: MIDI > Mic > Touch.
 *
 * Usage:
 *   const manager = new InputManager({ preferred: 'auto' });
 *   await manager.initialize();
 *   manager.onNoteEvent((event) => { ... });
 *   await manager.start();
 *   // ... later
 *   await manager.stop();
 *   manager.dispose();
 */

import type { MidiNoteEvent } from '../core/exercises/types';
import { getMidiInput } from './MidiInput';
import type { MidiInput } from './MidiInput';
import { MicrophoneInput, createMicrophoneInput } from './MicrophoneInput';
import { configureAudioSessionForRecording, checkMicrophonePermission } from './AudioCapture';
import { useSettingsStore } from '../stores/settingsStore';

/** Race a promise against a timeout. Resolves to the promise value or the fallback on timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) =>
      setTimeout(() => {
        console.warn(`[InputManager] ${label} timed out after ${ms}ms — using fallback`);
        resolve(fallback);
      }, ms),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InputMethod = 'auto' | 'midi' | 'mic' | 'touch';
export type ActiveInputMethod = 'midi' | 'mic' | 'touch';
export type InputNoteCallback = (event: MidiNoteEvent) => void;

export interface InputManagerConfig {
  /** Which input method to use (default: 'auto') */
  preferred: InputMethod;
  /** Default velocity for mic-detected notes (default: 80) */
  micDefaultVelocity?: number;
  /** Extra timing compensation for mic pipeline in ms (default: 0) */
  micLatencyCompensationMs?: number;
}

const DEFAULT_CONFIG: InputManagerConfig = {
  preferred: 'auto',
  micDefaultVelocity: 80,
  micLatencyCompensationMs: 0,
};

/**
 * Timing tolerance multiplier per input method.
 * Mic detection has ~120ms pipeline latency — widen scoring windows accordingly.
 */
export const INPUT_TIMING_MULTIPLIERS: Record<ActiveInputMethod, number> = {
  midi: 1.0,
  touch: 1.0,
  mic: 1.5,
};

/**
 * Base latency compensation per input method (ms).
 * Subtracted from played-note timestamps before scoring.
 */
export const INPUT_LATENCY_COMPENSATION_MS: Record<string, number> = {
  midi: 0,
  touch: 20,
  mic: 100,
  mic_poly: 120, // Polyphonic adds ~20ms for ONNX inference overhead
};

// ---------------------------------------------------------------------------
// InputManager
// ---------------------------------------------------------------------------

export class InputManager {
  private config: InputManagerConfig;
  private midiInput: MidiInput;
  private micInput: MicrophoneInput | null = null;
  private callbacks: Set<InputNoteCallback> = new Set();
  private unsubMidi: (() => void) | null = null;
  private unsubMic: (() => void) | null = null;
  private _activeMethod: ActiveInputMethod = 'touch';
  private isStarted = false;
  private isInitialized = false;

  constructor(config?: Partial<InputManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.midiInput = getMidiInput();
  }

  /** Reason why mic failed (if it did). Exposed for UI to show user feedback. */
  private _micFailureReason: string | null = null;

  /** Get reason why mic failed to initialize (null if no failure) */
  getMicFailureReason(): string | null {
    return this._micFailureReason;
  }

  /**
   * Initialize available input sources and determine active method.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const preferred = this.config.preferred;
    this._micFailureReason = null;
    console.log(`[InputManager] Initializing with preferred=${preferred}`);

    // Try MIDI first (always init — it's a no-op if no hardware)
    try {
      await this.midiInput.initialize();
    } catch (error) {
      console.warn('[InputManager] MIDI init failed (non-fatal):', error);
    }

    const midiAvailable = this.midiInput.isReady() &&
      (await this.midiInput.getConnectedDevices()).length > 0;
    console.log(`[InputManager] MIDI available: ${midiAvailable}`);

    // Determine active method.
    // Priority: MIDI > Mic (if requested or already permitted) > Touch
    if (preferred === 'midi' || (preferred === 'auto' && midiAvailable)) {
      this._activeMethod = 'midi';
      console.log('[InputManager] Selected: midi');
    } else if (preferred === 'mic' || (preferred === 'auto' && !midiAvailable)) {
      // For 'auto' mode: only try mic if permission is already granted (non-blocking check).
      // For explicit 'mic' mode: always request permission.
      const shouldTryMic = preferred === 'mic' ||
        (preferred === 'auto' && await withTimeout(checkMicrophonePermission(), 2000, false, 'checkMicPermission'));

      if (shouldTryMic) {
        try {
          // Configure react-native-audio-api's AudioManager for PlayAndRecord.
          // IMPORTANT: Do NOT call expo-av's ensureAudioModeConfigured() here — expo-av
          // and react-native-audio-api share the same iOS AVAudioSession singleton but
          // maintain separate internal state.
          console.log('[InputManager] Configuring audio session for recording...');
          configureAudioSessionForRecording();

          const detectionMode = useSettingsStore.getState().micDetectionMode ?? 'monophonic';
          this.micInput = await withTimeout(
            createMicrophoneInput({
              defaultVelocity: this.config.micDefaultVelocity ?? 80,
              latencyCompensationMs: this.config.micLatencyCompensationMs ?? 0,
              mode: detectionMode,
            }),
            4000,
            null,
            'createMicrophoneInput',
          );
          if (this.micInput) {
            this._activeMethod = 'mic';
            console.log(`[InputManager] Selected: mic (${detectionMode} mode, pipeline ready)`);
          } else {
            // Permission denied, initialization failed, or timed out
            this._activeMethod = 'touch';
            this._micFailureReason = 'Microphone permission denied or timed out. Grant access in Settings > Purrrfect Keys.';
            console.warn('[InputManager] Mic failed → falling back to touch. Reason:', this._micFailureReason);
          }
        } catch (error) {
          this._activeMethod = 'touch';
          this._micFailureReason = `Microphone initialization error: ${(error as Error).message}`;
          console.error('[InputManager] Mic init error → falling back to touch:', error);
        }
      } else {
        this._activeMethod = 'touch';
        console.log('[InputManager] Selected: touch (auto mode, mic not pre-granted)');
      }
    } else {
      this._activeMethod = 'touch';
      console.log('[InputManager] Selected: touch');
    }

    // Wire up event forwarding
    this._wireEvents();
    this.isInitialized = true;
    console.log(`[InputManager] Initialized. Active method: ${this._activeMethod}`);
  }

  /**
   * Start listening for note events from the active input method.
   */
  async start(): Promise<void> {
    if (this.isStarted) return;
    this.isStarted = true;

    if (this._activeMethod === 'mic' && this.micInput) {
      await this.micInput.start();
    }
    // MIDI is always "listening" once initialized
  }

  /**
   * Stop listening for note events.
   */
  async stop(): Promise<void> {
    if (!this.isStarted) return;
    this.isStarted = false;

    if (this._activeMethod === 'mic' && this.micInput) {
      await this.micInput.stop();
    }
  }

  /**
   * Clean up all resources.
   */
  dispose(): void {
    this.stop();
    this.unsubMidi?.();
    this.unsubMic?.();
    this.micInput?.dispose();
    this.callbacks.clear();
    this.unsubMidi = null;
    this.unsubMic = null;
    this.micInput = null;
    this.isInitialized = false;
  }

  /**
   * Register callback for note events from the active input source.
   * Returns an unsubscribe function.
   */
  onNoteEvent(callback: InputNoteCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /** Currently active input method */
  get activeMethod(): ActiveInputMethod {
    return this._activeMethod;
  }

  /** Whether the manager has been initialized */
  getIsInitialized(): boolean {
    return this.isInitialized;
  }

  /** Whether the manager is currently listening */
  getIsStarted(): boolean {
    return this.isStarted;
  }

  /** Get timing tolerance multiplier for the current input method */
  getTimingMultiplier(): number {
    return INPUT_TIMING_MULTIPLIERS[this._activeMethod];
  }

  /** Get latency compensation in ms for the current input method */
  getLatencyCompensationMs(): number {
    if (this._activeMethod === 'mic') {
      const detectionMode = useSettingsStore.getState().micDetectionMode ?? 'monophonic';
      return detectionMode === 'polyphonic'
        ? INPUT_LATENCY_COMPENSATION_MS.mic_poly
        : INPUT_LATENCY_COMPENSATION_MS.mic;
    }
    return INPUT_LATENCY_COMPENSATION_MS[this._activeMethod];
  }

  /**
   * Switch to a different input method at runtime.
   * Stops current input, switches, and restarts if was previously started.
   */
  async switchMethod(method: InputMethod): Promise<void> {
    const wasStarted = this.isStarted;
    await this.stop();

    // Unsubscribe current
    this.unsubMidi?.();
    this.unsubMic?.();
    this.unsubMidi = null;
    this.unsubMic = null;

    this.config.preferred = method;

    // Re-determine active method
    this._micFailureReason = null;
    if (method === 'midi') {
      this._activeMethod = 'midi';
    } else if (method === 'mic') {
      if (!this.micInput) {
        try {
          configureAudioSessionForRecording();
          const detectionMode = useSettingsStore.getState().micDetectionMode ?? 'monophonic';
          this.micInput = await withTimeout(
            createMicrophoneInput({
              defaultVelocity: this.config.micDefaultVelocity ?? 80,
              latencyCompensationMs: this.config.micLatencyCompensationMs ?? 0,
              mode: detectionMode,
            }),
            4000,
            null,
            'switchMethod:createMicrophoneInput',
          );
        } catch (error) {
          this._micFailureReason = `Mic init error: ${(error as Error).message}`;
          console.error('[InputManager] switchMethod mic error:', error);
        }
      }
      if (this.micInput) {
        this._activeMethod = 'mic';
      } else {
        this._activeMethod = 'touch';
        if (!this._micFailureReason) {
          this._micFailureReason = 'Microphone permission denied. Grant access in Settings.';
        }
        console.warn('[InputManager] switchMethod: mic failed → touch.', this._micFailureReason);
      }
    } else if (method === 'touch') {
      this._activeMethod = 'touch';
    } else {
      // 'auto' — re-run detection
      const midiAvailable = this.midiInput.isReady() &&
        (await this.midiInput.getConnectedDevices()).length > 0;
      if (midiAvailable) {
        this._activeMethod = 'midi';
      } else if (this.micInput) {
        this._activeMethod = 'mic';
      } else {
        this._activeMethod = 'touch';
      }
    }

    this._wireEvents();

    if (wasStarted) {
      await this.start();
    }
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private _wireEvents(): void {
    // Always subscribe to MIDI (in case device is connected mid-session)
    if (!this.unsubMidi) {
      this.unsubMidi = this.midiInput.onNoteEvent((event) => {
        if (this._activeMethod !== 'midi') return;
        this._emitNote(event);
      });
    }

    // Subscribe to mic if available
    if (this.micInput && !this.unsubMic) {
      this.unsubMic = this.micInput.onNoteEvent((event) => {
        if (this._activeMethod !== 'mic') return;
        this._emitNote(event);
      });
    }
  }

  private _emitNote(event: MidiNoteEvent): void {
    for (const cb of this.callbacks) {
      cb(event);
    }
  }
}

/**
 * Create and initialize an InputManager with the given preferred method.
 */
export async function createInputManager(
  preferred: InputMethod = 'auto'
): Promise<InputManager> {
  const manager = new InputManager({ preferred });
  await manager.initialize();
  return manager;
}
