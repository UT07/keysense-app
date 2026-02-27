import type { Exercise } from '@/core/exercises/types';
import { getTemplateExercise, getTemplateForSkill } from '../templateExercises';

// Mock SkillTree so getTemplateForSkill can use getGenerationHints
jest.mock('../../core/curriculum/SkillTree', () => ({
  getGenerationHints: jest.fn((skillId: string) => {
    const hints: Record<string, any> = {
      'find-middle-c': { targetMidi: [60], hand: 'right', minDifficulty: 1, promptHint: 'Play Middle C' },
      'keyboard-geography': { targetMidi: [60, 62, 64, 65, 67], hand: 'right', keySignature: 'C major', minDifficulty: 1, promptHint: 'Navigate C4-G4' },
      'white-keys': { targetMidi: [60, 62, 64, 65, 67, 69, 71, 72], hand: 'right', keySignature: 'C major', minDifficulty: 1, promptHint: 'All white keys C4-C5' },
      'hands-together-basic': { targetMidi: [48, 52, 55, 60, 62, 64], hand: 'both', keySignature: 'C major', minDifficulty: 2, exerciseTypes: ['melody'], promptHint: 'Simple melody in right hand with bass in left' },
      'scale-technique': { targetMidi: [60, 62, 64, 65, 67, 69, 71, 72], hand: 'right', keySignature: 'C major', minDifficulty: 2, exerciseTypes: ['scale'], promptHint: 'C major scale' },
    };
    return hints[skillId] ?? null;
  }),
  SKILL_TREE: [],
}));

describe('templateExercises', () => {
  it('returns a valid Exercise for each difficulty', () => {
    for (const d of [1, 2, 3] as const) {
      const ex = getTemplateExercise(d);
      expect(ex).toBeDefined();
      expect(ex.id).toMatch(/^tmpl-/);
    }
  });

  it('returned exercise has correct structure', () => {
    const ex: Exercise = getTemplateExercise(1);
    expect(ex.id).toBeTruthy();
    expect(ex.version).toBe(1);
    expect(ex.metadata).toBeDefined();
    expect(ex.metadata.title).toBeTruthy();
    expect(ex.metadata.description).toBeTruthy();
    expect(ex.metadata.difficulty).toBeGreaterThanOrEqual(1);
    expect(ex.metadata.difficulty).toBeLessThanOrEqual(5);
    expect(ex.metadata.estimatedMinutes).toBeGreaterThan(0);
    expect(ex.metadata.skills).toEqual(expect.any(Array));
    expect(ex.settings).toBeDefined();
    expect(ex.settings.tempo).toBeGreaterThan(0);
    expect(ex.settings.timeSignature).toEqual([4, 4]);
    expect(ex.settings.countIn).toBe(4);
    expect(ex.notes.length).toBeGreaterThan(0);
    expect(ex.scoring).toBeDefined();
    expect(ex.scoring.starThresholds).toHaveLength(3);
    expect(ex.hints).toBeDefined();
    expect(ex.hands).toBeDefined();
  });

  // Tempo ranges include ±5 BPM variation for anti-repetition
  it('difficulty 1 exercises have tempo in expected range (±5 variation)', () => {
    for (let i = 0; i < 20; i++) {
      const ex = getTemplateExercise(1);
      expect(ex.settings.tempo).toBeGreaterThanOrEqual(45); // 50-5=45
      expect(ex.settings.tempo).toBeLessThanOrEqual(65);    // 60+5=65
    }
  });

  it('difficulty 2 exercises have tempo in expected range (±5 variation)', () => {
    for (let i = 0; i < 20; i++) {
      const ex = getTemplateExercise(2);
      expect(ex.settings.tempo).toBeGreaterThanOrEqual(65); // 70-5=65
      expect(ex.settings.tempo).toBeLessThanOrEqual(85);    // 80+5=85
    }
  });

  it('difficulty 3 exercises have tempo in expected range (±5 variation)', () => {
    for (let i = 0; i < 20; i++) {
      const ex = getTemplateExercise(3);
      expect(ex.settings.tempo).toBeGreaterThanOrEqual(85); // 90-5=85
      expect(ex.settings.tempo).toBeLessThanOrEqual(105);   // 100+5=105
    }
  });

  it('exercises target weak notes when provided', () => {
    const weakNotes = [61, 63]; // Db4, Eb4
    let foundWeak = false;
    // Run multiple times since template selection + transposition have randomness
    for (let i = 0; i < 50; i++) {
      const ex = getTemplateExercise(1, weakNotes);
      if (ex.notes.some((n) => weakNotes.includes(n.note))) {
        foundWeak = true;
        break;
      }
    }
    expect(foundWeak).toBe(true);
  });

  it('returns different exercises on repeated calls with same params', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const ex = getTemplateExercise(1);
      ids.add(ex.id);
    }
    // With 5 templates per tier, repeated random picks should yield at least 2 unique
    expect(ids.size).toBeGreaterThanOrEqual(2);
  });

  it('produces variety via different template selection on repeated calls', () => {
    const noteSignatures = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const ex = getTemplateExercise(1);
      const sig = ex.notes.map((n) => n.note).join(',');
      noteSignatures.add(sig);
    }
    // 5 templates per tier + weak-note swapping should yield multiple patterns
    expect(noteSignatures.size).toBeGreaterThanOrEqual(2);
  });

  it('exercise notes have valid MIDI range (36-96)', () => {
    for (const d of [1, 2, 3] as const) {
      for (let i = 0; i < 10; i++) {
        const ex = getTemplateExercise(d, [61, 70]);
        for (const n of ex.notes) {
          expect(n.note).toBeGreaterThanOrEqual(36);
          expect(n.note).toBeLessThanOrEqual(96);
        }
      }
    }
  });

  it('exercise notes have valid startBeat and durationBeats', () => {
    for (const d of [1, 2, 3] as const) {
      const ex = getTemplateExercise(d);
      for (const n of ex.notes) {
        expect(n.startBeat).toBeGreaterThanOrEqual(0);
        expect(n.durationBeats).toBeGreaterThan(0);
      }
    }
  });

  it('returns exercise even with empty weak notes', () => {
    const ex = getTemplateExercise(2, []);
    expect(ex).toBeDefined();
    expect(ex.notes.length).toBeGreaterThan(0);
  });
});

describe('getTemplateForSkill', () => {
  it('returns an exercise for a known skill ID', () => {
    const ex = getTemplateForSkill('find-middle-c');
    expect(ex).toBeDefined();
    expect(ex.id).toMatch(/^tmpl-/);
    expect(ex.notes.length).toBeGreaterThan(0);
  });

  it('returns a skill-targeted exercise with correct notes (no transposition)', () => {
    // find-middle-c template targets MIDI 60 — should always contain it
    const ex = getTemplateForSkill('find-middle-c');
    expect(ex.notes.some((n) => n.note === 60)).toBe(true);
  });

  it('returns a valid exercise for keyboard-geography skill with matching notes', () => {
    const ex = getTemplateForSkill('keyboard-geography');
    expect(ex.notes.length).toBeGreaterThan(0);
    // Notes should be in C position (60-67) since no transposition
    const expectedNotes = [60, 62, 64, 65, 67];
    for (const n of ex.notes) {
      expect(expectedNotes).toContain(n.note);
    }
  });

  it('falls back to generic template for unknown skill (no generation hints)', () => {
    const ex = getTemplateForSkill('nonexistent-skill-xyz');
    expect(ex).toBeDefined();
    expect(ex.notes.length).toBeGreaterThan(0);
  });

  it('builds exercise from GENERATION_HINTS for skill without dedicated template', () => {
    // hands-together-basic has hints but no dedicated template
    const ex = getTemplateForSkill('hands-together-basic');
    expect(ex).toBeDefined();
    expect(ex.id).toMatch(/^tmpl-hints-/);
    expect(ex.notes.length).toBeGreaterThan(0);
    // Notes should match targetMidi from hints: [48, 52, 55, 60, 62, 64]
    const allowedNotes = [48, 52, 55, 60, 62, 64];
    for (const n of ex.notes) {
      expect(allowedNotes).toContain(n.note);
    }
    // Should have both-hands exercise
    expect(ex.hands).toBe('both');
  });

  it('applies weak note swapping to skill templates', () => {
    // white-keys template has notes 60-72; swapping in 61 (Db4) should appear
    const ex = getTemplateForSkill('white-keys', [61]);
    // Without transposition, weak note swap should work reliably
    expect(ex.notes.some((n) => n.note === 61)).toBe(true);
  });

  it('skill template notes stay consistent (no transposition)', () => {
    // Same skill should produce same notes (modulo weak-note swapping)
    const ex1 = getTemplateForSkill('find-middle-c');
    const ex2 = getTemplateForSkill('find-middle-c');
    // Both should contain MIDI 60 (Middle C)
    expect(ex1.notes.some((n) => n.note === 60)).toBe(true);
    expect(ex2.notes.some((n) => n.note === 60)).toBe(true);
  });

  it('returns valid exercise structure for all tier 1-3 skill templates', () => {
    const skillIds = [
      'find-middle-c', 'keyboard-geography', 'white-keys',
      'rh-cde', 'simple-melodies', 'c-position-review',
      'lh-scale-descending', 'lh-broken-chords',
    ];
    for (const skillId of skillIds) {
      const ex = getTemplateForSkill(skillId);
      expect(ex.id).toMatch(/^tmpl-/);
      expect(ex.metadata.title).toBeTruthy();
      expect(ex.notes.length).toBeGreaterThan(0);
      for (const n of ex.notes) {
        expect(n.note).toBeGreaterThanOrEqual(36);
        expect(n.note).toBeLessThanOrEqual(96);
        expect(n.startBeat).toBeGreaterThanOrEqual(0);
        expect(n.durationBeats).toBeGreaterThan(0);
      }
    }
  });
});
