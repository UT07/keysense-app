/**
 * HintDisplay Tests
 *
 * Tests contextual hint rendering: pre-play hints, count-in message,
 * feedback-driven hints, and compact mode.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { HintDisplay } from '../HintDisplay';

const baseHints = {
  beforeStart: 'Press the highlighted keys gently',
  commonMistakes: [{ pattern: 'wrong-octave', advice: 'Check octave' }],
  successMessage: 'Great!',
};

describe('HintDisplay', () => {
  // =========================================================================
  // Pre-play state
  // =========================================================================

  it('shows beforeStart hint when not playing', () => {
    const { getByText } = render(
      <HintDisplay hints={baseHints} isPlaying={false} countInComplete={false} feedback={null} />,
    );
    expect(getByText('Press the highlighted keys gently')).toBeTruthy();
  });

  // =========================================================================
  // Count-in state
  // =========================================================================

  it('shows "Get ready..." during count-in', () => {
    const { getByText } = render(
      <HintDisplay hints={baseHints} isPlaying={true} countInComplete={false} feedback={null} />,
    );
    expect(getByText('Get ready...')).toBeTruthy();
  });

  // =========================================================================
  // Feedback-driven hints
  // =========================================================================

  it('shows "Perfect timing!" for perfect feedback', () => {
    const { getByText } = render(
      <HintDisplay hints={baseHints} isPlaying={true} countInComplete={true} feedback="perfect" />,
    );
    expect(getByText('Perfect timing!')).toBeTruthy();
  });

  it('shows "Good!" for good feedback', () => {
    const { getByText } = render(
      <HintDisplay hints={baseHints} isPlaying={true} countInComplete={true} feedback="good" />,
    );
    expect(getByText('Good!')).toBeTruthy();
  });

  it('shows "Try to be more precise" for ok feedback', () => {
    const { getByText } = render(
      <HintDisplay hints={baseHints} isPlaying={true} countInComplete={true} feedback="ok" />,
    );
    expect(getByText('Try to be more precise')).toBeTruthy();
  });

  it('shows "Keep focused on the notes" for miss feedback', () => {
    const { getByText } = render(
      <HintDisplay hints={baseHints} isPlaying={true} countInComplete={true} feedback="miss" />,
    );
    expect(getByText('Keep focused on the notes')).toBeTruthy();
  });

  it('shows "A bit early, slow down" for early feedback', () => {
    const { getByText } = render(
      <HintDisplay hints={baseHints} isPlaying={true} countInComplete={true} feedback="early" />,
    );
    expect(getByText('A bit early, slow down')).toBeTruthy();
  });

  it('shows "A bit late, speed up" for late feedback', () => {
    const { getByText } = render(
      <HintDisplay hints={baseHints} isPlaying={true} countInComplete={true} feedback="late" />,
    );
    expect(getByText('A bit late, speed up')).toBeTruthy();
  });

  it('shows generic hint when feedback is null during play', () => {
    const { getByText } = render(
      <HintDisplay hints={baseHints} isPlaying={true} countInComplete={true} feedback={null} />,
    );
    expect(getByText('Focus on the piano roll')).toBeTruthy();
  });

  // =========================================================================
  // Compact mode
  // =========================================================================

  it('renders in compact mode when compact prop is true', () => {
    const { getByText } = render(
      <HintDisplay hints={baseHints} isPlaying={false} countInComplete={false} feedback={null} compact />,
    );
    // Still renders the text, just in a different layout
    expect(getByText('Press the highlighted keys gently')).toBeTruthy();
  });

  // =========================================================================
  // TestID
  // =========================================================================

  it('renders testID when provided', () => {
    const { getByTestId } = render(
      <HintDisplay hints={baseHints} isPlaying={false} countInComplete={false} feedback={null} testID="hint" />,
    );
    expect(getByTestId('hint')).toBeTruthy();
  });
});
