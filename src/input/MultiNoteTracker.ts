/**
 * Multi-note hysteresis tracker for polyphonic detection.
 * Tracks up to N simultaneous notes, emitting noteOn/noteOff events
 * with the same NoteEvent interface as the monophonic NoteTracker.
 */

import type { PolyphonicFrame } from './PolyphonicDetector';
import type { NoteEvent } from './PitchDetector';

export interface MultiNoteTrackerConfig {
  onsetHoldMs: number;   // Min time before emitting noteOn (default: 30)
  releaseHoldMs: number; // Min silence before emitting noteOff (default: 60)
}

type NoteEventCallback = (event: NoteEvent) => void;

const DEFAULT_CONFIG: MultiNoteTrackerConfig = {
  onsetHoldMs: 30,
  releaseHoldMs: 60,
};

export class MultiNoteTracker {
  private readonly config: MultiNoteTrackerConfig;
  private activeNotes = new Map<number, { startTime: number; lastSeen: number }>();
  private callbacks = new Set<NoteEventCallback>();

  constructor(config?: Partial<MultiNoteTrackerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  onNoteEvent(callback: NoteEventCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  update(frame: PolyphonicFrame): void {
    const now = frame.timestamp;
    const currentMidiNotes = new Set(frame.notes.map(n => n.midiNote));

    // Check for note releases (active notes no longer in frame)
    for (const [midiNote, state] of this.activeNotes) {
      if (!currentMidiNotes.has(midiNote)) {
        const silenceDuration = now - state.lastSeen;
        if (silenceDuration >= this.config.releaseHoldMs) {
          this.emit({ type: 'noteOff', midiNote, confidence: 0, timestamp: now });
          this.activeNotes.delete(midiNote);
        }
      }
    }

    // Check for new note onsets
    for (const note of frame.notes) {
      const existing = this.activeNotes.get(note.midiNote);
      if (existing) {
        // Update lastSeen for sustained notes
        existing.lastSeen = now;
      } else if (note.isOnset) {
        // New note onset
        this.activeNotes.set(note.midiNote, { startTime: now, lastSeen: now });
        this.emit({
          type: 'noteOn',
          midiNote: note.midiNote,
          confidence: note.confidence,
          timestamp: now,
        });
      }
    }
  }

  reset(): void {
    const now = Date.now();
    for (const [midiNote] of this.activeNotes) {
      this.emit({ type: 'noteOff', midiNote, confidence: 0, timestamp: now });
    }
    this.activeNotes.clear();
  }

  getActiveNotes(): number[] {
    return Array.from(this.activeNotes.keys());
  }

  private emit(event: NoteEvent): void {
    for (const cb of this.callbacks) {
      cb(event);
    }
  }
}
