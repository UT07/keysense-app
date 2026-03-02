/**
 * MIDI Event Handler
 * High-performance MIDI event processing with latency optimization
 *
 * Responsibilities:
 * - Convert MIDI events to audio playback commands
 * - Handle velocity mapping (0-127 → 0-1 gain)
 * - Manage sustain pedal state (CC64)
 * - Provide callbacks to exercise validator
 * - Maintain strict <5ms latency budget
 *
 * Event Flow:
 * MIDI Device → Native Module → JS Callback (this) → Audio Engine
 *              (<2ms)           (<3ms)              (async)
 */

import type { MidiNoteEvent } from '../core/exercises/types';
import { logger } from '../utils/logger';

/**
 * Sustain Pedal State
 */
interface SustainState {
  isActive: boolean;
  timestamp: number;
}

/**
 * Active Note Track
 */
interface ActiveNote {
  midiNote: number;
  velocity: number;
  noteOnTime: number;
  isSustained: boolean;
}

/**
 * MIDI Event Handler Configuration
 */
export interface MidiHandlerConfig {
  sustainCCNumber?: number;  // Usually 64
  velocitySensitivity?: 'linear' | 'logarithmic';
  logPerformance?: boolean;
}

/**
 * Note Event Callbacks
 */
export interface NoteEventCallbacks {
  onNoteOn: (note: number, velocity: number, timestamp: number) => void;
  onNoteOff: (note: number, timestamp: number, isSustained: boolean) => void;
  onSustainChange: (isActive: boolean, timestamp: number) => void;
}

/**
 * MIDI Event Handler
 * Processes raw MIDI events with minimal latency
 */
export class MidiEventHandler {
  private config: Required<MidiHandlerConfig>;
  private callbacks: NoteEventCallbacks | null = null;
  private sustain: SustainState = { isActive: false, timestamp: 0 };
  private activeNotes: Map<number, ActiveNote> = new Map(); // key: MIDI note number
  private performanceMarkers: Map<string, number> = new Map();

  constructor(config: MidiHandlerConfig = {}) {
    this.config = {
      sustainCCNumber: config.sustainCCNumber ?? 64,
      velocitySensitivity: config.velocitySensitivity ?? 'linear',
      logPerformance: config.logPerformance ?? false,
    };
  }

  /**
   * Register callbacks for note and sustain events
   */
  registerCallbacks(callbacks: NoteEventCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Process incoming MIDI note event
   * Called from native module callback - MUST be fast (<3ms)
   */
  processMidiNote(event: MidiNoteEvent): void {
    this._markStart('processMidiNote');

    try {
      if (event.type === 'noteOn' && event.velocity > 0) {
        this._handleNoteOn(event);
      } else {
        this._handleNoteOff(event);
      }
    } catch (error) {
      console.error('[MIDI Event] Error processing note:', error);
    }

    this._markEnd('processMidiNote');
  }

  /**
   * Process incoming MIDI control change event
   * Primarily used for sustain pedal (CC64)
   */
  processMidiControlChange(cc: number, value: number, _channel: number): void {
    this._markStart('processControlChange');

    try {
      if (cc === this.config.sustainCCNumber) {
        this._handleSustainChange(value >= 64, Date.now());
      }
    } catch (error) {
      console.error('[MIDI Event] Error processing control change:', error);
    }

    this._markEnd('processControlChange');
  }

  /**
   * Handle note-on event
   */
  private _handleNoteOn(event: MidiNoteEvent): void {
    const { note, velocity, timestamp } = event;

    // Convert MIDI velocity (0-127) to gain (0-1)
    const normalizedVelocity = this._normalizeVelocity(velocity);

    // Store active note
    this.activeNotes.set(note, {
      midiNote: note,
      velocity: normalizedVelocity,
      noteOnTime: timestamp,
      isSustained: false,
    });

    // Dispatch callback
    if (this.callbacks) {
      this.callbacks.onNoteOn(note, normalizedVelocity, timestamp);
    }
  }

  /**
   * Handle note-off event
   */
  private _handleNoteOff(event: MidiNoteEvent): void {
    const { note, timestamp } = event;
    const activeNote = this.activeNotes.get(note);

    if (activeNote) {
      // Check if sustain is active
      const isSustained = this.sustain.isActive;
      activeNote.isSustained = isSustained;

      // If sustain is not active, release immediately
      if (!isSustained) {
        this.activeNotes.delete(note);
      }

      // Dispatch callback
      if (this.callbacks) {
        this.callbacks.onNoteOff(note, timestamp, isSustained);
      }
    }
  }

  /**
   * Handle sustain pedal change
   * When sustain is released, release all sustained notes
   */
  private _handleSustainChange(isActive: boolean, timestamp: number): void {
    const previousState = this.sustain.isActive;
    this.sustain = { isActive, timestamp };

    // If sustain was just released, release all sustained notes
    if (previousState && !isActive) {
      const sustainedNotes: number[] = [];
      this.activeNotes.forEach((note, midiNote) => {
        if (note.isSustained) {
          sustainedNotes.push(midiNote);
        }
      });

      // Release sustained notes
      sustainedNotes.forEach(midiNote => {
        this.activeNotes.delete(midiNote);
        if (this.callbacks) {
          this.callbacks.onNoteOff(midiNote, timestamp, false);
        }
      });
    }

    // Notify about sustain change
    if (this.callbacks) {
      this.callbacks.onSustainChange(isActive, timestamp);
    }
  }

  /**
   * Convert MIDI velocity (0-127) to normalized gain (0-1)
   * Uses linear or logarithmic scaling based on config
   */
  private _normalizeVelocity(velocity: number): number {
    // Clamp velocity to valid range
    const clamped = Math.max(0, Math.min(127, velocity));

    if (this.config.velocitySensitivity === 'logarithmic') {
      // Logarithmic mapping for more natural dynamics
      // Maps 0→0, 64→0.5, 127→1
      return Math.log(clamped + 1) / Math.log(128);
    } else {
      // Linear mapping (default)
      return clamped / 127;
    }
  }

  /**
   * Get currently active notes
   */
  getActiveNotes(): Map<number, ActiveNote> {
    return new Map(this.activeNotes);
  }

  /**
   * Check if a note is currently playing
   */
  isNoteActive(midiNote: number): boolean {
    return this.activeNotes.has(midiNote);
  }

  /**
   * Check sustain pedal state
   */
  isSustainActive(): boolean {
    return this.sustain.isActive;
  }

  /**
   * Clear all active notes (used on reset)
   */
  clearActiveNotes(): void {
    this.activeNotes.clear();
  }

  /**
   * Performance timing helpers (debug only)
   */
  private _markStart(label: string): void {
    if (this.config.logPerformance && __DEV__) {
      this.performanceMarkers.set(`${label}-start`, Date.now());
    }
  }

  private _markEnd(label: string): void {
    if (this.config.logPerformance && __DEV__) {
      const start = this.performanceMarkers.get(`${label}-start`);
      if (start) {
        const duration = Date.now() - start;
        if (duration > 3) {
          logger.warn(`[MIDI Event] ${label} took ${duration}ms (budget: <3ms)`);
        }
      }
    }
  }
}

export default MidiEventHandler;
