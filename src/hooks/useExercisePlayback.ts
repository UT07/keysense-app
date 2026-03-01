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
import { InputManager, INPUT_LATENCY_COMPENSATION_MS } from '@/input/InputManager';
import type { ActiveInputMethod } from '@/input/InputManager';
import { createAudioEngine, ensureAudioModeConfigured } from '@/audio/createAudioEngine';
import { useExerciseStore } from '@/stores/exerciseStore';
import { useProgressStore } from '@/stores/progressStore';
import { useSettingsStore } from '@/stores/settingsStore';
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
  /** Override input method ('auto' uses settings store preference) */
  inputMethod?: 'auto' | 'midi' | 'mic' | 'touch';
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

  /** Which input method is currently active (midi/mic/touch) */
  activeInputMethod: ActiveInputMethod;

  /** Ref holding the latest external (MIDI/mic) noteOn event, or null.
   *  ExercisePlayer reads this to highlight keys and trigger feedback
   *  for non-touch input sources. */
  lastExternalNoteRef: React.MutableRefObject<MidiNoteEvent | null>;

  /** Counter that increments each time an external noteOn arrives.
   *  Use as a useEffect dependency to react to new external events. */
  externalNoteCount: number;
}

export function useExercisePlayback({
  exercise,
  onComplete,
  enableMidi = true,
  enableAudio = true,
  inputMethod,
}: UseExercisePlaybackOptions): UseExercisePlaybackReturn {
  const exerciseStore = useExerciseStore();
  const audioEngineRef = useRef(createAudioEngine());
  const audioEngine = audioEngineRef.current;
  const preferredInput = useSettingsStore((s) => s.preferredInputMethod);
  const resolvedInputMethod = inputMethod ?? preferredInput ?? 'auto';
  const inputManagerRef = useRef<InputManager | null>(null);
  const [activeInputMethod, setActiveInputMethod] = useState<ActiveInputMethod>('touch');

  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const [currentBeat, setCurrentBeat] = useState(-exercise.settings.countIn);
  const [playedNotes, setPlayedNotes] = useState<MidiNoteEvent[]>([]);
  const [isMidiReady, setIsMidiReady] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const isAudioReadyRef = useRef(false); // BUG-002 fix: ref for synchronous reads in callbacks
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

  // Latest external (MIDI/mic) noteOn — read by ExercisePlayer for keyboard highlighting.
  // Paired with a counter state so ExercisePlayer can react via useEffect.
  const lastExternalNoteRef = useRef<MidiNoteEvent | null>(null);
  const [externalNoteCount, setExternalNoteCount] = useState(0);

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
   * Initialize input sources (MIDI + InputManager for mic detection)
   */
  useEffect(() => {
    if (!enableMidi) {
      setIsMidiReady(true);
      return;
    }

    let mounted = true;

    const initInput = async () => {
      try {
        // Initialize InputManager which handles MIDI + Mic detection
        const manager = new InputManager({ preferred: resolvedInputMethod });
        await manager.initialize();

        if (mounted) {
          inputManagerRef.current = manager;
          setActiveInputMethod(manager.activeMethod);
          setIsMidiReady(true);
          console.log(`[useExercisePlayback] Input initialized: ${manager.activeMethod}`);

          // If mic was requested but failed, show the reason to the user
          const micFailure = manager.getMicFailureReason();
          if (micFailure && resolvedInputMethod === 'mic') {
            console.warn(`[useExercisePlayback] Mic failed: ${micFailure}`);
            setHasError(true);
            setErrorMessage(micFailure);
          }
        } else {
          manager.dispose();
        }
      } catch (error) {
        console.error('[useExercisePlayback] Input init failed:', error);
        if (mounted) {
          setHasError(true);
          setErrorMessage('Input initialization failed. Touch keyboard will still work.');
          setIsMidiReady(true); // Continue with touch
        }
      }
    };

    initInput();

    return () => {
      mounted = false;
      inputManagerRef.current?.dispose();
      inputManagerRef.current = null;
    };
  }, [enableMidi, resolvedInputMethod]);

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
      isAudioReadyRef.current = true; setIsAudioReady(true);
      return;
    }

    let mounted = true;

    const initAudio = async () => {
      try {
        // Ensure iOS audio session is configured BEFORE engine init.
        // This must complete before any audio plays or iOS may suspend output.
        // Note: mic recording session config is now handled by InputManager
        // via react-native-audio-api's AudioManager (avoids cross-library conflict).
        await ensureAudioModeConfigured();

        // If already initialized (singleton was kept alive), skip re-init
        if (audioEngine.isReady()) {
          if (mounted) {
            isAudioReadyRef.current = true; setIsAudioReady(true);
            console.log('[useExercisePlayback] Audio engine already initialized');
          }
          return;
        }
        await audioEngine.initialize();
        if (mounted) {
          isAudioReadyRef.current = true; setIsAudioReady(true);
          console.log('[useExercisePlayback] Audio engine initialized');
        }
      } catch (error) {
        console.error('[useExercisePlayback] Audio init failed:', error);
        if (mounted) {
          setHasError(true);
          setErrorMessage('Audio initialization failed. No sound will be played.');
          isAudioReadyRef.current = false; setIsAudioReady(false);
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
   * Subscribe to input events (MIDI + Mic via InputManager)
   */
  useEffect(() => {
    if (!enableMidi || !isMidiReady) return;

    const manager = inputManagerRef.current;
    if (!manager) return;

    // Start the InputManager (needed for mic capture)
    manager.start().catch(console.error);

    const unsubscribe = manager.onNoteEvent((midiEvent) => {
      if (!mountedRef.current || !isPlayingRef.current) return;

      // Only record noteOn events for scoring (noteOff would double-count notes)
      if (midiEvent.type === 'noteOn') {
        // Normalize timestamp to Date.now() domain (native MIDI may use a different clock)
        const source = midiEvent.inputSource ?? manager.activeMethod;
        const normalizedEvent = { ...midiEvent, timestamp: Date.now(), inputSource: source as 'midi' | 'mic' | 'touch' };
        const noteIndex = playedNotesRef.current.length;
        playedNotesRef.current.push(normalizedEvent);
        trackNoteOnIndex(normalizedEvent.note, noteIndex);
        setPlayedNotes([...playedNotesRef.current]);
        exerciseStore.addPlayedNote(normalizedEvent);

        // Surface external noteOn for keyboard highlighting in ExercisePlayer.
        // The ref holds the event data; the counter state triggers the effect.
        lastExternalNoteRef.current = normalizedEvent;
        setExternalNoteCount((c) => c + 1);
      }

      // Play audio if enabled (for MIDI input — mic has its own audio)
      // BUG-002 fix: Use ref instead of state to avoid stale closure dropping early notes
      if (enableAudio && isAudioReadyRef.current && midiEvent.type === 'noteOn' && midiEvent.inputSource !== 'mic') {
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

      // Release audio if note off (not mic — mic notes have no audio handle)
      if (enableAudio && isAudioReadyRef.current && midiEvent.type === 'noteOff' && midiEvent.inputSource !== 'mic') {
        const handle = activeNotesRef.current.get(midiEvent.note);
        if (handle) {
          audioEngine.releaseNote(handle);
          activeNotesRef.current.delete(midiEvent.note);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [
    enableMidi,
    enableAudio,
    isMidiReady,
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
    // BUG-007 fix: Guard against empty notes array (Math.max(...[]) = -Infinity)
    const noteEnds = exercise.notes.map((n) => n.startBeat + n.durationBeats);
    const lastNoteBeat = noteEnds.length > 0 ? Math.max(...noteEnds) : 0;
    // Reduced buffer from +2 to +0.5 beats. Old value caused 2s of dead silence
    // at 60 BPM after the last note ended. Half a beat is enough for the user to
    // register the last note's completion visually before the modal appears.
    const exerciseDuration = lastNoteBeat + 0.5;
    const totalExpectedNotes = exercise.notes.filter((n) => !n.optional).length;
    const loopEnabled = exercise.settings.loopEnabled ?? false;

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
        // BUG-005 fix: If loopEnabled, restart from beat 0 instead of completing
        if (loopEnabled) {
          startTimeRef.current = Date.now();
          pauseElapsedRef.current = 0;
          hasCrossedZeroRef.current = false;
          playedNotesRef.current = [];
          noteOnIndexMapRef.current.clear();
          realtimeBeatRef.current = -countInBeats;
          setPlayedNotes([]);
          setCurrentBeat(-countInBeats);
          return; // Don't complete — loop again
        }
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
    isPlayingRef.current = true;
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
    isPlayingRef.current = true;
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

    isPlayingRef.current = false;
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
    isPlayingRef.current = false;
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

    isPlayingRef.current = false;
    setIsPlaying(false);
    exerciseStore.setIsPlaying(false);

    // Any notes still held at completion are closed at completion time.
    closeAllOpenNoteDurations(Date.now());

    // BUG-006 fix: Release all active audio notes on completion (prevents notes ringing)
    if (enableAudio && audioEngine) {
      audioEngine.releaseAllNotes();
      activeNotesRef.current.clear();
    }

    // Convert played note timestamps from epoch (Date.now()) to relative
    // (ms since beat 0). The scoring engine expects timestamps in the same
    // frame as expectedTimeMs = startBeat * msPerBeat.
    // Use playedNotesRef (not state) to avoid stale closure from React batching.
    const msPerBeat = 60000 / exercise.settings.tempo;
    const countInMs = exercise.settings.countIn * msPerBeat;
    const beat0EpochMs = startTimeRef.current + countInMs;

    // Use InputManager's method-aware latency compensation (handles mono vs poly mic)
    const managerCompensation = inputManagerRef.current?.getLatencyCompensationMs();
    const adjustedNotes = playedNotesRef.current.map((n) => {
      const source = (n.inputSource ?? 'touch') as ActiveInputMethod;
      // Prefer InputManager's compensation (poly-aware), fall back to lookup table
      const compensation = source === 'mic' && managerCompensation != null
        ? managerCompensation
        : (INPUT_LATENCY_COMPENSATION_MS[source] ?? TOUCH_LATENCY_COMPENSATION_MS);
      return {
        ...n,
        timestamp: n.timestamp - beat0EpochMs - compensation,
      };
    });

    // Apply timing tolerance multiplier for mic input (BUG FIX: was defined but never applied).
    // Mic detection has ~100-120ms pipeline latency with jitter — widen scoring windows.
    const timingMultiplier = inputManagerRef.current?.getTimingMultiplier() ?? 1.0;
    const scoringExercise = timingMultiplier !== 1.0
      ? {
          ...exercise,
          scoring: {
            ...exercise.scoring,
            timingToleranceMs: exercise.scoring.timingToleranceMs * timingMultiplier,
            timingGracePeriodMs: exercise.scoring.timingGracePeriodMs * timingMultiplier,
          },
        }
      : exercise;

    // Look up previous high score so isNewHighScore is accurate
    const lessonId = getLessonIdForExercise(exercise.id);
    const progressState = useProgressStore.getState();
    const previousHighScore = lessonId
      ? progressState.lessonProgress[lessonId]?.exerciseScores[exercise.id]?.highScore ?? 0
      : 0;

    const score = scoreExercise(scoringExercise, adjustedNotes, previousHighScore);
    exerciseStore.setScore(score);

    console.log('[useExercisePlayback] Exercise completed:', score);
    onComplete?.(score);
  }, [exercise, exerciseStore, onComplete, closeAllOpenNoteDurations, enableAudio, audioEngine]);

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
        inputSource: 'touch',
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

    // Input
    activeInputMethod,

    // External note events (MIDI/mic)
    lastExternalNoteRef,
    externalNoteCount,
  };
}
