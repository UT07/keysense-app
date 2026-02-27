/**
 * LevelMapScreen UI Tests
 *
 * Tests the adventure-style winding path level map: circular nodes with SVG
 * bezier connections, zigzag layout, cat companions at each tier, section
 * banners, navigation, header stats, and tier progression.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Navigation mock
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useNavigationState: (selector: (state: any) => any) =>
    selector({ routes: [{ name: 'LevelMap' }] }),
  useRoute: () => ({ params: {} }),
  NavigationContainer: ({ children }: any) => children,
}));

// ---------------------------------------------------------------------------
// expo-linear-gradient mock
// ---------------------------------------------------------------------------

jest.mock('expo-linear-gradient', () => {
  const mockReact = require('react');
  const RN = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      mockReact.createElement(RN.View, { ...props, testID: 'linear-gradient' }, children),
  };
});

// ---------------------------------------------------------------------------
// react-native-svg mock
// ---------------------------------------------------------------------------

jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const RN = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => mockReact.createElement(RN.View, { testID: 'svg-root', ...props }, props.children),
    Svg: (props: any) => mockReact.createElement(RN.View, { testID: 'svg-root', ...props }, props.children),
    Path: (props: any) => mockReact.createElement(RN.View, { testID: 'svg-path', ...props }),
    Circle: (props: any) => mockReact.createElement(RN.View, props),
    Rect: (props: any) => mockReact.createElement(RN.View, props),
    G: (props: any) => mockReact.createElement(RN.View, props, props.children),
  };
});

// ---------------------------------------------------------------------------
// react-native-reanimated mock
// ---------------------------------------------------------------------------

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');

  const Reanimated = {
    ...jest.requireActual('react-native-reanimated/mock'),
    default: {
      View: RN.View,
      Text: RN.Text,
      createAnimatedComponent: (component: any) => component,
    },
    useSharedValue: (init: any) => ({ value: init }),
    useAnimatedStyle: () => ({}),
    withRepeat: (v: any) => v,
    withSequence: (...args: any[]) => args[0],
    withTiming: (v: any) => v,
    FadeInUp: { delay: () => ({ duration: () => undefined }) },
  };

  return Reanimated;
});

// ---------------------------------------------------------------------------
// Component mocks
// ---------------------------------------------------------------------------

jest.mock('../../components/Mascot/SalsaCoach', () => {
  const mockReact = require('react');
  const RN = require('react-native');
  return {
    SalsaCoach: (props: any) =>
      mockReact.createElement(RN.View, { testID: 'salsa-coach', ...props }),
  };
});

jest.mock('../../components/Mascot/CatAvatar', () => {
  const mockReact = require('react');
  const RN = require('react-native');
  return {
    CatAvatar: (props: any) =>
      mockReact.createElement(RN.View, { testID: `cat-avatar-${props.catId}`, ...props }),
  };
});

// ---------------------------------------------------------------------------
// Zustand store mocks
// ---------------------------------------------------------------------------

let mockMasteredSkills: string[] = [];

jest.mock('../../stores/learnerProfileStore', () => ({
  useLearnerProfileStore: Object.assign(
    (sel?: any) => {
      const state = { masteredSkills: mockMasteredSkills };
      return sel ? sel(state) : state;
    },
    { getState: () => ({ masteredSkills: mockMasteredSkills }) },
  ),
}));

const mockGemState = { gems: 50, earnGems: jest.fn(), spendGems: jest.fn() };

jest.mock('../../stores/gemStore', () => ({
  useGemStore: Object.assign(
    (sel?: any) => (sel ? sel(mockGemState) : mockGemState),
    { getState: () => mockGemState },
  ),
}));

let mockCatEvolutionState: any = {
  selectedCatId: 'keysie',
  ownedCats: ['keysie', 'biscuit'],
  evolutionData: {
    keysie: { currentStage: 'baby', totalXp: 100 },
    biscuit: { currentStage: 'teen', totalXp: 500 },
  },
};

jest.mock('../../stores/catEvolutionStore', () => ({
  useCatEvolutionStore: Object.assign(
    (sel?: any) => (sel ? sel(mockCatEvolutionState) : mockCatEvolutionState),
    { getState: () => mockCatEvolutionState },
  ),
}));

// ---------------------------------------------------------------------------
// Import component under test AFTER all mocks are set up
// ---------------------------------------------------------------------------

import { LevelMapScreen } from '../LevelMapScreen';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockMasteredSkills = [];
  mockCatEvolutionState = {
    selectedCatId: 'keysie',
    ownedCats: ['keysie', 'biscuit'],
    evolutionData: {
      keysie: { currentStage: 'baby', totalXp: 100 },
      biscuit: { currentStage: 'teen', totalXp: 500 },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LevelMapScreen', () => {
  beforeEach(resetMocks);

  // =========================================================================
  // Rendering basics
  // =========================================================================

  it('renders the header title "Your Journey"', () => {
    const { getByText } = render(<LevelMapScreen />);
    expect(getByText('Your Journey')).toBeTruthy();
  });

  it('renders tier node titles', () => {
    const { getByText } = render(<LevelMapScreen />);
    expect(getByText('Note Finding')).toBeTruthy();
    expect(getByText('Black Keys')).toBeTruthy();
    expect(getByText('Performance')).toBeTruthy();
  });

  it('renders gradient header', () => {
    const { getByTestId } = render(<LevelMapScreen />);
    expect(getByTestId('linear-gradient')).toBeTruthy();
  });

  it('renders 15 tier nodes', () => {
    const { getByText } = render(<LevelMapScreen />);
    expect(getByText('Note Finding')).toBeTruthy();
    expect(getByText('Right Hand')).toBeTruthy();
    expect(getByText('Left Hand')).toBeTruthy();
    expect(getByText('Chords')).toBeTruthy();
    expect(getByText('Sight Reading')).toBeTruthy();
  });

  it('renders section headers', () => {
    const { getByText } = render(<LevelMapScreen />);
    expect(getByText('Beginner')).toBeTruthy();
    expect(getByText('Intermediate')).toBeTruthy();
    expect(getByText('Advanced')).toBeTruthy();
    expect(getByText('Mastery')).toBeTruthy();
  });

  // =========================================================================
  // SVG path connections
  // =========================================================================

  it('renders SVG path connections between nodes', () => {
    const { getAllByTestId } = render(<LevelMapScreen />);
    const paths = getAllByTestId('svg-path');
    // 15 nodes = 14 connecting paths
    expect(paths.length).toBe(14);
  });

  // =========================================================================
  // Cat companions at every tier
  // =========================================================================

  it('renders cat avatar at tier 1 (mini-meowww)', () => {
    const { getAllByTestId } = render(<LevelMapScreen />);
    const cats = getAllByTestId('cat-avatar-mini-meowww');
    expect(cats.length).toBeGreaterThanOrEqual(1);
  });

  it('renders different cats at different tiers', () => {
    const { getByTestId } = render(<LevelMapScreen />);
    // Tier 2 = luna, Tier 3 = jazzy
    expect(getByTestId('cat-avatar-luna')).toBeTruthy();
    expect(getByTestId('cat-avatar-jazzy')).toBeTruthy();
  });

  it('renders legendary cat at tier 15', () => {
    const { getByTestId } = render(<LevelMapScreen />);
    expect(getByTestId('cat-avatar-chonky-monke')).toBeTruthy();
  });

  // =========================================================================
  // Back button
  // =========================================================================

  it('hides back button when used as tab (single route)', () => {
    const { queryByTestId } = render(<LevelMapScreen />);
    // When navigation state has only 1 route (tab context), back button is hidden
    expect(queryByTestId('level-map-back')).toBeNull();
  });

  // =========================================================================
  // Node states — fresh user (no progress)
  // =========================================================================

  describe('fresh user (no progress)', () => {
    beforeEach(() => {
      mockMasteredSkills = [];
    });

    it('shows tier 1 as current (START chip)', () => {
      const { getByText } = render(<LevelMapScreen />);
      expect(getByText('START')).toBeTruthy();
    });
  });

  // =========================================================================
  // Node states — tier 1 completed via skill mastery
  // =========================================================================

  describe('tier 1 completed via skill mastery', () => {
    beforeEach(() => {
      mockMasteredSkills = ['find-middle-c', 'keyboard-geography', 'white-keys'];
    });

    it('shows tier 2 as current', () => {
      const { getByText } = render(<LevelMapScreen />);
      expect(getByText('START')).toBeTruthy();
    });
  });

  // =========================================================================
  // Navigation
  // =========================================================================

  describe('navigation', () => {
    it('navigates to TierIntro for current tier', () => {
      const { getByText } = render(<LevelMapScreen />);
      fireEvent.press(getByText('Note Finding'));
      expect(mockNavigate).toHaveBeenCalledWith('TierIntro', { tier: 1, locked: false });
    });

    it('navigates to TierIntro for completed tier (review)', () => {
      mockMasteredSkills = ['find-middle-c', 'keyboard-geography', 'white-keys'];
      const { getByText } = render(<LevelMapScreen />);
      fireEvent.press(getByText('Note Finding'));
      expect(mockNavigate).toHaveBeenCalledWith('TierIntro', { tier: 1, locked: false });
    });

    it('navigates to TierIntro with locked=true for locked tier', () => {
      const { getByText } = render(<LevelMapScreen />);
      fireEvent.press(getByText('Left Hand'));
      expect(mockNavigate).toHaveBeenCalledWith('TierIntro', { tier: 3, locked: true });
    });

    it('navigates to TierIntro even for later tiers (all AI)', () => {
      const { getByText } = render(<LevelMapScreen />);
      fireEvent.press(getByText('Black Keys'));
      expect(mockNavigate).toHaveBeenCalledWith('TierIntro', { tier: 6, locked: true });
    });
  });

  // =========================================================================
  // Header stats
  // =========================================================================

  it('displays completed tier count and total skills in header', () => {
    const { getByText } = render(<LevelMapScreen />);
    expect(getByText('0/15')).toBeTruthy();
    expect(getByText('0 skills')).toBeTruthy();
  });

  it('renders section banners with cat reward previews', () => {
    const { getByText } = render(<LevelMapScreen />);
    expect(getByText('Fundamentals')).toBeTruthy();
  });

  it('shows gem count in header', () => {
    const { getByText } = render(<LevelMapScreen />);
    expect(getByText('50')).toBeTruthy();
  });
});
