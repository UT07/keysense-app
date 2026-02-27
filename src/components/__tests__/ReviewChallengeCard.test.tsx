/**
 * ReviewChallengeCard Component Tests
 *
 * Validates rendering, empty state, skill count display, and onStartReview callback.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ReviewChallengeCard } from '../ReviewChallengeCard';

describe('ReviewChallengeCard', () => {
  it('renders nothing when no skills are decaying', () => {
    const onStartReview = jest.fn();
    const { queryByTestId } = render(
      <ReviewChallengeCard decayedSkills={[]} onStartReview={onStartReview} />,
    );
    expect(queryByTestId('review-challenge-card')).toBeNull();
  });

  it('renders card title and count when skills are decaying', () => {
    const onStartReview = jest.fn();
    const { getByTestId, getByText } = render(
      <ReviewChallengeCard
        decayedSkills={['c-major-scale', 'g-major-chord', 'sight-reading-basics']}
        onStartReview={onStartReview}
      />,
    );

    expect(getByTestId('review-challenge-card')).toBeTruthy();
    expect(getByText('Skills Need Review')).toBeTruthy();
    expect(getByText(/3 skill\(s\) fading/)).toBeTruthy();

    // Badge should show the count
    const badge = getByTestId('review-challenge-start');
    expect(badge).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('calls onStartReview when card is pressed', () => {
    const onStartReview = jest.fn();
    const { getByTestId } = render(
      <ReviewChallengeCard
        decayedSkills={['c-major-scale']}
        onStartReview={onStartReview}
      />,
    );

    fireEvent.press(getByTestId('review-challenge-card'));
    expect(onStartReview).toHaveBeenCalledTimes(1);
  });

  it('calls onStartReview when badge is pressed', () => {
    const onStartReview = jest.fn();
    const { getByTestId } = render(
      <ReviewChallengeCard
        decayedSkills={['c-major-scale', 'g-major-chord']}
        onStartReview={onStartReview}
      />,
    );

    fireEvent.press(getByTestId('review-challenge-start'));
    expect(onStartReview).toHaveBeenCalledTimes(1);
  });

  it('renders correct subtitle for a single decayed skill', () => {
    const onStartReview = jest.fn();
    const { getByText } = render(
      <ReviewChallengeCard
        decayedSkills={['c-major-scale']}
        onStartReview={onStartReview}
      />,
    );

    expect(getByText(/1 skill\(s\) fading/)).toBeTruthy();
  });

  it('renders the chevron icon', () => {
    const onStartReview = jest.fn();
    const { getByText } = render(
      <ReviewChallengeCard
        decayedSkills={['c-major-scale']}
        onStartReview={onStartReview}
      />,
    );

    // The mocked MaterialCommunityIcons renders the icon name as text
    expect(getByText('chevron-right')).toBeTruthy();
  });

  it('renders the refresh icon', () => {
    const onStartReview = jest.fn();
    const { getByText } = render(
      <ReviewChallengeCard
        decayedSkills={['c-major-scale']}
        onStartReview={onStartReview}
      />,
    );

    // The mocked MaterialCommunityIcons renders the icon name as text
    expect(getByText('refresh')).toBeTruthy();
  });
});
