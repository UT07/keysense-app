/**
 * Integration Tests
 * Tests store interactions and multi-store workflows
 */

import { useExerciseStore } from '../exerciseStore';
import { useProgressStore } from '../progressStore';
import { useSettingsStore } from '../settingsStore';
import { PersistenceManager } from '../persistence';
import type { Exercise, MidiNoteEvent } from '@/core/exercises/types';

describe('Store Integration', () => {
  beforeEach(() => {
    // Reset all stores
    useExerciseStore.getState().reset();
    useProgressStore.getState().reset();
    useSettingsStore.getState().reset();
    PersistenceManager.clearAll();
  });

  describe('Exercise to Progress Flow', () => {
    it('should complete exercise and update progress', () => {
      const exercise: Exercise = {
        id: 'lesson-1-ex-1',
        version: 1,
        metadata: {
          title: 'C Major Scale',
          description: 'Learn the C major scale',
          difficulty: 1,
          estimatedMinutes: 5,
          skills: ['scales', 'c-major'],
          prerequisites: [],
        },
        settings: {
          tempo: 120,
          timeSignature: [4, 4],
          keySignature: 'C',
          countIn: 4,
          metronomeEnabled: true,
        },
        notes: [
          { note: 60, startBeat: 0, durationBeats: 1 },
          { note: 62, startBeat: 1, durationBeats: 1 },
          { note: 64, startBeat: 2, durationBeats: 1 },
          { note: 65, startBeat: 3, durationBeats: 1 },
        ],
        scoring: {
          timingToleranceMs: 100,
          timingGracePeriodMs: 200,
          passingScore: 70,
          starThresholds: [80, 90, 95],
        },
        hints: {
          beforeStart: 'Position your hands on the keyboard',
          commonMistakes: [],
          successMessage: 'Great job!',
        },
      };

      // Load exercise
      useExerciseStore.getState().setCurrentExercise(exercise);
      expect(useExerciseStore.getState().currentExercise?.id).toBe('lesson-1-ex-1');

      // Record user input
      const playedNotes: MidiNoteEvent[] = [
        { type: 'noteOn', note: 60, velocity: 100, timestamp: 1000, channel: 0 },
        { type: 'noteOff', note: 60, velocity: 0, timestamp: 1500, channel: 0 },
        { type: 'noteOn', note: 62, velocity: 105, timestamp: 1600, channel: 0 },
        { type: 'noteOff', note: 62, velocity: 0, timestamp: 2100, channel: 0 },
      ];

      playedNotes.forEach((note) => {
        useExerciseStore.getState().addPlayedNote(note);
      });

      expect(useExerciseStore.getState().playedNotes).toHaveLength(4);

      // Record score
      const score = {
        overall: 85,
        stars: 2 as const,
        breakdown: {
          accuracy: 90,
          timing: 85,
          completeness: 95,
          extraNotes: 80,
        },
        details: [],
        perfectNotes: 3,
        goodNotes: 1,
        okNotes: 0,
        missedNotes: 0,
        extraNotes: 0,
        xpEarned: 50,
        isNewHighScore: true,
        isPassed: true,
      };

      useExerciseStore.getState().setScore(score);
      expect(useExerciseStore.getState().score).toEqual(score);

      // Update progress
      const initialXp = useProgressStore.getState().totalXp;
      useProgressStore.getState().recordExerciseCompletion('lesson-1-ex-1', score.overall, score.xpEarned);

      expect(useProgressStore.getState().totalXp).toBe(initialXp + 50);
    });

    it('should track daily goal completion', () => {
      const today = new Date().toISOString().split('T')[0];

      // Set up daily goal
      useProgressStore.getState().updateDailyGoal(today, {
        minutesTarget: 15,
        exercisesTarget: 2,
      });

      // Record practice
      useProgressStore.getState().recordPracticeSession(10);
      useProgressStore.getState().recordPracticeSession(5);

      // Record exercises
      useProgressStore.getState().recordExerciseCompletion('ex-1', 85, 30);
      useProgressStore.getState().recordExerciseCompletion('ex-2', 90, 40);

      // Check completion
      const dailyGoal = useProgressStore.getState().dailyGoalData[today];
      expect(dailyGoal.minutesPracticed).toBe(15);
      expect(dailyGoal.exercisesCompleted).toBe(2);
      expect(dailyGoal.isComplete).toBe(true);
    });
  });

  describe('Multi-Store State', () => {
    it('should maintain separate store states', () => {
      // Set exercise state
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
      useExerciseStore.getState().setIsPlaying(true);

      // Set progress state
      useProgressStore.getState().addXp(100);
      useProgressStore.getState().setLevel(5);

      // Set settings state
      useSettingsStore.getState().setMasterVolume(0.6);
      useSettingsStore.getState().setDarkMode(true);

      // Verify independence
      const exerciseState = useExerciseStore.getState();
      const progressState = useProgressStore.getState();
      const settingsState = useSettingsStore.getState();

      expect(exerciseState.isPlaying).toBe(true);
      expect(progressState.level).toBe(5);
      expect(settingsState.darkMode).toBe(true);

      // Reset one store
      useProgressStore.getState().reset();

      // Others unaffected
      expect(useExerciseStore.getState().isPlaying).toBe(true);
      expect(useSettingsStore.getState().darkMode).toBe(true);
      expect(useProgressStore.getState().level).toBe(1);
    });

    it('should coordinate lesson and exercise progress', () => {
      const lessonId = 'lesson-1';
      const exerciseId = 'ex-1';

      // Create lesson progress
      useProgressStore.getState().updateLessonProgress(lessonId, {
        lessonId,
        status: 'in_progress',
        exerciseScores: {},
        bestScore: 0,
        totalAttempts: 0,
        totalTimeSpentSeconds: 0,
      });

      // Add exercise to lesson
      useProgressStore.getState().updateExerciseProgress(lessonId, exerciseId, {
        exerciseId,
        highScore: 85,
        stars: 2,
        attempts: 1,
        lastAttemptAt: Date.now(),
        averageScore: 85,
        completedAt: Date.now(),
      });

      // Verify hierarchy
      const lesson = useProgressStore.getState().getLessonProgress(lessonId);
      expect(lesson?.exerciseScores[exerciseId]).toBeDefined();
      expect(lesson?.exerciseScores[exerciseId].highScore).toBe(85);

      // Retrieve exercise directly
      const exercise = useProgressStore.getState().getExerciseProgress(lessonId, exerciseId);
      expect(exercise?.highScore).toBe(85);
    });
  });

  describe('Settings Influence on Behavior', () => {
    it('should respect audio settings during playback', () => {
      const { masterVolume, soundEnabled } = useSettingsStore.getState();

      // In real implementation, audio engine would check these
      expect(masterVolume).toBe(0.8);
      expect(soundEnabled).toBe(true);

      // User disables sound
      useSettingsStore.getState().setSoundEnabled(false);
      expect(useSettingsStore.getState().soundEnabled).toBe(false);

      // Audio engine would skip playback
      // (Not tested here - that's audio engine's responsibility)
    });

    it('should apply display settings to exercise view', () => {
      const displaySettings = useSettingsStore.getState();

      // Verify display preferences
      expect(displaySettings.showFingerNumbers).toBe(true);
      expect(displaySettings.showNoteNames).toBe(true);

      // User changes preferences
      useSettingsStore.getState().updateDisplaySettings({
        showFingerNumbers: false,
        showNoteNames: false,
        preferredHand: 'left',
      });

      // Exercise rendering should adapt to these preferences
      const updated = useSettingsStore.getState();
      expect(updated.showFingerNumbers).toBe(false);
      expect(updated.showNoteNames).toBe(false);
      expect(updated.preferredHand).toBe('left');
    });
  });

  describe('Cross-Store Workflows', () => {
    it('should handle practice session with interruptions', () => {
      const exercise: Exercise = {
        id: 'session-test',
        version: 1,
        metadata: {
          title: 'Session Test',
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
        notes: Array.from({ length: 10 }, (_, i) => ({
          note: 60 + i,
          startBeat: i,
          durationBeats: 1,
        })),
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

      // Start exercise
      const startTime = Date.now();
      useExerciseStore.getState().setCurrentExercise(exercise);
      useExerciseStore.getState().setIsPlaying(true);

      // Play some notes
      for (let i = 0; i < 5; i++) {
        useExerciseStore.getState().addPlayedNote({
          type: 'noteOn',
          note: 60 + i,
          velocity: 100,
          timestamp: startTime + i * 1000,
          channel: 0,
        });
      }

      // User pauses
      useExerciseStore.getState().setIsPlaying(false);
      expect(useExerciseStore.getState().isPlaying).toBe(false);

      // User resumes
      useExerciseStore.getState().setIsPlaying(true);
      expect(useExerciseStore.getState().isPlaying).toBe(true);

      // Continue playing
      for (let i = 5; i < 10; i++) {
        useExerciseStore.getState().addPlayedNote({
          type: 'noteOn',
          note: 60 + i,
          velocity: 100,
          timestamp: startTime + i * 1000,
          channel: 0,
        });
      }

      // Complete exercise
      const score = {
        overall: 90,
        stars: 3 as const,
        breakdown: {
          accuracy: 95,
          timing: 90,
          completeness: 100,
          extraNotes: 85,
        },
        details: [],
        perfectNotes: 8,
        goodNotes: 2,
        okNotes: 0,
        missedNotes: 0,
        extraNotes: 0,
        xpEarned: 75,
        isNewHighScore: true,
        isPassed: true,
      };

      const endTime = Date.now();
      useExerciseStore.getState().setScore(score);

      // Verify final states
      expect(useExerciseStore.getState().playedNotes).toHaveLength(10);
      expect(useExerciseStore.getState().score?.overall).toBe(90);
      expect(useExerciseStore.getState().sessionStartTime).toBeLessThanOrEqual(startTime + 100);
      expect(useExerciseStore.getState().sessionEndTime).toBeLessThanOrEqual(endTime + 100);

      // Record completion
      useProgressStore.getState().recordExerciseCompletion('session-test', score.overall, score.xpEarned);

      // Verify progress update
      expect(useProgressStore.getState().totalXp).toBe(75);
    });
  });
});
