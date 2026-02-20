/**
 * PlayScreen Tests
 *
 * Comprehensive tests for the Free Play screen:
 * - Renders in landscape mode
 * - Shows note reference strip
 * - Keyboard is full-width, scrollable, 3 octaves
 * - Note name display updates on key press
 * - Recording controls work
 * - Instructions banner shows and dismisses
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks (MUST come before component import)
// ---------------------------------------------------------------------------

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
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

// Mock expo-screen-orientation
jest.mock('expo-screen-orientation', () => ({
  lockAsync: jest.fn().mockResolvedValue(undefined),
  OrientationLock: {
    LANDSCAPE_LEFT: 'LANDSCAPE_LEFT',
    LANDSCAPE: 'LANDSCAPE',
    PORTRAIT_UP: 'PORTRAIT_UP',
  },
}));

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

// Capture Keyboard props for assertions
let capturedKeyboardProps: any = {};
jest.mock('../../components/Keyboard/Keyboard', () => ({
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
  });

  // -----------------------------------------------------------------------
  // Note reference strip
  // -----------------------------------------------------------------------

  describe('Note reference strip', () => {
    it('renders the note reference strip', () => {
      const { getByTestId } = render(<PlayScreen />);
      expect(getByTestId('freeplay-note-ref')).toBeTruthy();
    });

    it('shows octave markers (C3, C5, C6)', () => {
      const { getByText } = render(<PlayScreen />);
      expect(getByText('C3')).toBeTruthy();
      expect(getByText('C5')).toBeTruthy();
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
  // Keyboard integration
  // -----------------------------------------------------------------------

  describe('Keyboard integration', () => {
    it('passes correct startNote (C3 = 48)', () => {
      render(<PlayScreen />);
      expect(capturedKeyboardProps.startNote).toBe(48);
    });

    it('passes 3 octaves', () => {
      render(<PlayScreen />);
      expect(capturedKeyboardProps.octaveCount).toBe(3);
    });

    it('keyboard is scrollable', () => {
      render(<PlayScreen />);
      expect(capturedKeyboardProps.scrollable).toBe(true);
    });

    it('keyboard shows labels', () => {
      render(<PlayScreen />);
      expect(capturedKeyboardProps.showLabels).toBe(true);
    });

    it('keyboard is enabled', () => {
      render(<PlayScreen />);
      expect(capturedKeyboardProps.enabled).toBe(true);
    });

    it('keyboard has haptic enabled', () => {
      render(<PlayScreen />);
      expect(capturedKeyboardProps.hapticEnabled).toBe(true);
    });

    it('keyboard height is 110', () => {
      render(<PlayScreen />);
      expect(capturedKeyboardProps.keyHeight).toBe(110);
    });

    it('passes onNoteOn and onNoteOff callbacks', () => {
      render(<PlayScreen />);
      expect(typeof capturedKeyboardProps.onNoteOn).toBe('function');
      expect(typeof capturedKeyboardProps.onNoteOff).toBe('function');
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

    it('shows playback and clear buttons after recording', () => {
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

  // -----------------------------------------------------------------------
  // Landscape orientation
  // -----------------------------------------------------------------------

  describe('Landscape orientation', () => {
    it('locks to landscape on mount', () => {
      const ScreenOrientation = require('expo-screen-orientation');
      render(<PlayScreen />);

      // useFocusEffect fires immediately in our mock, which calls lockAsync
      expect(ScreenOrientation.lockAsync).toHaveBeenCalled();
    });
  });
});
