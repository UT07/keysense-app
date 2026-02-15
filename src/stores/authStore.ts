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
  signOut as firebaseSignOut,
  deleteUser,
  updateProfile,
  sendPasswordResetEmail,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../services/firebase/config';
import { createUserProfile, deleteUserData } from '../services/firebase/firestore';
import { PersistenceManager } from './persistence';

// ============================================================================
// Types
// ============================================================================

export interface AuthState {
  user: User | null;
  isAnonymous: boolean;
  isLoading: boolean;
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
  deleteAccount: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// Error Mapping
// ============================================================================

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
    case 'auth/credential-already-in-use':
      return 'This credential is already linked to another account.';
    case 'auth/requires-recent-login':
      return 'For security, please sign in again before making this change.';
    default:
      return firebaseError.message ?? 'An unexpected error occurred. Please try again.';
  }
}

// ============================================================================
// Store
// ============================================================================

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAnonymous: false,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  initAuth: async () => {
    set({ isLoading: true, error: null });

    return new Promise<void>((resolve) => {
      onAuthStateChanged(auth, (user) => {
        set({
          user,
          isAuthenticated: user !== null,
          isAnonymous: user?.isAnonymous ?? false,
          isLoading: false,
          error: null,
        });
        resolve();
      });
    });
  },

  signInAnonymously: async () => {
    set({ isLoading: true, error: null });

    try {
      const result = await firebaseSignInAnonymously(auth);
      set({
        user: result.user,
        isAuthenticated: true,
        isAnonymous: result.user.isAnonymous,
        isLoading: false,
        error: null,
      });
    } catch (error) {
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

      set({
        user: result.user,
        isAuthenticated: true,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
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

      set({
        user: result.user,
        isAuthenticated: true,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
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
    } catch (error) {
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });

    try {
      await firebaseSignOut(auth);
      await PersistenceManager.clearAll();

      set({
        user: null,
        isAuthenticated: false,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: handleAuthError(error),
      });
    }
  },

  deleteAccount: async () => {
    set({ isLoading: true, error: null });

    try {
      const { user } = get();
      if (!user) {
        set({ isLoading: false, error: 'No user is currently signed in.' });
        return;
      }

      await deleteUserData(user.uid);
      await deleteUser(user);
      await PersistenceManager.clearAll();

      set({
        user: null,
        isAuthenticated: false,
        isAnonymous: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
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
