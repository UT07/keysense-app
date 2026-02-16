/**
 * KeysieAvatar Component Tests
 *
 * Tests the animated wrapper around KeysieSvg using react-native-reanimated.
 * Validates rendering with all moods, sizes, animated/static states,
 * particles visibility, and default prop behavior.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { KeysieAvatar } from '../KeysieAvatar';
import type { MascotMood, MascotSize } from '../types';

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const RN = require('react-native');

  const MockSvgComponent = (name: string) => {
    const component = (props: Record<string, unknown>) =>
      mockReact.createElement(RN.View, {
        ...props,
        testID: props.testID ?? `svg-${name}`,
        accessibilityLabel: name,
      });
    component.displayName = name;
    return component;
  };

  return {
    __esModule: true,
    default: MockSvgComponent('Svg'),
    Svg: MockSvgComponent('Svg'),
    G: MockSvgComponent('G'),
    Circle: MockSvgComponent('Circle'),
    Path: MockSvgComponent('Path'),
    Rect: MockSvgComponent('Rect'),
    Ellipse: MockSvgComponent('Ellipse'),
    Line: MockSvgComponent('Line'),
    Defs: MockSvgComponent('Defs'),
    ClipPath: MockSvgComponent('ClipPath'),
  };
});

const ALL_MOODS: MascotMood[] = [
  'happy',
  'encouraging',
  'excited',
  'teaching',
  'celebrating',
];
const ALL_SIZES: MascotSize[] = ['tiny', 'small', 'medium', 'large'];

describe('KeysieAvatar', () => {
  describe('Default props', () => {
    it('renders with only required mood prop', () => {
      const { getByTestId } = render(<KeysieAvatar mood="happy" />);
      expect(getByTestId('keysie-avatar')).toBeTruthy();
    });

    it('defaults to medium size when size is omitted', () => {
      const { getByTestId } = render(<KeysieAvatar mood="happy" />);
      // The inner KeysieSvg should receive size="medium" by default
      // We verify by checking the keysie-svg testID exists (renders successfully)
      expect(getByTestId('keysie-svg')).toBeTruthy();
      // And the SVG should have medium dimensions (56px)
      expect(getByTestId('keysie-svg').props.width).toBe(56);
    });

    it('defaults to animated=true (renders without error)', () => {
      // animated=true by default; should render smoothly with reanimated hooks
      const { getByTestId } = render(<KeysieAvatar mood="happy" />);
      expect(getByTestId('keysie-avatar')).toBeTruthy();
    });

    it('defaults to showParticles=false (no particles shown)', () => {
      const { queryByTestId } = render(
        <KeysieAvatar mood="celebrating" />,
      );
      // showParticles defaults to false, so even when celebrating, no particles
      expect(queryByTestId('keysie-particles')).toBeNull();
    });
  });

  describe('Rendering all moods', () => {
    it.each(ALL_MOODS)('renders %s mood without crashing', (mood) => {
      const { getByTestId } = render(<KeysieAvatar mood={mood} />);
      expect(getByTestId('keysie-avatar')).toBeTruthy();
    });

    it.each(ALL_MOODS)(
      'renders %s mood with animated=true without crashing',
      (mood) => {
        const { getByTestId } = render(
          <KeysieAvatar mood={mood} animated={true} />,
        );
        expect(getByTestId('keysie-avatar')).toBeTruthy();
      },
    );

    it.each(ALL_MOODS)(
      'renders %s mood with animated=false without crashing',
      (mood) => {
        const { getByTestId } = render(
          <KeysieAvatar mood={mood} animated={false} />,
        );
        expect(getByTestId('keysie-avatar')).toBeTruthy();
      },
    );
  });

  describe('Rendering all sizes', () => {
    it.each(ALL_SIZES)('renders at %s size', (size) => {
      const { getByTestId } = render(
        <KeysieAvatar mood="happy" size={size} />,
      );
      expect(getByTestId('keysie-avatar')).toBeTruthy();
      expect(getByTestId('keysie-svg')).toBeTruthy();
    });

    it('passes correct size through to KeysieSvg at each size', () => {
      const expectedSizes: Record<MascotSize, number> = {
        tiny: 24,
        small: 40,
        medium: 56,
        large: 80,
      };

      for (const size of ALL_SIZES) {
        const { getByTestId, unmount } = render(
          <KeysieAvatar mood="happy" size={size} />,
        );
        expect(getByTestId('keysie-svg').props.width).toBe(expectedSizes[size]);
        unmount();
      }
    });
  });

  describe('All mood+size combinations', () => {
    it('renders every combination of mood and size', () => {
      for (const mood of ALL_MOODS) {
        for (const size of ALL_SIZES) {
          const { getByTestId, unmount } = render(
            <KeysieAvatar mood={mood} size={size} />,
          );
          expect(getByTestId('keysie-avatar')).toBeTruthy();
          unmount();
        }
      }
    });
  });

  describe('StarParticles (showParticles prop)', () => {
    it('shows particles when celebrating with showParticles=true', () => {
      const { queryByTestId } = render(
        <KeysieAvatar mood="celebrating" showParticles={true} />,
      );
      expect(queryByTestId('keysie-particles')).toBeTruthy();
    });

    it('does not show particles when celebrating with showParticles=false', () => {
      const { queryByTestId } = render(
        <KeysieAvatar mood="celebrating" showParticles={false} />,
      );
      expect(queryByTestId('keysie-particles')).toBeNull();
    });

    it('does not show particles for happy mood even with showParticles=true', () => {
      const { queryByTestId } = render(
        <KeysieAvatar mood="happy" showParticles={true} />,
      );
      expect(queryByTestId('keysie-particles')).toBeNull();
    });

    it('does not show particles for encouraging mood with showParticles=true', () => {
      const { queryByTestId } = render(
        <KeysieAvatar mood="encouraging" showParticles={true} />,
      );
      expect(queryByTestId('keysie-particles')).toBeNull();
    });

    it('does not show particles for excited mood with showParticles=true', () => {
      const { queryByTestId } = render(
        <KeysieAvatar mood="excited" showParticles={true} />,
      );
      expect(queryByTestId('keysie-particles')).toBeNull();
    });

    it('does not show particles for teaching mood with showParticles=true', () => {
      const { queryByTestId } = render(
        <KeysieAvatar mood="teaching" showParticles={true} />,
      );
      expect(queryByTestId('keysie-particles')).toBeNull();
    });

    it('particles container has 5 star elements when shown', () => {
      const { getByTestId } = render(
        <KeysieAvatar mood="celebrating" showParticles={true} />,
      );
      const particlesContainer = getByTestId('keysie-particles');
      // StarParticles renders PARTICLE_COUNT=5 ParticleStar children
      expect(particlesContainer.children.length).toBe(5);
    });
  });

  describe('Animated vs static rendering', () => {
    it('renders correctly with animated=true', () => {
      const { getByTestId } = render(
        <KeysieAvatar mood="happy" animated={true} />,
      );
      expect(getByTestId('keysie-avatar')).toBeTruthy();
    });

    it('renders correctly with animated=false', () => {
      const { getByTestId } = render(
        <KeysieAvatar mood="happy" animated={false} />,
      );
      expect(getByTestId('keysie-avatar')).toBeTruthy();
    });

    it('renders celebrating with animated=false without crashing', () => {
      const { getByTestId } = render(
        <KeysieAvatar
          mood="celebrating"
          animated={false}
          showParticles={true}
        />,
      );
      expect(getByTestId('keysie-avatar')).toBeTruthy();
      // Particles still shown (particles have their own animation, independent of the animated prop)
      expect(getByTestId('keysie-particles')).toBeTruthy();
    });
  });

  describe('Re-rendering stability', () => {
    it('re-renders cleanly when mood changes from happy to celebrating', () => {
      const { getByTestId, queryByTestId, rerender } = render(
        <KeysieAvatar mood="happy" showParticles={true} />,
      );
      expect(getByTestId('keysie-avatar')).toBeTruthy();
      expect(queryByTestId('keysie-particles')).toBeNull();

      rerender(
        <KeysieAvatar mood="celebrating" showParticles={true} />,
      );
      expect(getByTestId('keysie-avatar')).toBeTruthy();
      expect(queryByTestId('keysie-particles')).toBeTruthy();
    });

    it('re-renders cleanly when mood changes from celebrating to happy', () => {
      const { getByTestId, queryByTestId, rerender } = render(
        <KeysieAvatar mood="celebrating" showParticles={true} />,
      );
      expect(queryByTestId('keysie-particles')).toBeTruthy();

      rerender(
        <KeysieAvatar mood="happy" showParticles={true} />,
      );
      expect(getByTestId('keysie-avatar')).toBeTruthy();
      expect(queryByTestId('keysie-particles')).toBeNull();
    });

    it('re-renders cleanly when size changes', () => {
      const { getByTestId, rerender } = render(
        <KeysieAvatar mood="happy" size="tiny" />,
      );
      expect(getByTestId('keysie-svg').props.width).toBe(24);

      rerender(<KeysieAvatar mood="happy" size="large" />);
      expect(getByTestId('keysie-svg').props.width).toBe(80);
    });

    it('re-renders cleanly when animated toggles', () => {
      const { getByTestId, rerender } = render(
        <KeysieAvatar mood="happy" animated={true} />,
      );
      expect(getByTestId('keysie-avatar')).toBeTruthy();

      rerender(<KeysieAvatar mood="happy" animated={false} />);
      expect(getByTestId('keysie-avatar')).toBeTruthy();
    });

    it('cycles through all moods without crashing', () => {
      const { getByTestId, rerender } = render(
        <KeysieAvatar mood="happy" />,
      );

      for (const mood of ALL_MOODS) {
        rerender(<KeysieAvatar mood={mood} />);
        expect(getByTestId('keysie-avatar')).toBeTruthy();
      }
    });
  });

  describe('Structure and composition', () => {
    it('keysie-avatar wraps keysie-svg', () => {
      const { getByTestId } = render(<KeysieAvatar mood="happy" />);
      const avatar = getByTestId('keysie-avatar');
      // The avatar Animated.View should contain children that include the SVG
      expect(avatar).toBeTruthy();
      expect(getByTestId('keysie-svg')).toBeTruthy();
    });

    it('passes mood prop through to KeysieSvg', () => {
      // Each mood renders different SVG elements. We verify celebrating has gold star paths.
      const { UNSAFE_getAllByType } = render(
        <KeysieAvatar mood="celebrating" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const goldPaths = allViews.filter(
        (v) =>
          v.props.accessibilityLabel === 'Path' &&
          v.props.fill === '#FFD700',
      );
      expect(goldPaths.length).toBe(2);
    });
  });
});
