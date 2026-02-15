/**
 * Exercise Store Tests
 * Tests state management, persistence, and all actions
 */

import { useExerciseStore } from '../exerciseStore';
import { PersistenceManager, STORAGE_KEYS } from '../persistence';
import type { Exercise, MidiNoteEvent } from '@/core/exercises/types';

describe('Exercise Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useExerciseStore.setState({
      currentExercise: null,
      currentExerciseId: null,
      playedNotes: [],
      isPlaying: false,
      currentBeat: 0,
      score: null,
      sessionStartTime: null,
      sessionEndTime: null,
    });
    PersistenceManager.deleteState(STORAGE_KEYS.EXERCISE);
  });

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      const state = useExerciseStore.getState();
      expect(state.currentExercise).toBeNull();
      expect(state.currentExerciseId).toBeNull();
      expect(state.playedNotes).toEqual([]);
      expect(state.isPlaying).toBe(false);
      expect(state.currentBeat).toBe(0);
      expect(state.score).toBeNull();
    });
  });

  describe('setCurrentExercise', () => {
    it('should set exercise and reset session', () => {
      const mockExercise: Exercise = {
        id: 'test-ex-1',
        version: 1,
        metadata: {
          title: 'Test',
          description: 'Test exercise',
          difficulty: 1,
          estimatedMinutes: 5,
          skills: [],
          prerequisites: [],
        },
        settings: {
          tempo: 120,
          timeSignature: [4, 4],
          keySignature: 'C',
          countIn: 4,
          metronomeEnabled: true,
        },
        notes: [],
        scoring: {
          timingToleranceMs: 100,
          timingGracePeriodMs: 200,
          passingScore: 70,
          starThresholds: [80, 90, 95],
        },
        hints: {
          beforeStart: 'Get ready',
          commonMistakes: [],
          successMessage: 'Great job!',
        },
      };

      useExerciseStore.getState().setCurrentExercise(mockExercise);

      const state = useExerciseStore.getState();
      expect(state.currentExercise).toEqual(mockExercise);
      expect(state.currentExerciseId).toBe('test-ex-1');
      expect(state.playedNotes).toEqual([]);
      expect(state.score).toBeNull();
      expect(state.sessionStartTime).not.toBeNull();
    });

    it('should replace previous exercise', () => {
      const ex1: Exercise = {
        id: 'ex-1',
        version: 1,
        metadata: {
          title: 'Ex 1',
          description: '',
          difficulty: 1,
          estimatedMinutes: 5,
          skills: [],
          prerequisites: [],
        },
        settings: {
          tempo: 120,
          timeSignature: [4, 4],
          keySignature: 'C',
          countIn: 4,
          metronomeEnabled: true,
        },
        notes: [],
        scoring: {
          timingToleranceMs: 100,
          timingGracePeriodMs: 200,
          passingScore: 70,
          starThresholds: [80, 90, 95],
        },
        hints: {
          beforeStart: '',
          commonMistakes: [],
          successMessage: '',
        },
      };

      const ex2 = { ...ex1, id: 'ex-2' };

      useExerciseStore.getState().setCurrentExercise(ex1);
      useExerciseStore.getState().setCurrentExercise(ex2);

      expect(useExerciseStore.getState().currentExerciseId).toBe('ex-2');
    });
  });

  describe('addPlayedNote', () => {
    it('should add note to playedNotes array', () => {
      const note: MidiNoteEvent = {
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: 1000,
        channel: 0,
      };

      useExerciseStore.getState().addPlayedNote(note);

      const state = useExerciseStore.getState();
      expect(state.playedNotes).toHaveLength(1);
      expect(state.playedNotes[0]).toEqual(note);
    });

    it('should maintain order of notes', () => {
      const note1: MidiNoteEvent = { type: 'noteOn', note: 60, velocity: 100, timestamp: 1000, channel: 0 };
      const note2: MidiNoteEvent = { type: 'noteOn', note: 62, velocity: 100, timestamp: 1050, channel: 0 };

      useExerciseStore.getState().addPlayedNote(note1);
      useExerciseStore.getState().addPlayedNote(note2);

      const notes = useExerciseStore.getState().playedNotes;
      expect(notes[0].note).toBe(60);
      expect(notes[1].note).toBe(62);
    });
  });

  describe('setIsPlaying', () => {
    it('should toggle playing state', () => {
      expect(useExerciseStore.getState().isPlaying).toBe(false);

      useExerciseStore.getState().setIsPlaying(true);
      expect(useExerciseStore.getState().isPlaying).toBe(true);

      useExerciseStore.getState().setIsPlaying(false);
      expect(useExerciseStore.getState().isPlaying).toBe(false);
    });
  });

  describe('setCurrentBeat', () => {
    it('should update current beat', () => {
      useExerciseStore.getState().setCurrentBeat(5.5);
      expect(useExerciseStore.getState().currentBeat).toBe(5.5);
    });

    it('should handle fractional beats', () => {
      useExerciseStore.getState().setCurrentBeat(2.25);
      expect(useExerciseStore.getState().currentBeat).toBe(2.25);
    });
  });

  describe('setScore', () => {
    it('should set exercise score and end time', () => {
      const score = {
        overall: 85,
        stars: 2 as const,
        breakdown: {
          accuracy: 90,
          timing: 85,
          completeness: 95,
          extraNotes: 80,
          duration: 70,
        },
        details: [],
        perfectNotes: 5,
        goodNotes: 3,
        okNotes: 1,
        missedNotes: 0,
        extraNotes: 0,
        xpEarned: 50,
        isNewHighScore: true,
        isPassed: true,
      };

      const startTime = Date.now();
      useExerciseStore.setState({ sessionStartTime: startTime });
      useExerciseStore.getState().setScore(score);

      const state = useExerciseStore.getState();
      expect(state.score).toEqual(score);
      expect(state.sessionEndTime).not.toBeNull();
      expect(state.sessionEndTime! >= startTime).toBe(true);
    });
  });

  describe('clearSession', () => {
    it('should clear notes and score', () => {
      const note: MidiNoteEvent = { type: 'noteOn', note: 60, velocity: 100, timestamp: 1000, channel: 0 };
      useExerciseStore.getState().addPlayedNote(note);
      useExerciseStore.setState({
        score: {
          overall: 85,
          stars: 2 as const,
          breakdown: {
            accuracy: 90,
            timing: 85,
            completeness: 95,
            extraNotes: 80,
            duration: 70,
          },
          details: [],
          perfectNotes: 5,
          goodNotes: 3,
          okNotes: 1,
          missedNotes: 0,
          extraNotes: 0,
          xpEarned: 50,
          isNewHighScore: true,
          isPassed: true,
        },
      });

      useExerciseStore.getState().clearSession();

      const state = useExerciseStore.getState();
      expect(state.playedNotes).toEqual([]);
      expect(state.score).toBeNull();
      expect(state.currentBeat).toBe(0);
    });

    it('should preserve current exercise', () => {
      const mockExercise: Exercise = {
        id: 'test-ex',
        version: 1,
        metadata: {
          title: 'Test',
          description: '',
          difficulty: 1,
          estimatedMinutes: 5,
          skills: [],
          prerequisites: [],
        },
        settings: {
          tempo: 120,
          timeSignature: [4, 4],
          keySignature: 'C',
          countIn: 4,
          metronomeEnabled: true,
        },
        notes: [],
        scoring: {
          timingToleranceMs: 100,
          timingGracePeriodMs: 200,
          passingScore: 70,
          starThresholds: [80, 90, 95],
        },
        hints: {
          beforeStart: '',
          commonMistakes: [],
          successMessage: '',
        },
      };

      useExerciseStore.getState().setCurrentExercise(mockExercise);
      useExerciseStore.getState().clearSession();

      expect(useExerciseStore.getState().currentExercise).toEqual(mockExercise);
    });
  });

  describe('reset', () => {
    it('should reset to initial state and clear storage', () => {
      const mockExercise: Exercise = {
        id: 'test',
        version: 1,
        metadata: {
          title: 'Test',
          description: '',
          difficulty: 1,
          estimatedMinutes: 5,
          skills: [],
          prerequisites: [],
        },
        settings: {
          tempo: 120,
          timeSignature: [4, 4],
          keySignature: 'C',
          countIn: 4,
          metronomeEnabled: true,
        },
        notes: [],
        scoring: {
          timingToleranceMs: 100,
          timingGracePeriodMs: 200,
          passingScore: 70,
          starThresholds: [80, 90, 95],
        },
        hints: {
          beforeStart: '',
          commonMistakes: [],
          successMessage: '',
        },
      };

      useExerciseStore.getState().setCurrentExercise(mockExercise);
      const note: MidiNoteEvent = { type: 'noteOn', note: 60, velocity: 100, timestamp: 1000, channel: 0 };
      useExerciseStore.getState().addPlayedNote(note);

      useExerciseStore.getState().reset();

      const state = useExerciseStore.getState();
      expect(state.currentExercise).toBeNull();
      expect(state.currentExerciseId).toBeNull();
      expect(state.playedNotes).toEqual([]);
      expect(state.isPlaying).toBe(false);
      expect(state.currentBeat).toBe(0);
      expect(state.score).toBeNull();
    });
  });

  describe('setSessionTime', () => {
    it('should set session start and end times', () => {
      const startTime = 1000;
      const endTime = 2000;

      useExerciseStore.getState().setSessionTime(startTime, endTime);

      const state = useExerciseStore.getState();
      expect(state.sessionStartTime).toBe(startTime);
      expect(state.sessionEndTime).toBe(endTime);
    });

    it('should handle end time as optional', () => {
      const startTime = 1000;
      useExerciseStore.getState().setSessionTime(startTime);

      const state = useExerciseStore.getState();
      expect(state.sessionStartTime).toBe(startTime);
      expect(state.sessionEndTime).toBeNull();
    });
  });
});
