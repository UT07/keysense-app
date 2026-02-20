/**
 * Integration Test: Free Play Analysis Flow
 *
 * Tests the free play analysis pipeline:
 * - analyzeSession: detects key, counts notes, analyzes intervals
 * - suggestDrill: converts analysis into valid GenerationParams for AI exercises
 */

import {
  analyzeSession,
  suggestDrill,
  type PlayedNote,
} from '../../services/FreePlayAnalyzer';

// Mock geminiExerciseService to provide the GenerationParams type without real imports
jest.mock('../../services/geminiExerciseService', () => ({}));

// Helper to create a PlayedNote at a given MIDI pitch
function note(midi: number, timestamp: number, velocity = 80): PlayedNote {
  return { note: midi, timestamp, velocity };
}

describe('Free Play Analysis Flow', () => {
  describe('analyzes C major scale playback', () => {
    it('should detect C major key from ascending C major scale', () => {
      // C-D-E-F-G-A-B-C (MIDI 60-72)
      const cMajorScale: PlayedNote[] = [
        note(60, 1000), // C4
        note(62, 1500), // D4
        note(64, 2000), // E4
        note(65, 2500), // F4
        note(67, 3000), // G4
        note(69, 3500), // A4
        note(71, 4000), // B4
        note(72, 4500), // C5
      ];

      const analysis = analyzeSession(cMajorScale);

      expect(analysis.detectedKey).toBe('C major');
      expect(analysis.notesPlayed).toBe(8);
      expect(analysis.noteCount).toBe(8);
      expect(analysis.uniqueNotes.length).toBe(8);
      expect(analysis.uniquePitches).toBe(8);
      expect(analysis.mostPlayedNote).not.toBeNull();
      expect(analysis.durationSeconds).toBeGreaterThan(0);
      expect(analysis.summary).toBeTruthy();
    });

    it('should detect correct note count and unique pitches', () => {
      // Play C-E-G-C-E-G (repeated chord tones)
      const notes: PlayedNote[] = [
        note(60, 1000),
        note(64, 1500),
        note(67, 2000),
        note(60, 2500),
        note(64, 3000),
        note(67, 3500),
      ];

      const analysis = analyzeSession(notes);

      expect(analysis.notesPlayed).toBe(6);
      expect(analysis.noteCount).toBe(6);
      expect(analysis.uniqueNotes.length).toBe(3);
      expect(analysis.uniquePitches).toBe(3);
    });

    it('should handle empty note array', () => {
      const analysis = analyzeSession([]);

      expect(analysis.notesPlayed).toBe(0);
      expect(analysis.noteCount).toBe(0);
      expect(analysis.uniqueNotes).toEqual([]);
      expect(analysis.uniquePitches).toBe(0);
      expect(analysis.detectedKey).toBeNull();
      expect(analysis.mostPlayedNote).toBeNull();
      expect(analysis.summary).toContain('No notes');
    });

    it('should handle very few notes gracefully', () => {
      const notes: PlayedNote[] = [
        note(60, 1000),
        note(62, 1500),
      ];

      const analysis = analyzeSession(notes);

      expect(analysis.notesPlayed).toBe(2);
      // Too few notes for key detection (< 3)
      expect(analysis.detectedKey).toBeNull();
    });

    it('should identify the most played note', () => {
      const notes: PlayedNote[] = [
        note(60, 1000),
        note(60, 1500),
        note(60, 2000),
        note(64, 2500),
        note(67, 3000),
      ];

      const analysis = analyzeSession(notes);
      expect(analysis.mostPlayedNote).toBe('C4');
    });

    it('should calculate notes per second correctly', () => {
      // 4 notes over 2 seconds
      const notes: PlayedNote[] = [
        note(60, 1000),
        note(62, 1500),
        note(64, 2000),
        note(65, 3000),
      ];

      const analysis = analyzeSession(notes);
      expect(analysis.durationSeconds).toBe(2);
      expect(analysis.notesPerSecond).toBe(2);
    });

    it('should analyze intervals between consecutive notes', () => {
      // Stepwise ascending: all intervals are 2 semitones (major seconds)
      const notes: PlayedNote[] = [
        note(60, 1000), // C4
        note(62, 1500), // D4 (interval: 2)
        note(64, 2000), // E4 (interval: 2)
        note(65, 2500), // F4 (interval: 1)
        note(67, 3000), // G4 (interval: 2)
      ];

      const analysis = analyzeSession(notes);
      expect(analysis.commonIntervals.length).toBeGreaterThan(0);

      // Most common interval should be 2 (major second)
      const majorSecondEntry = analysis.commonIntervals.find((i) => i.interval === 2);
      expect(majorSecondEntry).toBeDefined();
      expect(majorSecondEntry!.count).toBe(3);
    });

    it('should suggest scale-practice for stepwise motion', () => {
      const notes: PlayedNote[] = [
        note(60, 1000),
        note(62, 1500),
        note(64, 2000),
        note(65, 2500),
        note(67, 3000),
        note(69, 3500),
        note(71, 4000),
        note(72, 4500),
      ];

      const analysis = analyzeSession(notes);
      expect(analysis.suggestedDrillType).toBe('scale-practice');
    });
  });

  describe('suggests drill from analysis', () => {
    it('should return valid GenerationParams for C major scale', () => {
      const cMajorScale: PlayedNote[] = [
        note(60, 1000),
        note(62, 1500),
        note(64, 2000),
        note(65, 2500),
        note(67, 3000),
        note(69, 3500),
        note(71, 4000),
        note(72, 4500),
      ];

      const analysis = analyzeSession(cMajorScale);
      const drill = suggestDrill(analysis);

      expect(drill).toBeDefined();
      expect(drill.weakNotes.length).toBeGreaterThan(0);
      expect(drill.weakNotes.length).toBeLessThanOrEqual(6);
      expect(drill.tempoRange.min).toBeGreaterThanOrEqual(40);
      expect(drill.tempoRange.max).toBeGreaterThan(drill.tempoRange.min);
      expect(drill.difficulty).toBeGreaterThanOrEqual(1);
      expect(drill.difficulty).toBeLessThanOrEqual(5);
      expect(drill.noteCount).toBeGreaterThan(0);
      expect(drill.skillContext).toBeTruthy();
    });

    it('should include valid skills object in drill params', () => {
      const notes: PlayedNote[] = [
        note(60, 1000),
        note(64, 1500),
        note(67, 2000),
        note(72, 2500),
      ];

      const analysis = analyzeSession(notes);
      const drill = suggestDrill(analysis);

      expect(drill.skills).toBeDefined();
      expect(drill.skills.timingAccuracy).toBeGreaterThanOrEqual(0);
      expect(drill.skills.timingAccuracy).toBeLessThanOrEqual(1);
      expect(drill.skills.pitchAccuracy).toBeGreaterThanOrEqual(0);
      expect(drill.skills.pitchAccuracy).toBeLessThanOrEqual(1);
      expect(drill.skills.sightReadSpeed).toBeGreaterThanOrEqual(0);
      expect(drill.skills.chordRecognition).toBeGreaterThanOrEqual(0);
    });

    it('should include key context for scale practice drill', () => {
      const cMajorScale: PlayedNote[] = [
        note(60, 1000),
        note(62, 1500),
        note(64, 2000),
        note(65, 2500),
        note(67, 3000),
        note(69, 3500),
        note(71, 4000),
        note(72, 4500),
      ];

      const analysis = analyzeSession(cMajorScale);
      const drill = suggestDrill(analysis);

      // Should mention C major in the skill context since it's scale practice
      expect(drill.skillContext).toContain('C major');
    });

    it('should have valid MIDI note range in weakNotes', () => {
      const notes: PlayedNote[] = [
        note(48, 1000), // C3
        note(55, 1500), // G3
        note(60, 2000), // C4
        note(64, 2500), // E4
        note(67, 3000), // G4
      ];

      const analysis = analyzeSession(notes);
      const drill = suggestDrill(analysis);

      for (const midiNote of drill.weakNotes) {
        expect(midiNote).toBeGreaterThanOrEqual(21); // A0
        expect(midiNote).toBeLessThanOrEqual(108);   // C8
      }
    });

    it('should populate uniqueNotes as weakNotes in drill params', () => {
      const notes: PlayedNote[] = [
        note(60, 1000),
        note(64, 1500),
        note(67, 2000),
        note(72, 2500),
      ];

      const analysis = analyzeSession(notes);
      const drill = suggestDrill(analysis);

      // weakNotes should come from the analysis uniqueNotes
      for (const wn of drill.weakNotes) {
        expect(analysis.uniqueNotes).toContain(wn);
      }
    });

    it('should set exerciseType to lesson', () => {
      const notes: PlayedNote[] = [
        note(60, 1000),
        note(62, 1500),
        note(64, 2000),
        note(65, 2500),
      ];

      const analysis = analyzeSession(notes);
      const drill = suggestDrill(analysis);
      expect(drill.exerciseType).toBe('lesson');
    });

    it('should handle analysis of chord-like patterns', () => {
      // Playing lots of thirds and fifths with >3 unique notes → chord-practice drill
      const notes: PlayedNote[] = [
        note(60, 1000), // C
        note(64, 1500), // E (interval 4 = major third)
        note(67, 2000), // G (interval 3 = minor third)
        note(72, 2500), // C5 (interval 5 = fourth-ish, but adds unique note)
        note(60, 3000), // C (interval 12 = octave)
        note(64, 3500), // E (interval 4)
        note(67, 4000), // G (interval 3)
        note(72, 4500), // C5 (interval 5)
        note(60, 5000), // C (interval 12)
        note(64, 5500), // E (interval 4)
        note(67, 6000), // G (interval 3)
        note(72, 6500), // C5 (interval 5)
      ];

      const analysis = analyzeSession(notes);
      const drill = suggestDrill(analysis);

      // With 4 unique notes and many thirds/fourths, should suggest chord-practice
      expect(analysis.suggestedDrillType).toBe('chord-practice');
      expect(drill.skillContext).toContain('chord');
    });
  });
});
