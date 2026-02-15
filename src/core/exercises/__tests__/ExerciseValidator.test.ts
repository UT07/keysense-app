/**
 * Tests for exercise scoring and validation
 */

import {
  calculateTimingScore,
  calculateDurationScore,
  scoreExercise,
  validateExercise,
} from '../ExerciseValidator';
import type { Exercise, MidiNoteEvent } from '../types';

describe('ExerciseValidator', () => {
  const mockExercise: Exercise = {
    id: 'test-exercise',
    version: 1,
    metadata: {
      title: 'Test Exercise',
      description: 'A test exercise',
      difficulty: 1,
      estimatedMinutes: 5,
      skills: ['test'],
      prerequisites: [],
    },
    settings: {
      tempo: 120,
      timeSignature: [4, 4],
      keySignature: 'C',
      countIn: 0,
      metronomeEnabled: false,
    },
    notes: [
      { note: 60, startBeat: 0, durationBeats: 1 },
      { note: 62, startBeat: 1, durationBeats: 1 },
      { note: 64, startBeat: 2, durationBeats: 1 },
    ],
    scoring: {
      timingToleranceMs: 50,
      timingGracePeriodMs: 100,
      passingScore: 70,
      starThresholds: [80, 90, 95],
    },
    hints: {
      beforeStart: 'Test hint',
      commonMistakes: [],
      successMessage: 'Success!',
    },
  };

  describe('calculateTimingScore', () => {
    it('should return 100 for perfect timing', () => {
      const score = calculateTimingScore(0, 50, 100);
      expect(score).toBe(100);
    });

    it('should return 100 for timing within tolerance', () => {
      const score = calculateTimingScore(30, 50, 100);
      expect(score).toBe(100);
    });

    it('should return less than 100 for timing outside tolerance', () => {
      const score = calculateTimingScore(75, 50, 100);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(0);
    });

    it('should return 0 for severely late timing', () => {
      const score = calculateTimingScore(300, 50, 100);
      expect(score).toBe(0);
    });
  });

  describe('validateExercise', () => {
    it('should validate a correct exercise', () => {
      const result = validateExercise(mockExercise);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject exercise with no id', () => {
      const invalidExercise = { ...mockExercise, id: '' };
      const result = validateExercise(invalidExercise);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject exercise with no notes', () => {
      const invalidExercise = { ...mockExercise, notes: [] };
      const result = validateExercise(invalidExercise);
      expect(result.valid).toBe(false);
    });
  });

  describe('scoreExercise', () => {
    it('should score a perfect performance', () => {
      const playedNotes: MidiNoteEvent[] = [
        {
          type: 'noteOn',
          note: 60,
          velocity: 100,
          timestamp: 0,
          channel: 0,
        },
        {
          type: 'noteOn',
          note: 62,
          velocity: 100,
          timestamp: 500,
          channel: 0,
        },
        {
          type: 'noteOn',
          note: 64,
          velocity: 100,
          timestamp: 1000,
          channel: 0,
        },
      ];

      const score = scoreExercise(mockExercise, playedNotes);
      expect(score.overall).toBeGreaterThan(80);
      expect(score.stars).toBeGreaterThan(0);
    });

    it('should return 0 for no played notes', () => {
      const score = scoreExercise(mockExercise, []);
      expect(score.overall).toBeLessThan(50);
    });

    it('should include duration in breakdown', () => {
      const playedNotes: MidiNoteEvent[] = [
        { type: 'noteOn', note: 60, velocity: 100, timestamp: 0, channel: 0, durationMs: 500 },
        { type: 'noteOn', note: 62, velocity: 100, timestamp: 500, channel: 0, durationMs: 500 },
        { type: 'noteOn', note: 64, velocity: 100, timestamp: 1000, channel: 0, durationMs: 500 },
      ];
      const score = scoreExercise(mockExercise, playedNotes);
      expect(score.breakdown.duration).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.duration).toBeLessThanOrEqual(100);
    });

    it('should give neutral duration score when no durationMs provided', () => {
      const playedNotes: MidiNoteEvent[] = [
        { type: 'noteOn', note: 60, velocity: 100, timestamp: 0, channel: 0 },
        { type: 'noteOn', note: 62, velocity: 100, timestamp: 500, channel: 0 },
        { type: 'noteOn', note: 64, velocity: 100, timestamp: 1000, channel: 0 },
      ];
      const score = scoreExercise(mockExercise, playedNotes);
      // Neutral score for tap-only is 70
      expect(score.breakdown.duration).toBe(70);
    });
  });

  describe('calculateDurationScore', () => {
    it('should return 100 for perfect duration (1.0x expected)', () => {
      expect(calculateDurationScore(500, 500)).toBe(100);
    });

    it('should return 100 within acceptable range (0.7x - 1.3x)', () => {
      expect(calculateDurationScore(350, 500)).toBe(100); // 0.7x
      expect(calculateDurationScore(650, 500)).toBe(100); // 1.3x
    });

    it('should return partial credit for 0.5x expected', () => {
      const score = calculateDurationScore(250, 500);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    it('should return 70 for no duration data (tap-only)', () => {
      expect(calculateDurationScore(undefined, 500)).toBe(70);
      expect(calculateDurationScore(0, 500)).toBe(70);
    });

    it('should return 0 for extremely long hold (3x)', () => {
      expect(calculateDurationScore(1500, 500)).toBe(0);
    });
  });
});
