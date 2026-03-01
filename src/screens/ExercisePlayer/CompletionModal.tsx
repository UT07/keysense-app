/**
 * Completion Modal Component
 * Celebration screen with timed loot reveal sequence:
 * dim -> title -> score -> stars -> record -> gems -> xp -> cat -> coaching -> actions
 *
 * Each section appears in sequence with Reanimated entering animations.
 * Set skipAnimation={true} for tests to show everything immediately.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import Reanimated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { MascotBubble } from '../../components/Mascot/MascotBubble';
import { Cat3DCanvas } from '../../components/Mascot/3d';
import { SalsaCoach } from '../../components/Mascot/SalsaCoach';
import { useCatEvolutionStore } from '../../stores/catEvolutionStore';
import { FunFactCard } from '../../components/FunFact/FunFactCard';
import { getFactForExerciseType } from '../../content/funFactSelector';
import type { MascotMood } from '../../components/Mascot/mascotTips';
import { ConfettiEffect } from '../../components/transitions/ConfettiEffect';
import { XpPopup } from '../../components/XpPopup';
import { getRandomCatMessage } from '../../content/catDialogue';
import { coachingService } from '../../services/ai/CoachingService';
import { ttsService } from '../../services/tts/TTSService';
import { useProgressStore } from '../../stores/progressStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getLessonIdForExercise } from '../../content/ContentLoader';
import { soundManager } from '../../audio/SoundManager';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, GLOW, RARITY, glowColor } from '../../theme/tokens';
import type { Exercise, ExerciseScore } from '../../core/exercises/types';
import type { ChestType } from '../../core/rewards/chestSystem';

/** Star tier colors (no token equivalent — intentional silver/bronze palette) */
const STAR_SILVER = '#C0C0C0';
const STAR_BRONZE = '#CD7F32';

// ---------------------------------------------------------------------------
// Phase system
// ---------------------------------------------------------------------------

type RevealPhase =
  | 'dim'
  | 'title'
  | 'score'
  | 'stars'
  | 'record'
  | 'gems'
  | 'xp'
  | 'cat'
  | 'coaching'
  | 'actions';

const PHASES: RevealPhase[] = [
  'dim',
  'title',
  'score',
  'stars',
  'record',
  'gems',
  'xp',
  'cat',
  'coaching',
  'actions',
];

const PHASE_TIMINGS: Record<RevealPhase, number> = {
  dim: 0,
  title: 300,
  score: 800,
  stars: 2300,
  record: 3500,
  gems: 4000,
  xp: 4800,
  cat: 5500,
  coaching: 6000,
  actions: 6500,
};

export interface CompletionModalProps {
  score: ExerciseScore;
  exercise: Exercise;
  onClose: () => void;
  onRetry?: () => void;
  onNextExercise?: () => void;
  onStartTest?: () => void;
  onStartDemo?: () => void;
  isTestMode?: boolean;
  testID?: string;
  gemsEarned?: number;
  chestType?: ChestType;
  chestGems?: number;
  sessionMinutes?: number;
  tempoChange?: number;
  skipAnimation?: boolean;
  /** Number of consecutive failures at this exercise */
  failCount?: number;
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
  score,
  exercise,
  onClose,
  onRetry,
  onNextExercise,
  onStartTest,
  onStartDemo,
  isTestMode = false,
  testID,
  gemsEarned = 0,
  chestType,
  chestGems = 0,
  sessionMinutes,
  tempoChange = 0,
  skipAnimation = false,
  failCount = 0,
}) => {
  // ---------------------------------------------------------------------------
  // Phase state
  // ---------------------------------------------------------------------------
  const [phaseIndex, setPhaseIndex] = useState(
    skipAnimation ? PHASES.length - 1 : 0
  );

  const phaseReached = useCallback(
    (phase: RevealPhase): boolean => phaseIndex >= PHASES.indexOf(phase),
    [phaseIndex],
  );

  // Schedule phase transitions via timeouts
  useEffect(() => {
    if (skipAnimation) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 1; i < PHASES.length; i++) {
      const delay = PHASE_TIMINGS[PHASES[i]];
      timers.push(
        setTimeout(() => {
          setPhaseIndex(i);
        }, delay),
      );
    }

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [skipAnimation]);

  // ---------------------------------------------------------------------------
  // Sound effects at phase boundaries
  // ---------------------------------------------------------------------------
  const playedSoundsRef = useRef<Set<RevealPhase>>(new Set());

  useEffect(() => {
    if (skipAnimation) return;

    const current = PHASES[phaseIndex];

    // Title phase -> exercise_complete sound
    if (current === 'title' && !playedSoundsRef.current.has('title')) {
      playedSoundsRef.current.add('title');
      soundManager.play('exercise_complete');
    }

    // Stars phase -> star_earn per star (staggered)
    if (current === 'stars' && !playedSoundsRef.current.has('stars')) {
      playedSoundsRef.current.add('stars');
      for (let i = 0; i < score.stars; i++) {
        setTimeout(() => {
          soundManager.play('star_earn');
        }, i * 300);
      }
    }

    // Record phase -> chest_open (if chest earned)
    if (current === 'record' && !playedSoundsRef.current.has('record')) {
      playedSoundsRef.current.add('record');
      if (chestType && chestType !== 'none') {
        soundManager.play('chest_open');
      }
    }

    // Gems phase -> gem_clink
    if (current === 'gems' && !playedSoundsRef.current.has('gems')) {
      playedSoundsRef.current.add('gems');
      if (gemsEarned > 0) {
        soundManager.play('gem_clink');
      }
    }
  }, [phaseIndex, skipAnimation, score.stars, gemsEarned, chestType]);

  // ---------------------------------------------------------------------------
  // Animation values (RN Animated for score counter)
  // ---------------------------------------------------------------------------
  const scaleAnim = useRef(new Animated.Value(skipAnimation ? 1 : 0.5)).current;
  const opacityAnim = useRef(new Animated.Value(skipAnimation ? 1 : 0)).current;
  const scoreCountAnim = useRef(new Animated.Value(0)).current;

  // Per-star animation values
  const starAnims = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(skipAnimation ? 1 : 0))
  ).current;

  // Animated score display
  const [displayScore, setDisplayScore] = useState(skipAnimation ? Math.round(score.overall) : 0);
  const [showXpPopup, setShowXpPopup] = useState(false);

  // AI Coach feedback
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(true);
  const hasAutoPlayed = useRef(false);

  // Cat dialogue & evolution
  const selectedCatId = useSettingsStore((s) => s.selectedCatId);
  const activeCatId = selectedCatId ?? 'mini-meowww';
  const evolutionStage = useCatEvolutionStore(
    (s) => s.evolutionData[activeCatId]?.currentStage ?? 'baby'
  );
  const catDialogue = useMemo(() => {
    const catId = selectedCatId ?? 'mini-meowww';
    const trigger = score.isPassed ? 'exercise_complete_pass' : 'exercise_complete_fail';
    const condition = score.stars === 3 ? 'score_high' : score.overall < 50 ? 'score_low' : undefined;
    return getRandomCatMessage(catId, trigger, condition);
  }, [selectedCatId, score]);

  useEffect(() => {
    let cancelled = false;

    const fetchFeedback = async () => {
      try {
        const { level, lessonProgress } = useProgressStore.getState();
        const exLessonId = getLessonIdForExercise(exercise.id);
        const exProgress = exLessonId
          ? lessonProgress[exLessonId]?.exerciseScores[exercise.id]
          : undefined;
        const attemptNumber = exProgress?.attempts ?? 1;
        const recentScores = exProgress?.averageScore != null ? [exProgress.averageScore] : [];
        const feedbackPromise = coachingService.generateFeedback({
          exerciseId: exercise.id,
          exerciseTitle: exercise.metadata.title,
          difficulty: exercise.metadata.difficulty,
          score,
          userLevel: level,
          attemptNumber,
          recentScores,
          sessionMinutes,
        });
        // 10s timeout — don't let a hung network block the completion screen
        const result = await Promise.race([
          feedbackPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Coach feedback timeout')), 10000)
          ),
        ]);
        if (!cancelled) setCoachFeedback(result.feedback);
      } catch {
        if (!cancelled) setCoachFeedback('Keep practicing! You are making great progress.');
      } finally {
        if (!cancelled) setCoachLoading(false);
      }
    };

    fetchFeedback();
    return () => { cancelled = true; };
  }, [exercise.id, exercise.metadata.title, exercise.metadata.difficulty, score]);

  // Auto-play coach feedback via TTS when it arrives (Salsa's voice)
  useEffect(() => {
    if (!coachFeedback || coachLoading || hasAutoPlayed.current) return;
    hasAutoPlayed.current = true;
    // Small delay to let the score animation finish
    const timer = setTimeout(() => {
      ttsService.speak(coachFeedback, { catId: 'salsa' });
    }, 800);
    return () => clearTimeout(timer);
  }, [coachFeedback, coachLoading]);

  // Main animation sequence — triggered when score phase is reached
  useEffect(() => {
    if (skipAnimation) return;

    // 1. Modal scale + fade in (at dim phase)
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Animated score counter: 0 -> final (starts at score phase time)
    const scoreListener = scoreCountAnim.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });
    Animated.timing(scoreCountAnim, {
      toValue: score.overall,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      delay: PHASE_TIMINGS.score,
      useNativeDriver: false,
    }).start();

    // 3. Stars light up one by one (300ms stagger) with haptic per star
    if (score.stars > 0) {
      for (let i = 0; i < score.stars; i++) {
        const delay = PHASE_TIMINGS.stars + i * 300;
        Animated.sequence([
          Animated.delay(delay),
          Animated.spring(starAnims[i], {
            toValue: 1,
            damping: 8,
            stiffness: 200,
            useNativeDriver: true,
          }),
        ]).start();

        // Haptic per star
        setTimeout(() => {
          Haptics.impactAsync(
            i === score.stars - 1
              ? Haptics.ImpactFeedbackStyle.Heavy
              : Haptics.ImpactFeedbackStyle.Medium
          ).catch(() => {});
        }, delay);
      }
    }

    // 4. XP popup flies up (at xp phase)
    setTimeout(() => setShowXpPopup(true), PHASE_TIMINGS.xp);

    return () => {
      scoreCountAnim.removeListener(scoreListener);
    };
  }, [score.stars, score.overall, scaleAnim, opacityAnim, scoreCountAnim, starAnims, skipAnimation]);

  // Result display
  const resultDisplay = useMemo(() => {
    if (score.stars === 3) return { text: 'Outstanding!', color: COLORS.starGold, icon: 'crown' as const };
    if (score.stars === 2) return { text: 'Great Job!', color: STAR_SILVER, icon: 'star' as const };
    if (score.stars === 1) return { text: 'Good Effort!', color: STAR_BRONZE, icon: 'star-half-full' as const };
    if (score.isPassed) return { text: 'Keep Going!', color: COLORS.success, icon: 'check-circle' as const };
    return { text: 'Try Again!', color: COLORS.error, icon: 'refresh' as const };
  }, [score.stars, score.isPassed]);

  // Mascot mood
  const mascotMood: MascotMood = useMemo(() => {
    if (score.overall >= 95) return 'celebrating';
    if (score.overall >= 80) return 'happy';
    return 'encouraging';
  }, [score.overall]);

  // Demo offer cat message (for 3+ consecutive fails)
  const demoOfferMessage = useMemo(() => {
    if (!onStartDemo) return null;
    const catId = selectedCatId ?? 'mini-meowww';
    return getRandomCatMessage(catId, 'demoOffer');
  }, [onStartDemo, selectedCatId]);

  // Fun fact
  const completionFunFact = useMemo(
    () => (score.isPassed ? getFactForExerciseType(exercise.metadata.skills) : null),
    [score.isPassed, exercise.metadata.skills]
  );

  // Score color based on value
  const scoreColor = displayScore >= 95 ? COLORS.starGold
    : displayScore >= 80 ? COLORS.success
    : displayScore >= 60 ? COLORS.warning
    : COLORS.error;

  // For skipAnimation, show XP popup immediately if earned
  useEffect(() => {
    if (skipAnimation && score.xpEarned > 0) {
      setShowXpPopup(true);
    }
  }, [skipAnimation, score.xpEarned]);

  return (
    <View style={styles.overlay} testID={testID}>
      {/* Confetti for 3-star scores */}
      {score.stars === 3 && phaseReached('stars') && <ConfettiEffect testID="completion-confetti" />}

      {/* XP Popup */}
      {showXpPopup && score.xpEarned > 0 && (
        <View style={styles.xpPopupContainer}>
          <XpPopup
            amount={score.xpEarned}
            onComplete={() => setShowXpPopup(false)}
          />
        </View>
      )}

      <ScrollView
        testID="completion-modal-scroll"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.container,
            skipAnimation
              ? undefined
              : { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* ---------------------------------------------------------------- */}
          {/* TITLE PHASE: Cat Avatar + Header                                */}
          {/* ---------------------------------------------------------------- */}
          {phaseReached('title') && (
            <Reanimated.View
              entering={skipAnimation ? undefined : FadeInDown.duration(400).springify()}
              style={styles.header}
            >
              <Cat3DCanvas
                catId={activeCatId}
                size={120}
                pose={score.overall >= 95 ? 'celebrate' : score.overall >= 80 ? 'play' : 'curious'}
                mood={mascotMood}
                evolutionStage={evolutionStage}
              />
              <Text style={styles.title}>{exercise.metadata.title}</Text>
              <Text style={styles.subtitle}>
                {isTestMode ? 'Mastery Test Complete!' : 'Exercise Complete!'}
              </Text>
            </Reanimated.View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* SCORE PHASE: Score + Stars                                       */}
          {/* ---------------------------------------------------------------- */}
          {phaseReached('score') && (
            <Reanimated.View
              entering={skipAnimation ? undefined : FadeIn.duration(400)}
              style={styles.scoreStarsRow}
            >
              {/* Animated Score Circle */}
              <View style={styles.scoreSection}>
                <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
                  <View style={styles.scoreRow}>
                    <Text style={[styles.scoreNumber, { color: scoreColor }]}>{displayScore}</Text>
                    <Text style={[styles.scorePercent, { color: scoreColor }]}>%</Text>
                  </View>
                </View>
              </View>

              {/* Stars + Result (stars animate individually via starAnims) */}
              <View style={styles.starsResultColumn}>
                {phaseReached('stars') && (
                  <>
                    <View style={styles.starsContainer}>
                      {Array.from({ length: 3 }).map((_, i) => {
                        const starScale = starAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1],
                        });
                        const isEarned = i < score.stars;
                        return (
                          <Animated.View
                            key={i}
                            style={{ transform: [{ scale: isEarned ? starScale : 1 }] }}
                          >
                            <MaterialCommunityIcons
                              name={isEarned ? 'star' : 'star-outline'}
                              size={44}
                              color={isEarned ? COLORS.starGold : COLORS.starEmpty}
                            />
                          </Animated.View>
                        );
                      })}
                    </View>

                    {/* Result message */}
                    <View style={styles.resultSection}>
                      <MaterialCommunityIcons
                        name={resultDisplay.icon as any}
                        size={22}
                        color={resultDisplay.color}
                      />
                      <Text style={[styles.resultText, { color: resultDisplay.color }]}>
                        {resultDisplay.text}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </Reanimated.View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* RECORD PHASE: New Record banner                                  */}
          {/* ---------------------------------------------------------------- */}
          {phaseReached('record') && score.isNewHighScore && (
            <Reanimated.View
              entering={skipAnimation ? undefined : FadeInUp.duration(400).springify()}
              style={styles.newRecordBanner}
            >
              <MaterialCommunityIcons name="trophy" size={24} color={COLORS.starGold} />
              <Text style={styles.newRecordText}>NEW RECORD!</Text>
              <MaterialCommunityIcons name="trophy" size={24} color={COLORS.starGold} />
            </Reanimated.View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* RECORD PHASE: Chest Reward                                      */}
          {/* ---------------------------------------------------------------- */}
          {phaseReached('record') && chestType && chestType !== 'none' && (
            <Reanimated.View
              entering={skipAnimation ? undefined : FadeInUp.delay(200).duration(400).springify()}
              style={[
                styles.chestBanner,
                {
                  borderColor: RARITY[chestType].borderColor,
                  backgroundColor: glowColor(RARITY[chestType].borderColor, 0.12),
                },
              ]}
            >
              <MaterialCommunityIcons
                name="treasure-chest"
                size={28}
                color={RARITY[chestType].borderColor}
              />
              <View style={styles.chestTextColumn}>
                <Text style={[styles.chestLabel, { color: RARITY[chestType].borderColor }]}>
                  {RARITY[chestType].label} Chest
                </Text>
                {chestGems > 0 && (
                  <Text style={styles.chestGems}>+{chestGems} bonus gems</Text>
                )}
              </View>
              <MaterialCommunityIcons
                name="diamond-stone"
                size={20}
                color={COLORS.gemGold}
              />
            </Reanimated.View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* GEMS PHASE: Score Breakdown + Stats (gems, XP, record)          */}
          {/* ---------------------------------------------------------------- */}
          {phaseReached('gems') && (
            <Reanimated.View
              entering={skipAnimation ? undefined : FadeInUp.delay(0).duration(300)}
            >
              {/* Score Breakdown */}
              <View style={styles.breakdownSection}>
                <Text style={styles.breakdownTitle}>Breakdown</Text>
                <BreakdownBar label="Accuracy" value={score.breakdown.accuracy} color={COLORS.success} skipAnimation={skipAnimation} />
                <BreakdownBar label="Timing" value={score.breakdown.timing} color={COLORS.info} skipAnimation={skipAnimation} />
                <BreakdownBar label="Completeness" value={score.breakdown.completeness} color={COLORS.warning} skipAnimation={skipAnimation} />
                <BreakdownBar label="Duration" value={score.breakdown.duration} color={COLORS.primary} skipAnimation={skipAnimation} />
                <BreakdownBar label="Extra Notes" value={score.breakdown.extraNotes} color={COLORS.textMuted} skipAnimation={skipAnimation} />
              </View>
            </Reanimated.View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* XP PHASE: XP and Stats row                                      */}
          {/* ---------------------------------------------------------------- */}
          {phaseReached('xp') && (
            <Reanimated.View
              entering={skipAnimation ? undefined : FadeInUp.duration(300)}
              style={styles.statsSection}
            >
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="lightning-bolt" size={20} color={COLORS.starGold} />
                <Text style={styles.statLabel}>XP Earned</Text>
                <Text style={styles.statValue}>+{score.xpEarned}</Text>
              </View>
              {gemsEarned > 0 && (
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="diamond-stone" size={20} color={COLORS.gemGold} />
                  <Text style={styles.statLabel}>Gems</Text>
                  <Text style={styles.statValue}>+{gemsEarned}</Text>
                </View>
              )}
              {score.isNewHighScore && (
                <View style={styles.statItem}>
                  <MaterialCommunityIcons name="trophy" size={20} color={COLORS.starGold} />
                  <Text style={styles.statLabel}>New Record!</Text>
                  <Text style={styles.statValue}>{Math.round(score.overall)}%</Text>
                </View>
              )}
            </Reanimated.View>
          )}

          {/* Difficulty adjustment indicator */}
          {phaseReached('xp') && tempoChange !== 0 && (
            <Reanimated.View
              entering={skipAnimation ? undefined : FadeIn.duration(300)}
              style={styles.tempoChangeRow}
            >
              <MaterialCommunityIcons
                name={tempoChange > 0 ? 'chevron-double-up' : 'chevron-double-down'}
                size={16}
                color={tempoChange > 0 ? COLORS.success : COLORS.warning}
              />
              <Text style={[styles.tempoChangeText, { color: tempoChange > 0 ? COLORS.success : COLORS.warning }]}>
                Tempo {tempoChange > 0 ? '+' : ''}{tempoChange} BPM for next exercises
              </Text>
            </Reanimated.View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* CAT PHASE: Cat Dialogue                                         */}
          {/* ---------------------------------------------------------------- */}
          {phaseReached('cat') && (
            <Reanimated.View
              entering={skipAnimation ? undefined : FadeInUp.duration(400)}
              style={styles.catDialogueSection}
            >
              <MascotBubble
                mood={mascotMood}
                message={catDialogue}
                size="small"
                catId={activeCatId}
              />
            </Reanimated.View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* COACHING PHASE: AI Coach Feedback + Fun Fact + Demo             */}
          {/* ---------------------------------------------------------------- */}
          {phaseReached('coaching') && (
            <Reanimated.View
              entering={skipAnimation ? undefined : FadeInUp.duration(400)}
            >
              {/* AI Coach Feedback — Salsa delivers it */}
              <View style={styles.coachSection}>
                <View style={styles.coachHeader}>
                  <SalsaCoach size="tiny" mood="teaching" />
                  <Text style={styles.coachTitle}>Salsa Says</Text>
                  {coachFeedback && !coachLoading && (
                    <TouchableOpacity
                      style={styles.speakerBtn}
                      onPress={() => {
                        ttsService.speak(coachFeedback, { catId: 'salsa' });
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons name="volume-high" size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                </View>
                {coachLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Text style={styles.coachText}>{coachFeedback}</Text>
                )}
              </View>

              {/* Fun Fact */}
              {completionFunFact && (
                <FunFactCard
                  fact={completionFunFact}
                  animationDelay={600}
                  compact
                  testID="completion-fun-fact"
                />
              )}

              {/* Demo offer prompt (3+ fails, demo not yet watched) */}
              {demoOfferMessage && onStartDemo && (
                <View style={styles.demoPrompt} testID="demo-prompt">
                  <Text style={styles.demoPromptText}>{demoOfferMessage}</Text>
                  <TouchableOpacity onPress={onStartDemo} style={styles.demoPromptButton} testID="demo-prompt-button">
                    <Text style={styles.demoPromptButtonText}>Watch Demo</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Practice strategy card — shown after 2+ consecutive failures */}
              {!score.isPassed && failCount >= 2 && (
                <PracticeStrategyCard score={score} exercise={exercise} />
              )}
            </Reanimated.View>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* ACTIONS PHASE: Action Buttons                                   */}
          {/* ---------------------------------------------------------------- */}
          {phaseReached('actions') && (
            <Reanimated.View
              entering={skipAnimation ? undefined : FadeInUp.duration(400)}
              style={styles.actions}
            >
              {onStartTest && score.isPassed && (
                <Button
                  title="Take Mastery Test"
                  onPress={onStartTest}
                  variant="primary"
                  size="large"
                  icon={<MaterialCommunityIcons name="trophy-outline" size={20} color={COLORS.textPrimary} />}
                  testID="completion-start-test"
                />
              )}
              {onNextExercise && score.isPassed && !onStartTest && (
                <Button
                  title="Next Exercise"
                  onPress={onNextExercise}
                  variant="primary"
                  size="large"
                  icon={<MaterialCommunityIcons name="arrow-right" size={20} color={COLORS.textPrimary} />}
                  testID="completion-next"
                />
              )}
              {!score.isPassed && onRetry && (
                <Button
                  title={isTestMode ? 'Retry Test' : 'Try Again'}
                  onPress={onRetry}
                  variant="primary"
                  size="large"
                  icon={<MaterialCommunityIcons name="refresh" size={20} color={COLORS.textPrimary} />}
                  testID="completion-retry"
                />
              )}
              {!(isTestMode && !score.isPassed) && (
                <Button
                  title={score.isPassed && (onNextExercise || onStartTest) ? 'Back to Lessons' : (score.isPassed ? 'Continue' : 'Back to Lessons')}
                  onPress={onClose}
                  variant={score.isPassed && (onNextExercise || onStartTest) ? 'secondary' : (!score.isPassed ? 'secondary' : 'primary')}
                  size="large"
                  icon={<MaterialCommunityIcons name={score.isPassed && !onNextExercise && !onStartTest ? 'check' : 'arrow-left'} size={20} color={score.isPassed && !onNextExercise && !onStartTest ? COLORS.textPrimary : COLORS.textMuted} />}
                  testID="completion-continue"
                />
              )}
            </Reanimated.View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
};

/** Practice strategy card — shows specific advice based on score breakdown */
function PracticeStrategyCard({ score, exercise }: { score: ExerciseScore; exercise: Exercise }) {
  // Determine the weakest area and give targeted advice
  const strategy = useMemo(() => {
    const { breakdown } = score;
    const weakest = Object.entries(breakdown)
      .filter(([key]) => key !== 'extraNotes')
      .sort(([, a], [, b]) => a - b)[0];

    // Check if any commonMistakes match
    const matchingMistake = exercise.hints?.commonMistakes?.find((m) => {
      if (m.triggerCondition?.type === 'timing' && breakdown.timing < 60) return true;
      if (m.triggerCondition?.type === 'pitch' && breakdown.accuracy < 60) return true;
      return false;
    });

    if (matchingMistake) {
      return {
        title: 'Practice Tip',
        advice: matchingMistake.advice,
        icon: 'lightbulb-on' as const,
      };
    }

    switch (weakest?.[0]) {
      case 'timing':
        return {
          title: 'Timing Strategy',
          advice: 'Try playing at a slower tempo first. Once you can play it perfectly at 50% speed, gradually increase. Count "1-2-3-4" out loud with the metronome to build internal rhythm.',
          icon: 'metronome' as const,
        };
      case 'accuracy':
        return {
          title: 'Note Accuracy Strategy',
          advice: 'Watch the demo to see which keys to press, then try playing just the first few notes until they feel natural. Add more notes one at a time rather than playing the whole exercise.',
          icon: 'bullseye-arrow' as const,
        };
      case 'completeness':
        return {
          title: 'Completeness Strategy',
          advice: 'Some notes are being missed. Focus on following the falling notes in the piano roll — play each note as it crosses the line, even if your timing isn\'t perfect yet.',
          icon: 'checkbox-marked-circle-outline' as const,
        };
      case 'duration':
        return {
          title: 'Note Length Strategy',
          advice: 'Hold each key down for the full length shown in the piano roll. Short taps give less points — try to sustain notes until the next one arrives.',
          icon: 'arrow-expand-horizontal' as const,
        };
      default:
        return {
          title: 'Practice Strategy',
          advice: 'Break the exercise into smaller sections. Master the first few notes before trying the whole thing. Slow, accurate practice builds speed faster than rushing.',
          icon: 'puzzle' as const,
        };
    }
  }, [score, exercise]);

  return (
    <View style={styles.practiceStrategy} testID="practice-strategy">
      <View style={styles.practiceStrategyHeader}>
        <MaterialCommunityIcons name={strategy.icon} size={18} color={COLORS.warning} />
        <Text style={styles.practiceStrategyTitle}>{strategy.title}</Text>
      </View>
      <Text style={styles.practiceStrategyText}>{strategy.advice}</Text>
    </View>
  );
}

/** Animated breakdown bar */
function BreakdownBar({ label, value, color, skipAnimation = false }: { label: string; value: number; color: string; skipAnimation?: boolean }) {
  const widthAnim = useRef(new Animated.Value(skipAnimation ? Math.round(value) : 0)).current;

  useEffect(() => {
    if (skipAnimation) return;
    Animated.timing(widthAnim, {
      toValue: Math.round(value),
      duration: 800,
      delay: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, widthAnim, skipAnimation]);

  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <View style={styles.breakdownBar}>
        <Animated.View
          style={[
            styles.breakdownFill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={styles.breakdownValue}>{Math.round(value)}%</Text>
    </View>
  );
}

CompletionModal.displayName = 'CompletionModal';

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surfaceOverlay,
    zIndex: 1000,
  },
  xpPopupContainer: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    zIndex: 1001,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md - 4,
    ...SHADOWS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  header: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  title: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
  },
  subtitle: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
  },
  scoreStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  scoreSection: {
    alignItems: 'center',
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreNumber: {
    ...TYPOGRAPHY.display.lg,
  },
  scorePercent: {
    ...TYPOGRAPHY.heading.sm,
    marginLeft: 1,
  },
  starsResultColumn: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  resultSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultText: {
    ...TYPOGRAPHY.heading.md,
    fontWeight: '700',
  },
  newRecordBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: glowColor(COLORS.starGold, 0.15),
    borderRadius: BORDER_RADIUS.md,
  },
  newRecordText: {
    ...TYPOGRAPHY.heading.md,
    fontWeight: '800',
    color: COLORS.starGold,
    letterSpacing: 2,
  },
  chestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  chestTextColumn: {
    flex: 1,
    gap: 2,
  },
  chestLabel: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '700',
  },
  chestGems: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600',
    color: COLORS.gemGold,
  },
  breakdownSection: {
    gap: SPACING.sm,
    backgroundColor: COLORS.cardSurface,
    paddingHorizontal: SPACING.md - 4,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  breakdownTitle: {
    ...TYPOGRAPHY.body.sm,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  breakdownLabel: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 90,
  },
  breakdownBar: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.cardBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownValue: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '700',
    color: COLORS.textSecondary,
    width: 36,
    textAlign: 'right',
  },
  statsSection: {
    flexDirection: 'row',
    gap: SPACING.md - 4,
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md - 4,
    paddingVertical: 6,
    backgroundColor: glowColor(COLORS.primary, 0.08),
    borderRadius: BORDER_RADIUS.sm,
    flex: 1,
  },
  statLabel: {
    ...TYPOGRAPHY.caption.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statValue: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '700',
    color: COLORS.starGold,
  },
  tempoChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  tempoChangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  catDialogueSection: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  coachSection: {
    backgroundColor: glowColor(COLORS.primary, 0.1),
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md - 2,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: glowColor(COLORS.primary, 0.2),
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  coachTitle: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '700',
    color: COLORS.textSecondary,
    flex: 1,
  },
  speakerBtn: {
    padding: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: glowColor(COLORS.primary, 0.15),
  },
  coachText: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.textPrimary,
  },
  actions: {
    gap: SPACING.sm,
  },
  demoPrompt: {
    backgroundColor: glowColor(COLORS.primary, 0.1),
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md - 2,
    paddingVertical: SPACING.md - 4,
    gap: SPACING.sm + 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: glowColor(COLORS.primary, 0.2),
  },
  demoPromptText: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.primaryLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  demoPromptButton: {
    paddingHorizontal: SPACING.lg - 4,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: GLOW.crimson,
  },
  demoPromptButtonText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  // Practice strategy
  practiceStrategy: {
    backgroundColor: glowColor(COLORS.warning, 0.1),
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
    marginTop: SPACING.sm,
  },
  practiceStrategyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  practiceStrategyTitle: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '700',
    color: COLORS.warning,
  },
  practiceStrategyText: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default CompletionModal;
