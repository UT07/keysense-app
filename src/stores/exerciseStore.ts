/**
 * Exercise session state management using Zustand with MMKV persistence
 *
 * Manages:
 * - Current exercise loading and playback state
 * - Played notes tracking during sessions
 * - Exercise scoring and results
 * - Session timing and metrics
 *
 * State is automatically persisted to MMKV storage
 */

import { create } from 'zustand';
import type { Exercise, ExerciseScore, MidiNoteEvent } from '@/core/exercises/types';
import type { ExerciseSessionState } from './types';
import { PersistenceManager, STORAGE_KEYS, createDebouncedSave } from './persistence';

/** Data-only shape of exercise session (excludes actions) */
type ExerciseSessionData = Pick<
  ExerciseSessionState,
  'currentExercise' | 'currentExerciseId' | 'playedNotes' | 'isPlaying' | 'currentBeat' | 'score' | 'sessionStartTime' | 'sessionEndTime'
>;

const defaultData: ExerciseSessionData = {
  currentExercise: null,
  currentExerciseId: null,
  playedNotes: [],
  isPlaying: false,
  currentBeat: 0,
  score: null,
  sessionStartTime: null,
  sessionEndTime: null,
};

// Create debounced save function
const debouncedSave = createDebouncedSave(STORAGE_KEYS.EXERCISE, 500);

export const useExerciseStore = create<ExerciseSessionState>((set, get) => ({
  ...defaultData,

  setCurrentExercise: (exercise: Exercise) => {
    const newState = {
      currentExercise: exercise,
      currentExerciseId: exercise.id,
      playedNotes: [],
      score: null,
      sessionStartTime: Date.now(),
      sessionEndTime: null,
    };
    set(newState);
    debouncedSave({ ...get(), ...newState });
  },

  addPlayedNote: (note: MidiNoteEvent) => {
    set((state) => ({
      playedNotes: [...state.playedNotes, note],
    }));
    debouncedSave(get());
  },

  setIsPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
    debouncedSave(get());
  },

  setCurrentBeat: (beat: number) => {
    set({ currentBeat: beat });
    // Don't persist beat updates - they're frequent and transient
  },

  setScore: (score: ExerciseScore) => {
    const newState = {
      score,
      sessionEndTime: Date.now(),
    };
    set(newState);
    debouncedSave({ ...get(), ...newState });
  },

  setSessionTime: (startTime: number, endTime?: number) => {
    set({
      sessionStartTime: startTime,
      sessionEndTime: endTime ?? null,
    });
    debouncedSave(get());
  },

  clearSession: () => {
    const newState = {
      playedNotes: [],
      score: null,
      currentBeat: 0,
    };
    set(newState);
    debouncedSave({ ...get(), ...newState });
  },

  reset: () => {
    set({
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
  },
}));
