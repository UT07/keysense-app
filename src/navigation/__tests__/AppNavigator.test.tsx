/**
 * AppNavigator Tests
 *
 * Tests the root navigation structure:
 * - Auth-conditional routing (authenticated vs unauthenticated)
 * - Loading state (renders null while auth initializing)
 * - Tab navigator structure (5 tabs: Home, Learn, Songs, Play, Profile)
 * - Auth stack has EmailAuth route
 */

import React from 'react';
import { render } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mutable auth state -- tests modify this before rendering
// ---------------------------------------------------------------------------

let mockAuthState: any = {
  user: null,
  isAnonymous: false,
  isLoading: false,
  isAuthenticated: false,
  error: null,
  initAuth: jest.fn(),
  signInAnonymously: jest.fn(),
  clearError: jest.fn(),
};

jest.mock('../../stores/authStore', () => ({
  useAuthStore: Object.assign(
    (selector: any) => selector(mockAuthState),
    {
      getState: () => mockAuthState,
      setState: (s: any) => {
        Object.assign(
          mockAuthState,
          typeof s === 'function' ? s(mockAuthState) : s
        );
      },
    }
  ),
}));

// ---------------------------------------------------------------------------
// Mock ALL screen components as simple Views with testIDs
// (Must use require() inside factories -- jest.mock is hoisted above imports)
// ---------------------------------------------------------------------------

jest.mock('../../screens/AuthScreen', () => {
  const { View, Text } = require('react-native');
  return { AuthScreen: () => <View testID="auth-screen"><Text>AuthScreen</Text></View> };
});

jest.mock('../../screens/EmailAuthScreen', () => {
  const { View, Text } = require('react-native');
  return { EmailAuthScreen: () => <View testID="email-auth-screen"><Text>EmailAuthScreen</Text></View> };
});

jest.mock('../../screens/HomeScreen', () => {
  const { View, Text } = require('react-native');
  return { HomeScreen: () => <View testID="home-screen"><Text>HomeScreen</Text></View> };
});

jest.mock('../../screens/LevelMapScreen', () => {
  const { View, Text } = require('react-native');
  return { LevelMapScreen: () => <View testID="level-map-screen"><Text>LevelMapScreen</Text></View> };
});

jest.mock('../../screens/PlayScreen', () => {
  const { View, Text } = require('react-native');
  return { PlayScreen: () => <View testID="play-screen"><Text>PlayScreen</Text></View> };
});

jest.mock('../../screens/ProfileScreen', () => {
  const { View, Text } = require('react-native');
  return { ProfileScreen: () => <View testID="profile-screen"><Text>ProfileScreen</Text></View> };
});

jest.mock('../../screens/OnboardingScreen', () => {
  const { View, Text } = require('react-native');
  return { OnboardingScreen: () => <View testID="onboarding-screen"><Text>OnboardingScreen</Text></View> };
});

jest.mock('../../screens/MidiSetupScreen', () => {
  const { View, Text } = require('react-native');
  return { MidiSetupScreen: () => <View testID="midi-setup-screen"><Text>MidiSetupScreen</Text></View> };
});

jest.mock('../../screens/AccountScreen', () => {
  const { View, Text } = require('react-native');
  return { AccountScreen: () => <View testID="account-screen"><Text>AccountScreen</Text></View> };
});

jest.mock('../../screens/LessonIntroScreen', () => {
  const { View, Text } = require('react-native');
  return { LessonIntroScreen: () => <View testID="lesson-intro-screen"><Text>LessonIntroScreen</Text></View> };
});

jest.mock('../../screens/CatSwitchScreen', () => {
  const { View, Text } = require('react-native');
  return { CatSwitchScreen: () => <View testID="cat-switch-screen"><Text>CatSwitchScreen</Text></View> };
});

jest.mock('../../screens/SkillAssessmentScreen', () => {
  const { View, Text } = require('react-native');
  return { SkillAssessmentScreen: () => <View testID="skill-assessment-screen"><Text>SkillAssessmentScreen</Text></View> };
});

jest.mock('../../screens/ExercisePlayer/ExercisePlayer', () => {
  const { View, Text } = require('react-native');
  return { ExercisePlayer: () => <View testID="exercise-player-screen"><Text>ExercisePlayer</Text></View> };
});

jest.mock('../../screens/DailySessionScreen', () => {
  const { View, Text } = require('react-native');
  return { DailySessionScreen: () => <View testID="daily-session-screen"><Text>DailySessionScreen</Text></View> };
});

jest.mock('../../screens/SongLibraryScreen', () => {
  const { View, Text } = require('react-native');
  return { SongLibraryScreen: () => <View testID="song-library-screen"><Text>SongLibraryScreen</Text></View> };
});

jest.mock('../../screens/SongPlayerScreen', () => {
  const { View, Text } = require('react-native');
  return { SongPlayerScreen: () => <View testID="song-player-screen"><Text>SongPlayerScreen</Text></View> };
});

// ---------------------------------------------------------------------------
// Mock react-navigation
// ---------------------------------------------------------------------------

jest.mock('@react-navigation/native', () => {
  const RN = require('react-native');
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      dispatch: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    }),
    useRoute: () => ({ params: {} }),
    NavigationContainer: ({ children }: any) => (
      <RN.View testID="navigation-container">{children}</RN.View>
    ),
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const RN = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: any) => (
        <RN.View testID="native-stack-navigator">{children}</RN.View>
      ),
      Screen: ({ name, component: Component }: any) => (
        <RN.View testID={"screen-" + name}>
          <Component />
        </RN.View>
      ),
      Group: ({ children }: any) => <>{children}</>,
    }),
  };
});

jest.mock('@react-navigation/bottom-tabs', () => {
  const RN = require('react-native');
  return {
    createBottomTabNavigator: () => ({
      Navigator: ({ children }: any) => (
        <RN.View testID="bottom-tab-navigator">{children}</RN.View>
      ),
      Screen: ({ name, component: Component }: any) => (
        <RN.View testID={"tab-" + name}>
          <Component />
        </RN.View>
      ),
    }),
  };
});

// ---------------------------------------------------------------------------
// Mock remaining stores
// ---------------------------------------------------------------------------

jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    jest.fn((sel?: any) => (typeof sel === 'function' ? sel({}) : {})),
    { getState: () => ({}) }
  ),
}));

jest.mock('../../stores/progressStore', () => ({
  useProgressStore: Object.assign(
    jest.fn((sel?: any) => (typeof sel === 'function' ? sel({}) : {})),
    { getState: () => ({}) }
  ),
}));

jest.mock('../../stores/achievementStore', () => ({
  useAchievementStore: Object.assign(
    jest.fn((sel?: any) => (typeof sel === 'function' ? sel({}) : {})),
    { getState: () => ({}) }
  ),
}));

jest.mock('../../stores/exerciseStore', () => ({
  useExerciseStore: Object.assign(
    jest.fn((sel?: any) => (typeof sel === 'function' ? sel({}) : {})),
    { getState: () => ({}) }
  ),
}));

jest.mock('../../stores/learnerProfileStore', () => ({
  useLearnerProfileStore: Object.assign(
    jest.fn((sel?: any) => (typeof sel === 'function' ? sel({}) : {})),
    { getState: () => ({}) }
  ),
}));

// ---------------------------------------------------------------------------
// Import the component under test AFTER all mocks are declared
// ---------------------------------------------------------------------------

import { AppNavigator } from '../AppNavigator';

// ===========================================================================
// Helpers
// ===========================================================================

function resetAuthState(overrides: Partial<typeof mockAuthState> = {}) {
  mockAuthState = {
    user: null,
    isAnonymous: false,
    isLoading: false,
    isAuthenticated: false,
    error: null,
    initAuth: jest.fn(),
    signInAnonymously: jest.fn(),
    clearError: jest.fn(),
    ...overrides,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('AppNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthState();
  });

  // -----------------------------------------------------------------------
  // 1. Loading state
  // -----------------------------------------------------------------------

  describe('Loading state', () => {
    it('should render null while auth is loading', () => {
      resetAuthState({ isLoading: true });

      const { toJSON } = render(<AppNavigator />);

      expect(toJSON()).toBeNull();
    });

    it('should not render NavigationContainer while loading', () => {
      resetAuthState({ isLoading: true });

      const { queryByTestId } = render(<AppNavigator />);

      expect(queryByTestId('navigation-container')).toBeNull();
    });

    it('should not render any screens while loading', () => {
      resetAuthState({ isLoading: true });

      const { queryByTestId } = render(<AppNavigator />);

      expect(queryByTestId('auth-screen')).toBeNull();
      expect(queryByTestId('home-screen')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 2. Unauthenticated state
  // -----------------------------------------------------------------------

  describe('Unauthenticated state', () => {
    it('should show AuthScreen when not authenticated', () => {
      resetAuthState({ isAuthenticated: false, isLoading: false });

      const { getByTestId } = render(<AppNavigator />);

      expect(getByTestId('auth-screen')).toBeTruthy();
    });

    it('should show the Auth route in the stack', () => {
      resetAuthState({ isAuthenticated: false, isLoading: false });

      const { getByTestId } = render(<AppNavigator />);

      expect(getByTestId('screen-Auth')).toBeTruthy();
    });

    it('should have EmailAuth route available in auth stack', () => {
      resetAuthState({ isAuthenticated: false, isLoading: false });

      const { getByTestId } = render(<AppNavigator />);

      expect(getByTestId('screen-EmailAuth')).toBeTruthy();
      expect(getByTestId('email-auth-screen')).toBeTruthy();
    });

    it('should NOT show MainTabs when not authenticated', () => {
      resetAuthState({ isAuthenticated: false, isLoading: false });

      const { queryByTestId } = render(<AppNavigator />);

      expect(queryByTestId('bottom-tab-navigator')).toBeNull();
      expect(queryByTestId('home-screen')).toBeNull();
    });

    it('should NOT show authenticated-only screens when not authenticated', () => {
      resetAuthState({ isAuthenticated: false, isLoading: false });

      const { queryByTestId } = render(<AppNavigator />);

      expect(queryByTestId('screen-Onboarding')).toBeNull();
      expect(queryByTestId('screen-Exercise')).toBeNull();
      expect(queryByTestId('screen-Account')).toBeNull();
      expect(queryByTestId('screen-MidiSetup')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 3. Authenticated state
  // -----------------------------------------------------------------------

  describe('Authenticated state', () => {
    it('should show MainTabs when authenticated', () => {
      resetAuthState({ isAuthenticated: true, isLoading: false });

      const { getByTestId } = render(<AppNavigator />);

      expect(getByTestId('bottom-tab-navigator')).toBeTruthy();
    });

    it('should show Home tab screen when authenticated', () => {
      resetAuthState({ isAuthenticated: true, isLoading: false });

      const { getByTestId } = render(<AppNavigator />);

      expect(getByTestId('home-screen')).toBeTruthy();
    });

    it('should NOT show AuthScreen when authenticated', () => {
      resetAuthState({ isAuthenticated: true, isLoading: false });

      const { queryByTestId } = render(<AppNavigator />);

      expect(queryByTestId('auth-screen')).toBeNull();
      expect(queryByTestId('screen-Auth')).toBeNull();
      expect(queryByTestId('screen-EmailAuth')).toBeNull();
    });

    it('should render NavigationContainer wrapper', () => {
      resetAuthState({ isAuthenticated: true, isLoading: false });

      const { getByTestId } = render(<AppNavigator />);

      expect(getByTestId('navigation-container')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 4. Tab navigator structure
  // -----------------------------------------------------------------------

  describe('Tab navigator structure', () => {
    beforeEach(() => {
      resetAuthState({ isAuthenticated: true, isLoading: false });
    });

    it('should have a Home tab', () => {
      const { getByTestId } = render(<AppNavigator />);

      expect(getByTestId('tab-Home')).toBeTruthy();
      expect(getByTestId('home-screen')).toBeTruthy();
    });

    it('should have a Learn tab', () => {
      const { getByTestId } = render(<AppNavigator />);

      expect(getByTestId('tab-Learn')).toBeTruthy();
      expect(getByTestId('level-map-screen')).toBeTruthy();
    });

    it('should have a Songs tab', () => {
      const { getByTestId } = render(<AppNavigator />);

      expect(getByTestId('tab-Songs')).toBeTruthy();
      expect(getByTestId('song-library-screen')).toBeTruthy();
    });

    it('should have a Play tab', () => {
      const { getByTestId } = render(<AppNavigator />);

      // Play tab exists but renders a placeholder — actual PlayScreen is a
      // full-screen stack route (FreePlay) for proper landscape orientation
      expect(getByTestId('tab-Play')).toBeTruthy();
    });

    it('should have a Profile tab', () => {
      const { getByTestId } = render(<AppNavigator />);

      expect(getByTestId('tab-Profile')).toBeTruthy();
      expect(getByTestId('profile-screen')).toBeTruthy();
    });

    it('should have exactly 5 tabs: Home, Learn, Songs, Play, Profile', () => {
      const { getByTestId, queryByTestId } = render(<AppNavigator />);

      expect(getByTestId('tab-Home')).toBeTruthy();
      expect(getByTestId('tab-Learn')).toBeTruthy();
      expect(getByTestId('tab-Songs')).toBeTruthy();
      expect(getByTestId('tab-Play')).toBeTruthy();
      expect(getByTestId('tab-Profile')).toBeTruthy();

      // Verify no unexpected tabs
      expect(queryByTestId('tab-Settings')).toBeNull();
      expect(queryByTestId('tab-Auth')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 5. Authenticated stack screens
  // -----------------------------------------------------------------------

  describe('Authenticated stack screens', () => {
    beforeEach(() => {
      resetAuthState({ isAuthenticated: true, isLoading: false });
    });

    it('should have MainTabs route in the stack', () => {
      const { getByTestId } = render(<AppNavigator />);
      expect(getByTestId('screen-MainTabs')).toBeTruthy();
    });

    it('should have Onboarding route available', () => {
      const { getByTestId } = render(<AppNavigator />);
      expect(getByTestId('screen-Onboarding')).toBeTruthy();
    });

    it('should have Exercise route available', () => {
      const { getByTestId } = render(<AppNavigator />);
      expect(getByTestId('screen-Exercise')).toBeTruthy();
    });

    it('should have MidiSetup route available', () => {
      const { getByTestId } = render(<AppNavigator />);
      expect(getByTestId('screen-MidiSetup')).toBeTruthy();
    });

    it('should have Account route available', () => {
      const { getByTestId } = render(<AppNavigator />);
      expect(getByTestId('screen-Account')).toBeTruthy();
    });

    it('should have SkillAssessment route available', () => {
      const { getByTestId } = render(<AppNavigator />);
      expect(getByTestId('screen-SkillAssessment')).toBeTruthy();
    });

    it('should have CatSwitch route available', () => {
      const { getByTestId } = render(<AppNavigator />);
      expect(getByTestId('screen-CatSwitch')).toBeTruthy();
    });

    it('should have LessonIntro route available', () => {
      const { getByTestId } = render(<AppNavigator />);
      expect(getByTestId('screen-LessonIntro')).toBeTruthy();
    });

    it('should have DailySession route available', () => {
      const { getByTestId } = render(<AppNavigator />);
      expect(getByTestId('screen-DailySession')).toBeTruthy();
    });

    it('should have FreePlay route available', () => {
      const { getByTestId } = render(<AppNavigator />);
      expect(getByTestId('screen-FreePlay')).toBeTruthy();
    });

    it('should have SongPlayer route available', () => {
      const { getByTestId } = render(<AppNavigator />);
      expect(getByTestId('screen-SongPlayer')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 6. Auth state transitions
  // -----------------------------------------------------------------------

  describe('Auth state transitions', () => {
    it('should switch from Auth to MainTabs when user authenticates', () => {
      resetAuthState({ isAuthenticated: false, isLoading: false });

      const { queryByTestId, rerender } = render(<AppNavigator />);

      expect(queryByTestId('auth-screen')).toBeTruthy();
      expect(queryByTestId('home-screen')).toBeNull();

      // Simulate authentication
      resetAuthState({ isAuthenticated: true, isLoading: false });
      rerender(<AppNavigator />);

      expect(queryByTestId('auth-screen')).toBeNull();
      expect(queryByTestId('home-screen')).toBeTruthy();
    });

    it('should switch from MainTabs to Auth when user signs out', () => {
      resetAuthState({ isAuthenticated: true, isLoading: false });

      const { queryByTestId, rerender } = render(<AppNavigator />);

      expect(queryByTestId('home-screen')).toBeTruthy();
      expect(queryByTestId('auth-screen')).toBeNull();

      // Simulate sign out
      resetAuthState({ isAuthenticated: false, isLoading: false });
      rerender(<AppNavigator />);

      expect(queryByTestId('auth-screen')).toBeTruthy();
      expect(queryByTestId('home-screen')).toBeNull();
    });

    it('should transition from loading to authenticated', () => {
      resetAuthState({ isLoading: true });

      const { toJSON, queryByTestId, rerender } = render(<AppNavigator />);
      expect(toJSON()).toBeNull();

      resetAuthState({ isAuthenticated: true, isLoading: false });
      rerender(<AppNavigator />);

      expect(queryByTestId('home-screen')).toBeTruthy();
    });

    it('should transition from loading to unauthenticated', () => {
      resetAuthState({ isLoading: true });

      const { toJSON, queryByTestId, rerender } = render(<AppNavigator />);
      expect(toJSON()).toBeNull();

      resetAuthState({ isAuthenticated: false, isLoading: false });
      rerender(<AppNavigator />);

      expect(queryByTestId('auth-screen')).toBeTruthy();
    });
  });
});
