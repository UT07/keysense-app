/**
 * ExerciseScreen Component
 * Main exercise player screen with keyboard, piano roll, and feedback
 * Shows real-time scoring and visual feedback
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Keyboard } from '../components/Keyboard/Keyboard';
import { PianoRoll } from '../components/PianoRoll/PianoRoll';
import { Exercise, ExerciseScore, MidiNoteEvent } from '../core/exercises/types';

export interface ExerciseScreenProps {
  exercise?: Exercise;
  onExerciseComplete?: (score: ExerciseScore) => void;
  onClose?: () => void;
}

interface PlaybackState {
  isPlaying: boolean;
  currentBeat: number;
  elapsedTime: number; // in ms
}

/**
 * Calculate current beat based on elapsed time and tempo
 */
function calculateCurrentBeat(elapsedMs: number, tempo: number): number {
  // BPM to beats per millisecond: tempo / (60 * 1000)
  const beatsPerMs = tempo / 60000;
  return elapsedMs * beatsPerMs;
}

/**
 * ExerciseScreen - Full exercise player with keyboard and feedback
 * Manages playback, scoring, and visual feedback
 */
// Default demo exercise when no specific exercise is loaded
const DEFAULT_EXERCISE: Exercise = {
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
    commonMistakes: [{ pattern: 'wrong-key', advice: 'Middle C is to the left of the two black keys in the center of the keyboard' }],
    successMessage: 'Great job finding Middle C!',
  },
};

export const ExerciseScreen: React.FC<ExerciseScreenProps> = ({
  exercise: exerciseProp,
  onExerciseComplete,
  onClose,
}) => {
  const navigation = useNavigation();
  // Route params available for future exercise loading by ID
  // const route = useRoute<RouteProp<RootStackParamList, 'Exercise'>>();

  // Use provided exercise or default (TODO: load by route.params.exerciseId)
  const exercise = exerciseProp ?? DEFAULT_EXERCISE;
  const handleClose = onClose ?? (() => navigation.goBack());
  // Playback state
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentBeat: 0,
    elapsedTime: 0,
  });

  // UI state
  const [highlightedKeys, setHighlightedKeys] = useState<Set<number>>(
    new Set()
  );
  const [expectedKeys, setExpectedKeys] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<{
    type: 'perfect' | 'good' | 'ok' | 'miss';
    noteIndex: number;
  } | null>(null);
  const [_score, setScore] = useState<ExerciseScore | null>(null);

  // Animations
  const feedbackAnim = useRef(new Animated.Value(0)).current;
  // progressAnim reserved for future animation use

  // Update expected notes for current playback position
  useEffect(() => {
    const expectedThisBeat = exercise.notes
      .filter(
        note =>
          note.startBeat <= playbackState.currentBeat &&
          note.startBeat + note.durationBeats > playbackState.currentBeat
      )
      .map(note => note.note);

    setExpectedKeys(new Set(expectedThisBeat));
  }, [playbackState.currentBeat, exercise.notes]);

  /**
   * Handle keyboard key press
   */
  const handleKeyDown = useCallback(
    (event: MidiNoteEvent) => {
      const midiNote = event.note;
      setHighlightedKeys(prev => new Set([...prev, midiNote]));

      // Check if this is an expected note
      const isExpected = expectedKeys.has(midiNote);

      // Trigger feedback animation
      setFeedback({
        type: isExpected ? 'good' : 'miss',
        noteIndex: 0,
      });

      Animated.sequence([
        Animated.timing(feedbackAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(feedbackAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [expectedKeys]
  );

  /**
   * Handle keyboard key release
   */
  const handleKeyUp = useCallback((midiNote: number) => {
    setHighlightedKeys(prev => {
      const newSet = new Set(prev);
      newSet.delete(midiNote);
      return newSet;
    });
  }, []);

  /**
   * Toggle playback
   */
  const togglePlayback = useCallback(() => {
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  }, []);

  /**
   * Reset exercise
   */
  const handleReset = useCallback(() => {
    setPlaybackState({
      isPlaying: false,
      currentBeat: 0,
      elapsedTime: 0,
    });
    setHighlightedKeys(new Set());
    setExpectedKeys(new Set());
    setFeedback(null);
  }, []);

  /**
   * Simulate playback progression (would use actual metronome in production)
   */
  useEffect(() => {
    if (!playbackState.isPlaying) return;

    const interval = setInterval(() => {
      setPlaybackState(prev => {
        const newElapsedTime = prev.elapsedTime + 16; // ~60fps
        const newBeat = calculateCurrentBeat(newElapsedTime, exercise.settings.tempo);

        // Stop when exercise ends
        if (newBeat >= Math.max(...exercise.notes.map(n => n.startBeat + n.durationBeats))) {
          return {
            ...prev,
            isPlaying: false,
          };
        }

        return {
          ...prev,
          elapsedTime: newElapsedTime,
          currentBeat: newBeat,
        };
      });
    }, 16); // 16ms ≈ 60fps

    return () => clearInterval(interval);
  }, [playbackState.isPlaying, exercise]);

  /**
   * Calculate current score (simplified for demo)
   */
  const calculateScore = useCallback((): ExerciseScore => {
    return {
      overall: 85,
      stars: 2,
      breakdown: {
        accuracy: 90,
        timing: 85,
        completeness: 95,
        extraNotes: 0,
      },
      details: [],
      perfectNotes: 5,
      goodNotes: 8,
      okNotes: 2,
      missedNotes: 1,
      extraNotes: 0,
      xpEarned: 25,
      isNewHighScore: true,
      isPassed: true,
    };
  }, []);

  const handleComplete = useCallback(() => {
    const finalScore = calculateScore();
    setScore(finalScore);
    onExerciseComplete?.(finalScore);
  }, [calculateScore, onExerciseComplete]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{exercise.metadata.title}</Text>
          <Text style={styles.difficulty}>
            Difficulty: {exercise.metadata.difficulty}/5
          </Text>
        </View>
        <View style={styles.spacer} />
      </View>

      {/* Hint/Tip */}
      {exercise.hints.beforeStart && (
        <View style={styles.tipsContainer}>
          <MaterialCommunityIcons name="lightbulb-outline" size={16} color="#FF9800" />
          <Text style={styles.tipsText}>{exercise.hints.beforeStart}</Text>
        </View>
      )}

      {/* Piano Roll */}
      <PianoRoll
        notes={exercise.notes}
        currentBeat={playbackState.currentBeat}
        tempo={exercise.settings.tempo}
        timeSignature={exercise.settings.timeSignature}
        visibleBeats={8}
      />

      {/* Feedback Display */}
      {feedback && (
        <Animated.View
          style={[
            styles.feedbackContainer,
            {
              opacity: feedbackAnim,
              transform: [
                {
                  scale: feedbackAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2],
                  }),
                },
              ],
            },
          ]}
        >
          <Text
            style={[
              styles.feedbackText,
              {
                color:
                  feedback.type === 'perfect'
                    ? '#4CAF50'
                    : feedback.type === 'good'
                      ? '#2196F3'
                      : feedback.type === 'ok'
                        ? '#FF9800'
                        : '#F44336',
              },
            ]}
          >
            {feedback.type === 'perfect'
              ? 'Perfect!'
              : feedback.type === 'good'
                ? 'Good'
                : feedback.type === 'ok'
                  ? 'OK'
                  : 'Miss'}
          </Text>
        </Animated.View>
      )}

      {/* Keyboard */}
      <View style={styles.keyboardContainer}>
        <Keyboard
          startNote={48} // C3
          octaveCount={2}
          scrollable={true}
          highlightedNotes={highlightedKeys}
          expectedNotes={expectedKeys}
          onNoteOn={handleKeyDown}
          onNoteOff={handleKeyUp}
          hapticEnabled={true}
          showLabels={false}
          keyHeight={100}
        />
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <View style={styles.tempoDisplay}>
          <MaterialCommunityIcons name="metronome" size={16} color="#666" />
          <Text style={styles.tempoText}>
            ♩ = {exercise.settings.tempo}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.playButton, playbackState.isPlaying && styles.playButtonActive]}
          onPress={togglePlayback}
        >
          <MaterialCommunityIcons
            name={playbackState.isPlaying ? 'pause' : 'play'}
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <MaterialCommunityIcons name="restart" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Beat/Time Display */}
      <View style={styles.beatInfo}>
        <Text style={styles.beatText}>
          Beat {Math.floor(playbackState.currentBeat)} / {Math.max(...exercise.notes.map(n => n.startBeat + n.durationBeats))}
        </Text>
      </View>

      {/* Complete Button */}
      <TouchableOpacity
        style={styles.completeButton}
        onPress={handleComplete}
        disabled={playbackState.isPlaying}
      >
        <Text style={styles.completeButtonText}>Complete Exercise</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

ExerciseScreen.displayName = 'ExerciseScreen';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  closeButton: {
    padding: 8,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  difficulty: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  spacer: {
    width: 40,
  },
  tipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF8E1',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
    marginBottom: 4,
  },
  tipsText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#F57F17',
    flex: 1,
  },
  keyboardContainer: {
    height: 120,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  feedbackContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -60,
    marginTop: -40,
    width: 120,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    zIndex: 100,
  },
  feedbackText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    gap: 16,
  },
  tempoDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  tempoText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  playButtonActive: {
    backgroundColor: '#1976D2',
  },
  resetButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
  },
  beatInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  beatText: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  completeButton: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 12,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
