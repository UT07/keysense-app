import { MultiNoteTracker, MultiNoteTrackerConfig } from '../MultiNoteTracker';
import type { PolyphonicFrame, DetectedNote } from '../PolyphonicDetector';
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

  it('should emit noteOn for a new note onset', () => {
    tracker.update(makeFrame([{ midi: 60 }]));
    expect(events).toEqual([
      expect.objectContaining({ type: 'noteOn', midiNote: 60 }),
    ]);
  });

  it('should emit noteOn for all notes in a chord', () => {
    tracker.update(makeFrame([{ midi: 60 }, { midi: 64 }, { midi: 67 }]));
    const noteOns = events.filter(e => e.type === 'noteOn');
    expect(noteOns).toHaveLength(3);
    expect(noteOns.map(e => e.midiNote).sort()).toEqual([60, 64, 67]);
  });

  it('should not re-emit noteOn for sustained notes', () => {
    tracker.update(makeFrame([{ midi: 60, onset: true }]));
    tracker.update(makeFrame([{ midi: 60, onset: false }])); // sustained, no onset
    const noteOns = events.filter(e => e.type === 'noteOn');
    expect(noteOns).toHaveLength(1);
  });

  it('should emit noteOff when a note disappears from frames', () => {
    tracker.update(makeFrame([{ midi: 60 }, { midi: 64 }]));
    // Remove E4, keep C4 — timestamp must exceed releaseHoldMs
    tracker.update(makeFrame([{ midi: 60 }], Date.now() + 100));
    const noteOffs = events.filter(e => e.type === 'noteOff');
    expect(noteOffs).toContainEqual(expect.objectContaining({ midiNote: 64 }));
  });

  it('should emit noteOff for all notes on reset', () => {
    tracker.update(makeFrame([{ midi: 60 }, { midi: 64 }]));
    tracker.reset();
    const noteOffs = events.filter(e => e.type === 'noteOff');
    expect(noteOffs).toHaveLength(2);
  });

  it('should handle note transitions (old note off, new note on)', () => {
    tracker.update(makeFrame([{ midi: 60 }]));
    tracker.update(makeFrame([{ midi: 62 }], Date.now() + 100));
    expect(events).toContainEqual(expect.objectContaining({ type: 'noteOff', midiNote: 60 }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'noteOn', midiNote: 62 }));
  });

  it('should track up to 6 simultaneous notes', () => {
    const notes = [60, 62, 64, 65, 67, 69].map(midi => ({ midi }));
    tracker.update(makeFrame(notes));
    const noteOns = events.filter(e => e.type === 'noteOn');
    expect(noteOns).toHaveLength(6);
  });

  it('should return active notes via getActiveNotes()', () => {
    tracker.update(makeFrame([{ midi: 60 }, { midi: 64 }]));
    expect(tracker.getActiveNotes().sort()).toEqual([60, 64]);
  });

  it('should unsubscribe properly', () => {
    const unsub = tracker.onNoteEvent(() => {});
    unsub();
    // Should not throw
    tracker.update(makeFrame([{ midi: 60 }]));
  });
});
