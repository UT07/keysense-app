/**
 * Firebase Authentication Store
 *
 * Manages user authentication state using Zustand.
 * Handles anonymous auth, email/password, Google, and Apple sign-in.
 * Supports account linking (anonymous → permanent account).
 *
 * NOT persisted — auth state comes from Firebase's own persistence.
 * Uses onAuthStateChanged listener to stay in sync.
 */

import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInAnonymously as firebaseSignInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  reauthenticateWithCredential,
  signOut as firebaseSignOut,
  deleteUser,
  updateProfile,
  sendPasswordResetEmail,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import type { User, AuthCredential } from 'firebase/auth';
import { auth, firebaseAvailable } from '../services/firebase/config';
import { createUserProfile, getUserProfile, updateUserProfile, deleteUserData } from '../services/firebase/firestore';
import { PersistenceManager, cancelAllPendingSaves } from './persistence';
import { useProgressStore } from './progressStore';
import { useSettingsStore } from './settingsStore';
import { useExerciseStore } from './exerciseStore';
import { useCatEvolutionStore } from './catEvolutionStore';
import { useGemStore } from './gemStore';
import { useSongStore } from './songStore';
import { useAchievementStore } from './achievementStore';
import { useLearnerProfileStore } from './learnerProfileStore';
import { useSocialStore } from './socialStore';
import { useLeagueStore } from './leagueStore';

// ============================================================================
// Types
// ============================================================================

export interface AuthState {
  user: User | null;
  isAnonymous: boolean;
  isLoading: boolean;
  /** True only during first initAuth() call — used by AppNavigator to avoid rendering before auth state is known */
  isInitializing: boolean;
  isAuthenticated: boolean;
  error: string | null;

  initAuth: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: (identityToken: string, nonce: string) => Promise<void>;
  linkWithGoogle: (idToken: string) => Promise<void>;
  linkWithApple: (identityToken: string, nonce: string) => Promise<void>;
  linkWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<string | void>;
  reauthenticateAndDelete: (credential: AuthCredential) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// Error Mapping
// ============================================================================

/** Reset all in-memory stores to their initial state.
 * Called on sign-out and account deletion to ensure no stale data survives.
 * Each reset is wrapped in try-catch so one store's failure doesn't block the rest. */
function resetAllStores(): void {
  const stores = [
    { name: 'progress', reset: () => useProgressStore.getState().reset() },
    { name: 'settings', reset: () => useSettingsStore.getState().reset() },
    { name: 'exercise', reset: () => useExerciseStore.getState().reset() },
    { name: 'catEvolution', reset: () => useCatEvolutionStore.getState().reset() },
    { name: 'gems', reset: () => useGemStore.getState().reset() },
    { name: 'achievements', reset: () => useAchievementStore.getState().reset() },
    { name: 'learnerProfile', reset: () => useLearnerProfileStore.getState().reset() },
    { name: 'songs', reset: () => useSongStore.getState().reset() },
    { name: 'social', reset: () => useSocialStore.getState().reset() },
    { name: 'league', reset: () => useLeagueStore.getState().reset() },
  ];

  for (const { name, reset } of stores) {
    try {
      reset();
    } catch (err) {
      console.warn(`[Auth] Failed to reset ${name} store:`, err);
    }
  }
}

function handleAuthError(error: unknown): string {
  const firebaseError = error as { code?: string; message?: string };
  const code = firebaseError.code ?? '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already associated with an account. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-not-found':
      return 'No account found with this email. Check your email or sign up.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support or try another method.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection and try again.';
    case 'auth/credential-already-in-use':
      return 'This credential is already linked to another account.';
    case 'auth/requires-recent-login':
      return 'For security, please sign in again before making this change.';
    default:
      return firebaseError.message ?? 'An unexpected error occurred. Please try again.';
  }
}

function shouldEnableLocalGuestMode(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? '';

  // These failures are common in dev/test builds where Firebase Auth may be
  // unavailable or anonymous auth is disabled. We still allow "Skip for now".
  return [
    'auth/operation-not-allowed',
    'auth/network-request-failed',
    'auth/invalid-api-key',
    'auth/app-not-authorized',
    'auth/internal-error',
    'auth/configuration-not-found',
    'auth/admin-restricted-operation',
    'auth/invalid-credential',
  ].includes(code);
}

function createLocalGuestUser(): User {
  return {
    uid: `local-guest-${Date.now()}`,
    email: null,
    displayName: 'Guest',
    isAnonymous: true,
    emailVerified: false,
    phoneNumber: null,
    photoURL: null,
    providerId: 'firebase',
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({
      token: '',
      expirationTime: '',
      authTime: '',
      issuedAtTime: '',
      signInProvider: null,
      signInSecondFactor: null,
      claims: {},
    }),
    reload: async () => {},
    toJSON: () => ({ uid: 'local-guest' }),
  } as unknown as User;
}

/**
 * Ensure social features are set up for a non-anonymous user:
 * 1. Check/assign league membership for the current week.
 * 2. Register a friend code if none exists locally.
 *
 * Runs as part of post-sign-in flow. Failures are logged but never block the UI.
 */
async function ensureSocialSetup(uid: string, displayName: string): Promise<void> {
  // League membership
  try {
    const { getCurrentLeagueMembership, assignToLeague } = require('../services/firebase/leagueService');
    let membership = await getCurrentLeagueMembership(uid);
    if (!membership) {
      const catId = useSettingsStore.getState().selectedCatId ?? 'mini-meowww';
      membership = await assignToLeague(uid, displayName, catId, 'bronze');
    }
    useLeagueStore.getState().setMembership(membership);
  } catch (err) {
    console.warn('[Social] League membership check failed:', err);
  }

  // Friend code
  try {
    if (!useSocialStore.getState().friendCode) {
      const { registerFriendCode } = require('../services/firebase/socialService');
      const code = await registerFriendCode(uid);
      useSocialStore.getState().setFriendCode(code);
    }
  } catch (err) {
    console.warn('[Social] Friend code registration failed:', err);
  }
}

/**
 * Trigger migration + remote pull after a non-anonymous sign-in.
 * Uses dynamic imports to avoid circular dependency (authStore → syncService → progressStore).
 * Runs asynchronously — errors are logged but don't block the UI.
 */
async function triggerPostSignInSync(): Promise<void> {
  try {
    const { migrateLocalToCloud } = require('../services/firebase/dataMigration');
    await migrateLocalToCloud();
  } catch (err) {
    console.warn('[Auth] Post-sign-in migration failed:', err);
  }
  try {
    const { syncManager } = require('../services/firebase/syncService');
    await syncManager.pullRemoteProgress();
    syncManager.startPeriodicSync();
  } catch (err) {
    console.warn('[Auth] Post-sign-in pull failed:', err);
  }

  // Set up social features (league membership + friend code)
  try {
    const authState = useAuthStore.getState();
    if (authState.user && !authState.isAnonymous) {
      await ensureSocialSetup(
        authState.user.uid,
        authState.user.displayName ?? 'Player',
      );
    }
  } catch (err) {
    console.warn('[Auth] Post-sign-in social setup failed:', err);
  }
}

// ============================================================================
// Store
// ============================================================================

// Track the onAuthStateChanged unsubscribe function to prevent listener leaks
let authUnsubscribe: (() => void) | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAnonymous: false,
  isLoading: false,
  isInitializing: true,
  isAuthenticated: false,
  error: null,

  initAuth: async () => {
    set({ isLoading: true, isInitializing: true, error: null });

    // If Firebase API keys are missing (standalone build without EAS secrets),
    // skip Firebase auth and enter offline guest mode.
    if (!firebaseAvailable) {
      console.warn('[Auth] Firebase API keys missing — entering offline guest mode');
      set({
        user: null,
        isAuthenticated: false,
        isAnonymous: false,
        isLoading: false,
        isInitializing: false,
        error: null,
      });
      return;
    }

    // Unsubscribe previous listener to prevent duplicates
    if (authUnsubscribe) {
      authUnsubscribe();
      authUnsubscribe = null;
    }

    return new Promise<void>((resolve) => {
      authUnsubscribe = onAuthStateChanged(auth, (user) => {
        set({
          user,
          isAuthenticated: user !== null,
          isAnonymous: user?.isAnonymous ?? false,
          isLoading: false,
          isInitializing: false,
          error: null,
        });
        resolve();
      });
    });
  },

  signInAnonymously: async () => {
    console.log('[Auth] signInAnonymously started');
    set({ isLoading: true, error: null });

    if (!firebaseAvailable) {
      console.warn('[Auth] Firebase not available — using local guest mode');
      const guestUser = createLocalGuestUser();
      set({ user: guestUser as any, isAuthenticated: true, isAnonymous: true, isLoading: false, error: null });
      return;
    }

    try {
      const result = await firebaseSignInAnonymously(auth);
      console.log('[Auth] signInAnonymously success, uid:', result.user.uid);
      set({
        user: result.user,
        isAuthenticated: true,
        isAnonymous: result.user.isAnonymous,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (shouldEnableLocalGuestMode(error)) {
        const guestUser = createLocalGuestUser();
        console.warn('[Auth] Anonymous auth unavailable, entering local guest mode.');
        set({
          user: guestUser,
          isAuthenticated: true,
          isAnonymous: true,
          isLoading: false,
          error: null,
        });
        return;
      }

      console.error('[Auth] signInAnonymously failed:', error);
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      set({
        user: result.user,
        isAuthenticated: true,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
      triggerPostSignInSync();
    } catch (error) {
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  signUpWithEmail: async (email: string, password: string, displayName: string) => {
    set({ isLoading: true, error: null });

    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      await createUserProfile(result.user.uid, { email, displayName });

      // Sync display name to settings store so ProfileScreen shows it
      try {
        const { useSettingsStore } = require('./settingsStore');
        useSettingsStore.getState().setDisplayName(displayName);
      } catch { /* settings sync is best-effort */ }

      set({
        user: result.user,
        isAuthenticated: true,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
      triggerPostSignInSync();
    } catch (error) {
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  signInWithGoogle: async (idToken: string) => {
    set({ isLoading: true, error: null });

    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);

      // Preserve custom display name: if user had a custom name in Firestore,
      // restore it (Google sign-in overwrites Auth displayName with Google's name)
      try {
        const profile = await getUserProfile(result.user.uid);
        if (profile?.displayName && profile.displayName !== result.user.displayName) {
          await updateProfile(result.user, { displayName: profile.displayName });
        } else if (!profile) {
          // First-time Google sign-in: create Firestore profile
          await createUserProfile(result.user.uid, {
            email: result.user.email ?? '',
            displayName: result.user.displayName ?? 'Learner',
          });
        }
      } catch {
        // Non-critical: display name restoration failure doesn't block sign-in
      }

      set({
        user: result.user,
        isAuthenticated: true,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
      triggerPostSignInSync();
    } catch (error) {
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  signInWithApple: async (identityToken: string, nonce: string) => {
    set({ isLoading: true, error: null });

    try {
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({ idToken: identityToken, rawNonce: nonce });
      const result = await signInWithCredential(auth, credential);

      set({
        user: result.user,
        isAuthenticated: true,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
      triggerPostSignInSync();
    } catch (error) {
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  linkWithGoogle: async (idToken: string) => {
    set({ isLoading: true, error: null });

    try {
      const { user } = get();
      if (!user) {
        set({ isLoading: false, error: 'No user is currently signed in.' });
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const result = await linkWithCredential(user, credential);

      set({
        user: result.user,
        isAuthenticated: true,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
      triggerPostSignInSync();
    } catch (error) {
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  linkWithApple: async (identityToken: string, nonce: string) => {
    set({ isLoading: true, error: null });

    try {
      const { user } = get();
      if (!user) {
        set({ isLoading: false, error: 'No user is currently signed in.' });
        return;
      }

      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({ idToken: identityToken, rawNonce: nonce });
      const result = await linkWithCredential(user, credential);

      set({
        user: result.user,
        isAuthenticated: true,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
      triggerPostSignInSync();
    } catch (error) {
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  linkWithEmail: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const { user } = get();
      if (!user) {
        set({ isLoading: false, error: 'No user is currently signed in.' });
        return;
      }

      const credential = EmailAuthProvider.credential(email, password);
      const result = await linkWithCredential(user, credential);

      set({
        user: result.user,
        isAuthenticated: true,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
      triggerPostSignInSync();
    } catch (error) {
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });

    let signOutSucceeded = false;
    try {
      await firebaseSignOut(auth);
      signOutSucceeded = true;

      cancelAllPendingSaves();
      await PersistenceManager.clearAll();
      resetAllStores();

      set({
        user: null,
        isAuthenticated: false,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      if (signOutSucceeded) {
        // Firebase sign-out worked but cleanup threw — force-clear state.
        // Leaving a stale user reference after sign-out is worse than the cleanup error.
        console.warn('[Auth] Post-signout cleanup failed, forcing state clear:', error);
        cancelAllPendingSaves();
        await PersistenceManager.clearAll().catch(() => {});
        resetAllStores();
        set({
          user: null,
          isAuthenticated: false,
          isAnonymous: false,
          isLoading: false,
          error: null,
        });
      } else {
        set({
          isLoading: false,
          error: handleAuthError(error),
        });
      }
    }
  },

  deleteAccount: async (): Promise<string | void> => {
    set({ isLoading: true, error: null });

    let authUserDeleted = false;
    try {
      const { user } = get();
      if (!user) {
        set({ isLoading: false, error: 'No user is currently signed in.' });
        return;
      }

      // 1. Delete Firestore data FIRST (while still authenticated).
      //    Security rules require a valid auth token, so this must happen
      //    before deleteUser() invalidates the token.
      try {
        await deleteUserData(user.uid);
      } catch (err) {
        console.warn('[Auth] Firestore cleanup failed (non-blocking):', err);
      }

      // 2. Delete the Firebase Auth user.
      //    If this throws auth/requires-recent-login, we return the sentinel.
      await deleteUser(user);
      authUserDeleted = true;

      // 3. Local cleanup — set auth state FIRST so navigation switches
      //    away from deep screens before stores are reset (prevents
      //    components from re-rendering with empty store data).
      set({
        user: null,
        isAuthenticated: false,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });

      cancelAllPendingSaves();
      await PersistenceManager.clearAll();
      resetAllStores();
    } catch (error) {
      const firebaseError = error as { code?: string };
      if (firebaseError.code === 'auth/requires-recent-login') {
        set({ isLoading: false, error: null });
        return 'REQUIRES_REAUTH';
      }

      if (authUserDeleted) {
        // Auth user is gone but cleanup threw — force-clear state.
        // Set auth state FIRST so navigation switches away from deep screens.
        set({
          user: null,
          isAuthenticated: false,
          isAnonymous: false,
          isLoading: false,
          error: null,
        });
        console.warn('[Auth] Post-delete cleanup failed, forcing state clear:', error);
        cancelAllPendingSaves();
        await PersistenceManager.clearAll().catch(() => {});
        resetAllStores();
        return;
      }

      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  reauthenticateAndDelete: async (credential: AuthCredential) => {
    set({ isLoading: true, error: null });

    let authUserDeleted = false;
    try {
      const { user } = get();
      if (!user) {
        set({ isLoading: false, error: 'No user is currently signed in.' });
        return;
      }

      await reauthenticateWithCredential(user, credential);

      // Delete Firestore data first (while re-authenticated), then auth user
      try {
        await deleteUserData(user.uid);
      } catch (err) {
        console.warn('[Auth] Firestore cleanup failed (non-blocking):', err);
      }

      await deleteUser(user);
      authUserDeleted = true;

      // Set auth state FIRST so navigation switches away from deep screens
      // before stores are reset (prevents stale component renders).
      set({
        user: null,
        isAuthenticated: false,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });

      cancelAllPendingSaves();
      await PersistenceManager.clearAll();
      resetAllStores();
    } catch (error) {
      if (authUserDeleted) {
        // Set auth state FIRST so navigation switches away from deep screens.
        set({
          user: null,
          isAuthenticated: false,
          isAnonymous: false,
          isLoading: false,
          error: null,
        });
        console.warn('[Auth] Post-delete cleanup failed, forcing state clear:', error);
        cancelAllPendingSaves();
        await PersistenceManager.clearAll().catch(() => {});
        resetAllStores();
        return;
      }

      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  sendPasswordReset: async (email: string) => {
    set({ isLoading: true, error: null });

    try {
      await sendPasswordResetEmail(auth, email);
      set({ isLoading: false, error: null });
    } catch (error) {
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  updateDisplayName: async (name: string) => {
    set({ isLoading: true, error: null });

    try {
      const { user } = get();
      if (!user) {
        set({ isLoading: false, error: 'No user is currently signed in.' });
        return;
      }

      await updateProfile(user, { displayName: name });

      // Persist to Firestore so it survives Google sign-in re-auth
      try {
        await updateUserProfile(user.uid, { displayName: name });
      } catch { /* Firestore sync is best-effort */ }

      // Sync to settings store so ProfileScreen shows updated name
      try {
        const { useSettingsStore } = require('./settingsStore');
        useSettingsStore.getState().setDisplayName(name);
      } catch { /* settings sync is best-effort */ }

      set({ isLoading: false, error: null });
    } catch (error) {
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
