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
import { createAudioEngine, ensureAudioModeConfigured } from '@/audio/createAudioEngine';
import { useExerciseStore } from '@/stores/exerciseStore';
import { useProgressStore } from '@/stores/progressStore';
import { getLessonIdForExercise } from '../content/ContentLoader';

/**
 * Touch-to-callback latency compensation (ms).
 * React Native's gesture system adds ~15-25ms between finger contact and
 * onPressIn callback. This constant is subtracted from played note timestamps
 * before scoring so users aren't penalized for platform latency.
 */
const TOUCH_LATENCY_COMPENSATION_MS = 20;

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

  // Real-time beat position (updated at 60fps, not throttled like currentBeat).
  // Use this for timing-sensitive operations like scoring key presses.
  realtimeBeatRef: React.MutableRefObject<number>;

  // Actions
  startPlayback: () => void;
  resumePlayback: () => void;
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
  const audioEngineRef = useRef(createAudioEngine());
  const audioEngine = audioEngineRef.current;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-exercise.settings.countIn);
  const [playedNotes, setPlayedNotes] = useState<MidiNoteEvent[]>([]);
  const [isMidiReady, setIsMidiReady] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startTimeRef = useRef(0);
  const pauseElapsedRef = useRef(0); // Tracks elapsed ms at time of pause
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeNotesRef = useRef<Map<number, any>>(new Map());
  const mountedRef = useRef(true);
  const handleCompletionRef = useRef<() => void>(() => {});
  const lastStateUpdateRef = useRef(0); // Throttle state updates to ~20fps for perf
  const hasCrossedZeroRef = useRef(false); // Track count-in → playback transition
  const playedNotesRef = useRef<MidiNoteEvent[]>([]); // Ref for scoring (avoids stale closure)
  const realtimeBeatRef = useRef(-exercise.settings.countIn); // 60fps beat position for scoring
  // Tracks noteOn indices so noteOff/release can attach durationMs for scoring.
  const noteOnIndexMapRef = useRef<Map<number, number[]>>(new Map());

  const trackNoteOnIndex = useCallback((note: number, index: number) => {
    const stack = noteOnIndexMapRef.current.get(note) ?? [];
    stack.push(index);
    noteOnIndexMapRef.current.set(note, stack);
  }, []);

  const closeLatestNoteDuration = useCallback((note: number, releaseTimeMs: number) => {
    const stack = noteOnIndexMapRef.current.get(note);
    if (!stack || stack.length === 0) return;

    const noteIndex = stack.pop()!;
    if (stack.length === 0) {
      noteOnIndexMapRef.current.delete(note);
    }

    const noteOnEvent = playedNotesRef.current[noteIndex];
    if (noteOnEvent && noteOnEvent.type === 'noteOn' && noteOnEvent.durationMs == null) {
      noteOnEvent.durationMs = Math.max(0, releaseTimeMs - noteOnEvent.timestamp);
    }
  }, []);

  const closeAllOpenNoteDurations = useCallback((releaseTimeMs: number) => {
    for (const [note, stack] of noteOnIndexMapRef.current.entries()) {
      while (stack.length > 0) {
        closeLatestNoteDuration(note, releaseTimeMs);
      }
    }
    noteOnIndexMapRef.current.clear();
  }, [closeLatestNoteDuration]);

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
   *
   * IMPORTANT: We do NOT dispose the audio engine on unmount because it's a
   * singleton shared across screen navigations. Disposing it on unmount causes
   * a race condition when navigating between exercises (old cleanup destroys
   * the engine after the new screen has already initialized it). Instead, we
   * only release active notes on unmount. The engine persists for the app's lifetime.
   */
  useEffect(() => {
    if (!enableAudio) {
      setIsAudioReady(true);
      return;
    }

    let mounted = true;

    const initAudio = async () => {
      try {
        // Ensure iOS audio session is configured BEFORE engine init.
        // This must complete before any audio plays or iOS may suspend output.
        await ensureAudioModeConfigured();

        // If already initialized (singleton was kept alive), skip re-init
        if (audioEngine.isReady()) {
          if (mounted) {
            setIsAudioReady(true);
            console.log('[useExercisePlayback] Audio engine already initialized');
          }
          return;
        }
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
      // Only release active notes — do NOT dispose the singleton engine
      if (enableAudio) {
        audioEngine.releaseAllNotes();
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

      // Only record noteOn events for scoring (noteOff would double-count notes)
      if (midiEvent.type === 'noteOn') {
        // Normalize timestamp to Date.now() domain (native MIDI may use a different clock)
        const normalizedEvent = { ...midiEvent, timestamp: Date.now() };
        const noteIndex = playedNotesRef.current.length;
        playedNotesRef.current.push(normalizedEvent);
        trackNoteOnIndex(normalizedEvent.note, noteIndex);
        setPlayedNotes(playedNotesRef.current);
        exerciseStore.addPlayedNote(normalizedEvent);
      }

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

      if (midiEvent.type === 'noteOff') {
        closeLatestNoteDuration(midiEvent.note, Date.now());
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
    trackNoteOnIndex,
    closeLatestNoteDuration,
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
    const lastNoteBeat = Math.max(
      ...exercise.notes.map((n) => n.startBeat + n.durationBeats),
    );
    // Reduced buffer from +2 to +0.5 beats. Old value caused 2s of dead silence
    // at 60 BPM after the last note ended. Half a beat is enough for the user to
    // register the last note's completion visually before the modal appears.
    const exerciseDuration = lastNoteBeat + 0.5;
    const totalExpectedNotes = exercise.notes.filter((n) => !n.optional).length;

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

      // Always update the realtime ref at 60fps for scoring accuracy
      realtimeBeatRef.current = beat;

      // Throttle React state updates to ~20fps to reduce re-renders.
      // Internal timing (scoring, completion) stays at 60fps via refs.
      // Exception: bypass throttle at count-in → playback transition (beat 0)
      // so the overlay disappears instantly and first notes aren't visually missed.
      const forceUpdate = !hasCrossedZeroRef.current && beat >= 0;
      if (forceUpdate) hasCrossedZeroRef.current = true;

      if (forceUpdate || currentTime - lastStateUpdateRef.current >= 50) {
        lastStateUpdateRef.current = currentTime;
        setCurrentBeat(beat);
        exerciseStore.setCurrentBeat(beat);
      }

      // Early completion: if the user has played at least as many notes as the
      // exercise requires AND we've passed the last note's start beat, complete
      // immediately instead of waiting for the full duration timeout.
      const playedCount = playedNotesRef.current.length;
      const earlyComplete =
        playedCount >= totalExpectedNotes && beat >= lastNoteBeat;

      // Check for completion (use ref to avoid stale closure)
      if (earlyComplete || beat > exerciseDuration) {
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
   * Start playback (fresh start — resets all state)
   */
  const startPlayback = useCallback(() => {
    startTimeRef.current = Date.now();
    pauseElapsedRef.current = 0;
    hasCrossedZeroRef.current = false;
    playedNotesRef.current = [];
    noteOnIndexMapRef.current.clear();
    realtimeBeatRef.current = -exercise.settings.countIn;
    setIsPlaying(true);
    setCurrentBeat(-exercise.settings.countIn);
    setPlayedNotes([]);
    exerciseStore.setIsPlaying(true);
    exerciseStore.clearSession();

    console.log('[useExercisePlayback] Playback started');
  }, [exercise.settings.countIn, exerciseStore]);

  /**
   * Resume playback after pause (continues from where it left off)
   */
  const resumePlayback = useCallback(() => {
    // Adjust startTimeRef so elapsed time calculation continues correctly
    // pauseElapsedRef tracks how much time had passed at the moment of pause
    startTimeRef.current = Date.now() - pauseElapsedRef.current;
    setIsPlaying(true);
    exerciseStore.setIsPlaying(true);

    console.log('[useExercisePlayback] Playback resumed');
  }, [exerciseStore]);

  /**
   * Pause playback (preserves played notes and position)
   */
  const pausePlayback = useCallback(() => {
    // Save elapsed time so we can resume from the same position
    pauseElapsedRef.current = Date.now() - startTimeRef.current;

    // Clear interval synchronously to prevent further state updates
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    setIsPlaying(false);
    exerciseStore.setIsPlaying(false);

    // Close any held notes at pause time so duration scoring remains accurate.
    closeAllOpenNoteDurations(Date.now());

    // Release all active notes
    if (enableAudio && isAudioReady) {
      audioEngine.releaseAllNotes();
      activeNotesRef.current.clear();
    }

    console.log('[useExercisePlayback] Playback paused');
  }, [exerciseStore, enableAudio, isAudioReady, audioEngine, closeAllOpenNoteDurations]);

  /**
   * Stop playback
   */
  const stopPlayback = useCallback(() => {
    // Clear interval synchronously to prevent further state updates
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    realtimeBeatRef.current = -exercise.settings.countIn;
    setIsPlaying(false);
    setCurrentBeat(-exercise.settings.countIn);
    exerciseStore.setIsPlaying(false);

    // Close any held notes when stopping.
    closeAllOpenNoteDurations(Date.now());

    // Release all active notes
    if (enableAudio && isAudioReady) {
      audioEngine.releaseAllNotes();
      activeNotesRef.current.clear();
    }

    console.log('[useExercisePlayback] Playback stopped');
  }, [exercise.settings.countIn, exerciseStore, enableAudio, isAudioReady, audioEngine, closeAllOpenNoteDurations]);

  /**
   * Reset playback
   */
  const resetPlayback = useCallback(() => {
    stopPlayback();
    playedNotesRef.current = [];
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

    // Any notes still held at completion are closed at completion time.
    closeAllOpenNoteDurations(Date.now());

    // Convert played note timestamps from epoch (Date.now()) to relative
    // (ms since beat 0). The scoring engine expects timestamps in the same
    // frame as expectedTimeMs = startBeat * msPerBeat.
    // Use playedNotesRef (not state) to avoid stale closure from React batching.
    const msPerBeat = 60000 / exercise.settings.tempo;
    const countInMs = exercise.settings.countIn * msPerBeat;
    const beat0EpochMs = startTimeRef.current + countInMs;

    const adjustedNotes = playedNotesRef.current.map((n) => ({
      ...n,
      timestamp: n.timestamp - beat0EpochMs - TOUCH_LATENCY_COMPENSATION_MS,
    }));

    // Look up previous high score so isNewHighScore is accurate
    const lessonId = getLessonIdForExercise(exercise.id);
    const progressState = useProgressStore.getState();
    const previousHighScore = lessonId
      ? progressState.lessonProgress[lessonId]?.exerciseScores[exercise.id]?.highScore ?? 0
      : 0;

    const score = scoreExercise(exercise, adjustedNotes, previousHighScore);
    exerciseStore.setScore(score);

    console.log('[useExercisePlayback] Exercise completed:', score);
    onComplete?.(score);
  }, [exercise, exerciseStore, onComplete, closeAllOpenNoteDurations]);

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
      } else if (enableAudio && !isAudioReady) {
        console.warn(`[useExercisePlayback] Audio not ready — note ${note} skipped. Engine state: ${audioEngine.getState()}`);
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

      const noteIndex = playedNotesRef.current.length;
      playedNotesRef.current.push(midiEvent);
      trackNoteOnIndex(note, noteIndex);
      setPlayedNotes([...playedNotesRef.current]);
      exerciseStore.addPlayedNote(midiEvent);
    },
    [isPlaying, enableAudio, isAudioReady, audioEngine, exerciseStore, trackNoteOnIndex]
  );

  /**
   * Manual note release (for touch keyboard)
   */
  const releaseNote = useCallback(
    (note: number) => {
      if (isPlaying) {
        closeLatestNoteDuration(note, Date.now());
      }

      if (!enableAudio || !isAudioReady) return;

      const handle = activeNotesRef.current.get(note);
      if (handle) {
        audioEngine.releaseNote(handle);
        activeNotesRef.current.delete(note);
      }
    },
    [isPlaying, enableAudio, isAudioReady, audioEngine, closeLatestNoteDuration]
  );

  return {
    // State
    isPlaying,
    currentBeat,
    playedNotes,
    realtimeBeatRef,

    // Actions
    startPlayback,
    resumePlayback,
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
