import {
  detectWeakPatterns,
  generateDrillParams,
  type WeakPattern,
  type WeakSpotProfile,
} from '../WeakSpotDetector';

// ============================================================================
// Helpers
// ============================================================================

function createCleanProfile(overrides: Partial<WeakSpotProfile> = {}): WeakSpotProfile {
  return {
    noteAccuracy: {
      60: 0.95, // C4
      62: 0.92, // D4
      64: 0.88, // E4
      65: 0.90, // F4
      67: 0.85, // G4
    },
    weakNotes: [],
    skills: {
      timingAccuracy: 0.8,
      pitchAccuracy: 0.85,
    },
    tempoRange: { min: 50, max: 90 },
    ...overrides,
  };
}

function createWeakProfile(overrides: Partial<WeakSpotProfile> = {}): WeakSpotProfile {
  return {
    noteAccuracy: {
      48: 0.4,  // C3 (left hand, weak)
      50: 0.5,  // D3 (left hand, weak)
      52: 0.3,  // E3 (left hand, weak)
      60: 0.9,  // C4 (right hand, good)
      62: 0.85, // D4 (right hand, good)
      64: 0.6,  // E4 (right hand, weak)
      65: 0.55, // F4 (right hand, weak)
    },
    weakNotes: [48, 50, 52, 64, 65],
    skills: {
      timingAccuracy: 0.5,
      pitchAccuracy: 0.7,
    },
    tempoRange: { min: 40, max: 70 },
    ...overrides,
  };
}

// ============================================================================
// detectWeakPatterns
// ============================================================================

describe('detectWeakPatterns', () => {
  it('returns empty array for a clean profile', () => {
    const profile = createCleanProfile();
    const patterns = detectWeakPatterns(profile);
    expect(patterns).toEqual([]);
  });

  it('detects weak individual notes with accuracy < 0.7', () => {
    const profile = createCleanProfile({
      noteAccuracy: {
        60: 0.95,
        62: 0.5, // weak
        64: 0.3, // weak
      },
    });
    const patterns = detectWeakPatterns(profile);
    const notePatterns = patterns.filter((p) => p.type === 'note');
    expect(notePatterns.length).toBe(2);
    // Sorted by severity (worst first)
    expect(notePatterns[0].targetMidi).toEqual([64]);
    expect(notePatterns[0].severity).toBeCloseTo(0.7, 1);
    expect(notePatterns[1].targetMidi).toEqual([62]);
    expect(notePatterns[1].severity).toBeCloseTo(0.5, 1);
  });

  it('detects weak transitions between adjacent weak notes', () => {
    const profile = createCleanProfile({
      noteAccuracy: {
        60: 0.5, // weak
        62: 0.4, // weak - adjacent to 60 (2 semitones apart)
        64: 0.95,
      },
    });
    const patterns = detectWeakPatterns(profile);
    const transitionPatterns = patterns.filter((p) => p.type === 'transition');
    expect(transitionPatterns.length).toBe(1);
    expect(transitionPatterns[0].targetMidi).toContain(60);
    expect(transitionPatterns[0].targetMidi).toContain(62);
  });

  it('does not detect transition for distant weak notes', () => {
    const profile = createCleanProfile({
      noteAccuracy: {
        48: 0.3, // weak
        72: 0.4, // weak but 24 semitones away
      },
    });
    const patterns = detectWeakPatterns(profile);
    const transitionPatterns = patterns.filter((p) => p.type === 'transition');
    expect(transitionPatterns.length).toBe(0);
  });

  it('detects timing issues when timingAccuracy < 0.6', () => {
    const profile = createCleanProfile({
      skills: { timingAccuracy: 0.4, pitchAccuracy: 0.85 },
    });
    const patterns = detectWeakPatterns(profile);
    const timingPatterns = patterns.filter((p) => p.type === 'timing');
    expect(timingPatterns.length).toBe(1);
    expect(timingPatterns[0].severity).toBeCloseTo(0.6, 1);
    expect(timingPatterns[0].description).toContain('40%');
  });

  it('does not detect timing issues when timingAccuracy >= 0.6', () => {
    const profile = createCleanProfile({
      skills: { timingAccuracy: 0.7, pitchAccuracy: 0.85 },
    });
    const patterns = detectWeakPatterns(profile);
    const timingPatterns = patterns.filter((p) => p.type === 'timing');
    expect(timingPatterns.length).toBe(0);
  });

  it('detects hand-specific issues when one hand is significantly weaker', () => {
    const profile = createWeakProfile();
    const patterns = detectWeakPatterns(profile);
    const handPatterns = patterns.filter((p) => p.type === 'hand');
    expect(handPatterns.length).toBe(1);
    expect(handPatterns[0].description).toContain('left');
  });

  it('returns at most 5 patterns', () => {
    // Create a profile with many weak notes
    const noteAccuracy: Record<number, number> = {};
    for (let i = 48; i <= 72; i++) {
      noteAccuracy[i] = 0.2 + Math.random() * 0.3; // all weak
    }
    const profile = createCleanProfile({
      noteAccuracy,
      weakNotes: Object.keys(noteAccuracy).map(Number),
      skills: { timingAccuracy: 0.3, pitchAccuracy: 0.4 },
    });
    const patterns = detectWeakPatterns(profile);
    expect(patterns.length).toBeLessThanOrEqual(5);
  });

  it('sorts patterns by severity (worst first)', () => {
    const profile = createWeakProfile();
    const patterns = detectWeakPatterns(profile);
    for (let i = 1; i < patterns.length; i++) {
      expect(patterns[i].severity).toBeLessThanOrEqual(patterns[i - 1].severity);
    }
  });
});

// ============================================================================
// generateDrillParams
// ============================================================================

describe('generateDrillParams', () => {
  it('generates params for note pattern (low difficulty, 8 notes)', () => {
    const pattern: WeakPattern = {
      type: 'note',
      description: 'Weak note: MIDI 62',
      severity: 0.5,
      targetMidi: [62],
    };
    const params = generateDrillParams(pattern);
    expect(params.difficulty).toBe(1);
    expect(params.noteCount).toBe(8);
    expect(params.weakNotes).toEqual([62]);
    expect(params.exerciseType).toBe('warmup');
  });

  it('generates params for transition pattern (difficulty 2, 12 notes)', () => {
    const pattern: WeakPattern = {
      type: 'transition',
      description: 'Weak transition: MIDI 60 to 62',
      severity: 0.6,
      targetMidi: [60, 62],
    };
    const params = generateDrillParams(pattern);
    expect(params.difficulty).toBe(2);
    expect(params.noteCount).toBe(12);
    expect(params.weakNotes).toEqual([60, 62]);
  });

  it('generates params for timing pattern (low note count, slower tempo)', () => {
    const pattern: WeakPattern = {
      type: 'timing',
      description: 'Timing accuracy is low',
      severity: 0.7,
      targetMidi: [60, 64],
    };
    const params = generateDrillParams(pattern);
    expect(params.difficulty).toBe(1);
    expect(params.noteCount).toBe(6);
    expect(params.tempoRange.max).toBeLessThanOrEqual(60);
  });

  it('generates params for hand pattern targeting weak hand range', () => {
    const pattern: WeakPattern = {
      type: 'hand',
      description: 'left hand is weaker',
      severity: 0.5,
      targetMidi: [48, 50, 52],
    };
    const params = generateDrillParams(pattern);
    expect(params.difficulty).toBe(1);
    expect(params.noteCount).toBe(8);
    expect(params.weakNotes).toEqual([48, 50, 52]);
    expect(params.skillContext).toContain('left');
  });

  it('targets right hand when MIDI notes are >= 60', () => {
    const pattern: WeakPattern = {
      type: 'hand',
      description: 'right hand is weaker',
      severity: 0.5,
      targetMidi: [64, 67, 72],
    };
    const params = generateDrillParams(pattern);
    expect(params.skillContext).toContain('right');
  });

  it('always returns valid GenerationParams structure', () => {
    const types: Array<WeakPattern['type']> = ['note', 'transition', 'timing', 'hand'];
    for (const type of types) {
      const params = generateDrillParams({
        type,
        description: 'test',
        severity: 0.5,
        targetMidi: [60],
      });
      expect(params.weakNotes).toBeDefined();
      expect(params.tempoRange).toBeDefined();
      expect(params.tempoRange.min).toBeLessThan(params.tempoRange.max);
      expect(params.difficulty).toBeGreaterThanOrEqual(1);
      expect(params.difficulty).toBeLessThanOrEqual(5);
      expect(params.noteCount).toBeGreaterThan(0);
      expect(params.skills).toBeDefined();
    }
  });
});
