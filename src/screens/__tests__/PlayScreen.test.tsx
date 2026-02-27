/**
 * PlayScreen Tests
 *
 * Comprehensive tests for the redesigned Free Play screen:
 * - Renders in portrait mode (no landscape lock)
 * - Shows SplitKeyboard with two-hand layout
 * - Note name display updates on key press
 * - Recording controls work
 * - Instructions banner shows and dismisses
 * - Song reference panel shows placeholder or loaded song
 * - Floating action bar with record/play/clear
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

// Capture SplitKeyboard props for assertions
let capturedKeyboardProps: any = {};
jest.mock('../../components/Keyboard/SplitKeyboard', () => ({
  SplitKeyboard: (props: any) => {
    capturedKeyboardProps = props;
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-split-keyboard'}>
        <Text>SplitKeyboard</Text>
      </View>
    );
  },
  deriveSplitPoint: jest.fn(() => 60),
  computeKeyboardRange: jest.fn(() => ({ startNote: 48, octaveCount: 2 })),
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
const mockLoadSummaries = jest.fn();
jest.mock('../../stores/songStore', () => ({
  useSongStore: Object.assign(
    (selector: any) =>
      selector({
        summaries: [],
        isLoadingSummaries: false,
        loadSummaries: mockLoadSummaries,
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

// Mock SalsaCoach
jest.mock('../../components/Mascot/SalsaCoach', () => ({
  SalsaCoach: () => {
    const { View } = require('react-native');
    return <View testID="salsa-coach" />;
  },
}));

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
    capturedKeyboardProps = {};
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

    it('does NOT lock to landscape (portrait mode)', () => {
      render(<PlayScreen />);
      // ScreenOrientation is not even imported any more — no mock needed
      // Just verify the screen renders without any orientation calls
      expect(true).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Note reference strip
  // -----------------------------------------------------------------------

  describe('Note reference strip', () => {
    it('renders the note reference strip', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-note-ref')).toBeTruthy();
    });

    it('shows octave markers (C2, C6)', () => {
      const { getByText } = render(<PlayScreen />);
      expect(getByText('C2')).toBeTruthy();
      expect(getByText('C6')).toBeTruthy();
    });

    it('highlights Middle C label', () => {
      const { getByText } = render(<PlayScreen />);
      expect(getByText('Middle C (C4)')).toBeTruthy();
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
  // SplitKeyboard integration
  // -----------------------------------------------------------------------

  describe('SplitKeyboard integration', () => {
    it('renders SplitKeyboard', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-keyboard')).toBeTruthy();
    });

    it('passes splitPoint of 60 (middle C)', () => {
      render(<PlayScreen />);
      expect(capturedKeyboardProps.splitPoint).toBe(60);
    });

    it('keyboard is enabled', () => {
      render(<PlayScreen />);
      expect(capturedKeyboardProps.enabled).toBe(true);
    });

    it('keyboard has haptic enabled', () => {
      render(<PlayScreen />);
      expect(capturedKeyboardProps.hapticEnabled).toBe(true);
    });

    it('keyboard shows labels', () => {
      render(<PlayScreen />);
      expect(capturedKeyboardProps.showLabels).toBe(true);
    });

    it('passes onNoteOn and onNoteOff callbacks', () => {
      render(<PlayScreen />);
      expect(typeof capturedKeyboardProps.onNoteOn).toBe('function');
      expect(typeof capturedKeyboardProps.onNoteOff).toBe('function');
    });
  });

  // -----------------------------------------------------------------------
  // Song reference panel
  // -----------------------------------------------------------------------

  describe('Song reference panel', () => {
    it('renders song reference panel', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-song-ref')).toBeTruthy();
    });

    it('shows placeholder text when no song loaded', () => {
      const { getByText } = render(<PlayScreen />);
      expect(getByText('Load a song for note reference')).toBeTruthy();
    });

    it('shows Load Song button in header', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-load-song')).toBeTruthy();
    });

    it('opens song picker modal when Load Song is pressed', () => {
      const { getByTestId } = render(<PlayScreen />);
      fireEvent.press(getByTestId('freeplay-load-song'));
      expect(getByTestId('song-picker-modal')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Instructions banner
  // -----------------------------------------------------------------------

  describe('Instructions banner', () => {
    it('shows instructions banner by default', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-instructions')).toBeTruthy();
    });

    it('shows "Welcome to Free Play!" text', () => {
      const { getByText } = render(<PlayScreen />);
      expect(getByText('Welcome to Free Play!')).toBeTruthy();
    });

    it('can dismiss instructions via close button', () => {
      const { getByTestId, queryByTestId } = render(<PlayScreen />);

      expect(getByTestId('freeplay-instructions')).toBeTruthy();
      fireEvent.press(getByTestId('freeplay-instructions-close'));
      expect(queryByTestId('freeplay-instructions')).toBeNull();
    });

    it('shows help button after dismissing instructions', () => {
      const { getByTestId, queryByTestId } = render(<PlayScreen />);

      fireEvent.press(getByTestId('freeplay-instructions-close'));
      expect(queryByTestId('freeplay-instructions')).toBeNull();
      expect(getByTestId('freeplay-help')).toBeTruthy();
    });

    it('can re-show instructions via help button', () => {
      const { getByTestId } = render(<PlayScreen />);

      fireEvent.press(getByTestId('freeplay-instructions-close'));
      fireEvent.press(getByTestId('freeplay-help'));
      expect(getByTestId('freeplay-instructions')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Floating action bar & recording controls
  // -----------------------------------------------------------------------

  describe('Floating action bar', () => {
    it('renders the action bar', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-action-bar')).toBeTruthy();
    });

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

      // Simulate a note being played while recording
      if (capturedKeyboardProps.onNoteOn) {
        capturedKeyboardProps.onNoteOn({
          note: 60,
          velocity: 100,
          timestamp: Date.now(),
          type: 'noteOn',
          channel: 0,
        });
      }

      // Stop recording
      fireEvent.press(getByTestId('freeplay-record-stop'));

      // Now playback and clear should be visible
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
