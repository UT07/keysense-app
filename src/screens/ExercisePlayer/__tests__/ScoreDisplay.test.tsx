/**
 * ScoreDisplay Component Tests
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { ScoreDisplay } from '../ScoreDisplay';
import type { Exercise } from '../../../core/exercises/types';

const MOCK_EXERCISE: Exercise = {
  id: 'test',
  version: 1,
  metadata: {
    title: 'Test',
    description: 'Test',
    difficulty: 2,
    estimatedMinutes: 2,
    skills: ['test'],
    prerequisites: [],
  },
  settings: {
    tempo: 120,
    timeSignature: [4, 4],
    keySignature: 'C',
    countIn: 4,
    metronomeEnabled: true,
  },
  notes: [
    { note: 60, startBeat: 0, durationBeats: 1 },
    { note: 64, startBeat: 2, durationBeats: 1 },
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

describe('ScoreDisplay', () => {
  it('should render title and difficulty', () => {
    const { getByText } = render(
      <ScoreDisplay
        exercise={MOCK_EXERCISE}
        currentBeat={0}
        combo={0}
        feedback={null}
        comboAnimValue={new Animated.Value(0)}
      />
    );

    expect(getByText('Test')).toBeTruthy();
    expect(getByText('⭐⭐')).toBeTruthy();
  });

  it('should display tempo and time signature', () => {
    const { getByText } = render(
      <ScoreDisplay
        exercise={MOCK_EXERCISE}
        currentBeat={0}
        combo={0}
        feedback={null}
        comboAnimValue={new Animated.Value(0)}
      />
    );

    expect(getByText('120 BPM • 4/4')).toBeTruthy();
  });

  it('should show current beat', () => {
    const { getByText } = render(
      <ScoreDisplay
        exercise={MOCK_EXERCISE}
        currentBeat={2.5}
        combo={0}
        feedback={null}
        comboAnimValue={new Animated.Value(0)}
      />
    );

    expect(getByText('Beat 3')).toBeTruthy();
  });

  it('should display progress percentage', () => {
    // Exercise has notes at beat 0 (dur 1) and beat 2 (dur 1), so duration = 3.
    // At currentBeat=1: progress = (1/3)*100 = 33%
    const { getByText } = render(
      <ScoreDisplay
        exercise={MOCK_EXERCISE}
        currentBeat={1}
        combo={0}
        feedback={null}
        comboAnimValue={new Animated.Value(0)}
      />
    );

    expect(getByText('33%')).toBeTruthy();
  });

  it('should show combo counter when combo > 0', () => {
    const { getByText } = render(
      <ScoreDisplay
        exercise={MOCK_EXERCISE}
        currentBeat={0}
        combo={5}
        feedback={null}
        comboAnimValue={new Animated.Value(0)}
      />
    );

    expect(getByText('Combo')).toBeTruthy();
    expect(getByText('5')).toBeTruthy();
  });

  it('should show feedback badge when feedback is provided', () => {
    const { getByText } = render(
      <ScoreDisplay
        exercise={MOCK_EXERCISE}
        currentBeat={0}
        combo={0}
        feedback="perfect"
        comboAnimValue={new Animated.Value(0)}
      />
    );

    expect(getByText('Perfect!')).toBeTruthy();
  });

  it('should show correct feedback text for different types', () => {
    const feedbackTypes: Array<'perfect' | 'good' | 'ok' | 'early' | 'late' | 'miss'> = [
      'perfect',
      'good',
      'ok',
      'early',
      'late',
      'miss',
    ];

    const expectedTexts = [
      'Perfect!',
      'Good!',
      'OK',
      'Early',
      'Late',
      'Missed',
    ];

    feedbackTypes.forEach((type, index) => {
      const { getByText, unmount } = render(
        <ScoreDisplay
          exercise={MOCK_EXERCISE}
          currentBeat={0}
          combo={0}
          feedback={type}
          comboAnimValue={new Animated.Value(0)}
        />
      );

      expect(getByText(expectedTexts[index])).toBeTruthy();
      unmount();
    });
  });

  it('should update progress bar width based on currentBeat', () => {
    const { getByTestId } = render(
      <ScoreDisplay
        exercise={MOCK_EXERCISE}
        currentBeat={1}
        combo={0}
        feedback={null}
        comboAnimValue={new Animated.Value(0)}
        testID="exercise-score-display"
      />
    );

    expect(getByTestId('exercise-score-display')).toBeTruthy();
  });

  it('should clamp progress to 100%', () => {
    const { getByText } = render(
      <ScoreDisplay
        exercise={MOCK_EXERCISE}
        currentBeat={100}
        combo={0}
        feedback={null}
        comboAnimValue={new Animated.Value(0)}
      />
    );

    expect(getByText('100%')).toBeTruthy();
  });

  it('should display negative beat during count-in', () => {
    // Math.ceil(Math.max(0, -2)) = Math.ceil(0) = 0
    const { getByText } = render(
      <ScoreDisplay
        exercise={MOCK_EXERCISE}
        currentBeat={-2}
        combo={0}
        feedback={null}
        comboAnimValue={new Animated.Value(0)}
      />
    );

    expect(getByText('Beat 0')).toBeTruthy();
  });
});
