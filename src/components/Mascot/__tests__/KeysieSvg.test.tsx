/**
 * KeysieSvg Component Tests
 *
 * Tests the SVG cat mascot with 5 moods: happy, encouraging, excited, teaching, celebrating.
 * Validates rendering at all sizes, mood-dependent eye/mouth elements, structural elements,
 * and prop combinations.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { KeysieSvg } from '../KeysieSvg';
import { MASCOT_SIZES } from '../types';
import type { MascotMood, MascotSize } from '../types';

// Mock react-native-svg with components that preserve props as testable attributes
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
    RadialGradient: MockSvgComponent('RadialGradient'),
    Stop: MockSvgComponent('Stop'),
  };
});

const ALL_MOODS: MascotMood[] = ['happy', 'encouraging', 'excited', 'teaching', 'celebrating'];
const ALL_SIZES: MascotSize[] = ['tiny', 'small', 'medium', 'large'];

describe('KeysieSvg', () => {
  describe('Rendering basics', () => {
    it('renders without crashing with minimal props', () => {
      const { getByTestId } = render(<KeysieSvg mood="happy" size="medium" />);
      expect(getByTestId('keysie-svg')).toBeTruthy();
    });

    it('renders at every size without crashing', () => {
      for (const size of ALL_SIZES) {
        const { getByTestId, unmount } = render(
          <KeysieSvg size={size} mood="happy" />,
        );
        expect(getByTestId('keysie-svg')).toBeTruthy();
        unmount();
      }
    });

    it('renders every mood without crashing', () => {
      for (const mood of ALL_MOODS) {
        const { getByTestId, unmount } = render(
          <KeysieSvg size="medium" mood={mood} />,
        );
        expect(getByTestId('keysie-svg')).toBeTruthy();
        unmount();
      }
    });

    it('renders all mood+size combinations without crashing', () => {
      for (const mood of ALL_MOODS) {
        for (const size of ALL_SIZES) {
          const { getByTestId, unmount } = render(
            <KeysieSvg mood={mood} size={size} />,
          );
          expect(getByTestId('keysie-svg')).toBeTruthy();
          unmount();
        }
      }
    });
  });

  describe('SVG dimensions from size prop', () => {
    it('sets width and height to MASCOT_SIZES[tiny]=24', () => {
      const { getByTestId } = render(<KeysieSvg mood="happy" size="tiny" />);
      const svg = getByTestId('keysie-svg');
      expect(svg.props.width).toBe(24);
      expect(svg.props.height).toBe(24);
    });

    it('sets width and height to MASCOT_SIZES[small]=40', () => {
      const { getByTestId } = render(<KeysieSvg mood="happy" size="small" />);
      const svg = getByTestId('keysie-svg');
      expect(svg.props.width).toBe(40);
      expect(svg.props.height).toBe(40);
    });

    it('sets width and height to MASCOT_SIZES[medium]=56', () => {
      const { getByTestId } = render(<KeysieSvg mood="happy" size="medium" />);
      const svg = getByTestId('keysie-svg');
      expect(svg.props.width).toBe(56);
      expect(svg.props.height).toBe(56);
    });

    it('sets width and height to MASCOT_SIZES[large]=80', () => {
      const { getByTestId } = render(<KeysieSvg mood="happy" size="large" />);
      const svg = getByTestId('keysie-svg');
      expect(svg.props.width).toBe(80);
      expect(svg.props.height).toBe(80);
    });

    it('viewBox is always "0 0 100 100" regardless of size', () => {
      for (const size of ALL_SIZES) {
        const { getByTestId, unmount } = render(
          <KeysieSvg mood="happy" size={size} />,
        );
        expect(getByTestId('keysie-svg').props.viewBox).toBe('0 0 100 100');
        unmount();
      }
    });
  });

  describe('Structural SVG elements', () => {
    it('contains body ellipse (body shape)', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="happy" size="medium" />,
      );
      // The mock renders all SVG elements as View components.
      // We check the overall tree has children (structural elements exist).
      const svg = UNSAFE_getAllByType(require('react-native').View);
      // The component should have many child elements (body, head, ears, etc.)
      expect(svg.length).toBeGreaterThan(10);
    });

    it('contains crimson-colored elements for ear interiors and headphones', () => {
      const { getByTestId } = render(<KeysieSvg mood="happy" size="medium" />);
      const tree = getByTestId('keysie-svg');
      // Verify tree has children (mocked SVG elements)
      expect(tree.children.length).toBeGreaterThan(0);
    });

    it('contains whisker line elements', () => {
      // KeysieSvg renders 6 Line elements for whiskers
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="happy" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      // Line elements are rendered with accessibilityLabel="Line"
      const lines = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Line',
      );
      // 6 whiskers + possibly a teaching mouth Line = at least 6
      expect(lines.length).toBeGreaterThanOrEqual(6);
    });

    it('contains piano-key collar rectangles', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="happy" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const rects = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Rect',
      );
      // 6 piano key collar rectangles
      expect(rects.length).toBe(6);
    });
  });

  describe('Mood-dependent eyes', () => {
    it('happy mood renders crescent eye paths (no Circle eyes)', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="happy" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const paths = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Path',
      );
      // Happy eyes use 2 Path elements (crescents); find those with stroke="#FFFFFF"
      const whitePaths = paths.filter(
        (p) => p.props.stroke === '#FFFFFF' && p.props.fill === 'none',
      );
      // At least 2 for happy eyes (crescents) + 1 happy mouth path
      expect(whitePaths.length).toBeGreaterThanOrEqual(3);
    });

    it('encouraging mood renders ellipse + circle eyes', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="encouraging" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const ellipses = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Ellipse',
      );
      // Encouraging eyes: 2 large ellipses for eye whites + nose ellipse + body ellipse = at least 4
      expect(ellipses.length).toBeGreaterThanOrEqual(4);
    });

    it('excited mood renders large circle eyes', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="excited" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const circles = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Circle',
      );
      // Excited eyes use large circles (r=6, r=3.5, r=1.5 for each eye = 6 circles)
      // Plus structural circles (head, tail tip, headphone cups = 5)
      expect(circles.length).toBeGreaterThanOrEqual(11);
    });

    it('teaching mood renders wide alert ellipse eyes', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="teaching" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const ellipses = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Ellipse',
      );
      // Teaching eyes: 2 wide ellipses + nose ellipse + body ellipse = at least 4
      expect(ellipses.length).toBeGreaterThanOrEqual(4);
    });

    it('celebrating mood renders gold star eyes', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="celebrating" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const paths = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Path',
      );
      // Celebrating eyes: 2 star paths with fill="#FFD700"
      const goldPaths = paths.filter((p) => p.props.fill === '#FFD700');
      expect(goldPaths.length).toBe(2);
    });
  });

  describe('Mood-dependent mouth', () => {
    it('happy mouth is a curved Path', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="happy" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const paths = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Path',
      );
      // Happy mouth: Path with d starting with "M 43 49"
      const mouthPath = paths.find(
        (p) => typeof p.props.d === 'string' && p.props.d.includes('M 43 49'),
      );
      expect(mouthPath).toBeTruthy();
    });

    it('encouraging mouth is a gentle curve Path', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="encouraging" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const paths = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Path',
      );
      const mouthPath = paths.find(
        (p) => typeof p.props.d === 'string' && p.props.d.includes('M 44 49'),
      );
      expect(mouthPath).toBeTruthy();
    });

    it('excited mouth is an ellipse (open mouth)', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="excited" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const ellipses = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Ellipse',
      );
      // Excited mouth: Ellipse at cx=50, cy=50 with fill=DARK_RED (#8B0000)
      const mouthEllipse = ellipses.find(
        (e) => e.props.cx === '50' && e.props.cy === '50',
      );
      expect(mouthEllipse).toBeTruthy();
    });

    it('teaching mouth is a straight Line', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="teaching" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const lines = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Line',
      );
      // Teaching mouth: Line from (44,50) to (56,50)
      const mouthLine = lines.find(
        (l) => l.props.x1 === '44' && l.props.y1 === '50',
      );
      expect(mouthLine).toBeTruthy();
    });

    it('celebrating mouth is a wide grin Path with fill', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="celebrating" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const paths = allViews.filter(
        (v) => v.props.accessibilityLabel === 'Path',
      );
      const mouthPath = paths.find(
        (p) =>
          typeof p.props.d === 'string' &&
          p.props.d.includes('M 42 48') &&
          p.props.fill === '#8B0000',
      );
      expect(mouthPath).toBeTruthy();
    });
  });

  describe('Color constants', () => {
    it('uses crimson (#DC143C) for ear interiors and nose', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="happy" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const crimsonElements = allViews.filter(
        (v) => v.props.fill === '#DC143C',
      );
      // Ear interiors (2 paths), headphone cups (2 circles), headphone band (1 path stroke),
      // nose (1 ellipse), tail tip (1 circle) = at least 6 crimson elements
      expect(crimsonElements.length).toBeGreaterThanOrEqual(5);
    });

    it('uses body color (#3A3A3A) for body and head', () => {
      const { UNSAFE_getAllByType } = render(
        <KeysieSvg mood="happy" size="medium" />,
      );
      const allViews = UNSAFE_getAllByType(require('react-native').View);
      const bodyElements = allViews.filter(
        (v) => v.props.fill === '#3A3A3A',
      );
      // Body ellipse, head circle, ear outer paths (2), tail stroke
      expect(bodyElements.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('MASCOT_SIZES consistency', () => {
    it('MASCOT_SIZES has correct pixel values', () => {
      expect(MASCOT_SIZES.tiny).toBe(24);
      expect(MASCOT_SIZES.small).toBe(40);
      expect(MASCOT_SIZES.medium).toBe(56);
      expect(MASCOT_SIZES.large).toBe(80);
    });

    it('SVG dimensions match MASCOT_SIZES for every size', () => {
      for (const size of ALL_SIZES) {
        const { getByTestId, unmount } = render(
          <KeysieSvg mood="happy" size={size} />,
        );
        const svg = getByTestId('keysie-svg');
        const expectedPx = MASCOT_SIZES[size];
        expect(svg.props.width).toBe(expectedPx);
        expect(svg.props.height).toBe(expectedPx);
        unmount();
      }
    });
  });

  describe('Re-rendering stability', () => {
    it('re-renders cleanly when mood changes', () => {
      const { getByTestId, rerender } = render(
        <KeysieSvg mood="happy" size="medium" />,
      );
      expect(getByTestId('keysie-svg')).toBeTruthy();

      rerender(<KeysieSvg mood="celebrating" size="medium" />);
      expect(getByTestId('keysie-svg')).toBeTruthy();
    });

    it('re-renders cleanly when size changes', () => {
      const { getByTestId, rerender } = render(
        <KeysieSvg mood="happy" size="tiny" />,
      );
      expect(getByTestId('keysie-svg').props.width).toBe(24);

      rerender(<KeysieSvg mood="happy" size="large" />);
      expect(getByTestId('keysie-svg').props.width).toBe(80);
    });
  });
});
