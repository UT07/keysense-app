/**
 * Completion Modal Component
 * Results screen shown after exercise completion
 * Displays score, stars, breakdown, and celebration
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import type { Exercise, ExerciseScore } from '../../core/exercises/types';

export interface CompletionModalProps {
  score: ExerciseScore;
  exercise: Exercise;
  onClose: () => void;
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
  testID,
}) => {
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const starsAnimValue = useRef(new Animated.Value(0)).current;

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

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="fade"
      testID={testID}
    >
      <View style={styles.overlay}>
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
            <Text style={styles.subtitle}>Exercise Complete!</Text>
          </View>

          {/* Score Display */}
          <View style={styles.scoreSection}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreNumber}>{score.overall}</Text>
              <Text style={styles.scoreLabel}>%</Text>
            </View>
          </View>

          {/* Stars Display */}
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
                size={48}
                color={i < score.stars ? '#FFD700' : '#E0E0E0'}
              />
            ))}
          </Animated.View>

          {/* Result message */}
          <View style={styles.resultSection}>
            <MaterialCommunityIcons
              name={resultDisplay.icon as any}
              size={32}
              color={resultDisplay.color}
            />
            <Text style={[styles.resultText, { color: resultDisplay.color }]}>
              {resultDisplay.text}
            </Text>
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
                      width: `${score.breakdown.accuracy}%`,
                      backgroundColor: '#4CAF50',
                    },
                  ]}
                />
              </View>
              <Text style={styles.breakdownValue}>{score.breakdown.accuracy}%</Text>
            </View>

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Timing</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${score.breakdown.timing}%`,
                      backgroundColor: '#2196F3',
                    },
                  ]}
                />
              </View>
              <Text style={styles.breakdownValue}>{score.breakdown.timing}%</Text>
            </View>

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Completeness</Text>
              <View style={styles.breakdownBar}>
                <View
                  style={[
                    styles.breakdownFill,
                    {
                      width: `${score.breakdown.completeness}%`,
                      backgroundColor: '#FF9800',
                    },
                  ]}
                />
              </View>
              <Text style={styles.breakdownValue}>{score.breakdown.completeness}%</Text>
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
                <Text style={styles.statValue}>{score.overall}%</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <Button
              title="Continue"
              onPress={onClose}
              variant="primary"
              size="large"
              icon={<MaterialCommunityIcons name="check" size={20} color="#FFF" />}
              testID="completion-continue"
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

CompletionModal.displayName = 'CompletionModal';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212121',
  },
  subtitle: {
    fontSize: 16,
    color: '#757575',
  },
  scoreSection: {
    alignItems: 'center',
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2196F3',
  },
  scoreNumber: {
    fontSize: 56,
    fontWeight: '700',
    color: '#2196F3',
  },
  scoreLabel: {
    fontSize: 20,
    color: '#2196F3',
    marginTop: -4,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  resultSection: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  resultText: {
    fontSize: 20,
    fontWeight: '700',
  },
  breakdownSection: {
    gap: 12,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 8,
  },
  breakdownRow: {
    gap: 8,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#757575',
    fontWeight: '600',
  },
  breakdownBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 4,
  },
  breakdownValue: {
    fontSize: 11,
    color: '#757575',
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
    paddingVertical: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#E65100',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6F00',
  },
  actions: {
    gap: 12,
  },
});

export default CompletionModal;
