/**
 * HomeScreen UI Tests
 * Tests rendering of key sections: greeting, streak, XP, daily challenge,
 * continue learning card, and navigation actions.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Navigation mock (override global setup mock with controllable jest.fn)
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: {} }),
  NavigationContainer: ({ children }: any) => children,
}));

// ---------------------------------------------------------------------------
// Zustand store mocks (must be before component import)
// ---------------------------------------------------------------------------

let mockProgressState: any = {
  totalXp: 500,
  level: 3,
  streakData: { currentStreak: 5, longestStreak: 10, lastPracticeDate: '2026-02-16' },
  lessonProgress: {},
  dailyGoalData: {},
  recordExerciseCompletion: jest.fn(),
  addXp: jest.fn(),
  setLevel: jest.fn(),
  updateStreakData: jest.fn(),
  updateLessonProgress: jest.fn(),
  updateExerciseProgress: jest.fn(),
  getLessonProgress: jest.fn(),
  getExerciseProgress: jest.fn(),
  recordPracticeSession: jest.fn(),
  updateDailyGoal: jest.fn(),
  reset: jest.fn(),
};
jest.mock('../../stores/progressStore', () => ({
  useProgressStore: Object.assign(
    (sel?: any) => (sel ? sel(mockProgressState) : mockProgressState),
    { getState: () => mockProgressState }
  ),
}));

let mockSettingsState: any = {
  dailyGoalMinutes: 15,
  displayName: 'Test Pianist',
  hasCompletedOnboarding: true,
  selectedCatId: 'mini-meowww',
  masterVolume: 0.8,
  soundEnabled: true,
  hapticEnabled: true,
  showFingerNumbers: true,
  showNoteNames: true,
  preferredHand: 'right',
  setDailyGoalMinutes: jest.fn(),
  setMasterVolume: jest.fn(),
  setDisplayName: jest.fn(),
  setSelectedCatId: jest.fn(),
  setAvatarEmoji: jest.fn(),
};
jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    (sel?: any) => (sel ? sel(mockSettingsState) : mockSettingsState),
    { getState: () => mockSettingsState }
  ),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: (props: any) => React.createElement(View, props, props.children),
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props, props.children),
    Svg: (props: any) => React.createElement(View, props, props.children),
    Circle: (props: any) => React.createElement(View, props),
    Rect: (props: any) => React.createElement(View, props),
    Path: (props: any) => React.createElement(View, props),
    G: (props: any) => React.createElement(View, props, props.children),
  };
});

jest.mock('../../components/DailyChallengeCard', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    DailyChallengeCard: (props: any) =>
      React.createElement(View, { testID: 'daily-challenge-card', ...props },
        React.createElement(Text, null, 'Daily Challenge')
      ),
  };
});

jest.mock('../../components/Mascot/CatAvatar', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CatAvatar: (props: any) => React.createElement(View, { testID: 'cat-avatar', ...props }),
  };
});

jest.mock('../../components/Mascot/MascotBubble', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    MascotBubble: (props: any) =>
      React.createElement(View, { testID: 'mascot-bubble', ...props },
        React.createElement(Text, null, props.message || 'bubble')
      ),
  };
});

jest.mock('../../components/StreakFlame', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    StreakFlame: (props: any) =>
      React.createElement(View, { testID: 'streak-flame', ...props },
        React.createElement(Text, null, 'streak:' + props.streak)
      ),
  };
});

jest.mock('../../content/catDialogue', () => ({
  getRandomCatMessage: jest.fn(() => 'Hello from your cat!'),
}));

jest.mock('../../core/catMood', () => ({
  calculateCatMood: jest.fn(() => 'happy'),
}));

jest.mock('../../content/ContentLoader', () => ({
  getLessons: jest.fn(() => [
    {
      id: 'lesson-01',
      metadata: { title: 'Lesson 1' },
    },
  ]),
  getLessonExercises: jest.fn(() => [
    {
      id: 'ex-01',
      metadata: { title: 'First Exercise' },
    },
    {
      id: 'ex-02',
      metadata: { title: 'Second Exercise' },
    },
  ]),
  isPostCurriculum: jest.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import { HomeScreen } from '../HomeScreen';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Reset store states to defaults
  mockProgressState.totalXp = 500;
  mockProgressState.level = 3;
  mockProgressState.streakData = { currentStreak: 5, longestStreak: 10, lastPracticeDate: '2026-02-16' };
  mockProgressState.lessonProgress = {};
  mockProgressState.dailyGoalData = {};

  mockSettingsState.dailyGoalMinutes = 15;
  mockSettingsState.displayName = 'Test Pianist';
  mockSettingsState.hasCompletedOnboarding = true;
  mockSettingsState.selectedCatId = 'mini-meowww';
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomeScreen', () => {
  it('renders welcome greeting with display name', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Test Pianist')).toBeTruthy();
  });

  it('renders a time-based greeting (Good Morning/Afternoon/Evening/Night)', () => {
    const { getByText } = render(<HomeScreen />);
    const hour = new Date().getHours();
    let expectedGreeting: string;
    if (hour >= 5 && hour < 12) expectedGreeting = 'Good Morning';
    else if (hour >= 12 && hour < 17) expectedGreeting = 'Good Afternoon';
    else if (hour >= 17 && hour < 21) expectedGreeting = 'Good Evening';
    else expectedGreeting = 'Good Night';

    expect(getByText(expectedGreeting)).toBeTruthy();
  });

  it('shows daily streak info via StreakFlame component', () => {
    const { getByTestId, getByText } = render(<HomeScreen />);
    expect(getByTestId('streak-flame')).toBeTruthy();
    expect(getByText('streak:5')).toBeTruthy();
  });

  it('shows continue/start learning button with exercise title', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Continue Learning')).toBeTruthy();
    expect(getByText('First Exercise')).toBeTruthy();
    expect(getByText('Lesson 1')).toBeTruthy();
  });

  it('shows daily challenge card', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Daily Challenge')).toBeTruthy();
  });

  it('navigates to Exercise screen when continue card is pressed', () => {
    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('First Exercise'));
    expect(mockNavigate).toHaveBeenCalledWith('Exercise', { exerciseId: 'ex-01' });
  });

  it('shows XP progress info', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('500 XP')).toBeTruthy();
  });

  it('shows level badge', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Lv. 3')).toBeTruthy();
  });

  it('shows daily goal text', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Daily Goal')).toBeTruthy();
    expect(getByText('0/15 min')).toBeTruthy();
  });

  it('shows stat pills row with exercise count and streak', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Exercises')).toBeTruthy();
    expect(getByText('Streak')).toBeTruthy();
    expect(getByText('Lessons')).toBeTruthy();
    expect(getByText('Stars')).toBeTruthy();
  });

  it('shows quick actions grid', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Learn')).toBeTruthy();
    expect(getByText('Practice')).toBeTruthy();
    expect(getByText('Free Play')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
  });

  it('navigates to DailySession when Learn action card is pressed', () => {
    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('Learn'));
    expect(mockNavigate).toHaveBeenCalledWith('DailySession');
  });

  it('does not redirect to onboarding when already completed', () => {
    render(<HomeScreen />);
    expect(mockNavigate).not.toHaveBeenCalledWith('Onboarding');
  });

  it('redirects to onboarding when not completed', () => {
    mockSettingsState.hasCompletedOnboarding = false;
    render(<HomeScreen />);
    expect(mockNavigate).toHaveBeenCalledWith('Onboarding');
  });

  it('shows cat avatar component', () => {
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('cat-avatar')).toBeTruthy();
  });

  it('shows mascot speech bubble', () => {
    const { getByTestId, getByText } = render(<HomeScreen />);
    expect(getByTestId('mascot-bubble')).toBeTruthy();
    expect(getByText('Hello from your cat!')).toBeTruthy();
  });

  it('shows goal complete chip when daily goal is met', () => {
    const today = new Date().toISOString().split('T')[0];
    mockProgressState.dailyGoalData = {
      [today]: { minutesPracticed: 20, minutesTarget: 15 },
    };
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Goal complete!')).toBeTruthy();
  });

  it('uses onNavigateToExercise callback prop when provided', () => {
    const onNav = jest.fn();
    const { getByText } = render(<HomeScreen onNavigateToExercise={onNav} />);
    fireEvent.press(getByText('First Exercise'));
    expect(onNav).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('Exercise', expect.anything());
  });
});
