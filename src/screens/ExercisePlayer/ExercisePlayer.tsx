/**
 * Exercise Player Screen
 * Core learning experience with real-time feedback
 * Manages playback, scoring, and visual/audio feedback
 *
 * Architecture:
 * - Exercise state from store (Zustand)
 * - Real-time scoring from ScoringEngine
 * - 60fps animations with react-native-reanimated
 * - Haptic/audio feedback on note events
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  Platform,
  AccessibilityInfo,
  InteractionManager,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { Keyboard } from '../../components/Keyboard/Keyboard';
import { PianoRoll } from '../../components/PianoRoll/PianoRoll';
import { useExerciseStore } from '../../stores/exerciseStore';
import { useExercisePlayback } from '../../hooks/useExercisePlayback';
import type { Exercise, ExerciseScore, MidiNoteEvent } from '../../core/exercises/types';
import { ScoreDisplay } from './ScoreDisplay';
import { ExerciseControls } from './ExerciseControls';
import { HintDisplay } from './HintDisplay';
import { CompletionModal } from './CompletionModal';
import { CountInAnimation } from './CountInAnimation';
import { ErrorDisplay } from './ErrorDisplay';

export interface ExercisePlayerProps {
  exercise?: Exercise;
  onExerciseComplete?: (score: ExerciseScore) => void;
  onClose?: () => void;
}

interface FeedbackState {
  type: 'perfect' | 'good' | 'ok' | 'early' | 'late' | 'miss' | null;
  noteIndex: number;
  timestamp: number;
}

const DEFAULT_EXERCISE: Exercise = {
  id: 'lesson-01-ex-01',
  version: 1,
  metadata: {
    title: 'Find Middle C',
    description: 'Learn to locate and play Middle C',
    difficulty: 1,
    estimatedMinutes: 2,
    skills: ['note-finding', 'c-major'],
    prerequisites: [],
  },
  settings: {
    tempo: 60,
    timeSignature: [4, 4] as [number, number],
    keySignature: 'C',
    countIn: 4,
    metronomeEnabled: true,
  },
  notes: [
    { note: 60, startBeat: 0, durationBeats: 1, hand: 'right' as const },
    { note: 60, startBeat: 1, durationBeats: 1, hand: 'right' as const },
    { note: 60, startBeat: 2, durationBeats: 1, hand: 'right' as const },
    { note: 60, startBeat: 3, durationBeats: 1, hand: 'right' as const },
  ],
  scoring: {
    timingToleranceMs: 75,
    timingGracePeriodMs: 200,
    passingScore: 60,
    starThresholds: [60, 80, 95],
  },
  hints: {
    beforeStart: 'Place your right thumb on Middle C (the white key in the center)',
    commonMistakes: [
      {
        pattern: 'wrong-key',
        advice: 'Middle C is to the left of the two black keys in the center of the keyboard',
      },
    ],
    successMessage: 'Great job finding Middle C!',
  },
};

/**
 * ExercisePlayer - Main screen component
 * Responsible for:
 * - Playback control and timing
 * - Keyboard input handling
 * - Real-time feedback and animations
 * - Score tracking and validation
 * - Exercise completion
 */
export const ExercisePlayer: React.FC<ExercisePlayerProps> = ({
  exercise: exerciseOverride,
  onExerciseComplete,
  onClose,
}) => {
  const navigation = useNavigation();

  // Store integration
  const exerciseStore = useExerciseStore();
  const exercise = exerciseOverride || exerciseStore.currentExercise || DEFAULT_EXERCISE;

  // Lock to landscape orientation on mount, restore portrait on unmount
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // Exercise playback coordination (MIDI + Audio + Scoring)
  const {
    isPlaying,
    currentBeat,
    startPlayback,
    pausePlayback,
    stopPlayback,
    resetPlayback,
    playNote: handleManualNoteOn,
    releaseNote: handleManualNoteOff,
    isMidiReady,
    isAudioReady,
    hasError,
    errorMessage,
  } = useExercisePlayback({
    exercise,
    onComplete: handleExerciseCompletion,
    enableMidi: true,
    enableAudio: true,
  });

  // UI state (separate from playback logic)
  const [isPaused, setIsPaused] = useState(false);
  const [highlightedKeys, setHighlightedKeys] = useState<Set<number>>(new Set());
  const [expectedNotes, setExpectedNotes] = useState<Set<number>>(new Set());

  // Feedback state
  const [feedback, setFeedback] = useState<FeedbackState>({
    type: null,
    noteIndex: -1,
    timestamp: 0,
  });
  const [comboCount, setComboCount] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);
  const [finalScore, setFinalScore] = useState<ExerciseScore | null>(null);

  // References
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Animation values
  const comboScale = useRef(new Animated.Value(0)).current;

  // Cleanup feedback timeout on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = null;
      }
    };
  }, []);

  // Derived state
  const countInComplete = currentBeat >= 0;

  /**
   * Calculate expected notes for current beat range
   */
  useEffect(() => {
    // Look ahead 0.5 beats for upcoming notes
    const lookAheadBeats = 0.5;

    const expectedNotesSet = new Set<number>(
      exercise.notes
        .filter(
          (note) =>
            note.startBeat >= currentBeat - 0.2 && // Small lookbehind for timing tolerance
            note.startBeat < currentBeat + lookAheadBeats
        )
        .map((note) => note.note)
    );

    setExpectedNotes(expectedNotesSet);
  }, [currentBeat, exercise.notes]);

  // Playback loop is now handled by useExercisePlayback hook

  /**
   * Start exercise playback
   */
  const handleStart = useCallback(() => {
    startPlayback();
    setIsPaused(false);
    setComboCount(0);

    // Optional: Announce to screen reader
    if (Platform.OS === 'web') {
      AccessibilityInfo.announceForAccessibility('Exercise started');
    }
  }, [startPlayback]);

  /**
   * Pause/resume exercise playback
   */
  const handlePause = useCallback(() => {
    if (isPaused) {
      startPlayback();
      setIsPaused(false);
    } else {
      pausePlayback();
      setIsPaused(true);
    }

    if (Platform.OS === 'web') {
      const message = !isPaused ? 'Paused' : 'Resumed';
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [isPaused, startPlayback, pausePlayback]);

  /**
   * Restart exercise
   */
  const handleRestart = useCallback(() => {
    resetPlayback();
    setIsPaused(false);
    setHighlightedKeys(new Set());
    setComboCount(0);
    setFeedback({ type: null, noteIndex: -1, timestamp: 0 });

    if (Platform.OS === 'web') {
      AccessibilityInfo.announceForAccessibility('Exercise restarted');
    }
  }, [resetPlayback]);

  /**
   * Exit exercise without completing
   */
  const handleExit = useCallback(() => {
    stopPlayback();
    exerciseStore.clearSession();
    // Defer navigation to let stopPlayback settle before unmount
    InteractionManager.runAfterInteractions(() => {
      if (onClose) {
        onClose();
      } else {
        navigation.goBack();
      }
    });
  }, [stopPlayback, exerciseStore, onClose, navigation]);

  /**
   * Handle keyboard note press
   */
  const handleKeyDown = useCallback(
    (midiNote: MidiNoteEvent) => {
      if (!isPlaying || isPaused || !countInComplete) {
        return;
      }

      // Play the note (handled by useExercisePlayback)
      handleManualNoteOn(midiNote.note, midiNote.velocity / 127);

      // Visual feedback
      setHighlightedKeys((prev) => new Set([...prev, midiNote.note]));

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Check if this matches expected note
      const isExpected = expectedNotes.has(midiNote.note);

      if (isExpected) {
        setComboCount((prev) => prev + 1);
        setFeedback({
          type: 'perfect',
          noteIndex: exercise.notes.findIndex((n) => n.note === midiNote.note),
          timestamp: Date.now(),
        });

        // Animate combo
        Animated.sequence([
          Animated.spring(comboScale, {
            toValue: 1.1,
            useNativeDriver: true,
          }),
          Animated.spring(comboScale, {
            toValue: 1,
            useNativeDriver: true,
          }),
        ]).start();

        // Stronger haptic for correct note
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        setComboCount(0);
        setFeedback({
          type: 'miss',
          noteIndex: -1,
          timestamp: Date.now(),
        });

        // Warning haptic for incorrect
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }

      // Clear feedback after delay
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback({ type: null, noteIndex: -1, timestamp: 0 });
      }, 500);
    },
    [
      isPlaying,
      isPaused,
      countInComplete,
      expectedNotes,
      exercise.notes,
      comboScale,
      handleManualNoteOn,
    ]
  );

  /**
   * Handle keyboard note release
   */
  const handleKeyUp = useCallback(
    (midiNote: number) => {
      // Release note (handled by useExercisePlayback)
      handleManualNoteOff(midiNote);

      // Clear visual feedback
      setHighlightedKeys((prev) => {
        const next = new Set(prev);
        next.delete(midiNote);
        return next;
      });
    },
    [handleManualNoteOff]
  );

  /**
   * Handle exercise completion (called by useExercisePlayback hook)
   */
  function handleExerciseCompletion(score: ExerciseScore) {
    setFinalScore(score);
    setShowCompletion(true);
    onExerciseComplete?.(score);

    if (Platform.OS === 'web') {
      AccessibilityInfo.announceForAccessibility(
        `Exercise complete! Score: ${score.overall}%`
      );
    }
  }

  /**
   * Handle completion modal close
   */
  const handleCompletionClose = useCallback(() => {
    setShowCompletion(false);
    handleExit();
  }, [handleExit]);

  // Show error if initialization failed
  if (hasError && errorMessage && !isMidiReady && !isAudioReady) {
    return (
      <SafeAreaView style={styles.container} testID="exercise-player">
        <ErrorDisplay
          title="Initialization Error"
          message={errorMessage}
          onRetry={handleRestart}
          onClose={handleExit}
          testID="exercise-error"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="exercise-player">
      {/* Error banner for non-critical errors */}
      {hasError && errorMessage && (isMidiReady || isAudioReady) && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {/* Count-in animation (shows before playback) */}
      {isPlaying && !countInComplete && (
        <CountInAnimation
          countIn={exercise.settings.countIn}
          tempo={exercise.settings.tempo}
          elapsedTime={(currentBeat + exercise.settings.countIn) * (60000 / exercise.settings.tempo)}
        />
      )}

      {/* Landscape layout: vertical stack — top bar, piano roll, keyboard */}
      <View style={styles.mainColumn}>
        {/* Top bar: score + hint + controls in a single compact row */}
        <View style={styles.topBar}>
          <ScoreDisplay
            exercise={exercise}
            currentBeat={currentBeat}
            combo={comboCount}
            feedback={feedback.type}
            comboAnimValue={comboScale}
            compact
          />

          <View style={styles.topBarDivider} />

          <HintDisplay
            hints={exercise.hints}
            isPlaying={isPlaying}
            countInComplete={countInComplete}
            feedback={feedback.type}
            compact
          />

          <View style={styles.topBarDivider} />

          <ExerciseControls
            isPlaying={isPlaying}
            isPaused={isPaused}
            onStart={handleStart}
            onPause={handlePause}
            onRestart={handleRestart}
            onExit={handleExit}
            compact
            testID="exercise-controls"
          />
        </View>

        {/* Center: Piano roll fills remaining vertical space */}
        <View style={styles.pianoRollContainer}>
          <PianoRoll
            notes={exercise.notes}
            currentBeat={currentBeat}
            tempo={exercise.settings.tempo}
            timeSignature={exercise.settings.timeSignature}
            testID="exercise-piano-roll"
          />
        </View>

        {/* Bottom: Full-width keyboard */}
        <View style={styles.keyboardContainer}>
          <Keyboard
            startNote={48}
            octaveCount={2}
            onNoteOn={handleKeyDown}
            onNoteOff={handleKeyUp}
            highlightedNotes={highlightedKeys}
            expectedNotes={expectedNotes}
            enabled={isPlaying && !isPaused}
            hapticEnabled={true}
            showLabels={false}
            scrollable={true}
            keyHeight={100}
            testID="exercise-keyboard"
          />
        </View>
      </View>

      {/* Completion modal */}
      {showCompletion && finalScore && (
        <CompletionModal
          score={finalScore}
          exercise={exercise}
          onClose={handleCompletionClose}
          testID="completion-modal"
        />
      )}
    </SafeAreaView>
  );
};

ExercisePlayer.displayName = 'ExercisePlayer';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  errorBanner: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C',
  },
  errorText: {
    color: '#856404',
    fontSize: 12,
    textAlign: 'center',
  },
  mainColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 8,
  },
  topBarDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E0E0E0',
  },
  pianoRollContainer: {
    flex: 1,
    margin: 4,
  },
  keyboardContainer: {
    height: 110,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    overflow: 'hidden',
  },
});

export default ExercisePlayer;
