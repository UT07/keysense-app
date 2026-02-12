/**
 * Firebase Authentication Service
 * Handles user authentication for both email and Google OAuth
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  User,
  UserCredential,
} from 'firebase/auth';
import { auth } from './config';
import { db } from './config';
import { createUserProfile } from './firestore';

export class AuthService {
  /**
   * Create a new user account with email and password
   */
  static async signUpWithEmail(
    email: string,
    password: string,
    displayName: string
  ): Promise<UserCredential> {
    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Create user profile in Firestore
      await createUserProfile(userCredential.user.uid, {
        email,
        displayName,
        createdAt: new Date(),
      });

      return userCredential;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in with email and password
   */
  static async signInWithEmail(email: string, password: string): Promise<UserCredential> {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in with Google (for mobile, uses Google Sign-In plugin)
   * On native platforms, use @react-native-google-signin/google-signin
   */
  static async signInWithGoogle(idToken: string): Promise<UserCredential> {
    try {
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);

      // Create user profile if new user
      const userExists = await this.userProfileExists(userCredential.user.uid);
      if (!userExists) {
        await createUserProfile(userCredential.user.uid, {
          email: userCredential.user.email || '',
          displayName: userCredential.user.displayName || '',
          createdAt: new Date(),
        });
      }

      return userCredential;
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign out current user
   */
  static async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Get current authenticated user
   */
  static getCurrentUser(): User | null {
    return auth.currentUser;
  }

  /**
   * Check if user exists in Firestore
   */
  static async userProfileExists(uid: string): Promise<boolean> {
    const { doc, getDoc } = require('firebase/firestore');
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  }

  /**
   * Handle Firebase auth errors with user-friendly messages
   */
  private static handleAuthError(error: any): Error {
    const errorCode = error.code || '';
    let message = 'An authentication error occurred';

    switch (errorCode) {
      case 'auth/email-already-in-use':
        message = 'This email is already registered';
        break;
      case 'auth/weak-password':
        message = 'Password must be at least 6 characters';
        break;
      case 'auth/invalid-email':
        message = 'Please enter a valid email address';
        break;
      case 'auth/user-not-found':
        message = 'No account found with this email';
        break;
      case 'auth/wrong-password':
        message = 'Incorrect password';
        break;
      case 'auth/user-disabled':
        message = 'This account has been disabled';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed login attempts. Please try again later';
        break;
      case 'auth/operation-not-allowed':
        message = 'This sign-in method is not enabled';
        break;
    }

    return new Error(message);
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(email: string): Promise<void> {
    const { sendPasswordResetEmail } = require('firebase/auth');
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    const { updateProfile } = require('firebase/auth');
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }

    try {
      await updateProfile(user, updates);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Delete user account (requires recent authentication)
   */
  static async deleteAccount(): Promise<void> {
    const { deleteUser } = require('firebase/auth');
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('No authenticated user');
    }

    try {
      await deleteUser(user);
    } catch (error: any) {
      throw this.handleAuthError(error);
    }
  }
}
