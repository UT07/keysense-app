/**
 * OnboardingScreen Tests
 * Comprehensive UI tests for the 5-step onboarding flow:
 * 1. Welcome
 * 2. Experience Level
 * 3. Equipment Check
 * 4. Goal Setting
 * 5. Choose Your Cat Companion
 *
 * Covers rendering, navigation, step progression, settings persistence,
 * progress bar, cat avatar, and edge cases.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock setup (MUST come before component import)
// ---------------------------------------------------------------------------

// Mutable settings state for Zustand-style mock
let mockSettingsState: any = {
  hasCompletedOnboarding: false,
  experienceLevel: 'beginner',
  learningGoal: 'songs',
  dailyGoalMinutes: 10,
  selectedCatId: 'mini-meowww',
  playbackSpeed: 0.5,
  setExperienceLevel: jest.fn(),
  setLearningGoal: jest.fn(),
  setDailyGoalMinutes: jest.fn(),
  setHasCompletedOnboarding: jest.fn(),
  setPlaybackSpeed: jest.fn(),
  setPreferredInputMethod: jest.fn(),
  updateMidiSettings: jest.fn(),
  setSelectedCatId: jest.fn(),
  preferredInputMethod: 'touch',
};

jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    (selector: any) => selector(mockSettingsState),
    {
      getState: () => mockSettingsState,
      setState: (s: any) => {
        Object.assign(
          mockSettingsState,
          typeof s === 'function' ? s(mockSettingsState) : s,
        );
      },
    },
  ),
}));

// Mock catEvolutionStore
const mockInitializeStarterCat = jest.fn();
jest.mock('../../stores/catEvolutionStore', () => ({
  useCatEvolutionStore: Object.assign(
    (selector: any) => selector({ selectedCatId: '', ownedCats: [] }),
    {
      getState: () => ({
        initializeStarterCat: mockInitializeStarterCat,
      }),
    },
  ),
}));

// Navigation mock — capture navigate and goBack calls
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: mockGoBack,
      dispatch: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    }),
    useFocusEffect: (cb: () => (() => void) | void) => {
      // Execute the callback immediately to simulate focus
      const cleanup = cb();
      if (typeof cleanup === 'function') cleanup();
    },
  };
});

// Mock Cat3DCanvas (replaces CatAvatar + KeysieSvg)
jest.mock('../../components/Mascot/3d', () => ({
  Cat3DCanvas: (props: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={`cat-3d-${props.catId || 'default'}`}>
        <Text>Cat3DCanvas</Text>
      </View>
    );
  },
}));

// Mock catCharacters helpers
jest.mock('../../components/Mascot/catCharacters', () => ({
  getCatById: (id: string) => ({
    id,
    name: 'Mock Cat',
    color: '#DC143C',
    visuals: {
      bodyColor: '#1A1A1A',
      bellyColor: '#F5F5F5',
      earInnerColor: '#DC143C',
      eyeColor: '#2ECC71',
      noseColor: '#DC143C',
      pattern: 'tuxedo',
    },
  }),
  getDefaultCat: () => ({
    id: 'mini-meowww',
    name: 'Mini Meowww',
    color: '#DC143C',
    visuals: {
      bodyColor: '#1A1A1A',
      bellyColor: '#F5F5F5',
      earInnerColor: '#DC143C',
      eyeColor: '#2ECC71',
      noseColor: '#DC143C',
      pattern: 'tuxedo',
    },
  }),
  getStarterCats: () => [
    {
      id: 'mini-meowww',
      name: 'Mini Meowww',
      personality: 'Tiny but Mighty',
      musicSkill: 'Precision & Expression',
      color: '#DC143C',
      visuals: {
        bodyColor: '#1A1A1A',
        bellyColor: '#F5F5F5',
        earInnerColor: '#DC143C',
        eyeColor: '#2ECC71',
        noseColor: '#DC143C',
        pattern: 'tuxedo',
      },
    },
    {
      id: 'jazzy',
      name: 'Jazzy',
      personality: 'Cool & Smooth',
      musicSkill: 'Jazz Improvisation',
      color: '#9B59B6',
      visuals: {
        bodyColor: '#4A4A6A',
        bellyColor: '#6B6B8A',
        earInnerColor: '#9B59B6',
        eyeColor: '#D4A5FF',
        noseColor: '#9B59B6',
        pattern: 'solid',
      },
    },
    {
      id: 'luna',
      name: 'Luna',
      personality: 'Mysterious',
      musicSkill: 'Moonlight Compositions',
      color: '#5B6EAE',
      visuals: {
        bodyColor: '#1C1C3A',
        bellyColor: '#2A2A52',
        earInnerColor: '#5B6EAE',
        eyeColor: '#7EB8FF',
        noseColor: '#3D4F8A',
        pattern: 'solid',
      },
    },
  ],
}));

// Mock expo-linear-gradient as plain View
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: (props: any) => {
    const { View } = require('react-native');
    return <View {...props} />;
  },
}));

// Mock common Button component (uses react-native-reanimated internally)
jest.mock('../../components/common/Button', () => ({
  Button: (props: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity
        onPress={props.disabled ? undefined : props.onPress}
        testID={props.testID}
        disabled={props.disabled}
        accessibilityState={{ disabled: !!props.disabled }}
      >
        <Text>{props.title}</Text>
      </TouchableOpacity>
    );
  },
}));

// Mock common Card component
jest.mock('../../components/common/Card', () => ({
  Card: (props: any) => {
    const { TouchableOpacity, View } = require('react-native');
    if (props.onPress) {
      return (
        <TouchableOpacity
          onPress={props.onPress}
          testID={props.testID}
          style={props.style}
        >
          {props.children}
        </TouchableOpacity>
      );
    }
    return (
      <View testID={props.testID} style={props.style}>
        {props.children}
      </View>
    );
  },
}));

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks
// ---------------------------------------------------------------------------

import { OnboardingScreen } from '../OnboardingScreen';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetSettingsState(overrides: Partial<typeof mockSettingsState> = {}) {
  mockSettingsState = {
    hasCompletedOnboarding: false,
    experienceLevel: 'beginner',
    learningGoal: 'songs',
    dailyGoalMinutes: 10,
    selectedCatId: 'mini-meowww',
    playbackSpeed: 0.5,
    setExperienceLevel: jest.fn(),
    setLearningGoal: jest.fn(),
    setDailyGoalMinutes: jest.fn(),
    setHasCompletedOnboarding: jest.fn(),
    setPlaybackSpeed: jest.fn(),
    setPreferredInputMethod: jest.fn(),
    updateMidiSettings: jest.fn(),
    setSelectedCatId: jest.fn(),
    preferredInputMethod: 'touch',
    ...overrides,
  };
}

// ===========================================================================
// TESTS
// ===========================================================================

describe('OnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetSettingsState();
    mockInitializeStarterCat.mockClear();
  });

  // -----------------------------------------------------------------------
  // 1. Renders first step correctly (Welcome step)
  // -----------------------------------------------------------------------
  describe('Step 1: Welcome', () => {
    it('renders the welcome screen with title and Get Started button', () => {
      const { getByText } = render(<OnboardingScreen />);

      expect(getByText('Welcome to Purrrfect Keys')).toBeTruthy();
      expect(getByText('Get Started')).toBeTruthy();
    });

    it('renders the welcome subtitle text', () => {
      const { getByText } = render(<OnboardingScreen />);

      expect(
        getByText('Learn piano in 5 minutes a day with AI-powered feedback'),
      ).toBeTruthy();
    });

    it('renders feature list items', () => {
      const { getByText } = render(<OnboardingScreen />);

      expect(getByText('Real-time feedback on your playing')).toBeTruthy();
      expect(getByText('Personalized learning path')).toBeTruthy();
      expect(getByText('Build daily practice habits')).toBeTruthy();
    });

    it('renders Mini Meowww cat intro subtitle', () => {
      const { getByText } = render(<OnboardingScreen />);

      expect(getByText('Mini Meowww welcomes you!')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 2. All emoji icons render as text (not garbled unicode)
  // -----------------------------------------------------------------------
  describe('Emoji rendering', () => {
    it('renders feature emoji icons as actual text characters', () => {
      const { getByText } = render(<OnboardingScreen />);

      // Step 1 feature icons
      expect(getByText('\u26A1')).toBeTruthy();        // lightning
      expect(getByText('\uD83C\uDFAF')).toBeTruthy(); // target
      expect(getByText('\uD83D\uDD25')).toBeTruthy(); // fire
    });

    it('renders experience level emoji icons on step 2', () => {
      const { getByText } = render(<OnboardingScreen />);

      // Advance to step 2
      fireEvent.press(getByText('Get Started'));

      expect(getByText('\uD83C\uDF31')).toBeTruthy(); // seedling
      expect(getByText('\uD83D\uDCDA')).toBeTruthy(); // books
      expect(getByText('\uD83C\uDFBC')).toBeTruthy(); // musical score
    });

    it('renders equipment check emoji icons on step 3', () => {
      const { getByText } = render(<OnboardingScreen />);

      // Advance to step 2, select beginner, advance to step 3
      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));

      expect(getByText('\u2328\uFE0F')).toBeTruthy(); // keyboard
      expect(getByText('\uD83D\uDCF1')).toBeTruthy(); // mobile phone
    });

    it('renders goal setting emoji icons on step 4', () => {
      const { getByText } = render(<OnboardingScreen />);

      // Navigate to step 4
      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));

      expect(getByText('\uD83C\uDFB5')).toBeTruthy(); // musical note
      expect(getByText('\uD83C\uDFAF')).toBeTruthy(); // target
      expect(getByText('\uD83D\uDE80')).toBeTruthy(); // rocket
    });
  });

  // -----------------------------------------------------------------------
  // 3. Step navigation forward
  // -----------------------------------------------------------------------
  describe('Forward navigation', () => {
    it('advances from Welcome (step 1) to Experience Level (step 2)', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));

      expect(getByText("What's Your Experience Level?")).toBeTruthy();
    });

    it('advances from Experience Level (step 2) to Equipment Check (step 3) for beginners', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));

      expect(getByText('How Will You Play?')).toBeTruthy();
    });

    it('advances from Equipment Check (step 3) to Goal Setting (step 4)', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));

      expect(getByText("What's Your Goal?")).toBeTruthy();
    });

    it('advances from Goal Setting (step 4) to Cat Selection (step 5)', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Play My Favorite Songs'));
      fireEvent.press(getByText('Next'));

      expect(getByText('Choose Your Cat Companion')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 4. Step navigation back
  // -----------------------------------------------------------------------
  describe('Back navigation', () => {
    it('goes back from step 2 to step 1', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      expect(getByText("What's Your Experience Level?")).toBeTruthy();

      fireEvent.press(getByText('Back'));
      expect(getByText('Welcome to Purrrfect Keys')).toBeTruthy();
    });

    it('goes back from step 3 to step 2', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      expect(getByText('How Will You Play?')).toBeTruthy();

      fireEvent.press(getByText('Back'));
      expect(getByText("What's Your Experience Level?")).toBeTruthy();
    });

    it('goes back from step 4 to step 3', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      expect(getByText("What's Your Goal?")).toBeTruthy();

      fireEvent.press(getByText('Back'));
      expect(getByText('How Will You Play?')).toBeTruthy();
    });

    it('goes back from step 5 to step 4', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Play My Favorite Songs'));
      fireEvent.press(getByText('Next'));
      expect(getByText('Choose Your Cat Companion')).toBeTruthy();

      fireEvent.press(getByText('Back'));
      expect(getByText("What's Your Goal?")).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 5. All 5 steps render
  // -----------------------------------------------------------------------
  describe('All 5 steps render', () => {
    it('step 1: Welcome renders title', () => {
      const { getByText } = render(<OnboardingScreen />);
      expect(getByText('Welcome to Purrrfect Keys')).toBeTruthy();
    });

    it('step 2: Experience Level renders title and 3 options', () => {
      const { getByText } = render(<OnboardingScreen />);
      fireEvent.press(getByText('Get Started'));

      expect(getByText("What's Your Experience Level?")).toBeTruthy();
      expect(getByText('Complete Beginner')).toBeTruthy();
      expect(getByText('I Know Some Basics')).toBeTruthy();
      expect(getByText('Returning Player')).toBeTruthy();
    });

    it('step 3: Equipment Check renders title and 3 options', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));

      expect(getByText('How Will You Play?')).toBeTruthy();
      expect(getByText('MIDI Keyboard')).toBeTruthy();
      expect(getByText('Microphone')).toBeTruthy();
      expect(getByText('On-Screen Keyboard')).toBeTruthy();
    });

    it('step 4: Goal Setting renders title and 3 options', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));

      expect(getByText("What's Your Goal?")).toBeTruthy();
      expect(getByText('Play My Favorite Songs')).toBeTruthy();
      expect(getByText('Learn Proper Technique')).toBeTruthy();
      expect(getByText('Just Explore & Have Fun')).toBeTruthy();
    });

    it('step 5: Cat Selection renders title and 3 starter cats', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Play My Favorite Songs'));
      fireEvent.press(getByText('Next'));

      expect(getByText('Choose Your Cat Companion')).toBeTruthy();
      expect(getByText('Mini Meowww')).toBeTruthy();
      expect(getByText('Jazzy')).toBeTruthy();
      expect(getByText('Luna')).toBeTruthy();
      expect(getByText('Earn gems to unlock the others!')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 6. Completion saves to settings store
  // -----------------------------------------------------------------------
  describe('Completion saves to settings store', () => {
    it('calls setExperienceLevel when advancing past step 2', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));

      expect(mockSettingsState.setExperienceLevel).toHaveBeenCalledWith(
        'beginner',
      );
    });

    it('calls setExperienceLevel with intermediate value', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('I Know Some Basics'));
      fireEvent.press(getByText('Next'));

      expect(mockSettingsState.setExperienceLevel).toHaveBeenCalledWith(
        'intermediate',
      );
    });

    it('calls setHasCompletedOnboarding(true) on final step completion', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Play My Favorite Songs'));
      fireEvent.press(getByText('Next'));
      // Step 5: Choose cat
      fireEvent.press(getByText('Choose Mini Meowww'));
      fireEvent.press(getByText("Let's Get Started!"));

      expect(mockSettingsState.setHasCompletedOnboarding).toHaveBeenCalledWith(
        true,
      );
    });

    it('calls setLearningGoal with selected goal on final step', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Learn Proper Technique'));
      fireEvent.press(getByText('Next'));
      // Step 5: Choose cat
      fireEvent.press(getByText('Choose Mini Meowww'));
      fireEvent.press(getByText("Let's Get Started!"));

      expect(mockSettingsState.setLearningGoal).toHaveBeenCalledWith(
        'technique',
      );
    });

    it('calls setLearningGoal with exploration goal', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Just Explore & Have Fun'));
      fireEvent.press(getByText('Next'));
      // Step 5: Choose cat
      fireEvent.press(getByText('Choose Mini Meowww'));
      fireEvent.press(getByText("Let's Get Started!"));

      expect(mockSettingsState.setLearningGoal).toHaveBeenCalledWith(
        'exploration',
      );
    });

    it('calls initializeStarterCat and setSelectedCatId on final step', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Play My Favorite Songs'));
      fireEvent.press(getByText('Next'));
      // Step 5: Choose Jazzy
      fireEvent.press(getByText('Choose Jazzy'));
      fireEvent.press(getByText("Let's Get Started!"));

      expect(mockInitializeStarterCat).toHaveBeenCalledWith('jazzy');
      expect(mockSettingsState.setSelectedCatId).toHaveBeenCalledWith('jazzy');
    });
  });

  // -----------------------------------------------------------------------
  // 7. Progress bar renders (Cat3DCanvas walks along bar)
  // -----------------------------------------------------------------------
  describe('Progress bar', () => {
    it('renders the cat walking in the progress bar', () => {
      const { getAllByTestId } = render(<OnboardingScreen />);

      expect(getAllByTestId('cat-3d-mini-meowww').length).toBeGreaterThanOrEqual(1);
    });

    it('progress bar cat is present on every step', () => {
      const { getByText, getAllByTestId } = render(<OnboardingScreen />);

      // Step 1 (mini-meowww appears in both progress bar and welcome icon)
      expect(getAllByTestId('cat-3d-mini-meowww').length).toBeGreaterThanOrEqual(1);

      // Step 2
      fireEvent.press(getByText('Get Started'));
      expect(getAllByTestId(/^cat-3d-/).length).toBeGreaterThanOrEqual(1);

      // Step 3
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      expect(getAllByTestId(/^cat-3d-/).length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // 8. Cat avatar renders on screen
  // -----------------------------------------------------------------------
  describe('Cat avatar', () => {
    it('renders Cat3DCanvas on the welcome step (step 1)', () => {
      const { getAllByTestId } = render(<OnboardingScreen />);
      // mini-meowww appears in both progress bar and step content
      expect(getAllByTestId('cat-3d-mini-meowww').length).toBeGreaterThanOrEqual(1);
    });

    it('renders Cat3DCanvas for Jazzy on step 2', () => {
      const { getByText, getAllByTestId } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      // jazzy appears in both progress bar and step content
      expect(getAllByTestId('cat-3d-jazzy').length).toBeGreaterThanOrEqual(1);
    });

    it('renders Cat3DCanvas for Chonky Monke on step 3', () => {
      const { getByText, getAllByTestId } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      // chonky-monke appears in both progress bar and step content
      expect(getAllByTestId('cat-3d-chonky-monke').length).toBeGreaterThanOrEqual(1);
    });

    it('renders Cat3DCanvas for Luna on step 4', () => {
      const { getByText, getAllByTestId } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      // luna appears in both progress bar and step content
      expect(getAllByTestId('cat-3d-luna').length).toBeGreaterThanOrEqual(1);
    });

    it('renders cat intro text matching each step cat', () => {
      const { getByText } = render(<OnboardingScreen />);

      expect(getByText('Mini Meowww welcomes you!')).toBeTruthy();

      fireEvent.press(getByText('Get Started'));
      expect(getByText('Jazzy wants to know your level')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 9. Can't go back from first step
  // -----------------------------------------------------------------------
  describe('Back button on first step', () => {
    it('does not show the Back button on step 1', () => {
      const { queryByText } = render(<OnboardingScreen />);

      expect(queryByText('Back')).toBeNull();
    });

    it('shows the Back button on step 2', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));

      expect(getByText('Back')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 10. Final step navigates away
  // -----------------------------------------------------------------------
  describe('Final step navigation', () => {
    it('calls navigation.goBack() on completing the final step', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Play My Favorite Songs'));
      fireEvent.press(getByText('Next'));
      // Step 5: Choose cat
      fireEvent.press(getByText('Choose Mini Meowww'));
      fireEvent.press(getByText("Let's Get Started!"));

      expect(mockGoBack).toHaveBeenCalled();
    });

    it('calls setHasCompletedOnboarding BEFORE setLearningGoal', () => {
      const callOrder: string[] = [];
      resetSettingsState({
        setHasCompletedOnboarding: jest.fn(() =>
          callOrder.push('setHasCompletedOnboarding'),
        ),
        setLearningGoal: jest.fn(() => callOrder.push('setLearningGoal')),
      });

      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Play My Favorite Songs'));
      fireEvent.press(getByText('Next'));
      // Step 5: Choose cat
      fireEvent.press(getByText('Choose Mini Meowww'));
      fireEvent.press(getByText("Let's Get Started!"));

      expect(callOrder).toEqual([
        'setHasCompletedOnboarding',
        'setLearningGoal',
      ]);
    });

    it('navigates to SkillAssessment for intermediate users at step 3', () => {
      const { getByText } = render(<OnboardingScreen />);

      // Step 1: Welcome → Step 2: Experience → Step 3: Input Method → Assessment
      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('I Know Some Basics'));
      fireEvent.press(getByText('Next'));
      // Step 3: pick an input method
      fireEvent.press(getByText('On-Screen Keyboard'));
      fireEvent.press(getByText('Next'));

      expect(mockNavigate).toHaveBeenCalledWith('SkillAssessment');
    });

    it('navigates to SkillAssessment for returning users at step 3', () => {
      const { getByText } = render(<OnboardingScreen />);

      // Step 1: Welcome → Step 2: Experience → Step 3: Input Method → Assessment
      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Returning Player'));
      fireEvent.press(getByText('Next'));
      // Step 3: pick an input method
      fireEvent.press(getByText('On-Screen Keyboard'));
      fireEvent.press(getByText('Next'));

      expect(mockNavigate).toHaveBeenCalledWith('SkillAssessment');
    });
  });

  // -----------------------------------------------------------------------
  // Disabled button states
  // -----------------------------------------------------------------------
  describe('Disabled button states', () => {
    it('Next button is disabled on step 2 when no option selected', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));

      // Pressing Next without selecting an option should NOT advance to step 3
      fireEvent.press(getByText('Next'));
      // Still on step 2
      expect(getByText("What's Your Experience Level?")).toBeTruthy();
    });

    it('Next button is enabled after selecting an experience level', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));

      // Advances to step 3 — button was enabled
      expect(getByText('How Will You Play?')).toBeTruthy();
    });

    it('Next button is disabled on step 3 when no equipment option selected', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));

      // Pressing Next without selecting equipment should NOT advance
      fireEvent.press(getByText('Next'));
      // Still on step 3
      expect(getByText('How Will You Play?')).toBeTruthy();
    });

    it('Next button is disabled on step 4 when no goal selected', () => {
      const { getByText, getAllByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));

      // Pressing Next without a goal should NOT advance to step 5
      // There are multiple "Next" buttons (step content + back area); use the first
      const nextButtons = getAllByText('Next');
      fireEvent.press(nextButtons[0]);
      // Still on step 4
      expect(getByText("What's Your Goal?")).toBeTruthy();
    });

    it('Lets Get Started button is disabled on step 5 when no cat selected', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText("On-Screen Keyboard"));
      fireEvent.press(getByText('Next'));
      fireEvent.press(getByText('Play My Favorite Songs'));
      fireEvent.press(getByText('Next'));

      // Pressing Let's Get Started without a cat should NOT complete
      fireEvent.press(getByText("Let's Get Started!"));
      // Still on step 5
      expect(getByText('Choose Your Cat Companion')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Option selection within steps
  // -----------------------------------------------------------------------
  describe('Option selection', () => {
    it('can select MIDI keyboard option on step 3', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));

      fireEvent.press(getByText('MIDI Keyboard'));
      fireEvent.press(getByText('Next'));

      expect(getByText("What's Your Goal?")).toBeTruthy();
    });

    it('step descriptions render correctly for each option', () => {
      const { getByText } = render(<OnboardingScreen />);

      fireEvent.press(getByText('Get Started'));

      expect(getByText('Never touched a piano before')).toBeTruthy();
      expect(getByText('Can play simple melodies')).toBeTruthy();
      expect(getByText('Played before, want to restart')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Full end-to-end flow
  // -----------------------------------------------------------------------
  describe('Full flow end-to-end', () => {
    it('completes entire onboarding flow with all 5 steps', () => {
      const { getByText } = render(<OnboardingScreen />);

      // Step 1: Welcome
      expect(getByText('Welcome to Purrrfect Keys')).toBeTruthy();
      fireEvent.press(getByText('Get Started'));

      // Step 2: Experience Level
      expect(getByText("What's Your Experience Level?")).toBeTruthy();
      fireEvent.press(getByText('Complete Beginner'));
      fireEvent.press(getByText('Next'));

      // Step 3: Equipment Check
      expect(getByText('How Will You Play?')).toBeTruthy();
      fireEvent.press(getByText('MIDI Keyboard'));
      fireEvent.press(getByText('Next'));

      // Step 4: Goal Setting
      expect(getByText("What's Your Goal?")).toBeTruthy();
      fireEvent.press(getByText('Just Explore & Have Fun'));
      fireEvent.press(getByText('Next'));

      // Step 5: Choose Cat Companion
      expect(getByText('Choose Your Cat Companion')).toBeTruthy();
      fireEvent.press(getByText('Choose Luna'));
      fireEvent.press(getByText("Let's Get Started!"));

      // Verify all stores were called correctly
      expect(mockSettingsState.setExperienceLevel).toHaveBeenCalledWith(
        'beginner',
      );
      expect(mockSettingsState.setHasCompletedOnboarding).toHaveBeenCalledWith(
        true,
      );
      expect(mockSettingsState.setLearningGoal).toHaveBeenCalledWith(
        'exploration',
      );
      expect(mockInitializeStarterCat).toHaveBeenCalledWith('luna');
      expect(mockSettingsState.setSelectedCatId).toHaveBeenCalledWith('luna');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
