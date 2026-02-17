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
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Keyboard } from '../../components/Keyboard/Keyboard';
import { SplitKeyboard, deriveSplitPoint } from '../../components/Keyboard/SplitKeyboard';
import { VerticalPianoRoll } from '../../components/PianoRoll/VerticalPianoRoll';
import { computeZoomedRange, computeStickyRange, type KeyboardRange } from '../../components/Keyboard/computeZoomedRange';
import { useExerciseStore } from '../../stores/exerciseStore';
import { useProgressStore } from '../../stores/progressStore';
import { useExercisePlayback } from '../../hooks/useExercisePlayback';
import { getExercise, getNextExerciseId, getLessonIdForExercise, getLesson, isTestExercise, getTestExercise, getNonTestExercises } from '../../content/ContentLoader';
import { getNextExercise as getNextAIExercise, fillBuffer, getBufferSize, BUFFER_MIN_THRESHOLD } from '../../services/exerciseBufferManager';
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
import { getFactForExerciseType } from '../../content/funFactSelector';
import type { FunFact } from '../../content/funFacts';
import { syncManager } from '../../services/firebase/syncService';
import { useAchievementStore, buildAchievementContext } from '../../stores/achievementStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLearnerProfileStore } from '../../stores/learnerProfileStore';
import { getUnlockedCats } from '../../components/Mascot/catCharacters';
import { ExerciseBuddy } from '../../components/Mascot/ExerciseBuddy';
import type { BuddyReaction } from '../../components/Mascot/ExerciseBuddy';
import { getAchievementById } from '../../core/achievements/achievements';
import type { PlaybackSpeed } from '../../stores/types';
import { useDevKeyboardMidi } from '../../input/DevKeyboardMidi';
import { DemoPlaybackService } from '../../services/demoPlayback';
import { ExerciseIntroOverlay } from './ExerciseIntroOverlay';
import { COLORS } from '../../theme/tokens';

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
  const testMode = route.params?.testMode ?? false;
  const aiMode = route.params?.aiMode ?? false;
  const mountedRef = useRef(true);
  const playbackStartTimeRef = useRef(0);

  // Store integration
  const exerciseStore = useExerciseStore();

  // AI mode: exercise loaded asynchronously from buffer
  const [aiExercise, setAiExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    if (!aiMode) return;

    let cancelled = false;

    const loadAIExercise = async () => {
      const buffered = await getNextAIExercise();

      if (cancelled) return;

      if (buffered) {
        // Convert AIExercise to Exercise
        const converted: Exercise = {
          id: `ai-${Date.now()}`,
          version: 1,
          metadata: {
            title: buffered.metadata?.title ?? 'AI Practice',
            description: 'Generated exercise targeting your weak areas',
            difficulty: (buffered.metadata?.difficulty ?? 3) as 1 | 2 | 3 | 4 | 5,
            estimatedMinutes: 2,
            skills: buffered.metadata?.skills ?? ['adaptive'],
            prerequisites: [],
          },
          settings: {
            tempo: buffered.settings.tempo,
            timeSignature: buffered.settings.timeSignature,
            keySignature: buffered.settings.keySignature ?? 'C',
            countIn: 4,
            metronomeEnabled: true,
          },
          notes: buffered.notes.map((n) => ({
            note: n.note,
            startBeat: n.startBeat,
            durationBeats: n.durationBeats,
            ...(n.hand ? { hand: n.hand as 'left' | 'right' } : {}),
          })),
          scoring: {
            timingToleranceMs: buffered.scoring?.timingToleranceMs ?? 80,
            timingGracePeriodMs: 200,
            passingScore: buffered.scoring?.passingScore ?? 60,
            starThresholds: (buffered.scoring?.starThresholds ?? [70, 85, 95]) as [number, number, number],
          },
          hints: {
            beforeStart: 'AI-generated exercise -- play along with the metronome!',
            commonMistakes: [],
            successMessage: 'Great practice!',
          },
        };
        setAiExercise(converted);
      } else {
        // Buffer empty — use a simple fallback exercise
        const profile = useLearnerProfileStore.getState();
        const difficulty = profile.totalExercisesCompleted > 20 ? 3 : profile.totalExercisesCompleted > 10 ? 2 : 1;
        const fallbackNotes = [60, 62, 64, 65, 67, 65, 64, 62];
        const weakMidi = profile.weakNotes.length > 0 ? profile.weakNotes.slice(0, 4) : [];
        const notePool = weakMidi.length >= 2 ? weakMidi : fallbackNotes;
        setAiExercise({
          id: `ai-fallback-${Date.now()}`,
          version: 1,
          metadata: {
            title: 'Quick Practice',
            description: 'Practice exercise while new content generates',
            difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
            estimatedMinutes: 2,
            skills: ['adaptive'],
            prerequisites: [],
          },
          settings: {
            tempo: Math.round((profile.tempoRange.min + profile.tempoRange.max) / 2),
            timeSignature: [4, 4],
            keySignature: 'C',
            countIn: 4,
            metronomeEnabled: true,
          },
          notes: notePool.map((note, i) => ({
            note,
            startBeat: i,
            durationBeats: 1,
            hand: 'right' as const,
          })),
          scoring: {
            timingToleranceMs: 80,
            timingGracePeriodMs: 200,
            passingScore: 60,
            starThresholds: [70, 85, 95] as [number, number, number],
          },
          hints: {
            beforeStart: 'Quick practice while new exercises generate!',
            commonMistakes: [],
            successMessage: 'Great practice!',
          },
        });
      }

      // Top up buffer in background if running low
      const bufferSize = await getBufferSize();
      if (bufferSize < BUFFER_MIN_THRESHOLD) {
        const profile = useLearnerProfileStore.getState();
        fillBuffer({
          weakNotes: profile.weakNotes,
          tempoRange: profile.tempoRange,
          difficulty: profile.totalExercisesCompleted > 20 ? 4 : profile.totalExercisesCompleted > 10 ? 3 : 2,
          noteCount: 12,
          skills: profile.skills,
        }).catch(() => {
          // Silent — buffer fill is best-effort
        });
      }
    };

    loadAIExercise();

    return () => {
      cancelled = true;
    };
  }, [aiMode]);

  // Load exercise: prop > AI mode > route param > store > fallback
  const loadedExercise = (!aiMode && route.params?.exerciseId)
    ? getExercise(route.params.exerciseId)
    : null;
  const rawExercise =
    exerciseOverride || (aiMode ? aiExercise : null) || loadedExercise || exerciseStore.currentExercise || FALLBACK_EXERCISE;

  // Speed selector — adjusts exercise tempo for more comfortable playback
  // MIDI keyboard users get 1.0x (real piano, 10 fingers), touch keyboard gets 0.75x
  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useSettingsStore((s) => s.setPlaybackSpeed);
  const lastMidiDeviceId = useSettingsStore((s) => s.lastMidiDeviceId);
  const selectedCatId = useSettingsStore((s) => s.selectedCatId);

  // Responsive layout — supports both portrait and landscape
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isPortrait = screenHeight > screenWidth;
  const keyHeight = isPortrait ? 130 : 100;
  const topBarHeight = isPortrait ? 76 : 40;

  const hasAutoSetSpeed = useRef(false);

  useEffect(() => {
    if (hasAutoSetSpeed.current) return;
    hasAutoSetSpeed.current = true;
    if (lastMidiDeviceId && playbackSpeed !== 1.0) {
      setPlaybackSpeed(1.0);
    }
  }, [lastMidiDeviceId, playbackSpeed, setPlaybackSpeed]);

  // Apply speed multiplier to create the exercise used for playback + scoring
  const exercise = useMemo(() => {
    if (playbackSpeed === 1.0) return rawExercise;
    return {
      ...rawExercise,
      settings: {
        ...rawExercise.settings,
        tempo: Math.round(rawExercise.settings.tempo * playbackSpeed),
      },
    };
  }, [rawExercise, playbackSpeed]);

  const cycleSpeed = useCallback(() => {
    const speeds: PlaybackSpeed[] = [0.5, 0.75, 1.0];
    const currentIdx = speeds.indexOf(playbackSpeed);
    const nextIdx = (currentIdx + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
  }, [playbackSpeed, setPlaybackSpeed]);

  // Dynamic zoomed range — recomputes as playback advances
  const [keyboardRange, setKeyboardRange] = useState<KeyboardRange>(() => {
    const firstNotes = exercise.notes.slice(0, 8).map(n => n.note);
    return computeZoomedRange(firstNotes);
  });

  // Auto-detect split keyboard mode for two-handed exercises
  const { keyboardMode, splitPoint } = useMemo(() => {
    // Explicit hands declaration
    if (exercise.hands === 'both') {
      return { keyboardMode: 'split' as const, splitPoint: deriveSplitPoint(exercise.notes) };
    }
    // Check if notes have both left and right hand annotations
    const hasLeft = exercise.notes.some(n => n.hand === 'left');
    const hasRight = exercise.notes.some(n => n.hand === 'right');
    if (hasLeft && hasRight) {
      return { keyboardMode: 'split' as const, splitPoint: deriveSplitPoint(exercise.notes) };
    }
    // Wide note range (>3 octaves) triggers split
    const midiNotes = exercise.notes.map(n => n.note);
    const noteRange = Math.max(...midiNotes) - Math.min(...midiNotes);
    if (noteRange > 36) {
      return { keyboardMode: 'split' as const, splitPoint: 60 };
    }
    return { keyboardMode: 'normal' as const, splitPoint: 60 };
  }, [exercise]);

  // Track mount lifecycle
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      demoServiceRef.current.stop();
    };
  }, []);

  // Completion state (declared before useExercisePlayback so the callback is available)
  const [showCompletion, setShowCompletion] = useState(false);
  const [finalScore, setFinalScore] = useState<ExerciseScore | null>(null);

  // Quick exercise card (between exercises in a lesson)
  const [showExerciseCard, setShowExerciseCard] = useState(false);
  const [exerciseCardFunFact, setExerciseCardFunFact] = useState<FunFact | null>(null);

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

    // Track consecutive fails for demo prompt
    if (score.isPassed) {
      useExerciseStore.getState().resetFailCount();
      if (ghostNotesEnabled) {
        useExerciseStore.getState().incrementGhostNotesSuccessCount();
      }
    } else {
      useExerciseStore.getState().incrementFailCount();
    }

    onExerciseComplete?.(score);

    // Track whether this exercise completes the entire lesson
    let isLessonComplete = false;
    let needsMasteryTest = false;

    // Persist XP and daily goal progress
    const progressStore = useProgressStore.getState();
    progressStore.recordExerciseCompletion(exercise.id, score.overall, score.xpEarned);

    // Record practice time (convert elapsed ms to minutes)
    if (playbackStartTimeRef.current > 0) {
      const elapsedMinutes = (Date.now() - playbackStartTimeRef.current) / 60000;
      progressStore.recordPracticeSession(Math.max(1, Math.round(elapsedMinutes)));
    }

    // Save exercise score to lesson progress and compute sync data
    const exLessonId = getLessonIdForExercise(exercise.id);
    let lessonSyncData: {
      lessonId: string;
      status: 'in_progress' | 'completed';
      completedAt?: number;
      exerciseId: string;
      exerciseScore: { highScore: number; stars: number; attempts: number; averageScore: number };
    } | undefined;

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

      const newHighScore = isNewHighScore ? score.overall : (existingExScore?.highScore ?? score.overall);
      const newStars = isNewHighScore ? score.stars : (existingExScore?.stars ?? score.stars);
      const newAttempts = (existingExScore?.attempts ?? 0) + 1;
      const newAvgScore = existingExScore
        ? (existingExScore.averageScore * existingExScore.attempts + score.overall) / newAttempts
        : score.overall;

      // Save exercise progress
      progressStore.updateExerciseProgress(exLessonId, exercise.id, {
        exerciseId: exercise.id,
        highScore: newHighScore,
        stars: newStars,
        attempts: newAttempts,
        lastAttemptAt: Date.now(),
        averageScore: newAvgScore,
        ...(score.isPassed ? { completedAt: existingExScore?.completedAt ?? Date.now() } : {}),
      });

      // Build lesson sync data (starts as in_progress, may upgrade to completed below)
      lessonSyncData = {
        lessonId: exLessonId,
        status: 'in_progress',
        exerciseId: exercise.id,
        exerciseScore: { highScore: newHighScore, stars: newStars, attempts: newAttempts, averageScore: newAvgScore },
      };

      // Check lesson completion status
      if (lesson && score.isPassed) {
        const updatedLP = useProgressStore.getState().lessonProgress[exLessonId];
        const currentIsTest = isTestExercise(exercise.id);

        if (currentIsTest) {
          // Mastery test passed → mark lesson complete
          if (updatedLP?.status !== 'completed') {
            isLessonComplete = true;
            const completedAt = Date.now();
            progressStore.updateLessonProgress(exLessonId, {
              ...updatedLP!,
              status: 'completed',
              completedAt,
            });
            progressStore.addXp(lesson.xpReward);

            lessonSyncData.status = 'completed';
            lessonSyncData.completedAt = completedAt;

            const nonTestIds = getNonTestExercises(exLessonId).map((e) => e.id);
            const totalStars = nonTestIds.reduce((sum, eid) =>
              sum + (updatedLP?.exerciseScores[eid]?.stars ?? 0), 0) + score.stars;
            const bestScoreInLesson = Math.max(
              score.overall,
              ...nonTestIds.map((eid) => updatedLP?.exerciseScores[eid]?.highScore ?? 0)
            );
            const lessonIndex = ['lesson-01','lesson-02','lesson-03','lesson-04','lesson-05','lesson-06'].indexOf(exLessonId);
            setLessonCompleteData({
              lessonTitle: lesson.metadata.title,
              lessonNumber: lessonIndex + 1,
              exercisesCompleted: nonTestIds.length + 1,
              totalExercises: nonTestIds.length + 1,
              bestScore: bestScoreInLesson,
              xpEarned: lesson.xpReward,
              starsEarned: totalStars,
              maxStars: (nonTestIds.length + 1) * 3,
            });
          }
        } else {
          // Non-test exercise: check if all non-test exercises are completed → trigger mastery test
          const nonTestExercises = lesson.exercises.filter((e) => !e.test);
          const allNonTestComplete = nonTestExercises.every((entry) =>
            updatedLP?.exerciseScores[entry.id]?.completedAt != null
          );

          if (allNonTestComplete) {
            // Check if test exercise exists and hasn't been completed yet
            const testEx = getTestExercise(exLessonId);
            if (testEx && !updatedLP?.exerciseScores[testEx.id]?.completedAt) {
              needsMasteryTest = true;
            }
          }
        }
      }
    }

    // Sync score + lesson progress to cloud (fire-and-forget, failures retry automatically)
    syncManager.syncAfterExercise(exercise.id, {
      overall: score.overall,
      accuracy: score.breakdown.accuracy,
      timing: score.breakdown.timing,
      completeness: score.breakdown.completeness,
      stars: score.stars,
      xpEarned: score.xpEarned,
    }, lessonSyncData).catch(() => {
      // Silently caught — SyncManager handles retries internally
    });

    // Feed per-note accuracy into learner profile for adaptive learning
    const noteResults = score.details
      .filter((d) => !d.isExtraNote)  // Exclude extra notes (not in exercise)
      .map((d) => ({
        midiNote: d.expected.note,
        accuracy: d.isMissedNote ? 0 : (d.isCorrectPitch ? d.timingScore / 100 : 0),
      }));

    useLearnerProfileStore.getState().recordExerciseResult({
      tempo: exercise.settings.tempo,
      score: score.overall / 100,  // Convert 0-100 to 0.0-1.0
      noteResults,
    });

    // Update streak using XpSystem's proper streak logic (handles freezes, weekly tracking)
    const updatedStreak = calculateStreakUpdate(progressStore.streakData);
    progressStore.updateStreakData(updatedStreak);

    // Track achievement stats: perfect scores, high scores, notes played
    const achievementState = useAchievementStore.getState();
    if (score.stars === 3) {
      achievementState.recordPerfectScore();
    }
    if (score.overall >= 90) {
      achievementState.recordHighScore();
    }
    // Count played notes from score details (excludes missed notes)
    const playedNoteCount = score.details.filter((d) => d.played !== null).length;
    if (playedNoteCount > 0) {
      achievementState.incrementNotesPlayed(playedNoteCount);
    }

    // Check for newly unlocked achievements
    const currentProgressState = useProgressStore.getState();
    const catsUnlocked = getUnlockedCats(currentProgressState.level).length;
    const achievementContext = buildAchievementContext(currentProgressState, catsUnlocked);
    const newAchievements = achievementState.checkAndUnlock(achievementContext);

    // Show achievement toast for XP earned
    if (newAchievements.length > 0) {
      // Show the first new achievement
      const firstAchievement = getAchievementById(newAchievements[0].id);
      if (firstAchievement) {
        setToastData({ type: 'star', value: firstAchievement.title });
      }
    } else if (score.xpEarned > 0) {
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
    // - Quick ExerciseCard for mid-lesson passes or AI mode (fast, auto-dismisses)
    // - Full CompletionModal for failures, end-of-lesson, mastery test gate, or lesson completion
    if (aiMode) {
      // AI mode: always show quick card for passes, full modal for failures
      if (score.isPassed) {
        setExerciseCardFunFact(getFactForExerciseType(exercise.metadata.skills));
        setShowExerciseCard(true);
      } else {
        setShowCompletion(true);
      }
    } else {
      const exNextId = getLessonIdForExercise(exercise.id)
        ? getNextExerciseId(getLessonIdForExercise(exercise.id)!, exercise.id)
        : null;

      if (score.isPassed && exNextId && !isLessonComplete && !needsMasteryTest) {
        // Always show a contextual fun fact between exercises
        setExerciseCardFunFact(getFactForExerciseType(exercise.metadata.skills));
        setShowExerciseCard(true);
      } else {
        // Show full CompletionModal (handles mastery test prompt, lesson complete, retry, etc.)
        setShowCompletion(true);
      }
    }

    if (Platform.OS === 'web') {
      AccessibilityInfo.announceForAccessibility(
        `Exercise complete! Score: ${score.overall}%`
      );
    }
  }, [onExerciseComplete, exercise.id]);

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
  const [showIntro, setShowIntro] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [highlightedKeys, setHighlightedKeys] = useState<Set<number>>(new Set());
  const [expectedNotes, setExpectedNotes] = useState<Set<number>>(new Set());
  // Initialize with screen-based estimates so VerticalPianoRoll renders immediately;
  // onLayout will refine these to exact container measurements.
  const [pianoRollDims, setPianoRollDims] = useState({
    width: screenWidth,
    height: Math.max(200, screenHeight - keyHeight - topBarHeight),
  });
  const ghostNotesEnabled = useExerciseStore(s => s.ghostNotesEnabled);

  // Demo mode state
  const demoServiceRef = useRef(new DemoPlaybackService());
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [demoActiveNotes, setDemoActiveNotes] = useState<Set<number>>(new Set());
  const demoWatched = useExerciseStore(s => s.demoWatched);
  const failCount = useExerciseStore(s => s.failCount);

  // Update keyboard range based on active window (every beat change)
  useEffect(() => {
    const windowNotes = exercise.notes
      .filter(n => n.startBeat >= currentBeat - 2 && n.startBeat <= currentBeat + 8)
      .map(n => n.note);

    if (windowNotes.length > 0) {
      const newRange = computeStickyRange(windowNotes, keyboardRange);
      if (newRange.startNote !== keyboardRange.startNote || newRange.octaveCount !== keyboardRange.octaveCount) {
        setKeyboardRange(newRange);
      }
    }
  }, [Math.floor(currentBeat), keyboardRange]); // Include keyboardRange to avoid stale closure

  const keyboardStartNote = keyboardRange.startNote;
  const keyboardOctaveCount = keyboardRange.octaveCount;

  // Feedback state
  const [feedback, setFeedback] = useState<FeedbackState>({
    type: null,
    noteIndex: -1,
    timestamp: 0,
  });
  const [comboCount, setComboCount] = useState(0);

  // Buddy reaction — derived from feedback type + combo
  const buddyReaction: BuddyReaction = useMemo(() => {
    if (!feedback.type) return 'idle';
    if (comboCount >= 5) return 'combo';
    if (feedback.type === 'perfect') return 'perfect';
    if (feedback.type === 'good') return 'good';
    if (feedback.type === 'miss') return 'miss';
    return 'idle';
  }, [feedback.type, comboCount]);

  // References
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const consumedNoteIndicesRef = useRef<Set<number>>(new Set());
  const noteOnTimestamps = useRef<Map<number, number>>(new Map());

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

  // Track the MIDI note of the next expected note for keyboard auto-scroll
  const [nextExpectedNote, setNextExpectedNote] = useState<number | undefined>(undefined);
  // Split-mode: per-hand focus notes for independent auto-scroll
  const [focusNoteLeft, setFocusNoteLeft] = useState<number | undefined>(undefined);
  const [focusNoteRight, setFocusNoteRight] = useState<number | undefined>(undefined);

  useEffect(() => {
    // Find the next unconsumed note(s) at the nearest upcoming beat
    const upcoming = exercise.notes
      .map((note, index) => ({ ...note, index }))
      .filter(
        (note) =>
          !consumedNoteIndicesRef.current.has(note.index) &&
          note.startBeat >= currentBeat - 0.5
      );

    if (upcoming.length === 0) {
      setExpectedNotes(new Set());
      setNextExpectedNote(undefined);
      setFocusNoteLeft(undefined);
      setFocusNoteRight(undefined);
      return;
    }

    // Find the minimum startBeat among upcoming notes
    const minBeat = Math.min(...upcoming.map((n) => n.startBeat));

    // Highlight only notes at that exact beat (handles chords naturally)
    const notesAtMinBeat = upcoming.filter((n) => n.startBeat === minBeat);

    // In testMode, suppress green highlighting but still track for auto-scroll
    setExpectedNotes(testMode ? new Set() : new Set(notesAtMinBeat.map((n) => n.note)));
    setNextExpectedNote(notesAtMinBeat[0].note);

    // Split-mode: compute per-hand focus notes
    if (keyboardMode === 'split') {
      const leftUpcoming = upcoming.filter(
        (n) => n.hand === 'left' || (!n.hand && n.note < splitPoint)
      );
      const rightUpcoming = upcoming.filter(
        (n) => n.hand === 'right' || (!n.hand && n.note >= splitPoint)
      );

      if (leftUpcoming.length > 0) {
        const minBeatL = Math.min(...leftUpcoming.map((n) => n.startBeat));
        setFocusNoteLeft(leftUpcoming.find((n) => n.startBeat === minBeatL)?.note);
      } else {
        setFocusNoteLeft(undefined);
      }

      if (rightUpcoming.length > 0) {
        const minBeatR = Math.min(...rightUpcoming.map((n) => n.startBeat));
        setFocusNoteRight(rightUpcoming.find((n) => n.startBeat === minBeatR)?.note);
      } else {
        setFocusNoteRight(undefined);
      }
    }
  }, [currentBeat, exercise.notes, testMode, keyboardMode, splitPoint]);

  // Force keyboard range update when the next expected note is outside the current range
  useEffect(() => {
    if (nextExpectedNote === undefined) return;
    const rangeMin = keyboardRange.startNote;
    const rangeMax = keyboardRange.startNote + keyboardRange.octaveCount * 12 - 1;
    if (nextExpectedNote < rangeMin || nextExpectedNote > rangeMax) {
      setKeyboardRange(computeZoomedRange([nextExpectedNote], keyboardRange.octaveCount));
    }
  }, [nextExpectedNote, keyboardRange]);

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
   * Start demo playback — pauses exercise, plays the exercise at 60% speed
   */
  const startDemo = useCallback(() => {
    // Pause current exercise if playing
    if (isPlaying) {
      pausePlayback();
      setIsPaused(true);
    }

    setIsDemoPlaying(true);
    useExerciseStore.getState().setDemoWatched(true);

    demoServiceRef.current.start(
      exercise,
      {
        playNote: (note: number, velocity: number) => {
          handleManualNoteOn(note, velocity);
          return note as any; // NoteHandle bridge
        },
        releaseNote: (handle: any) => {
          handleManualNoteOff(handle as number);
        },
      },
      0.6, // 60% speed
      (beat) => {
        // Drive the VerticalPianoRoll during demo
        useExerciseStore.getState().setCurrentBeat(beat);
      },
      (notes) => setDemoActiveNotes(notes),
      // onComplete: auto-called when demo finishes playing the exercise
      () => {
        setIsDemoPlaying(false);
        setDemoActiveNotes(new Set());
      },
    );
  }, [exercise, isPlaying, pausePlayback, handleManualNoteOn, handleManualNoteOff]);

  /**
   * Stop demo playback and reset to ready state
   */
  const stopDemo = useCallback(() => {
    demoServiceRef.current.stop();
    setIsDemoPlaying(false);
    setDemoActiveNotes(new Set());
    resetPlayback();
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
      if (isDemoPlaying) return; // No user input during demo

      // Always play the note for audio feedback (playNote handles scoring guard internally)
      handleManualNoteOn(midiNote.note, midiNote.velocity / 127);

      // Track note-on time for duration scoring
      noteOnTimestamps.current.set(midiNote.note, Date.now());

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
      isDemoPlaying,
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
      // Compute hold duration and attach to the last noteOn for this pitch
      const onTime = noteOnTimestamps.current.get(midiNote);
      if (onTime) {
        const durationMs = Date.now() - onTime;
        noteOnTimestamps.current.delete(midiNote);
        // Update the last played noteOn event for this pitch with duration
        const playedNotes = useExerciseStore.getState().playedNotes;
        for (let i = playedNotes.length - 1; i >= 0; i--) {
          if (playedNotes[i].note === midiNote && playedNotes[i].type === 'noteOn' && !playedNotes[i].durationMs) {
            playedNotes[i].durationMs = durationMs;
            break;
          }
        }
      }

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

  // Dev-mode: map laptop keyboard keys to MIDI notes for testing
  const devKeyboardCallback = useCallback(
    (note: number, velocity: number, isNoteOn: boolean) => {
      if (isNoteOn) {
        handleKeyDown({ type: 'noteOn', note, velocity, timestamp: Date.now(), channel: 0 });
      } else {
        handleKeyUp(note);
      }
    },
    [handleKeyDown, handleKeyUp]
  );
  useDevKeyboardMidi(devKeyboardCallback);

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
    // Brief delay so modal unmount and state cleanup settle
    setTimeout(() => {
      if (mountedRef.current) {
        (navigation as any).replace('Exercise', { exerciseId: nextExerciseId });
      }
    }, 100);
  }, [nextExerciseId, stopPlayback, exerciseStore, navigation]);

  /**
   * Navigate to the next AI-generated exercise (AI mode continuation)
   */
  const handleNextAIExercise = useCallback(() => {
    setShowCompletion(false);
    setShowExerciseCard(false);
    stopPlayback();
    exerciseStore.clearSession();
    setTimeout(() => {
      if (mountedRef.current) {
        (navigation as any).replace('Exercise', { exerciseId: 'ai-mode', aiMode: true });
      }
    }, 100);
  }, [stopPlayback, exerciseStore, navigation]);

  /**
   * Navigate to the mastery test for the current lesson
   */
  const handleStartTest = useCallback(() => {
    const lid = getLessonIdForExercise(exercise.id);
    if (!lid) return;
    const testEx = getTestExercise(lid);
    if (!testEx) return;

    setShowCompletion(false);
    stopPlayback();
    exerciseStore.clearSession();
    setTimeout(() => {
      if (mountedRef.current) {
        (navigation as any).replace('Exercise', { exerciseId: testEx.id, testMode: true });
      }
    }, 100);
  }, [exercise.id, stopPlayback, exerciseStore, navigation]);

  // Determine if we should show "Take Mastery Test" in CompletionModal
  const showMasteryTestButton = useMemo(() => {
    if (testMode) return false; // Already in test mode
    if (isTestExercise(exercise.id)) return false;
    const lid = getLessonIdForExercise(exercise.id);
    if (!lid) return false;
    const lesson = getLesson(lid);
    if (!lesson) return false;

    const lp = useProgressStore.getState().lessonProgress[lid];
    const nonTestExercises = lesson.exercises.filter((e) => !e.test);
    const allNonTestComplete = nonTestExercises.every((entry) =>
      lp?.exerciseScores[entry.id]?.completedAt != null
    );
    if (!allNonTestComplete) return false;

    const testEx = getTestExercise(lid);
    if (!testEx) return false;
    return !lp?.exerciseScores[testEx.id]?.completedAt;
  }, [exercise.id, testMode, finalScore]); // finalScore dep ensures recalc after score persisted

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

      {/* Demo mode banner */}
      {isDemoPlaying && (
        <View style={styles.demoBanner} testID="demo-banner">
          <Text style={styles.demoBannerText}>Watching Demo — 60% speed</Text>
          <TouchableOpacity onPress={stopDemo} style={styles.tryNowButton}>
            <Text style={styles.tryNowButtonText}>Try Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Vertical stack — top bar, piano roll, keyboard */}
      <View style={styles.mainColumn}>
        {/* Clean top bar: exit + score + play/pause only */}
        <View style={styles.topBar}>
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

          <View style={{ flex: 1 }}>
            <ScoreDisplay
              exercise={exercise}
              currentBeat={currentBeat}
              combo={comboCount}
              feedback={feedback.type}
              comboAnimValue={comboScale}
              compact
            />
          </View>

          {/* Speed pill — only shown when not 1x */}
          {playbackSpeed < 1.0 && (
            <TouchableOpacity
              onPress={cycleSpeed}
              style={[styles.speedPill, styles.speedPillActive]}
              testID="speed-selector"
            >
              <Text style={[styles.speedPillText, styles.speedPillTextActive]}>
                {`${playbackSpeed}x`}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Secondary controls — visible when not playing or paused */}
        {(!isPlaying || isPaused) && (
          <View style={styles.secondaryBar} testID="secondary-controls">
            <HintDisplay
              hints={testMode ? { beforeStart: 'Mastery test — play from memory!', commonMistakes: [], successMessage: '' } : exercise.hints}
              isPlaying={isPlaying}
              countInComplete={countInComplete}
              feedback={feedback.type}
              compact
            />

            <View style={{ flex: 1 }} />

            {/* Speed selector */}
            <TouchableOpacity
              onPress={cycleSpeed}
              style={[styles.speedPill, playbackSpeed < 1.0 && styles.speedPillActive]}
              testID="speed-selector-full"
              accessibilityLabel={`Playback speed ${playbackSpeed}x. Tap to change.`}
            >
              <Text style={[styles.speedPillText, playbackSpeed < 1.0 && styles.speedPillTextActive]}>
                {playbackSpeed === 1.0 ? '1x' : `${playbackSpeed}x`}
              </Text>
            </TouchableOpacity>

            {/* Demo button */}
            <TouchableOpacity
              onPress={isDemoPlaying ? stopDemo : startDemo}
              style={[styles.speedPill, isDemoPlaying && styles.speedPillActive]}
              testID="demo-button"
            >
              <Text style={[styles.speedPillText, isDemoPlaying && styles.speedPillTextActive]}>
                {isDemoPlaying ? 'Stop' : 'Demo'}
              </Text>
            </TouchableOpacity>

            {/* Ghost notes toggle — visible after demo watched */}
            {demoWatched && (
              <TouchableOpacity
                onPress={() => useExerciseStore.getState().setGhostNotesEnabled(!ghostNotesEnabled)}
                style={[styles.speedPill, ghostNotesEnabled && styles.speedPillActive]}
                testID="ghost-toggle"
              >
                <Text style={[styles.speedPillText, ghostNotesEnabled && styles.speedPillTextActive]}>
                  Ghost
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Center: Vertical piano roll fills remaining vertical space */}
        <View style={styles.pianoRollContainer} onLayout={(e) => {
          setPianoRollDims({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          });
        }}>
          {pianoRollDims.width > 0 && (
            <VerticalPianoRoll
              notes={exercise.notes}
              currentBeat={currentBeat}
              tempo={exercise.settings.tempo}
              timeSignature={exercise.settings.timeSignature}
              containerWidth={pianoRollDims.width}
              containerHeight={pianoRollDims.height}
              midiMin={keyboardStartNote}
              midiMax={keyboardStartNote + keyboardOctaveCount * 12}
              ghostNotes={ghostNotesEnabled ? exercise.notes : undefined}
              ghostBeatOffset={2}
              testID="exercise-piano-roll"
            />
          )}
          {/* Buddy cat companion — floating in corner */}
          {isPlaying && (
            <View style={styles.buddyOverlay}>
              <ExerciseBuddy
                catId={selectedCatId ?? 'mini-meowww'}
                reaction={buddyReaction}
                comboCount={comboCount}
              />
            </View>
          )}
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

        {/* Bottom: Full-width keyboard (split or normal) */}
        <View style={[styles.keyboardContainer, { height: keyHeight }]}>
          {keyboardMode === 'split' ? (
            <SplitKeyboard
              notes={exercise.notes}
              splitPoint={splitPoint}
              onNoteOn={handleKeyDown}
              onNoteOff={handleKeyUp}
              highlightedNotes={isDemoPlaying ? demoActiveNotes : highlightedKeys}
              expectedNotes={expectedNotes}
              enabled={true}
              hapticEnabled={true}
              showLabels={true}
              keyHeight={Math.round(keyHeight * 0.6)}
              focusNoteLeft={focusNoteLeft}
              focusNoteRight={focusNoteRight}
              testID="exercise-keyboard"
            />
          ) : (
            <Keyboard
              startNote={keyboardStartNote}
              octaveCount={keyboardOctaveCount}
              onNoteOn={handleKeyDown}
              onNoteOff={handleKeyUp}
              highlightedNotes={isDemoPlaying ? demoActiveNotes : highlightedKeys}
              expectedNotes={expectedNotes}
              enabled={true}
              hapticEnabled={true}
              showLabels={true}
              scrollable={true}
              scrollEnabled={false}
              focusNote={nextExpectedNote}
              keyHeight={keyHeight}
              testID="exercise-keyboard"
            />
          )}
        </View>
      </View>

      {/* Quick exercise card (between exercises in a lesson or AI mode) */}
      {showExerciseCard && finalScore && (
        <ExerciseCard
          score={finalScore.overall}
          stars={finalScore.stars}
          xpEarned={finalScore.xpEarned}
          isPassed={finalScore.isPassed}
          exerciseTitle={exercise.metadata.title}
          nextExerciseTitle={
            aiMode ? 'Next AI Exercise' : (nextExerciseId ? getExercise(nextExerciseId)?.metadata.title : undefined)
          }
          tip={getTipForScore(finalScore.overall).text}
          funFact={exerciseCardFunFact}
          onNext={() => {
            setShowExerciseCard(false);
            if (aiMode) {
              handleNextAIExercise();
            } else {
              handleNextExercise();
            }
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

      {/* Exercise intro overlay — shows objectives before starting */}
      {showIntro && !isPlaying && !showCompletion && !isDemoPlaying && (
        <ExerciseIntroOverlay
          exercise={exercise}
          onReady={() => {
            setShowIntro(false);
            handleStart();
          }}
          testID="exercise-intro"
        />
      )}

      {/* Completion modal */}
      {showCompletion && finalScore && (
        <CompletionModal
          score={finalScore}
          exercise={exercise}
          onClose={handleCompletionClose}
          onRetry={handleRetry}
          onNextExercise={aiMode ? handleNextAIExercise : (nextExerciseId ? handleNextExercise : undefined)}
          onStartTest={showMasteryTestButton ? handleStartTest : undefined}
          onStartDemo={failCount >= 3 && !demoWatched ? () => {
            setShowCompletion(false);
            setFinalScore(null);
            startDemo();
          } : undefined}
          isTestMode={testMode}
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
  secondaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#151515',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    gap: 8,
  },
  pianoRollContainer: {
    flex: 1,
    margin: 4,
  },
  buddyOverlay: {
    position: 'absolute',
    top: 4,
    right: 8,
    zIndex: 10,
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
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    overflow: 'hidden',
  },
  speedPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  speedPillActive: {
    backgroundColor: 'rgba(220, 20, 60, 0.15)',
    borderColor: COLORS.primary,
  },
  speedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#757575',
  },
  speedPillTextActive: {
    color: COLORS.primary,
  },
  demoBanner: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(220, 20, 60, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(220, 20, 60, 0.3)',
    gap: 12,
  },
  demoBannerText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  tryNowButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 20, 60, 0.3)',
  },
  tryNowButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default ExercisePlayer;
