/**
 * Demo Playback Service
 *
 * Auto-plays an exercise at full tempo with perfect accuracy.
 * Used for the "Watch Demo" feature where the student sees exactly
 * how a piece should be played — correct notes, correct timing.
 *
 * Design decisions:
 * - All notes are played (no skipping — demo must be pedagogically accurate)
 * - No timing jitter (demo shows exact rhythm)
 * - Velocity is 0.7 (not full force — gentle demo feel)
 * - Stateless enough to create fresh instances per exercise attempt
 * - No React imports — pure TypeScript service
 */

import type { Exercise, NoteEvent } from '@/core/exercises/types';
import type { NoteHandle } from '@/audio/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal audio engine interface for demo playback.
 * Matches IAudioEngine.playNote / releaseNote signatures.
 */
interface DemoAudioEngine {
  playNote(note: number, velocity: number): NoteHandle;
  releaseNote(handle: NoteHandle): void;
}

export interface DemoScheduleEntry {
  /** The original note event from the exercise */
  note: NoteEvent;
  /** Whether this note should be played (false = skip, simulating imperfection) */
  play: boolean;
  /** Timing offset in milliseconds (positive = late, negative = early) */
  jitterMs: number;
}

// ============================================================================
// Schedule Generation
// ============================================================================

/**
 * Generate a perfect demo schedule — all notes played, no jitter.
 *
 * @param notes - The exercise's note events
 * @returns Schedule entries, one per note (all marked play: true)
 */
export function generateDemoSchedule(notes: NoteEvent[]): DemoScheduleEntry[] {
  return notes.map((note) => ({ note, play: true, jitterMs: 0 }));
}

// ============================================================================
// Demo Playback Service
// ============================================================================

/**
 * Service that drives demo playback of an exercise.
 *
 * Usage:
 * ```ts
 * const demo = new DemoPlaybackService();
 * demo.start(exercise, audioEngine, 0.6, onBeatUpdate, onActiveNotes);
 * // ...later...
 * demo.stop();
 * ```
 */
export class DemoPlaybackService {
  /** Whether demo playback is currently active */
  isPlaying = false;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private schedule: DemoScheduleEntry[] = [];

  /** Track which notes have been triggered (by schedule index) */
  private scheduledNoteIndices = new Set<number>();
  /** Track which notes have been released (by schedule index) */
  private releasedNoteIndices = new Set<number>();
  /** Map schedule index to audio handle for release */
  private activeHandles = new Map<number, NoteHandle>();

  /**
   * Start demo playback of an exercise.
   *
   * @param exercise - The exercise to play
   * @param audioEngine - Audio engine for sound output
   * @param speedMultiplier - Tempo multiplier (default 1.0 = full speed)
   * @param onBeatUpdate - Called every frame (~16ms) with the current beat position
   * @param onActiveNotes - Called every frame with the Set of currently sounding MIDI notes
   */
  /** Called when demo finishes (auto-stop at end of exercise) */
  private onCompleteCallback?: () => void;
  private audioEngineRef?: DemoAudioEngine;

  start(
    exercise: Pick<Exercise, 'notes' | 'settings'>,
    audioEngine: DemoAudioEngine,
    speedMultiplier: number = 1.0,
    onBeatUpdate?: (beat: number) => void,
    onActiveNotes?: (notes: Set<number>) => void,
    onComplete?: () => void,
  ): void {
    // Clean up any previous playback
    this.stop();

    this.isPlaying = true;
    this.startTime = Date.now();
    this.onCompleteCallback = onComplete;
    this.audioEngineRef = audioEngine;
    this.schedule = generateDemoSchedule(exercise.notes);
    this.scheduledNoteIndices.clear();
    this.releasedNoteIndices.clear();
    this.activeHandles.clear();

    const effectiveTempo = exercise.settings.tempo * speedMultiplier;
    const msPerBeat = 60000 / effectiveTempo;

    // Calculate total duration: last note end + 1 beat buffer, minimum 4 beats
    const totalBeats = Math.max(
      ...exercise.notes.map((n) => n.startBeat + n.durationBeats),
      4,
    );

    this.intervalId = setInterval(() => {
      if (!this.isPlaying) return;

      const elapsed = Date.now() - this.startTime;
      const currentBeat = elapsed / msPerBeat;

      // Report beat position
      onBeatUpdate?.(currentBeat);

      // Process note scheduling
      const activeNotes = new Set<number>();

      for (let i = 0; i < this.schedule.length; i++) {
        const entry = this.schedule[i];
        if (!entry.play) continue;

        // Convert jitter from ms to beats for beat-based comparison
        const jitterBeats = entry.jitterMs / msPerBeat;
        const noteOnBeat = entry.note.startBeat + jitterBeats;
        const noteOffBeat = entry.note.startBeat + entry.note.durationBeats + jitterBeats;

        // Trigger note-on when currentBeat reaches the note's start
        if (!this.scheduledNoteIndices.has(i) && currentBeat >= noteOnBeat) {
          this.scheduledNoteIndices.add(i);
          const handle = audioEngine.playNote(entry.note.note, 0.7);
          this.activeHandles.set(i, handle);
        }

        // Track currently active notes (started but not yet released)
        if (this.scheduledNoteIndices.has(i) && !this.releasedNoteIndices.has(i)) {
          activeNotes.add(entry.note.note);
        }

        // Trigger note-off when currentBeat reaches the note's end
        if (
          this.scheduledNoteIndices.has(i) &&
          !this.releasedNoteIndices.has(i) &&
          currentBeat >= noteOffBeat
        ) {
          this.releasedNoteIndices.add(i);
          const handle = this.activeHandles.get(i);
          if (handle) {
            audioEngine.releaseNote(handle);
          }
          this.activeHandles.delete(i);
        }
      }

      // Report active notes
      onActiveNotes?.(activeNotes);

      // Auto-stop when exercise is complete (totalBeats + 1 beat buffer)
      if (currentBeat > totalBeats + 1) {
        const cb = this.onCompleteCallback;
        this.stop();
        cb?.();
      }
    }, 16); // ~60fps
  }

  /**
   * Stop demo playback and clean up all state.
   * Safe to call multiple times or when not playing.
   */
  stop(): void {
    this.isPlaying = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Release all active notes before clearing — prevents notes ringing forever
    if (this.audioEngineRef) {
      for (const handle of this.activeHandles.values()) {
        this.audioEngineRef.releaseNote(handle);
      }
    }

    // Clean up tracking state
    this.activeHandles.clear();
    this.scheduledNoteIndices.clear();
    this.releasedNoteIndices.clear();
    this.schedule = [];
    this.audioEngineRef = undefined;
    this.onCompleteCallback = undefined;
  }
}
