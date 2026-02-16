/**
 * Content Loader Tests
 * Verifies exercise/lesson loading from JSON content files
 */

import {
  getExercise,
  getLessons,
  getLesson,
  getLessonExercises,
  getNextExerciseId,
  getLessonIdForExercise,
} from '../ContentLoader';
import { scoreExercise } from '../../core/exercises/ExerciseValidator';

describe('ContentLoader', () => {
  describe('getExercise', () => {
    it('should load lesson-01-ex-01 from JSON', () => {
      const exercise = getExercise('lesson-01-ex-01');
      expect(exercise).not.toBeNull();
      expect(exercise!.id).toBe('lesson-01-ex-01');
      expect(exercise!.metadata.title).toBe('Find Middle C');
    });

    it('should return null for non-existent exercise', () => {
      expect(getExercise('non-existent')).toBeNull();
    });

    it('should have valid scoring config', () => {
      const exercise = getExercise('lesson-01-ex-01');
      expect(exercise!.scoring.passingScore).toBe(60);
      expect(exercise!.scoring.starThresholds).toEqual([70, 85, 95]);
      expect(exercise!.scoring.timingToleranceMs).toBeGreaterThan(0);
    });

    it('should have at least one note', () => {
      const exercise = getExercise('lesson-01-ex-01');
      expect(exercise!.notes.length).toBeGreaterThan(0);
    });

    it('should have valid MIDI note numbers', () => {
      const exercise = getExercise('lesson-01-ex-01');
      for (const note of exercise!.notes) {
        expect(note.note).toBeGreaterThanOrEqual(21);
        expect(note.note).toBeLessThanOrEqual(108);
      }
    });
  });

  describe('getLessons', () => {
    it('should return all lessons in order', () => {
      const lessons = getLessons();
      expect(lessons.length).toBeGreaterThanOrEqual(6);
      expect(lessons[0].id).toBe('lesson-01');
      expect(lessons[1].id).toBe('lesson-02');
    });

    it('should have metadata for each lesson', () => {
      const lessons = getLessons();
      for (const lesson of lessons) {
        expect(lesson.metadata.title).toBeTruthy();
        expect(lesson.metadata.description).toBeTruthy();
        expect(lesson.metadata.difficulty).toBeGreaterThanOrEqual(1);
        expect(lesson.metadata.difficulty).toBeLessThanOrEqual(5);
      }
    });

    it('should have exercises for each lesson', () => {
      const lessons = getLessons();
      for (const lesson of lessons) {
        expect(lesson.exercises.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getLesson', () => {
    it('should load lesson-01', () => {
      const lesson = getLesson('lesson-01');
      expect(lesson).not.toBeNull();
      expect(lesson!.id).toBe('lesson-01');
      expect(lesson!.metadata.title).toBe('Getting Started');
    });

    it('should return null for non-existent lesson', () => {
      expect(getLesson('non-existent')).toBeNull();
    });

    it('should have xpReward', () => {
      const lesson = getLesson('lesson-01');
      expect(lesson!.xpReward).toBe(120);
    });
  });

  describe('getLessonExercises', () => {
    it('should return exercises for lesson-01 in order', () => {
      const exercises = getLessonExercises('lesson-01');
      expect(exercises.length).toBe(3);
      expect(exercises[0].id).toBe('lesson-01-ex-01');
      expect(exercises[1].id).toBe('lesson-01-ex-02');
      expect(exercises[2].id).toBe('lesson-01-ex-03');
    });

    it('should return empty array for non-existent lesson', () => {
      expect(getLessonExercises('non-existent')).toEqual([]);
    });

    it('should return actual Exercise objects', () => {
      const exercises = getLessonExercises('lesson-01');
      for (const ex of exercises) {
        expect(ex.id).toBeTruthy();
        expect(ex.notes).toBeDefined();
        expect(ex.scoring).toBeDefined();
      }
    });
  });

  describe('getNextExerciseId', () => {
    it('should return next exercise in lesson', () => {
      expect(getNextExerciseId('lesson-01', 'lesson-01-ex-01')).toBe('lesson-01-ex-02');
      expect(getNextExerciseId('lesson-01', 'lesson-01-ex-02')).toBe('lesson-01-ex-03');
    });

    it('should return null for last exercise', () => {
      expect(getNextExerciseId('lesson-01', 'lesson-01-ex-03')).toBeNull();
    });

    it('should return null for non-existent exercise', () => {
      expect(getNextExerciseId('lesson-01', 'non-existent')).toBeNull();
    });

    it('should return null for non-existent lesson', () => {
      expect(getNextExerciseId('non-existent', 'lesson-01-ex-01')).toBeNull();
    });
  });

  describe('getLessonIdForExercise', () => {
    it('should find lesson for exercise', () => {
      expect(getLessonIdForExercise('lesson-01-ex-01')).toBe('lesson-01');
      expect(getLessonIdForExercise('lesson-01-ex-03')).toBe('lesson-01');
      expect(getLessonIdForExercise('lesson-02-ex-01')).toBe('lesson-02');
    });

    it('should return null for non-existent exercise', () => {
      expect(getLessonIdForExercise('non-existent')).toBeNull();
    });
  });

  describe('Lesson 1 content integrity', () => {
    it('should have 3 regular exercises plus a mastery test', () => {
      const lesson = getLesson('lesson-01');
      const exercises = getLessonExercises('lesson-01');

      // Manifest includes test exercise; getLessonExercises filters it out
      expect(lesson!.exercises.length).toBe(4);
      expect(exercises.length).toBe(3);

      // Every manifest entry should resolve to an actual exercise
      for (const entry of lesson!.exercises) {
        const ex = getExercise(entry.id);
        expect(ex).not.toBeNull();
        expect(ex!.id).toBe(entry.id);
      }
    });

    it('should have lesson-01 as first lesson with no unlock requirement', () => {
      const lesson = getLesson('lesson-01');
      expect(lesson!.unlockRequirement).toBeNull();
    });

    it('should have lesson-02 requiring lesson-01 completion', () => {
      const lesson = getLesson('lesson-02');
      expect(lesson!.unlockRequirement).toEqual({
        type: 'lesson-complete',
        lessonId: 'lesson-01',
      });
    });
  });

  // ==========================================================================
  // Lessons 2-6 Content Integrity
  // ==========================================================================

  describe('Lesson 2-6 content integrity', () => {
    const lessonIds = ['lesson-02', 'lesson-03', 'lesson-04', 'lesson-05', 'lesson-06'];

    lessonIds.forEach((lessonId) => {
      describe(lessonId, () => {
        it('should load lesson manifest', () => {
          const lesson = getLesson(lessonId);
          expect(lesson).not.toBeNull();
          expect(lesson!.id).toBe(lessonId);
          expect(lesson!.metadata.title).toBeTruthy();
        });

        it('should have valid exercises that load', () => {
          const lesson = getLesson(lessonId);
          expect(lesson).not.toBeNull();
          const exercises = getLessonExercises(lessonId);
          // getLessonExercises filters out test exercises
          const nonTestEntries = lesson!.exercises.filter((e: { test?: boolean }) => !e.test);
          expect(exercises.length).toBe(nonTestEntries.length);

          exercises.forEach((ex) => {
            expect(ex.id).toBeTruthy();
            expect(ex.notes.length).toBeGreaterThan(0);
            expect(ex.settings.tempo).toBeGreaterThan(0);
            expect(ex.scoring.passingScore).toBeGreaterThanOrEqual(0);
            expect(ex.scoring.passingScore).toBeLessThanOrEqual(100);
          });
        });

        it('should have valid MIDI ranges', () => {
          const exercises = getLessonExercises(lessonId);
          exercises.forEach((ex) => {
            ex.notes.forEach((note) => {
              expect(note.note).toBeGreaterThanOrEqual(21);
              expect(note.note).toBeLessThanOrEqual(108);
              expect(note.startBeat).toBeGreaterThanOrEqual(0);
              expect(note.durationBeats).toBeGreaterThan(0);
            });
          });
        });

        it('should have ascending star thresholds', () => {
          const exercises = getLessonExercises(lessonId);
          exercises.forEach((ex) => {
            const [one, two, three] = ex.scoring.starThresholds;
            expect(one).toBeLessThan(two);
            expect(two).toBeLessThan(three);
            expect(ex.scoring.passingScore).toBeLessThanOrEqual(one);
          });
        });

        it('should have valid unlock requirements', () => {
          const lesson = getLesson(lessonId);
          if (lesson!.unlockRequirement) {
            const reqLesson = getLesson(lesson!.unlockRequirement.lessonId);
            expect(reqLesson).not.toBeNull();
          }
        });

        it('should support next exercise navigation', () => {
          const exercises = getLessonExercises(lessonId);
          for (let i = 0; i < exercises.length - 1; i++) {
            const nextId = getNextExerciseId(lessonId, exercises[i].id);
            expect(nextId).toBe(exercises[i + 1].id);
          }
          // Last exercise returns null
          const lastId = getNextExerciseId(lessonId, exercises[exercises.length - 1].id);
          expect(lastId).toBeNull();
        });
      });
    });
  });

  // ==========================================================================
  // Scoring Pipeline for All Lessons
  // ==========================================================================

  describe('Scoring pipeline for all lessons', () => {
    const lessonIds = ['lesson-01', 'lesson-02', 'lesson-03', 'lesson-04', 'lesson-05', 'lesson-06'];

    lessonIds.forEach((lessonId) => {
      it(`${lessonId}: perfect play should score high`, () => {
        const exercises = getLessonExercises(lessonId);
        exercises.forEach((ex) => {
          // Simulate perfect play: each note played at exact expected time
          const msPerBeat = 60000 / ex.settings.tempo;
          const perfectNotes = ex.notes.map((note) => ({
            type: 'noteOn' as const,
            note: note.note,
            velocity: 64,
            timestamp: note.startBeat * msPerBeat,
            channel: 0,
          }));
          const score = scoreExercise(ex, perfectNotes);
          expect(score.overall).toBeGreaterThanOrEqual(90);
          expect(score.isPassed).toBe(true);
          expect(score.stars).toBeGreaterThanOrEqual(2);
        });
      });

      it(`${lessonId}: no notes played should score low`, () => {
        const exercises = getLessonExercises(lessonId);
        exercises.forEach((ex) => {
          const score = scoreExercise(ex, []);
          expect(score.overall).toBeLessThanOrEqual(10);
          expect(score.isPassed).toBe(false);
        });
      });
    });
  });
});
