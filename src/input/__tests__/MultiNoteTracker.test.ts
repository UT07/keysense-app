import { MultiNoteTracker, MultiNoteTrackerConfig } from '../MultiNoteTracker';
import type { PolyphonicFrame } from '../PolyphonicDetector';
import type { NoteEvent } from '../PitchDetector';

describe('MultiNoteTracker', () => {
  let tracker: MultiNoteTracker;
  let events: NoteEvent[];
  const defaultConfig: MultiNoteTrackerConfig = {
    onsetHoldMs: 30,
    releaseHoldMs: 60,
  };

  beforeEach(() => {
    events = [];
    tracker = new MultiNoteTracker(defaultConfig);
    tracker.onNoteEvent((e) => events.push(e));
  });

  function makeFrame(notes: Array<{ midi: number; confidence?: number; onset?: boolean }>, ts?: number): PolyphonicFrame {
    return {
      notes: notes.map(n => ({
        midiNote: n.midi,
        confidence: n.confidence ?? 0.9,
        isOnset: n.onset ?? true,
      })),
      timestamp: ts ?? Date.now(),
    };
  }

  /** Helper: send onset frame then confirmation frame after onsetHoldMs */
  function confirmNote(notes: Array<{ midi: number; confidence?: number }>, baseTs?: number): void {
    const t0 = baseTs ?? Date.now();
    tracker.update(makeFrame(notes.map(n => ({ ...n, onset: true })), t0));
    // Confirmation frame at t0 + onsetHoldMs (sustained, no new onset)
    tracker.update(makeFrame(notes.map(n => ({ ...n, onset: false })), t0 + defaultConfig.onsetHoldMs));
  }

  it('should emit noteOn after onset hold period is met', () => {
    const t0 = 1000;
    tracker.update(makeFrame([{ midi: 60 }], t0));
    // Not yet emitted — still pending
    expect(events).toEqual([]);
    // Confirmation frame after hold period
    tracker.update(makeFrame([{ midi: 60, onset: false }], t0 + 30));
    expect(events).toEqual([
      expect.objectContaining({ type: 'noteOn', midiNote: 60 }),
    ]);
  });

  it('should not emit noteOn for single-frame phantom notes', () => {
    const t0 = 1000;
    tracker.update(makeFrame([{ midi: 60 }], t0));
    // Note disappears in next frame — was a false positive
    tracker.update(makeFrame([], t0 + 20));
    expect(events.filter(e => e.type === 'noteOn')).toHaveLength(0);
  });

  it('should emit noteOn for all notes in a chord', () => {
    confirmNote([{ midi: 60 }, { midi: 64 }, { midi: 67 }]);
    const noteOns = events.filter(e => e.type === 'noteOn');
    expect(noteOns).toHaveLength(3);
    expect(noteOns.map(e => e.midiNote).sort()).toEqual([60, 64, 67]);
  });

  it('should not re-emit noteOn for sustained notes', () => {
    const t0 = 1000;
    tracker.update(makeFrame([{ midi: 60, onset: true }], t0));
    tracker.update(makeFrame([{ midi: 60, onset: false }], t0 + 30)); // confirms onset
    tracker.update(makeFrame([{ midi: 60, onset: false }], t0 + 60)); // sustained
    const noteOns = events.filter(e => e.type === 'noteOn');
    expect(noteOns).toHaveLength(1);
  });

  it('should emit noteOff when a note disappears from frames', () => {
    const t0 = 1000;
    confirmNote([{ midi: 60 }, { midi: 64 }], t0);
    // Remove E4, keep C4 — timestamp must exceed releaseHoldMs from last seen
    tracker.update(makeFrame([{ midi: 60, onset: false }], t0 + defaultConfig.onsetHoldMs + defaultConfig.releaseHoldMs + 10));
    const noteOffs = events.filter(e => e.type === 'noteOff');
    expect(noteOffs).toContainEqual(expect.objectContaining({ midiNote: 64 }));
  });

  it('should emit noteOff for all notes on reset', () => {
    confirmNote([{ midi: 60 }, { midi: 64 }]);
    tracker.reset();
    const noteOffs = events.filter(e => e.type === 'noteOff');
    expect(noteOffs).toHaveLength(2);
  });

  it('should handle note transitions (old note off, new note on)', () => {
    const t0 = 1000;
    confirmNote([{ midi: 60 }], t0);
    // New note D4 appears, C4 gone — after release hold
    const t1 = t0 + defaultConfig.onsetHoldMs + defaultConfig.releaseHoldMs + 10;
    tracker.update(makeFrame([{ midi: 62 }], t1));
    tracker.update(makeFrame([{ midi: 62, onset: false }], t1 + defaultConfig.onsetHoldMs));
    expect(events).toContainEqual(expect.objectContaining({ type: 'noteOff', midiNote: 60 }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'noteOn', midiNote: 62 }));
  });

  it('should track up to 6 simultaneous notes', () => {
    const notes = [60, 62, 64, 65, 67, 69].map(midi => ({ midi }));
    confirmNote(notes);
    const noteOns = events.filter(e => e.type === 'noteOn');
    expect(noteOns).toHaveLength(6);
  });

  it('should return active notes via getActiveNotes()', () => {
    confirmNote([{ midi: 60 }, { midi: 64 }]);
    expect(tracker.getActiveNotes().sort()).toEqual([60, 64]);
  });

  it('should unsubscribe properly', () => {
    const unsub = tracker.onNoteEvent(() => {});
    unsub();
    // Should not throw
    tracker.update(makeFrame([{ midi: 60 }]));
  });

  it('should emit immediately when onsetHoldMs is 0', () => {
    const zeroHoldTracker = new MultiNoteTracker({ onsetHoldMs: 0, releaseHoldMs: 60 });
    const zeroEvents: NoteEvent[] = [];
    zeroHoldTracker.onNoteEvent((e) => zeroEvents.push(e));
    zeroHoldTracker.update(makeFrame([{ midi: 60 }]));
    expect(zeroEvents).toEqual([
      expect.objectContaining({ type: 'noteOn', midiNote: 60 }),
    ]);
  });
});
