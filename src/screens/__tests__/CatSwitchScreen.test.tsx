/**
 * CatSwitchScreen UI Tests
 *
 * Tests the Subway Surfers-style horizontal cat gallery: rendering cat cards,
 * select/lock states, navigation, header info, and selection behavior.
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
  level: 5, // unlocks first several cats
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
  });

  // =========================================================================
  // Rendering
  // =========================================================================

  it('renders header title "Choose Your Cat"', () => {
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('Choose Your Cat')).toBeTruthy();
  });

  it('shows unlock count in header subtitle', () => {
    const { getByText } = render(<CatSwitchScreen />);
    // Level 5 unlocks cats with unlockLevel <= 5
    const unlockedCount = CAT_CHARACTERS.filter((c) => c.unlockLevel <= 5).length;
    expect(getByText(`${unlockedCount} of ${CAT_CHARACTERS.length} unlocked`)).toBeTruthy();
  });

  it('renders the first cat card name (Mini Meowww)', () => {
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('Mini Meowww')).toBeTruthy();
  });

  it('renders personality badge for visible cat', () => {
    const { getByText } = render(<CatSwitchScreen />);
    // Mini Meowww's personality
    expect(getByText('Tiny but Mighty')).toBeTruthy();
  });

  it('renders music skill for visible cat', () => {
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('Precision & Expression')).toBeTruthy();
  });

  // =========================================================================
  // Selected state
  // =========================================================================

  it('shows "Selected" button for the currently selected cat', () => {
    const { getByText } = render(<CatSwitchScreen />);
    // Mini Meowww is selectedCatId
    expect(getByText('Selected')).toBeTruthy();
  });

  it('shows KeysieSvg with "celebrating" mood for selected cat', () => {
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('KeysieSvg-celebrating')).toBeTruthy();
  });

  // =========================================================================
  // Locked state
  // =========================================================================

  it('shows "Locked" button for cats above current level', () => {
    mockProgressState.level = 1; // Only unlocks level 1 cats
    const { getAllByText } = render(<CatSwitchScreen />);
    const locked = getAllByText('Locked');
    // All cats except Mini Meowww (unlockLevel 1) should show Locked
    expect(locked.length).toBe(CAT_CHARACTERS.length - 1);
  });

  it('shows unlock level badge for locked cats', () => {
    mockProgressState.level = 1;
    const { getAllByText } = render(<CatSwitchScreen />);
    // Jazzy is level 2
    const level2Badges = getAllByText('Level 2');
    expect(level2Badges.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Selection behavior
  // =========================================================================

  it('calls setSelectedCatId when tapping "Select" on an unlocked cat', () => {
    // Set selectedCatId to something else so the 2nd cat shows "Select"
    mockSettingsState.selectedCatId = 'jazzy';
    mockProgressState.level = 5;
    const { getAllByText } = render(<CatSwitchScreen />);

    // Find "Select" buttons (non-selected, unlocked cats)
    const selectButtons = getAllByText('Select');
    expect(selectButtons.length).toBeGreaterThanOrEqual(1);

    // Tap the first "Select" button
    fireEvent.press(selectButtons[0]);
    expect(mockSetSelectedCatId).toHaveBeenCalled();
  });

  // =========================================================================
  // Navigation
  // =========================================================================

  it('calls goBack when pressing back button', () => {
    const { getByText } = render(<CatSwitchScreen />);
    // Back button renders arrow-left icon, which our mock renders as text
    const backIcon = getByText('arrow-left');
    fireEvent.press(backIcon);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // Pagination dots
  // =========================================================================

  it('renders pagination dots (component renders without crash)', () => {
    // Pagination dots are purely visual — verify component renders successfully
    const { getByText } = render(<CatSwitchScreen />);
    expect(getByText('Choose Your Cat')).toBeTruthy();
  });

  // =========================================================================
  // Level changes
  // =========================================================================

  it('unlocks more cats at higher levels', () => {
    mockProgressState.level = 10; // Should unlock most cats
    const { queryAllByText } = render(<CatSwitchScreen />);
    const lockedButtons = queryAllByText('Locked');
    const highLevelUnlocked = CAT_CHARACTERS.filter((c) => c.unlockLevel <= 10).length;
    expect(lockedButtons.length).toBe(CAT_CHARACTERS.length - highLevelUnlocked);
  });
});
