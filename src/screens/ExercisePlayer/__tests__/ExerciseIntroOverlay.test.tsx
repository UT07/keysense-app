/**
 * ExerciseIntroOverlay Tests
 *
 * Tests the pre-exercise info card: title, description, tempo/key/time/hand
 * info grid, note count, difficulty stars, hint display, and Ready button.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ExerciseIntroOverlay } from '../ExerciseIntroOverlay';

const MOCK_EXERCISE = {
  id: 'test-ex',
  version: 1,
  metadata: {
    title: 'Find Middle C',
    description: 'Learn where middle C lives on the keyboard',
    difficulty: 2,
    estimatedMinutes: 5,
    skills: ['notes'],
  },
  settings: {
    tempo: 80,
    keySignature: 'C major',
    timeSignature: [4, 4] as [number, number],
    countIn: 4,
    loopCount: 1,
  },
  notes: [
    { midi: 60, beat: 0, duration: 1, hand: 'right' as const },
    { midi: 62, beat: 1, duration: 1, hand: 'right' as const },
    { midi: 64, beat: 2, duration: 1, hand: 'right' as const },
  ],
  hints: {
    beforeStart: 'Find the two black keys and go one white key to the left',
    commonMistakes: [],
    successMessage: 'Great job!',
  },
  scoring: { passingScore: 70, maxCombo: 3 },
};

describe('ExerciseIntroOverlay', () => {
  const mockOnReady = jest.fn();

  beforeEach(() => mockOnReady.mockClear());

  it('renders exercise title', () => {
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} />,
    );
    expect(getByText('Find Middle C')).toBeTruthy();
  });

  it('renders exercise description', () => {
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} />,
    );
    expect(getByText('Learn where middle C lives on the keyboard')).toBeTruthy();
  });

  it('renders tempo', () => {
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} />,
    );
    expect(getByText('80 BPM')).toBeTruthy();
  });

  it('renders key signature', () => {
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} />,
    );
    expect(getByText('C major')).toBeTruthy();
  });

  it('renders time signature', () => {
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} />,
    );
    expect(getByText('4/4')).toBeTruthy();
  });

  it('renders hand indicator (right hand only)', () => {
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} />,
    );
    expect(getByText('Right hand')).toBeTruthy();
  });

  it('renders note count', () => {
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} />,
    );
    expect(getByText('3 notes')).toBeTruthy();
  });

  it('renders difficulty stars (2 filled, 3 empty)', () => {
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} />,
    );
    expect(getByText('★★☆☆☆')).toBeTruthy();
  });

  it('renders beforeStart hint', () => {
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} />,
    );
    expect(getByText('Find the two black keys and go one white key to the left')).toBeTruthy();
  });

  it('renders Ready button', () => {
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} />,
    );
    expect(getByText('Ready')).toBeTruthy();
  });

  it('calls onReady when Ready button is pressed', () => {
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} />,
    );
    fireEvent.press(getByText('Ready'));
    expect(mockOnReady).toHaveBeenCalledTimes(1);
  });

  it('renders testID when provided', () => {
    const { getByTestId } = render(
      <ExerciseIntroOverlay exercise={MOCK_EXERCISE as any} onReady={mockOnReady} testID="intro" />,
    );
    expect(getByTestId('intro')).toBeTruthy();
    expect(getByTestId('intro-ready')).toBeTruthy();
  });

  it('detects "Both hands" when exercise has left and right notes', () => {
    const bothHandsExercise = {
      ...MOCK_EXERCISE,
      notes: [
        { midi: 60, beat: 0, duration: 1, hand: 'right' as const },
        { midi: 48, beat: 1, duration: 1, hand: 'left' as const },
      ],
    };
    const { getByText } = render(
      <ExerciseIntroOverlay exercise={bothHandsExercise as any} onReady={mockOnReady} />,
    );
    expect(getByText('Both hands')).toBeTruthy();
  });

  it('hides hint tip when no beforeStart hint', () => {
    const noHintExercise = {
      ...MOCK_EXERCISE,
      hints: { beforeStart: undefined, commonMistakes: [], successMessage: '' },
    };
    const { queryByText } = render(
      <ExerciseIntroOverlay exercise={noHintExercise as any} onReady={mockOnReady} />,
    );
    expect(queryByText('Find the two black keys')).toBeNull();
  });
});
