/**
 * MusicLibrarySpotlight Component Tests
 *
 * Validates rendering of song/genre counts, featured song display,
 * Browse Library CTA press handling, and null featured song fallback.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MusicLibrarySpotlight } from '../MusicLibrarySpotlight';
import type { MusicLibrarySpotlightProps } from '../MusicLibrarySpotlight';

// Mock react-native-reanimated (PressableScale dependency)
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View: View,
      createAnimatedComponent: (component: unknown) => component,
    },
    useSharedValue: (val: number) => ({ value: val }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    withSpring: (val: number) => val,
    withTiming: (val: number) => val,
  };
});

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

const defaultProps: MusicLibrarySpotlightProps = {
  totalSongs: 124,
  totalGenres: 6,
  featuredSong: {
    title: 'Moonlight Sonata',
    artist: 'Beethoven',
    genre: 'Classical',
    difficulty: 3,
  },
  onBrowse: jest.fn(),
  onPlayFeatured: jest.fn(),
};

describe('MusicLibrarySpotlight', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders song count and genre count', () => {
    const { getByText } = render(
      <MusicLibrarySpotlight {...defaultProps} />
    );
    expect(getByText('124 Songs')).toBeTruthy();
    expect(getByText('6 Genres')).toBeTruthy();
  });

  it('renders the Music Library title', () => {
    const { getByText } = render(
      <MusicLibrarySpotlight {...defaultProps} />
    );
    expect(getByText('Music Library')).toBeTruthy();
  });

  it('shows featured song info when provided', () => {
    const { getByText } = render(
      <MusicLibrarySpotlight {...defaultProps} />
    );
    expect(getByText('Moonlight Sonata')).toBeTruthy();
    expect(getByText('Beethoven')).toBeTruthy();
    expect(getByText('Classical')).toBeTruthy();
  });

  it('calls onBrowse when Browse Library is pressed', () => {
    const onBrowse = jest.fn();
    const { getByTestId } = render(
      <MusicLibrarySpotlight {...defaultProps} onBrowse={onBrowse} />
    );
    fireEvent.press(getByTestId('music-library-browse'));
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });

  it('works without featured song (featuredSong=null)', () => {
    const { getByText, queryByText } = render(
      <MusicLibrarySpotlight
        {...defaultProps}
        featuredSong={null}
      />
    );
    // Header and stats should still render
    expect(getByText('Music Library')).toBeTruthy();
    expect(getByText('124 Songs')).toBeTruthy();
    expect(getByText('6 Genres')).toBeTruthy();
    // Featured song content should not be present
    expect(queryByText('Moonlight Sonata')).toBeNull();
    expect(queryByText('Beethoven')).toBeNull();
  });

  it('calls onPlayFeatured when the featured song card is pressed', () => {
    const onPlayFeatured = jest.fn();
    const { getByTestId } = render(
      <MusicLibrarySpotlight
        {...defaultProps}
        onPlayFeatured={onPlayFeatured}
      />
    );
    fireEvent.press(getByTestId('music-library-play-featured'));
    expect(onPlayFeatured).toHaveBeenCalledTimes(1);
  });

  it('renders with different song/genre counts', () => {
    const { getByText } = render(
      <MusicLibrarySpotlight
        {...defaultProps}
        totalSongs={50}
        totalGenres={3}
      />
    );
    expect(getByText('50 Songs')).toBeTruthy();
    expect(getByText('3 Genres')).toBeTruthy();
  });

  it('renders difficulty dots for featured song', () => {
    const { getByTestId } = render(
      <MusicLibrarySpotlight {...defaultProps} />
    );
    // With difficulty=3, there should be 5 dots total (testIDs: difficulty-dot-0 through difficulty-dot-4)
    for (let i = 0; i < 5; i++) {
      expect(getByTestId(`difficulty-dot-${i}`)).toBeTruthy();
    }
  });

  it('renders the Browse Library button', () => {
    const { getByText } = render(
      <MusicLibrarySpotlight {...defaultProps} />
    );
    expect(getByText('Browse Library')).toBeTruthy();
  });
});
