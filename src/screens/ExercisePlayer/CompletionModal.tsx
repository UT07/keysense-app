/**
 * Completion Modal Component
 * Celebration screen with animated score counter, star stagger with haptics,
 * confetti burst, cat dialogue, and AI coach feedback
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
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
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { MascotBubble } from '../../components/Mascot/MascotBubble';
import { CatAvatar } from '../../components/Mascot/CatAvatar';
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
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, GLOW, glowColor } from '../../theme/tokens';
import type { Exercise, ExerciseScore } from '../../core/exercises/types';

/** Star tier colors (no token equivalent — intentional silver/bronze palette) */
const STAR_SILVER = '#C0C0C0';
const STAR_BRONZE = '#CD7F32';

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
  sessionMinutes?: number;
  tempoChange?: number;
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
  sessionMinutes,
  tempoChange = 0,
}) => {
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scoreCountAnim = useRef(new Animated.Value(0)).current;

  // Per-star animation values
  const starAnims = useRef(
    Array.from({ length: 3 }, () => new Animated.Value(0))
  ).current;

  // Animated score display
  const [displayScore, setDisplayScore] = useState(0);
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

  // Main animation sequence
  useEffect(() => {
    // 1. Modal scale + fade in
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

    // 2. Animated score counter: 0 → final (1s)
    const scoreListener = scoreCountAnim.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });
    Animated.timing(scoreCountAnim, {
      toValue: score.overall,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      delay: 300,
      useNativeDriver: false,
    }).start();

    // 3. Stars light up one by one (300ms stagger) with haptic per star
    if (score.stars > 0) {
      for (let i = 0; i < score.stars; i++) {
        const delay = 800 + i * 300;
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

    // 4. XP popup flies up
    setTimeout(() => setShowXpPopup(true), 1200 + score.stars * 300);

    return () => {
      scoreCountAnim.removeListener(scoreListener);
    };
  }, [score.stars, score.overall, scaleAnim, opacityAnim, scoreCountAnim, starAnims]);

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

  return (
    <View style={styles.overlay} testID={testID}>
      {/* Confetti for 3-star scores */}
      {score.stars === 3 && <ConfettiEffect testID="completion-confetti" />}

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
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* Cat Avatar + Header */}
          <View style={styles.header}>
            <CatAvatar
              catId={activeCatId}
              size="large"
              mood={mascotMood}
              showGlow={score.stars >= 2}
              evolutionStage={evolutionStage}
            />
            <Text style={styles.title}>{exercise.metadata.title}</Text>
            <Text style={styles.subtitle}>
              {isTestMode ? 'Mastery Test Complete!' : 'Exercise Complete!'}
            </Text>
          </View>

          {/* Score + Stars */}
          <View style={styles.scoreStarsRow}>
            {/* Animated Score Circle */}
            <View style={styles.scoreSection}>
              <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreNumber, { color: scoreColor }]}>{displayScore}</Text>
                  <Text style={[styles.scorePercent, { color: scoreColor }]}>%</Text>
                </View>
              </View>
            </View>

            {/* Stars + Result */}
            <View style={styles.starsResultColumn}>
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
            </View>
          </View>

          {/* Score Breakdown */}
          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownTitle}>Breakdown</Text>
            <BreakdownBar label="Accuracy" value={score.breakdown.accuracy} color={COLORS.success} />
            <BreakdownBar label="Timing" value={score.breakdown.timing} color={COLORS.info} />
            <BreakdownBar label="Completeness" value={score.breakdown.completeness} color={COLORS.warning} />
            <BreakdownBar label="Duration" value={score.breakdown.duration} color={COLORS.primary} />
            <BreakdownBar label="Extra Notes" value={score.breakdown.extraNotes} color={COLORS.textMuted} />
          </View>

          {/* XP and Stats */}
          <View style={styles.statsSection}>
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
          </View>

          {/* Difficulty adjustment indicator */}
          {tempoChange !== 0 && (
            <View style={styles.tempoChangeRow}>
              <MaterialCommunityIcons
                name={tempoChange > 0 ? 'chevron-double-up' : 'chevron-double-down'}
                size={16}
                color={tempoChange > 0 ? COLORS.success : COLORS.warning}
              />
              <Text style={[styles.tempoChangeText, { color: tempoChange > 0 ? COLORS.success : COLORS.warning }]}>
                Tempo {tempoChange > 0 ? '+' : ''}{tempoChange} BPM for next exercises
              </Text>
            </View>
          )}

          {/* Cat Dialogue (replaces generic tips) */}
          <View style={styles.catDialogueSection}>
            <MascotBubble
              mood={mascotMood}
              message={catDialogue}
              size="small"
              catId={activeCatId}
            />
          </View>

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

          {/* Action Buttons */}
          <View style={styles.actions}>
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
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

/** Animated breakdown bar */
function BreakdownBar({ label, value, color }: { label: string; value: number; color: string }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.round(value),
      duration: 800,
      delay: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, widthAnim]);

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
});

export default CompletionModal;
