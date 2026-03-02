/**
 * Web Audio Engine Implementation
 * Uses react-native-audio-api for low-latency oscillator-based synthesis via JSI
 *
 * Strategy: Fundamental + 1 harmonic (2 oscillators) with sustain-while-held
 * - Sine fundamental + one harmonic at half amplitude = warm piano tone
 * - ADSR: quick decay to 20% sustain — notes stay audible while key is held
 * - On key release: 150ms fade-out to silence
 * - 4 audio nodes per keypress: 2 oscillators + 1 harmonic gain + 1 envelope
 * - MAX_POLYPHONY = 10 with O(1) oldest-note eviction
 * - Hard auto-stop at 10s as safety net against stuck notes
 *
 * MIDI note to frequency: 440 * 2^((note - 69) / 12)
 *
 * react-native-audio-api provides Web Audio API nodes via JSI (synchronous, <1ms).
 */

import {
  AudioContext as RNAudioContext,
  OscillatorNode as RNOscillatorNode,
  GainNode as RNGainNode,
} from 'react-native-audio-api';
import type { IAudioEngine, NoteHandle, AudioContextState } from './types';
import { logger } from '../utils/logger';

const DEFAULT_VOLUME = 0.5;
const MAX_POLYPHONY = 10;
const MIN_NOTE_DURATION = 0.05; // 50ms minimum before release
const MAX_NOTE_DURATION = 10.0; // Safety net — oscillators auto-stop after 10s if release never fires

/**
 * ADSR envelope — sustain while key is held
 * Sustain at 20% keeps notes clearly audible while pressed.
 * On key release, the release phase fades to silence in 150ms.
 * Hard stop at MAX_NOTE_DURATION is a safety net against stuck notes.
 */
const ADSR = {
  attack: 0.003,  // 3ms — near-instant attack for percussive feel
  decay: 0.6,     // 600ms — quick decay to sustain level (piano-like attack character)
  sustain: 0.20,  // 20% — clearly audible while key is held
  release: 0.15,  // 150ms — smooth release to avoid clicks
};

/**
 * Convert MIDI note number to frequency in Hz
 * A4 (MIDI 69) = 440 Hz, each semitone = 2^(1/12)
 */
function midiToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * State for a single active note
 * Tracks all oscillators and the shared gain envelope for cleanup
 */
interface ActiveNote {
  note: number;
  oscillators: RNOscillatorNode[];
  harmonicGains: RNGainNode[];
  envelope: RNGainNode;
  startTime: number;
  releaseCallback: () => void;
}

/**
 * WebAudioEngine — Oscillator-based synthesized piano via react-native-audio-api
 * Implements IAudioEngine using JSI-backed Web Audio API nodes (no samples needed)
 */
export class WebAudioEngine implements IAudioEngine {
  private context: RNAudioContext | null = null;
  private masterGain: RNGainNode | null = null;
  /** Limiter gain node — dynamically adjusted to prevent clipping with multiple notes */
  private limiterGain: RNGainNode | null = null;
  private volume: number = DEFAULT_VOLUME;
  private activeNotes: Map<number, ActiveNote> = new Map();
  /** Track oldest active note for O(1) polyphony eviction */
  private oldestNoteKey: number = -1;

  /**
   * Initialize the AudioContext and master gain chain.
   * Uses react-native-audio-api's AudioContext which communicates
   * with native audio via JSI (synchronous, sub-millisecond overhead).
   *
   * Signal chain: [per-note envelopes] → masterGain → limiterGain → destination
   * The limiterGain dynamically adjusts based on active polyphony to prevent clipping.
   */
  async initialize(): Promise<void> {
    if (this.context) {
      logger.warn('[WebAudioEngine] Already initialized');
      return;
    }

    const initStart = Date.now();

    try {
      this.context = new RNAudioContext({
        sampleRate: 44100,
      });

      // Create limiter gain (auto-adjusted by polyphony count) → destination
      this.limiterGain = this.context.createGain();
      this.limiterGain.gain.value = 1.0;
      this.limiterGain.connect(this.context.destination);

      // Create master gain for user volume control → limiter
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.limiterGain);

      const initMs = Date.now() - initStart;
      logger.log(`[WebAudioEngine] Context created in ${initMs}ms (sampleRate=${this.context.sampleRate})`);

      // Attempt to resume the context (may succeed on Android, will be deferred on iOS
      // until first user gesture triggers playNote which has its own resume check)
      if (this.context.state === 'suspended') {
        this.context.resume().catch(() => {
          // Expected on iOS before user gesture — playNote() handles this
        });
      }

      // Pre-warm the audio pipeline to avoid cold-start latency on first real note
      this.warmUpAudio();

      logger.log('[WebAudioEngine] Initialized successfully (react-native-audio-api, 3-harmonic oscillator synthesis)');
    } catch (error) {
      console.error('[WebAudioEngine] Initialization failed:', error);
      this.context = null;
      this.masterGain = null;
      throw new Error(
        `WebAudioEngine initialization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Pre-warm the audio pipeline by playing a near-silent note.
   * iOS AudioContext may be in a "cold" state after creation — the first real
   * note incurs extra latency (~10-30ms) as the audio hardware spins up.
   * Playing a silent note forces the audio graph to activate immediately.
   */
  private warmUpAudio(): void {
    if (!this.context || !this.masterGain) return;

    const warmStart = Date.now();

    try {
      const now = this.context.currentTime;

      // Create a single silent oscillator to prime the pipeline
      const osc = this.context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 440;

      const silentGain = this.context.createGain();
      silentGain.gain.setValueAtTime(0.001, now); // Near-silent
      silentGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.connect(silentGain);
      silentGain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.03); // Stop after 30ms

      const warmMs = Date.now() - warmStart;
      logger.log(`[WebAudioEngine] Audio pipeline pre-warmed in ${warmMs}ms`);
    } catch (error) {
      // Non-critical — first real note will just have slightly higher latency
      logger.warn('[WebAudioEngine] Warm-up failed (non-critical):', error);
    }
  }

  /**
   * Suspend audio context (e.g., when app backgrounds)
   */
  async suspend(): Promise<void> {
    if (this.context && this.context.state === 'running') {
      try {
        await this.context.suspend();
      } catch (error) {
        console.error('[WebAudioEngine] Suspend failed:', error);
      }
    }
  }

  /**
   * Resume audio context after suspend
   */
  async resume(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch (error) {
        console.error('[WebAudioEngine] Resume failed:', error);
      }
    }
  }

  /**
   * Dispose of all audio resources
   * Stops all notes, disconnects nodes, and closes the AudioContext
   */
  dispose(): void {
    this.releaseAllNotes();

    if (this.context) {
      try {
        this.context.close();
      } catch (error) {
        console.error('[WebAudioEngine] Error closing AudioContext:', error);
      }
      this.context = null;
    }

    this.masterGain = null;
    this.limiterGain = null;
    this.activeNotes.clear();
    this.oldestNoteKey = -1;
    logger.log('[WebAudioEngine] Disposed');
  }

  /**
   * Play a note using additive oscillator synthesis
   *
   * Creates a bank of 3 oscillators (fundamental + 2 harmonics) connected
   * through individual gain nodes to a shared ADSR envelope, then into master gain.
   *
   * Signal chain per note (7 nodes total):
   *   OscillatorNode(f0)  → GainNode(1.0/3) ─┐
   *   OscillatorNode(2f0) → GainNode(0.5/3) ─┼─▶ GainNode (ADSR) ─▶ masterGain ─▶ destination
   *   OscillatorNode(3f0) → GainNode(0.2/3) ─┘
   *
   * Returns a NoteHandle for later release
   */
  playNote(note: number, velocity: number = 0.8): NoteHandle {
    if (!this.context || !this.masterGain) {
      throw new Error('WebAudioEngine not initialized. Call initialize() first');
    }

    // iOS requires a user gesture to unlock the AudioContext from suspended state.
    // Resume synchronously on first user-initiated playNote call.
    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    const normalizedVelocity = Math.max(0.0, Math.min(1.0, velocity));
    const now = this.context.currentTime;
    const fundamentalFreq = midiToFrequency(note);

    // Enforce polyphony limit — evict oldest note if at capacity
    // Uses tracked oldestNoteKey for O(1) lookup instead of O(n) scan
    if (this.activeNotes.size >= MAX_POLYPHONY) {
      if (this.oldestNoteKey >= 0 && this.activeNotes.has(this.oldestNoteKey)) {
        this.stopNote(this.oldestNoteKey);
      } else {
        // Fallback: scan for oldest (only if tracking got out of sync)
        let oldestNote = -1;
        let oldestTime = Infinity;
        for (const [n, active] of this.activeNotes) {
          if (active.startTime < oldestTime) {
            oldestTime = active.startTime;
            oldestNote = n;
          }
        }
        if (oldestNote >= 0) {
          this.stopNote(oldestNote);
        }
      }
    }

    // Stop any existing note at the same pitch (re-trigger)
    if (this.activeNotes.has(note)) {
      this.stopNote(note);
    }

    // Create ADSR envelope gain node
    const envelope = this.context.createGain();
    const attackEnd = now + ADSR.attack;

    // No per-note polyphony scaling — the limiterGain node handles this globally.
    // This ensures ALL active notes are attenuated equally when polyphony changes,
    // preventing the asymmetric clipping that occurred when only new notes were scaled.
    const sustainLevel = Math.max(0.001, normalizedVelocity * ADSR.sustain);
    const decayEnd = attackEnd + ADSR.decay;

    // Attack: near-silent -> peak velocity
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.linearRampToValueAtTime(normalizedVelocity, attackEnd);

    // Decay: peak -> sustain level (natural piano decay with slight hold)
    envelope.gain.exponentialRampToValueAtTime(sustainLevel, decayEnd);

    // Fade to silence before hard stop to prevent clicks from abrupt oscillator termination
    const hardStop = now + MAX_NOTE_DURATION;
    const fadeOutStart = hardStop - ADSR.release;
    envelope.gain.setValueAtTime(sustainLevel, fadeOutStart);
    envelope.gain.exponentialRampToValueAtTime(0.001, hardStop);

    // Connect envelope to master gain
    envelope.connect(this.masterGain);

    // Fundamental sine oscillator
    const osc1 = this.context.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = fundamentalFreq;
    osc1.connect(envelope);
    osc1.start(now);
    osc1.stop(hardStop);

    const oscillators: RNOscillatorNode[] = [osc1];
    const harmonicGains: RNGainNode[] = [];

    // Second harmonic (octave) — adds warmth.
    // Reduced from 0.4 to 0.25 to prevent clipping when multiple notes
    // play simultaneously (Web Audio sums signals linearly with no limiter).
    const harmonicFreq = fundamentalFreq * 2;
    if (harmonicFreq < 22000) {
      const harmonicGain = this.context.createGain();
      harmonicGain.gain.value = 0.25;
      harmonicGain.connect(envelope);
      harmonicGains.push(harmonicGain);

      const osc2 = this.context.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = harmonicFreq;
      osc2.connect(harmonicGain);
      osc2.start(now);
      osc2.stop(hardStop);
      oscillators.push(osc2);
    }

    // Create release callback (idempotent — safe to call multiple times)
    let released = false;
    const releaseCallback = (): void => {
      if (released) return;
      released = true;
      this.doRelease(note, oscillators, harmonicGains, envelope, now);
    };

    // Create NoteHandle
    const handle: NoteHandle = {
      note,
      startTime: now,
      release: releaseCallback,
    };

    // Track active note
    this.activeNotes.set(note, {
      note,
      oscillators,
      harmonicGains,
      envelope,
      startTime: now,
      releaseCallback,
    });

    // Update oldest note tracking for O(1) eviction
    this.updateOldestNoteKey();
    // Adjust limiter gain for new polyphony count
    this.updateLimiterGain();

    // Auto-cleanup: disconnect all nodes and remove from map after max duration.
    // This is the safety net for notes that never get explicitly released.
    setTimeout(() => {
      const current = this.activeNotes.get(note);
      if (current && current.startTime === now) {
        for (const osc of current.oscillators) {
          try { osc.disconnect(); } catch { /* noop */ }
        }
        for (const gain of current.harmonicGains) {
          try { gain.disconnect(); } catch { /* noop */ }
        }
        try { current.envelope.disconnect(); } catch { /* noop */ }
        this.activeNotes.delete(note);
        this.updateOldestNoteKey();
      }
    }, (MAX_NOTE_DURATION + ADSR.release + 0.1) * 1000);

    return handle;
  }

  /**
   * Release envelope and stop oscillators for a note
   * Applies the release phase of the ADSR to avoid clicks
   */
  private doRelease(
    note: number,
    oscillators: RNOscillatorNode[],
    harmonicGains: RNGainNode[],
    envelope: RNGainNode,
    startTime: number
  ): void {
    if (!this.context) return;

    const now = this.context.currentTime;
    const minDuration = startTime + MIN_NOTE_DURATION;
    const releaseStart = Math.max(now, minDuration);
    const releaseEnd = releaseStart + ADSR.release;

    try {
      // Cancel any scheduled envelope changes
      envelope.gain.cancelScheduledValues(releaseStart);

      // Set current value to prevent discontinuity
      envelope.gain.setValueAtTime(
        Math.max(0.001, envelope.gain.value),
        releaseStart
      );

      // Release: fade to near-zero
      envelope.gain.exponentialRampToValueAtTime(0.001, releaseEnd);

      // Stop all oscillators after release completes
      for (const osc of oscillators) {
        try {
          osc.stop(releaseEnd + 0.01);
        } catch {
          // Already stopped
        }
      }
    } catch (error) {
      console.error('[WebAudioEngine] Error during note release:', error);
      // Force stop oscillators on error
      for (const osc of oscillators) {
        try {
          osc.stop();
        } catch {
          // Already stopped
        }
      }
    }

    // Disconnect all audio nodes after release + buffer to prevent graph leak.
    // Without this, gain nodes accumulate in the audio graph indefinitely,
    // causing native audio resource exhaustion on long recordings.
    const disconnectDelayMs = (ADSR.release + 0.1) * 1000;
    setTimeout(() => {
      try {
        for (const osc of oscillators) {
          try { osc.disconnect(); } catch { /* already disconnected */ }
        }
        for (const gain of harmonicGains) {
          try { gain.disconnect(); } catch { /* already disconnected */ }
        }
        try { envelope.disconnect(); } catch { /* already disconnected */ }
      } catch {
        // Non-critical cleanup failure
      }

      // Remove from active notes map.
      // CRITICAL: Check startTime to avoid deleting a re-triggered note's entry.
      const current = this.activeNotes.get(note);
      if (current && current.startTime === startTime) {
        this.activeNotes.delete(note);
        this.updateOldestNoteKey();
        this.updateLimiterGain();
      }
    }, disconnectDelayMs);
  }

  /**
   * Immediately stop a note (for eviction or re-trigger, not user release).
   * Applies a micro-fade (5ms) before stopping to prevent audible clicks
   * from abrupt waveform discontinuity (DC offset jump at stop boundary).
   */
  private stopNote(note: number): void {
    const active = this.activeNotes.get(note);
    if (!active) return;

    // Micro-fade: 5ms exponential ramp to near-silence before stopping
    if (this.context) {
      const now = this.context.currentTime;
      const fadeEnd = now + 0.005;
      try {
        active.envelope.gain.cancelScheduledValues(now);
        active.envelope.gain.setValueAtTime(Math.max(0.001, active.envelope.gain.value), now);
        active.envelope.gain.exponentialRampToValueAtTime(0.001, fadeEnd);
      } catch { /* envelope may already be disconnected */ }

      // Schedule stop after fade
      for (const osc of active.oscillators) {
        try { osc.stop(fadeEnd + 0.001); } catch { /* Already stopped */ }
      }

      // Disconnect nodes after fade completes
      setTimeout(() => {
        for (const osc of active.oscillators) {
          try { osc.disconnect(); } catch { /* Already disconnected */ }
        }
        for (const gain of active.harmonicGains) {
          try { gain.disconnect(); } catch { /* Already disconnected */ }
        }
        try { active.envelope.disconnect(); } catch { /* Already disconnected */ }
      }, 10);
    } else {
      // No context: immediate cleanup
      for (const osc of active.oscillators) {
        try { osc.stop(); } catch { /* Already stopped */ }
        try { osc.disconnect(); } catch { /* Already disconnected */ }
      }
      for (const gain of active.harmonicGains) {
        try { gain.disconnect(); } catch { /* Already disconnected */ }
      }
      try { active.envelope.disconnect(); } catch { /* Already disconnected */ }
    }

    this.activeNotes.delete(note);
    this.updateOldestNoteKey();
    this.updateLimiterGain();
  }

  /**
   * Dynamically adjust the limiter gain based on active polyphony count.
   *
   * Without a DynamicsCompressorNode (not available in react-native-audio-api),
   * we prevent clipping by scaling the limiter gain inversely with note count.
   * Formula: gain = 1 / sqrt(max(1, n)) where n = active notes.
   *
   * This ensures all concurrent notes are attenuated equally (unlike per-note
   * scaling which only affected newly-created notes, leaving old ones at full volume).
   *
   * Uses a 10ms ramp to prevent clicks from abrupt gain changes.
   */
  private updateLimiterGain(): void {
    if (!this.limiterGain || !this.context) return;

    const n = this.activeNotes.size;
    // 1/sqrt(n) keeps perceived loudness roughly constant as polyphony increases.
    // With harmonic content (~1.25x per note), this prevents digital clipping.
    const targetGain = n > 0 ? Math.min(1.0, 1.0 / Math.sqrt(n)) : 1.0;
    const now = this.context.currentTime;

    try {
      this.limiterGain.gain.cancelScheduledValues(now);
      this.limiterGain.gain.setValueAtTime(
        Math.max(0.001, this.limiterGain.gain.value),
        now
      );
      this.limiterGain.gain.linearRampToValueAtTime(targetGain, now + 0.01);
    } catch {
      // Fallback: set immediately if ramp fails
      this.limiterGain.gain.value = targetGain;
    }
  }

  /**
   * Recalculate the oldest active note key for O(1) eviction.
   * Called after note addition or removal.
   */
  private updateOldestNoteKey(): void {
    if (this.activeNotes.size === 0) {
      this.oldestNoteKey = -1;
      return;
    }

    let oldestTime = Infinity;
    let oldestKey = -1;
    for (const [n, active] of this.activeNotes) {
      if (active.startTime < oldestTime) {
        oldestTime = active.startTime;
        oldestKey = n;
      }
    }
    this.oldestNoteKey = oldestKey;
  }

  /**
   * Release a specific note via its handle.
   * Always calls handle.release() — the callback captures its own oscillators
   * and envelope in closure, so it works even if the activeNotes entry was
   * cleaned up by a race condition (e.g., rapid re-trigger of the same pitch).
   */
  releaseNote(handle: NoteHandle): void {
    handle.release();
  }

  /**
   * Release all active notes immediately (for pause/stop/cleanup)
   */
  releaseAllNotes(): void {
    for (const [, active] of this.activeNotes) {
      for (const osc of active.oscillators) {
        try { osc.stop(); } catch { /* Already stopped */ }
        try { osc.disconnect(); } catch { /* Already disconnected */ }
      }
      for (const gain of active.harmonicGains) {
        try { gain.disconnect(); } catch { /* Already disconnected */ }
      }
      try { active.envelope.disconnect(); } catch { /* Already disconnected */ }
    }
    this.activeNotes.clear();
    this.oldestNoteKey = -1;
    this.updateLimiterGain();
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
   * Get estimated output latency in milliseconds
   * Oscillator synthesis via JSI has very low latency.
   * With 3-harmonic optimization + pre-warming: ~3-7ms
   */
  getLatency(): number {
    // react-native-audio-api via JSI: ~3-7ms with reduced harmonics
    return 5;
  }

  /**
   * Check if the engine is ready for playback
   */
  isReady(): boolean {
    return this.context !== null && this.masterGain !== null;
  }

  /**
   * Get current AudioContext state
   */
  getState(): AudioContextState {
    if (!this.context) return 'closed';
    return this.context.state as AudioContextState;
  }

  /**
   * Get count of currently active notes (for debugging/monitoring)
   */
  getActiveNoteCount(): number {
    return this.activeNotes.size;
  }

  /**
   * Get memory usage — oscillator synthesis uses minimal memory (no samples)
   */
  getMemoryUsage(): { samples: number; total: number } {
    return { samples: 0, total: 0 };
  }
}
