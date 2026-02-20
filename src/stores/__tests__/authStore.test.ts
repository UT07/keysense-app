/**
 * Auth Store Tests
 * Tests Firebase authentication state management including:
 * - Initial state
 * - Auth state listener (initAuth)
 * - Anonymous sign-in
 * - Email sign-in and sign-up
 * - Sign out and account deletion
 * - Password reset and display name updates
 * - Error handling and error clearing
 */

import type { User } from 'firebase/auth';

// ============================================================================
// Mocks — use jest.mock() with inline factories
// ============================================================================

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signInAnonymously: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  deleteUser: jest.fn(),
  updateProfile: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  linkWithCredential: jest.fn(),
  EmailAuthProvider: { credential: jest.fn() },
  GoogleAuthProvider: { credential: jest.fn() },
  OAuthProvider: jest.fn().mockImplementation(() => ({
    credential: jest.fn(),
  })),
}));

jest.mock('../../services/firebase/config', () => ({
  auth: { currentUser: null },
  db: {},
}));

jest.mock('../../services/firebase/firestore', () => ({
  createUserProfile: jest.fn(),
  getUserProfile: jest.fn(),
  deleteUserData: jest.fn(),
}));

jest.mock('../persistence', () => ({
  PersistenceManager: {
    clearAll: jest.fn(),
  },
  STORAGE_KEYS: {
    EXERCISE: 'keysense_exercise_state',
    PROGRESS: 'keysense_progress_state',
    SETTINGS: 'keysense_settings_state',
    MIGRATION_VERSION: 'keysense_migration_version',
  },
}));

// ============================================================================
// Import mocked modules to get references
// ============================================================================

import {
  onAuthStateChanged,
  signInAnonymously as firebaseSignInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  deleteUser,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../../services/firebase/config';
import { createUserProfile, deleteUserData } from '../../services/firebase/firestore';
import { PersistenceManager } from '../persistence';
import { useAuthStore } from '../authStore';

// Cast to jest mocks for easy access
const mockOnAuthStateChanged = onAuthStateChanged as jest.Mock;
const mockSignInAnonymously = firebaseSignInAnonymously as jest.Mock;
const mockSignInWithEmailAndPassword = signInWithEmailAndPassword as jest.Mock;
const mockCreateUserWithEmailAndPassword = createUserWithEmailAndPassword as jest.Mock;
const mockFirebaseSignOut = firebaseSignOut as jest.Mock;
const mockDeleteUser = deleteUser as jest.Mock;
const mockUpdateProfile = updateProfile as jest.Mock;
const mockSendPasswordResetEmail = sendPasswordResetEmail as jest.Mock;
const mockCreateUserProfile = createUserProfile as jest.Mock;
const mockDeleteUserData = deleteUserData as jest.Mock;
const mockClearAll = PersistenceManager.clearAll as jest.Mock;
const mockAuth = auth;

// ============================================================================
// Helpers
// ============================================================================

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    uid: 'test-uid-123',
    email: 'test@example.com',
    displayName: 'Test User',
    isAnonymous: false,
    emailVerified: true,
    phoneNumber: null,
    photoURL: null,
    providerId: 'firebase',
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: jest.fn(),
    getIdToken: jest.fn(),
    getIdTokenResult: jest.fn(),
    reload: jest.fn(),
    toJSON: jest.fn(),
    ...overrides,
  } as unknown as User;
}

function resetStore(): void {
  useAuthStore.setState({
    user: null,
    isAnonymous: false,
    isLoading: false,
    isAuthenticated: false,
    error: null,
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('Auth Store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  // --------------------------------------------------------------------------
  // 1. Initial State
  // --------------------------------------------------------------------------

  describe('Initial State', () => {
    it('should have no user initially', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });

    it('should not be authenticated initially', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should not be loading initially', () => {
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
    });

    it('should not be anonymous initially', () => {
      const state = useAuthStore.getState();
      expect(state.isAnonymous).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. initAuth
  // --------------------------------------------------------------------------

  describe('initAuth', () => {
    it('should set up onAuthStateChanged listener', async () => {
      mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: User | null) => void) => {
        callback(null);
        return jest.fn(); // unsubscribe
      });

      await useAuthStore.getState().initAuth();

      expect(mockOnAuthStateChanged).toHaveBeenCalledWith(
        mockAuth,
        expect.any(Function)
      );
    });

    it('should update state when user is detected', async () => {
      const mockUser = createMockUser();

      mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: User | null) => void) => {
        callback(mockUser);
        return jest.fn();
      });

      await useAuthStore.getState().initAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBe(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isAnonymous).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should detect anonymous user', async () => {
      const anonUser = createMockUser({ isAnonymous: true, email: null });

      mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: User | null) => void) => {
        callback(anonUser);
        return jest.fn();
      });

      await useAuthStore.getState().initAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBe(anonUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isAnonymous).toBe(true);
    });

    it('should set isAuthenticated to false when no user', async () => {
      mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: User | null) => void) => {
        callback(null);
        return jest.fn();
      });

      await useAuthStore.getState().initAuth();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should set isLoading to true before listener fires', () => {
      // Don't resolve the listener callback immediately
      mockOnAuthStateChanged.mockImplementation(() => {
        return jest.fn();
      });

      // Start initAuth but don't await
      useAuthStore.getState().initAuth();

      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. signInAnonymously
  // --------------------------------------------------------------------------

  describe('signInAnonymously', () => {
    it('should call Firebase signInAnonymously', async () => {
      const mockUser = createMockUser({ isAnonymous: true });
      mockSignInAnonymously.mockResolvedValue({ user: mockUser });

      await useAuthStore.getState().signInAnonymously();

      expect(mockSignInAnonymously).toHaveBeenCalledWith(mockAuth);
    });

    it('should update state with anonymous user', async () => {
      const mockUser = createMockUser({ isAnonymous: true });
      mockSignInAnonymously.mockResolvedValue({ user: mockUser });

      await useAuthStore.getState().signInAnonymously();

      const state = useAuthStore.getState();
      expect(state.user).toBe(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isAnonymous).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should handle errors', async () => {
      const error = { code: 'auth/too-many-requests', message: 'Too many requests' };
      mockSignInAnonymously.mockRejectedValue(error);

      await useAuthStore.getState().signInAnonymously();

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should enter local guest mode when anonymous auth is unavailable', async () => {
      const error = { code: 'auth/operation-not-allowed', message: 'Anonymous auth disabled' };
      mockSignInAnonymously.mockRejectedValue(error);

      await useAuthStore.getState().signInAnonymously();

      const state = useAuthStore.getState();
      expect(state.user).not.toBeNull();
      expect(state.user?.uid).toContain('local-guest-');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isAnonymous).toBe(true);
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should set isLoading to true during sign-in', async () => {
      let resolveFn: (value: unknown) => void;
      const promise = new Promise(resolve => { resolveFn = resolve; });
      mockSignInAnonymously.mockReturnValue(promise);

      const signInPromise = useAuthStore.getState().signInAnonymously();

      // Should be loading
      expect(useAuthStore.getState().isLoading).toBe(true);

      // Resolve and wait
      resolveFn!({ user: createMockUser({ isAnonymous: true }) });
      await signInPromise;

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. signInWithEmail
  // --------------------------------------------------------------------------

  describe('signInWithEmail', () => {
    it('should call Firebase signInWithEmailAndPassword', async () => {
      const mockUser = createMockUser();
      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      await useAuthStore.getState().signInWithEmail('test@example.com', 'password123');

      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password123'
      );
    });

    it('should update state with authenticated user', async () => {
      const mockUser = createMockUser();
      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      await useAuthStore.getState().signInWithEmail('test@example.com', 'password123');

      const state = useAuthStore.getState();
      expect(state.user).toBe(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isAnonymous).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle auth/user-not-found error', async () => {
      const error = { code: 'auth/user-not-found', message: 'User not found' };
      mockSignInWithEmailAndPassword.mockRejectedValue(error);

      await useAuthStore.getState().signInWithEmail('missing@example.com', 'password');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });

    it('should handle auth/wrong-password error', async () => {
      const error = { code: 'auth/wrong-password', message: 'Wrong password' };
      mockSignInWithEmailAndPassword.mockRejectedValue(error);

      await useAuthStore.getState().signInWithEmail('test@example.com', 'wrong');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });

    it('should handle auth/invalid-email error', async () => {
      const error = { code: 'auth/invalid-email', message: 'Invalid email' };
      mockSignInWithEmailAndPassword.mockRejectedValue(error);

      await useAuthStore.getState().signInWithEmail('not-an-email', 'password');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
    });

    it('should handle auth/user-disabled error', async () => {
      const error = { code: 'auth/user-disabled', message: 'User disabled' };
      mockSignInWithEmailAndPassword.mockRejectedValue(error);

      await useAuthStore.getState().signInWithEmail('disabled@example.com', 'password');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
    });

    it('should handle auth/too-many-requests error', async () => {
      const error = { code: 'auth/too-many-requests', message: 'Too many requests' };
      mockSignInWithEmailAndPassword.mockRejectedValue(error);

      await useAuthStore.getState().signInWithEmail('test@example.com', 'password');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
    });

    it('should clear previous error before sign-in attempt', async () => {
      // Set an existing error
      useAuthStore.setState({ error: 'Previous error' });

      const mockUser = createMockUser();
      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      await useAuthStore.getState().signInWithEmail('test@example.com', 'password123');

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 5. signUpWithEmail
  // --------------------------------------------------------------------------

  describe('signUpWithEmail', () => {
    it('should call Firebase createUserWithEmailAndPassword', async () => {
      const mockUser = createMockUser();
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockUpdateProfile.mockResolvedValue(undefined);
      mockCreateUserProfile.mockResolvedValue(undefined);

      await useAuthStore.getState().signUpWithEmail('new@example.com', 'password123', 'New User');

      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'new@example.com',
        'password123'
      );
    });

    it('should update Firebase profile with display name', async () => {
      const mockUser = createMockUser();
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockUpdateProfile.mockResolvedValue(undefined);
      mockCreateUserProfile.mockResolvedValue(undefined);

      await useAuthStore.getState().signUpWithEmail('new@example.com', 'password123', 'New User');

      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'New User' });
    });

    it('should create Firestore user profile', async () => {
      const mockUser = createMockUser({ uid: 'new-uid' });
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockUpdateProfile.mockResolvedValue(undefined);
      mockCreateUserProfile.mockResolvedValue(undefined);

      await useAuthStore.getState().signUpWithEmail('new@example.com', 'password123', 'New User');

      expect(mockCreateUserProfile).toHaveBeenCalledWith('new-uid', {
        email: 'new@example.com',
        displayName: 'New User',
      });
    });

    it('should update state with new user', async () => {
      const mockUser = createMockUser();
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockUpdateProfile.mockResolvedValue(undefined);
      mockCreateUserProfile.mockResolvedValue(undefined);

      await useAuthStore.getState().signUpWithEmail('new@example.com', 'password123', 'New User');

      const state = useAuthStore.getState();
      expect(state.user).toBe(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should handle auth/email-already-in-use error', async () => {
      const error = { code: 'auth/email-already-in-use', message: 'Email already in use' };
      mockCreateUserWithEmailAndPassword.mockRejectedValue(error);

      await useAuthStore.getState().signUpWithEmail('taken@example.com', 'password123', 'User');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });

    it('should handle auth/weak-password error', async () => {
      const error = { code: 'auth/weak-password', message: 'Weak password' };
      mockCreateUserWithEmailAndPassword.mockRejectedValue(error);

      await useAuthStore.getState().signUpWithEmail('new@example.com', '123', 'User');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 6. signOut
  // --------------------------------------------------------------------------

  describe('signOut', () => {
    it('should call Firebase signOut', async () => {
      mockFirebaseSignOut.mockResolvedValue(undefined);
      mockClearAll.mockResolvedValue(undefined);

      // Set up authenticated state
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
      });

      await useAuthStore.getState().signOut();

      expect(mockFirebaseSignOut).toHaveBeenCalledWith(mockAuth);
    });

    it('should clear local data', async () => {
      mockFirebaseSignOut.mockResolvedValue(undefined);
      mockClearAll.mockResolvedValue(undefined);

      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
      });

      await useAuthStore.getState().signOut();

      expect(mockClearAll).toHaveBeenCalled();
    });

    it('should reset auth state', async () => {
      mockFirebaseSignOut.mockResolvedValue(undefined);
      mockClearAll.mockResolvedValue(undefined);

      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
        isAnonymous: false,
      });

      await useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isAnonymous).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should handle sign-out errors', async () => {
      const error = { code: 'auth/internal-error', message: 'Internal error' };
      mockFirebaseSignOut.mockRejectedValue(error);

      await useAuthStore.getState().signOut();

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 7. deleteAccount
  // --------------------------------------------------------------------------

  describe('deleteAccount', () => {
    it('should delete Firestore data and auth account', async () => {
      const mockUser = createMockUser({ uid: 'delete-uid' });
      mockDeleteUserData.mockResolvedValue(undefined);
      mockDeleteUser.mockResolvedValue(undefined);
      mockClearAll.mockResolvedValue(undefined);

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      await useAuthStore.getState().deleteAccount();

      expect(mockDeleteUserData).toHaveBeenCalledWith('delete-uid');
      expect(mockDeleteUser).toHaveBeenCalledWith(mockUser);
    });

    it('should clear local data after deletion', async () => {
      const mockUser = createMockUser();
      mockDeleteUserData.mockResolvedValue(undefined);
      mockDeleteUser.mockResolvedValue(undefined);
      mockClearAll.mockResolvedValue(undefined);

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      await useAuthStore.getState().deleteAccount();

      expect(mockClearAll).toHaveBeenCalled();
    });

    it('should reset auth state after deletion', async () => {
      const mockUser = createMockUser();
      mockDeleteUserData.mockResolvedValue(undefined);
      mockDeleteUser.mockResolvedValue(undefined);
      mockClearAll.mockResolvedValue(undefined);

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      await useAuthStore.getState().deleteAccount();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should handle auth/requires-recent-login error', async () => {
      const mockUser = createMockUser();
      const error = { code: 'auth/requires-recent-login', message: 'Recent login required' };
      mockDeleteUserData.mockResolvedValue(undefined);
      mockDeleteUser.mockRejectedValue(error);

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      await useAuthStore.getState().deleteAccount();

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });

    it('should handle missing user gracefully', async () => {
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
      });

      await useAuthStore.getState().deleteAccount();

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 8. clearError
  // --------------------------------------------------------------------------

  describe('clearError', () => {
    it('should clear the error state', () => {
      useAuthStore.setState({ error: 'Some error occurred' });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });

    it('should not affect other state when clearing error', () => {
      const mockUser = createMockUser();
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
        error: 'Some error',
      });

      useAuthStore.getState().clearError();

      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
      expect(state.user).toBe(mockUser);
      expect(state.isAuthenticated).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 9. sendPasswordReset
  // --------------------------------------------------------------------------

  describe('sendPasswordReset', () => {
    it('should call Firebase sendPasswordResetEmail', async () => {
      mockSendPasswordResetEmail.mockResolvedValue(undefined);

      await useAuthStore.getState().sendPasswordReset('reset@example.com');

      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, 'reset@example.com');
    });

    it('should not set error on success', async () => {
      mockSendPasswordResetEmail.mockResolvedValue(undefined);

      await useAuthStore.getState().sendPasswordReset('reset@example.com');

      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should handle auth/user-not-found error', async () => {
      const error = { code: 'auth/user-not-found', message: 'User not found' };
      mockSendPasswordResetEmail.mockRejectedValue(error);

      await useAuthStore.getState().sendPasswordReset('missing@example.com');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });

    it('should handle auth/invalid-email error', async () => {
      const error = { code: 'auth/invalid-email', message: 'Invalid email' };
      mockSendPasswordResetEmail.mockRejectedValue(error);

      await useAuthStore.getState().sendPasswordReset('not-an-email');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
    });
  });

  // --------------------------------------------------------------------------
  // 10. updateDisplayName
  // --------------------------------------------------------------------------

  describe('updateDisplayName', () => {
    it('should call Firebase updateProfile', async () => {
      const mockUser = createMockUser();
      mockUpdateProfile.mockResolvedValue(undefined);

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      await useAuthStore.getState().updateDisplayName('New Name');

      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'New Name' });
    });

    it('should not set error on success', async () => {
      const mockUser = createMockUser();
      mockUpdateProfile.mockResolvedValue(undefined);

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      await useAuthStore.getState().updateDisplayName('New Name');

      const state = useAuthStore.getState();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('should handle missing user gracefully', async () => {
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
      });

      await useAuthStore.getState().updateDisplayName('New Name');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });

    it('should handle update errors', async () => {
      const mockUser = createMockUser();
      const error = { code: 'auth/internal-error', message: 'Internal error' };
      mockUpdateProfile.mockRejectedValue(error);

      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });

      await useAuthStore.getState().updateDisplayName('New Name');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Error message mapping
  // --------------------------------------------------------------------------

  describe('Error Message Mapping', () => {
    it('should provide user-friendly message for email-already-in-use', async () => {
      const error = { code: 'auth/email-already-in-use', message: 'Firebase error' };
      mockCreateUserWithEmailAndPassword.mockRejectedValue(error);

      await useAuthStore.getState().signUpWithEmail('taken@example.com', 'pass123', 'User');

      const state = useAuthStore.getState();
      expect(state.error).not.toBe('Firebase error');
      expect(state.error).toBeTruthy();
    });

    it('should provide user-friendly message for weak-password', async () => {
      const error = { code: 'auth/weak-password', message: 'Firebase error' };
      mockCreateUserWithEmailAndPassword.mockRejectedValue(error);

      await useAuthStore.getState().signUpWithEmail('new@example.com', '12', 'User');

      const state = useAuthStore.getState();
      expect(state.error).not.toBe('Firebase error');
      expect(state.error).toBeTruthy();
    });

    it('should provide user-friendly message for credential-already-in-use', async () => {
      const error = { code: 'auth/credential-already-in-use', message: 'Firebase error' };
      mockSignInWithEmailAndPassword.mockRejectedValue(error);

      await useAuthStore.getState().signInWithEmail('test@example.com', 'pass');

      const state = useAuthStore.getState();
      expect(state.error).not.toBe('Firebase error');
      expect(state.error).toBeTruthy();
    });

    it('should provide fallback message for unknown error codes', async () => {
      const error = { code: 'auth/unknown-error', message: 'Something unknown' };
      mockSignInWithEmailAndPassword.mockRejectedValue(error);

      await useAuthStore.getState().signInWithEmail('test@example.com', 'pass');

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
    });
  });
});
