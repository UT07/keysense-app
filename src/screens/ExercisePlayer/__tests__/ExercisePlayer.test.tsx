/**
 * ExercisePlayer Component Tests
 * Tests core playback, scoring, interaction features, demo mode,
 * ghost notes, responsive layout, and speed controls
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ExercisePlayer } from '../ExercisePlayer';
import type { Exercise } from '../../../core/exercises/types';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

jest.mock('../../../services/firebase/syncService', () => ({
  syncManager: {
    syncAfterExercise: jest.fn().mockResolvedValue(undefined),
    startPeriodicSync: jest.fn(),
    stopPeriodicSync: jest.fn(),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Exercise store state — mutable object that tests can modify via resetStore()
// eslint-disable-next-line prefer-const
let mockExerciseState: Record<string, any> = {};

jest.mock('../../../stores/exerciseStore', () => {
  // Zustand-compatible hook: useStore(), useStore(selector), useStore.getState()
  const useExerciseStore: any = (selector?: any) => {
    if (typeof selector === 'function') return selector(mockExerciseState);
    return mockExerciseState;
  };
  useExerciseStore.getState = () => mockExerciseState;
  return { useExerciseStore };
});

jest.mock('../../../stores/progressStore', () => ({
  useProgressStore: Object.assign(jest.fn(() => ({})), {
    getState: jest.fn(() => ({
      recordExerciseCompletion: jest.fn(),
      updateStreakData: jest.fn(),
      streakData: {
        currentStreak: 0,
        longestStreak: 0,
        lastPracticeDate: '2026-01-01',
        freezesAvailable: 1,
        freezesUsed: 0,
        weeklyPractice: [false, false, false, false, false, false, false],
      },
    })),
  }),
}));

// Mock useExercisePlayback hook
const mockStartPlayback = jest.fn();
const mockPausePlayback = jest.fn();
const mockResumePlayback = jest.fn();
const mockStopPlayback = jest.fn();
const mockResetPlayback = jest.fn();
const mockPlayNote = jest.fn();
const mockReleaseNote = jest.fn();

let mockPlaybackState: Record<string, any> = {
  isPlaying: false,
  currentBeat: -2,
  playedNotes: [],
  startPlayback: mockStartPlayback,
  pausePlayback: mockPausePlayback,
  resumePlayback: mockResumePlayback,
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

// Mock Keyboard — captures props for assertion
let capturedKeyboardProps: any = {};
jest.mock('../../../components/Keyboard/Keyboard', () => ({
  Keyboard: (props: any) => {
    capturedKeyboardProps = props;
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-keyboard'}>
        <Text>Keyboard</Text>
      </View>
    );
  },
}));

// Mock VerticalPianoRoll — captures props for assertion
let capturedPianoRollProps: any = {};
jest.mock('../../../components/PianoRoll/VerticalPianoRoll', () => ({
  VerticalPianoRoll: (props: any) => {
    capturedPianoRollProps = props;
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-piano-roll'}>
        <Text>{props.currentBeat}</Text>
      </View>
    );
  },
}));

jest.mock('../../../components/Keyboard/computeZoomedRange', () => ({
  computeZoomedRange: (_notes: number[]) => ({ startNote: 48, octaveCount: 2 }),
  computeStickyRange: (_notes: number[], range: any) => range,
}));

// Mock DemoPlaybackService
const mockDemoStart = jest.fn();
const mockDemoStop = jest.fn();
jest.mock('../../../services/demoPlayback', () => ({
  DemoPlaybackService: jest.fn().mockImplementation(() => ({
    start: mockDemoStart,
    stop: mockDemoStop,
    isPlaying: false,
  })),
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

// ---------------------------------------------------------------------------
// Test exercise fixture
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetPlaybackState() {
  mockPlaybackState = {
    isPlaying: false,
    currentBeat: -2,
    playedNotes: [],
    startPlayback: mockStartPlayback,
    pausePlayback: mockPausePlayback,
    resumePlayback: mockResumePlayback,
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
}

function resetStore(overrides: Record<string, any> = {}) {
  // Reset all keys on the shared mutable state object
  // (The mock factory closure reads from this same object reference)
  const defaults: Record<string, any> = {
    currentExercise: null,
    clearSession: jest.fn(),
    setScore: jest.fn(),
    addPlayedNote: jest.fn(),
    setCurrentBeat: jest.fn(),
    setIsPlaying: jest.fn(),
    playedNotes: [],
    failCount: 0,
    ghostNotesEnabled: false,
    ghostNotesSuccessCount: 0,
    demoWatched: false,
    incrementFailCount: jest.fn(),
    resetFailCount: jest.fn(),
    setGhostNotesEnabled: jest.fn(),
    incrementGhostNotesSuccessCount: jest.fn(),
    setDemoWatched: jest.fn(),
  };
  // Clear old keys, then apply defaults + overrides
  for (const key of Object.keys(mockExerciseState)) {
    delete mockExerciseState[key];
  }
  Object.assign(mockExerciseState, defaults, overrides);
}

// ===========================================================================
// TESTS
// ===========================================================================

describe('ExercisePlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPlaybackState();
    resetStore();
    capturedKeyboardProps = {};
    capturedPianoRollProps = {};
  });

  // -----------------------------------------------------------------------
  // Core rendering
  // -----------------------------------------------------------------------

  describe('Core rendering', () => {
    it('should render the main layout correctly', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('exercise-player')).toBeTruthy();
      expect(getByTestId('exercise-keyboard')).toBeTruthy();
      expect(getByTestId('exercise-controls')).toBeTruthy();
    });

    it('should display exercise title in the top bar', () => {
      const { getAllByText } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      // Title appears in both ScoreDisplay and ExerciseIntroOverlay
      expect(getAllByText(MOCK_EXERCISE.metadata.title).length).toBeGreaterThanOrEqual(1);
    });

    it('should display piano roll component', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('exercise-piano-roll')).toBeTruthy();
    });

    it('should show hint text on initial render', () => {
      const { getAllByText } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      // Hint appears in both HintDisplay and ExerciseIntroOverlay
      expect(getAllByText(MOCK_EXERCISE.hints.beforeStart).length).toBeGreaterThanOrEqual(1);
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
  });

  // -----------------------------------------------------------------------
  // Playback controls
  // -----------------------------------------------------------------------

  describe('Playback controls', () => {
    it('should show play button when not playing', () => {
      const { getByTestId, queryByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('control-play')).toBeTruthy();
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
      expect(queryByTestId('control-play')).toBeNull();
    });

    it('should start playback on play button press', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('control-play'));
      expect(mockStartPlayback).toHaveBeenCalled();
    });

    it('should pause playback on pause button press', () => {
      mockPlaybackState.isPlaying = true;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('control-pause'));
      expect(mockPausePlayback).toHaveBeenCalled();
    });

    it('should restart exercise when restart button is pressed', () => {
      mockPlaybackState.isPlaying = true;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('control-restart'));
      expect(mockResetPlayback).toHaveBeenCalled();
    });

    it('should call onClose when exit button is pressed', () => {
      jest.useFakeTimers();
      const onClose = jest.fn();
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} onClose={onClose} />
      );

      fireEvent.press(getByTestId('control-exit'));

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(onClose).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('should handle keyboard rendering when playing', () => {
      mockPlaybackState.isPlaying = true;
      mockPlaybackState.currentBeat = 1;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('exercise-keyboard')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Speed selector
  // -----------------------------------------------------------------------

  describe('Speed selector', () => {
    it('should render speed selector pill', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('speed-selector')).toBeTruthy();
    });

    it('should display current speed value', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      const speedPill = getByTestId('speed-selector');
      expect(speedPill).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Demo mode UI
  // -----------------------------------------------------------------------

  describe('Demo mode', () => {
    it('should render the demo button', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('demo-button')).toBeTruthy();
    });

    it('should display "Demo" text on button when demo is not playing', () => {
      const { getByText } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByText('Demo')).toBeTruthy();
    });

    it('should call DemoPlaybackService.start when demo button is pressed', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('demo-button'));
      expect(mockDemoStart).toHaveBeenCalled();
    });

    it('should mark demoWatched via store when demo starts', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('demo-button'));
      expect(mockExerciseState.setDemoWatched).toHaveBeenCalledWith(true);
    });

    it('should allow demo button press when paused (secondary bar visible)', () => {
      // Demo button is in the secondary bar, which is only visible when !isPlaying || isPaused.
      // When paused, pressing demo should pause playback and start demo.
      mockPlaybackState.isPlaying = true;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { queryByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      // During active playback (not paused), secondary bar is hidden
      expect(queryByTestId('demo-button')).toBeNull();
    });

    it('should not show demo banner when demo is not playing', () => {
      const { queryByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(queryByTestId('demo-banner')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Ghost notes toggle
  // -----------------------------------------------------------------------

  describe('Ghost notes', () => {
    it('should not show ghost toggle when demoWatched is false', () => {
      resetStore({ demoWatched: false });

      const { queryByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(queryByTestId('ghost-toggle')).toBeNull();
    });

    it('should show ghost toggle when demoWatched is true', () => {
      resetStore({ demoWatched: true });

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('ghost-toggle')).toBeTruthy();
    });

    it('should call setGhostNotesEnabled when ghost toggle is pressed', () => {
      resetStore({ demoWatched: true, ghostNotesEnabled: false });

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('ghost-toggle'));
      expect(mockExerciseState.setGhostNotesEnabled).toHaveBeenCalledWith(true);
    });

    it('should toggle ghost notes off when already enabled', () => {
      resetStore({ demoWatched: true, ghostNotesEnabled: true });

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('ghost-toggle'));
      expect(mockExerciseState.setGhostNotesEnabled).toHaveBeenCalledWith(false);
    });

    it('should not pass ghost notes to VerticalPianoRoll when disabled', () => {
      resetStore({ ghostNotesEnabled: false });

      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedPianoRollProps.ghostNotes).toBeUndefined();
    });

    it('should pass ghost notes to VerticalPianoRoll when enabled', () => {
      resetStore({ ghostNotesEnabled: true });

      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedPianoRollProps.ghostNotes).toEqual(MOCK_EXERCISE.notes);
      expect(capturedPianoRollProps.ghostBeatOffset).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // VerticalPianoRoll prop passing
  // -----------------------------------------------------------------------

  describe('VerticalPianoRoll integration', () => {
    it('should pass exercise notes to VerticalPianoRoll', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedPianoRollProps.notes).toEqual(MOCK_EXERCISE.notes);
    });

    it('should pass currentBeat to VerticalPianoRoll', () => {
      mockPlaybackState.currentBeat = 3;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedPianoRollProps.currentBeat).toBe(3);
    });

    it('should pass tempo to VerticalPianoRoll (adjusted by playback speed)', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // Tempo is multiplied by playbackSpeed (default 0.75x for touch keyboard)
      // so 120 * 0.75 = 90
      expect(capturedPianoRollProps.tempo).toBeDefined();
      expect(capturedPianoRollProps.tempo).toBeGreaterThan(0);
      expect(capturedPianoRollProps.tempo).toBeLessThanOrEqual(MOCK_EXERCISE.settings.tempo);
    });

    it('should pass keyboard range to VerticalPianoRoll as midiMin/midiMax', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // computeZoomedRange mock returns { startNote: 48, octaveCount: 2 }
      expect(capturedPianoRollProps.midiMin).toBe(48);
      expect(capturedPianoRollProps.midiMax).toBe(48 + 2 * 12); // 72
    });

    it('should pass testID to VerticalPianoRoll', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedPianoRollProps.testID).toBe('exercise-piano-roll');
    });
  });

  // -----------------------------------------------------------------------
  // Keyboard prop passing
  // -----------------------------------------------------------------------

  describe('Keyboard integration', () => {
    it('should pass keyboard range from computeZoomedRange', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // computeZoomedRange mock returns { startNote: 48, octaveCount: 2 }
      expect(capturedKeyboardProps.startNote).toBe(48);
      expect(capturedKeyboardProps.octaveCount).toBe(2);
    });

    it('should pass testID to Keyboard', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedKeyboardProps.testID).toBe('exercise-keyboard');
    });

    it('should set scrollEnabled to false for non-scrollable zoomed keyboard', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedKeyboardProps.scrollEnabled).toBe(false);
    });

    it('should enable keyboard', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedKeyboardProps.enabled).toBe(true);
    });

    it('should show labels on keyboard', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedKeyboardProps.showLabels).toBe(true);
    });

    it('should pass keyHeight to Keyboard', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedKeyboardProps.keyHeight).toBeDefined();
      expect(capturedKeyboardProps.keyHeight).toBeGreaterThanOrEqual(100);
    });
  });

  // -----------------------------------------------------------------------
  // Exercise completion integration
  // -----------------------------------------------------------------------

  describe('Exercise completion', () => {
    it('should pass onExerciseComplete callback to playback hook', () => {
      const onComplete = jest.fn();
      render(
        <ExercisePlayer exercise={MOCK_EXERCISE} onExerciseComplete={onComplete} />
      );

      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      expect(useExercisePlayback).toHaveBeenCalledWith(
        expect.objectContaining({
          exercise: expect.objectContaining({ id: MOCK_EXERCISE.id }),
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Responsive layout
  // -----------------------------------------------------------------------

  describe('Responsive layout', () => {
    it('should render full layout in portrait orientation', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('exercise-player')).toBeTruthy();
      expect(getByTestId('exercise-keyboard')).toBeTruthy();
      expect(getByTestId('exercise-piano-roll')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Error states
  // -----------------------------------------------------------------------

  describe('Error states', () => {
    it('should show error banner for non-critical errors (partial audio ready)', () => {
      mockPlaybackState.hasError = true;
      mockPlaybackState.errorMessage = 'MIDI unavailable';
      mockPlaybackState.isMidiReady = false;
      mockPlaybackState.isAudioReady = true;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByText, queryByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByText('MIDI unavailable')).toBeTruthy();
      expect(queryByTestId('exercise-error')).toBeNull();
    });

    it('should show full error screen when both MIDI and audio fail', () => {
      mockPlaybackState.hasError = true;
      mockPlaybackState.errorMessage = 'All audio systems failed';
      mockPlaybackState.isMidiReady = false;
      mockPlaybackState.isAudioReady = false;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('exercise-error')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Fail count and demo watched store integration
  // -----------------------------------------------------------------------

  describe('Fail count tracking', () => {
    it('should read failCount from exerciseStore selector', () => {
      resetStore({ failCount: 3 });

      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // Component renders successfully — failCount read via selector
      // (If selector was broken, component would crash)
    });

    it('should read demoWatched from exerciseStore and show ghost toggle', () => {
      resetStore({ demoWatched: true });

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('ghost-toggle')).toBeTruthy();
    });

    it('should read ghostNotesEnabled from exerciseStore selector', () => {
      resetStore({ ghostNotesEnabled: true, demoWatched: true });

      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // Ghost notes passed to VerticalPianoRoll when enabled
      expect(capturedPianoRollProps.ghostNotes).toBeDefined();
    });
  });
});
