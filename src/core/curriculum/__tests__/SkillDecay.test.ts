/**
 * SkillDecay Tests
 *
 * Tests the skill decay system and multi-session mastery tracking.
 * Covers: markSkillMastered, recordSkillPractice, calculateDecayedSkills,
 * getSkillsNeedingReview, addRecentExercise, and decay refresh on practice.
 */

import { useLearnerProfileStore } from '../../../stores/learnerProfileStore';
import { getSkillsNeedingReview, getSkillById } from '../SkillTree';
import type { SkillMasteryRecord } from '../../../stores/types';

jest.mock('../../../stores/persistence', () => ({
  PersistenceManager: { saveState: jest.fn(), loadState: jest.fn(), deleteState: jest.fn() },
  STORAGE_KEYS: { LEARNER_PROFILE: 'learnerProfile' },
  createDebouncedSave: () => jest.fn(),
  createImmediateSave: () => jest.fn(),
}));

describe('SkillDecay', () => {
  beforeEach(() => {
    useLearnerProfileStore.getState().reset();
    jest.restoreAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // markSkillMastered
  // ──────────────────────────────────────────────────────────────────────────

  it('markSkillMastered creates skillMasteryData entry', () => {
    const store = useLearnerProfileStore.getState();
    const before = Date.now();
    store.markSkillMastered('find-middle-c');
    const after = Date.now();

    const state = useLearnerProfileStore.getState();
    expect(state.masteredSkills).toContain('find-middle-c');

    const record = state.skillMasteryData['find-middle-c'];
    expect(record).toBeDefined();
    expect(record.decayScore).toBe(1.0);
    expect(record.masteredAt).toBeGreaterThanOrEqual(before);
    expect(record.masteredAt).toBeLessThanOrEqual(after);
    expect(record.lastPracticedAt).toBeGreaterThanOrEqual(before);
    expect(record.lastPracticedAt).toBeLessThanOrEqual(after);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // recordSkillPractice
  // ──────────────────────────────────────────────────────────────────────────

  it('recordSkillPractice increments completionCount', () => {
    const store = useLearnerProfileStore.getState();
    store.recordSkillPractice('find-middle-c', true);
    store.recordSkillPractice('find-middle-c', true);
    store.recordSkillPractice('find-middle-c', true);

    const record = useLearnerProfileStore.getState().skillMasteryData['find-middle-c'];
    expect(record).toBeDefined();
    expect(record.completionCount).toBe(3);
  });

  it('recordSkillPractice auto-masters when threshold met', () => {
    // 'hands-together-basic' has requiredCompletions = 2
    const skill = getSkillById('hands-together-basic');
    expect(skill).not.toBeNull();
    expect(skill!.requiredCompletions).toBe(2);

    const store = useLearnerProfileStore.getState();
    store.recordSkillPractice('hands-together-basic', true);
    // After 1 completion, should not be mastered yet
    expect(useLearnerProfileStore.getState().masteredSkills).not.toContain('hands-together-basic');

    useLearnerProfileStore.getState().recordSkillPractice('hands-together-basic', true);
    // After 2 completions, should be auto-mastered
    expect(useLearnerProfileStore.getState().masteredSkills).toContain('hands-together-basic');
  });

  it('recordSkillPractice does not auto-master on failure', () => {
    // 'find-middle-c' has requiredCompletions = 1
    const store = useLearnerProfileStore.getState();
    store.recordSkillPractice('find-middle-c', false);

    const state = useLearnerProfileStore.getState();
    const record = state.skillMasteryData['find-middle-c'];
    expect(record).toBeDefined();
    // completionCount should NOT increment when passed=false
    expect(record.completionCount).toBe(0);
    expect(state.masteredSkills).not.toContain('find-middle-c');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // calculateDecayedSkills
  // ──────────────────────────────────────────────────────────────────────────

  it('calculateDecayedSkills returns empty for fresh skills', () => {
    const store = useLearnerProfileStore.getState();
    store.markSkillMastered('find-middle-c');

    const decayed = useLearnerProfileStore.getState().calculateDecayedSkills();
    expect(decayed).toEqual([]);
  });

  it('calculateDecayedSkills returns skill after simulated decay', () => {
    // Master the skill, then manually set lastPracticedAt to 15+ days ago
    const store = useLearnerProfileStore.getState();
    store.markSkillMastered('find-middle-c');

    const fifteenDaysAgo = Date.now() - 15 * 86400000;
    useLearnerProfileStore.setState({
      skillMasteryData: {
        'find-middle-c': {
          masteredAt: fifteenDaysAgo,
          lastPracticedAt: fifteenDaysAgo,
          completionCount: 1,
          decayScore: 1.0,
        },
      },
    });

    const decayed = useLearnerProfileStore.getState().calculateDecayedSkills();
    // With DECAY_HALF_LIFE_DAYS=14 and 15 days elapsed:
    // decay = max(0, 1 - 15/14) = max(0, -0.07) = 0, which is < DECAY_THRESHOLD (0.5)
    expect(decayed).toContain('find-middle-c');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // getSkillsNeedingReview
  // ──────────────────────────────────────────────────────────────────────────

  it('getSkillsNeedingReview filters by decay threshold', () => {
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const skillMasteryData: Record<string, SkillMasteryRecord> = {
      'find-middle-c': {
        masteredAt: thirtyDaysAgo,
        lastPracticedAt: thirtyDaysAgo,
        completionCount: 1,
        decayScore: 1.0, // stored value does not matter; getSkillsNeedingReview recalculates
      },
      'keyboard-geography': {
        masteredAt: Date.now(),
        lastPracticedAt: Date.now(), // fresh, should not need review
        completionCount: 1,
        decayScore: 1.0,
      },
    };
    const masteredSkills = ['find-middle-c', 'keyboard-geography'];

    const needsReview = getSkillsNeedingReview(masteredSkills, skillMasteryData);

    // find-middle-c: 30 days ago => decay = max(0, 1 - 30/14) = 0 < 0.5 => needs review
    expect(needsReview.some((n) => n.id === 'find-middle-c')).toBe(true);
    // keyboard-geography: just now => decay = 1.0 > 0.5 => does NOT need review
    expect(needsReview.some((n) => n.id === 'keyboard-geography')).toBe(false);
  });

  it('getSkillsNeedingReview sorts by staleness', () => {
    const twentyDaysAgo = Date.now() - 20 * 86400000;
    const thirtyDaysAgo = Date.now() - 30 * 86400000;
    const skillMasteryData: Record<string, SkillMasteryRecord> = {
      'find-middle-c': {
        masteredAt: twentyDaysAgo,
        lastPracticedAt: twentyDaysAgo,
        completionCount: 1,
        decayScore: 1.0,
      },
      'keyboard-geography': {
        masteredAt: thirtyDaysAgo,
        lastPracticedAt: thirtyDaysAgo, // older = more decayed
        completionCount: 1,
        decayScore: 1.0,
      },
    };
    const masteredSkills = ['find-middle-c', 'keyboard-geography'];

    const needsReview = getSkillsNeedingReview(masteredSkills, skillMasteryData);

    // Both should need review (both > DECAY_HALF_LIFE_DAYS)
    expect(needsReview.length).toBe(2);
    // keyboard-geography (30 days) should come first (oldest practiced = most decayed)
    expect(needsReview[0].id).toBe('keyboard-geography');
    expect(needsReview[1].id).toBe('find-middle-c');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // addRecentExercise
  // ──────────────────────────────────────────────────────────────────────────

  it('addRecentExercise caps at 10', () => {
    for (let i = 0; i < 15; i++) {
      useLearnerProfileStore.getState().addRecentExercise(`exercise-${i}`);
    }

    const { recentExerciseIds } = useLearnerProfileStore.getState();
    expect(recentExerciseIds.length).toBe(10);
    // Most recent should be first
    expect(recentExerciseIds[0]).toBe('exercise-14');
  });

  it('addRecentExercise deduplicates', () => {
    const store = useLearnerProfileStore.getState();
    store.addRecentExercise('lesson-01-ex-01');
    useLearnerProfileStore.getState().addRecentExercise('lesson-01-ex-02');
    useLearnerProfileStore.getState().addRecentExercise('lesson-01-ex-01'); // duplicate

    const { recentExerciseIds } = useLearnerProfileStore.getState();
    const occurrences = recentExerciseIds.filter((id) => id === 'lesson-01-ex-01');
    expect(occurrences.length).toBe(1);
    // Re-added item should be moved to the front
    expect(recentExerciseIds[0]).toBe('lesson-01-ex-01');
    expect(recentExerciseIds.length).toBe(2);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Decay refresh on practice
  // ──────────────────────────────────────────────────────────────────────────

  it('recordSkillPractice refreshes decay', () => {
    // Simulate a decayed skill by setting old lastPracticedAt
    const fifteenDaysAgo = Date.now() - 15 * 86400000;
    useLearnerProfileStore.setState({
      masteredSkills: ['find-middle-c'],
      skillMasteryData: {
        'find-middle-c': {
          masteredAt: fifteenDaysAgo,
          lastPracticedAt: fifteenDaysAgo,
          completionCount: 1,
          decayScore: 0.2, // simulated low decay score
        },
      },
    });

    // Verify it's decayed before practice
    const decayedBefore = useLearnerProfileStore.getState().calculateDecayedSkills();
    expect(decayedBefore).toContain('find-middle-c');

    // Practice the skill
    const beforePractice = Date.now();
    useLearnerProfileStore.getState().recordSkillPractice('find-middle-c', true);

    const record = useLearnerProfileStore.getState().skillMasteryData['find-middle-c'];
    // decayScore should be refreshed to 1.0
    expect(record.decayScore).toBe(1.0);
    // lastPracticedAt should be updated to now
    expect(record.lastPracticedAt).toBeGreaterThanOrEqual(beforePractice);

    // Should no longer be in the decayed list
    const decayedAfter = useLearnerProfileStore.getState().calculateDecayedSkills();
    expect(decayedAfter).not.toContain('find-middle-c');
  });
});
