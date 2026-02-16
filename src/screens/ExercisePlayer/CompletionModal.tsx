/**
 * Completion Modal Component
 * Results screen shown after exercise completion
 * Displays score, stars, breakdown, and celebration
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
import { getTipForScore } from '../../components/Mascot/mascotTips';
import type { MascotMood } from '../../components/Mascot/mascotTips';
import { ConfettiEffect } from '../../components/transitions/ConfettiEffect';
import { coachingService } from '../../services/ai/CoachingService';
import { useProgressStore } from '../../stores/progressStore';
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

/**
 * CompletionModal - Results celebration screen
 * Shows final score, star rating, and detailed breakdown
 */
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
  const starsAnimValue = useRef(new Animated.Value(0)).current;

  // AI Coach feedback
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);
  const [coachLoading, setCoachLoading] = useState(true);

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
        if (!cancelled) {
          setCoachFeedback(result.feedback);
        }
      } catch {
        if (!cancelled) {
          setCoachFeedback('Keep practicing! You are making great progress.');
        }
      } finally {
        if (!cancelled) {
          setCoachLoading(false);
        }
      }
    };

    fetchFeedback();
    return () => {
      cancelled = true;
    };
  }, [exercise.id, exercise.metadata.title, exercise.metadata.difficulty, score]);

  // Trigger animations on mount
  useEffect(() => {
    // Scale and fade animation
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

    // Stars animation (delayed)
    if (score.stars > 0) {
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(starsAnimValue, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]).start();

      // Haptic feedback for each star
      setTimeout(() => {
        for (let i = 0; i < score.stars; i++) {
          setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(
              () => {}
            );
          }, i * 200);
        }
      }, 200);
    }
  }, [score.stars, scaleAnim, opacityAnim, starsAnimValue]);

  const scaleStyle = {
    transform: [
      { scale: scaleAnim },
    ],
  };

  const starsStyle = {
    transform: [{ scale: starsAnimValue }],
  };

  // Determine result text and color
  const getResultDisplay = () => {
    if (score.stars === 3) {
      return {
        text: 'Outstanding!',
        color: '#FFD700',
        icon: 'star',
      };
    }
    if (score.stars === 2) {
      return {
        text: 'Great Job!',
        color: '#C0C0C0',
        icon: 'star',
      };
    }
    if (score.stars === 1) {
      return {
        text: 'Good Effort!',
        color: '#CD7F32',
        icon: 'star',
      };
    }
    if (score.isPassed) {
      return {
        text: 'Keep Practicing',
        color: '#4CAF50',
        icon: 'check-circle',
      };
    }
    return {
      text: 'Try Again',
      color: '#F44336',
      icon: 'alert-circle',
    };
  };

  const resultDisplay = getResultDisplay();

  // Mascot mood and tip based on score
  const mascotData = useMemo(() => {
    let mood: MascotMood;
    if (score.overall >= 95) {
      mood = 'celebrating';
    } else if (score.overall >= 80) {
      mood = 'happy';
    } else if (score.overall >= 60) {
      mood = 'encouraging';
    } else {
      mood = 'encouraging';
    }
    const tip = getTipForScore(score.overall);
    return { mood, message: tip.text };
  }, [score.overall]);

  // Fun fact for passed exercises
  const completionFunFact = useMemo(
    () => (score.isPassed ? getFactForExerciseType(exercise.metadata.skills) : null),
    [score.isPassed, exercise.metadata.skills]
  );

  return (
    <View style={styles.overlay} testID={testID}>
      {/* Confetti for 3-star scores */}
      {score.stars === 3 && <ConfettiEffect testID="completion-confetti" />}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.container,
            scaleStyle,
            { opacity: opacityAnim },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{exercise.metadata.title}</Text>
            <Text style={styles.subtitle}>{isTestMode ? 'Mastery Test Complete!' : 'Exercise Complete!'}</Text>
          </View>

          {/* Score + Stars in a compact row for landscape */}
          <View style={styles.scoreStarsRow}>
            {/* Score Display */}
            <View style={styles.scoreSection}>
              <View style={[
                styles.scoreCircle,
                {
                  borderColor: resultDisplay.color,
                  backgroundColor: '#252525',
                },
              ]}>
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreNumber, { color: resultDisplay.color }]}>{Math.round(score.overall)}</Text>
                  <Text style={[styles.scoreLabel, { color: resultDisplay.color }]}>%</Text>
                </View>
              </View>
            </View>

            {/* Stars + Result */}
            <View style={styles.starsResultColumn}>
              <Animated.View
                style={[
                  styles.starsContainer,
                  starsStyle,
                ]}
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <MaterialCommunityIcons
                    key={i}
                    name={i < score.stars ? 'star' : 'star-outline'}
                    size={36}
                    color={i < score.stars ? '#FFD700' : '#444444'}
                  />
                ))}
              </Animated.View>

              {/* Result message */}
              <View style={styles.resultSection}>
                <MaterialCommunityIcons
                  name={resultDisplay.icon as any}
                  size={24}
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

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Accuracy</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${Math.round(score.breakdown.accuracy)}%`,
                      backgroundColor: '#4CAF50',
                    },
                  ]}
                />
              </View>
              <Text style={styles.breakdownValue}>{Math.round(score.breakdown.accuracy)}%</Text>
            </View>

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Timing</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${Math.round(score.breakdown.timing)}%`,
                      backgroundColor: '#2196F3',
                    },
                  ]}
                />
              </View>
              <Text style={styles.breakdownValue}>{Math.round(score.breakdown.timing)}%</Text>
            </View>

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Completeness</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${Math.round(score.breakdown.completeness)}%`,
                      backgroundColor: '#FF9800',
                    },
                  ]}
                />
              </View>
              <Text style={styles.breakdownValue}>{Math.round(score.breakdown.completeness)}%</Text>
            </View>
          </View>

          {/* XP and Stats */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="lightning-bolt" size={20} color="#FFD700" />
              <Text style={styles.statLabel}>XP Earned</Text>
              <Text style={styles.statValue}>+{score.xpEarned}</Text>
            </View>

            {score.isNewHighScore && (
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="trophy" size={20} color="#FFD700" />
                <Text style={styles.statLabel}>New Record!</Text>
                <Text style={styles.statValue}>{Math.round(score.overall)}%</Text>
              </View>
            )}
          </View>

          {/* Keysie Mascot */}
          <View style={styles.mascotSection}>
            <MascotBubble
              mood={mascotData.mood}
              message={mascotData.message}
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

          {/* Fun Fact (passed exercises only) */}
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
            {/* Mastery test gate: all regular exercises done → take the test */}
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
            {/* Normal next exercise (when no mastery test is pending) */}
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
            {/* In test mode failures, only show retry — no "back to lessons" escape */}
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

CompletionModal.displayName = 'CompletionModal';

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    shadowColor: '#DC143C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#B0B0B0',
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
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#DC143C',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: '#DC143C',
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC143C',
    marginLeft: 1,
  },
  starsResultColumn: {
    alignItems: 'center',
    gap: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  resultSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultText: {
    fontSize: 18,
    fontWeight: '700',
  },
  breakdownSection: {
    gap: 8,
    backgroundColor: '#252525',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  breakdownRow: {
    gap: 4,
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#B0B0B0',
    fontWeight: '600',
  },
  breakdownBar: {
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownValue: {
    fontSize: 11,
    color: '#B0B0B0',
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
    backgroundColor: 'rgba(220, 20, 60, 0.1)',
    borderRadius: 8,
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#B0B0B0',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFD700',
  },
  mascotSection: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  coachSection: {
    backgroundColor: 'rgba(124, 77, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(124, 77, 255, 0.2)',
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
