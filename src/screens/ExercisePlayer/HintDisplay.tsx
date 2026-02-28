/**
 * Hint Display Component
 * Shows contextual tips and common mistake warnings.
 * When error patterns match exercise-specific commonMistakes, shows
 * the targeted advice instead of generic feedback text.
 */

import React, { useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../theme/tokens';
import type { ExerciseHints, CommonMistake } from '../../core/exercises/types';

export interface HintDisplayProps {
  hints: ExerciseHints;
  isPlaying: boolean;
  countInComplete: boolean;
  feedback: 'perfect' | 'good' | 'ok' | 'early' | 'late' | 'miss' | null;
  /** Latest timing offset in ms (negative=early, positive=late) */
  timingOffsetMs?: number;
  compact?: boolean;
  testID?: string;
}

/** Check if a feedback type matches a CommonMistake triggerCondition */
function matchesMistake(
  mistake: CommonMistake,
  feedback: string,
  timingOffsetMs: number,
  consecutiveErrors: number,
): boolean {
  const cond = mistake.triggerCondition;
  if (!cond) {
    // Pattern-only mistakes: match after 3+ consecutive errors of the same type
    if (consecutiveErrors >= 3) return true;
    return false;
  }

  if (cond.type === 'timing') {
    // Threshold is negative for early, positive for late
    if (cond.threshold < 0 && feedback === 'early' && timingOffsetMs <= cond.threshold) return true;
    if (cond.threshold > 0 && feedback === 'late' && timingOffsetMs >= cond.threshold) return true;
    // Generic timing threshold — applies to any timing error direction
    if (cond.threshold > 0 && (feedback === 'early' || feedback === 'late') && Math.abs(timingOffsetMs) >= cond.threshold) return true;
  }

  if (cond.type === 'pitch' && feedback === 'miss') return true;

  if (cond.type === 'sequence' && consecutiveErrors >= (cond.threshold || 2)) return true;

  return false;
}

/**
 * HintDisplay - Shows contextual hints and advice.
 * Displays the beforeStart tip before play, and during play shows
 * exercise-specific commonMistake advice when error patterns match,
 * falling back to generic feedback messages.
 */
export const HintDisplay: React.FC<HintDisplayProps> = ({
  hints,
  isPlaying,
  countInComplete,
  feedback,
  timingOffsetMs = 0,
  compact = false,
  testID,
}) => {
  // Track consecutive errors of the same type to trigger pattern-based hints
  const consecutiveErrorsRef = useRef(0);
  const lastErrorTypeRef = useRef<string | null>(null);

  useEffect(() => {
    if (!feedback || feedback === 'perfect' || feedback === 'good') {
      consecutiveErrorsRef.current = 0;
      lastErrorTypeRef.current = null;
    } else {
      if (feedback === lastErrorTypeRef.current) {
        consecutiveErrorsRef.current++;
      } else {
        consecutiveErrorsRef.current = 1;
        lastErrorTypeRef.current = feedback;
      }
    }
  }, [feedback]);

  // Determine which hint to show
  const currentHint = useMemo(() => {
    if (!isPlaying) {
      return {
        icon: 'lightbulb-on',
        text: hints.beforeStart,
        color: COLORS.primary,
      };
    }

    if (!countInComplete) {
      return {
        icon: 'clock-outline',
        text: 'Get ready...',
        color: COLORS.warning,
      };
    }

    // Check if any commonMistake matches the current error pattern
    if (feedback && feedback !== 'perfect' && feedback !== 'good' && hints.commonMistakes?.length) {
      for (const mistake of hints.commonMistakes) {
        if (matchesMistake(mistake, feedback, timingOffsetMs, consecutiveErrorsRef.current)) {
          return {
            icon: 'lightbulb-on',
            text: mistake.advice,
            color: COLORS.warning,
          };
        }
      }
    }

    switch (feedback) {
      case 'perfect':
        return {
          icon: 'check-circle',
          text: 'Perfect timing!',
          color: COLORS.feedbackPerfect,
        };
      case 'good':
        return {
          icon: 'check',
          text: 'Good!',
          color: COLORS.feedbackGood,
        };
      case 'ok':
        return {
          icon: 'minus-circle',
          text: 'Try to be more precise',
          color: COLORS.feedbackOk,
        };
      case 'miss':
        return {
          icon: 'close-circle',
          text: 'Keep focused on the notes',
          color: COLORS.feedbackMiss,
        };
      case 'early':
        return {
          icon: 'fast-forward',
          text: 'A bit early, slow down',
          color: COLORS.feedbackEarly,
        };
      case 'late':
        return {
          icon: 'rewind',
          text: 'A bit late, speed up',
          color: COLORS.feedbackLate,
        };
      default:
        return {
          icon: 'information-outline',
          text: 'Focus on the piano roll',
          color: COLORS.feedbackDefault,
        };
    }
  }, [isPlaying, countInComplete, feedback, timingOffsetMs, hints]);

  if (compact) {
    return (
      <View style={styles.compactContainer} testID={testID}>
        <MaterialCommunityIcons
          name={currentHint.icon as any}
          size={14}
          color={currentHint.color}
        />
        <Text
          style={styles.compactText}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {currentHint.text}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <View
        style={[
          styles.hintBox,
          { borderLeftColor: currentHint.color },
        ]}
      >
        <MaterialCommunityIcons
          name={currentHint.icon as any}
          size={20}
          color={currentHint.color}
        />
        <Text
          style={styles.hintText}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {currentHint.text}
        </Text>
      </View>
    </View>
  );
};

HintDisplay.displayName = 'HintDisplay';

const styles = StyleSheet.create({
  // Compact mode styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    paddingHorizontal: 8,
  },
  compactText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  // Full mode styles
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.cardHighlight,
    borderLeftWidth: 4,
    borderRadius: 6,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
    lineHeight: 18,
  },
});

export default HintDisplay;
