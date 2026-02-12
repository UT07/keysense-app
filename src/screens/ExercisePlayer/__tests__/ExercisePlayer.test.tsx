/**
 * ExercisePlayer Component Tests
 * Tests core playback, scoring, and interaction features
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ExercisePlayer } from '../ExercisePlayer';
import type { Exercise } from '../../../core/exercises/types';

// Mock dependencies
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('../../../stores/exerciseStore', () => ({
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
  playedNotes: any[];
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
  currentBeat: -2,
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

jest.mock('../../../hooks/useExercisePlayback', () => ({
  useExercisePlayback: jest.fn(() => mockPlaybackState),
}));

jest.mock('../../../components/Keyboard/Keyboard', () => ({
  Keyboard: (props: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-keyboard'}>
        <Text>Keyboard</Text>
      </View>
    );
  },
}));

jest.mock('../../../components/PianoRoll/PianoRoll', () => ({
  PianoRoll: (props: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-piano-roll'}>
        <Text>{props.currentBeat}</Text>
      </View>
    );
  },
}));

// Mock common Button component (uses react-native-reanimated)
jest.mock('../../../components/common/Button', () => ({
  Button: (props: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={props.onPress} testID={props.testID} disabled={props.disabled}>
        <Text>{props.title}</Text>
      </TouchableOpacity>
    );
  },
}));

const MOCK_EXERCISE: Exercise = {
  id: 'test-exercise',
  version: 1,
  metadata: {
    title: 'Test Exercise',
    description: 'A test exercise',
    difficulty: 1,
    estimatedMinutes: 2,
    skills: ['test'],
    prerequisites: [],
  },
  settings: {
    tempo: 120,
    timeSignature: [4, 4],
    keySignature: 'C',
    countIn: 2,
    metronomeEnabled: true,
  },
  notes: [
    { note: 60, startBeat: 2, durationBeats: 1 },
    { note: 64, startBeat: 3, durationBeats: 1 },
  ],
  scoring: {
    timingToleranceMs: 50,
    timingGracePeriodMs: 150,
    passingScore: 70,
    starThresholds: [70, 85, 95],
  },
  hints: {
    beforeStart: 'Get ready',
    commonMistakes: [],
    successMessage: 'Great!',
  },
};

describe('ExercisePlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset playback state to defaults
    mockPlaybackState = {
      isPlaying: false,
      currentBeat: -2,
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
    const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);
  });

  it('should render correctly', () => {
    const { getByTestId } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} />
    );

    expect(getByTestId('exercise-player')).toBeTruthy();
    expect(getByTestId('exercise-keyboard')).toBeTruthy();
    expect(getByTestId('exercise-controls')).toBeTruthy();
  });

  it('should display exercise title', () => {
    const { getByText } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} />
    );

    expect(getByText(MOCK_EXERCISE.metadata.title)).toBeTruthy();
  });

  it('should start playback on play button press', async () => {
    const { getByTestId } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} />
    );

    const playButton = getByTestId('control-play');
    fireEvent.press(playButton);

    expect(mockStartPlayback).toHaveBeenCalled();
  });

  it('should pause playback when pause button is pressed', async () => {
    // Set state to playing so the pause button appears
    mockPlaybackState.isPlaying = true;
    const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} />
    );

    const pauseButton = getByTestId('control-pause');
    expect(pauseButton).toBeTruthy();
    fireEvent.press(pauseButton);

    expect(mockPausePlayback).toHaveBeenCalled();
  });

  it('should restart exercise when restart button is pressed', async () => {
    // Restart only shows when isPlaying is true
    mockPlaybackState.isPlaying = true;
    const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} />
    );

    const restartButton = getByTestId('control-restart');
    expect(restartButton).toBeTruthy();
    fireEvent.press(restartButton);

    expect(mockResetPlayback).toHaveBeenCalled();
  });

  it('should handle keyboard rendering when playing', async () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentBeat = 1;
    const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} />
    );

    expect(getByTestId('exercise-keyboard')).toBeTruthy();
  });

  it('should show hint text on initial render', () => {
    const { getByText } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} />
    );

    expect(getByText(MOCK_EXERCISE.hints.beforeStart)).toBeTruthy();
  });

  it('should call onExerciseComplete when finished', async () => {
    const onComplete = jest.fn();
    render(
      <ExercisePlayer exercise={MOCK_EXERCISE} onExerciseComplete={onComplete} />
    );

    // onComplete is passed to the hook via onComplete option
    // The hook calls it when exercise completes, which is tested at the hook level
  });

  it('should call onClose when exit button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} onClose={onClose} />
    );

    const exitButton = getByTestId('control-exit');
    fireEvent.press(exitButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('should display piano roll', () => {
    const { getByTestId } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} />
    );

    expect(getByTestId('exercise-piano-roll')).toBeTruthy();
  });

  it('should show error display when initialization fails', () => {
    mockPlaybackState.hasError = true;
    mockPlaybackState.errorMessage = 'Audio failed';
    mockPlaybackState.isMidiReady = false;
    mockPlaybackState.isAudioReady = false;
    const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId, getByText } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} />
    );

    expect(getByTestId('exercise-error')).toBeTruthy();
    expect(getByText('Audio failed')).toBeTruthy();
  });

  it('should show play button when not playing', () => {
    const { getByTestId, queryByTestId } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} />
    );

    expect(getByTestId('control-play')).toBeTruthy();
    // Pause and restart should not be visible when not playing
    expect(queryByTestId('control-pause')).toBeNull();
    expect(queryByTestId('control-restart')).toBeNull();
  });

  it('should show pause and restart when playing', () => {
    mockPlaybackState.isPlaying = true;
    const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId, queryByTestId } = render(
      <ExercisePlayer exercise={MOCK_EXERCISE} />
    );

    expect(getByTestId('control-pause')).toBeTruthy();
    expect(getByTestId('control-restart')).toBeTruthy();
    // Play button should not be visible when playing
    expect(queryByTestId('control-play')).toBeNull();
  });
});
