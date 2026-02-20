/**
 * AccountScreen UI Tests
 *
 * Tests dual layout: anonymous CTA vs authenticated management.
 * Covers profile display, name editing, sign out / delete alerts,
 * link account buttons, back navigation, and error display.
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Navigation mock
// ---------------------------------------------------------------------------

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({ params: {} }),
}));

// ---------------------------------------------------------------------------
// CatAvatar mock
// ---------------------------------------------------------------------------

jest.mock('../../components/Mascot/CatAvatar', () => ({
  CatAvatar: (props: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `cat-avatar-${props.catId}` });
  },
}));

// ---------------------------------------------------------------------------
// Zustand store mocks
// ---------------------------------------------------------------------------

const mockSignOut = jest.fn(() => Promise.resolve());
const mockDeleteAccount = jest.fn(() => Promise.resolve());
const mockUpdateDisplayName = jest.fn(() => Promise.resolve());
const mockClearError = jest.fn();

let mockAuthState: any = {
  user: { displayName: 'Test User', email: 'test@example.com', uid: '123' },
  isAnonymous: false,
  isAuthenticated: true,
  isLoading: false,
  error: null,
  signOut: mockSignOut,
  deleteAccount: mockDeleteAccount,
  updateDisplayName: mockUpdateDisplayName,
  clearError: mockClearError,
  linkWithGoogle: jest.fn(),
  linkWithApple: jest.fn(),
};

jest.mock('../../stores/authStore', () => ({
  useAuthStore: Object.assign(
    (sel?: any) => (sel ? sel(mockAuthState) : mockAuthState),
    { getState: () => mockAuthState },
  ),
}));

let mockSettingsState: any = {
  selectedCatId: 'mini-meowww',
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

import { AccountScreen } from '../AccountScreen';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccountScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.user = { displayName: 'Test User', email: 'test@example.com', uid: '123' };
    mockAuthState.isAnonymous = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.isLoading = false;
    mockAuthState.error = null;
  });

  // =========================================================================
  // Authenticated user layout
  // =========================================================================

  describe('authenticated user', () => {
    it('renders display name', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('Test User')).toBeTruthy();
    });

    it('renders email address', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('test@example.com')).toBeTruthy();
    });

    it('renders avatar initial from display name', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('T')).toBeTruthy();
    });

    it('renders back button', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('← Account')).toBeTruthy();
    });

    it('navigates back when pressing back button', () => {
      const { getByText } = render(<AccountScreen />);
      fireEvent.press(getByText('← Account'));
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    it('renders "Change Display Name" option', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('Change Display Name')).toBeTruthy();
    });

    it('renders Sign Out button', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('Sign Out')).toBeTruthy();
    });

    it('renders Delete Account button', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('Delete Account')).toBeTruthy();
    });

    it('renders Google link option', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('Google')).toBeTruthy();
    });

    it('shows confirmation Alert when pressing Sign Out', () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByText } = render(<AccountScreen />);
      fireEvent.press(getByText('Sign Out'));
      expect(alertSpy).toHaveBeenCalledWith(
        'Sign Out',
        expect.stringContaining('sign out'),
        expect.any(Array),
      );
      alertSpy.mockRestore();
    });

    it('shows confirmation Alert when pressing Delete Account', () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByText } = render(<AccountScreen />);
      fireEvent.press(getByText('Delete Account'));
      expect(alertSpy).toHaveBeenCalledWith(
        'Delete Account',
        expect.stringContaining('permanently delete'),
        expect.any(Array),
      );
      alertSpy.mockRestore();
    });

    it('shows name editing input when tapping display name', () => {
      const { getByText, getByDisplayValue } = render(<AccountScreen />);
      fireEvent.press(getByText('Test User'));
      expect(getByDisplayValue('Test User')).toBeTruthy();
    });

    it('shows Save and Cancel buttons in edit mode', () => {
      const { getByText } = render(<AccountScreen />);
      fireEvent.press(getByText('Test User'));
      expect(getByText('Save')).toBeTruthy();
      expect(getByText('Cancel')).toBeTruthy();
    });

    it('cancels name editing when pressing Cancel', () => {
      const { getByText, queryByText } = render(<AccountScreen />);
      fireEvent.press(getByText('Test User'));
      fireEvent.press(getByText('Cancel'));
      // Should return to display mode, showing display name again
      expect(getByText('Test User')).toBeTruthy();
      expect(queryByText('Save')).toBeNull();
    });

    it('displays error text when error exists', () => {
      mockAuthState.error = 'Something went wrong';
      const { getByText } = render(<AccountScreen />);
      expect(getByText('Something went wrong')).toBeTruthy();
    });

    it('clears error when tapping error text', () => {
      mockAuthState.error = 'Something went wrong';
      const { getByText } = render(<AccountScreen />);
      fireEvent.press(getByText('Something went wrong'));
      expect(mockClearError).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Anonymous user layout
  // =========================================================================

  describe('anonymous user', () => {
    beforeEach(() => {
      mockAuthState.isAnonymous = true;
      mockAuthState.user = null;
    });

    it('renders account linking CTA', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText(/Create an account to save your progress/)).toBeTruthy();
    });

    it('renders CatAvatar', () => {
      const { getByTestId } = render(<AccountScreen />);
      expect(getByTestId('cat-avatar-mini-meowww')).toBeTruthy();
    });

    it('renders "Link with Google" button', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('Link with Google')).toBeTruthy();
    });

    it('renders "Link with Email" button', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('Link with Email')).toBeTruthy();
    });

    it('navigates to EmailAuth when pressing "Link with Email"', () => {
      const { getByText } = render(<AccountScreen />);
      fireEvent.press(getByText('Link with Email'));
      expect(mockNavigate).toHaveBeenCalledWith('EmailAuth', { isLinking: true });
    });

    it('renders info about local progress', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('Your progress is saved locally.')).toBeTruthy();
    });

    it('shows back button', () => {
      const { getByText } = render(<AccountScreen />);
      expect(getByText('← Account')).toBeTruthy();
    });

    it('displays error text when error exists', () => {
      mockAuthState.error = 'Network error';
      const { getByText } = render(<AccountScreen />);
      expect(getByText('Network error')).toBeTruthy();
    });
  });
});
