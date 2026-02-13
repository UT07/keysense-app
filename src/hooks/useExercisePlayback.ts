/**
 * useExercisePlayback Hook
 * Coordinates MIDI input, audio engine, exercise validation, and scoring
 *
 * This hook wires together all core systems for the exercise playback experience:
 * - MIDI input handling
 * - Audio engine for playback
 * - Real-time exercise validation
 * - Score calculation
 * - Playback state management
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import type { Exercise, MidiNoteEvent, ExerciseScore } from '@/core/exercises/types';
import { scoreExercise } from '@/core/exercises/ExerciseValidator';
import { getMidiInput } from '@/input/MidiInput';
import { getAudioEngine } from '@/audio/ExpoAudioEngine';
import { useExerciseStore } from '@/stores/exerciseStore';

export interface UseExercisePlaybackOptions {
  exercise: Exercise;
  onComplete?: (score: ExerciseScore) => void;
  enableMidi?: boolean;
  enableAudio?: boolean;
}

export interface UseExercisePlaybackReturn {
  // State
  isPlaying: boolean;
  currentBeat: number;
  playedNotes: MidiNoteEvent[];

  // Actions
  startPlayback: () => void;
  pausePlayback: () => void;
  stopPlayback: () => void;
  resetPlayback: () => void;

  // Manual note input (for keyboard component)
  playNote: (note: number, velocity?: number) => void;
  releaseNote: (note: number) => void;

  // Status
  isMidiReady: boolean;
  isAudioReady: boolean;
  hasError: boolean;
  errorMessage: string | null;
}

export function useExercisePlayback({
  exercise,
  onComplete,
  enableMidi = true,
  enableAudio = true,
}: UseExercisePlaybackOptions): UseExercisePlaybackReturn {
  const exerciseStore = useExerciseStore();
  const midiInput = getMidiInput();
  const audioEngine = getAudioEngine();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-exercise.settings.countIn);
  const [playedNotes, setPlayedNotes] = useState<MidiNoteEvent[]>([]);
  const [isMidiReady, setIsMidiReady] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startTimeRef = useRef(0);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeNotesRef = useRef<Map<number, any>>(new Map());
  const mountedRef = useRef(true);
  const handleCompletionRef = useRef<() => void>(() => {});

  // Track component mount lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Synchronous cleanup: clear interval immediately on unmount
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * Initialize MIDI input
   */
  useEffect(() => {
    if (!enableMidi) {
      setIsMidiReady(true);
      return;
    }

    let mounted = true;

    const initMidi = async () => {
      try {
        await midiInput.initialize();
        if (mounted) {
          setIsMidiReady(true);
          console.log('[useExercisePlayback] MIDI initialized');
        }
      } catch (error) {
        console.error('[useExercisePlayback] MIDI init failed:', error);
        if (mounted) {
          setHasError(true);
          setErrorMessage('MIDI initialization failed. Touch keyboard will still work.');
          setIsMidiReady(true); // Continue without MIDI
        }
      }
    };

    initMidi();

    return () => {
      mounted = false;
      if (enableMidi) {
        midiInput.dispose().catch(console.error);
      }
    };
  }, [enableMidi, midiInput]);

  /**
   * Initialize audio engine
   */
  useEffect(() => {
    if (!enableAudio) {
      setIsAudioReady(true);
      return;
    }

    let mounted = true;

    const initAudio = async () => {
      try {
        await audioEngine.initialize();
        if (mounted) {
          setIsAudioReady(true);
          console.log('[useExercisePlayback] Audio engine initialized');
        }
      } catch (error) {
        console.error('[useExercisePlayback] Audio init failed:', error);
        if (mounted) {
          setHasError(true);
          setErrorMessage('Audio initialization failed. No sound will be played.');
          setIsAudioReady(false);
        }
      }
    };

    initAudio();

    return () => {
      mounted = false;
      if (enableAudio) {
        audioEngine.dispose();
      }
    };
  }, [enableAudio, audioEngine]);

  /**
   * Subscribe to MIDI events
   */
  useEffect(() => {
    if (!enableMidi || !isMidiReady) return;

    const unsubscribe = midiInput.onNoteEvent((midiEvent) => {
      if (!mountedRef.current || !isPlaying) return;

      // Add note to played notes
      setPlayedNotes((prev) => [...prev, midiEvent]);

      // Update exercise store
      exerciseStore.addPlayedNote(midiEvent);

      // Play audio if enabled
      if (enableAudio && isAudioReady && midiEvent.type === 'noteOn') {
        try {
          const velocity = midiEvent.velocity / 127; // Normalize to 0-1
          const handle = audioEngine.playNote(midiEvent.note, velocity);
          activeNotesRef.current.set(midiEvent.note, handle);
        } catch (error) {
          console.error('[useExercisePlayback] Audio playback error:', error);
        }
      }

      // Release audio if note off
      if (enableAudio && isAudioReady && midiEvent.type === 'noteOff') {
        const handle = activeNotesRef.current.get(midiEvent.note);
        if (handle) {
          audioEngine.releaseNote(handle);
          activeNotesRef.current.delete(midiEvent.note);
        }
      }
    });

    return unsubscribe;
  }, [
    enableMidi,
    enableAudio,
    isMidiReady,
    isAudioReady,
    isPlaying,
    midiInput,
    audioEngine,
    exerciseStore,
  ]);

  /**
   * Playback loop - updates current beat
   */
  useEffect(() => {
    if (!isPlaying) {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      return;
    }

    const tempo = exercise.settings.tempo;
    const countInBeats = exercise.settings.countIn;
    const exerciseDuration =
      Math.max(...exercise.notes.map((n) => n.startBeat + n.durationBeats)) + 1;

    playbackIntervalRef.current = setInterval(() => {
      if (!mountedRef.current) {
        if (playbackIntervalRef.current) {
          clearInterval(playbackIntervalRef.current);
          playbackIntervalRef.current = null;
        }
        return;
      }

      const currentTime = Date.now();
      const elapsed = currentTime - startTimeRef.current;

      // Calculate beat: elapsed_ms / (60000 / tempo) - countIn
      const beat = (elapsed / 60000) * tempo - countInBeats;

      setCurrentBeat(beat);
      exerciseStore.setCurrentBeat(beat);

      // Check for completion (use ref to avoid stale closure)
      if (beat > exerciseDuration) {
        handleCompletionRef.current();
      }
    }, 16); // 60fps

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, exercise, exerciseStore]);

  /**
   * Start playback
   */
  const startPlayback = useCallback(() => {
    startTimeRef.current = Date.now();
    setIsPlaying(true);
    setCurrentBeat(-exercise.settings.countIn);
    setPlayedNotes([]);
    exerciseStore.setIsPlaying(true);
    exerciseStore.clearSession();

    console.log('[useExercisePlayback] Playback started');
  }, [exercise.settings.countIn, exerciseStore]);

  /**
   * Pause playback
   */
  const pausePlayback = useCallback(() => {
    // Clear interval synchronously to prevent further state updates
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    setIsPlaying(false);
    exerciseStore.setIsPlaying(false);

    // Release all active notes
    if (enableAudio && isAudioReady) {
      audioEngine.releaseAllNotes();
      activeNotesRef.current.clear();
    }

    console.log('[useExercisePlayback] Playback paused');
  }, [exerciseStore, enableAudio, isAudioReady, audioEngine]);

  /**
   * Stop playback
   */
  const stopPlayback = useCallback(() => {
    // Clear interval synchronously to prevent further state updates
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    setIsPlaying(false);
    setCurrentBeat(-exercise.settings.countIn);
    exerciseStore.setIsPlaying(false);

    // Release all active notes
    if (enableAudio && isAudioReady) {
      audioEngine.releaseAllNotes();
      activeNotesRef.current.clear();
    }

    console.log('[useExercisePlayback] Playback stopped');
  }, [exercise.settings.countIn, exerciseStore, enableAudio, isAudioReady, audioEngine]);

  /**
   * Reset playback
   */
  const resetPlayback = useCallback(() => {
    stopPlayback();
    setPlayedNotes([]);
    exerciseStore.clearSession();

    console.log('[useExercisePlayback] Playback reset');
  }, [stopPlayback, exerciseStore]);

  /**
   * Handle exercise completion
   */
  const handleCompletion = useCallback(() => {
    if (!mountedRef.current) return;

    // Clear interval synchronously to prevent further state updates
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    setIsPlaying(false);
    exerciseStore.setIsPlaying(false);

    // Convert played note timestamps from epoch (Date.now()) to relative
    // (ms since beat 0). The scoring engine expects timestamps in the same
    // frame as expectedTimeMs = startBeat * msPerBeat.
    const msPerBeat = 60000 / exercise.settings.tempo;
    const countInMs = exercise.settings.countIn * msPerBeat;
    const beat0EpochMs = startTimeRef.current + countInMs;

    const adjustedNotes = playedNotes.map((n) => ({
      ...n,
      timestamp: n.timestamp - beat0EpochMs,
    }));

    const score = scoreExercise(exercise, adjustedNotes);
    exerciseStore.setScore(score);

    console.log('[useExercisePlayback] Exercise completed:', score);
    onComplete?.(score);
  }, [exercise, playedNotes, exerciseStore, onComplete]);

  // Keep ref in sync so the interval always calls the latest handleCompletion
  useEffect(() => {
    handleCompletionRef.current = handleCompletion;
  }, [handleCompletion]);

  /**
   * Manual note play (for touch keyboard)
   * Always plays audio for feedback; only records notes for scoring during playback
   */
  const playNote = useCallback(
    (note: number, velocity: number = 0.8) => {
      // Always play audio feedback regardless of playback state
      if (enableAudio && isAudioReady) {
        try {
          const handle = audioEngine.playNote(note, velocity);
          activeNotesRef.current.set(note, handle);
        } catch (error) {
          console.error('[useExercisePlayback] Manual playback error:', error);
        }
      }

      // Only record notes for scoring when exercise is playing
      if (!isPlaying) return;

      const midiEvent: MidiNoteEvent = {
        type: 'noteOn',
        note,
        velocity: Math.floor(velocity * 127),
        timestamp: Date.now(),
        channel: 0,
      };

      setPlayedNotes((prev) => [...prev, midiEvent]);
      exerciseStore.addPlayedNote(midiEvent);
    },
    [isPlaying, enableAudio, isAudioReady, audioEngine, exerciseStore]
  );

  /**
   * Manual note release (for touch keyboard)
   */
  const releaseNote = useCallback(
    (note: number) => {
      if (!enableAudio || !isAudioReady) return;

      const handle = activeNotesRef.current.get(note);
      if (handle) {
        audioEngine.releaseNote(handle);
        activeNotesRef.current.delete(note);
      }
    },
    [enableAudio, isAudioReady, audioEngine]
  );

  return {
    // State
    isPlaying,
    currentBeat,
    playedNotes,

    // Actions
    startPlayback,
    pausePlayback,
    stopPlayback,
    resetPlayback,

    // Manual input
    playNote,
    releaseNote,

    // Status
    isMidiReady,
    isAudioReady,
    hasError,
    errorMessage,
  };
}
