/**
 * ProfileScreen UI Tests
 * Tests rendering of user profile, stats, achievements, settings,
 * and navigation to Account / CatSwitch screens.
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
  streakData: {
    currentStreak: 5,
    longestStreak: 10,
    lastPracticeDate: '2026-02-16',
    freezesAvailable: 1,
    freezesUsed: 0,
    weeklyPractice: [false, false, false, false, false, false, false],
  },
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
  displayName: 'TestUser',
  hasCompletedOnboarding: true,
  selectedCatId: 'mini-meowww',
  masterVolume: 0.8,
  soundEnabled: true,
  hapticEnabled: true,
  showFingerNumbers: true,
  showNoteNames: true,
  preferredHand: 'right',
  avatarEmoji: 'cat',
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

let mockAchievementState: any = {
  unlockedIds: {
    'first-note': '2026-02-15T10:00:00Z',
    'streak-3': '2026-02-14T10:00:00Z',
  },
  totalNotesPlayed: 200,
  perfectScoreCount: 5,
  highScoreCount: 12,
  isUnlocked: jest.fn((id: string) => id in mockAchievementState.unlockedIds),
  getUnlockedAchievements: jest.fn(() => []),
  getUnlockedCount: jest.fn(() => Object.keys(mockAchievementState.unlockedIds).length),
  getTotalCount: jest.fn(() => 32),
  checkAndUnlock: jest.fn(() => []),
  incrementNotesPlayed: jest.fn(),
  recordPerfectScore: jest.fn(),
  recordHighScore: jest.fn(),
  hydrate: jest.fn(),
  reset: jest.fn(),
};
jest.mock('../../stores/achievementStore', () => ({
  useAchievementStore: Object.assign(
    (sel?: any) => (sel ? sel(mockAchievementState) : mockAchievementState),
    { getState: () => mockAchievementState }
  ),
}));

let mockLearnerProfileState: any = {
  noteAccuracy: {},
  noteAttempts: {},
  skills: { timingAccuracy: 0.5, pitchAccuracy: 0.5, sightReadSpeed: 0.5, chordRecognition: 0.5 },
  tempoRange: { min: 40, max: 80 },
  weakNotes: [],
  weakSkills: [],
  totalExercisesCompleted: 0,
  lastAssessmentDate: '',
  assessmentScore: 0,
  updateNoteAccuracy: jest.fn(),
  updateSkill: jest.fn(),
  recalculateWeakAreas: jest.fn(),
  recordExerciseResult: jest.fn(),
  reset: jest.fn(),
};
jest.mock('../../stores/learnerProfileStore', () => ({
  useLearnerProfileStore: Object.assign(
    (sel?: any) => (sel ? sel(mockLearnerProfileState) : mockLearnerProfileState),
    { getState: () => mockLearnerProfileState }
  ),
}));

let mockAuthState: any = {
  user: null,
  isAnonymous: true,
  isLoading: false,
  isAuthenticated: false,
  error: null,
  initAuth: jest.fn(),
  signInAnonymously: jest.fn(),
  signOut: jest.fn(),
  clearError: jest.fn(),
};
jest.mock('../../stores/authStore', () => ({
  useAuthStore: Object.assign(
    (sel?: any) => (sel ? sel(mockAuthState) : mockAuthState),
    { getState: () => mockAuthState }
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

jest.mock('../../components/Mascot/CatAvatar', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CatAvatar: (props: any) => React.createElement(View, { testID: 'cat-avatar', ...props }),
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

jest.mock('../../components/Mascot/catCharacters', () => ({
  CAT_CHARACTERS: [
    {
      id: 'mini-meowww',
      name: 'Mini Meowww',
      emoji: 'CAT',
      backstory: 'A tiny tuxedo cat',
      musicSkill: 'Precision & Expression',
      personality: 'Tiny but Mighty',
      color: '#FF69B4',
      unlockLevel: 1,
      visuals: {
        bodyColor: '#333333',
        bellyColor: '#FFFFFF',
        earInnerColor: '#FFB6C1',
        eyeColor: '#4FC3F7',
        noseColor: '#FFB6C1',
        pattern: 'tuxedo',
      },
    },
  ],
  getCatById: jest.fn(() => ({
    id: 'mini-meowww',
    name: 'Mini Meowww',
    emoji: 'CAT',
    backstory: 'A tiny tuxedo cat',
    musicSkill: 'Precision & Expression',
    personality: 'Tiny but Mighty',
    color: '#FF69B4',
    unlockLevel: 1,
    visuals: {
      bodyColor: '#333333',
      bellyColor: '#FFFFFF',
      earInnerColor: '#FFB6C1',
      eyeColor: '#4FC3F7',
      noseColor: '#FFB6C1',
      pattern: 'tuxedo',
    },
  })),
  isCatUnlocked: jest.fn(() => true),
}));

jest.mock('../../core/progression/XpSystem', () => ({
  getLevelProgress: jest.fn(() => ({
    level: 3,
    totalXp: 500,
    currentLevelXp: 225,
    nextLevelXp: 338,
    xpIntoLevel: 25,
    xpToNextLevel: 200,
    percentToNextLevel: 11,
  })),
}));

jest.mock('../../core/achievements/achievements', () => ({
  ACHIEVEMENTS: [
    { id: 'first-note', title: 'First Note', description: 'Play your first note', icon: 'music-note', xpReward: 10, condition: { type: 'notes_played', threshold: 1 } },
    { id: 'streak-3', title: 'Hot Streak', description: '3-day streak', icon: 'fire', xpReward: 20, condition: { type: 'streak', threshold: 3 } },
    { id: 'perfect-10', title: 'Perfectionist', description: '10 perfect scores', icon: 'star', xpReward: 50, condition: { type: 'perfect_scores', threshold: 10 } },
  ],
  checkAchievements: jest.fn(() => []),
  getAchievementById: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks
// ---------------------------------------------------------------------------

import { ProfileScreen } from '../ProfileScreen';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Reset store states to defaults
  mockProgressState.totalXp = 500;
  mockProgressState.level = 3;
  mockProgressState.streakData = {
    currentStreak: 5,
    longestStreak: 10,
    lastPracticeDate: '2026-02-16',
    freezesAvailable: 1,
    freezesUsed: 0,
    weeklyPractice: [false, false, false, false, false, false, false],
  };
  mockProgressState.lessonProgress = {};
  mockProgressState.dailyGoalData = {};

  mockSettingsState.dailyGoalMinutes = 15;
  mockSettingsState.displayName = 'TestUser';
  mockSettingsState.hasCompletedOnboarding = true;
  mockSettingsState.selectedCatId = 'mini-meowww';
  mockSettingsState.masterVolume = 0.8;

  mockAchievementState.unlockedIds = {
    'first-note': '2026-02-15T10:00:00Z',
    'streak-3': '2026-02-14T10:00:00Z',
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProfileScreen', () => {
  it('renders user display name', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('TestUser')).toBeTruthy();
  });

  it('renders anonymous-style placeholder when name is default', () => {
    mockSettingsState.displayName = 'Piano Student';
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Piano Student')).toBeTruthy();
  });

  it('shows level information', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText(/Level 3 Pianist/)).toBeTruthy();
  });

  it('shows total XP in stats grid', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Total XP')).toBeTruthy();
  });

  it('shows streak information via stat card and StreakFlame', () => {
    const { getByText, getAllByTestId } = render(<ProfileScreen />);
    expect(getByText('Day Streak')).toBeTruthy();
    const flames = getAllByTestId('streak-flame');
    expect(flames.length).toBeGreaterThanOrEqual(1);
  });

  it('shows XP to next level text', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('200 XP to next')).toBeTruthy();
  });

  it('shows settings section with Daily Goal option', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Settings')).toBeTruthy();
    expect(getByText('Daily Goal')).toBeTruthy();
    expect(getByText('15 min')).toBeTruthy();
  });

  it('shows volume setting', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Volume')).toBeTruthy();
    expect(getByText('80%')).toBeTruthy();
  });

  it('shows MIDI Setup setting', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('MIDI Setup')).toBeTruthy();
  });

  it('Account button navigates to AccountScreen', () => {
    const { getByText } = render(<ProfileScreen />);
    fireEvent.press(getByText('Account'));
    expect(mockNavigate).toHaveBeenCalledWith('Account');
  });

  it('Cat avatar press navigates to CatSwitchScreen', () => {
    const { getByTestId } = render(<ProfileScreen />);
    const avatar = getByTestId('cat-avatar');
    fireEvent.press(avatar);
    expect(mockNavigate).toHaveBeenCalledWith('CatSwitch');
  });

  it('shows achievements section with count', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Achievements')).toBeTruthy();
    expect(getByText('2/3')).toBeTruthy();
  });

  it('shows unlocked achievement titles', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('First Note')).toBeTruthy();
    expect(getByText('Hot Streak')).toBeTruthy();
  });

  it('shows locked achievements too', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('Perfectionist')).toBeTruthy();
  });

  it('shows About setting', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('About')).toBeTruthy();
  });

  it('shows cat avatar component', () => {
    const { getByTestId } = render(<ProfileScreen />);
    expect(getByTestId('cat-avatar')).toBeTruthy();
  });

  it('shows This Week section header', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText('This Week')).toBeTruthy();
    expect(getByText('0 min total')).toBeTruthy();
  });

  it('shows stat labels for all four stat cards', () => {
    const { getAllByText, getByText } = render(<ProfileScreen />);
    // 'Level' appears in multiple places (stat card label, subtitle, progress ring)
    expect(getAllByText(/^Level$/).length).toBeGreaterThanOrEqual(1);
    expect(getByText('Total XP')).toBeTruthy();
    expect(getByText('Day Streak')).toBeTruthy();
    expect(getByText('Lessons Done')).toBeTruthy();
  });

  it('navigates to MIDI Setup when MIDI Setup setting is pressed', () => {
    const { getByText } = render(<ProfileScreen />);
    fireEvent.press(getByText('MIDI Setup'));
    expect(mockNavigate).toHaveBeenCalledWith('MidiSetup');
  });

  it('shows cat personality in subtitle', () => {
    const { getByText } = render(<ProfileScreen />);
    expect(getByText(/Mini Meowww/)).toBeTruthy();
  });
});
