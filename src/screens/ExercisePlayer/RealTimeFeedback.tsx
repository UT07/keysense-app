/**
 * Real-Time Feedback Component
 * Displays visual feedback for correct/incorrect notes
 * Shows timing and accuracy feedback
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface RealTimeFeedbackProps {
  feedback: {
    type: 'perfect' | 'good' | 'ok' | 'early' | 'late' | 'miss' | null;
    noteIndex: number;
    timestamp: number;
  };
  expectedNotes: Set<number>;
  highlightedKeys: Set<number>;
  testID?: string;
}

/**
 * RealTimeFeedback - Visual feedback during exercise
 * Shows colored indicators for note accuracy
 */
export const RealTimeFeedback: React.FC<RealTimeFeedbackProps> = ({
  feedback,
  expectedNotes,
  highlightedKeys,
  testID,
}) => {
  // Determine feedback display
  const feedbackDisplay = useMemo(() => {
    if (!feedback.type) {
      return {
        icon: 'music-note',
        label: 'Ready to play',
        color: '#2196F3',
        backgroundColor: '#E3F2FD',
      };
    }

    switch (feedback.type) {
      case 'perfect':
        return {
          icon: 'check-circle',
          label: 'Perfect!',
          color: '#4CAF50',
          backgroundColor: '#E8F5E9',
        };
      case 'good':
        return {
          icon: 'check',
          label: 'Good',
          color: '#8BC34A',
          backgroundColor: '#F1F8E9',
        };
      case 'ok':
        return {
          icon: 'minus-circle',
          label: 'OK',
          color: '#FFC107',
          backgroundColor: '#FFF9C4',
        };
      case 'miss':
        return {
          icon: 'close-circle',
          label: 'Missed',
          color: '#F44336',
          backgroundColor: '#FFEBEE',
        };
      case 'early':
        return {
          icon: 'fast-forward',
          label: 'Too early',
          color: '#FF9800',
          backgroundColor: '#FFF3E0',
        };
      case 'late':
        return {
          icon: 'rewind',
          label: 'Too late',
          color: '#FF9800',
          backgroundColor: '#FFF3E0',
        };
      default:
        return {
          icon: 'information-outline',
          label: 'Waiting',
          color: '#9E9E9E',
          backgroundColor: '#F5F5F5',
        };
    }
  }, [feedback.type]);

  // Count correct vs expected notes
  const correctCount = [...expectedNotes].filter((note) =>
    highlightedKeys.has(note)
  ).length;
  const expectedCount = expectedNotes.size;

  return (
    <View style={styles.container} testID={testID}>
      {/* Feedback indicator */}
      <View
        style={[
          styles.feedbackBox,
          { backgroundColor: feedbackDisplay.backgroundColor },
        ]}
      >
        <MaterialCommunityIcons
          name={feedbackDisplay.icon as any}
          size={32}
          color={feedbackDisplay.color}
        />
        <View style={styles.feedbackTextContainer}>
          <Text style={[styles.feedbackLabel, { color: feedbackDisplay.color }]}>
            {feedbackDisplay.label}
          </Text>
          {expectedCount > 0 && (
            <Text style={styles.feedbackSubtitle}>
              {correctCount}/{expectedCount} notes
            </Text>
          )}
        </View>
      </View>

      {/* Expected notes indicator */}
      {expectedCount > 0 && (
        <View style={styles.notesIndicator}>
          <Text style={styles.notesLabel}>Expected:</Text>
          <View style={styles.notesList}>
            {Array.from(expectedNotes).map((note) => (
              <View
                key={note}
                style={[
                  styles.noteIndicator,
                  {
                    backgroundColor: highlightedKeys.has(note)
                      ? '#4CAF50'
                      : '#E0E0E0',
                  },
                ]}
              >
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

RealTimeFeedback.displayName = 'RealTimeFeedback';

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  feedbackTextContainer: {
    flex: 1,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackSubtitle: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  notesIndicator: {
    paddingHorizontal: 16,
  },
  notesLabel: {
    fontSize: 11,
    color: '#757575',
    marginBottom: 6,
    fontWeight: '600',
  },
  notesList: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  noteIndicator: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default RealTimeFeedback;
