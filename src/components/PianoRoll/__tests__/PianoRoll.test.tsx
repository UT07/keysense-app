import React from 'react';
import { render } from '@testing-library/react-native';
import { PianoRoll } from '../PianoRoll';
import type { NoteEvent } from '@/core/exercises/types';

function flattenStyle(style: any): Record<string, any> {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean));
  }
  return style ?? {};
}

describe('PianoRoll', () => {
  const notes: NoteEvent[] = [
    { note: 60, startBeat: 0, durationBeats: 1 },
    { note: 64, startBeat: 1, durationBeats: 1 },
  ];

  it('renders marker guide mode by default', () => {
    const { getByTestId, queryByTestId, queryAllByTestId } = render(
      <PianoRoll notes={notes} testID="piano-roll" />,
    );

    expect(getByTestId('marker-line')).toBeTruthy();
    expect(queryByTestId('press-line')).toBeNull();
    expect(queryByTestId('release-line')).toBeNull();
    expect(queryAllByTestId(/^piano-roll-beat-line-/).length).toBeGreaterThan(0);
  });

  it('renders only press/release guides in pressRelease mode', () => {
    const { queryByTestId, getByTestId, queryAllByTestId } = render(
      <PianoRoll
        notes={notes}
        guideMode="pressRelease"
        showBeatGrid={true}
        testID="piano-roll"
      />,
    );

    expect(queryByTestId('marker-line')).toBeNull();
    expect(getByTestId('press-line')).toBeTruthy();
    expect(getByTestId('release-line')).toBeTruthy();
    // Beat grid should be hidden in pressRelease mode regardless of showBeatGrid prop.
    expect(queryAllByTestId(/^piano-roll-beat-line-/)).toHaveLength(0);
  });

  it('derives default release guide offset from tempo', () => {
    const slow = render(
      <PianoRoll notes={notes} guideMode="pressRelease" tempo={60} testID="slow-roll" />,
    );
    const fast = render(
      <PianoRoll notes={notes} guideMode="pressRelease" tempo={120} testID="fast-roll" />,
    );

    const slowPressStyle = flattenStyle(slow.getByTestId('press-line').props.style);
    const slowReleaseStyle = flattenStyle(slow.getByTestId('release-line').props.style);
    const fastPressStyle = flattenStyle(fast.getByTestId('press-line').props.style);
    const fastReleaseStyle = flattenStyle(fast.getByTestId('release-line').props.style);

    const slowGap = slowReleaseStyle.left - slowPressStyle.left;
    const fastGap = fastReleaseStyle.left - fastPressStyle.left;

    expect(slowGap).toBeGreaterThan(0);
    expect(fastGap).toBeGreaterThan(slowGap);
  });
});
