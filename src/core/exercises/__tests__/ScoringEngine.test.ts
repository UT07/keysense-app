/**
 * Comprehensive tests for Scoring Engine
 * Tests timing calculations, accuracy, completeness, and final scores
 */

import {
  calculateTimingScore,
  calculateAccuracy,
  calculateCompleteness,
  calculatePrecision,
  calculateFinalScore,
  calculateStars,
  isPassed,
  calculateXpEarned,
  summarizeNoteScores,
  buildExerciseScore,
} from '../ScoringEngine';
import { NoteScore } from '../types';

describe('ScoringEngine', () => {
  describe('calculateTimingScore', () => {
    it('should return perfect score for timing within tolerance', () => {
      const result = calculateTimingScore(10, 25, 75);
      expect(result.score).toBe(100);
      expect(result.status).toBe('perfect');
    });

    it('should return perfect score for negative offset within tolerance', () => {
      const result = calculateTimingScore(-15, 25, 75);
      expect(result.score).toBe(100);
      expect(result.status).toBe('perfect');
    });

    it('should return good score for timing within grace period', () => {
      const result = calculateTimingScore(50, 25, 75);
      expect(result.score).toBeGreaterThan(70);
      expect(result.score).toBeLessThan(100);
      expect(result.status).toBe('good');
    });

    it('should return ok score for timing within ok range', () => {
      const result = calculateTimingScore(100, 25, 75);
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(70);
      expect(result.status).toBe('ok');
    });

    it('should return missed for timing too far off', () => {
      const result = calculateTimingScore(400, 25, 75);
      expect(result.score).toBe(0);
      expect(result.status).toBe('late');
    });

    it('should handle early notes correctly', () => {
      const result = calculateTimingScore(-200, 25, 75);
      expect(result.score).toBe(0);
      expect(result.status).toBe('early');
    });
  });

  describe('calculateAccuracy', () => {
    it('should return 100% when all notes are correct', () => {
      const accuracy = calculateAccuracy(10, 10);
      expect(accuracy).toBe(100);
    });

    it('should return 0% when no notes are correct', () => {
      const accuracy = calculateAccuracy(0, 10);
      expect(accuracy).toBe(0);
    });

    it('should calculate partial accuracy', () => {
      const accuracy = calculateAccuracy(7, 10);
      expect(accuracy).toBe(70);
    });

    it('should return 100% for empty exercises', () => {
      const accuracy = calculateAccuracy(0, 0);
      expect(accuracy).toBe(100);
    });
  });

  describe('calculateCompleteness', () => {
    it('should return 100% when all notes are attempted', () => {
      const completeness = calculateCompleteness(10, 10);
      expect(completeness).toBe(100);
    });

    it('should return 0% when no notes are attempted', () => {
      const completeness = calculateCompleteness(0, 10);
      expect(completeness).toBe(0);
    });

    it('should calculate partial completeness', () => {
      const completeness = calculateCompleteness(6, 10);
      expect(completeness).toBe(60);
    });
  });

  describe('calculatePrecision', () => {
    it('should return 100% when no extra notes', () => {
      const precision = calculatePrecision(0, 10);
      expect(precision).toBe(100);
    });

    it('should penalize extra notes', () => {
      const precision = calculatePrecision(2, 10);
      expect(precision).toBeLessThan(100);
      expect(precision).toBeGreaterThan(50);
    });

    it('should not drop below 50% even with many extra notes', () => {
      const precision = calculatePrecision(100, 10);
      expect(precision).toBe(50);
    });
  });

  describe('calculateFinalScore', () => {
    it('should weight components correctly', () => {
      const score = calculateFinalScore(100, 100, 100, 100);
      expect(score).toBe(100);
    });

    it('should weight accuracy at 40%', () => {
      const score = calculateFinalScore(100, 0, 0, 0);
      expect(score).toBe(40);
    });

    it('should weight timing at 35%', () => {
      const score = calculateFinalScore(0, 100, 0, 0);
      expect(score).toBe(35);
    });

    it('should weight completeness at 15%', () => {
      const score = calculateFinalScore(0, 0, 100, 0);
      expect(score).toBe(15);
    });

    it('should weight precision at 10%', () => {
      const score = calculateFinalScore(0, 0, 0, 100);
      expect(score).toBe(10);
    });

    it('should combine all weights', () => {
      const score = calculateFinalScore(80, 90, 85, 95);
      expect(score).toBeGreaterThan(80);
      expect(score).toBeLessThan(90);
    });
  });

  describe('calculateStars', () => {
    it('should return 0 stars for low score', () => {
      const stars = calculateStars(50, [70, 85, 95]);
      expect(stars).toBe(0);
    });

    it('should return 1 star at first threshold', () => {
      const stars = calculateStars(70, [70, 85, 95]);
      expect(stars).toBe(1);
    });

    it('should return 2 stars at second threshold', () => {
      const stars = calculateStars(85, [70, 85, 95]);
      expect(stars).toBe(2);
    });

    it('should return 3 stars at third threshold', () => {
      const stars = calculateStars(95, [70, 85, 95]);
      expect(stars).toBe(3);
    });

    it('should use custom thresholds', () => {
      const stars = calculateStars(60, [50, 75, 90]);
      expect(stars).toBe(1);
    });
  });

  describe('isPassed', () => {
    it('should pass when score meets threshold', () => {
      expect(isPassed(70, 70)).toBe(true);
    });

    it('should pass when score exceeds threshold', () => {
      expect(isPassed(75, 70)).toBe(true);
    });

    it('should fail when score below threshold', () => {
      expect(isPassed(65, 70)).toBe(false);
    });
  });

  describe('calculateXpEarned', () => {
    it('should award base XP for completion', () => {
      const xp = calculateXpEarned(50, 0, false, false);
      expect(xp).toBe(10);
    });

    it('should award star bonuses', () => {
      const xp = calculateXpEarned(75, 2, false, false);
      expect(xp).toBeGreaterThan(10);
      expect(xp).toBeGreaterThan(calculateXpEarned(75, 1, false, false));
    });

    it('should award perfect bonus', () => {
      const xp = calculateXpEarned(95, 3, false, true);
      expect(xp).toBeGreaterThan(calculateXpEarned(95, 3, false, false));
    });

    it('should award first completion bonus', () => {
      const xp = calculateXpEarned(50, 0, true, false);
      expect(xp).toBeGreaterThan(calculateXpEarned(50, 0, false, false));
    });
  });

  describe('summarizeNoteScores', () => {
    const mockNoteScores: NoteScore[] = [
      {
        expected: { note: 60, startBeat: 0, durationBeats: 1 },
        played: { type: 'noteOn', note: 60, velocity: 64, timestamp: 10, channel: 0 },
        isCorrectPitch: true,
        timingOffsetMs: 10,
        timingScore: 95,
        status: 'perfect',
        isExtraNote: false,
        isMissedNote: false,
      },
      {
        expected: { note: 62, startBeat: 1, durationBeats: 1 },
        played: null,
        isCorrectPitch: false,
        timingOffsetMs: 0,
        timingScore: 0,
        status: 'missed',
        isExtraNote: false,
        isMissedNote: true,
      },
      {
        expected: { note: 64, startBeat: 2, durationBeats: 1 },
        played: { type: 'noteOn', note: 65, velocity: 70, timestamp: 200, channel: 0 },
        isCorrectPitch: false,
        timingOffsetMs: 0,
        timingScore: 0,
        status: 'wrong',
        isExtraNote: true,
        isMissedNote: false,
      },
    ];

    it('should count perfect notes', () => {
      const summary = summarizeNoteScores(mockNoteScores);
      expect(summary.perfectNotes).toBe(1);
    });

    it('should count missed notes', () => {
      const summary = summarizeNoteScores(mockNoteScores);
      expect(summary.missedNotes).toBe(1);
    });

    it('should count extra notes', () => {
      const summary = summarizeNoteScores(mockNoteScores);
      expect(summary.extraNotes).toBe(1);
    });
  });

  describe('buildExerciseScore', () => {
    const mockConfig = {
      timingToleranceMs: 25,
      timingGracePeriodMs: 75,
      passingScore: 70,
      starThresholds: [70, 85, 95] as [number, number, number],
    };

    const mockNoteScores: NoteScore[] = [
      {
        expected: { note: 60, startBeat: 0, durationBeats: 1 },
        played: { type: 'noteOn', note: 60, velocity: 64, timestamp: 10, channel: 0 },
        isCorrectPitch: true,
        timingOffsetMs: 10,
        timingScore: 100,
        status: 'perfect',
        isExtraNote: false,
        isMissedNote: false,
      },
      {
        expected: { note: 62, startBeat: 1, durationBeats: 1 },
        played: { type: 'noteOn', note: 62, velocity: 70, timestamp: 105, channel: 0 },
        isCorrectPitch: true,
        timingOffsetMs: 5,
        timingScore: 100,
        status: 'perfect',
        isExtraNote: false,
        isMissedNote: false,
      },
    ];

    it('should build complete exercise score', () => {
      const score = buildExerciseScore(mockNoteScores, mockConfig, 0);

      expect(score.overall).toBeGreaterThan(0);
      expect(score.overall).toBeLessThanOrEqual(100);
      expect(score.stars).toBeDefined();
      expect(score.breakdown).toBeDefined();
      expect(score.details).toBeDefined();
      expect(score.xpEarned).toBeGreaterThan(0);
    });

    it('should mark new high score', () => {
      const score = buildExerciseScore(mockNoteScores, mockConfig, 50);
      expect(score.isNewHighScore).toBe(true);
    });

    it('should mark passing exercises', () => {
      const score = buildExerciseScore(mockNoteScores, mockConfig, 0);
      expect(score.isPassed).toBe(score.overall >= mockConfig.passingScore);
    });
  });
});
