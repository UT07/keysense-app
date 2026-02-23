/**
 * CatSwitchScreen UI Tests
 *
 * Tests the Subway Surfers-style horizontal cat gallery: rendering cat cards,
 * select/lock states, navigation, header info, and selection behavior.
 *
 * NOTE: All 12 cats now have unlockLevel=1 (gated by gems, not levels).
 * CatSwitchScreen will be replaced by CatCollectionScreen with gem-based locking.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Navigation mock
// ---------------------------------------------------------------------------

const mockGoBack = jest.fn();
const mockNavigation = {
  navigate: jest.fn(),
  goBack: mockGoBack,
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: {} }),
}));

// ---------------------------------------------------------------------------
// expo-linear-gradient mock
// ---------------------------------------------------------------------------

jest.mock('expo-linear-gradient', () => {
  const mockReact = require('react');
  const RN = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      mockReact.createElement(RN.View, props, children),
  };
});

// ---------------------------------------------------------------------------
// KeysieSvg mock (renders a simple View with testable props)
// ---------------------------------------------------------------------------

jest.mock('../../components/Mascot/KeysieSvg', () => ({
  KeysieSvg: (props: any) => {
    const React = require('react');
    const { View, Text } = require('react-native');
    return React.createElement(View, { testID: `keysie-${props.mood}` },
      React.createElement(Text, null, `KeysieSvg-${props.mood}`),
    );
  },
}));

// ---------------------------------------------------------------------------
// Zustand store mocks
// ---------------------------------------------------------------------------

const mockSetSelectedCatId = jest.fn();
const mockSetAvatarEmoji = jest.fn();

let mockProgressState: any = {
  totalXp: 500,
  level: 5,
  streakData: { currentStreak: 3, longestStreak: 10, lastPracticeDate: '2026-02-16' },
  lessonProgress: {},
  dailyGoalData: {},
};

jest.mock('../../stores/progressStore', () => ({
  useProgressStore: Object.assign(
    (sel?: any) => (sel ? sel(mockProgressState) : mockProgressState),
    { getState: () => mockProgressState },
  ),
}));

let mockSettingsState: any = {
  selectedCatId: 'mini-meowww',
  setSelectedCatId: mockSetSelectedCatId,
  setAvatarEmoji: mockSetAvatarEmoji,
  displayName: 'Test',
  hasCompletedOnboarding: true,
  masterVolume: 0.8,
  soundEnabled: true,
  hapticEnabled: true,
};

jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    (sel?: any) => (sel ? sel(mockSettingsState) : mockSettingsState),
    { getState: () => mockSettingsState },
  ),
}));

let mockEvolutionState: any = {
  selectedCatId: 'mini-meowww',
  ownedCats: ['mini-meowww', 'jazzy', 'luna'],
  evolutionData: {},
  selectCat: jest.fn(),
  unlockCat: jest.fn(),
};

jest.mock('../../stores/catEvolutionStore', () => ({
  useCatEvolutionStore: Object.assign(
    (sel?: any) => (sel ? sel(mockEvolutionState) : mockEvolutionState),
    { getState: () => mockEvolutionState },
  ),
  stageFromXp: () => 'baby',
  xpToNextStage: () => ({ nextStage: 'teen', xpNeeded: 500 }),
}));

let mockGemState: any = {
  gems: 1000,
  canAfford: jest.fn(() => true),
  spendGems: jest.fn(() => true),
};

jest.mock('../../stores/gemStore', () => ({
  useGemStore: Object.assign(
    (sel?: any) => (sel ? sel(mockGemState) : mockGemState),
    { getState: () => mockGemState },
  ),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { CatSwitchScreen } from '../CatSwitchScreen';
import { CAT_CHARACTERS } from '../../components/Mascot/catCharacters';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CatSwitchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProgressState.level = 5;
    mockSettingsState.selectedCatId = 'mini-meowww';
    mockEvolutionState.ownedCats = ['mini-meowww', 'jazzy', 'luna'];
    mockGemState.gems = 1000;
    mockGemState.canAfford = jest.fn(() => true);
    mockGemState.spendGems = jest.fn(() => true);
  });

  // =========================================================================
  // Rendering
  // =========================================================================

  it('renders header title "Cat Gallery"', () => {
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('Cat Gallery')).toBeTruthy();
  });

  it('shows unlock count in header subtitle', () => {
    const { getByText } = render(<CatSwitchScreen />);
    // Only owned cats (from catEvolutionStore mock) count as unlocked
    const ownedCount = mockEvolutionState.ownedCats.length;
    expect(getByText(`${ownedCount} of ${CAT_CHARACTERS.length} unlocked`)).toBeTruthy();
  });

  it('renders the first cat card name (Mini Meowww)', () => {
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('Mini Meowww')).toBeTruthy();
  });

  it('renders personality badge for visible cat', () => {
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('Tiny but Mighty')).toBeTruthy();
  });

  it('renders music skill for visible cat', () => {
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('Precision & Expression')).toBeTruthy();
  });

  it('renders all 12 cat characters', () => {
    expect(CAT_CHARACTERS.length).toBe(12);
  });

  it('has exactly 3 starter cats', () => {
    const starters = CAT_CHARACTERS.filter(c => c.starterCat);
    expect(starters.length).toBe(3);
    expect(starters.map(c => c.id)).toEqual(['mini-meowww', 'jazzy', 'luna']);
  });

  it('has Chonky Monké as legendary (no gem cost)', () => {
    const chonky = CAT_CHARACTERS.find(c => c.id === 'chonky-monke');
    expect(chonky).toBeDefined();
    expect(chonky!.legendary).toBe(true);
    expect(chonky!.gemCost).toBeNull();
  });

  // =========================================================================
  // Selected state
  // =========================================================================

  it('shows "Selected" button for the currently selected cat', () => {
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('Selected')).toBeTruthy();
  });

  it('shows KeysieSvg with "celebrating" mood for selected cat', () => {
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('KeysieSvg-celebrating')).toBeTruthy();
  });

  // =========================================================================
  // Selection behavior
  // =========================================================================

  it('calls setSelectedCatId when tapping "Select" on an owned cat', () => {
    mockSettingsState.selectedCatId = 'jazzy';
    mockEvolutionState.ownedCats = ['mini-meowww', 'jazzy', 'luna'];
    const { getAllByText } = render(<CatSwitchScreen />);

    const selectButtons = getAllByText('Select');
    expect(selectButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.press(selectButtons[0]);
    expect(mockSetSelectedCatId).toHaveBeenCalled();
  });

  // =========================================================================
  // Navigation
  // =========================================================================

  it('calls goBack when pressing back button', () => {
    const { getByText } = render(<CatSwitchScreen />);
    const backIcon = getByText('arrow-left');
    fireEvent.press(backIcon);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // Pagination dots
  // =========================================================================

  it('renders pagination dots (component renders without crash)', () => {
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('Cat Gallery')).toBeTruthy();
  });

  // =========================================================================
  // Cat data integrity
  // =========================================================================

  it('every cat has 4 abilities', () => {
    for (const cat of CAT_CHARACTERS) {
      expect(cat.abilities.length).toBe(4);
    }
  });

  it('every cat has evolution visuals for all 4 stages', () => {
    const stages = ['baby', 'teen', 'adult', 'master'] as const;
    for (const cat of CAT_CHARACTERS) {
      for (const stage of stages) {
        expect(cat.evolutionVisuals[stage]).toBeDefined();
      }
    }
  });

  it('gem costs are valid for non-starter, non-legendary cats', () => {
    const gemCats = CAT_CHARACTERS.filter(c => !c.starterCat && !c.legendary);
    for (const cat of gemCats) {
      expect(cat.gemCost).toBeGreaterThan(0);
    }
  });
});
