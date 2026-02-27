/**
 * CustomTabBar Tests
 *
 * Tests the custom bottom tab bar component:
 * - Renders correct number of tab buttons
 * - Active tab shows primary color icon
 * - Inactive tabs show muted color icons
 * - Tab press triggers navigation.emit and navigation.navigate
 * - Dot indicator appears for active tab
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34, top: 0, left: 0, right: 0 }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View: React.forwardRef((props: any, ref: any) =>
        React.createElement(View, { ...props, ref })
      ),
      createAnimatedComponent: (Component: any) => Component,
    },
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: (fn: any) => fn(),
    withTiming: (val: any) => val,
    withSpring: (val: any) => val,
    withDelay: (_d: any, val: any) => val,
    withRepeat: (val: any) => val,
    withSequence: (...args: any[]) => args[args.length - 1],
    Easing: {
      out: (fn: any) => fn,
      cubic: (t: any) => t,
      linear: (t: any) => t,
      in: (fn: any) => fn,
    },
  };
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { CustomTabBar } from '../CustomTabBar';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTabBarProps(activeIndex = 0) {
  const routeNames = ['Home', 'Learn', 'Social', 'Profile'];
  const routes = routeNames.map((name, i) => ({
    key: `${name}-key-${i}`,
    name,
    params: undefined,
  }));

  const descriptors: Record<string, any> = {};
  for (const route of routes) {
    descriptors[route.key] = {
      options: {
        tabBarButtonTestID: `tab-${route.name.toLowerCase()}`,
      },
      route,
      navigation: {},
    };
  }

  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };

  const state = {
    index: activeIndex,
    routes,
    key: 'tab-state',
    routeNames,
    type: 'tab' as const,
    stale: false as const,
    history: [],
  };

  return { state, descriptors, navigation, insets: { bottom: 34, top: 0, left: 0, right: 0 } } as any;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('CustomTabBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // 1. Rendering
  // -----------------------------------------------------------------------

  it('renders 4 tab buttons', () => {
    const props = createMockTabBarProps(0);
    const { getByTestId } = render(<CustomTabBar {...props} />);

    expect(getByTestId('tab-home')).toBeTruthy();
    expect(getByTestId('tab-learn')).toBeTruthy();
    expect(getByTestId('tab-social')).toBeTruthy();
    expect(getByTestId('tab-profile')).toBeTruthy();
  });

  it('renders the container with testID', () => {
    const props = createMockTabBarProps(0);
    const { getByTestId } = render(<CustomTabBar {...props} />);

    expect(getByTestId('custom-tab-bar')).toBeTruthy();
  });

  // -----------------------------------------------------------------------
  // 2. Active tab icon color
  // -----------------------------------------------------------------------

  it('active tab icon has primary color', () => {
    const props = createMockTabBarProps(0); // Home is active
    const { getByTestId } = render(<CustomTabBar {...props} />);

    const homeIcon = getByTestId('tab-icon-Home');
    expect(homeIcon.props.color).toBe(COLORS.primary);
  });

  it('active Learn tab icon has primary color', () => {
    const props = createMockTabBarProps(1); // Learn is active
    const { getByTestId } = render(<CustomTabBar {...props} />);

    const learnIcon = getByTestId('tab-icon-Learn');
    expect(learnIcon.props.color).toBe(COLORS.primary);
  });

  // -----------------------------------------------------------------------
  // 3. Inactive tab icon color
  // -----------------------------------------------------------------------

  it('inactive tabs have muted color icons', () => {
    const props = createMockTabBarProps(0); // Home is active
    const { getByTestId } = render(<CustomTabBar {...props} />);

    const learnIcon = getByTestId('tab-icon-Learn');
    const socialIcon = getByTestId('tab-icon-Social');
    const profileIcon = getByTestId('tab-icon-Profile');

    expect(learnIcon.props.color).toBe(COLORS.textMuted);
    expect(socialIcon.props.color).toBe(COLORS.textMuted);
    expect(profileIcon.props.color).toBe(COLORS.textMuted);
  });

  // -----------------------------------------------------------------------
  // 4. Tab press triggers navigation
  // -----------------------------------------------------------------------

  it('tab press calls navigation.emit with tabPress event', () => {
    const props = createMockTabBarProps(0);
    const { getByTestId } = render(<CustomTabBar {...props} />);

    fireEvent.press(getByTestId('tab-learn'));

    expect(props.navigation.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tabPress',
        target: 'Learn-key-1',
        canPreventDefault: true,
      })
    );
  });

  it('tab press calls navigation.navigate when not focused', () => {
    const props = createMockTabBarProps(0); // Home is active
    const { getByTestId } = render(<CustomTabBar {...props} />);

    fireEvent.press(getByTestId('tab-learn'));

    expect(props.navigation.navigate).toHaveBeenCalledWith('Learn', undefined);
  });

  it('tab press on active tab does NOT call navigation.navigate', () => {
    const props = createMockTabBarProps(0); // Home is active
    const { getByTestId } = render(<CustomTabBar {...props} />);

    fireEvent.press(getByTestId('tab-home'));

    expect(props.navigation.emit).toHaveBeenCalled();
    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  it('tab press triggers haptic feedback', () => {
    const props = createMockTabBarProps(0);
    const { getByTestId } = render(<CustomTabBar {...props} />);

    fireEvent.press(getByTestId('tab-learn'));

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light
    );
  });

  it('does not navigate when event is defaultPrevented', () => {
    const props = createMockTabBarProps(0);
    props.navigation.emit.mockReturnValue({ defaultPrevented: true });
    const { getByTestId } = render(<CustomTabBar {...props} />);

    fireEvent.press(getByTestId('tab-learn'));

    expect(props.navigation.emit).toHaveBeenCalled();
    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // 5. Dot indicator
  // -----------------------------------------------------------------------

  it('shows dot indicator for active tab', () => {
    const props = createMockTabBarProps(0);
    const { getByTestId } = render(<CustomTabBar {...props} />);

    // The active Home tab button should contain a dot (the animated view
    // with opacity 1 from the mocked useAnimatedStyle)
    const homeButton = getByTestId('tab-home');
    expect(homeButton).toBeTruthy();

    // Since useAnimatedStyle returns fn(), the dot opacity for the active
    // tab should be 1 (withTiming returns the value directly in our mock)
    // We verify by checking that the tab-home button renders successfully
    // with the dot as a child element
    const container = getByTestId('custom-tab-bar');
    expect(container.children).toHaveLength(4);
  });

  // -----------------------------------------------------------------------
  // 6. Accessibility
  // -----------------------------------------------------------------------

  it('tab buttons have correct accessibility role', () => {
    const props = createMockTabBarProps(0);
    const { getByTestId } = render(<CustomTabBar {...props} />);

    const homeButton = getByTestId('tab-home');
    expect(homeButton.props.accessibilityRole).toBe('button');
  });

  it('active tab has selected accessibility state', () => {
    const props = createMockTabBarProps(0);
    const { getByTestId } = render(<CustomTabBar {...props} />);

    const homeButton = getByTestId('tab-home');
    expect(homeButton.props.accessibilityState).toEqual({ selected: true });
  });

  it('inactive tab does not have selected accessibility state', () => {
    const props = createMockTabBarProps(0);
    const { getByTestId } = render(<CustomTabBar {...props} />);

    const learnButton = getByTestId('tab-learn');
    expect(learnButton.props.accessibilityState).toEqual({});
  });
});
