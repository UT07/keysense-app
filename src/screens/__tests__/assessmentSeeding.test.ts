/**
 * Assessment Seeding Tests
 * Verifies that getSkillsToSeedForLesson returns the correct prerequisite
 * skills for each lesson placement, and that determineStartLesson behaves
 * correctly for seeding purposes.
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
  getSkillsToSeedForLesson,
} from '../SkillAssessmentScreen';

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
// getSkillsToSeedForLesson tests
// ---------------------------------------------------------------------------

describe('getSkillsToSeedForLesson', () => {
  it('returns empty array for lesson-01', () => {
    expect(getSkillsToSeedForLesson('lesson-01')).toEqual([]);
  });

  it('returns empty array for invalid lesson strings', () => {
    expect(getSkillsToSeedForLesson('not-a-lesson')).toEqual([]);
    expect(getSkillsToSeedForLesson('')).toEqual([]);
  });

  it('returns lesson-01 and lesson-02 prereqs for lesson-02', () => {
    const skills = getSkillsToSeedForLesson('lesson-02');
    expect(skills).toContain('find-middle-c');
    expect(skills).toContain('keyboard-geography');
    expect(skills).toContain('white-keys');
    expect(skills).toHaveLength(3);
  });

  it('returns lesson-01 through lesson-03 prereqs for lesson-03', () => {
    const skills = getSkillsToSeedForLesson('lesson-03');
    // lesson-02 prereqs
    expect(skills).toContain('find-middle-c');
    expect(skills).toContain('keyboard-geography');
    expect(skills).toContain('white-keys');
    // lesson-03 prereqs
    expect(skills).toContain('rh-cde');
    expect(skills).toContain('rh-cdefg');
    expect(skills).toHaveLength(5);
  });

  it('returns all prereqs through lesson-04', () => {
    const skills = getSkillsToSeedForLesson('lesson-04');
    // lesson-02
    expect(skills).toContain('find-middle-c');
    expect(skills).toContain('keyboard-geography');
    expect(skills).toContain('white-keys');
    // lesson-03
    expect(skills).toContain('rh-cde');
    expect(skills).toContain('rh-cdefg');
    // lesson-04
    expect(skills).toContain('c-position-review');
    expect(skills).toContain('lh-scale-descending');
    expect(skills).toContain('steady-bass');
    expect(skills).toHaveLength(8);
  });

  it('returns all prereqs through lesson-05', () => {
    const skills = getSkillsToSeedForLesson('lesson-05');
    // lesson-02
    expect(skills).toContain('find-middle-c');
    expect(skills).toContain('keyboard-geography');
    expect(skills).toContain('white-keys');
    // lesson-03
    expect(skills).toContain('rh-cde');
    expect(skills).toContain('rh-cdefg');
    // lesson-04
    expect(skills).toContain('c-position-review');
    expect(skills).toContain('lh-scale-descending');
    expect(skills).toContain('steady-bass');
    // lesson-05
    expect(skills).toContain('both-hands-review');
    expect(skills).toHaveLength(9);
  });

  it('deduplicates shared skills across lessons', () => {
    // lesson-05 has 'both-hands-review' and lesson-06 also has 'both-hands-review'
    const skills = getSkillsToSeedForLesson('lesson-06');
    const bothHandsCount = skills.filter((s) => s === 'both-hands-review').length;
    expect(bothHandsCount).toBe(1);
    // lesson-06 adds 'scale-review'
    expect(skills).toContain('scale-review');
    expect(skills).toContain('both-hands-review');
    expect(skills).toHaveLength(10);
  });

  it('handles post-curriculum by returning empty (not a numbered lesson)', () => {
    expect(getSkillsToSeedForLesson('post-curriculum')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// determineStartLesson — verify existing behavior for seeding context
// ---------------------------------------------------------------------------

describe('determineStartLesson (seeding context)', () => {
  it('lesson-03 placement seeds rh-cde and rh-cdefg', () => {
    // First 2 rounds perfect, rest fail
    const scores = [0.95, 0.92, 0.5, 0.4, 0.3];
    const lesson = determineStartLesson(scores);
    expect(lesson).toBe('lesson-03');

    const skills = getSkillsToSeedForLesson(lesson);
    expect(skills).toContain('rh-cde');
    expect(skills).toContain('rh-cdefg');
  });

  it('lesson-05 placement seeds all prereqs through lesson-05', () => {
    const scores = [0.95, 0.92, 0.9, 0.5, 0.4];
    const lesson = determineStartLesson(scores);
    expect(lesson).toBe('lesson-05');

    const skills = getSkillsToSeedForLesson(lesson);
    expect(skills).toContain('both-hands-review');
    expect(skills.length).toBe(9);
  });

  it('lesson-01 placement seeds no skills', () => {
    const scores = [0.3, 0.5, 0.4, 0.2, 0.1];
    const lesson = determineStartLesson(scores);
    expect(lesson).toBe('lesson-01');

    const skills = getSkillsToSeedForLesson(lesson);
    expect(skills).toHaveLength(0);
  });
});
