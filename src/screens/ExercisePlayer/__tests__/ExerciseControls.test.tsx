/**
 * ExerciseControls Component Tests
 * Tests play/pause/resume, restart, exit buttons, and compact mode
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ExerciseControls } from '../ExerciseControls';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: {
      View: React.forwardRef((props: any, ref: any) =>
        React.createElement(View, { ...props, ref })
      ),
      Text: React.forwardRef((props: any, ref: any) =>
        React.createElement(Text, { ...props, ref })
      ),
      createAnimatedComponent: (Component: any) => Component,
    },
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: (fn: any) => fn(),
    withTiming: (val: any) => val,
    withSpring: (val: any) => val,
    withDelay: (_d: any, val: any) => val,
    withRepeat: (val: any) => val,
    withSequence: (...args: any[]) => args[args.length - 1],
    Easing: {
      out: (fn: any) => fn,
      cubic: (t: any) => t,
      linear: (t: any) => t,
      in: (fn: any) => fn,
    },
    FadeIn: { duration: () => ({ delay: () => ({}) }) },
    runOnJS: (fn: any) => fn,
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExerciseControls', () => {
  const defaultProps = {
    isPlaying: false,
    isPaused: false,
    onStart: jest.fn(),
    onPause: jest.fn(),
    onRestart: jest.fn(),
    onExit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Full mode tests ---

  // 1. Shows Play button when not playing
  it('shows Play button when not playing', () => {
    const { getByTestId, getByText } = render(
      <ExerciseControls {...defaultProps} isPlaying={false} />
    );

    const playBtn = getByTestId('control-play');
    expect(playBtn).toBeTruthy();
    // Button renders icon name + title in a single Text node: "play Play"
    // Use substring match to find "Play" in the combined text
    expect(getByText(/Play/)).toBeTruthy();
  });

  // 2. Shows Pause button when playing and not paused
  it('shows Pause button when playing and not paused', () => {
    const { getByTestId, getByText } = render(
      <ExerciseControls {...defaultProps} isPlaying={true} isPaused={false} />
    );

    const pauseBtn = getByTestId('control-pause');
    expect(pauseBtn).toBeTruthy();
    expect(getByText(/Pause/)).toBeTruthy();
  });

  // 3. Shows Resume button when paused
  it('shows Resume button when paused', () => {
    const { getByTestId, getByText } = render(
      <ExerciseControls {...defaultProps} isPlaying={true} isPaused={true} />
    );

    const resumeBtn = getByTestId('control-pause');
    expect(resumeBtn).toBeTruthy();
    expect(getByText(/Resume/)).toBeTruthy();
  });

  // 4. Restart button calls onRestart
  it('calls onRestart when restart button is pressed', () => {
    const onRestart = jest.fn();
    const { getByTestId } = render(
      <ExerciseControls
        {...defaultProps}
        isPlaying={true}
        isPaused={false}
        onRestart={onRestart}
      />
    );

    const restartBtn = getByTestId('control-restart');
    fireEvent.press(restartBtn);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  // 5. Exit button calls onExit
  it('calls onExit when exit button is pressed', () => {
    const onExit = jest.fn();
    const { getByTestId } = render(
      <ExerciseControls {...defaultProps} onExit={onExit} />
    );

    const exitBtn = getByTestId('control-exit');
    fireEvent.press(exitBtn);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  // 6. Compact mode renders smaller buttons
  it('renders compact mode with smaller TouchableOpacity buttons', () => {
    const { getByTestId } = render(
      <ExerciseControls {...defaultProps} compact={true} testID="exercise-controls" />
    );

    // Compact mode uses the compactContainer style
    const container = getByTestId('exercise-controls');
    expect(container).toBeTruthy();

    // Play button should be present in compact mode
    const playBtn = getByTestId('control-play');
    expect(playBtn).toBeTruthy();
  });

  // --- Additional button interaction tests ---

  it('calls onStart when Play button is pressed', () => {
    const onStart = jest.fn();
    const { getByTestId } = render(
      <ExerciseControls {...defaultProps} onStart={onStart} isPlaying={false} />
    );

    fireEvent.press(getByTestId('control-play'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('calls onPause when Pause button is pressed', () => {
    const onPause = jest.fn();
    const { getByTestId } = render(
      <ExerciseControls
        {...defaultProps}
        isPlaying={true}
        isPaused={false}
        onPause={onPause}
      />
    );

    fireEvent.press(getByTestId('control-pause'));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('calls onPause (resume handler) when Resume button is pressed', () => {
    const onPause = jest.fn();
    const { getByTestId } = render(
      <ExerciseControls
        {...defaultProps}
        isPlaying={true}
        isPaused={true}
        onPause={onPause}
      />
    );

    fireEvent.press(getByTestId('control-pause'));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  // --- Visibility tests ---

  it('hides Restart button when not playing', () => {
    const { queryByTestId } = render(
      <ExerciseControls {...defaultProps} isPlaying={false} />
    );

    expect(queryByTestId('control-restart')).toBeNull();
  });

  it('shows Restart button when playing', () => {
    const { getByTestId } = render(
      <ExerciseControls {...defaultProps} isPlaying={true} />
    );

    expect(getByTestId('control-restart')).toBeTruthy();
  });

  it('always shows Exit button regardless of playing state', () => {
    // Not playing
    const { getByTestId: getByTestId1 } = render(
      <ExerciseControls {...defaultProps} isPlaying={false} />
    );
    expect(getByTestId1('control-exit')).toBeTruthy();

    // Playing
    const { getByTestId: getByTestId2 } = render(
      <ExerciseControls {...defaultProps} isPlaying={true} />
    );
    expect(getByTestId2('control-exit')).toBeTruthy();
  });

  // --- Compact mode specific tests ---

  it('compact mode shows pause button when playing', () => {
    const { getByTestId } = render(
      <ExerciseControls
        {...defaultProps}
        compact={true}
        isPlaying={true}
        isPaused={false}
      />
    );

    expect(getByTestId('control-pause')).toBeTruthy();
  });

  it('compact mode shows restart when playing', () => {
    const { getByTestId } = render(
      <ExerciseControls
        {...defaultProps}
        compact={true}
        isPlaying={true}
      />
    );

    expect(getByTestId('control-restart')).toBeTruthy();
  });

  it('compact mode hides restart when not playing', () => {
    const { queryByTestId } = render(
      <ExerciseControls
        {...defaultProps}
        compact={true}
        isPlaying={false}
      />
    );

    expect(queryByTestId('control-restart')).toBeNull();
  });

  it('compact mode always shows exit button', () => {
    const { getByTestId } = render(
      <ExerciseControls
        {...defaultProps}
        compact={true}
        isPlaying={false}
      />
    );

    expect(getByTestId('control-exit')).toBeTruthy();
  });

  it('compact mode calls onRestart when restart is pressed', () => {
    const onRestart = jest.fn();
    const { getByTestId } = render(
      <ExerciseControls
        {...defaultProps}
        compact={true}
        isPlaying={true}
        onRestart={onRestart}
      />
    );

    fireEvent.press(getByTestId('control-restart'));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('compact mode calls onExit when exit is pressed', () => {
    const onExit = jest.fn();
    const { getByTestId } = render(
      <ExerciseControls
        {...defaultProps}
        compact={true}
        onExit={onExit}
      />
    );

    fireEvent.press(getByTestId('control-exit'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  // --- Compact mode accessibility (labels are set directly on TouchableOpacity) ---

  it('compact mode Play button has correct accessibility label', () => {
    const { getByTestId } = render(
      <ExerciseControls {...defaultProps} compact={true} isPlaying={false} />
    );

    const playBtn = getByTestId('control-play');
    expect(playBtn.props.accessibilityLabel).toBe('Play exercise');
  });

  it('compact mode Pause has accessibility label reflecting pause state', () => {
    const { getByTestId } = render(
      <ExerciseControls {...defaultProps} compact={true} isPlaying={true} isPaused={false} />
    );

    const pauseBtn = getByTestId('control-pause');
    expect(pauseBtn.props.accessibilityLabel).toBe('Pause');
  });

  it('compact mode Resume has accessibility label reflecting paused state', () => {
    const { getByTestId } = render(
      <ExerciseControls {...defaultProps} compact={true} isPlaying={true} isPaused={true} />
    );

    const resumeBtn = getByTestId('control-pause');
    expect(resumeBtn.props.accessibilityLabel).toBe('Resume');
  });
});
