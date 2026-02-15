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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  Platform,
  AccessibilityInfo,
} from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Keyboard } from '../../components/Keyboard/Keyboard';
import { PianoRoll } from '../../components/PianoRoll/PianoRoll';
import { useExerciseStore } from '../../stores/exerciseStore';
import { useProgressStore } from '../../stores/progressStore';
import { useExercisePlayback } from '../../hooks/useExercisePlayback';
import { getExercise, getNextExerciseId, getLessonIdForExercise, getLesson } from '../../content/ContentLoader';
import { recordPracticeSession as calculateStreakUpdate } from '../../core/progression/XpSystem';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { Exercise, ExerciseScore, MidiNoteEvent } from '../../core/exercises/types';
import { ScoreDisplay } from './ScoreDisplay';
import { ExerciseControls } from './ExerciseControls';
import { HintDisplay } from './HintDisplay';
import { CompletionModal } from './CompletionModal';
import { CountInAnimation } from './CountInAnimation';
import { ErrorDisplay } from './ErrorDisplay';
import { AchievementToast } from '../../components/transitions/AchievementToast';
import type { AchievementType } from '../../components/transitions/AchievementToast';
import { LessonCompleteScreen } from '../../components/transitions/LessonCompleteScreen';
import { ExerciseCard } from '../../components/transitions/ExerciseCard';
import { getTipForScore } from '../../components/Mascot/mascotTips';

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

function getFeedbackColor(type: string | null): string {
  switch (type) {
    case 'perfect': return '#00E676';
    case 'good': return '#69F0AE';
    case 'ok': return '#FFD740';
    case 'early': return '#40C4FF';
    case 'late': return '#FFAB40';
    case 'miss': return '#FF5252';
    default: return '#757575';
  }
}

function getFeedbackLabel(type: string | null): string {
  switch (type) {
    case 'perfect': return 'PERFECT!';
    case 'good': return 'GOOD!';
    case 'ok': return 'OK';
    case 'early': return 'EARLY';
    case 'late': return 'LATE';
    case 'miss': return 'MISS';
    default: return '';
  }
}

// Fallback exercise used only when no exercise can be loaded from content
const FALLBACK_EXERCISE: Exercise = {
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
  const route = useRoute<RouteProp<RootStackParamList, 'Exercise'>>();
  const mountedRef = useRef(true);
  const skipPortraitResetRef = useRef(false);
  const playbackStartTimeRef = useRef(0);

  // Store integration
  const exerciseStore = useExerciseStore();

  // Load exercise: prop > route param > store > fallback
  const loadedExercise = route.params?.exerciseId
    ? getExercise(route.params.exerciseId)
    : null;
  const exercise =
    exerciseOverride || loadedExercise || exerciseStore.currentExercise || FALLBACK_EXERCISE;

  // Derive keyboard range from exercise notes — round down to nearest C for clean octave display
  const { keyboardStartNote, keyboardOctaveCount } = useMemo(() => {
    const midiNotes = exercise.notes.map(n => n.note);
    const minNote = Math.min(...midiNotes);
    const maxNote = Math.max(...midiNotes);
    // Round down to nearest C (mod 12 == 0) with 2-note margin
    const start = Math.max(21, Math.floor((minNote - 2) / 12) * 12);
    // Round up to fill complete octaves
    const octaves = Math.max(2, Math.ceil((maxNote - start + 3) / 12));
    return { keyboardStartNote: start, keyboardOctaveCount: Math.min(4, octaves) };
  }, [exercise.notes]);

  // Track mount lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Completion state (declared before useExercisePlayback so the callback is available)
  const [showCompletion, setShowCompletion] = useState(false);
  const [finalScore, setFinalScore] = useState<ExerciseScore | null>(null);

  // Quick exercise card (between exercises in a lesson)
  const [showExerciseCard, setShowExerciseCard] = useState(false);

  // Achievement toast state
  const [toastData, setToastData] = useState<{ type: AchievementType; value: number | string } | null>(null);

  // Lesson completion celebration state
  const [showLessonComplete, setShowLessonComplete] = useState(false);
  const [lessonCompleteData, setLessonCompleteData] = useState<{
    lessonTitle: string;
    lessonNumber: number;
    exercisesCompleted: number;
    totalExercises: number;
    bestScore: number;
    xpEarned: number;
    starsEarned: number;
    maxStars: number;
    nextLessonTitle?: string;
  } | null>(null);

  /**
   * Handle exercise completion (called by useExercisePlayback hook)
   * Persists score, XP, streak, and lesson progress to the progress store
   */
  const handleExerciseCompletion = useCallback((score: ExerciseScore) => {
    if (!mountedRef.current) return;
    setFinalScore(score);
    onExerciseComplete?.(score);

    // Track whether this exercise completes the entire lesson
    let isLessonComplete = false;

    // Persist XP and daily goal progress
    const progressStore = useProgressStore.getState();
    progressStore.recordExerciseCompletion(exercise.id, score.overall, score.xpEarned);

    // Record practice time (convert elapsed ms to minutes)
    if (playbackStartTimeRef.current > 0) {
      const elapsedMinutes = (Date.now() - playbackStartTimeRef.current) / 60000;
      progressStore.recordPracticeSession(Math.max(1, Math.round(elapsedMinutes)));
    }

    // Save exercise score to lesson progress
    const exLessonId = getLessonIdForExercise(exercise.id);
    if (exLessonId) {
      const lesson = getLesson(exLessonId);
      const existingLP = progressStore.lessonProgress[exLessonId];

      // Initialize lesson progress if first attempt
      if (!existingLP) {
        progressStore.updateLessonProgress(exLessonId, {
          lessonId: exLessonId,
          status: 'in_progress',
          exerciseScores: {},
          bestScore: 0,
          totalAttempts: 0,
          totalTimeSpentSeconds: 0,
        });
      }

      // Get fresh state after potential initialization
      const currentLP = useProgressStore.getState().lessonProgress[exLessonId];
      const existingExScore = currentLP?.exerciseScores[exercise.id];
      const isNewHighScore = !existingExScore || score.overall > existingExScore.highScore;

      // Save exercise progress
      progressStore.updateExerciseProgress(exLessonId, exercise.id, {
        exerciseId: exercise.id,
        highScore: isNewHighScore ? score.overall : (existingExScore?.highScore ?? score.overall),
        stars: isNewHighScore ? score.stars : (existingExScore?.stars ?? score.stars),
        attempts: (existingExScore?.attempts ?? 0) + 1,
        lastAttemptAt: Date.now(),
        averageScore: existingExScore
          ? (existingExScore.averageScore * existingExScore.attempts + score.overall) / (existingExScore.attempts + 1)
          : score.overall,
        ...(score.isPassed ? { completedAt: existingExScore?.completedAt ?? Date.now() } : {}),
      });

      // Check if all exercises in the lesson are now completed
      if (lesson && score.isPassed) {
        const updatedLP = useProgressStore.getState().lessonProgress[exLessonId];
        const allExerciseIds = lesson.exercises.map((e) => e.id);
        const allComplete = allExerciseIds.every((eid) =>
          updatedLP?.exerciseScores[eid]?.completedAt != null
        );

        if (allComplete && updatedLP?.status !== 'completed') {
          isLessonComplete = true;
          progressStore.updateLessonProgress(exLessonId, {
            ...updatedLP!,
            status: 'completed',
            completedAt: Date.now(),
          });
          // Award lesson completion XP bonus
          progressStore.addXp(lesson.xpReward);

          // Trigger lesson completion celebration
          const totalStars = allExerciseIds.reduce((sum, eid) =>
            sum + (updatedLP?.exerciseScores[eid]?.stars ?? 0), 0);
          const bestScoreInLesson = Math.max(
            ...allExerciseIds.map((eid) => updatedLP?.exerciseScores[eid]?.highScore ?? 0)
          );
          const lessonIndex = ['lesson-01','lesson-02','lesson-03','lesson-04','lesson-05','lesson-06'].indexOf(exLessonId);
          setLessonCompleteData({
            lessonTitle: lesson.metadata.title,
            lessonNumber: lessonIndex + 1,
            exercisesCompleted: allExerciseIds.length,
            totalExercises: allExerciseIds.length,
            bestScore: bestScoreInLesson,
            xpEarned: lesson.xpReward,
            starsEarned: totalStars,
            maxStars: allExerciseIds.length * 3,
          });
        }
      }
    }

    // Update streak using XpSystem's proper streak logic (handles freezes, weekly tracking)
    const updatedStreak = calculateStreakUpdate(progressStore.streakData);
    progressStore.updateStreakData(updatedStreak);

    // Show achievement toast for XP earned
    if (score.xpEarned > 0) {
      // Check if user leveled up
      const currentLevel = useProgressStore.getState().level;
      const previousLevel = progressStore.level; // captured before we called addXp
      if (currentLevel > previousLevel) {
        setToastData({ type: 'level-up', value: `Level ${currentLevel}!` });
      } else {
        setToastData({ type: 'xp', value: score.xpEarned });
      }
    }

    // Decide which transition screen to show:
    // - Quick ExerciseCard for mid-lesson passes (fast, auto-dismisses)
    // - Full CompletionModal for failures, end-of-lesson, or lesson completion
    const exNextId = getLessonIdForExercise(exercise.id)
      ? getNextExerciseId(getLessonIdForExercise(exercise.id)!, exercise.id)
      : null;

    if (score.isPassed && exNextId && !isLessonComplete) {
      setShowExerciseCard(true);
    } else {
      setShowCompletion(true);
    }

    if (Platform.OS === 'web') {
      AccessibilityInfo.announceForAccessibility(
        `Exercise complete! Score: ${score.overall}%`
      );
    }
  }, [onExerciseComplete, exercise.id]);

  // Lock to landscape orientation on mount, restore portrait on unmount
  useEffect(() => {
    // Delay the lock slightly to let the navigation transition complete,
    // otherwise the view controller may not be ready to accept orientation changes
    const timer = setTimeout(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT)
        .catch((err) => {
          console.warn('[ExercisePlayer] LANDSCAPE_LEFT lock failed, trying LANDSCAPE:', err);
          // Fallback: try either landscape direction
          return ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        })
        .catch((err) => {
          console.warn('[ExercisePlayer] All landscape locks failed:', err);
        });
    }, 100);

    return () => {
      clearTimeout(timer);
      // Skip portrait reset when navigating to next exercise (stays landscape)
      if (skipPortraitResetRef.current) return;
      // Delay orientation reset so it doesn't race with navigation transition
      setTimeout(() => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
          .catch((err) => console.warn('[ExercisePlayer] Portrait restore failed:', err));
      }, 300);
    };
  }, []);

  // Exercise playback coordination (MIDI + Audio + Scoring)
  const {
    isPlaying,
    currentBeat,
    startPlayback,
    resumePlayback,
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

  // References
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const consumedNoteIndicesRef = useRef<Set<number>>(new Set());

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
   * Calculate expected notes for keyboard highlighting and auto-scroll focus.
   * Uses a wide window so the next note(s) to play are always highlighted.
   */
  const focusNote = useMemo(() => {
    // Find the nearest upcoming or current note to center the keyboard on
    const upcoming = exercise.notes
      .filter((note) => note.startBeat >= currentBeat - 0.5 && note.startBeat < currentBeat + 2.0)
      .sort((a, b) => a.startBeat - b.startBeat);
    return upcoming.length > 0 ? upcoming[0].note : undefined;
  }, [currentBeat, exercise.notes]);

  useEffect(() => {
    const expectedNotesSet = new Set<number>(
      exercise.notes
        .filter(
          (note) =>
            note.startBeat >= currentBeat - 0.5 &&
            note.startBeat < currentBeat + 2.0
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
    playbackStartTimeRef.current = Date.now();
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
      resumePlayback();
      setIsPaused(false);
    } else {
      pausePlayback();
      setIsPaused(true);
    }

    if (Platform.OS === 'web') {
      const message = !isPaused ? 'Paused' : 'Resumed';
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [isPaused, resumePlayback, pausePlayback]);

  /**
   * Restart exercise
   */
  const handleRestart = useCallback(() => {
    resetPlayback();
    setIsPaused(false);
    setHighlightedKeys(new Set());
    setComboCount(0);
    setFeedback({ type: null, noteIndex: -1, timestamp: 0 });
    consumedNoteIndicesRef.current.clear();

    if (Platform.OS === 'web') {
      AccessibilityInfo.announceForAccessibility('Exercise restarted');
    }
  }, [resetPlayback]);

  /**
   * Exit exercise without completing
   * Uses setTimeout to defer navigation, letting state updates settle
   */
  const handleExit = useCallback(() => {
    stopPlayback();
    exerciseStore.clearSession();
    // Small delay to let state updates settle before unmount
    setTimeout(() => {
      if (!mountedRef.current) return;
      if (onClose) {
        onClose();
      } else {
        navigation.goBack();
      }
    }, 50);
  }, [stopPlayback, exerciseStore, onClose, navigation]);

  /**
   * Handle keyboard note press
   * Always provides audio + visual feedback; scoring only during active playback.
   *
   * Uses nearest-note matching instead of a fixed time window:
   * for each key press, find the closest unconsumed note (by beat distance)
   * with matching MIDI pitch. This eliminates dead zones between notes.
   */
  const handleKeyDown = useCallback(
    (midiNote: MidiNoteEvent) => {
      // Always play the note for audio feedback (playNote handles scoring guard internally)
      handleManualNoteOn(midiNote.note, midiNote.velocity / 127);

      // Visual feedback
      setHighlightedKeys((prev) => new Set([...prev, midiNote.note]));

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Scoring feedback only during active playback
      if (!isPlaying || isPaused || !countInComplete) return;

      // Nearest-note matching: find the closest unconsumed note with matching pitch
      const MATCH_WINDOW_BEATS = 1.5; // Search within ±1.5 beats
      let bestMatch: { index: number; beatDiff: number; startBeat: number } | null = null;

      for (let i = 0; i < exercise.notes.length; i++) {
        const note = exercise.notes[i];
        if (consumedNoteIndicesRef.current.has(i)) continue; // Already matched
        if (note.note !== midiNote.note) continue; // Wrong pitch

        const beatDiff = Math.abs(currentBeat - note.startBeat);
        if (beatDiff > MATCH_WINDOW_BEATS) continue; // Too far away

        if (!bestMatch || beatDiff < bestMatch.beatDiff) {
          bestMatch = { index: i, beatDiff, startBeat: note.startBeat };
        }
      }

      if (bestMatch) {
        // Mark this note as consumed so it can't be matched again
        consumedNoteIndicesRef.current.add(bestMatch.index);

        // Calculate timing offset in milliseconds
        const beatDiffMs = bestMatch.beatDiff * (60000 / exercise.settings.tempo);

        let feedbackType: FeedbackState['type'];
        if (beatDiffMs <= exercise.scoring.timingToleranceMs * 0.5) {
          feedbackType = 'perfect';
        } else if (beatDiffMs <= exercise.scoring.timingToleranceMs) {
          feedbackType = 'good';
        } else if (beatDiffMs <= exercise.scoring.timingGracePeriodMs) {
          feedbackType = currentBeat < bestMatch.startBeat ? 'early' : 'late';
        } else {
          feedbackType = 'ok';
        }

        setComboCount((prev) => prev + 1);
        setFeedback({
          type: feedbackType,
          noteIndex: bestMatch.index,
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
      currentBeat,
      exercise.notes,
      exercise.settings.tempo,
      exercise.scoring.timingToleranceMs,
      exercise.scoring.timingGracePeriodMs,
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

  // Determine if there's a next exercise in the lesson
  const lessonId = getLessonIdForExercise(exercise.id);
  const nextExerciseId = lessonId ? getNextExerciseId(lessonId, exercise.id) : null;

  /**
   * Handle completion modal close
   * Dismiss modal first, then exit after a brief delay to avoid animation races
   */
  const handleCompletionClose = useCallback(() => {
    setShowCompletion(false);
    // If lesson was just completed, show the celebration screen before navigating away
    if (lessonCompleteData) {
      setTimeout(() => {
        if (mountedRef.current) {
          setShowLessonComplete(true);
        }
      }, 200);
    } else {
      // Brief delay so the Modal can unmount before we navigate away
      setTimeout(() => {
        if (mountedRef.current) {
          handleExit();
        }
      }, 100);
    }
  }, [handleExit, lessonCompleteData]);

  /**
   * Retry the current exercise after failing
   */
  const handleRetry = useCallback(() => {
    setShowCompletion(false);
    setFinalScore(null);
    handleRestart();
  }, [handleRestart]);

  /**
   * Navigate to the next exercise in the lesson
   */
  const handleNextExercise = useCallback(() => {
    if (!nextExerciseId) return;
    setShowCompletion(false);
    stopPlayback();
    exerciseStore.clearSession();
    // Prevent the unmount cleanup from resetting to portrait
    skipPortraitResetRef.current = true;
    // Brief delay so modal unmount and state cleanup settle
    setTimeout(() => {
      if (mountedRef.current) {
        (navigation as any).replace('Exercise', { exerciseId: nextExerciseId });
      }
    }, 100);
  }, [nextExerciseId, stopPlayback, exerciseStore, navigation]);

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

        {/* Timing feedback overlay between piano roll and keyboard */}
        {feedback.type && (
          <View style={styles.feedbackOverlay}>
            <Text
              style={[
                styles.feedbackText,
                { color: getFeedbackColor(feedback.type) },
              ]}
            >
              {getFeedbackLabel(feedback.type)}
            </Text>
            {comboCount > 2 && (
              <Text style={styles.comboOverlayText}>{comboCount}x combo</Text>
            )}
          </View>
        )}

        {/* Bottom: Full-width keyboard */}
        <View style={styles.keyboardContainer}>
          <Keyboard
            startNote={keyboardStartNote}
            octaveCount={keyboardOctaveCount}
            onNoteOn={handleKeyDown}
            onNoteOff={handleKeyUp}
            highlightedNotes={highlightedKeys}
            expectedNotes={expectedNotes}
            enabled={true}
            hapticEnabled={true}
            showLabels={true}
            scrollable={true}
            keyHeight={130}
            focusNote={focusNote}
            testID="exercise-keyboard"
          />
        </View>
      </View>

      {/* Quick exercise card (between exercises in a lesson) */}
      {showExerciseCard && finalScore && (
        <ExerciseCard
          score={finalScore.overall}
          stars={finalScore.stars}
          xpEarned={finalScore.xpEarned}
          isPassed={finalScore.isPassed}
          exerciseTitle={exercise.metadata.title}
          nextExerciseTitle={
            nextExerciseId ? getExercise(nextExerciseId)?.metadata.title : undefined
          }
          tip={getTipForScore(finalScore.overall).text}
          onNext={() => {
            setShowExerciseCard(false);
            handleNextExercise();
          }}
          onRetry={() => {
            setShowExerciseCard(false);
            handleRetry();
          }}
          autoDismissMs={5000}
        />
      )}

      {/* Achievement toast (XP, level-up) */}
      {toastData && (
        <AchievementToast
          type={toastData.type}
          value={toastData.value}
          onDismiss={() => setToastData(null)}
          autoDismissMs={3000}
        />
      )}

      {/* Lesson completion celebration (full-screen) */}
      {showLessonComplete && lessonCompleteData && (
        <LessonCompleteScreen
          {...lessonCompleteData}
          onContinue={() => {
            setShowLessonComplete(false);
            handleExit();
          }}
        />
      )}

      {/* Completion modal */}
      {showCompletion && finalScore && (
        <CompletionModal
          score={finalScore}
          exercise={exercise}
          onClose={handleCompletionClose}
          onRetry={handleRetry}
          onNextExercise={nextExerciseId ? handleNextExercise : undefined}
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
    backgroundColor: '#0D0D0D',
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 152, 0, 0.3)',
  },
  errorText: {
    color: '#FF9800',
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
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
    gap: 8,
  },
  topBarDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#333333',
  },
  pianoRollContainer: {
    flex: 1,
    margin: 4,
  },
  feedbackOverlay: {
    height: 36,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  feedbackText: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  comboOverlayText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD740',
  },
  keyboardContainer: {
    height: 140,
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    overflow: 'hidden',
  },
});

export default ExercisePlayer;
