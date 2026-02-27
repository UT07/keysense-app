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

jest.mock('../../components/common/AnimatedGradientBackground', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    AnimatedGradientBackground: (props: any) => React.createElement(View, props, props.children),
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

jest.mock('../../components/Mascot/SalsaCoach', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    SalsaCoach: (props: any) =>
      React.createElement(View, { testID: 'salsa-coach', ...props },
        React.createElement(Text, null, props.catchphrase || 'Salsa says hi')
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

let mockLearnerProfileState: any = {
  masteredSkills: [],
  weakNotes: [],
  skills: { timingAccuracy: 0.5, pitchAccuracy: 0.5, sightReadSpeed: 0.5, chordRecognition: 0.5 },
  tempoRange: { min: 40, max: 80 },
  noteAccuracy: {},
  noteAttempts: {},
  weakSkills: [],
  totalExercisesCompleted: 0,
  lastAssessmentDate: '',
  assessmentScore: 0,
};
jest.mock('../../stores/learnerProfileStore', () => ({
  useLearnerProfileStore: Object.assign(
    (sel?: any) => (sel ? sel(mockLearnerProfileState) : mockLearnerProfileState),
    { getState: () => mockLearnerProfileState }
  ),
}));

jest.mock('../../core/curriculum/CurriculumEngine', () => ({
  getNextSkillToLearn: jest.fn(() => ({ id: 'find-middle-c', name: 'Find Middle C', category: 'note-finding' })),
}));

jest.mock('../../core/curriculum/SkillTree', () => ({
  SKILL_TREE: Array.from({ length: 27 }, (_, i) => ({ id: `skill-${i}`, name: `Skill ${i}` })),
}));

// Gem store mock
const mockGemState: any = {
  gems: 100,
  totalGemsEarned: 200,
  totalGemsSpent: 100,
  transactions: [],
  earnGems: jest.fn(),
  spendGems: jest.fn(),
  canAfford: jest.fn(() => true),
  reset: jest.fn(),
};
jest.mock('../../stores/gemStore', () => ({
  useGemStore: Object.assign(
    (sel?: any) => (sel ? sel(mockGemState) : mockGemState),
    { getState: () => mockGemState }
  ),
}));

// Cat evolution store mock
const mockEvolutionState: any = {
  selectedCatId: 'mini-meowww',
  ownedCats: ['mini-meowww'],
  evolutionData: {
    'mini-meowww': {
      catId: 'mini-meowww',
      currentStage: 'baby',
      xpAccumulated: 0,
      abilitiesUnlocked: [],
      evolvedAt: { baby: Date.now(), teen: null, adult: null, master: null },
    },
  },
  dailyRewards: {
    weekStartDate: '2026-02-21',
    days: [
      { day: 1, reward: { type: 'gems', amount: 10 }, claimed: false },
      { day: 2, reward: { type: 'gems', amount: 15 }, claimed: false },
    ],
    currentDay: 1,
  },
  chonkyUnlockProgress: { daysStreakReached: false, skillsMasteredReached: false },
  selectCat: jest.fn(),
  unlockCat: jest.fn(),
  addEvolutionXp: jest.fn(),
  getActiveAbilities: jest.fn(() => []),
  claimDailyReward: jest.fn(),
  resetDailyRewards: jest.fn(),
  advanceDailyRewardDate: jest.fn(),
  completeDailyChallenge: jest.fn(),
  isDailyChallengeCompleted: jest.fn(() => false),
  checkChonkyEligibility: jest.fn(() => false),
  unlockChonky: jest.fn(),
  initializeStarterCat: jest.fn(),
  reset: jest.fn(),
};
jest.mock('../../stores/catEvolutionStore', () => ({
  useCatEvolutionStore: Object.assign(
    (sel?: any) => (sel ? sel(mockEvolutionState) : mockEvolutionState),
    { getState: () => mockEvolutionState }
  ),
  xpToNextStage: jest.fn(() => ({ nextStage: 'teen', xpNeeded: 500 })),
}));

jest.mock('../../stores/types', () => ({
  EVOLUTION_XP_THRESHOLDS: { baby: 0, teen: 500, adult: 2000, master: 5000 },
}));

// Song store mock
const mockSongStoreState: any = {
  summaries: [],
  isLoadingSummaries: false,
  filter: {},
  currentSong: null,
  isLoadingSong: false,
  isGeneratingSong: false,
  generationError: null,
  songMastery: {},
  recentSongIds: [],
  songRequestsToday: { date: '', count: 0 },
  loadSummaries: jest.fn(),
  loadMoreSummaries: jest.fn(),
  setFilter: jest.fn(),
  loadSong: jest.fn(),
  updateMastery: jest.fn(),
  getMastery: jest.fn(),
  requestSong: jest.fn(),
  canRequestSong: jest.fn(() => true),
};
jest.mock('../../stores/songStore', () => ({
  useSongStore: Object.assign(
    (sel?: any) => (sel ? sel(mockSongStoreState) : mockSongStoreState),
    { getState: () => mockSongStoreState }
  ),
}));

jest.mock('../../components/MusicLibrarySpotlight', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    MusicLibrarySpotlight: (props: any) =>
      React.createElement(View, { testID: 'music-library-spotlight', ...props },
        React.createElement(Text, null, 'Music Library')
      ),
  };
});

jest.mock('../../components/ReviewChallengeCard', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    ReviewChallengeCard: (props: any) =>
      React.createElement(View, { testID: 'review-challenge-card', ...props },
        React.createElement(Text, null, 'Review Challenge')
      ),
  };
});

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

  it('shows continue learning card with skill-based progress', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Continue Learning')).toBeTruthy();
    expect(getByText('Find Middle C')).toBeTruthy();
    expect(getByText('0 skills mastered')).toBeTruthy();
  });

  it('shows daily challenge card', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('Daily Challenge')).toBeTruthy();
  });

  it('navigates to Learn tab when continue card is pressed', () => {
    const { getByText } = render(<HomeScreen />);
    fireEvent.press(getByText('Find Middle C'));
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'Learn' });
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
    expect(getByText('Songs')).toBeTruthy();
    expect(getByText('Free Play')).toBeTruthy();
    expect(getByText('Collection')).toBeTruthy();
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

  it('shows Salsa coach greeting', () => {
    const { getByTestId, getByText } = render(<HomeScreen />);
    expect(getByTestId('salsa-coach')).toBeTruthy();
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
    fireEvent.press(getByText('Find Middle C'));
    expect(onNav).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('MainTabs', expect.anything());
  });

  it('shows gem counter with current balance', () => {
    const { getByTestId, getByText } = render(<HomeScreen />);
    expect(getByTestId('gem-counter')).toBeTruthy();
    expect(getByText('100')).toBeTruthy();
  });

  it('shows music library spotlight', () => {
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('music-library-spotlight')).toBeTruthy();
  });

  it('shows evolution progress bar when cat has evolution data', () => {
    const { getByTestId } = render(<HomeScreen />);
    expect(getByTestId('evolution-progress')).toBeTruthy();
  });

  it('shows evolution XP to next stage', () => {
    const { getByText } = render(<HomeScreen />);
    expect(getByText('500 to teen')).toBeTruthy();
  });
});
