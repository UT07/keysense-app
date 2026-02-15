# Phase 3: Firebase Auth + Cloud Sync — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user authentication (Apple, Google, Email, Anonymous) and cloud progress sync to KeySense, enabling cross-device backup and account management.

**Architecture:** Zustand auth store wraps the existing `AuthService` class and Firebase config. A `SyncManager` service handles bidirectional progress sync with offline queue. Three new screens (AuthScreen, EmailAuthScreen, AccountScreen) + navigation guards control the auth flow. All existing Firebase Firestore operations are already written — we wire them up.

**Tech Stack:** Firebase JS SDK 12.9, Zustand v5, expo-apple-authentication, @react-native-google-signin/google-signin, React Navigation 7

---

## Task 1: Install Auth Dependencies

**Files:**
- Modify: `keysense-app/package.json`
- Modify: `keysense-app/app.json`

**Step 1: Install packages**

Run:
```bash
cd /Users/ut/Documents/KeySense/keysense-app && npx expo install expo-apple-authentication @react-native-google-signin/google-signin
```

**Step 2: Add Apple auth plugin to app.json**

Add `"expo-apple-authentication"` to the `plugins` array in `app.json`. Also add the Google Sign-In plugin config:

```json
"plugins": [
  "expo-dev-client",
  ["expo-screen-orientation", { "initialOrientation": "DEFAULT" }],
  ["react-native-audio-api", { "iosBackgroundMode": false, "androidForegroundService": false }],
  "expo-apple-authentication",
  [
    "@react-native-google-signin/google-signin",
    {
      "iosUrlScheme": "com.googleusercontent.apps.GOOGLE_IOS_CLIENT_ID"
    }
  ]
]
```

Note: `GOOGLE_IOS_CLIENT_ID` is a placeholder — we'll configure the real value from Google Cloud Console later.

**Step 3: Verify install**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx tsc --noEmit`
Expected: 0 errors (new packages may need types, but both ship their own)

**Step 4: Commit**

```bash
git add package.json app.json package-lock.json
git commit -m "feat: install expo-apple-authentication and google-signin deps"
```

---

## Task 2: Create Firebase Project Config Files

**Files:**
- Create: `keysense-app/firebase.json`
- Create: `keysense-app/.firebaserc`

**Step 1: Create firebase.json**

```json
{
  "firestore": {
    "rules": "firebase/firestore.rules",
    "indexes": "firebase/firestore.indexes.json"
  },
  "functions": {
    "source": "firebase/functions"
  },
  "emulators": {
    "auth": {
      "port": 9099
    },
    "firestore": {
      "port": 8080
    },
    "functions": {
      "port": 5001
    },
    "ui": {
      "enabled": true
    }
  }
}
```

**Step 2: Create .firebaserc**

```json
{
  "projects": {
    "default": "keysense-app"
  }
}
```

**Step 3: Create firestore.indexes.json (if missing)**

Check if `firebase/firestore.indexes.json` exists. If not, create:

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

**Step 4: Commit**

```bash
git add firebase.json .firebaserc firebase/firestore.indexes.json
git commit -m "feat: add Firebase project config (firebase.json, .firebaserc)"
```

---

## Task 3: Auth Store — Write Failing Tests

**Files:**
- Create: `keysense-app/src/stores/__tests__/authStore.test.ts`

**Step 1: Write the failing test file**

```typescript
/**
 * Auth Store Tests
 * Tests authentication state management, sign-in flows, and error handling
 */

import { act } from '@testing-library/react-native';

// Mock firebase/auth before importing the store
const mockOnAuthStateChanged = jest.fn();
const mockSignInAnonymously = jest.fn();
const mockSignInWithCredential = jest.fn();
const mockSignInWithEmailAndPassword = jest.fn();
const mockCreateUserWithEmailAndPassword = jest.fn();
const mockSignOut = jest.fn();
const mockDeleteUser = jest.fn();
const mockUpdateProfile = jest.fn();
const mockSendPasswordResetEmail = jest.fn();
const mockLinkWithCredential = jest.fn();
const mockGoogleAuthProviderCredential = jest.fn();
const mockOAuthProviderCredential = jest.fn();

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  onAuthStateChanged: mockOnAuthStateChanged,
  signInAnonymously: mockSignInAnonymously,
  signInWithCredential: mockSignInWithCredential,
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
  signOut: mockSignOut,
  deleteUser: mockDeleteUser,
  updateProfile: mockUpdateProfile,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  linkWithCredential: mockLinkWithCredential,
  GoogleAuthProvider: { credential: mockGoogleAuthProviderCredential },
  OAuthProvider: jest.fn(() => ({ credential: mockOAuthProviderCredential })),
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
    PROGRESS: 'keysense_progress_state',
    SETTINGS: 'keysense_settings_state',
  },
}));

import { useAuthStore } from '../authStore';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to default state
    useAuthStore.setState({
      user: null,
      isAnonymous: false,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with no user and not authenticated', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isAnonymous).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('initAuth', () => {
    it('should set up onAuthStateChanged listener', async () => {
      mockOnAuthStateChanged.mockImplementation((_, callback) => {
        callback(null); // No user signed in
        return jest.fn(); // unsubscribe
      });

      await act(async () => {
        await useAuthStore.getState().initAuth();
      });

      expect(mockOnAuthStateChanged).toHaveBeenCalled();
    });

    it('should update state when user is detected', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        displayName: 'Test User',
        isAnonymous: false,
      };

      mockOnAuthStateChanged.mockImplementation((_, callback) => {
        callback(mockUser);
        return jest.fn();
      });

      await act(async () => {
        await useAuthStore.getState().initAuth();
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isAnonymous).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should detect anonymous user', async () => {
      const mockAnonUser = {
        uid: 'anon-uid',
        email: null,
        displayName: null,
        isAnonymous: true,
      };

      mockOnAuthStateChanged.mockImplementation((_, callback) => {
        callback(mockAnonUser);
        return jest.fn();
      });

      await act(async () => {
        await useAuthStore.getState().initAuth();
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.isAnonymous).toBe(true);
    });
  });

  describe('signInAnonymously', () => {
    it('should sign in anonymously and update state', async () => {
      const mockAnonUser = { uid: 'anon-123', isAnonymous: true };
      mockSignInAnonymously.mockResolvedValue({ user: mockAnonUser });

      await act(async () => {
        await useAuthStore.getState().signInAnonymously();
      });

      expect(mockSignInAnonymously).toHaveBeenCalled();
    });

    it('should set error on failure', async () => {
      mockSignInAnonymously.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await useAuthStore.getState().signInAnonymously();
      });

      const state = useAuthStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('signInWithEmail', () => {
    it('should sign in with email and password', async () => {
      const mockUser = { uid: 'email-user', email: 'a@b.com', isAnonymous: false };
      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      await act(async () => {
        await useAuthStore.getState().signInWithEmail('a@b.com', 'password123');
      });

      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'a@b.com',
        'password123'
      );
    });

    it('should set error for invalid credentials', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'Wrong password',
      });

      await act(async () => {
        await useAuthStore.getState().signInWithEmail('a@b.com', 'wrong');
      });

      const state = useAuthStore.getState();
      expect(state.error).toBeTruthy();
      expect(state.isLoading).toBe(false);
    });
  });

  describe('signUpWithEmail', () => {
    it('should create account and Firestore profile', async () => {
      const mockUser = { uid: 'new-user', email: 'new@b.com', isAnonymous: false };
      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      const { createUserProfile } = require('../../services/firebase/firestore');

      await act(async () => {
        await useAuthStore.getState().signUpWithEmail('new@b.com', 'password123', 'New User');
      });

      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'new@b.com',
        'password123'
      );
      expect(createUserProfile).toHaveBeenCalledWith('new-user', expect.objectContaining({
        email: 'new@b.com',
        displayName: 'New User',
      }));
    });
  });

  describe('signOut', () => {
    it('should sign out and clear state', async () => {
      // Set up authenticated state first
      useAuthStore.setState({
        user: { uid: 'test' } as any,
        isAuthenticated: true,
      });

      mockSignOut.mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().signOut();
      });

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('should delete user data and account', async () => {
      const mockUser = { uid: 'del-user' };
      useAuthStore.setState({
        user: mockUser as any,
        isAuthenticated: true,
      });

      mockDeleteUser.mockResolvedValue(undefined);
      const { deleteUserData } = require('../../services/firebase/firestore');

      await act(async () => {
        await useAuthStore.getState().deleteAccount();
      });

      expect(deleteUserData).toHaveBeenCalledWith('del-user');
      expect(mockDeleteUser).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('clearError', () => {
    it('should clear the error state', () => {
      useAuthStore.setState({ error: 'Some error' });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('sendPasswordReset', () => {
    it('should send password reset email', async () => {
      mockSendPasswordResetEmail.mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().sendPasswordReset('user@example.com');
      });

      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        expect.anything(),
        'user@example.com'
      );
    });
  });

  describe('updateDisplayName', () => {
    it('should update Firebase profile display name', async () => {
      const mockUser = { uid: 'user-1', displayName: 'Old Name' };
      useAuthStore.setState({
        user: mockUser as any,
        isAuthenticated: true,
      });

      mockUpdateProfile.mockResolvedValue(undefined);

      await act(async () => {
        await useAuthStore.getState().updateDisplayName('New Name');
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'New Name' });
    });
  });
});
```

**Step 2: Run to verify failures**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest src/stores/__tests__/authStore.test.ts --verbose 2>&1 | head -60`
Expected: FAIL — `Cannot find module '../authStore'`

**Step 3: Commit**

```bash
git add src/stores/__tests__/authStore.test.ts
git commit -m "test: add auth store tests (red phase)"
```

---

## Task 4: Auth Store — Implementation

**Files:**
- Create: `keysense-app/src/stores/authStore.ts`

**Step 1: Implement the auth store**

```typescript
/**
 * Auth Store
 * Manages Firebase authentication state with Zustand
 */

import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInAnonymously as firebaseSignInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  deleteUser,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  linkWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  User,
} from 'firebase/auth';
import { auth } from '../services/firebase/config';
import { createUserProfile, deleteUserData } from '../services/firebase/firestore';
import { PersistenceManager, STORAGE_KEYS } from './persistence';

interface AuthState {
  user: User | null;
  isAnonymous: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Lifecycle
  initAuth: () => Promise<void>;

  // Sign in methods
  signInAnonymously: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: (identityToken: string, nonce: string) => Promise<void>;

  // Account linking (upgrade anonymous)
  linkWithGoogle: (idToken: string) => Promise<void>;
  linkWithApple: (identityToken: string, nonce: string) => Promise<void>;
  linkWithEmail: (email: string, password: string) => Promise<void>;

  // Account management
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAnonymous: false,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  initAuth: async () => {
    set({ isLoading: true });
    return new Promise<void>((resolve) => {
      onAuthStateChanged(auth, (user) => {
        set({
          user,
          isAuthenticated: !!user,
          isAnonymous: user?.isAnonymous ?? false,
          isLoading: false,
        });
        resolve();
      });
    });
  },

  signInAnonymously: async () => {
    set({ isLoading: true, error: null });
    try {
      await firebaseSignInAnonymously(auth);
    } catch (error: any) {
      set({ error: error.message || 'Failed to sign in anonymously', isLoading: false });
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      const message = handleAuthError(error);
      set({ error: message, isLoading: false });
    }
  },

  signUpWithEmail: async (email: string, password: string, displayName: string) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName });
      await createUserProfile(user.uid, {
        email,
        displayName,
        createdAt: new Date(),
      });
    } catch (error: any) {
      const message = handleAuthError(error);
      set({ error: message, isLoading: false });
    }
  },

  signInWithGoogle: async (idToken: string) => {
    set({ isLoading: true, error: null });
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (error: any) {
      const message = handleAuthError(error);
      set({ error: message, isLoading: false });
    }
  },

  signInWithApple: async (identityToken: string, nonce: string) => {
    set({ isLoading: true, error: null });
    try {
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({ idToken: identityToken, rawNonce: nonce });
      await signInWithCredential(auth, credential);
    } catch (error: any) {
      const message = handleAuthError(error);
      set({ error: message, isLoading: false });
    }
  },

  linkWithGoogle: async (idToken: string) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = get();
      if (!user) throw new Error('No authenticated user');
      const credential = GoogleAuthProvider.credential(idToken);
      await linkWithCredential(user, credential);
    } catch (error: any) {
      const message = handleAuthError(error);
      set({ error: message, isLoading: false });
    }
  },

  linkWithApple: async (identityToken: string, nonce: string) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = get();
      if (!user) throw new Error('No authenticated user');
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({ idToken: identityToken, rawNonce: nonce });
      await linkWithCredential(user, credential);
    } catch (error: any) {
      const message = handleAuthError(error);
      set({ error: message, isLoading: false });
    }
  },

  linkWithEmail: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = get();
      if (!user) throw new Error('No authenticated user');
      const { EmailAuthProvider } = require('firebase/auth');
      const credential = EmailAuthProvider.credential(email, password);
      await linkWithCredential(user, credential);
    } catch (error: any) {
      const message = handleAuthError(error);
      set({ error: message, isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      await firebaseSignOut(auth);
      // Clear local data
      await PersistenceManager.clearAll();
    } catch (error: any) {
      set({ error: error.message || 'Failed to sign out', isLoading: false });
    }
  },

  deleteAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      const { user } = get();
      if (!user) throw new Error('No authenticated user');
      // Delete Firestore data first, then auth account
      await deleteUserData(user.uid);
      await deleteUser(user);
      await PersistenceManager.clearAll();
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete account', isLoading: false });
    }
  },

  sendPasswordReset: async (email: string) => {
    set({ isLoading: true, error: null });
    try {
      await firebaseSendPasswordResetEmail(auth, email);
      set({ isLoading: false });
    } catch (error: any) {
      const message = handleAuthError(error);
      set({ error: message, isLoading: false });
    }
  },

  updateDisplayName: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = get();
      if (!user) throw new Error('No authenticated user');
      await updateProfile(user, { displayName: name });
      // Force state refresh
      set({ user: { ...user, displayName: name } as User, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to update name', isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

/** Map Firebase auth error codes to user-friendly messages */
function handleAuthError(error: any): string {
  const code = error.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters';
    case 'auth/invalid-email':
      return 'Please enter a valid email address';
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/user-disabled':
      return 'This account has been disabled';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later';
    case 'auth/credential-already-in-use':
      return 'This account is already linked to another user';
    case 'auth/requires-recent-login':
      return 'Please sign in again before this action';
    default:
      return error.message || 'An authentication error occurred';
  }
}
```

**Step 2: Run the tests**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest src/stores/__tests__/authStore.test.ts --verbose`
Expected: All tests PASS

**Step 3: Run full test suite to verify no regressions**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest --silent`
Expected: All 518+ tests pass

**Step 4: TypeScript check**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/stores/authStore.ts
git commit -m "feat: implement auth store with Firebase auth integration"
```

---

## Task 5: Sync Manager — Write Failing Tests

**Files:**
- Create: `keysense-app/src/services/firebase/__tests__/syncService.test.ts`

**Step 1: Write the failing test file**

```typescript
/**
 * SyncManager Tests
 * Tests offline queue, sync triggers, and conflict resolution
 */

jest.mock('../config', () => ({
  auth: { currentUser: { uid: 'test-user' } },
  db: {},
  functions: {},
}));

jest.mock('../firestore', () => ({
  syncProgress: jest.fn(),
  getAllLessonProgress: jest.fn(),
  getGamificationData: jest.fn(),
  updateLessonProgress: jest.fn(),
  addXp: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncManager } from '../syncService';

describe('SyncManager', () => {
  let syncManager: SyncManager;

  beforeEach(() => {
    syncManager = new SyncManager();
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    syncManager.stopPeriodicSync();
  });

  describe('offline queue', () => {
    it('should queue a change', async () => {
      await syncManager.queueChange({
        type: 'exercise_completed',
        data: { exerciseId: 'ex-1', score: 85 },
        timestamp: Date.now(),
        retryCount: 0,
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'keysense_sync_queue',
        expect.any(String)
      );
    });

    it('should limit queue to 100 items', async () => {
      const existingQueue = Array.from({ length: 100 }, (_, i) => ({
        type: 'exercise_completed',
        data: { exerciseId: `ex-${i}` },
        timestamp: i,
        retryCount: 0,
      }));
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(existingQueue));

      await syncManager.queueChange({
        type: 'exercise_completed',
        data: { exerciseId: 'ex-new' },
        timestamp: 999,
        retryCount: 0,
      });

      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData.length).toBe(100);
      // Oldest item should be dropped
      expect(savedData[0].data.exerciseId).toBe('ex-1');
      expect(savedData[savedData.length - 1].data.exerciseId).toBe('ex-new');
    });
  });

  describe('flushQueue', () => {
    it('should flush queued changes via syncProgress', async () => {
      const queue = [
        { type: 'exercise_completed', data: { exerciseId: 'ex-1', score: 90 }, timestamp: 1000, retryCount: 0 },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));

      const { syncProgress } = require('../firestore');
      syncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      await syncManager.flushQueue();

      expect(syncProgress).toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('keysense_sync_queue');
    });

    it('should retry failed items up to 3 times', async () => {
      const queue = [
        { type: 'exercise_completed', data: { exerciseId: 'ex-1' }, timestamp: 1000, retryCount: 2 },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));

      const { syncProgress } = require('../firestore');
      syncProgress.mockRejectedValue(new Error('Network error'));

      await syncManager.flushQueue();

      // Should save back with incremented retryCount
      const savedData = JSON.parse(
        (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
      );
      expect(savedData[0].retryCount).toBe(3);
    });

    it('should drop items exceeding max retries', async () => {
      const queue = [
        { type: 'exercise_completed', data: { exerciseId: 'ex-1' }, timestamp: 1000, retryCount: 3 },
      ];
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(queue));

      const { syncProgress } = require('../firestore');
      syncProgress.mockRejectedValue(new Error('Network error'));

      await syncManager.flushQueue();

      // Item at max retries should be dropped
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('keysense_sync_queue');
    });
  });

  describe('syncAfterExercise', () => {
    it('should queue exercise completion and attempt flush', async () => {
      const { syncProgress } = require('../firestore');
      syncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      await syncManager.syncAfterExercise('ex-1', { overall: 90, stars: 3 } as any);

      // Should have queued the change
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('periodic sync', () => {
    it('should start and stop periodic sync', () => {
      jest.useFakeTimers();

      syncManager.startPeriodicSync(60000); // 1 min for testing

      expect(syncManager.isPeriodicSyncActive()).toBe(true);

      syncManager.stopPeriodicSync();
      expect(syncManager.isPeriodicSyncActive()).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('syncAll', () => {
    it('should return sync result', async () => {
      const { syncProgress } = require('../firestore');
      syncProgress.mockResolvedValue({
        serverChanges: [],
        newSyncTimestamp: Date.now(),
        conflicts: [],
      });

      const result = await syncManager.syncAll();

      expect(result).toEqual(expect.objectContaining({
        success: expect.any(Boolean),
        changesUploaded: expect.any(Number),
        changesDownloaded: expect.any(Number),
        conflicts: expect.any(Number),
      }));
    });
  });
});
```

**Step 2: Run to verify failures**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest src/services/firebase/__tests__/syncService.test.ts --verbose 2>&1 | head -40`
Expected: FAIL — `Cannot find module '../syncService'`

**Step 3: Commit**

```bash
git add src/services/firebase/__tests__/syncService.test.ts
git commit -m "test: add sync manager tests (red phase)"
```

---

## Task 6: Sync Manager — Implementation

**Files:**
- Create: `keysense-app/src/services/firebase/syncService.ts`

**Step 1: Implement the SyncManager class**

```typescript
/**
 * Sync Manager
 * Handles bidirectional sync between local stores and Firestore
 * with offline queue and conflict resolution
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './config';
import { syncProgress } from './firestore';

const SYNC_QUEUE_KEY = 'keysense_sync_queue';
const LAST_SYNC_KEY = 'keysense_last_sync';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;

export interface SyncChange {
  type: 'exercise_completed' | 'xp_earned' | 'settings_changed';
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

export interface SyncResult {
  success: boolean;
  changesUploaded: number;
  changesDownloaded: number;
  conflicts: number;
}

export class SyncManager {
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  /** Start periodic background sync */
  startPeriodicSync(intervalMs: number = 300000): void {
    this.stopPeriodicSync();
    this.syncTimer = setInterval(() => {
      this.syncAll().catch((err) =>
        console.warn('[SyncManager] Periodic sync failed:', err)
      );
    }, intervalMs);
  }

  /** Stop periodic sync */
  stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /** Check if periodic sync is running */
  isPeriodicSyncActive(): boolean {
    return this.syncTimer !== null;
  }

  /** Queue a change for sync */
  async queueChange(change: SyncChange): Promise<void> {
    const queue = await this.loadQueue();
    queue.push(change);

    // Enforce max queue size — drop oldest items
    while (queue.length > MAX_QUEUE_SIZE) {
      queue.shift();
    }

    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  }

  /** Sync after an exercise completion (immediate) */
  async syncAfterExercise(exerciseId: string, score: any): Promise<void> {
    await this.queueChange({
      type: 'exercise_completed',
      data: { exerciseId, score: score.overall, stars: score.stars },
      timestamp: Date.now(),
      retryCount: 0,
    });

    // Attempt immediate flush
    await this.flushQueue();
  }

  /** Flush the offline queue */
  async flushQueue(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const queue = await this.loadQueue();
    if (queue.length === 0) return;

    // Separate items within retry limit vs exceeded
    const retriable = queue.filter((item) => item.retryCount < MAX_RETRIES);
    if (retriable.length === 0) {
      await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
      return;
    }

    try {
      const lastSync = await this.getLastSyncTimestamp();
      await syncProgress(uid, {
        lastSyncTimestamp: lastSync,
        localChanges: retriable.map((item) => ({
          id: `${item.type}-${item.timestamp}`,
          type: item.type as any,
          exerciseId: item.data.exerciseId as string | undefined,
          score: item.data.score as number | undefined,
          xpAmount: item.data.xpAmount as number | undefined,
          timestamp: item.timestamp as any,
          synced: false,
        })),
      });

      // Success — clear queue and update timestamp
      await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
      await this.setLastSyncTimestamp(Date.now());
    } catch {
      // Increment retry counts and save back
      const updated = retriable.map((item) => ({
        ...item,
        retryCount: item.retryCount + 1,
      }));
      // Drop items that exceeded max retries after increment
      const remaining = updated.filter((item) => item.retryCount < MAX_RETRIES);
      if (remaining.length > 0) {
        await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
      } else {
        await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
      }
    }
  }

  /** Full bidirectional sync */
  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, changesUploaded: 0, changesDownloaded: 0, conflicts: 0 };
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      return { success: false, changesUploaded: 0, changesDownloaded: 0, conflicts: 0 };
    }

    this.isSyncing = true;
    try {
      // Flush any queued changes first
      await this.flushQueue();

      const lastSync = await this.getLastSyncTimestamp();
      const response = await syncProgress(uid, {
        lastSyncTimestamp: lastSync,
        localChanges: [],
      });

      await this.setLastSyncTimestamp(response.newSyncTimestamp);

      return {
        success: true,
        changesUploaded: 0,
        changesDownloaded: response.serverChanges?.length ?? 0,
        conflicts: response.conflicts?.length ?? 0,
      };
    } catch {
      return { success: false, changesUploaded: 0, changesDownloaded: 0, conflicts: 0 };
    } finally {
      this.isSyncing = false;
    }
  }

  // --- Private helpers ---

  private async loadQueue(): Promise<SyncChange[]> {
    const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  private async getLastSyncTimestamp(): Promise<number> {
    const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return raw ? parseInt(raw, 10) : 0;
  }

  private async setLastSyncTimestamp(ts: number): Promise<void> {
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(ts));
  }
}

/** Singleton instance */
export const syncManager = new SyncManager();
```

**Step 2: Run the tests**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest src/services/firebase/__tests__/syncService.test.ts --verbose`
Expected: All tests PASS

**Step 3: Run full test suite**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest --silent`
Expected: All tests pass

**Step 4: TypeScript check**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/services/firebase/syncService.ts
git commit -m "feat: implement SyncManager with offline queue and periodic sync"
```

---

## Task 7: AuthScreen UI

**Files:**
- Create: `keysense-app/src/screens/AuthScreen.tsx`

**Step 1: Write failing test**

Create `keysense-app/src/screens/__tests__/AuthScreen.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn((selector) => {
    const state = {
      isLoading: false,
      error: null,
      signInAnonymously: jest.fn(),
      signInWithGoogle: jest.fn(),
      signInWithApple: jest.fn(),
      clearError: jest.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((obj) => obj.ios),
}));

import { AuthScreen } from '../AuthScreen';

describe('AuthScreen', () => {
  it('should render all auth buttons', () => {
    const { getByText } = render(<AuthScreen />);

    expect(getByText(/Continue with Apple/i)).toBeTruthy();
    expect(getByText(/Continue with Google/i)).toBeTruthy();
    expect(getByText(/Continue with Email/i)).toBeTruthy();
    expect(getByText(/Skip for now/i)).toBeTruthy();
  });

  it('should call signInAnonymously on skip', () => {
    const mockSignIn = jest.fn();
    const { useAuthStore } = require('../../stores/authStore');
    useAuthStore.mockImplementation((selector: any) => {
      const state = {
        isLoading: false,
        error: null,
        signInAnonymously: mockSignIn,
        signInWithGoogle: jest.fn(),
        signInWithApple: jest.fn(),
        clearError: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    const { getByText } = render(<AuthScreen />);
    fireEvent.press(getByText(/Skip for now/i));

    expect(mockSignIn).toHaveBeenCalled();
  });
});
```

**Step 2: Run to verify failure**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest src/screens/__tests__/AuthScreen.test.tsx --verbose 2>&1 | head -30`
Expected: FAIL — `Cannot find module '../AuthScreen'`

**Step 3: Implement AuthScreen**

Create `keysense-app/src/screens/AuthScreen.tsx`:

```typescript
/**
 * AuthScreen
 * First screen for unauthenticated users.
 * Offers Apple, Google, Email sign-in, and anonymous skip.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KeysieAvatar } from '../components/Mascot/KeysieAvatar';
import { useAuthStore } from '../stores/authStore';
import type { RootStackParamList } from '../navigation/AppNavigator';

type AuthNavProp = NativeStackNavigationProp<RootStackParamList>;

export function AuthScreen(): React.ReactElement {
  const navigation = useNavigation<AuthNavProp>();
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const signInAnonymously = useAuthStore((s) => s.signInAnonymously);
  const clearError = useAuthStore((s) => s.clearError);

  const handleAppleSignIn = useCallback(async () => {
    try {
      const AppleAuth = require('expo-apple-authentication');
      const crypto = require('expo-crypto');

      const nonce = await crypto.digestStringAsync(
        crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString()
      );

      const appleCredential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });

      if (appleCredential.identityToken) {
        await useAuthStore.getState().signInWithApple(appleCredential.identityToken, nonce);
      }
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        console.warn('[AuthScreen] Apple sign-in error:', err);
      }
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken ?? userInfo.idToken;
      if (idToken) {
        await useAuthStore.getState().signInWithGoogle(idToken);
      }
    } catch (err: any) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        console.warn('[AuthScreen] Google sign-in error:', err);
      }
    }
  }, []);

  const handleEmailNav = useCallback(() => {
    navigation.navigate('EmailAuth' as any);
  }, [navigation]);

  const handleSkip = useCallback(() => {
    signInAnonymously();
  }, [signInAnonymously]);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <KeysieAvatar mood="celebrating" size="large" animated showParticles />
        <Text style={styles.title}>Let's make music!</Text>
        <Text style={styles.subtitle}>Sign in to save your progress across devices</Text>
      </View>

      {error && (
        <TouchableOpacity style={styles.errorBanner} onPress={clearError}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorDismiss}>Tap to dismiss</Text>
        </TouchableOpacity>
      )}

      <View style={styles.buttons}>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.button, styles.appleButton]}
            onPress={handleAppleSignIn}
            disabled={isLoading}
          >
            <Text style={[styles.buttonText, styles.appleButtonText]}>
              Continue with Apple
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.googleButton]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, styles.googleButtonText]}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.emailButton]}
          onPress={handleEmailNav}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Continue with Email</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#999" />
        ) : (
          <Text style={styles.skipText}>Skip for now</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 15,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#3D1111',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
  },
  errorDismiss: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  buttons: {
    gap: 12,
  },
  button: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
  },
  appleButtonText: {
    color: '#000000',
  },
  googleButton: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333',
  },
  googleButtonText: {
    color: '#FFFFFF',
  },
  emailButton: {
    backgroundColor: '#DC143C',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  skipButton: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipText: {
    color: '#666',
    fontSize: 15,
  },
});
```

**Step 4: Run the tests**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest src/screens/__tests__/AuthScreen.test.tsx --verbose`
Expected: PASS

**Step 5: Commit**

```bash
git add src/screens/AuthScreen.tsx src/screens/__tests__/AuthScreen.test.tsx
git commit -m "feat: add AuthScreen with Apple, Google, Email, and anonymous sign-in"
```

---

## Task 8: EmailAuthScreen UI

**Files:**
- Create: `keysense-app/src/screens/EmailAuthScreen.tsx`
- Create: `keysense-app/src/screens/__tests__/EmailAuthScreen.test.tsx`

**Step 1: Write failing test**

Create `keysense-app/src/screens/__tests__/EmailAuthScreen.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn((selector) => {
    const state = {
      isLoading: false,
      error: null,
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
      sendPasswordReset: jest.fn(),
      clearError: jest.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}));

import { EmailAuthScreen } from '../EmailAuthScreen';

describe('EmailAuthScreen', () => {
  it('should render sign-in mode by default', () => {
    const { getByText, getByPlaceholderText } = render(<EmailAuthScreen />);
    expect(getByText('Sign In')).toBeTruthy();
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
  });

  it('should toggle to create account mode', () => {
    const { getByText, getByPlaceholderText } = render(<EmailAuthScreen />);
    fireEvent.press(getByText('Create Account'));
    expect(getByPlaceholderText('Display Name')).toBeTruthy();
  });

  it('should show forgot password in sign-in mode', () => {
    const { getByText } = render(<EmailAuthScreen />);
    expect(getByText(/Forgot Password/i)).toBeTruthy();
  });

  it('should validate email format', () => {
    const { getByPlaceholderText, getByText } = render(<EmailAuthScreen />);
    fireEvent.changeText(getByPlaceholderText('Email'), 'invalid-email');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));
    // Should not call signInWithEmail for invalid email
  });
});
```

**Step 2: Implement EmailAuthScreen**

Create `keysense-app/src/screens/EmailAuthScreen.tsx`:

```typescript
/**
 * EmailAuthScreen
 * Email sign-in / sign-up with forgot password support
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';

type Mode = 'signIn' | 'signUp';

export function EmailAuthScreen(): React.ReactElement {
  const navigation = useNavigation();
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const clearError = useAuthStore((s) => s.clearError);

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = useCallback((): boolean => {
    setValidationError(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setValidationError('Please enter a valid email address');
      return false;
    }
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return false;
    }
    if (mode === 'signUp' && displayName.trim().length < 2) {
      setValidationError('Display name must be at least 2 characters');
      return false;
    }
    return true;
  }, [email, password, displayName, mode]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    clearError();

    if (mode === 'signIn') {
      await signInWithEmail(email, password);
    } else {
      await signUpWithEmail(email, password, displayName.trim());
    }
  }, [mode, email, password, displayName, validate, clearError, signInWithEmail, signUpWithEmail]);

  const handleForgotPassword = useCallback(async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Enter Email', 'Please enter your email address first.');
      return;
    }
    await sendPasswordReset(email);
    Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
  }, [email, sendPasswordReset]);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
    setValidationError(null);
    clearError();
  }, [clearError]);

  const displayError = validationError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'signIn' && styles.activeTab]}
            onPress={() => { setMode('signIn'); setValidationError(null); clearError(); }}
          >
            <Text style={[styles.tabText, mode === 'signIn' && styles.activeTabText]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'signUp' && styles.activeTab]}
            onPress={toggleMode}
          >
            <Text style={[styles.tabText, mode === 'signUp' && styles.activeTabText]}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#666"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {mode === 'signUp' && (
            <TextInput
              style={styles.input}
              placeholder="Display Name"
              placeholderTextColor="#666"
              autoCapitalize="words"
              value={displayName}
              onChangeText={setDisplayName}
            />
          )}

          {displayError && (
            <Text style={styles.errorText}>{displayError}</Text>
          )}

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'signIn' ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {mode === 'signIn' && (
            <TouchableOpacity style={styles.forgotButton} onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    color: '#DC143C',
    fontSize: 16,
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 16,
  },
  tab: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#DC143C',
  },
  tabText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginTop: -4,
  },
  submitButton: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotText: {
    color: '#999',
    fontSize: 14,
  },
});
```

**Step 3: Run tests**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest src/screens/__tests__/EmailAuthScreen.test.tsx --verbose`
Expected: PASS

**Step 4: Commit**

```bash
git add src/screens/EmailAuthScreen.tsx src/screens/__tests__/EmailAuthScreen.test.tsx
git commit -m "feat: add EmailAuthScreen with sign-in/up toggle and validation"
```

---

## Task 9: AccountScreen UI

**Files:**
- Create: `keysense-app/src/screens/AccountScreen.tsx`
- Create: `keysense-app/src/screens/__tests__/AccountScreen.test.tsx`

**Step 1: Write failing test**

Create `keysense-app/src/screens/__tests__/AccountScreen.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn((selector) => {
    const state = {
      user: { uid: 'test-uid', email: 'test@example.com', displayName: 'Test User', isAnonymous: false },
      isAnonymous: false,
      isLoading: false,
      error: null,
      signOut: jest.fn(),
      deleteAccount: jest.fn(),
      updateDisplayName: jest.fn(),
      linkWithGoogle: jest.fn(),
      linkWithApple: jest.fn(),
      linkWithEmail: jest.fn(),
      clearError: jest.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));

import { AccountScreen } from '../AccountScreen';

jest.spyOn(Alert, 'alert');

describe('AccountScreen', () => {
  it('should render authenticated user view', () => {
    const { getByText } = render(<AccountScreen />);
    expect(getByText('Test User')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();
    expect(getByText(/Sign Out/i)).toBeTruthy();
    expect(getByText(/Delete Account/i)).toBeTruthy();
  });

  it('should render anonymous user view', () => {
    const { useAuthStore } = require('../../stores/authStore');
    useAuthStore.mockImplementation((selector: any) => {
      const state = {
        user: { uid: 'anon-uid', isAnonymous: true },
        isAnonymous: true,
        isLoading: false,
        error: null,
        signOut: jest.fn(),
        deleteAccount: jest.fn(),
        updateDisplayName: jest.fn(),
        linkWithGoogle: jest.fn(),
        linkWithApple: jest.fn(),
        linkWithEmail: jest.fn(),
        clearError: jest.fn(),
      };
      return selector ? selector(state) : state;
    });

    const { getByText } = render(<AccountScreen />);
    expect(getByText(/Create an account/i)).toBeTruthy();
    expect(getByText(/Link with Google/i)).toBeTruthy();
  });

  it('should show confirmation on sign out', () => {
    const { getByText } = render(<AccountScreen />);
    fireEvent.press(getByText(/Sign Out/i));
    expect(Alert.alert).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.any(Array)
    );
  });
});
```

**Step 2: Implement AccountScreen**

Create `keysense-app/src/screens/AccountScreen.tsx`:

```typescript
/**
 * AccountScreen
 * Account management: profile editing, provider linking, sign out, delete.
 * Different layouts for authenticated vs anonymous users.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { KeysieAvatar } from '../components/Mascot/KeysieAvatar';
import { useAuthStore } from '../stores/authStore';

export function AccountScreen(): React.ReactElement {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const authSignOut = useAuthStore((s) => s.signOut);
  const authDeleteAccount = useAuthStore((s) => s.deleteAccount);
  const authUpdateDisplayName = useAuthStore((s) => s.updateDisplayName);
  const clearError = useAuthStore((s) => s.clearError);

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.displayName ?? '');

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? Your local progress will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await authSignOut();
          },
        },
      ]
    );
  }, [authSignOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all progress. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await authDeleteAccount();
          },
        },
      ]
    );
  }, [authDeleteAccount]);

  const handleSaveName = useCallback(async () => {
    if (newName.trim().length < 2) return;
    await authUpdateDisplayName(newName.trim());
    setIsEditingName(false);
  }, [newName, authUpdateDisplayName]);

  const handleLinkGoogle = useCallback(async () => {
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken ?? userInfo.idToken;
      if (idToken) {
        await useAuthStore.getState().linkWithGoogle(idToken);
      }
    } catch (err: any) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        console.warn('[AccountScreen] Google link error:', err);
      }
    }
  }, []);

  const handleLinkApple = useCallback(async () => {
    try {
      const AppleAuth = require('expo-apple-authentication');
      const crypto = require('expo-crypto');
      const nonce = await crypto.digestStringAsync(
        crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString()
      );
      const cred = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });
      if (cred.identityToken) {
        await useAuthStore.getState().linkWithApple(cred.identityToken, nonce);
      }
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        console.warn('[AccountScreen] Apple link error:', err);
      }
    }
  }, []);

  // Anonymous user → show account linking CTA
  if (isAnonymous) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Account</Text>
        </TouchableOpacity>

        <View style={styles.anonHero}>
          <KeysieAvatar mood="encouraging" size="large" animated />
          <Text style={styles.anonTitle}>Create an account to save your progress across devices!</Text>
        </View>

        <View style={styles.linkButtons}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={[styles.linkButton, styles.appleLink]} onPress={handleLinkApple}>
              <Text style={[styles.linkButtonText, { color: '#000' }]}>Link with Apple</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.linkButton, styles.googleLink]} onPress={handleLinkGoogle}>
            <Text style={styles.linkButtonText}>Link with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.linkButton, styles.emailLink]}
            onPress={() => navigation.navigate('EmailAuth' as any)}
          >
            <Text style={styles.linkButtonText}>Link with Email</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Your progress is saved locally.</Text>
          <Text style={styles.infoBody}>
            Without an account, you'll lose it if you reinstall the app.
          </Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>
    );
  }

  // Authenticated user → full account management
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Account</Text>
      </TouchableOpacity>

      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.displayName ?? '?')[0].toUpperCase()}</Text>
        </View>
        <View>
          {isEditingName ? (
            <View style={styles.nameEdit}>
              <TextInput
                style={styles.nameInput}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                maxLength={30}
              />
              <TouchableOpacity onPress={handleSaveName}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsEditingName(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setIsEditingName(true)}>
              <Text style={styles.displayName}>{user?.displayName ?? 'Unknown'}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.email}>{user?.email ?? ''}</Text>
        </View>
      </View>

      {error && (
        <TouchableOpacity onPress={clearError}>
          <Text style={styles.errorText}>{error}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <TouchableOpacity style={styles.row} onPress={() => setIsEditingName(true)}>
          <Text style={styles.rowText}>Change Display Name</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Linked Accounts</Text>
        <TouchableOpacity style={styles.row} onPress={handleLinkGoogle}>
          <Text style={styles.rowText}>Google</Text>
          <Text style={styles.rowAction}>Link Account</Text>
        </TouchableOpacity>
        {Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.row} onPress={handleLinkApple}>
            <Text style={styles.rowText}>Apple</Text>
            <Text style={styles.rowAction}>Link Account</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dangerSection}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>
        <TouchableOpacity style={styles.dangerRow} onPress={handleSignOut} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#FF6B6B" />
          ) : (
            <Text style={styles.dangerText}>Sign Out</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteAccount} disabled={isLoading}>
          <Text style={[styles.dangerText, styles.deleteText]}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scrollContent: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  backButton: { marginBottom: 24 },
  backText: { color: '#DC143C', fontSize: 16, fontWeight: '600' },
  // Anonymous hero
  anonHero: { alignItems: 'center', marginBottom: 32 },
  anonTitle: { fontSize: 18, color: '#CCC', textAlign: 'center', marginTop: 16, lineHeight: 26 },
  linkButtons: { gap: 12, marginBottom: 32 },
  linkButton: { height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  appleLink: { backgroundColor: '#FFF' },
  googleLink: { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333' },
  emailLink: { backgroundColor: '#DC143C' },
  linkButtonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  infoBox: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16 },
  infoTitle: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  infoBody: { color: '#999', fontSize: 14, marginTop: 4 },
  // Authenticated
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 32 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#DC143C', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 24, fontWeight: '700' },
  displayName: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  email: { color: '#999', fontSize: 14, marginTop: 2 },
  nameEdit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: { backgroundColor: '#1A1A1A', color: '#FFF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, fontSize: 16, minWidth: 150 },
  saveText: { color: '#DC143C', fontWeight: '600' },
  cancelText: { color: '#666' },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#666', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  row: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowText: { color: '#FFF', fontSize: 15 },
  rowAction: { color: '#DC143C', fontSize: 14 },
  dangerSection: { marginTop: 16 },
  dangerRow: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, marginBottom: 8, alignItems: 'center' },
  dangerText: { color: '#FF6B6B', fontSize: 15, fontWeight: '600' },
  deleteText: { color: '#FF4444' },
  errorText: { color: '#FF6B6B', fontSize: 14, textAlign: 'center', marginBottom: 16 },
});
```

**Step 3: Run tests**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest src/screens/__tests__/AccountScreen.test.tsx --verbose`
Expected: PASS

**Step 4: Commit**

```bash
git add src/screens/AccountScreen.tsx src/screens/__tests__/AccountScreen.test.tsx
git commit -m "feat: add AccountScreen with profile management and anonymous linking"
```

---

## Task 10: Navigation Guards — Wire Auth Flow

**Files:**
- Modify: `keysense-app/src/navigation/AppNavigator.tsx`
- Modify: `keysense-app/src/App.tsx`

**Step 1: Update RootStackParamList and navigation structure**

In `AppNavigator.tsx`, add the auth screens to the param list and conditionally show auth flow:

```typescript
// Updated RootStackParamList
export type RootStackParamList = {
  Auth: undefined;
  EmailAuth: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  Exercise: { exerciseId: string };
  MidiSetup: undefined;
  Account: undefined;
};
```

Add imports for the new screens:
```typescript
import { AuthScreen } from '../screens/AuthScreen';
import { EmailAuthScreen } from '../screens/EmailAuthScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { useAuthStore } from '../stores/authStore';
```

Update `AppNavigator` to conditionally render auth screens:

```typescript
export function AppNavigator() {
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return null; // Or a splash/loading view
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Auth flow
          <>
            <RootStack.Screen name="Auth" component={AuthScreen} />
            <RootStack.Screen name="EmailAuth" component={EmailAuthScreen} />
          </>
        ) : !hasCompletedOnboarding ? (
          // Onboarding
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          // Main app
          <>
            <RootStack.Screen name="MainTabs" component={MainTabs} />
            <RootStack.Screen
              name="Exercise"
              component={ExercisePlayer as unknown as React.ComponentType<Record<string, unknown>>}
              options={{ animation: 'fade' }}
            />
            <RootStack.Screen
              name="MidiSetup"
              component={MidiSetupScreen}
              options={{ presentation: 'modal', headerShown: true, title: 'MIDI Setup' }}
            />
            <RootStack.Screen
              name="Account"
              component={AccountScreen}
              options={{ presentation: 'modal' }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
```

**Step 2: Update App.tsx to initialize auth**

In `App.tsx`, add auth initialization to the `prepare()` function, before state hydration:

```typescript
import { useAuthStore } from './stores/authStore';

// Inside prepare():
// Initialize Firebase auth listener FIRST
await useAuthStore.getState().initAuth();
```

Add the import and call it as the first step in the existing `prepare()` function, before the progress and settings hydration.

**Step 3: Run tests**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest --silent`
Expected: All tests pass (existing navigation tests may need auth mock updates)

**Step 4: TypeScript check**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/navigation/AppNavigator.tsx src/App.tsx
git commit -m "feat: add auth navigation guards and init auth on app launch"
```

---

## Task 11: Profile → Account Link

**Files:**
- Modify: `keysense-app/src/screens/ProfileScreen.tsx`

**Step 1: Add Account button to ProfileScreen**

In the settings section of ProfileScreen, add an "Account" row that navigates to the Account screen:

```typescript
// Add import at top:
import type { RootStackParamList } from '../navigation/AppNavigator';

// In the settings section, add before MIDI Setup:
<TouchableOpacity
  style={styles.settingButton}
  onPress={() => navigation.navigate('Account')}
>
  <Text style={styles.settingButtonText}>Account</Text>
  <Text style={styles.settingChevron}>→</Text>
</TouchableOpacity>
```

**Step 2: Run tests**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest --silent`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/screens/ProfileScreen.tsx
git commit -m "feat: add Account link to ProfileScreen settings"
```

---

## Task 12: Wire Sync to Exercise Completion

**Files:**
- Modify: `keysense-app/src/screens/ExercisePlayer/ExercisePlayer.tsx`
- Modify: `keysense-app/src/App.tsx`

**Step 1: Import sync manager in ExercisePlayer**

In `ExercisePlayer.tsx`, after exercise completion scoring, call the sync manager:

```typescript
import { syncManager } from '../../services/firebase/syncService';

// In handleExerciseCompletion, after recording progress:
// Sync to cloud (non-blocking)
syncManager.syncAfterExercise(exerciseId, exerciseScore).catch(() => {});
```

**Step 2: Start periodic sync in App.tsx**

In `App.tsx`, after auth is initialized and user is authenticated:

```typescript
import { syncManager } from './services/firebase/syncService';

// In prepare(), after initAuth():
const authState = useAuthStore.getState();
if (authState.isAuthenticated && !authState.isAnonymous) {
  syncManager.startPeriodicSync(300000); // 5 minutes
}
```

**Step 3: Add AppState listener for foreground sync**

In `App.tsx`, add a foreground sync trigger:

```typescript
import { AppState } from 'react-native';

// Inside App component, add useEffect:
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      const { isAuthenticated, isAnonymous } = useAuthStore.getState();
      if (isAuthenticated && !isAnonymous) {
        syncManager.syncAll().catch(() => {});
      }
    }
  });
  return () => subscription.remove();
}, []);
```

**Step 4: Run tests**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest --silent`
Expected: All tests pass

**Step 5: TypeScript check**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx tsc --noEmit`
Expected: 0 errors

**Step 6: Commit**

```bash
git add src/screens/ExercisePlayer/ExercisePlayer.tsx src/App.tsx
git commit -m "feat: wire sync to exercise completion and app lifecycle"
```

---

## Task 13: Data Migration (Local → Cloud)

**Files:**
- Create: `keysense-app/src/services/firebase/dataMigration.ts`

**Step 1: Write the migration service**

```typescript
/**
 * Data Migration
 * Uploads local progress to Firestore when user first authenticates
 * or upgrades from anonymous to full account.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './config';
import {
  getUserProfile,
  createUserProfile,
  getGamificationData,
  createGamificationData,
  addXp,
  batchUpdateLessonProgress,
} from './firestore';
import { useProgressStore } from '../../stores/progressStore';
import { useSettingsStore } from '../../stores/settingsStore';

const MIGRATION_KEY = 'keysense_migration_complete';

export async function migrateLocalToCloud(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  // Check if already migrated
  const migrated = await AsyncStorage.getItem(`${MIGRATION_KEY}_${uid}`);
  if (migrated === 'true') return;

  console.log('[Migration] Starting local → cloud migration for', uid);

  try {
    // 1. Ensure user profile exists
    const existingProfile = await getUserProfile(uid);
    if (!existingProfile) {
      const settings = useSettingsStore.getState();
      await createUserProfile(uid, {
        email: auth.currentUser?.email ?? '',
        displayName: auth.currentUser?.displayName ?? settings.displayName ?? 'Piano Student',
        createdAt: new Date(),
      });
    }

    // 2. Sync gamification data (XP, level, streak)
    const localProgress = useProgressStore.getState();
    const existingGamification = await getGamificationData(uid);
    if (!existingGamification) {
      await createGamificationData(uid);
    }

    // Upload local XP if higher
    if (localProgress.totalXp > 0) {
      const serverXp = existingGamification?.xp ?? 0;
      if (localProgress.totalXp > serverXp) {
        const diff = localProgress.totalXp - serverXp;
        await addXp(uid, diff, 'local_migration');
      }
    }

    // 3. Upload lesson progress (keep highest scores)
    const localLessons = localProgress.lessonProgress;
    if (Object.keys(localLessons).length > 0) {
      const updates: Record<string, any> = {};
      for (const [lessonId, progress] of Object.entries(localLessons)) {
        updates[lessonId] = progress;
      }
      await batchUpdateLessonProgress(uid, updates);
    }

    // Mark migration complete
    await AsyncStorage.setItem(`${MIGRATION_KEY}_${uid}`, 'true');
    console.log('[Migration] Migration complete for', uid);
  } catch (error) {
    console.warn('[Migration] Migration failed:', error);
    // Don't mark as complete — will retry next time
  }
}
```

**Step 2: Call migration after successful auth**

In `src/stores/authStore.ts`, within the `initAuth` listener, after user state is set, trigger migration:

```typescript
// Inside onAuthStateChanged callback, after set():
if (user && !user.isAnonymous) {
  // Non-blocking migration
  import('../services/firebase/dataMigration').then(({ migrateLocalToCloud }) =>
    migrateLocalToCloud().catch(() => {})
  );
}
```

**Step 3: Run tests**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest --silent`
Expected: All tests pass

**Step 4: TypeScript check**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/services/firebase/dataMigration.ts src/stores/authStore.ts
git commit -m "feat: add local-to-cloud data migration on first auth"
```

---

## Task 14: Full Integration Verification

**Files:**
- No new files — verification only

**Step 1: Run full test suite**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest --silent`
Expected: All tests pass (should be 530+ tests across 25+ suites)

**Step 2: TypeScript check**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx tsc --noEmit`
Expected: 0 errors

**Step 3: Verify app starts**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx expo start --port 8081`
Expected: Metro bundler starts, app loads on simulator

**Step 4: Manual verification checklist**

- [ ] App shows AuthScreen on first launch (no persisted auth)
- [ ] "Skip for now" creates anonymous user → proceeds to Onboarding/MainTabs
- [ ] Profile → Account shows anonymous user linking options
- [ ] Email sign-in/up flow works (if Firebase project is configured)
- [ ] Sign out returns to AuthScreen
- [ ] Exercise completion triggers sync (check console log)

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: integration fixes for auth flow"
```

---

## Summary

| Task | What | Files | Est. Time |
|------|------|-------|-----------|
| 1 | Install deps | package.json, app.json | 5 min |
| 2 | Firebase config | firebase.json, .firebaserc | 5 min |
| 3 | Auth store tests (red) | authStore.test.ts | 10 min |
| 4 | Auth store (green) | authStore.ts | 15 min |
| 5 | Sync manager tests (red) | syncService.test.ts | 10 min |
| 6 | Sync manager (green) | syncService.ts | 15 min |
| 7 | AuthScreen | AuthScreen.tsx + test | 15 min |
| 8 | EmailAuthScreen | EmailAuthScreen.tsx + test | 15 min |
| 9 | AccountScreen | AccountScreen.tsx + test | 15 min |
| 10 | Navigation guards | AppNavigator.tsx, App.tsx | 10 min |
| 11 | Profile → Account | ProfileScreen.tsx | 5 min |
| 12 | Wire sync | ExercisePlayer.tsx, App.tsx | 10 min |
| 13 | Data migration | dataMigration.ts, authStore.ts | 10 min |
| 14 | Integration verify | — | 10 min |
| **Total** | | | **~2.5 hrs** |
