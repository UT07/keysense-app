/**
 * Learner Profile Store
 *
 * Tracks per-note accuracy, skill dimensions, tempo comfort zone, and weak areas.
 * Updated after every exercise to build a profile for adaptive learning.
 *
 * All state is automatically persisted to AsyncStorage via PersistenceManager.
 */

import { create } from 'zustand';
import type { ExerciseResult, Skills, LearnerProfileState } from './types';
import { PersistenceManager, STORAGE_KEYS, createDebouncedSave } from './persistence';

const WEAK_NOTE_THRESHOLD = 0.7;
const WEAK_SKILL_THRESHOLD = 0.6;
const ROLLING_WINDOW = 20;

const INITIAL_SKILLS: Skills = {
  timingAccuracy: 0.5,
  pitchAccuracy: 0.5,
  sightReadSpeed: 0.5,
  chordRecognition: 0.5,
};

/** Data-only shape of learner profile state (excludes actions) */
export type LearnerProfileData = Pick<
  LearnerProfileState,
  | 'noteAccuracy'
  | 'noteAttempts'
  | 'skills'
  | 'tempoRange'
  | 'weakNotes'
  | 'weakSkills'
  | 'totalExercisesCompleted'
  | 'lastAssessmentDate'
  | 'assessmentScore'
  | 'masteredSkills'
>;

const defaultData: LearnerProfileData = {
  noteAccuracy: {},
  noteAttempts: {},
  skills: { ...INITIAL_SKILLS },
  tempoRange: { min: 40, max: 80 },
  weakNotes: [],
  weakSkills: [],
  totalExercisesCompleted: 0,
  lastAssessmentDate: '',
  assessmentScore: 0,
  masteredSkills: [],
};

// Create debounced save function
const debouncedSave = createDebouncedSave(STORAGE_KEYS.LEARNER_PROFILE, 1000);

export const useLearnerProfileStore = create<LearnerProfileState>((set, get) => ({
  ...defaultData,

  updateNoteAccuracy: (midiNote: number, accuracy: number) => {
    const { noteAccuracy, noteAttempts } = get();
    const prevAccuracy = noteAccuracy[midiNote] ?? accuracy;
    const attempts = (noteAttempts[midiNote] ?? 0) + 1;
    const weight = Math.min(attempts, ROLLING_WINDOW);
    const newAccuracy = prevAccuracy + (accuracy - prevAccuracy) / weight;

    set({
      noteAccuracy: { ...noteAccuracy, [midiNote]: newAccuracy },
      noteAttempts: { ...noteAttempts, [midiNote]: attempts },
    });
    debouncedSave(get());
  },

  updateSkill: (skill: keyof Skills, value: number) => {
    const { skills } = get();
    set({ skills: { ...skills, [skill]: Math.max(0, Math.min(1, value)) } });
    debouncedSave(get());
  },

  recalculateWeakAreas: () => {
    const { noteAccuracy, skills } = get();

    const weakNotes = Object.entries(noteAccuracy)
      .filter(([, acc]) => acc < WEAK_NOTE_THRESHOLD)
      .map(([note]) => Number(note))
      .sort((a, b) => (noteAccuracy[a] ?? 0) - (noteAccuracy[b] ?? 0));

    const weakSkills = (Object.entries(skills) as [keyof Skills, number][])
      .filter(([, val]) => val < WEAK_SKILL_THRESHOLD)
      .map(([skill]) => skill);

    set({ weakNotes, weakSkills });
    debouncedSave(get());
  },

  recordExerciseResult: (result: ExerciseResult) => {
    const state = get();

    // 1. Update note accuracy for each note result
    for (const nr of result.noteResults) {
      state.updateNoteAccuracy(nr.midiNote, nr.accuracy);
    }

    // 2. Adjust tempo range based on performance
    const { tempoRange } = get();
    let newMax = tempoRange.max;
    let newMin = tempoRange.min;

    if (result.score > 0.85 && result.tempo >= tempoRange.max - 10) {
      newMax = Math.min(200, tempoRange.max + 5);
    }
    if (result.score < 0.6 && result.tempo <= tempoRange.min + 10) {
      newMin = Math.max(30, tempoRange.min - 5);
    }

    // 3. Increment exercises completed and update tempo range
    set({
      tempoRange: { min: newMin, max: newMax },
      totalExercisesCompleted: get().totalExercisesCompleted + 1,
    });

    // 4. Recalculate weak areas
    get().recalculateWeakAreas();
  },

  markSkillMastered: (skillId: string) => {
    const { masteredSkills } = get();
    if (masteredSkills.includes(skillId)) return;
    set({ masteredSkills: [...masteredSkills, skillId] });
    debouncedSave(get());
  },

  reset: () => {
    set({
      noteAccuracy: {},
      noteAttempts: {},
      skills: { ...INITIAL_SKILLS },
      tempoRange: { min: 40, max: 80 },
      weakNotes: [],
      weakSkills: [],
      totalExercisesCompleted: 0,
      lastAssessmentDate: '',
      assessmentScore: 0,
      masteredSkills: [],
    });
    PersistenceManager.deleteState(STORAGE_KEYS.LEARNER_PROFILE);
  },
}));
