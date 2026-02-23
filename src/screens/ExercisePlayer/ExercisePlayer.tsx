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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Keyboard } from '../../components/Keyboard/Keyboard';
import { SplitKeyboard, deriveSplitPoint } from '../../components/Keyboard/SplitKeyboard';
import { VerticalPianoRoll } from '../../components/PianoRoll/VerticalPianoRoll';
import { computeZoomedRange, computeStickyRange, type KeyboardRange } from '../../components/Keyboard/computeZoomedRange';
import { useExerciseStore } from '../../stores/exerciseStore';
import { useProgressStore } from '../../stores/progressStore';
import { useExercisePlayback } from '../../hooks/useExercisePlayback';
import { getExercise, getNextExerciseId, getLessonIdForExercise, getLesson, getLessons, isTestExercise, getTestExercise, getNonTestExercises } from '../../content/ContentLoader';
import { getNextExerciseForSkill, getNextExercise as getNextAIExercise, fillBuffer, fillBufferForSkills, getBufferSize, BUFFER_MIN_THRESHOLD } from '../../services/exerciseBufferManager';
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
import { EvolutionReveal } from '../../components/transitions/EvolutionReveal';
import { getTipForScore } from '../../components/Mascot/mascotTips';
import type { FunFact } from '../../content/funFacts';
import { syncManager } from '../../services/firebase/syncService';
import { useAchievementStore, buildAchievementContext } from '../../stores/achievementStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLearnerProfileStore } from '../../stores/learnerProfileStore';
import { useGemStore } from '../../stores/gemStore';
import { useCatEvolutionStore } from '../../stores/catEvolutionStore';
import { getOwnedCats, CAT_CHARACTERS } from '../../components/Mascot/catCharacters';
import { ExerciseBuddy } from '../../components/Mascot/ExerciseBuddy';
import type { BuddyReaction } from '../../components/Mascot/ExerciseBuddy';
import { getAchievementById } from '../../core/achievements/achievements';
import type { PlaybackSpeed } from '../../stores/types';
import { useDevKeyboardMidi } from '../../input/DevKeyboardMidi';
import { DemoPlaybackService } from '../../services/demoPlayback';
import { ExerciseIntroOverlay } from './ExerciseIntroOverlay';
import { ExerciseLoadingScreen } from './ExerciseLoadingScreen';
import { getSkillsForExercise, getSkillById, getGenerationHints } from '../../core/curriculum/SkillTree';
import { adjustDifficulty } from '../../core/curriculum/DifficultyEngine';
// detectWeakPatterns: kept available for future use but not imported to avoid unused-import errors
// import { detectWeakPatterns } from '../../core/curriculum/WeakSpotDetector';
import { applyAbilities, createDefaultConfig } from '../../core/abilities/AbilityEngine';
import type { ExerciseAbilityConfig } from '../../core/abilities/AbilityEngine';
import { midiToNoteName } from '../../core/music/MusicTheory';
import { COLORS } from '../../theme/tokens';
import { suggestDrill } from '../../services/FreePlayAnalyzer';
import { generateExercise as generateFreePlayExercise } from '../../services/geminiExerciseService';
import { getTemplateForSkill, getTemplateExercise } from '../../content/templateExercises';

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
    case 'perfect': return COLORS.feedbackPerfect;
    case 'good': return COLORS.feedbackGood;
    case 'ok': return COLORS.feedbackOk;
    case 'early': return COLORS.feedbackEarly;
    case 'late': return COLORS.feedbackLate;
    case 'miss': return COLORS.feedbackMiss;
    default: return COLORS.feedbackDefault;
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

function computeInitialKeyboardRange(notes: Exercise['notes']): KeyboardRange {
  if (notes.length === 0) {
    return computeZoomedRange([]);
  }

  // Use ALL exercise notes to determine the full range needed — not just the
  // first few. This ensures the keyboard covers the entire exercise from the
  // start, avoiding mid-exercise range jumps.
  const allMidi = notes.map((n) => n.note);
  const uniqueMidi = [...new Set(allMidi)];
  const minNote = Math.min(...uniqueMidi);
  const maxNote = Math.max(...uniqueMidi);
  const span = maxNote - minNote;

  // Compute optimal octave count from the actual note span.
  // Minimum 2 octaves so the target note(s) can be centered in the
  // ScrollView — with only 1 octave the first/last key is at the edge
  // and there's no scroll room to center it.
  //   span 0-11   → 2 octaves (single-note or within-octave exercises)
  //   span 12-23  → 2 octaves (notes cross one octave boundary)
  //   span 24-35  → 3 octaves (two-handed exercises)
  //   span 36+    → 4 octaves (full-range exercises)
  const neededOctaves = Math.max(2, Math.ceil((span + 1) / 12));

  return computeZoomedRange(uniqueMidi, neededOctaves);
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
  const skillIdParam = route.params?.skillId ?? null;
  const mountedRef = useRef(true);
  const playbackStartTimeRef = useRef(0);

  // Store integration
  const exerciseStore = useExerciseStore();

  // Ref for exercise to avoid stale closures in handleExerciseCompletion
  // (critical for AI mode where exercise loads asynchronously)
  const exerciseRef = useRef<Exercise>(FALLBACK_EXERCISE);

  // Loading screen state — only shown for AI-generated exercises
  const [showLoadingScreen, setShowLoadingScreen] = useState(aiMode);

  // AI mode: exercise loaded asynchronously from buffer
  const [aiExercise, setAiExercise] = useState<Exercise | null>(null);
  const freePlayContext = route.params?.freePlayContext;

  useEffect(() => {
    if (!aiMode) return;

    let cancelled = false;

    const loadAIExercise = async () => {
      // If launched from free play analysis, generate a targeted exercise
      // instead of pulling from the generic buffer
      if (freePlayContext) {
        const drillParams = suggestDrill({
          notesPlayed: freePlayContext.weakNotes.length,
          uniqueNotes: freePlayContext.weakNotes,
          detectedKey: freePlayContext.detectedKey,
          commonIntervals: [],
          suggestedDrillType: freePlayContext.suggestedDrillType,
          summary: '',
          noteCount: freePlayContext.weakNotes.length,
          uniquePitches: freePlayContext.weakNotes.length,
          durationSeconds: 0,
          notesPerSecond: 0,
          mostPlayedNote: null,
        });

        const generated = await generateFreePlayExercise(drillParams);
        if (cancelled) return;

        if (generated) {
          const keyLabel = freePlayContext.detectedKey ?? 'Practice';
          setAiExercise({
            id: `ai-freeplay-${Date.now()}`,
            version: 1,
            metadata: {
              title: `${keyLabel} Drill`,
              description: `Drill based on your free play in ${freePlayContext.detectedKey ?? 'detected key'}`,
              difficulty: (generated.metadata?.difficulty ?? 2) as 1 | 2 | 3 | 4 | 5,
              estimatedMinutes: 2,
              skills: generated.metadata?.skills ?? ['free-play'],
              prerequisites: [],
            },
            settings: {
              tempo: generated.settings.tempo,
              timeSignature: generated.settings.timeSignature,
              keySignature: generated.settings.keySignature ?? freePlayContext.detectedKey ?? 'C',
              countIn: 4,
              metronomeEnabled: true,
            },
            notes: generated.notes.map((n) => ({
              note: n.note,
              startBeat: n.startBeat,
              durationBeats: n.durationBeats,
              ...(n.hand ? { hand: n.hand as 'left' | 'right' } : {}),
            })),
            scoring: {
              timingToleranceMs: generated.scoring?.timingToleranceMs ?? 80,
              timingGracePeriodMs: 200,
              passingScore: generated.scoring?.passingScore ?? 60,
              starThresholds: (generated.scoring?.starThresholds ?? [70, 85, 95]) as [number, number, number],
            },
            hints: {
              beforeStart: `Drill targeting ${freePlayContext.detectedKey ?? 'your recent notes'} -- play along!`,
              commonMistakes: [],
              successMessage: 'Nice drill session!',
            },
          });
          return;
        }
        // If generation failed, fall through to buffer/fallback below
      }

      const buffered = skillIdParam
        ? await getNextExerciseForSkill(skillIdParam)
        : await getNextAIExercise();

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
        // Buffer empty — use offline template fallback chain
        const profile = useLearnerProfileStore.getState();

        // 1. Skill-targeted template (best match)
        if (skillIdParam) {
          const template = getTemplateForSkill(skillIdParam, profile.weakNotes);
          setAiExercise({ ...template, id: `tmpl-${skillIdParam}-${Date.now()}` });
        }
        // 2. Static exercise fallback (original JSON)
        else if (route.params?.exerciseId && route.params.exerciseId !== 'ai-mode') {
          const staticEx = getExercise(route.params.exerciseId);
          if (staticEx) {
            setAiExercise(staticEx);
          } else {
            // 3. Generic difficulty-based template
            const difficulty = (profile.totalExercisesCompleted > 20 ? 3 : profile.totalExercisesCompleted > 10 ? 2 : 1) as 1 | 2 | 3;
            setAiExercise({ ...getTemplateExercise(difficulty, profile.weakNotes), id: `tmpl-generic-${Date.now()}` });
          }
        }
        // 4. Generic difficulty-based template (no exerciseId param)
        else {
          const difficulty = (profile.totalExercisesCompleted > 20 ? 3 : profile.totalExercisesCompleted > 10 ? 2 : 1) as 1 | 2 | 3;
          setAiExercise({ ...getTemplateExercise(difficulty, profile.weakNotes), id: `tmpl-generic-${Date.now()}` });
        }
      }

      // Top up buffer in background if running low
      const bufferSize = await getBufferSize();
      if (bufferSize < BUFFER_MIN_THRESHOLD) {
        const profile = useLearnerProfileStore.getState();
        const difficulty = profile.totalExercisesCompleted > 20 ? 4 : profile.totalExercisesCompleted > 10 ? 3 : 2;
        const hints = skillIdParam ? getGenerationHints(skillIdParam) : null;
        if (skillIdParam && hints) {
          // Skill-aware fill: pre-generate for this skill
          fillBufferForSkills([{
            skillId: skillIdParam,
            params: {
              weakNotes: profile.weakNotes,
              tempoRange: profile.tempoRange,
              difficulty,
              noteCount: 12,
              skills: profile.skills,
              targetSkillId: skillIdParam,
              generationHints: hints,
            },
            count: BUFFER_MIN_THRESHOLD,
          }]).catch(() => {
            // Silent — buffer fill is best-effort
          });
        } else {
          fillBuffer({
            weakNotes: profile.weakNotes,
            tempoRange: profile.tempoRange,
            difficulty,
            noteCount: 12,
            skills: profile.skills,
          }).catch(() => {
            // Silent — buffer fill is best-effort
          });
        }
      }
    };

    // Safety timeout: if AI exercise doesn't load within 15s, fall back to template
    const loadTimeout = setTimeout(() => {
      if (cancelled) return;
      console.warn('[ExercisePlayer] AI exercise load timed out after 15s — using template fallback');
      const profile = useLearnerProfileStore.getState();
      const difficulty = (profile.totalExercisesCompleted > 20 ? 3 : profile.totalExercisesCompleted > 10 ? 2 : 1) as 1 | 2 | 3;
      setAiExercise({ ...getTemplateExercise(difficulty, profile.weakNotes), id: `tmpl-timeout-${Date.now()}` });
    }, 15000);

    loadAIExercise().finally(() => clearTimeout(loadTimeout));

    return () => {
      cancelled = true;
      clearTimeout(loadTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiMode, freePlayContext?.detectedKey]);

  // Load exercise: prop > AI mode > route param > store > fallback
  const loadedExercise = (!aiMode && route.params?.exerciseId)
    ? getExercise(route.params.exerciseId)
    : null;
  const rawExercise =
    exerciseOverride || (aiMode ? aiExercise : null) || loadedExercise || exerciseStore.currentExercise || FALLBACK_EXERCISE;

  // Exercise is ready when we have a real exercise (not the fallback)
  const exerciseReady = rawExercise !== FALLBACK_EXERCISE || !aiMode;

  // Speed selector — adjusts exercise tempo for more comfortable playback
  // MIDI keyboard users get 1.0x (real piano, 10 fingers), touch keyboard gets 0.75x
  const playbackSpeed = useSettingsStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useSettingsStore((s) => s.setPlaybackSpeed);
  const lastMidiDeviceId = useSettingsStore((s) => s.lastMidiDeviceId);
  const selectedCatId = useSettingsStore((s) => s.selectedCatId);

  // Active cat abilities — read raw data from store (NOT getActiveAbilities() which
  // returns a new array each call, causing infinite re-renders with Zustand's Object.is check)
  const evolutionAbilities = useCatEvolutionStore(
    (s) => s.evolutionData[s.selectedCatId]?.abilitiesUnlocked,
  );
  const activeAbilityIds = evolutionAbilities ?? [];
  const activeAbilities = useMemo(() => {
    const cat = CAT_CHARACTERS.find((c) => c.id === (selectedCatId ?? ''));
    if (!cat || activeAbilityIds.length === 0) return [];
    return cat.abilities.filter((a) => activeAbilityIds.includes(a.id));
  }, [selectedCatId, activeAbilityIds]);

  // Responsive layout — supports both portrait and landscape
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isPortrait = screenHeight > screenWidth;
  const singleKeyHeight = isPortrait ? 120 : 90;
  const topBarHeight = isPortrait ? 76 : 40;

  const hasAutoSetSpeed = useRef(false);

  useEffect(() => {
    if (hasAutoSetSpeed.current) return;
    hasAutoSetSpeed.current = true;
    if (lastMidiDeviceId && playbackSpeed !== 1.0) {
      setPlaybackSpeed(1.0);
    }
  }, [lastMidiDeviceId, playbackSpeed, setPlaybackSpeed]);

  // Compute ability-modified config from active abilities
  const abilityConfig = useMemo((): ExerciseAbilityConfig | null => {
    if (activeAbilityIds.length === 0) return null;
    const defaultCfg = createDefaultConfig(
      rawExercise.scoring.timingToleranceMs,
      rawExercise.scoring.timingGracePeriodMs,
      rawExercise.settings.tempo,
    );
    return applyAbilities(activeAbilityIds, defaultCfg);
  }, [activeAbilityIds, rawExercise.scoring.timingToleranceMs, rawExercise.scoring.timingGracePeriodMs, rawExercise.settings.tempo]);

  // Apply speed multiplier + ability modifiers to create the exercise used for playback + scoring
  const exercise = useMemo(() => {
    let ex = rawExercise;

    // Apply ability-based tempo reduction
    if (abilityConfig && abilityConfig.tempo !== rawExercise.settings.tempo) {
      ex = {
        ...ex,
        settings: { ...ex.settings, tempo: abilityConfig.tempo },
      };
    }

    // Apply ability-based timing window changes
    if (abilityConfig && (
      abilityConfig.timingToleranceMs !== rawExercise.scoring.timingToleranceMs ||
      abilityConfig.timingGracePeriodMs !== rawExercise.scoring.timingGracePeriodMs
    )) {
      ex = {
        ...ex,
        scoring: {
          ...ex.scoring,
          timingToleranceMs: abilityConfig.timingToleranceMs,
          timingGracePeriodMs: abilityConfig.timingGracePeriodMs,
        },
      };
    }

    // Apply playback speed
    if (playbackSpeed !== 1.0) {
      ex = {
        ...ex,
        settings: {
          ...ex.settings,
          tempo: Math.round(ex.settings.tempo * playbackSpeed),
        },
      };
    }

    return ex;
  }, [rawExercise, playbackSpeed, abilityConfig]);

  // Keep exerciseRef in sync so completion callback always has current exercise
  useEffect(() => {
    exerciseRef.current = exercise;
  }, [exercise]);

  const cycleSpeed = useCallback(() => {
    const speeds: PlaybackSpeed[] = [0.25, 0.5, 0.75, 1.0];
    const currentIdx = speeds.indexOf(playbackSpeed);
    const nextIdx = (currentIdx + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIdx]);
  }, [playbackSpeed, setPlaybackSpeed]);

  // Dynamic zoomed range — recomputes as playback advances
  const [keyboardRange, setKeyboardRange] = useState<KeyboardRange>(() => {
    return computeInitialKeyboardRange(exercise.notes);
  });

  // Reset zoom range when exercise changes so each level starts on the
  // correct octave window instead of inheriting previous-session state.
  useEffect(() => {
    setKeyboardRange(computeInitialKeyboardRange(exercise.notes));
  }, [exercise.id, exercise.notes]);

  // Auto-detect split keyboard mode for two-handed exercises
  const { keyboardMode, splitPoint } = useMemo(() => {
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

  // Quick exercise card (between exercises in a lesson) — CompletionModal
  // now handles all completion scenarios for AI coaching, but ExerciseCard
  // state is kept for the component's dismiss/retry handlers.
  const [showExerciseCard, setShowExerciseCard] = useState(false);
  const [exerciseCardFunFact] = useState<FunFact | null>(null);

  // Achievement toast state
  const [toastData, setToastData] = useState<{ type: AchievementType; value: number | string } | null>(null);

  // Gamification state — evolution reveal + gem tracking for CompletionModal
  const [evolutionRevealData, setEvolutionRevealData] = useState<{
    catId: string;
    newStage: import('../../stores/types').EvolutionStage;
  } | null>(null);
  const [gemsEarnedForModal, setGemsEarnedForModal] = useState(0);
  const [tempoChangeForModal, setTempoChangeForModal] = useState(0);
  const [sessionStartTime] = useState(() => Date.now());

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

    // Read exercise from ref to avoid stale closure in AI mode
    // (exercise loads async, but ref is always current)
    const ex = exerciseRef.current;

    // Track consecutive fails for demo prompt
    // Read ghostNotesEnabled from store directly (not from closure) to avoid stale state
    const currentGhostNotes = useExerciseStore.getState().ghostNotesEnabled;
    if (score.isPassed) {
      useExerciseStore.getState().resetFailCount();
      if (currentGhostNotes) {
        useExerciseStore.getState().incrementGhostNotesSuccessCount();
      }
    } else {
      useExerciseStore.getState().incrementFailCount();
    }

    onExerciseComplete?.(score);

    // Track lesson completion for celebration screen

    // Capture level BEFORE any XP mutations so we can detect level-ups
    const previousLevel = useProgressStore.getState().level;

    // Apply ability modifiers to score and XP
    const currentAbilityConfig = abilityConfig;
    if (currentAbilityConfig) {
      // Score boost (cap at 100)
      if (currentAbilityConfig.scoreBoostPercent > 0) {
        score.overall = Math.min(100, score.overall + currentAbilityConfig.scoreBoostPercent);
      }
      // XP multiplier
      if (currentAbilityConfig.xpMultiplier > 1) {
        score.xpEarned = Math.round(score.xpEarned * currentAbilityConfig.xpMultiplier);
      }
    }

    // Persist XP and daily goal progress
    const progressStore = useProgressStore.getState();
    progressStore.recordExerciseCompletion(ex.id, score.overall, score.xpEarned);

    // Record practice time (convert elapsed ms to minutes)
    if (playbackStartTimeRef.current > 0) {
      const elapsedMinutes = (Date.now() - playbackStartTimeRef.current) / 60000;
      progressStore.recordPracticeSession(Math.max(1, Math.round(elapsedMinutes)));
    }

    // Save exercise score to lesson progress and compute sync data
    const exLessonId = getLessonIdForExercise(ex.id);

    // Capture whether this exercise was previously completed BEFORE we update lesson progress
    // (used for first-completion gem bonus below)
    const wasPreviouslyCompleted = exLessonId
      ? progressStore.lessonProgress[exLessonId]?.exerciseScores[ex.id]?.completedAt != null
      : true; // AI exercises (no lesson) don't count for first-completion

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
      const existingExScore = currentLP?.exerciseScores[ex.id];
      const isNewHighScore = !existingExScore || score.overall > existingExScore.highScore;

      const newHighScore = isNewHighScore ? score.overall : (existingExScore?.highScore ?? score.overall);
      const newStars = isNewHighScore ? score.stars : (existingExScore?.stars ?? score.stars);
      const newAttempts = (existingExScore?.attempts ?? 0) + 1;
      const newAvgScore = existingExScore
        ? (existingExScore.averageScore * existingExScore.attempts + score.overall) / newAttempts
        : score.overall;

      // Save exercise progress
      progressStore.updateExerciseProgress(exLessonId, ex.id, {
        exerciseId: ex.id,
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
        exerciseId: ex.id,
        exerciseScore: { highScore: newHighScore, stars: newStars, attempts: newAttempts, averageScore: newAvgScore },
      };

      // Check lesson completion status
      if (lesson && score.isPassed) {
        const updatedLP = useProgressStore.getState().lessonProgress[exLessonId];
        const currentIsTest = isTestExercise(ex.id);

        if (currentIsTest) {
          // Mastery test passed → mark lesson complete
          if (updatedLP?.status !== 'completed') {
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
            const lessonIndex = getLessons().findIndex(l => l.id === exLessonId);
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
              // Mastery test available — CompletionModal will show option to take it
            }
          }
        }
      }
    }

    // Sync score + lesson progress to cloud (fire-and-forget, failures retry automatically)
    syncManager.syncAfterExercise(ex.id, {
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

    // Track recent exercise for dedup in CurriculumEngine
    useLearnerProfileStore.getState().addRecentExercise(ex.id);

    useLearnerProfileStore.getState().recordExerciseResult({
      tempo: ex.settings.tempo,
      score: score.overall / 100,  // Convert 0-100 to 0.0-1.0
      noteResults,
    });

    // Mark skills as mastered when exercise score meets the skill's mastery threshold
    let skillNodes = getSkillsForExercise(ex.id);
    // AI exercises have runtime IDs that won't match any skill's targetExerciseIds,
    // so fall back to the skillId route param (passed by CurriculumEngine / LevelMap)
    if (skillNodes.length === 0 && skillIdParam) {
      const paramSkill = getSkillById(skillIdParam);
      if (paramSkill) skillNodes = [paramSkill];
    }
    console.log('[ExercisePlayer] Skill mastery check:', {
      exerciseId: ex.id,
      skillIdParam,
      skillNodesFound: skillNodes.length,
      scoreOverall: score.overall,
      isPassed: score.isPassed,
      nodeIds: skillNodes.map(n => n.id),
    });
    for (const node of skillNodes) {
      // Record practice attempt (accumulates completionCount for multi-completion skills)
      useLearnerProfileStore.getState().recordSkillPractice(node.id, score.isPassed);
      // Direct mastery when score meets threshold
      if (score.overall / 100 >= node.masteryThreshold && score.isPassed) {
        console.log('[ExercisePlayer] Mastering skill:', node.id, `(${score.overall}% >= ${node.masteryThreshold * 100}%)`);
        useLearnerProfileStore.getState().markSkillMastered(node.id);
      }
    }

    // Adjust difficulty based on performance (DifficultyEngine owns tempo progression)
    const profileForDiff = useLearnerProfileStore.getState();
    const adjustment = adjustDifficulty(
      {
        tempoRange: profileForDiff.tempoRange,
        skills: profileForDiff.skills,
        totalExercisesCompleted: profileForDiff.totalExercisesCompleted,
      },
      score.overall
    );
    if (adjustment.tempoChange !== 0) {
      const range = profileForDiff.tempoRange;
      useLearnerProfileStore.setState({
        tempoRange: {
          min: Math.max(30, range.min + adjustment.tempoChange),
          max: Math.min(200, range.max + adjustment.tempoChange),
        },
      });
      setTempoChangeForModal(adjustment.tempoChange);
    } else {
      setTempoChangeForModal(0);
    }

    // Update streak using XpSystem's proper streak logic (handles freezes, weekly tracking)
    // Re-read from fresh state since recordExerciseCompletion may have mutated streakData
    const freshProgressStore = useProgressStore.getState();
    const updatedStreak = calculateStreakUpdate(freshProgressStore.streakData);
    freshProgressStore.updateStreakData(updatedStreak);

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
    const ownedCatIds = useCatEvolutionStore.getState().ownedCats;
    const catsUnlocked = getOwnedCats(ownedCatIds).length;
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
      // Check if user leveled up (previousLevel captured before any XP mutations)
      const currentLevel = useProgressStore.getState().level;
      if (currentLevel > previousLevel) {
        setToastData({ type: 'level-up', value: `Level ${currentLevel}!` });
      } else {
        setToastData({ type: 'xp', value: score.xpEarned });
      }
    }

    // --- Gem earning ---
    const gemStore = useGemStore.getState();

    // First-time completion bonus (captured before lesson progress update above)
    if (score.isPassed && !wasPreviouslyCompleted) {
      gemStore.earnGems(25, 'first-completion');
    }

    // Score-based gem rewards
    let gemsEarned = 0;
    if (score.overall >= 100) {
      gemsEarned = 15;
    } else if (score.overall >= 90) {
      gemsEarned = 5;
    }

    // Apply gem ability bonuses (gem_magnet chance + lucky_gems multiplier)
    if (gemsEarned > 0 && currentAbilityConfig) {
      if (currentAbilityConfig.gemBonusMultiplier > 1 && Math.random() < currentAbilityConfig.gemBonusChance) {
        gemsEarned = Math.round(gemsEarned * currentAbilityConfig.gemBonusMultiplier);
      }
    }

    if (gemsEarned > 0) {
      gemStore.earnGems(gemsEarned, gemsEarned >= 15 ? 'perfect-score' : 'high-score');
    }

    // Track total gems earned (first-completion + score-based) for CompletionModal
    let totalGemsForModal = gemsEarned;
    if (score.isPassed && !wasPreviouslyCompleted) totalGemsForModal += 25;
    setGemsEarnedForModal(totalGemsForModal);

    // --- Cat evolution XP (with evolution detection) ---
    // Use settingsStore.selectedCatId as canonical source (catEvolutionStore may be stale)
    const catEvolutionStore = useCatEvolutionStore.getState();
    const activeCatId = useSettingsStore.getState().selectedCatId || catEvolutionStore.selectedCatId;
    if (activeCatId && score.xpEarned > 0) {
      const prevStage = catEvolutionStore.evolutionData[activeCatId]?.currentStage;
      catEvolutionStore.addEvolutionXp(activeCatId, score.xpEarned);
      const newStage = useCatEvolutionStore.getState().evolutionData[activeCatId]?.currentStage;
      if (newStage && prevStage && newStage !== prevStage) {
        setEvolutionRevealData({ catId: activeCatId, newStage });
      }
    }

    // Always show full CompletionModal with AI coaching, score ring, cat dialogue.
    // CompletionModal handles all scenarios: pass, fail, retry, next exercise, lesson complete.
    setShowCompletion(true);

    if (Platform.OS === 'web') {
      AccessibilityInfo.announceForAccessibility(
        `Exercise complete! Score: ${score.overall}%`
      );
    }
  }, [onExerciseComplete, abilityConfig]);

  // Exercise playback coordination (MIDI + Audio + Scoring)
  const {
    isPlaying,
    currentBeat,
    realtimeBeatRef,
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
    height: Math.max(200, screenHeight - singleKeyHeight - topBarHeight),
  });
  const ghostNotesEnabled = useExerciseStore(s => s.ghostNotesEnabled);

  // Demo mode state
  const demoServiceRef = useRef(new DemoPlaybackService());
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [demoActiveNotes, setDemoActiveNotes] = useState<Set<number>>(new Set());
  const [demoBeat, setDemoBeat] = useState(0);
  const demoWatched = useExerciseStore(s => s.demoWatched);
  const failCount = useExerciseStore(s => s.failCount);

  // Effective beat: during demo, use demo beat; otherwise use playback hook's beat.
  // Negative beats (count-in) are passed through so VerticalPianoRoll can animate
  // the Tetris-style cascade: notes start above the visible area and fall into view.
  const rawBeat = isDemoPlaying ? demoBeat : currentBeat;
  const effectiveBeat = rawBeat;

  // Update keyboard range based on active window (sticky, low-jitter).
  // Clamp to 0 for keyboard range since exercise notes always have non-negative startBeat.
  const effectiveBeatBucket = Math.floor(Math.max(0, effectiveBeat) * 2) / 2;
  useEffect(() => {
    const windowNotes = exercise.notes
      .filter(n => n.startBeat >= effectiveBeatBucket - 2 && n.startBeat <= effectiveBeatBucket + 8)
      .map(n => n.note);

    if (windowNotes.length === 0) return;

    setKeyboardRange((prev) => {
      const next = computeStickyRange(windowNotes, prev);
      if (next.startNote === prev.startNote && next.octaveCount === prev.octaveCount) {
        return prev;
      }
      return next;
    });
  }, [exercise.id, exercise.notes, effectiveBeatBucket]);

  const keyboardStartNote = keyboardRange.startNote;
  const keyboardOctaveCount = keyboardRange.octaveCount;

  // Coaching tip for count-in based on learner weaknesses
  const coachingTip = useMemo(() => {
    const prof = useLearnerProfileStore.getState();
    const exerciseNotes = new Set(exercise.notes.map(n => n.note));
    const weakInExercise = prof.weakNotes.filter(n => exerciseNotes.has(n));
    if (weakInExercise.length > 0) {
      return `Focus on ${weakInExercise.slice(0, 2).map(midiToNoteName).join(', ')}`;
    }
    if (prof.skills.timingAccuracy < 0.6) return 'Count along with the beat';
    return exercise.hints?.beforeStart;
  }, [exercise]);

  // Skill target for the intro overlay
  const skillTarget = useMemo(() => {
    const skills = getSkillsForExercise(exercise.id);
    if (skills.length > 0) return skills[0].name;
    // AI exercises: use skillId from route params
    if (skillIdParam) {
      const paramSkill = getSkillById(skillIdParam);
      if (paramSkill) return paramSkill.name;
    }
    return undefined;
  }, [exercise.id, skillIdParam]);

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

  // Track the MIDI note of the next expected note for keyboard auto-scroll.
  // Initialize from the first note so the keyboard starts scrolled correctly.
  const [nextExpectedNote, setNextExpectedNote] = useState<number | undefined>(() => {
    if (exercise.notes.length === 0) return undefined;
    const sorted = [...exercise.notes].sort((a, b) => a.startBeat - b.startBeat);
    return sorted[0].note;
  });
  // Split-mode: per-hand focus notes for independent auto-scroll
  const [focusNoteLeft, setFocusNoteLeft] = useState<number | undefined>(() => {
    if (keyboardMode !== 'split') return undefined;
    const leftNotes = exercise.notes
      .filter(n => n.hand === 'left' || (!n.hand && n.note < splitPoint))
      .sort((a, b) => a.startBeat - b.startBeat);
    return leftNotes[0]?.note;
  });
  const [focusNoteRight, setFocusNoteRight] = useState<number | undefined>(() => {
    if (keyboardMode !== 'split') return undefined;
    const rightNotes = exercise.notes
      .filter(n => n.hand === 'right' || (!n.hand && n.note >= splitPoint))
      .sort((a, b) => a.startBeat - b.startBeat);
    return rightNotes[0]?.note;
  });

  useEffect(() => {
    // Find the next unconsumed note(s) at the nearest upcoming beat
    const upcoming = exercise.notes
      .map((note, index) => ({ ...note, index }))
      .filter(
        (note) =>
          !consumedNoteIndicesRef.current.has(note.index) &&
          note.startBeat >= effectiveBeat - 0.5
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
  }, [effectiveBeat, exercise.notes, testMode, keyboardMode, splitPoint]);

  // Force keyboard range update when the next expected note is outside the current range
  useEffect(() => {
    if (nextExpectedNote === undefined) return;

    setKeyboardRange((prev) => {
      const rangeMin = prev.startNote;
      const rangeMax = prev.startNote + prev.octaveCount * 12 - 1;
      if (nextExpectedNote >= rangeMin && nextExpectedNote <= rangeMax) {
        return prev;
      }

      // Recenter from a small upcoming window to avoid snapping to a single note
      // in the wrong octave at exercise start.
      const anchorWindowNotes = exercise.notes
        .filter((n) => n.startBeat >= effectiveBeat - 1 && n.startBeat <= effectiveBeat + 4)
        .map((n) => n.note);
      const notesForRange = anchorWindowNotes.length > 0 ? anchorWindowNotes : [nextExpectedNote];
      const next = computeZoomedRange(notesForRange, prev.octaveCount);

      if (next.startNote === prev.startNote && next.octaveCount === prev.octaveCount) {
        return prev;
      }
      return next;
    });
  }, [nextExpectedNote, effectiveBeat, exercise.notes]);

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
        // Drive the VerticalPianoRoll during demo via local state
        setDemoBeat(beat);
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

      // Visual feedback
      setHighlightedKeys((prev) => new Set([...prev, midiNote.note]));

      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // Scoring feedback only during active playback
      if (!isPlaying || isPaused || !countInComplete) return;

      // Nearest-note matching: find the closest unconsumed note with matching pitch.
      // Uses realtimeBeatRef (60fps) instead of currentBeat (throttled to 20fps)
      // for accurate timing classification.
      const realtimeBeat = realtimeBeatRef.current;
      const msPerBeat = 60000 / exercise.settings.tempo;
      const graceWindowBeats = exercise.scoring.timingGracePeriodMs / msPerBeat;
      const toleranceWindowBeats = exercise.scoring.timingToleranceMs / msPerBeat;
      const matchWindowBeats = Math.max(graceWindowBeats, toleranceWindowBeats) + 0.35;

      let bestMatch:
        | {
            index: number;
            beatDiffSigned: number;
            startBeat: number;
            matchScore: number;
          }
        | null = null;

      for (let i = 0; i < exercise.notes.length; i++) {
        const note = exercise.notes[i];
        if (consumedNoteIndicesRef.current.has(i)) continue; // Already matched
        if (note.note !== midiNote.note) continue; // Wrong pitch

        // Negative = early, positive = late.
        const beatDiffSigned = realtimeBeat - note.startBeat;
        const beatDiffAbs = Math.abs(beatDiffSigned);
        if (beatDiffAbs > matchWindowBeats) continue;

        // Small penalty for matching future notes first; this reduces
        // "skip-a-note" misses in repeated-note patterns.
        const matchScore = beatDiffAbs + (beatDiffSigned < 0 ? 0.1 : 0);

        if (
          !bestMatch ||
          matchScore < bestMatch.matchScore ||
          (matchScore === bestMatch.matchScore && note.startBeat < bestMatch.startBeat)
        ) {
          bestMatch = {
            index: i,
            beatDiffSigned,
            startBeat: note.startBeat,
            matchScore,
          };
        }
      }

      if (bestMatch) {
        // Mark this note as consumed so it can't be matched again
        consumedNoteIndicesRef.current.add(bestMatch.index);

        // Calculate timing offset in milliseconds
        const beatDiffMs = Math.abs(bestMatch.beatDiffSigned) * msPerBeat;

        let feedbackType: FeedbackState['type'];
        if (beatDiffMs <= exercise.scoring.timingToleranceMs * 0.5) {
          feedbackType = 'perfect';
        } else if (beatDiffMs <= exercise.scoring.timingToleranceMs) {
          feedbackType = 'good';
        } else if (beatDiffMs <= exercise.scoring.timingGracePeriodMs) {
          feedbackType = bestMatch.beatDiffSigned < 0 ? 'early' : 'late';
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
      realtimeBeatRef,
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
      // Release note + duration bookkeeping (handled by useExercisePlayback)
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
      // Clear after capturing — prevents duplicate celebrations
      setLessonCompleteData(null);
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
          coachingTip={coachingTip}
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
              currentBeat={effectiveBeat}
              combo={comboCount}
              feedback={feedback.type}
              comboAnimValue={comboScale}
              compact
            />
          </View>

          {/* Active ability indicators */}
          {activeAbilities.length > 0 && (
            <View style={styles.abilityRow}>
              {activeAbilities.map((a) => (
                <View key={a.id} style={styles.abilityIcon} testID={`ability-${a.id}`}>
                  <MaterialCommunityIcons
                    name={a.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                    size={14}
                    color={COLORS.evolutionGlow}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Speed pill — always visible, active styling when slowed */}
          <TouchableOpacity
            onPress={cycleSpeed}
            style={[styles.speedPill, playbackSpeed < 1.0 && styles.speedPillActive]}
            testID="speed-selector"
          >
            <Text style={[styles.speedPillText, playbackSpeed < 1.0 && styles.speedPillTextActive]}>
              {playbackSpeed === 1.0 ? '1x' : `${playbackSpeed}x`}
            </Text>
          </TouchableOpacity>
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
              currentBeat={effectiveBeat}
              tempo={exercise.settings.tempo}
              timeSignature={exercise.settings.timeSignature}
              containerWidth={pianoRollDims.width}
              containerHeight={pianoRollDims.height}
              midiMin={keyboardStartNote}
              midiMax={keyboardStartNote + keyboardOctaveCount * 12}
              ghostNotes={ghostNotesEnabled ? exercise.notes : undefined}
              ghostBeatOffset={2}
              timingGracePeriodMs={exercise.scoring.timingGracePeriodMs}
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
        <View
          style={[styles.keyboardContainer, { height: keyboardMode === 'split' ? singleKeyHeight * 2 + 4 : singleKeyHeight }]}
        >
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
              keyHeight={singleKeyHeight}
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
              keyHeight={singleKeyHeight}
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

      {/* Exercise loading screen — shows while AI exercise loads */}
      {showLoadingScreen && (
        <ExerciseLoadingScreen
          visible={showLoadingScreen}
          exerciseReady={exerciseReady}
          onReady={() => setShowLoadingScreen(false)}
        />
      )}

      {/* Exercise intro overlay — shows objectives before starting */}
      {showIntro && !isPlaying && !showCompletion && !isDemoPlaying && !showLoadingScreen && (
        <ExerciseIntroOverlay
          exercise={exercise}
          onReady={() => {
            setShowIntro(false);
            handleStart();
          }}
          skillTarget={skillTarget}
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
          onStartDemo={failCount >= (abilityConfig?.ghostNotesFailThreshold ?? 3) && !demoWatched ? () => {
            setShowCompletion(false);
            setFinalScore(null);
            startDemo();
          } : undefined}
          isTestMode={testMode}
          testID="completion-modal"
          gemsEarned={gemsEarnedForModal}
          sessionMinutes={Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000))}
          tempoChange={tempoChangeForModal}
        />
      )}

      {/* Evolution reveal overlay — shown when cat evolves from XP earned */}
      {evolutionRevealData && (
        <EvolutionReveal
          catId={evolutionRevealData.catId}
          newStage={evolutionRevealData.newStage}
          onDismiss={() => setEvolutionRevealData(null)}
        />
      )}
    </SafeAreaView>
  );
};

ExercisePlayer.displayName = 'ExercisePlayer';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 152, 0, 0.3)',
  },
  errorText: {
    color: COLORS.warning,
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
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 8,
  },
  secondaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 8,
  },
  pianoRollContainer: {
    flex: 1,
    marginTop: 4,
    marginHorizontal: 4,
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
    color: COLORS.comboGold,
  },
  keyboardContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
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
    color: COLORS.textMuted,
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
    color: COLORS.primaryLight,
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
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  // Active ability indicators
  abilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  abilityIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(225, 190, 231, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ExercisePlayer;
