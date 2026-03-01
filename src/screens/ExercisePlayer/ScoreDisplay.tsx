/**
 * Score Display Component
 * Real-time display of exercise progress and scoring
 * Shows: title, tempo, progress bar, current score, combo counter
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { COLORS, glowColor } from '../../theme/tokens';
import type { Exercise } from '../../core/exercises/types';

export interface ScoreDisplayProps {
  exercise: Exercise;
  currentBeat: number;
  combo: number;
  feedback: 'perfect' | 'good' | 'ok' | 'early' | 'late' | 'miss' | null;
  comboAnimValue: Animated.Value;
  compact?: boolean;
  testID?: string;
}

/**
 * ScoreDisplay - Shows real-time exercise progress and combo
 */
export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  exercise,
  currentBeat,
  combo,
  feedback,
  comboAnimValue,
  compact = false,
  testID,
}) => {
  // Calculate exercise duration
  const exerciseDuration = useMemo(() => {
    return Math.max(...exercise.notes.map((n) => n.startBeat + n.durationBeats));
  }, [exercise.notes]);

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    const adjustedBeat = Math.max(0, currentBeat);
    return Math.min(100, (adjustedBeat / exerciseDuration) * 100);
  }, [currentBeat, exerciseDuration]);

  // Determine feedback color
  const getFeedbackColor = () => {
    switch (feedback) {
      case 'perfect':
        return COLORS.feedbackPerfect;
      case 'good':
        return COLORS.feedbackGood;
      case 'ok':
        return COLORS.feedbackOk;
      case 'early':
        return COLORS.feedbackEarly;
      case 'late':
        return COLORS.feedbackLate;
      case 'miss':
        return COLORS.feedbackMiss;
      default:
        return COLORS.feedbackDefault;
    }
  };

  // Determine feedback text
  const getFeedbackText = () => {
    switch (feedback) {
      case 'perfect':
        return 'Perfect!';
      case 'good':
        return 'Good!';
      case 'ok':
        return 'OK';
      case 'early':
        return 'Early';
      case 'late':
        return 'Late';
      case 'miss':
        return 'Missed';
      default:
        return '';
    }
  };

  const comboAnimStyle = {
    transform: [{ scale: comboAnimValue }],
  };

  if (compact) {
    // Compact mode: title + progress bar + percent only.
    // Combo and feedback are shown in the feedbackOverlay between piano roll and keyboard,
    // so duplicating them here causes visual clutter on narrow screens.
    return (
      <View style={styles.compactContainer} testID={testID}>
        <Text style={styles.compactTitle} numberOfLines={1}>
          {exercise.metadata.title}
        </Text>

        <View style={styles.compactProgress}>
          <View
            style={[
              styles.compactProgressBar,
              { width: `${progressPercent}%` },
            ]}
          />
        </View>

        <Text style={styles.compactPercent}>
          {Math.round(progressPercent)}%
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      {/* Title and difficulty */}
      <View style={styles.header}>
        <Text style={styles.title}>{exercise.metadata.title}</Text>
        <Text style={styles.difficulty}>
          {'⭐'.repeat(exercise.metadata.difficulty)}
        </Text>
      </View>

      {/* Tempo and time signature */}
      <View style={styles.metadataRow}>
        <Text style={styles.metadata}>
          {exercise.settings.tempo} BPM • {exercise.settings.timeSignature[0]}/{exercise.settings.timeSignature[1]}
        </Text>
        <Text style={styles.metadata}>
          Beat {Math.ceil(Math.max(0, currentBeat))}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${progressPercent}%`,
            },
          ]}
        />
      </View>

      {/* Combo counter and feedback */}
      <View style={styles.bottomRow}>
        {combo > 0 && (
          <Animated.View style={[styles.comboContainer, comboAnimStyle]}>
            <Text style={styles.comboLabel}>Combo</Text>
            <Text style={styles.comboValue}>{combo}</Text>
          </Animated.View>
        )}

        {feedback && (
          <View
            style={[
              styles.feedbackBadge,
              { backgroundColor: getFeedbackColor() },
            ]}
          >
            <Text style={styles.feedbackText}>{getFeedbackText()}</Text>
          </View>
        )}

        {/* Progress text */}
        <Text style={styles.progressText}>
          {Math.round(progressPercent)}%
        </Text>
      </View>
    </View>
  );
};

ScoreDisplay.displayName = 'ScoreDisplay';

const styles = StyleSheet.create({
  // Compact mode styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    maxWidth: 140,
  },
  compactProgress: {
    flex: 1,
    height: 5,
    backgroundColor: COLORS.cardBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  compactProgressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  compactPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    minWidth: 30,
    textAlign: 'right',
  },
  // Full mode styles
  container: {
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  difficulty: {
    fontSize: 14,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metadata: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  progressContainer: {
    height: 8,
    backgroundColor: COLORS.cardBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  comboContainer: {
    alignItems: 'center',
    backgroundColor: glowColor(COLORS.primary, 0.15),
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  comboLabel: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '600',
  },
  comboValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  feedbackBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  feedbackText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

export default ScoreDisplay;
