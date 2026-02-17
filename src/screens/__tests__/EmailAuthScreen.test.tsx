/**
 * EmailAuthScreen UI Tests
 *
 * Tests sign-in / sign-up form: mode switching, validation,
 * form submission, forgot password, error display, and navigation.
 */

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Navigation mock
// ---------------------------------------------------------------------------

const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: mockGoBack,
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({ params: {} }),
}));

// ---------------------------------------------------------------------------
// Auth store mock
// ---------------------------------------------------------------------------

const mockSignInWithEmail = jest.fn(() => Promise.resolve());
const mockSignUpWithEmail = jest.fn(() => Promise.resolve());
const mockSendPasswordReset = jest.fn(() => Promise.resolve());
const mockClearError = jest.fn();

let mockAuthState: any = {
  isLoading: false,
  error: null,
  signInWithEmail: mockSignInWithEmail,
  signUpWithEmail: mockSignUpWithEmail,
  sendPasswordReset: mockSendPasswordReset,
  clearError: mockClearError,
};

jest.mock('../../stores/authStore', () => ({
  useAuthStore: Object.assign(
    (sel?: any) => (sel ? sel(mockAuthState) : mockAuthState),
    { getState: () => mockAuthState },
  ),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { EmailAuthScreen } from '../EmailAuthScreen';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fillForm(
  getByTestId: any,
  { email = 'test@example.com', password = 'password123', displayName = '' } = {},
) {
  fireEvent.changeText(getByTestId('email-input'), email);
  fireEvent.changeText(getByTestId('password-input'), password);
  if (displayName) {
    const nameInput = getByTestId('displayname-input');
    fireEvent.changeText(nameInput, displayName);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailAuthScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.isLoading = false;
    mockAuthState.error = null;
  });

  // =========================================================================
  // Rendering
  // =========================================================================

  it('renders back button', () => {
    const { getByText } = render(<EmailAuthScreen />);
    expect(getByText('← Back')).toBeTruthy();
  });

  it('renders Sign In tab (active by default)', () => {
    const { getAllByText } = render(<EmailAuthScreen />);
    // "Sign In" appears in both the tab and the submit button
    expect(getAllByText('Sign In').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Create Account tab', () => {
    const { getByText } = render(<EmailAuthScreen />);
    expect(getByText('Create Account')).toBeTruthy();
  });

  it('renders email and password inputs', () => {
    const { getByTestId } = render(<EmailAuthScreen />);
    expect(getByTestId('email-input')).toBeTruthy();
    expect(getByTestId('password-input')).toBeTruthy();
  });

  it('renders submit button with "Sign In" text', () => {
    const { getByTestId, getAllByText } = render(<EmailAuthScreen />);
    expect(getByTestId('submit-button')).toBeTruthy();
    // "Sign In" appears on both tab and submit button
    expect(getAllByText('Sign In').length).toBe(2);
  });

  it('renders Forgot Password link in sign-in mode', () => {
    const { getByText } = render(<EmailAuthScreen />);
    expect(getByText('Forgot Password?')).toBeTruthy();
  });

  // =========================================================================
  // Mode switching
  // =========================================================================

  it('switches to Create Account mode when tapping tab', () => {
    const { getByText, getByTestId } = render(<EmailAuthScreen />);
    fireEvent.press(getByText('Create Account'));
    // Display name input should appear in sign-up mode
    expect(getByTestId('displayname-input')).toBeTruthy();
  });

  it('hides Forgot Password in sign-up mode', () => {
    const { getByText, queryByText } = render(<EmailAuthScreen />);
    fireEvent.press(getByText('Create Account'));
    expect(queryByText('Forgot Password?')).toBeNull();
  });

  it('switches back to Sign In mode', () => {
    const { getByText, queryByTestId } = render(<EmailAuthScreen />);
    fireEvent.press(getByText('Create Account'));
    fireEvent.press(getByText('Sign In'));
    expect(queryByTestId('displayname-input')).toBeNull();
  });

  it('clears errors when switching modes', () => {
    const { getByText } = render(<EmailAuthScreen />);
    fireEvent.press(getByText('Create Account'));
    expect(mockClearError).toHaveBeenCalled();
  });

  // =========================================================================
  // Validation
  // =========================================================================

  it('shows validation error for invalid email', () => {
    const { getByTestId, getByText } = render(<EmailAuthScreen />);
    fillForm(getByTestId, { email: 'not-an-email', password: 'password123' });
    fireEvent.press(getByTestId('submit-button'));
    expect(getByText('Please enter a valid email address')).toBeTruthy();
  });

  it('shows validation error for short password', () => {
    const { getByTestId, getByText } = render(<EmailAuthScreen />);
    fillForm(getByTestId, { email: 'test@example.com', password: '123' });
    fireEvent.press(getByTestId('submit-button'));
    expect(getByText('Password must be at least 8 characters')).toBeTruthy();
  });

  it('shows validation error for short display name in sign-up', () => {
    const { getByTestId, getByText } = render(<EmailAuthScreen />);
    fireEvent.press(getByText('Create Account'));
    fillForm(getByTestId, { email: 'test@example.com', password: 'password123', displayName: 'A' });
    fireEvent.press(getByTestId('submit-button'));
    expect(getByText('Display name must be at least 2 characters')).toBeTruthy();
  });

  it('does NOT call signInWithEmail when validation fails', () => {
    const { getByTestId } = render(<EmailAuthScreen />);
    fillForm(getByTestId, { email: 'bad', password: '123' });
    fireEvent.press(getByTestId('submit-button'));
    expect(mockSignInWithEmail).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Successful submission
  // =========================================================================

  it('calls signInWithEmail with valid credentials', async () => {
    const { getByTestId } = render(<EmailAuthScreen />);
    fillForm(getByTestId, { email: 'test@example.com', password: 'password123' });
    fireEvent.press(getByTestId('submit-button'));
    await waitFor(() => {
      expect(mockSignInWithEmail).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('calls signUpWithEmail with valid credentials in sign-up mode', async () => {
    const { getByTestId, getByText } = render(<EmailAuthScreen />);
    fireEvent.press(getByText('Create Account'));
    fillForm(getByTestId, {
      email: 'new@example.com',
      password: 'password123',
      displayName: 'New User',
    });
    fireEvent.press(getByTestId('submit-button'));
    await waitFor(() => {
      expect(mockSignUpWithEmail).toHaveBeenCalledWith('new@example.com', 'password123', 'New User');
    });
  });

  // =========================================================================
  // Forgot password
  // =========================================================================

  it('calls sendPasswordReset with valid email', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByTestId, getByText } = render(<EmailAuthScreen />);
    fillForm(getByTestId, { email: 'test@example.com', password: 'any' });
    fireEvent.press(getByText('Forgot Password?'));
    await waitFor(() => {
      expect(mockSendPasswordReset).toHaveBeenCalledWith('test@example.com');
    });
    expect(alertSpy).toHaveBeenCalledWith('Email Sent', expect.stringContaining('password reset'));
    alertSpy.mockRestore();
  });

  it('shows Alert when pressing Forgot Password without valid email', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const { getByText } = render(<EmailAuthScreen />);
    fireEvent.press(getByText('Forgot Password?'));
    expect(alertSpy).toHaveBeenCalledWith('Enter Email', expect.any(String));
    expect(mockSendPasswordReset).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  // =========================================================================
  // Error display
  // =========================================================================

  it('displays auth store error', () => {
    mockAuthState.error = 'Invalid credentials';
    const { getByText } = render(<EmailAuthScreen />);
    expect(getByText('Invalid credentials')).toBeTruthy();
  });

  // =========================================================================
  // Navigation
  // =========================================================================

  it('calls goBack when pressing back button', () => {
    const { getByText } = render(<EmailAuthScreen />);
    fireEvent.press(getByText('← Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
