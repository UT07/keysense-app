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
        return '#4CAF50'; // Green
      case 'good':
        return '#8BC34A'; // Light green
      case 'ok':
        return '#FFC107'; // Yellow
      case 'early':
        return '#2196F3'; // Blue
      case 'late':
        return '#FF9800'; // Orange
      case 'miss':
        return '#F44336'; // Red
      default:
        return '#757575';
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
    color: '#FFFFFF',
    maxWidth: 140,
  },
  compactProgress: {
    flex: 1,
    height: 4,
    backgroundColor: '#333333',
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactProgressBar: {
    height: '100%',
    backgroundColor: '#DC143C',
    borderRadius: 2,
  },
  compactPercent: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC143C',
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
    color: '#FFFFFF',
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
    color: '#B0B0B0',
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#DC143C',
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
    backgroundColor: 'rgba(220, 20, 60, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  comboLabel: {
    fontSize: 10,
    color: '#DC143C',
    fontWeight: '600',
  },
  comboValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC143C',
  },
  feedbackBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  feedbackText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC143C',
  },
});

export default ScoreDisplay;
