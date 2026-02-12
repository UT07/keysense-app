/**
 * Integration Test: Exercise Flow
 * Tests the complete exercise playback experience from start to finish
 *
 * Tests:
 * 1. Exercise loading
 * 2. Control interactions (play, pause, restart, exit)
 * 3. State transitions
 * 4. Exercise completion
 */

import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { ExercisePlayer } from '../../screens/ExercisePlayer/ExercisePlayer';
import type { Exercise, MidiNoteEvent } from '../../core/exercises/types';

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock exercise store
jest.mock('../../stores/exerciseStore', () => ({
  useExerciseStore: jest.fn(() => ({
    currentExercise: null,
    clearSession: jest.fn(),
    setScore: jest.fn(),
    addPlayedNote: jest.fn(),
    setCurrentBeat: jest.fn(),
    setIsPlaying: jest.fn(),
  })),
}));

// Mock useExercisePlayback hook
const mockStartPlayback = jest.fn();
const mockPausePlayback = jest.fn();
const mockStopPlayback = jest.fn();
const mockResetPlayback = jest.fn();
const mockPlayNote = jest.fn();
const mockReleaseNote = jest.fn();

let mockPlaybackState: {
  isPlaying: boolean;
  currentBeat: number;
  playedNotes: MidiNoteEvent[];
  startPlayback: jest.Mock;
  pausePlayback: jest.Mock;
  stopPlayback: jest.Mock;
  resetPlayback: jest.Mock;
  playNote: jest.Mock;
  releaseNote: jest.Mock;
  isMidiReady: boolean;
  isAudioReady: boolean;
  hasError: boolean;
  errorMessage: string | null;
} = {
  isPlaying: false,
  currentBeat: -1,
  playedNotes: [],
  startPlayback: mockStartPlayback,
  pausePlayback: mockPausePlayback,
  stopPlayback: mockStopPlayback,
  resetPlayback: mockResetPlayback,
  playNote: mockPlayNote,
  releaseNote: mockReleaseNote,
  isMidiReady: true,
  isAudioReady: true,
  hasError: false,
  errorMessage: null,
};

jest.mock('../../hooks/useExercisePlayback', () => ({
  useExercisePlayback: jest.fn(() => mockPlaybackState),
}));

// Mock Button component (uses react-native-reanimated)
jest.mock('../../components/common/Button', () => ({
  Button: (props: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={props.onPress} testID={props.testID} disabled={props.disabled}>
        <Text>{props.title}</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../../components/Keyboard/Keyboard', () => ({
  Keyboard: (props: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-keyboard'}>
        <Text>Keyboard</Text>
      </View>
    );
  },
}));

jest.mock('../../components/PianoRoll/PianoRoll', () => ({
  PianoRoll: (props: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-piano-roll'}>
        <Text>{props.currentBeat}</Text>
      </View>
    );
  },
}));

// Test exercise - simple C major scale
const TEST_EXERCISE: Exercise = {
  id: 'test-exercise-1',
  version: 1,
  metadata: {
    title: 'C Major Scale Test',
    description: 'Play C-D-E-F',
    difficulty: 1,
    estimatedMinutes: 1,
    skills: ['right-hand', 'c-major'],
    prerequisites: [],
  },
  settings: {
    tempo: 120,
    timeSignature: [4, 4],
    keySignature: 'C',
    countIn: 1, // 1 beat count-in for faster testing
    metronomeEnabled: false,
  },
  notes: [
    { note: 60, startBeat: 0, durationBeats: 1 }, // C
    { note: 62, startBeat: 1, durationBeats: 1 }, // D
    { note: 64, startBeat: 2, durationBeats: 1 }, // E
    { note: 65, startBeat: 3, durationBeats: 1 }, // F
  ],
  scoring: {
    timingToleranceMs: 50,
    timingGracePeriodMs: 150,
    passingScore: 70,
    starThresholds: [70, 85, 95],
  },
  hints: {
    beforeStart: 'Play C-D-E-F in order',
    commonMistakes: [
      {
        pattern: 'wrong-notes',
        advice: 'Make sure to play the correct notes',
      },
    ],
    successMessage: 'Great job!',
  },
};

describe('Exercise Flow Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset playback state
    mockPlaybackState = {
      isPlaying: false,
      currentBeat: -1,
      playedNotes: [],
      startPlayback: mockStartPlayback,
      pausePlayback: mockPausePlayback,
      stopPlayback: mockStopPlayback,
      resetPlayback: mockResetPlayback,
      playNote: mockPlayNote,
      releaseNote: mockReleaseNote,
      isMidiReady: true,
      isAudioReady: true,
      hasError: false,
      errorMessage: null,
    };
    const { useExercisePlayback } = require('../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);
  });

  it('loads exercise and displays initial state', async () => {
    const { getByTestId, getByText } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    await waitFor(() => {
      expect(getByTestId('exercise-player')).toBeTruthy();
      expect(getByText('C Major Scale Test')).toBeTruthy();
    });
  });

  it('starts playback on play button press', async () => {
    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    const startButton = getByTestId('control-play');
    await act(async () => {
      fireEvent.press(startButton);
    });

    expect(mockStartPlayback).toHaveBeenCalled();
  });

  it('shows keyboard and piano roll', async () => {
    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    expect(getByTestId('exercise-keyboard')).toBeTruthy();
    expect(getByTestId('exercise-piano-roll')).toBeTruthy();
  });

  it('shows pause and restart when playing', async () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentBeat = 1;
    const { useExercisePlayback } = require('../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    expect(getByTestId('control-pause')).toBeTruthy();
    expect(getByTestId('control-restart')).toBeTruthy();
  });

  it('pauses playback on pause button press', async () => {
    mockPlaybackState.isPlaying = true;
    const { useExercisePlayback } = require('../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    const pauseButton = getByTestId('control-pause');
    await act(async () => {
      fireEvent.press(pauseButton);
    });

    expect(mockPausePlayback).toHaveBeenCalled();
  });

  it('restarts exercise on restart button press', async () => {
    mockPlaybackState.isPlaying = true;
    const { useExercisePlayback } = require('../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    const restartButton = getByTestId('control-restart');
    await act(async () => {
      fireEvent.press(restartButton);
    });

    expect(mockResetPlayback).toHaveBeenCalled();
  });

  it('shows error display when initialization fails', async () => {
    mockPlaybackState.hasError = true;
    mockPlaybackState.errorMessage = 'Audio initialization failed';
    mockPlaybackState.isMidiReady = false;
    mockPlaybackState.isAudioReady = false;
    const { useExercisePlayback } = require('../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId, getByText } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    await waitFor(() => {
      expect(getByTestId('exercise-error')).toBeTruthy();
      expect(getByText('Audio initialization failed')).toBeTruthy();
    });
  });

  it('exits exercise properly', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} onClose={onClose} />
    );

    const exitButton = getByTestId('control-exit');
    await act(async () => {
      fireEvent.press(exitButton);
    });

    expect(onClose).toHaveBeenCalled();
    expect(mockStopPlayback).toHaveBeenCalled();
  });

  it('displays hint before start', async () => {
    const { getByText } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    expect(getByText('Play C-D-E-F in order')).toBeTruthy();
  });
});
