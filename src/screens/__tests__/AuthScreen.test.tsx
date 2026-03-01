/**
 * AuthScreen Component Tests
 *
 * Tests sign-in options rendering, anonymous auth, error handling,
 * loading states, navigation, and cat avatar hero section.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Platform, Alert } from 'react-native';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

// Mock AnimatedGradientBackground as a plain View
jest.mock('../../components/common/AnimatedGradientBackground', () => {
  const { View } = require('react-native');
  return {
    AnimatedGradientBackground: (props: any) => <View {...props}>{props.children}</View>,
  };
});

// Mock CatAvatar as a simple View to avoid Reanimated complexity
jest.mock('../../components/Mascot/CatAvatar', () => {
  const { View } = require('react-native');
  return {
    CatAvatar: (props: any) => <View testID="cat-avatar" {...props} />,
  };
});

// Mock Cat3DCanvas (used by SalsaCoach)
jest.mock('../../components/Mascot/3d', () => {
  const { View } = require('react-native');
  return {
    Cat3DCanvas: (props: any) => <View testID="cat-3d" {...props} />,
  };
});

// Mock settingsStore
jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    jest.fn((sel?: any) => {
      const state = { selectedCatId: 'mini-meowww' };
      return typeof sel === 'function' ? sel(state) : state;
    }),
    {
      getState: () => ({ selectedCatId: 'mini-meowww' }),
    },
  ),
}));

// Auth store state - mutable object that tests can modify
const mockSignInAnonymously = jest.fn().mockResolvedValue(undefined);
const mockClearError = jest.fn();
const mockSignInWithApple = jest.fn().mockResolvedValue(undefined);
const mockSignInWithGoogle = jest.fn().mockResolvedValue(undefined);

let mockAuthState: Record<string, any> = {
  user: null,
  isAnonymous: false,
  isLoading: false,
  isAuthenticated: false,
  error: null,
  signInAnonymously: mockSignInAnonymously,
  clearError: mockClearError,
  signInWithApple: mockSignInWithApple,
  signInWithGoogle: mockSignInWithGoogle,
};

jest.mock('../../stores/authStore', () => {
  const useAuthStore: any = (selector?: any) => {
    if (typeof selector === 'function') return selector(mockAuthState);
    return mockAuthState;
  };
  useAuthStore.getState = () => mockAuthState;
  useAuthStore.setState = (newState: any) => {
    mockAuthState = { ...mockAuthState, ...newState };
  };
  return { useAuthStore };
});

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
}));

// Mock expo-apple-authentication (not available by default)
jest.mock('expo-apple-authentication', () => {
  throw new Error('Module not available');
});

// Mock @react-native-google-signin (not available by default)
jest.mock('@react-native-google-signin/google-signin', () => {
  throw new Error('Module not available');
});

// Spy on Alert.alert
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Import the component AFTER all mocks are set up
import { AuthScreen } from '../AuthScreen';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetAuthState(overrides: Record<string, any> = {}): void {
  const defaults: Record<string, any> = {
    user: null,
    isAnonymous: false,
    isLoading: false,
    isAuthenticated: false,
    error: null,
    signInAnonymously: mockSignInAnonymously,
    clearError: mockClearError,
    signInWithApple: mockSignInWithApple,
    signInWithGoogle: mockSignInWithGoogle,
  };
  for (const key of Object.keys(mockAuthState)) {
    delete mockAuthState[key];
  }
  Object.assign(mockAuthState, defaults, overrides);
}

// ===========================================================================
// TESTS
// ===========================================================================

describe('AuthScreen', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthState();
    Platform.OS = 'ios';
  });

  afterAll(() => {
    Platform.OS = originalPlatform;
  });

  // -----------------------------------------------------------------------
  // 1. Renders all sign-in options
  // -----------------------------------------------------------------------

  describe('Renders all sign-in options', () => {
    it('should render Apple, Google, Email, and Skip buttons on iOS', () => {
      Platform.OS = 'ios';
      const { getByTestId, getByText } = render(<AuthScreen />);

      expect(getByTestId('apple-signin')).toBeTruthy();
      expect(getByTestId('google-signin')).toBeTruthy();
      expect(getByTestId('email-signin')).toBeTruthy();
      expect(getByTestId('skip-signin')).toBeTruthy();

      expect(getByText('Continue with Apple')).toBeTruthy();
      expect(getByText('Continue with Google')).toBeTruthy();
      expect(getByText('Continue with Email')).toBeTruthy();
      expect(getByText('Skip for now')).toBeTruthy();
    });

    it('should NOT render Apple button on Android', () => {
      Platform.OS = 'android';
      const { queryByTestId, getByTestId } = render(<AuthScreen />);

      expect(queryByTestId('apple-signin')).toBeNull();
      expect(getByTestId('google-signin')).toBeTruthy();
      expect(getByTestId('email-signin')).toBeTruthy();
      expect(getByTestId('skip-signin')).toBeTruthy();
    });

    it('should display title, tagline, and subtitle text', () => {
      const { getByText } = render(<AuthScreen />);

      expect(getByText('Purrrfect Keys')).toBeTruthy();
      expect(getByText('Learn piano. Grow cats.')).toBeTruthy();
      expect(getByText('Sign in to save your progress across devices')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 2. Skip for now calls signInAnonymously
  // -----------------------------------------------------------------------

  describe('Skip for now', () => {
    it('should call signInAnonymously when Skip button is pressed', async () => {
      const { getByTestId } = render(<AuthScreen />);

      await waitFor(async () => {
        fireEvent.press(getByTestId('skip-signin'));
      });

      expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // 3. Skip shows Alert on auth failure
  // -----------------------------------------------------------------------

  describe('Skip shows Alert on auth failure', () => {
    it('should show Alert.alert when signInAnonymously results in an error state', async () => {
      mockSignInAnonymously.mockImplementation(async () => {
        mockAuthState.error =
          'Network error. Please check your internet connection and try again.';
      });

      const { getByTestId } = render(<AuthScreen />);

      await waitFor(async () => {
        fireEvent.press(getByTestId('skip-signin'));
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Could not skip',
        'Network error. Please check your internet connection and try again.',
      );
    });

    it('should NOT show Alert when signInAnonymously succeeds', async () => {
      mockSignInAnonymously.mockImplementation(async () => {
        mockAuthState.error = null;
      });

      const { getByTestId } = render(<AuthScreen />);

      await waitFor(async () => {
        fireEvent.press(getByTestId('skip-signin'));
      });

      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 4. Loading spinner shows while authenticating
  // -----------------------------------------------------------------------

  describe('Loading spinner', () => {
    it('should show ActivityIndicator when isLoading is true', () => {
      resetAuthState({ isLoading: true });
      const { getByTestId, queryByText } = render(<AuthScreen />);

      // The skip button area contains an ActivityIndicator, not text
      expect(getByTestId('skip-signin')).toBeTruthy();
      expect(queryByText('Skip for now')).toBeNull();
    });

    it('should show Skip for now text when isLoading is false', () => {
      resetAuthState({ isLoading: false });
      const { getByText } = render(<AuthScreen />);

      expect(getByText('Skip for now')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // 5. Buttons disabled during loading
  // -----------------------------------------------------------------------

  describe('Buttons disabled during loading', () => {
    it('should disable all sign-in buttons when isLoading is true', () => {
      Platform.OS = 'ios';
      resetAuthState({ isLoading: true });
      const { getByTestId } = render(<AuthScreen />);

      // TouchableOpacity exposes disabled via accessibilityState or direct prop
      const apple = getByTestId('apple-signin');
      const google = getByTestId('google-signin');
      const email = getByTestId('email-signin');
      const skip = getByTestId('skip-signin');
      expect(apple.props.disabled ?? apple.props.accessibilityState?.disabled).toBeTruthy();
      expect(google.props.disabled ?? google.props.accessibilityState?.disabled).toBeTruthy();
      expect(email.props.disabled ?? email.props.accessibilityState?.disabled).toBeTruthy();
      expect(skip.props.disabled ?? skip.props.accessibilityState?.disabled).toBeTruthy();
    });

    it('should NOT disable buttons when isLoading is false', () => {
      Platform.OS = 'ios';
      resetAuthState({ isLoading: false });
      const { getByTestId } = render(<AuthScreen />);

      const apple = getByTestId('apple-signin');
      const google = getByTestId('google-signin');
      const email = getByTestId('email-signin');
      const skip = getByTestId('skip-signin');
      expect(apple.props.disabled && apple.props.accessibilityState?.disabled).toBeFalsy();
      expect(google.props.disabled && google.props.accessibilityState?.disabled).toBeFalsy();
      expect(email.props.disabled && email.props.accessibilityState?.disabled).toBeFalsy();
      expect(skip.props.disabled && skip.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  // -----------------------------------------------------------------------
  // 6. Error banner displays and dismisses
  // -----------------------------------------------------------------------

  describe('Error banner', () => {
    it('should display error banner when error state is set', () => {
      resetAuthState({ error: 'Something went wrong' });
      const { getByText } = render(<AuthScreen />);

      expect(getByText('Something went wrong')).toBeTruthy();
      expect(getByText('Tap to dismiss')).toBeTruthy();
    });

    it('should NOT display error banner when error is null', () => {
      resetAuthState({ error: null });
      const { queryByText } = render(<AuthScreen />);

      expect(queryByText('Tap to dismiss')).toBeNull();
    });

    it('should call clearError when error banner is tapped', () => {
      resetAuthState({ error: 'Auth failed' });
      const { getByText } = render(<AuthScreen />);

      fireEvent.press(getByText('Auth failed'));

      expect(mockClearError).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // 7. Google button shows Coming Soon alert
  // -----------------------------------------------------------------------

  describe('Google sign-in Coming Soon', () => {
    it('should show Coming Soon alert when Google SDK is not available', async () => {
      const { getByTestId } = render(<AuthScreen />);

      await waitFor(async () => {
        fireEvent.press(getByTestId('google-signin'));
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Coming Soon',
        'Google Sign-In is not yet configured for this build. Use email or skip for now.',
      );
    });
  });

  // -----------------------------------------------------------------------
  // 8. Apple button shows Coming Soon alert
  // -----------------------------------------------------------------------

  describe('Apple sign-in Coming Soon', () => {
    it('should show Coming Soon alert when Apple SDK is not available on iOS', async () => {
      Platform.OS = 'ios';
      const { getByTestId } = render(<AuthScreen />);

      await waitFor(async () => {
        fireEvent.press(getByTestId('apple-signin'));
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Coming Soon',
        'Apple Sign-In is not yet configured for this build. Use email or skip for now.',
      );
    });
  });

  // -----------------------------------------------------------------------
  // 9. Email navigation works
  // -----------------------------------------------------------------------

  describe('Email navigation', () => {
    it('should navigate to EmailAuth screen when email button is pressed', () => {
      const { getByTestId } = render(<AuthScreen />);

      fireEvent.press(getByTestId('email-signin'));

      expect(mockNavigate).toHaveBeenCalledWith('EmailAuth');
    });
  });

  // -----------------------------------------------------------------------
  // 10. Cat avatar renders in hero section
  // -----------------------------------------------------------------------

  describe('Salsa coach in hero section', () => {
    it('should render SalsaCoach component', () => {
      const { getByTestId } = render(<AuthScreen />);

      expect(getByTestId('salsa-coach')).toBeTruthy();
    });

    it('should render Salsa 3D cat in hero', () => {
      const { getByTestId } = render(<AuthScreen />);

      expect(getByTestId('salsa-coach')).toBeTruthy();
      expect(getByTestId('cat-3d')).toBeTruthy();
    });
  });
});
