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
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { MascotBubble } from '../../components/Mascot/MascotBubble';
import { FunFactCard } from '../../components/FunFact/FunFactCard';
import { getFactForExerciseType } from '../../content/funFactSelector';
import type { MascotMood } from '../../components/Mascot/mascotTips';
import { ConfettiEffect } from '../../components/transitions/ConfettiEffect';
import { XpPopup } from '../../components/XpPopup';
import { getRandomCatMessage } from '../../content/catDialogue';
import { coachingService } from '../../services/ai/CoachingService';
import { useProgressStore } from '../../stores/progressStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme/tokens';
import type { Exercise, ExerciseScore } from '../../core/exercises/types';

export interface CompletionModalProps {
  score: ExerciseScore;
  exercise: Exercise;
  onClose: () => void;
  onRetry?: () => void;
  onNextExercise?: () => void;
  onStartTest?: () => void;
  isTestMode?: boolean;
  testID?: string;
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
  score,
  exercise,
  onClose,
  onRetry,
  onNextExercise,
  onStartTest,
  isTestMode = false,
  testID,
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

  // Cat dialogue
  const selectedCatId = useSettingsStore((s) => s.selectedCatId);
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
        const { level } = useProgressStore.getState();
        const result = await coachingService.generateFeedback({
          exerciseId: exercise.id,
          exerciseTitle: exercise.metadata.title,
          difficulty: exercise.metadata.difficulty,
          score,
          userLevel: level,
          attemptNumber: 1,
          recentScores: [],
        });
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
    if (score.stars === 2) return { text: 'Great Job!', color: '#C0C0C0', icon: 'star' as const };
    if (score.stars === 1) return { text: 'Good Effort!', color: '#CD7F32', icon: 'star-half-full' as const };
    if (score.isPassed) return { text: 'Keep Going!', color: COLORS.success, icon: 'check-circle' as const };
    return { text: 'Try Again!', color: COLORS.error, icon: 'refresh' as const };
  }, [score.stars, score.isPassed]);

  // Mascot mood
  const mascotMood: MascotMood = useMemo(() => {
    if (score.overall >= 95) return 'celebrating';
    if (score.overall >= 80) return 'happy';
    return 'encouraging';
  }, [score.overall]);

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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.container,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
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
                        size={38}
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
          </View>

          {/* XP and Stats */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="lightning-bolt" size={20} color={COLORS.starGold} />
              <Text style={styles.statLabel}>XP Earned</Text>
              <Text style={styles.statValue}>+{score.xpEarned}</Text>
            </View>
            {score.isNewHighScore && (
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="trophy" size={20} color={COLORS.starGold} />
                <Text style={styles.statLabel}>New Record!</Text>
                <Text style={styles.statValue}>{Math.round(score.overall)}%</Text>
              </View>
            )}
          </View>

          {/* Cat Dialogue (replaces generic tips) */}
          <View style={styles.catDialogueSection}>
            <MascotBubble
              mood={mascotMood}
              message={catDialogue}
              size="small"
            />
          </View>

          {/* AI Coach Feedback */}
          <View style={styles.coachSection}>
            <View style={styles.coachHeader}>
              <MaterialCommunityIcons name="robot-outline" size={18} color="#7C4DFF" />
              <Text style={styles.coachTitle}>Coach Feedback</Text>
            </View>
            {coachLoading ? (
              <ActivityIndicator size="small" color="#7C4DFF" />
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

          {/* Action Buttons */}
          <View style={styles.actions}>
            {onStartTest && score.isPassed && (
              <Button
                title="Take Mastery Test"
                onPress={onStartTest}
                variant="primary"
                size="large"
                icon={<MaterialCommunityIcons name="trophy-outline" size={20} color="#FFF" />}
                testID="completion-start-test"
              />
            )}
            {onNextExercise && score.isPassed && !onStartTest && (
              <Button
                title="Next Exercise"
                onPress={onNextExercise}
                variant="primary"
                size="large"
                icon={<MaterialCommunityIcons name="arrow-right" size={20} color="#FFF" />}
                testID="completion-next"
              />
            )}
            {!score.isPassed && onRetry && (
              <Button
                title={isTestMode ? 'Retry Test' : 'Try Again'}
                onPress={onRetry}
                variant="primary"
                size="large"
                icon={<MaterialCommunityIcons name="refresh" size={20} color="#FFF" />}
                testID="completion-retry"
              />
            )}
            {!(isTestMode && !score.isPassed) && (
              <Button
                title={score.isPassed && (onNextExercise || onStartTest) ? 'Back to Lessons' : (score.isPassed ? 'Continue' : 'Back to Lessons')}
                onPress={onClose}
                variant={score.isPassed && (onNextExercise || onStartTest) ? 'secondary' : (!score.isPassed ? 'secondary' : 'primary')}
                size="large"
                icon={<MaterialCommunityIcons name={score.isPassed && !onNextExercise && !onStartTest ? 'check' : 'arrow-left'} size={20} color={score.isPassed && !onNextExercise && !onStartTest ? '#FFF' : '#666'} />}
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  scoreStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
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
    fontSize: 36,
    fontWeight: '800',
  },
  scorePercent: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 1,
  },
  starsResultColumn: {
    alignItems: 'center',
    gap: 8,
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
    fontSize: 18,
    fontWeight: '700',
  },
  breakdownSection: {
    gap: 8,
    backgroundColor: COLORS.cardSurface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.sm,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
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
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '700',
    width: 36,
    textAlign: 'right',
  },
  statsSection: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(220, 20, 60, 0.08)',
    borderRadius: BORDER_RADIUS.sm,
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.starGold,
  },
  catDialogueSection: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  coachSection: {
    backgroundColor: 'rgba(124, 77, 255, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(124, 77, 255, 0.15)',
  },
  coachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coachTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B39DDB',
  },
  coachText: {
    fontSize: 13,
    color: '#D1C4E9',
    lineHeight: 18,
  },
  actions: {
    gap: 8,
  },
});

export default CompletionModal;
