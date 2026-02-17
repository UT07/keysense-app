/**
 * CountInAnimation Tests
 *
 * Tests the pre-exercise beat countdown: beat number display,
 * "Ready..." text on final beat, and testID rendering.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { CountInAnimation } from '../CountInAnimation';

describe('CountInAnimation', () => {
  const defaultProps = {
    countIn: 4,
    tempo: 120, // 120 BPM = 500ms per beat
    elapsedTime: 0,
  };

  it('renders beat number 1 at time 0', () => {
    const { getByText } = render(<CountInAnimation {...defaultProps} elapsedTime={0} />);
    expect(getByText('1')).toBeTruthy();
  });

  it('renders beat number 2 at second beat', () => {
    // At 120 BPM, each beat is 500ms. Beat 2 starts at 500ms.
    const { getByText } = render(<CountInAnimation {...defaultProps} elapsedTime={500} />);
    expect(getByText('2')).toBeTruthy();
  });

  it('renders beat number 3 at third beat', () => {
    const { getByText } = render(<CountInAnimation {...defaultProps} elapsedTime={1000} />);
    expect(getByText('3')).toBeTruthy();
  });

  it('renders beat number 4 at fourth beat', () => {
    const { getByText } = render(<CountInAnimation {...defaultProps} elapsedTime={1500} />);
    expect(getByText('4')).toBeTruthy();
  });

  it('shows "Ready..." on the last beat', () => {
    const { getByText } = render(<CountInAnimation {...defaultProps} elapsedTime={1500} />);
    expect(getByText('Ready...')).toBeTruthy();
  });

  it('does NOT show "Ready..." on earlier beats', () => {
    const { queryByText } = render(<CountInAnimation {...defaultProps} elapsedTime={500} />);
    expect(queryByText('Ready...')).toBeNull();
  });

  it('caps beat display at countIn - 1', () => {
    // Even if elapsed time is way past the count-in window, it caps at last beat
    const { getByText } = render(<CountInAnimation {...defaultProps} elapsedTime={5000} />);
    expect(getByText('4')).toBeTruthy();
  });

  it('renders testID when provided', () => {
    const { getByTestId } = render(
      <CountInAnimation {...defaultProps} testID="count-in" />,
    );
    expect(getByTestId('count-in')).toBeTruthy();
  });

  it('works with different tempo (60 BPM = 1000ms per beat)', () => {
    const { getByText } = render(
      <CountInAnimation countIn={4} tempo={60} elapsedTime={1000} />,
    );
    // At 60 BPM, 1000ms = beat 1 → displays "2"
    expect(getByText('2')).toBeTruthy();
  });
});
