import { adjustDifficulty, type DifficultyProfile } from '../DifficultyEngine';

// ============================================================================
// Helpers
// ============================================================================

function createProfile(overrides: Partial<DifficultyProfile> = {}): DifficultyProfile {
  return {
    tempoRange: { min: 60, max: 100 },
    skills: {
      timingAccuracy: 0.7,
      pitchAccuracy: 0.8,
    },
    totalExercisesCompleted: 10,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('adjustDifficulty', () => {
  describe('tempo adjustments based on score', () => {
    it('increases tempo by 5 BPM for score >= 90', () => {
      const profile = createProfile();
      const result = adjustDifficulty(profile, 95);
      expect(result.tempoChange).toBe(5);
      expect(result.noteRangeExpansion).toBe(2);
      expect(result.reasoning).toContain('95%');
    });

    it('increases tempo by 2 BPM for score >= 70 and < 90', () => {
      const profile = createProfile();
      const result = adjustDifficulty(profile, 75);
      expect(result.tempoChange).toBe(2);
      expect(result.noteRangeExpansion).toBe(0);
    });

    it('decreases tempo by 5 BPM for score < 50', () => {
      const profile = createProfile();
      const result = adjustDifficulty(profile, 40);
      expect(result.tempoChange).toBe(-5);
      expect(result.noteRangeExpansion).toBe(-2);
      expect(result.reasoning).toContain('Struggling');
    });

    it('makes no change for score between 50 and 69', () => {
      const profile = createProfile();
      const result = adjustDifficulty(profile, 60);
      expect(result.tempoChange).toBe(0);
      expect(result.noteRangeExpansion).toBe(0);
      expect(result.reasoning).toContain('Maintaining');
    });

    it('score exactly 90 triggers increase', () => {
      const profile = createProfile();
      const result = adjustDifficulty(profile, 90);
      expect(result.tempoChange).toBe(5);
    });

    it('score exactly 70 triggers slight increase', () => {
      const profile = createProfile();
      const result = adjustDifficulty(profile, 70);
      expect(result.tempoChange).toBe(2);
    });

    it('score exactly 50 triggers no change', () => {
      const profile = createProfile();
      const result = adjustDifficulty(profile, 50);
      expect(result.tempoChange).toBe(0);
    });
  });

  describe('difficulty level from exercises completed', () => {
    it('returns level 1 for 0-5 exercises', () => {
      expect(adjustDifficulty(createProfile({ totalExercisesCompleted: 0 }), 80).difficultyLevel).toBe(1);
      expect(adjustDifficulty(createProfile({ totalExercisesCompleted: 5 }), 80).difficultyLevel).toBe(1);
    });

    it('returns level 2 for 6-15 exercises', () => {
      expect(adjustDifficulty(createProfile({ totalExercisesCompleted: 6 }), 80).difficultyLevel).toBe(2);
      expect(adjustDifficulty(createProfile({ totalExercisesCompleted: 15 }), 80).difficultyLevel).toBe(2);
    });

    it('returns level 3 for 16-30 exercises', () => {
      expect(adjustDifficulty(createProfile({ totalExercisesCompleted: 16 }), 80).difficultyLevel).toBe(3);
      expect(adjustDifficulty(createProfile({ totalExercisesCompleted: 30 }), 80).difficultyLevel).toBe(3);
    });

    it('returns level 4 for 31-50 exercises', () => {
      expect(adjustDifficulty(createProfile({ totalExercisesCompleted: 31 }), 80).difficultyLevel).toBe(4);
      expect(adjustDifficulty(createProfile({ totalExercisesCompleted: 50 }), 80).difficultyLevel).toBe(4);
    });

    it('returns level 5 for 51+ exercises', () => {
      expect(adjustDifficulty(createProfile({ totalExercisesCompleted: 51 }), 80).difficultyLevel).toBe(5);
      expect(adjustDifficulty(createProfile({ totalExercisesCompleted: 200 }), 80).difficultyLevel).toBe(5);
    });
  });

  describe('tempo bounds capping', () => {
    it('caps tempo so max does not exceed 200', () => {
      const profile = createProfile({ tempoRange: { min: 170, max: 198 } });
      const result = adjustDifficulty(profile, 95);
      // Would be +5 but max would exceed 200, so cap to +2
      expect(profile.tempoRange.max + result.tempoChange).toBeLessThanOrEqual(200);
    });

    it('caps tempo so min does not go below 30', () => {
      const profile = createProfile({ tempoRange: { min: 32, max: 60 } });
      const result = adjustDifficulty(profile, 40);
      // Would be -5 but min would go below 30, so cap
      expect(profile.tempoRange.min + result.tempoChange).toBeGreaterThanOrEqual(30);
    });

    it('allows tempo change when within bounds', () => {
      const profile = createProfile({ tempoRange: { min: 60, max: 100 } });
      const result = adjustDifficulty(profile, 95);
      expect(result.tempoChange).toBe(5);
      expect(profile.tempoRange.max + result.tempoChange).toBe(105);
    });
  });

  describe('return structure', () => {
    it('always returns all required fields', () => {
      const result = adjustDifficulty(createProfile(), 80);
      expect(typeof result.tempoChange).toBe('number');
      expect(typeof result.noteRangeExpansion).toBe('number');
      expect(typeof result.difficultyLevel).toBe('number');
      expect(typeof result.reasoning).toBe('string');
      expect(result.difficultyLevel).toBeGreaterThanOrEqual(1);
      expect(result.difficultyLevel).toBeLessThanOrEqual(5);
    });

    it('includes score in reasoning string', () => {
      const result = adjustDifficulty(createProfile(), 85);
      expect(result.reasoning).toContain('85%');
    });
  });
});
