/**
 * Skill Assessment Screen Tests
 * Tests the pure logic functions: determineStartLesson, scoreRound,
 * and validates assessment round data.
 */

// Mock Firebase (imported transitively via stores -> socialService/leagueService)
jest.mock('../../services/firebase/config', () => ({
  auth: { currentUser: null },
  db: {},
  functions: {},
}));
jest.mock('../../services/firebase/socialService', () => ({
  postActivity: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/firebase/leagueService', () => ({
  addLeagueXp: jest.fn().mockResolvedValue(undefined),
}));

import {
  determineStartLesson,
  scoreRound,
  scoreRoundPressRelease,
  calculateTimingScore01,
  ASSESSMENT_ROUNDS,
} from '../SkillAssessmentScreen';
import type { NoteEvent } from '../../core/exercises/types';

jest.mock('../../input/AudioCapture', () => ({
  configureAudioSessionForRecording: jest.fn(),
  requestMicrophonePermission: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../audio/createAudioEngine', () => ({
  createAudioEngine: jest.fn(() => ({
    isReady: () => true,
    initialize: jest.fn().mockResolvedValue(undefined),
    playNote: jest.fn(() => ({ note: 60, startTime: 0, release: jest.fn() })),
    releaseNote: jest.fn(),
    releaseAllNotes: jest.fn(),
  })),
  ensureAudioModeConfigured: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../input/InputManager', () => ({
  InputManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
    onNoteEvent: jest.fn(() => jest.fn()),
    activeMethod: 'touch',
    getIsInitialized: () => true,
    getIsStarted: () => false,
    getTimingMultiplier: () => 1.0,
    getLatencyCompensationMs: () => 0,
  })),
  INPUT_TIMING_MULTIPLIERS: { midi: 1.0, touch: 1.0, mic: 1.5 },
  INPUT_LATENCY_COMPENSATION_MS: { midi: 0, touch: 20, mic: 100 },
}));

// ---------------------------------------------------------------------------
// determineStartLesson tests
// ---------------------------------------------------------------------------

describe('determineStartLesson', () => {
  it('returns post-curriculum when all rounds are perfect (>= 0.9)', () => {
    const scores = [0.95, 0.92, 0.9, 0.91, 0.93];
    expect(determineStartLesson(scores)).toBe('post-curriculum');
  });

  it('returns lesson-05 when first 3 rounds are perfect but not all', () => {
    const scores = [0.95, 0.92, 0.9, 0.5, 0.4];
    expect(determineStartLesson(scores)).toBe('lesson-05');
  });

  it('returns lesson-03 when first 2 rounds are perfect but not first 3', () => {
    const scores = [0.95, 0.92, 0.5, 0.4, 0.3];
    expect(determineStartLesson(scores)).toBe('lesson-03');
  });

  it('returns lesson-01 when first round fails', () => {
    const scores = [0.3, 0.5, 0.4, 0.2, 0.1];
    expect(determineStartLesson(scores)).toBe('lesson-01');
  });

  it('returns lesson-01 when no rounds fail but first 2 are not perfect', () => {
    // All scores >= 0.6 but none >= 0.9
    const scores = [0.7, 0.7, 0.7, 0.7, 0.7];
    // No firstFail (all >= 0.6), but first2Perfect is false
    // findIndex returns -1 since all are >= 0.6
    // firstFail = -1, so firstFail <= 0 => 'lesson-01'
    expect(determineStartLesson(scores)).toBe('lesson-01');
  });

  it('returns lesson-02 when first round passes but second fails', () => {
    const scores = [0.8, 0.4, 0.3, 0.2, 0.1];
    expect(determineStartLesson(scores)).toBe('lesson-02');
  });

  it('returns lesson-03 when first two pass but third fails', () => {
    const scores = [0.8, 0.7, 0.4, 0.2, 0.1];
    expect(determineStartLesson(scores)).toBe('lesson-03');
  });

  it('returns lesson-04 when first three pass but fourth fails', () => {
    const scores = [0.8, 0.7, 0.65, 0.3, 0.1];
    expect(determineStartLesson(scores)).toBe('lesson-04');
  });

  it('handles edge case: exactly 0.9 threshold', () => {
    const scores = [0.9, 0.9, 0.9, 0.9, 0.9];
    expect(determineStartLesson(scores)).toBe('post-curriculum');
  });

  it('handles edge case: exactly 0.6 pass threshold', () => {
    // All pass at exactly 0.6, but none are >= 0.9
    // firstFail = -1 (no failures), first2Perfect = false (0.6 < 0.9)
    // firstFail (-1) <= 0 => 'lesson-01'
    const scores = [0.6, 0.6, 0.6, 0.6, 0.6];
    expect(determineStartLesson(scores)).toBe('lesson-01');
  });
});

// ---------------------------------------------------------------------------
// scoreRound tests
// ---------------------------------------------------------------------------

describe('scoreRound', () => {
  const simpleNotes: NoteEvent[] = [
    { note: 60, startBeat: 0, durationBeats: 1 },
    { note: 62, startBeat: 1, durationBeats: 1 },
    { note: 64, startBeat: 2, durationBeats: 1 },
    { note: 60, startBeat: 3, durationBeats: 1 },
  ];

  it('returns 1.0 for perfect performance (all correct pitches and timing)', () => {
    const tempo = 60; // 1 beat = 1000ms
    const startTime = 0;
    const playedNotes = [
      { note: 60, timestamp: 0 },    // beat 0
      { note: 62, timestamp: 1000 }, // beat 1
      { note: 64, timestamp: 2000 }, // beat 2
      { note: 60, timestamp: 3000 }, // beat 3
    ];

    const score = scoreRound(simpleNotes, playedNotes, tempo, startTime);
    expect(score).toBeCloseTo(1.0, 2);
  });

  it('returns 0 when no notes are played', () => {
    const score = scoreRound(simpleNotes, [], 60, 0);
    expect(score).toBe(0);
  });

  it('returns 0 for empty expected notes', () => {
    const score = scoreRound([], [{ note: 60, timestamp: 0 }], 60, 0);
    expect(score).toBe(0);
  });

  it('returns 0 when all played pitches are wrong', () => {
    const playedNotes = [
      { note: 61, timestamp: 0 },
      { note: 63, timestamp: 1000 },
      { note: 65, timestamp: 2000 },
      { note: 61, timestamp: 3000 },
    ];

    const score = scoreRound(simpleNotes, playedNotes, 60, 0);
    expect(score).toBe(0);
  });

  it('gives partial credit for some correct pitches', () => {
    const playedNotes = [
      { note: 60, timestamp: 0 },    // correct
      { note: 62, timestamp: 1000 }, // correct
      { note: 65, timestamp: 2000 }, // wrong (expected 64)
      { note: 61, timestamp: 3000 }, // wrong (expected 60)
    ];

    const score = scoreRound(simpleNotes, playedNotes, 60, 0);
    // pitchScore = 2/4 = 0.5
    // timingScore for matched notes = (1.0 + 1.0) / 2 = 1.0
    // total = 0.5 * 0.6 + 1.0 * 0.4 = 0.7
    expect(score).toBeCloseTo(0.7, 2);
  });

  it('penalizes bad timing', () => {
    const playedNotes = [
      { note: 60, timestamp: 400 },  // 400ms late (beat 0 expected at 0ms)
      { note: 62, timestamp: 1400 }, // 400ms late
      { note: 64, timestamp: 2400 }, // 400ms late
      { note: 60, timestamp: 3400 }, // 400ms late
    ];

    const score = scoreRound(simpleNotes, playedNotes, 60, 0);
    // pitchScore = 4/4 = 1.0
    // timing per note = max(0, 1 - 400/500) = 0.2 each
    // avgTiming = 0.2
    // total = 1.0 * 0.6 + 0.2 * 0.4 = 0.68
    expect(score).toBeCloseTo(0.68, 2);
  });

  it('gives 0 timing score when offset >= 500ms', () => {
    const playedNotes = [
      { note: 60, timestamp: 600 },  // 600ms late => timing = 0
      { note: 62, timestamp: 1600 }, // 600ms late => timing = 0
      { note: 64, timestamp: 2600 }, // 600ms late => timing = 0
      { note: 60, timestamp: 3600 }, // 600ms late => timing = 0
    ];

    const score = scoreRound(simpleNotes, playedNotes, 60, 0);
    // pitchScore = 1.0, avgTiming = 0
    // total = 1.0 * 0.6 + 0 * 0.4 = 0.6
    expect(score).toBeCloseTo(0.6, 2);
  });

  it('handles chord notes (same start beat)', () => {
    const chordNotes: NoteEvent[] = [
      { note: 60, startBeat: 0, durationBeats: 2 },
      { note: 64, startBeat: 0, durationBeats: 2 },
      { note: 67, startBeat: 0, durationBeats: 2 },
    ];

    const playedNotes = [
      { note: 60, timestamp: 0 },
      { note: 64, timestamp: 10 }, // slight delay for chord
      { note: 67, timestamp: 20 },
    ];

    const score = scoreRound(chordNotes, playedNotes, 60, 0);
    // All pitches correct, timing very close to 0ms
    expect(score).toBeGreaterThan(0.95);
  });

  it('does not double-count played notes', () => {
    // Only one C4 played but two expected
    const playedNotes = [
      { note: 60, timestamp: 0 },
      // Missing second C4 at beat 3
    ];

    // simpleNotes expects C4 at beat 0 AND beat 3
    const score = scoreRound(simpleNotes, playedNotes, 60, 0);
    // Only 1 of 4 pitches matched: pitchScore = 0.25, timingScore = 1.0
    // total = 0.25 * 0.6 + 1.0 * 0.4 = 0.55
    expect(score).toBeCloseTo(0.55, 2);
  });

  it('accounts for round start time offset', () => {
    const startTime = 5000;
    const playedNotes = [
      { note: 60, timestamp: 5000 },  // beat 0 (0ms after start)
      { note: 62, timestamp: 6000 },  // beat 1 (1000ms after start)
      { note: 64, timestamp: 7000 },  // beat 2
      { note: 60, timestamp: 8000 },  // beat 3
    ];

    const score = scoreRound(simpleNotes, playedNotes, 60, startTime);
    expect(score).toBeCloseTo(1.0, 2);
  });
});

describe('calculateTimingScore01', () => {
  it('returns 1 within tolerance', () => {
    expect(calculateTimingScore01(30, 75, 220)).toBe(1);
  });

  it('returns 0 for very large offsets', () => {
    expect(calculateTimingScore01(1000, 75, 220)).toBe(0);
  });
});

describe('scoreRoundPressRelease', () => {
  const expected: NoteEvent[] = [
    { note: 60, startBeat: 0, durationBeats: 1 },
  ];

  it('scores high for correct pitch, press, and release', () => {
    const score = scoreRoundPressRelease(
      expected,
      [
        {
          note: 60,
          noteOnTimestamp: 0,
          noteOffTimestamp: 1000,
          durationMs: 1000,
        },
      ],
      60,
      0,
    );

    expect(score).toBeGreaterThan(0.95);
  });

  it('penalizes missing release', () => {
    const score = scoreRoundPressRelease(
      expected,
      [
        {
          note: 60,
          noteOnTimestamp: 0,
          noteOffTimestamp: null,
          durationMs: 0,
        },
      ],
      60,
      0,
    );

    expect(score).toBeLessThan(0.8);
  });

  it('penalizes wrong pitch even with good timing', () => {
    const score = scoreRoundPressRelease(
      expected,
      [
        {
          note: 62,
          noteOnTimestamp: 0,
          noteOffTimestamp: 1000,
          durationMs: 1000,
        },
      ],
      60,
      0,
    );

    expect(score).toBeLessThan(0.6);
  });

  it('penalizes late release', () => {
    const score = scoreRoundPressRelease(
      expected,
      [
        {
          note: 60,
          noteOnTimestamp: 0,
          noteOffTimestamp: 1700,
          durationMs: 1700,
        },
      ],
      60,
      0,
    );

    expect(score).toBeLessThan(0.9);
  });
});

// ---------------------------------------------------------------------------
// Assessment round data validation
// ---------------------------------------------------------------------------

describe('Assessment round data', () => {
  it('has exactly 5 rounds', () => {
    expect(ASSESSMENT_ROUNDS).toHaveLength(5);
  });

  it('all rounds have valid MIDI note numbers (0-127)', () => {
    for (const round of ASSESSMENT_ROUNDS) {
      for (const note of round.notes) {
        expect(note.note).toBeGreaterThanOrEqual(0);
        expect(note.note).toBeLessThanOrEqual(127);
      }
    }
  });

  it('all rounds have positive tempos', () => {
    for (const round of ASSESSMENT_ROUNDS) {
      expect(round.tempo).toBeGreaterThan(0);
    }
  });

  it('rounds increase in difficulty (tempo generally increases)', () => {
    // Check that the maximum tempo is in the later rounds
    const tempos = ASSESSMENT_ROUNDS.map((r) => r.tempo);
    const maxTempo = Math.max(...tempos);
    const maxTempoIndex = tempos.lastIndexOf(maxTempo);
    // The last round (index 4) should have the highest tempo
    expect(maxTempoIndex).toBe(ASSESSMENT_ROUNDS.length - 1);
  });

  it('all rounds have at least one note', () => {
    for (const round of ASSESSMENT_ROUNDS) {
      expect(round.notes.length).toBeGreaterThan(0);
    }
  });

  it('all rounds have valid startBeat and durationBeats', () => {
    for (const round of ASSESSMENT_ROUNDS) {
      for (const note of round.notes) {
        expect(note.startBeat).toBeGreaterThanOrEqual(0);
        expect(note.durationBeats).toBeGreaterThan(0);
      }
    }
  });

  it('round IDs are sequential from 1 to 5', () => {
    const ids = ASSESSMENT_ROUNDS.map((r) => r.id);
    expect(ids).toEqual([1, 2, 3, 4, 5]);
  });

  it('all rounds have title and description', () => {
    for (const round of ASSESSMENT_ROUNDS) {
      expect(round.title.length).toBeGreaterThan(0);
      expect(round.description.length).toBeGreaterThan(0);
    }
  });
});
