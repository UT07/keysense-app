/**
 * ExerciseLoadingScreen Tests
 *
 * Tests the loading interstitial: visibility, content display,
 * minimum display timer, and onReady callback logic.
 */

import React from 'react';
import { render, act } from '@testing-library/react-native';
import { ExerciseLoadingScreen } from '../ExerciseLoadingScreen';

// Mock dependencies
jest.mock('../../../components/Mascot/SalsaCoach', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SalsaCoach: (props: any) =>
      React.createElement(View, { testID: 'salsa-coach', ...props }),
  };
});

jest.mock('../../../components/FunFact/FunFactCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    FunFactCard: (props: any) =>
      React.createElement(View, { testID: props.testID || 'fun-fact-card' }),
  };
});

jest.mock('../../../content/funFactSelector', () => ({
  getRandomFact: jest.fn(() => ({
    id: 'test-fact',
    text: 'Piano has 88 keys',
    category: 'history',
    difficulty: 'beginner',
  })),
}));

jest.mock('../../../content/loadingTips', () => ({
  getRandomLoadingTip: jest.fn(() => 'Relax your shoulders!'),
}));

describe('ExerciseLoadingScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders content when visible=true', () => {
    const { getByTestId, getByText } = render(
      <ExerciseLoadingScreen visible={true} exerciseReady={false} onReady={jest.fn()} />,
    );
    expect(getByTestId('exercise-loading-screen')).toBeTruthy();
    expect(getByText('Preparing your exercise...')).toBeTruthy();
  });

  it('returns null when visible=false', () => {
    const { queryByTestId } = render(
      <ExerciseLoadingScreen visible={false} exerciseReady={false} onReady={jest.fn()} />,
    );
    expect(queryByTestId('exercise-loading-screen')).toBeNull();
  });

  it('shows SalsaCoach component', () => {
    const { getByTestId } = render(
      <ExerciseLoadingScreen visible={true} exerciseReady={false} onReady={jest.fn()} />,
    );
    expect(getByTestId('salsa-coach')).toBeTruthy();
  });

  it('shows either a fun fact card or loading tip text', () => {
    // Math.random is used to pick between fun fact and tip — we test both paths
    const spy = jest.spyOn(Math, 'random');

    // Force fun fact path (random < 0.5)
    spy.mockReturnValue(0.1);
    const { getByTestId, unmount } = render(
      <ExerciseLoadingScreen visible={true} exerciseReady={false} onReady={jest.fn()} />,
    );
    expect(getByTestId('fun-fact-card')).toBeTruthy();
    unmount();

    // Force tip path (random >= 0.5)
    spy.mockReturnValue(0.9);
    const { getByTestId: getByTestId2 } = render(
      <ExerciseLoadingScreen visible={true} exerciseReady={false} onReady={jest.fn()} />,
    );
    expect(getByTestId2('loading-tip')).toBeTruthy();

    spy.mockRestore();
  });

  it('calls onReady after minimum delay when exerciseReady=true', () => {
    const onReady = jest.fn();
    render(
      <ExerciseLoadingScreen visible={true} exerciseReady={true} onReady={onReady} />,
    );

    // Before timer: should NOT have called onReady
    expect(onReady).not.toHaveBeenCalled();

    // Advance past minimum display time (1000ms)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onReady before minimum delay even if exerciseReady=true', () => {
    const onReady = jest.fn();
    render(
      <ExerciseLoadingScreen visible={true} exerciseReady={true} onReady={onReady} />,
    );

    // Advance only 500ms — still under 1s minimum
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onReady).not.toHaveBeenCalled();
  });

  it('calls onReady when exerciseReady becomes true after timer', () => {
    const onReady = jest.fn();
    const { rerender } = render(
      <ExerciseLoadingScreen visible={true} exerciseReady={false} onReady={onReady} />,
    );

    // Timer elapses but exercise not ready
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onReady).not.toHaveBeenCalled();

    // Now exercise becomes ready
    rerender(
      <ExerciseLoadingScreen visible={true} exerciseReady={true} onReady={onReady} />,
    );
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
