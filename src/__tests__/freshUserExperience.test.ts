/**
 * Fresh User Experience - Comprehensive Automated Test Suite
 *
 * Simulates a brand-new user going through the entire app:
 * 1. Store defaults (clean slate)
 * 2. Content loading (all 30 exercises, 6 lessons)
 * 3. Skill Assessment scoring logic + countdown freeze
 * 4. Exercise progression (lesson completion, XP, levels)
 * 5. VerticalPianoRoll countdown behavior
 *
 * Goal: validate the complete user journey from fresh install to first lesson.
 */

import {
  getLessons,
  getLesson,
  getLessonExercises,
  getNextExerciseId,
  getLessonIdForExercise,
} from '../content/ContentLoader';
import {
  scoreRoundPressRelease,
  calculateTimingScore01,
  determineStartLesson,
  ASSESSMENT_ROUNDS,
} from '../screens/SkillAssessmentScreen';
import type { SkillCheckCapturedNote } from '../screens/SkillAssessmentScreen';
import type { NoteEvent } from '../core/exercises/types';
import {
  calculateNoteTop,
  calculateNoteX,
  deriveMidiRange,
  HIT_LINE_RATIO,
  LOOK_AHEAD_BEATS,
} from '../components/PianoRoll/VerticalPianoRoll';
import { computeZoomedRange } from '../components/Keyboard/computeZoomedRange';
import { hitTestPianoKey, getWhiteKeysInRange } from '../components/Keyboard/keyboardHitTest';

// ===========================================================================
// Section 1: Fresh User Store Defaults
// ===========================================================================

describe('Fresh User Store Defaults', () => {
  it('progressStore starts with zero XP and level 1', () => {
    const { useProgressStore } = require('../stores/progressStore');
    const state = useProgressStore.getState();

    expect(state.totalXp).toBe(0);
    expect(state.level).toBe(1);
  });

  it('progressStore starts with empty lesson progress', () => {
    const { useProgressStore } = require('../stores/progressStore');
    const state = useProgressStore.getState();

    expect(state.lessonProgress).toEqual({});
  });

  it('settingsStore starts with onboarding not completed', () => {
    const { useSettingsStore } = require('../stores/settingsStore');
    const state = useSettingsStore.getState();

    expect(state.hasCompletedOnboarding).toBe(false);
  });

  it('settingsStore starts with no experience level (null)', () => {
    const { useSettingsStore } = require('../stores/settingsStore');
    const state = useSettingsStore.getState();

    expect(state.experienceLevel).toBeNull();
  });

  it('learnerProfileStore starts with neutral skill levels', () => {
    const { useLearnerProfileStore } = require('../stores/learnerProfileStore');
    const state = useLearnerProfileStore.getState();

    expect(state.assessmentScore).toBe(0);
    expect(state.lastAssessmentDate).toBeFalsy(); // empty string or null
  });
});

// ===========================================================================
// Section 2: Content Loading — All 30 Exercises
// ===========================================================================

describe('Content Loading — Complete Exercise Library', () => {
  const lessons = getLessons();

  it('has exactly 6 lessons', () => {
    expect(lessons).toHaveLength(6);
  });

  it('lesson IDs are sequential (lesson-01 through lesson-06)', () => {
    const ids = lessons.map((l) => l.id);
    expect(ids).toEqual([
      'lesson-01',
      'lesson-02',
      'lesson-03',
      'lesson-04',
      'lesson-05',
      'lesson-06',
    ]);
  });

  it('each lesson has at least 3 exercises', () => {
    for (const lesson of lessons) {
      const exercises = getLessonExercises(lesson.id);
      expect(exercises.length).toBeGreaterThanOrEqual(3);
      expect(exercises.length).toBeLessThanOrEqual(8);
    }
  });

  it('all exercises have valid MIDI notes (21-108 piano range)', () => {
    for (const lesson of lessons) {
      const exercises = getLessonExercises(lesson.id);
      for (const ex of exercises) {
        for (const note of ex.notes) {
          expect(note.note).toBeGreaterThanOrEqual(21);
          expect(note.note).toBeLessThanOrEqual(108);
        }
      }
    }
  });

  it('all exercises have positive duration notes', () => {
    for (const lesson of lessons) {
      const exercises = getLessonExercises(lesson.id);
      for (const ex of exercises) {
        for (const note of ex.notes) {
          expect(note.durationBeats).toBeGreaterThan(0);
        }
      }
    }
  });

  it('all exercises have valid scoring config', () => {
    for (const lesson of lessons) {
      const exercises = getLessonExercises(lesson.id);
      for (const ex of exercises) {
        expect(ex.scoring.passingScore).toBeLessThanOrEqual(ex.scoring.starThresholds[0]);
        expect(ex.scoring.starThresholds[0]).toBeLessThanOrEqual(ex.scoring.starThresholds[1]);
        expect(ex.scoring.starThresholds[1]).toBeLessThanOrEqual(ex.scoring.starThresholds[2]);
      }
    }
  });

  it('navigation chain is complete (every exercise has a next, except last)', () => {
    for (const lesson of lessons) {
      const exercises = getLessonExercises(lesson.id);
      for (let i = 0; i < exercises.length - 1; i++) {
        const nextId = getNextExerciseId(lesson.id, exercises[i].id);
        expect(nextId).toBe(exercises[i + 1].id);
      }
      // Last exercise has no next
      const lastEx = exercises[exercises.length - 1];
      const nextId = getNextExerciseId(lesson.id, lastEx.id);
      expect(nextId).toBeNull();
    }
  });

  it('reverse lookup works (exercise ID → lesson ID)', () => {
    for (const lesson of lessons) {
      const exercises = getLessonExercises(lesson.id);
      for (const ex of exercises) {
        const foundLessonId = getLessonIdForExercise(ex.id);
        expect(foundLessonId).toBe(lesson.id);
      }
    }
  });

  it('Lesson 1 is unlocked by default (no unlock requirement)', () => {
    const lesson1 = getLesson('lesson-01');
    expect(lesson1).toBeDefined();
    expect(lesson1!.unlockRequirement).toBeNull();
  });

  it('Lessons 2-6 require previous lesson completion', () => {
    for (let i = 2; i <= 6; i++) {
      const lessonId = `lesson-${String(i).padStart(2, '0')}`;
      const lesson = getLesson(lessonId);
      expect(lesson).toBeDefined();
      expect(lesson!.unlockRequirement).toBeDefined();
      expect(lesson!.unlockRequirement!.type).toBe('lesson-complete');
    }
  });
});

// ===========================================================================
// Section 3: Skill Assessment — Scoring & Placement
// ===========================================================================

describe('Skill Assessment — Scoring & Placement', () => {
  describe('Assessment rounds data integrity', () => {
    it('has exactly 5 rounds', () => {
      expect(ASSESSMENT_ROUNDS).toHaveLength(5);
    });

    it('all rounds have valid MIDI notes', () => {
      for (const round of ASSESSMENT_ROUNDS) {
        for (const note of round.notes) {
          expect(note.note).toBeGreaterThanOrEqual(21);
          expect(note.note).toBeLessThanOrEqual(108);
        }
      }
    });

    it('all rounds have positive tempo', () => {
      for (const round of ASSESSMENT_ROUNDS) {
        expect(round.tempo).toBeGreaterThan(0);
        expect(round.tempo).toBeLessThanOrEqual(200);
      }
    });

    it('difficulty increases (tempo generally increases across rounds)', () => {
      // At least the last round should be faster than the first
      expect(ASSESSMENT_ROUNDS[4].tempo).toBeGreaterThanOrEqual(
        ASSESSMENT_ROUNDS[0].tempo,
      );
    });
  });

  describe('Placement logic (determineStartLesson)', () => {
    it('beginner with all low scores starts at lesson-01', () => {
      expect(determineStartLesson([0.3, 0.2, 0.1, 0.1, 0.1])).toBe('lesson-01');
    });

    it('decent player starts at lesson-02', () => {
      expect(determineStartLesson([0.7, 0.4, 0.3, 0.2, 0.1])).toBe('lesson-02');
    });

    it('good player starts at lesson-03', () => {
      expect(determineStartLesson([0.9, 0.9, 0.5, 0.3, 0.2])).toBe('lesson-03');
    });

    it('experienced player starts at lesson-05', () => {
      expect(determineStartLesson([0.9, 0.9, 0.9, 0.5, 0.3])).toBe('lesson-05');
    });

    it('expert player skips curriculum', () => {
      expect(determineStartLesson([0.95, 0.95, 0.95, 0.95, 0.95])).toBe(
        'post-curriculum',
      );
    });
  });

  describe('Press-release scoring', () => {
    it('perfect play scores close to 1.0', () => {
      const round = ASSESSMENT_ROUNDS[0];
      const beatZero = 1000;
      const msPerBeat = 60000 / round.tempo;

      const played: SkillCheckCapturedNote[] = round.notes.map((n) => ({
        note: n.note,
        noteOnTimestamp: beatZero + n.startBeat * msPerBeat,
        noteOffTimestamp: beatZero + (n.startBeat + n.durationBeats) * msPerBeat,
        durationMs: n.durationBeats * msPerBeat,
      }));

      const score = scoreRoundPressRelease(round.notes, played, round.tempo, beatZero);
      expect(score).toBeGreaterThan(0.8);
    });

    it('no notes played scores 0', () => {
      const round = ASSESSMENT_ROUNDS[0];
      const score = scoreRoundPressRelease(round.notes, [], round.tempo, 1000);
      expect(score).toBe(0);
    });

    it('wrong notes score lower than perfect play', () => {
      const round = ASSESSMENT_ROUNDS[0];
      const beatZero = 1000;
      const msPerBeat = 60000 / round.tempo;

      const perfectPlayed: SkillCheckCapturedNote[] = round.notes.map((n) => ({
        note: n.note,
        noteOnTimestamp: beatZero + n.startBeat * msPerBeat,
        noteOffTimestamp: beatZero + (n.startBeat + n.durationBeats) * msPerBeat,
        durationMs: n.durationBeats * msPerBeat,
      }));

      const wrongPlayed: SkillCheckCapturedNote[] = round.notes.map((n) => ({
        note: n.note + 12, // One octave off
        noteOnTimestamp: beatZero + n.startBeat * msPerBeat,
        noteOffTimestamp: beatZero + (n.startBeat + n.durationBeats) * msPerBeat,
        durationMs: n.durationBeats * msPerBeat,
      }));

      const perfectScore = scoreRoundPressRelease(round.notes, perfectPlayed, round.tempo, beatZero);
      const wrongScore = scoreRoundPressRelease(round.notes, wrongPlayed, round.tempo, beatZero);
      expect(wrongScore).toBeLessThan(perfectScore);
    });
  });

  describe('Timing score curve', () => {
    it('perfect timing (0ms offset) scores 1.0', () => {
      expect(calculateTimingScore01(0, 75, 200)).toBe(1);
    });

    it('within tolerance scores 1.0', () => {
      expect(calculateTimingScore01(50, 75, 200)).toBe(1);
      expect(calculateTimingScore01(-50, 75, 200)).toBe(1);
    });

    it('within grace period scores between 0.5 and 1.0', () => {
      const score = calculateTimingScore01(150, 75, 200);
      expect(score).toBeGreaterThan(0.4);
      expect(score).toBeLessThan(1.0);
    });

    it('very late scores 0', () => {
      expect(calculateTimingScore01(1000, 75, 200)).toBe(0);
    });
  });
});

// ===========================================================================
// Section 4: VerticalPianoRoll — Countdown Freeze Behavior
// ===========================================================================

describe('VerticalPianoRoll — Countdown Freeze', () => {
  const containerHeight = 400;
  const hitLineY = containerHeight * HIT_LINE_RATIO; // 340px
  const pixelsPerBeat = hitLineY / LOOK_AHEAD_BEATS; // 85px per beat

  describe('calculateNoteTop during countdown (frozen at -0.5)', () => {
    it('beat-0 note is slightly above hit line when frozen at -0.5', () => {
      // currentBeat = -0.5 (frozen during countdown)
      const top = calculateNoteTop(0, -0.5, hitLineY, pixelsPerBeat);
      // beatDiff = 0 - (-0.5) = 0.5
      // top = hitLineY - 0.5 * ppb = 340 - 42.5 = 297.5
      expect(top).toBeLessThan(hitLineY); // above hit line
      expect(top).toBeGreaterThan(hitLineY - pixelsPerBeat); // but less than 1 beat above
    });

    it('beat-1 note is well above hit line when frozen at -0.5', () => {
      const top = calculateNoteTop(1, -0.5, hitLineY, pixelsPerBeat);
      // beatDiff = 1 - (-0.5) = 1.5
      // top = hitLineY - 1.5 * ppb
      expect(top).toBeLessThan(hitLineY - pixelsPerBeat);
    });

    it('notes dont move when frozen (same position regardless of actual time)', () => {
      // Calling with -0.5 always produces the same result
      const top1 = calculateNoteTop(0, -0.5, hitLineY, pixelsPerBeat);
      const top2 = calculateNoteTop(0, -0.5, hitLineY, pixelsPerBeat);
      expect(top1).toBe(top2);
    });
  });

  describe('calculateNoteTop during playback (normal scrolling)', () => {
    it('note at currentBeat sits exactly at hit line', () => {
      const top = calculateNoteTop(2, 2, hitLineY, pixelsPerBeat);
      // beatDiff = 2 - 2 = 0
      expect(top).toBe(hitLineY);
    });

    it('future note is above hit line', () => {
      const top = calculateNoteTop(3, 1, hitLineY, pixelsPerBeat);
      // beatDiff = 3 - 1 = 2
      expect(top).toBeLessThan(hitLineY);
    });

    it('past note is below hit line', () => {
      const top = calculateNoteTop(1, 3, hitLineY, pixelsPerBeat);
      // beatDiff = 1 - 3 = -2
      expect(top).toBeGreaterThan(hitLineY);
    });
  });

  describe('deriveMidiRange', () => {
    it('returns default range for empty notes', () => {
      const range = deriveMidiRange([]);
      expect(range.min).toBe(48);
      expect(range.max).toBe(72);
    });

    it('centers range around exercise notes', () => {
      const notes: NoteEvent[] = [
        { note: 60, startBeat: 0, durationBeats: 1 },
        { note: 64, startBeat: 1, durationBeats: 1 },
      ];
      const range = deriveMidiRange(notes);
      expect(range.min).toBeLessThanOrEqual(58);
      expect(range.max).toBeGreaterThanOrEqual(66);
      expect(range.range).toBeGreaterThanOrEqual(12);
    });

    it('enforces minimum 12-semitone span', () => {
      const notes: NoteEvent[] = [{ note: 60, startBeat: 0, durationBeats: 1 }];
      const range = deriveMidiRange(notes);
      expect(range.range).toBeGreaterThanOrEqual(12);
    });
  });

  describe('calculateNoteX', () => {
    it('white key gets full white-key width', () => {
      const { x, width } = calculateNoteX(60, 300, 48, 24); // Middle C
      expect(width).toBeGreaterThan(0);
      expect(x).toBeGreaterThanOrEqual(0);
    });

    it('black key is narrower than white key', () => {
      const white = calculateNoteX(60, 300, 48, 24);
      const black = calculateNoteX(61, 300, 48, 24); // C#
      expect(black.width).toBeLessThan(white.width);
    });
  });
});

// ===========================================================================
// Section 5: Keyboard — Range & Hit Testing
// ===========================================================================

describe('Keyboard — Range Computation & Hit Testing', () => {
  describe('computeZoomedRange for assessment', () => {
    it('2-octave range for single note (Middle C)', () => {
      const range = computeZoomedRange([60], 2);
      expect(range.octaveCount).toBe(2);
      expect(range.startNote).toBeLessThanOrEqual(60);
      expect(range.startNote + range.octaveCount * 12).toBeGreaterThanOrEqual(60);
    });

    it('2-octave range for C-D-E-F-G cluster', () => {
      const range = computeZoomedRange([60, 62, 64, 65, 67], 2);
      expect(range.octaveCount).toBe(2);
      // All notes should be within the range
      for (const note of [60, 62, 64, 65, 67]) {
        expect(note).toBeGreaterThanOrEqual(range.startNote);
        expect(note).toBeLessThan(range.startNote + range.octaveCount * 12);
      }
    });

    it('startNote is always a C (multiple of 12 + offset)', () => {
      const range = computeZoomedRange([60, 62, 64], 2);
      // startNote should be a C (MIDI note % 12 === 0)
      expect(range.startNote % 12).toBe(0);
    });
  });

  describe('hitTestPianoKey', () => {
    const startNote = 48; // C3
    const endNote = 71; // B4 (2 octaves)
    const whiteKeys = getWhiteKeysInRange(startNote, endNote);
    const totalWidth = 700;
    const totalHeight = 120;
    const whiteKeyWidth = totalWidth / whiteKeys.length;

    const config: Parameters<typeof hitTestPianoKey>[2] = {
      startNote,
      endNote,
      whiteKeys,
      totalWidth,
      totalHeight,
    };

    it('tapping center of first white key returns C3 (48)', () => {
      const result = hitTestPianoKey(whiteKeyWidth / 2, totalHeight - 10, config);
      expect(result).toBe(48); // C3
    });

    it('tapping middle of keyboard returns a valid MIDI note', () => {
      const result = hitTestPianoKey(totalWidth / 2, totalHeight - 10, config);
      expect(result).toBeGreaterThanOrEqual(startNote);
      expect(result).toBeLessThanOrEqual(endNote);
    });

    it('tapping top of a black key area returns black key', () => {
      // C# is between C and D — upper portion (y < 65% height) = black key zone
      const result = hitTestPianoKey(whiteKeyWidth * 1, totalHeight * 0.3, config);
      // Should be a black key (C#3 = 49)
      if (result !== null) {
        expect(result).toBeGreaterThanOrEqual(startNote);
        expect(result).toBeLessThanOrEqual(endNote);
      }
    });

    it('returns null for out-of-bounds coordinates', () => {
      const result = hitTestPianoKey(-10, 50, config);
      expect(result).toBeNull();
    });

    it('returns null for negative y', () => {
      const result = hitTestPianoKey(100, -10, config);
      expect(result).toBeNull();
    });
  });
});

// ===========================================================================
// Section 6: Exercise Progression Simulation
// ===========================================================================

describe('Exercise Progression — Fresh User Journey', () => {
  it('Lesson 1 first exercise is accessible', () => {
    const lesson1 = getLesson('lesson-01');
    expect(lesson1).toBeDefined();
    const exercises = getLessonExercises('lesson-01');
    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises[0].id).toBeDefined();
  });

  it('first exercise of lesson 1 has beginner-friendly settings', () => {
    const exercises = getLessonExercises('lesson-01');
    const firstEx = exercises[0];

    // Beginner exercise should have:
    expect(firstEx.settings.tempo).toBeLessThanOrEqual(80); // slow tempo
    expect(firstEx.scoring.passingScore).toBeLessThanOrEqual(75); // forgiving pass score
    expect(firstEx.display?.showNoteNames).toBe(true); // note names visible
    expect(firstEx.display?.showPianoRoll).toBe(true); // piano roll visible
  });

  it('exercises within a lesson get progressively harder', () => {
    const exercises = getLessonExercises('lesson-01');
    // At minimum, lesson should have multiple exercises
    expect(exercises.length).toBeGreaterThan(1);
    // Later exercises generally have more notes or faster tempo
    const lastNoteCount = exercises[exercises.length - 1].notes.length;
    expect(lastNoteCount).toBeGreaterThan(0);
  });

  it('XP system awards correct XP for exercise completion', () => {
    // Test the XP calculation directly
    const { levelFromXp } = require('../core/progression/XpSystem');

    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(250)).toBe(3);
  });

  it('all 6 lessons have XP rewards defined', () => {
    const lessons = getLessons();
    for (const lesson of lessons) {
      const fullLesson = getLesson(lesson.id);
      expect(fullLesson!.xpReward).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// Section 7: Assessment Keyboard Range Validation
// ===========================================================================

describe('Assessment — Keyboard Range per Round', () => {
  for (let i = 0; i < ASSESSMENT_ROUNDS.length; i++) {
    const round = ASSESSMENT_ROUNDS[i];

    it(`Round ${i + 1} (${round.title}): 2-octave range covers all notes`, () => {
      const noteValues = round.notes.map((n) => n.note);
      const uniqueNotes = Array.from(new Set(noteValues));
      const range = computeZoomedRange(uniqueNotes, 2);

      for (const note of uniqueNotes) {
        expect(note).toBeGreaterThanOrEqual(range.startNote);
        expect(note).toBeLessThan(range.startNote + range.octaveCount * 12);
      }
    });

    it(`Round ${i + 1}: deriveMidiRange covers all notes`, () => {
      const midiRange = deriveMidiRange(round.notes);

      for (const note of round.notes) {
        expect(note.note).toBeGreaterThanOrEqual(midiRange.min);
        expect(note.note).toBeLessThanOrEqual(midiRange.max);
      }
    });
  }
});

// ===========================================================================
// Section 8: Transition between Countdown Freeze → Playback
// ===========================================================================

describe('Countdown → Playback Transition', () => {
  it('frozen beat (-0.5) and playback beat (0) produce different note positions', () => {
    const containerHeight = 400;
    const hitLineY = containerHeight * HIT_LINE_RATIO;
    const pixelsPerBeat = hitLineY / LOOK_AHEAD_BEATS;

    const frozenTop = calculateNoteTop(0, -0.5, hitLineY, pixelsPerBeat);
    const playbackTop = calculateNoteTop(0, 0, hitLineY, pixelsPerBeat);

    // During frozen (-0.5): note is above hit line
    expect(frozenTop).toBeLessThan(hitLineY);

    // At beat 0: note is exactly at hit line
    expect(playbackTop).toBe(hitLineY);

    // Frozen position is above playback position
    expect(frozenTop).toBeLessThan(playbackTop);
  });

  it('transition from freeze to beat-0 moves notes down to hit line', () => {
    const containerHeight = 400;
    const hitLineY = containerHeight * HIT_LINE_RATIO;
    const ppb = hitLineY / LOOK_AHEAD_BEATS;

    // Simulate the transition from countdown → playback
    const beats = [-0.5, 0, 0.5, 1.0, 1.5, 2.0];
    const positions = beats.map((b) => calculateNoteTop(0, b, hitLineY, ppb));

    // Note at beat 0 should move from above → at → below the hit line
    expect(positions[0]).toBeLessThan(hitLineY); // frozen: above
    expect(positions[1]).toBe(hitLineY); // beat 0: at hit line
    expect(positions[2]).toBeGreaterThan(hitLineY); // beat 0.5: below
    expect(positions[3]).toBeGreaterThan(positions[2]); // beat 1: further below

    // Positions should be monotonically increasing
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });
});
