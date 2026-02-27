/**
 * PlayScreen Tests
 *
 * Tests for the landscape Free Play screen:
 * - Locks to landscape on mount, restores portrait on unmount
 * - Side-by-side keyboards (left = C2-B3, right = C4-C6)
 * - Note name display updates on key press
 * - Recording controls work (record/stop/play/clear)
 * - Song reference picker opens on button press
 * - Analysis card and drill generation
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks (MUST come before component import)
// ---------------------------------------------------------------------------

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      dispatch: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    }),
    useFocusEffect: (cb: () => (() => void) | void) => {
      const cleanup = cb();
      if (typeof cleanup === 'function') cleanup();
    },
  };
});

// expo-screen-orientation is globally mocked in jest.setup.js
import * as ScreenOrientation from 'expo-screen-orientation';

// Mock audio engine
const mockPlayNote = jest.fn(() => ({
  note: 60,
  startTime: 0,
  release: jest.fn(),
}));
const mockReleaseNote = jest.fn();
const mockReleaseAllNotes = jest.fn();
const mockInitialize = jest.fn().mockResolvedValue(undefined);

jest.mock('../../audio/createAudioEngine', () => ({
  createAudioEngine: jest.fn(() => ({
    isReady: () => true,
    initialize: mockInitialize,
    playNote: mockPlayNote,
    releaseNote: mockReleaseNote,
    releaseAllNotes: mockReleaseAllNotes,
    dispose: jest.fn(),
  })),
}));

// Capture left and right keyboard props
let capturedLeftProps: any = {};
let capturedRightProps: any = {};
jest.mock('../../components/Keyboard/Keyboard', () => ({
  Keyboard: (props: any) => {
    if (props.testID === 'freeplay-keyboard-left') capturedLeftProps = props;
    if (props.testID === 'freeplay-keyboard-right') capturedRightProps = props;
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-keyboard'}>
        <Text>Keyboard</Text>
      </View>
    );
  },
}));

// Mock SongReferencePicker
jest.mock('../../components/SongReferencePicker', () => ({
  SongReferencePicker: (props: any) => {
    const { View } = require('react-native');
    return props.visible ? <View testID="song-picker-modal" /> : null;
  },
}));

// Mock InputManager (avoids react-native-audio-api native import)
jest.mock('../../input/InputManager', () => ({
  InputManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn(),
    onNoteEvent: jest.fn(() => jest.fn()),
    activeMethod: 'touch',
    getIsInitialized: () => true,
    getIsStarted: () => false,
    getTimingMultiplier: () => 1.0,
    getLatencyCompensationMs: () => 0,
  })),
  INPUT_TIMING_MULTIPLIERS: { midi: 1.0, touch: 1.0, mic: 1.5 },
  INPUT_LATENCY_COMPENSATION_MS: { midi: 0, touch: 20, mic: 100 },
}));

// Mock settingsStore
jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    (selector: any) => selector({ preferredInputMethod: 'touch' }),
    { getState: () => ({ preferredInputMethod: 'touch' }) },
  ),
}));

// Mock songStore
const mockLoadSong = jest.fn();
jest.mock('../../stores/songStore', () => ({
  useSongStore: Object.assign(
    (selector: any) =>
      selector({
        summaries: [],
        isLoadingSummaries: false,
        loadSummaries: jest.fn(),
        currentSong: null,
        isLoadingSong: false,
        loadSong: mockLoadSong,
      }),
    { getState: () => ({ summaries: [], currentSong: null }) },
  ),
}));

// Mock vector icons
jest.mock('@expo/vector-icons', () => {
  const { View, Text } = require('react-native');
  return {
    MaterialCommunityIcons: (props: any) => (
      <View testID={`icon-${props.name}`}>
        <Text>{props.name}</Text>
      </View>
    ),
  };
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { PlayScreen } from '../PlayScreen';

// ===========================================================================
// Tests
// ===========================================================================

describe('PlayScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedLeftProps = {};
    capturedRightProps = {};
  });

  // -----------------------------------------------------------------------
  // Core rendering
  // -----------------------------------------------------------------------

  describe('Core rendering', () => {
    it('renders the play screen container', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('play-screen')).toBeTruthy();
    });

    it('shows "Free Play" title', () => {
      const { getByText } = render(<PlayScreen />);
      expect(getByText('Free Play')).toBeTruthy();
    });

    it('shows back button', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-back')).toBeTruthy();
    });

    it('back button calls navigation.goBack', () => {
      const { getByTestId } = render(<PlayScreen />);
      fireEvent.press(getByTestId('freeplay-back'));
      expect(mockGoBack).toHaveBeenCalled();
    });

    it('locks to landscape on mount', () => {
      render(<PlayScreen />);
      expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
        ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Side-by-side keyboards
  // -----------------------------------------------------------------------

  describe('Side-by-side keyboards', () => {
    it('renders left keyboard', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-keyboard-left')).toBeTruthy();
    });

    it('renders right keyboard', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-keyboard-right')).toBeTruthy();
    });

    it('left keyboard starts at C2 (MIDI 36)', () => {
      render(<PlayScreen />);
      expect(capturedLeftProps.startNote).toBe(36);
    });

    it('left keyboard has 2 octaves', () => {
      render(<PlayScreen />);
      expect(capturedLeftProps.octaveCount).toBe(2);
    });

    it('right keyboard starts at C4 (MIDI 60)', () => {
      render(<PlayScreen />);
      expect(capturedRightProps.startNote).toBe(60);
    });

    it('right keyboard has 2 octaves', () => {
      render(<PlayScreen />);
      expect(capturedRightProps.octaveCount).toBe(2);
    });

    it('both keyboards are enabled', () => {
      render(<PlayScreen />);
      expect(capturedLeftProps.enabled).toBe(true);
      expect(capturedRightProps.enabled).toBe(true);
    });

    it('both keyboards have haptic enabled', () => {
      render(<PlayScreen />);
      expect(capturedLeftProps.hapticEnabled).toBe(true);
      expect(capturedRightProps.hapticEnabled).toBe(true);
    });

    it('both keyboards show labels', () => {
      render(<PlayScreen />);
      expect(capturedLeftProps.showLabels).toBe(true);
      expect(capturedRightProps.showLabels).toBe(true);
    });

    it('both keyboards have note event callbacks', () => {
      render(<PlayScreen />);
      expect(typeof capturedLeftProps.onNoteOn).toBe('function');
      expect(typeof capturedLeftProps.onNoteOff).toBe('function');
      expect(typeof capturedRightProps.onNoteOn).toBe('function');
      expect(typeof capturedRightProps.onNoteOff).toBe('function');
    });
  });

  // -----------------------------------------------------------------------
  // Note display
  // -----------------------------------------------------------------------

  describe('Note display', () => {
    it('renders note display container', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-note-display-container')).toBeTruthy();
    });

    it('shows em dash when no note is pressed', () => {
      const { getByTestId } = render(<PlayScreen />);
      const display = getByTestId('freeplay-note-display');
      expect(display.props.children).toBe('\u2014');
    });
  });

  // -----------------------------------------------------------------------
  // Song reference
  // -----------------------------------------------------------------------

  describe('Song reference', () => {
    it('shows load song button', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-load-song')).toBeTruthy();
    });

    it('opens song picker modal when button is pressed', () => {
      const { getByTestId } = render(<PlayScreen />);
      fireEvent.press(getByTestId('freeplay-load-song'));
      expect(getByTestId('song-picker-modal')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Recording controls
  // -----------------------------------------------------------------------

  describe('Recording controls', () => {
    it('shows record button initially', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-record-start')).toBeTruthy();
    });

    it('shows stop button when recording', () => {
      const { getByTestId, queryByTestId } = render(<PlayScreen />);

      fireEvent.press(getByTestId('freeplay-record-start'));
      expect(getByTestId('freeplay-record-stop')).toBeTruthy();
      expect(queryByTestId('freeplay-record-start')).toBeNull();
    });

    it('shows playback and clear buttons after recording notes', () => {
      const { getByTestId } = render(<PlayScreen />);

      // Start recording
      fireEvent.press(getByTestId('freeplay-record-start'));

      // Simulate a note via left keyboard onNoteOn
      if (capturedLeftProps.onNoteOn) {
        capturedLeftProps.onNoteOn({
          note: 48,
          velocity: 100,
          timestamp: Date.now(),
          type: 'noteOn',
          channel: 0,
        });
      }

      // Stop recording
      fireEvent.press(getByTestId('freeplay-record-stop'));

      // Playback and clear should be visible
      expect(getByTestId('freeplay-record-playback')).toBeTruthy();
      expect(getByTestId('freeplay-record-clear')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Session stats
  // -----------------------------------------------------------------------

  describe('Session stats', () => {
    it('shows "0 notes" initially', () => {
      const { getByText } = render(<PlayScreen />);
      expect(getByText('0 notes')).toBeTruthy();
    });
  });
});
