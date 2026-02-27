/**
 * Challenge System Tests
 *
 * Tests deterministic daily/weekly/monthly challenge generation,
 * challenge validation, and date-based active checks.
 */

import {
  getDailyChallengeForDate,
  getWeeklyChallengeForWeek,
  getMonthlyChallengeForMonth,
  isDailyChallengeComplete,
  isWeeklyChallengeComplete,
  isWeeklyChallengeDay,
  isMonthlyChallengeActive,
} from '../challengeSystem';
import type {
  DailyChallenge,
  WeeklyChallenge,
  ExerciseChallengeContext,
} from '../challengeSystem';

// ============================================================================
// getDailyChallengeForDate
// ============================================================================

describe('getDailyChallengeForDate', () => {
  it('returns a valid challenge object', () => {
    const challenge = getDailyChallengeForDate('2026-02-23');
    expect(challenge).toBeDefined();
    expect(challenge.type).toBeDefined();
    expect(challenge.label).toBeTruthy();
    expect(challenge.description).toBeTruthy();
    expect(challenge.icon).toBeTruthy();
    expect(challenge.reward).toBeDefined();
    expect(challenge.reward.gems).toBeGreaterThan(0);
    expect(challenge.reward.xpMultiplier).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic — same date produces same challenge', () => {
    const c1 = getDailyChallengeForDate('2026-03-15');
    const c2 = getDailyChallengeForDate('2026-03-15');
    expect(c1).toEqual(c2);
  });

  it('produces different challenges for different dates', () => {
    const challenges = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      const date = `2026-03-${String(d).padStart(2, '0')}`;
      const c = getDailyChallengeForDate(date);
      challenges.add(c.label);
    }
    // Over 30 days should see at least 3 different challenge labels
    expect(challenges.size).toBeGreaterThanOrEqual(3);
  });

  it('generates category-specific challenges', () => {
    // Run through many dates to find at least one category challenge
    let foundCategory = false;
    for (let d = 1; d <= 100; d++) {
      const date = `2026-01-${String((d % 28) + 1).padStart(2, '0')}`;
      const c = getDailyChallengeForDate(date);
      if (c.type === 'specific-category') {
        foundCategory = true;
        expect(c.category).toBeDefined();
        break;
      }
    }
    expect(foundCategory).toBe(true);
  });

  it('generates non-category challenges (template-based)', () => {
    let foundTemplate = false;
    for (let d = 1; d <= 100; d++) {
      const date = `2026-04-${String((d % 28) + 1).padStart(2, '0')}`;
      const c = getDailyChallengeForDate(date);
      if (c.type !== 'specific-category') {
        foundTemplate = true;
        break;
      }
    }
    expect(foundTemplate).toBe(true);
  });

  it('all challenge types have correct reward structure', () => {
    for (let d = 1; d <= 60; d++) {
      const date = `2026-02-${String((d % 28) + 1).padStart(2, '0')}`;
      const c = getDailyChallengeForDate(date);
      expect(c.reward.gems).toBeGreaterThanOrEqual(10);
      expect(c.reward.gems).toBeLessThanOrEqual(20);
      expect(c.reward.xpMultiplier).toBe(2);
    }
  });

  it('filters category challenges by masteredSkills when provided', () => {
    // With no mastered skills, category challenges should only use note-finding
    const categoryChallenges: DailyChallenge[] = [];
    for (let d = 1; d <= 200; d++) {
      const date = `2026-05-${String((d % 28) + 1).padStart(2, '0')}`;
      const c = getDailyChallengeForDate(date, []);
      if (c.type === 'specific-category') {
        categoryChallenges.push(c);
      }
    }
    // With empty masteredSkills, note-finding is the only accessible category,
    // but it's not in CHALLENGE_CATEGORIES, so category challenges should fall
    // through to templates
    for (const c of categoryChallenges) {
      expect(c.category).not.toBe('hand-independence');
      expect(c.category).not.toBe('chords');
    }
  });

  it('is deterministic with masteredSkills', () => {
    const skills = ['find-middle-c', 'keyboard-geography', 'white-keys'];
    const c1 = getDailyChallengeForDate('2026-06-10', skills);
    const c2 = getDailyChallengeForDate('2026-06-10', skills);
    expect(c1).toEqual(c2);
  });

  it('without masteredSkills uses all categories (backward compatible)', () => {
    // Without masteredSkills, should still produce category-specific challenges
    // from the full CHALLENGE_CATEGORIES list
    let foundCategory = false;
    for (let d = 1; d <= 100; d++) {
      const date = `2026-07-${String((d % 28) + 1).padStart(2, '0')}`;
      const c = getDailyChallengeForDate(date);
      if (c.type === 'specific-category') {
        foundCategory = true;
        break;
      }
    }
    expect(foundCategory).toBe(true);
  });
});

// ============================================================================
// getWeeklyChallengeForWeek
// ============================================================================

describe('getWeeklyChallengeForWeek', () => {
  it('returns a valid weekly challenge', () => {
    const c = getWeeklyChallengeForWeek('2026-02-17');
    expect(c.weekStartDate).toBe('2026-02-17');
    expect(c.challengeDay).toBeGreaterThanOrEqual(1);
    expect(c.challengeDay).toBeLessThanOrEqual(7);
    expect(c.reward.gems).toBe(50);
    expect(c.reward.xpMultiplier).toBe(3);
    expect(c.label).toBeTruthy();
  });

  it('is deterministic', () => {
    const c1 = getWeeklyChallengeForWeek('2026-02-17');
    const c2 = getWeeklyChallengeForWeek('2026-02-17');
    expect(c1).toEqual(c2);
  });

  it('different weeks produce different challenges', () => {
    const weeks = [
      '2026-02-10', '2026-02-17', '2026-02-24',
      '2026-03-03', '2026-03-10', '2026-03-17',
    ];
    const days = new Set<number>();
    for (const w of weeks) {
      const c = getWeeklyChallengeForWeek(w);
      days.add(c.challengeDay);
    }
    // Across 6 weeks, should have at least 2 different challenge days
    expect(days.size).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// getMonthlyChallengeForMonth
// ============================================================================

describe('getMonthlyChallengeForMonth', () => {
  it('returns a valid monthly challenge', () => {
    const c = getMonthlyChallengeForMonth('2026-02');
    expect(c.month).toBe('2026-02');
    expect(c.challengeDay).toBeGreaterThanOrEqual(2);
    expect(c.challengeDay).toBeLessThanOrEqual(27);
    expect(c.exercisesRequired).toBeGreaterThanOrEqual(3);
    expect(c.exercisesRequired).toBeLessThanOrEqual(5);
    expect(c.reward.gems).toBe(150);
    expect(c.reward.xpMultiplier).toBe(3);
    expect(c.durationHours).toBe(48);
  });

  it('is deterministic', () => {
    const c1 = getMonthlyChallengeForMonth('2026-03');
    const c2 = getMonthlyChallengeForMonth('2026-03');
    expect(c1).toEqual(c2);
  });

  it('different months produce different challenge days', () => {
    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
    const days = new Set<number>();
    for (const m of months) {
      const c = getMonthlyChallengeForMonth(m);
      days.add(c.challengeDay);
    }
    expect(days.size).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================================
// isDailyChallengeComplete
// ============================================================================

describe('isDailyChallengeComplete', () => {
  const baseCtx: ExerciseChallengeContext = {
    score: 90,
    maxCombo: 8,
    perfectNotes: 5,
    playbackSpeed: 1.0,
    minutesPracticedToday: 10,
  };

  it('any-exercise type is always complete', () => {
    const challenge: DailyChallenge = {
      type: 'any-exercise',
      label: 'Complete any exercise',
      description: 'Play any exercise!',
      icon: 'music-note',
      reward: { gems: 10, xpMultiplier: 2 },
    };
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, score: 0 })).toBe(true);
  });

  it('specific-category checks category match', () => {
    const challenge: DailyChallenge = {
      type: 'specific-category',
      label: 'Play a chord exercise',
      description: 'Focus on chords!',
      icon: 'tag-outline',
      category: 'chords',
      reward: { gems: 15, xpMultiplier: 2 },
    };
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, category: 'chords' })).toBe(true);
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, category: 'scales' })).toBe(false);
    expect(isDailyChallengeComplete(challenge, { ...baseCtx })).toBe(false);
  });

  it('score-threshold checks score >= threshold', () => {
    const challenge: DailyChallenge = {
      type: 'score-threshold',
      label: 'Score 85%',
      description: 'Push!',
      icon: 'star',
      threshold: 85,
      reward: { gems: 15, xpMultiplier: 2 },
    };
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, score: 90 })).toBe(true);
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, score: 85 })).toBe(true);
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, score: 80 })).toBe(false);
  });

  it('combo-streak checks maxCombo >= threshold', () => {
    const challenge: DailyChallenge = {
      type: 'combo-streak',
      label: '5-note combo',
      description: 'Streak!',
      icon: 'fire',
      threshold: 5,
      reward: { gems: 15, xpMultiplier: 2 },
    };
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, maxCombo: 5 })).toBe(true);
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, maxCombo: 10 })).toBe(true);
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, maxCombo: 3 })).toBe(false);
  });

  it('speed-run checks playbackSpeed >= threshold', () => {
    const challenge: DailyChallenge = {
      type: 'speed-run',
      label: 'Full speed',
      description: 'Go fast!',
      icon: 'speedometer',
      threshold: 1.0,
      reward: { gems: 12, xpMultiplier: 2 },
    };
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, playbackSpeed: 1.0 })).toBe(true);
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, playbackSpeed: 0.75 })).toBe(false);
  });

  it('perfect-notes checks perfectNotes >= threshold', () => {
    const challenge: DailyChallenge = {
      type: 'perfect-notes',
      label: '3 perfect',
      description: 'Nail it!',
      icon: 'bullseye-arrow',
      threshold: 3,
      reward: { gems: 15, xpMultiplier: 2 },
    };
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, perfectNotes: 5 })).toBe(true);
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, perfectNotes: 3 })).toBe(true);
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, perfectNotes: 1 })).toBe(false);
  });

  it('practice-minutes checks minutesPracticedToday >= threshold', () => {
    const challenge: DailyChallenge = {
      type: 'practice-minutes',
      label: '5 min practice',
      description: 'Keep at it!',
      icon: 'clock-check-outline',
      threshold: 5,
      reward: { gems: 12, xpMultiplier: 2 },
    };
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, minutesPracticedToday: 10 })).toBe(true);
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, minutesPracticedToday: 5 })).toBe(true);
    expect(isDailyChallengeComplete(challenge, { ...baseCtx, minutesPracticedToday: 2 })).toBe(false);
  });
});

// ============================================================================
// isWeeklyChallengeComplete
// ============================================================================

describe('isWeeklyChallengeComplete', () => {
  const ctx: ExerciseChallengeContext = {
    score: 95,
    maxCombo: 12,
    perfectNotes: 10,
    playbackSpeed: 1.0,
    minutesPracticedToday: 15,
  };

  it('score-threshold weekly checks higher threshold', () => {
    const challenge: WeeklyChallenge = {
      weekStartDate: '2026-02-17',
      challengeDay: 3,
      type: 'score-threshold',
      label: 'Score 90%',
      description: 'Near perfection!',
      icon: 'medal',
      threshold: 90,
      reward: { gems: 50, xpMultiplier: 3 },
    };
    expect(isWeeklyChallengeComplete(challenge, { ...ctx, score: 95 })).toBe(true);
    expect(isWeeklyChallengeComplete(challenge, { ...ctx, score: 85 })).toBe(false);
  });

  it('combo-streak weekly checks higher threshold', () => {
    const challenge: WeeklyChallenge = {
      weekStartDate: '2026-02-17',
      challengeDay: 5,
      type: 'combo-streak',
      label: '10-note combo',
      description: 'Epic!',
      icon: 'fire',
      threshold: 10,
      reward: { gems: 50, xpMultiplier: 3 },
    };
    expect(isWeeklyChallengeComplete(challenge, { ...ctx, maxCombo: 12 })).toBe(true);
    expect(isWeeklyChallengeComplete(challenge, { ...ctx, maxCombo: 7 })).toBe(false);
  });
});

// ============================================================================
// isWeeklyChallengeDay
// ============================================================================

describe('isWeeklyChallengeDay', () => {
  it('returns a boolean', () => {
    const result = isWeeklyChallengeDay('2026-02-17');
    expect(typeof result).toBe('boolean');
  });
});

// ============================================================================
// isMonthlyChallengeActive
// ============================================================================

describe('isMonthlyChallengeActive', () => {
  it('returns a boolean', () => {
    const result = isMonthlyChallengeActive('2026-02');
    expect(typeof result).toBe('boolean');
  });
});
