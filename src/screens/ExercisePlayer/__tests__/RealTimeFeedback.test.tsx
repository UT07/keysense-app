/**
 * RealTimeFeedback Tests
 *
 * Tests feedback display for each accuracy type: perfect, good, ok,
 * miss, early, late, and null (ready state). Also tests note counting.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { RealTimeFeedback } from '../RealTimeFeedback';

const baseFeedback = { noteIndex: 0, timestamp: 0 };

describe('RealTimeFeedback', () => {
  it('shows "Ready to play" when feedback type is null', () => {
    const { getByText } = render(
      <RealTimeFeedback
        feedback={{ ...baseFeedback, type: null }}
        expectedNotes={new Set()}
        highlightedKeys={new Set()}
      />,
    );
    expect(getByText('Ready to play')).toBeTruthy();
  });

  it('shows "Perfect!" for perfect feedback', () => {
    const { getByText } = render(
      <RealTimeFeedback
        feedback={{ ...baseFeedback, type: 'perfect' }}
        expectedNotes={new Set([60])}
        highlightedKeys={new Set([60])}
      />,
    );
    expect(getByText('Perfect!')).toBeTruthy();
  });

  it('shows "Good" for good feedback', () => {
    const { getByText } = render(
      <RealTimeFeedback
        feedback={{ ...baseFeedback, type: 'good' }}
        expectedNotes={new Set([60])}
        highlightedKeys={new Set([60])}
      />,
    );
    expect(getByText('Good')).toBeTruthy();
  });

  it('shows "OK" for ok feedback', () => {
    const { getByText } = render(
      <RealTimeFeedback
        feedback={{ ...baseFeedback, type: 'ok' }}
        expectedNotes={new Set([60])}
        highlightedKeys={new Set()}
      />,
    );
    expect(getByText('OK')).toBeTruthy();
  });

  it('shows "Missed" for miss feedback', () => {
    const { getByText } = render(
      <RealTimeFeedback
        feedback={{ ...baseFeedback, type: 'miss' }}
        expectedNotes={new Set([60])}
        highlightedKeys={new Set()}
      />,
    );
    expect(getByText('Missed')).toBeTruthy();
  });

  it('shows "Too early" for early feedback', () => {
    const { getByText } = render(
      <RealTimeFeedback
        feedback={{ ...baseFeedback, type: 'early' }}
        expectedNotes={new Set([60])}
        highlightedKeys={new Set()}
      />,
    );
    expect(getByText('Too early')).toBeTruthy();
  });

  it('shows "Too late" for late feedback', () => {
    const { getByText } = render(
      <RealTimeFeedback
        feedback={{ ...baseFeedback, type: 'late' }}
        expectedNotes={new Set([60])}
        highlightedKeys={new Set()}
      />,
    );
    expect(getByText('Too late')).toBeTruthy();
  });

  it('shows note count (correct/expected)', () => {
    const { getByText } = render(
      <RealTimeFeedback
        feedback={{ ...baseFeedback, type: 'good' }}
        expectedNotes={new Set([60, 64])}
        highlightedKeys={new Set([60])}
      />,
    );
    expect(getByText('1/2 notes')).toBeTruthy();
  });

  it('shows "Expected:" label when there are expected notes', () => {
    const { getByText } = render(
      <RealTimeFeedback
        feedback={{ ...baseFeedback, type: 'perfect' }}
        expectedNotes={new Set([60])}
        highlightedKeys={new Set([60])}
      />,
    );
    expect(getByText('Expected:')).toBeTruthy();
  });

  it('hides expected notes section when no notes expected', () => {
    const { queryByText } = render(
      <RealTimeFeedback
        feedback={{ ...baseFeedback, type: null }}
        expectedNotes={new Set()}
        highlightedKeys={new Set()}
      />,
    );
    expect(queryByText('Expected:')).toBeNull();
  });

  it('renders testID when provided', () => {
    const { getByTestId } = render(
      <RealTimeFeedback
        feedback={{ ...baseFeedback, type: null }}
        expectedNotes={new Set()}
        highlightedKeys={new Set()}
        testID="rtf"
      />,
    );
    expect(getByTestId('rtf')).toBeTruthy();
  });
});
