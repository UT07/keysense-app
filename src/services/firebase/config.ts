/**
 * Firebase configuration and initialization
 * Initializes Firebase services: Auth, Firestore, Cloud Functions
 *
 * Auth uses initializeAuth with getReactNativePersistence(AsyncStorage) so that
 * the user session persists across app restarts (remember device).
 *
 * If Firebase API keys are missing (e.g. standalone build without EAS secrets),
 * Firebase is initialized with placeholder values. It won't crash at startup,
 * but all auth/Firestore operations will fail — caught by existing try/catch
 * handlers in authStore (which falls back to local guest mode).
 */

import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/logger';

// ============================================================================
// Firebase Config
// ============================================================================

/** True when real API keys are present (Metro dev server or EAS secrets). */
export const firebaseAvailable = Boolean(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY && process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
);

if (!firebaseAvailable) {
  logger.warn(
    '[Firebase] API keys missing — auth and cloud features unavailable. ' +
    'Set EXPO_PUBLIC_FIREBASE_* env vars or EAS secrets.',
  );
}

// Use real values when available, otherwise placeholders that let initializeApp()
// succeed without a module-load crash. Operations will fail at call time with
// errors caught by existing try/catch handlers.
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? 'placeholder-api-key',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? 'placeholder-project',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '1:000:ios:placeholder',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'placeholder.firebaseapp.com',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// ============================================================================
// Initialize Firebase
// ============================================================================

const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence so sessions survive app restarts.
// getReactNativePersistence is available from firebase/auth when bundled by Metro
// (the react-native condition in @firebase/auth/package.json exports it).
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');

// ============================================================================
// Emulator Setup (for local development)
// ============================================================================

let emulatorsConnected = false;

if (process.env.EXPO_PUBLIC_FIREBASE_EMULATOR === 'true' && !emulatorsConnected) {
  // Only connect once to avoid errors
  if (!auth.emulatorConfig) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  }
  connectFirestoreEmulator(db, 'localhost', 8080);
  emulatorsConnected = true;
  // Note: Functions emulator connection is environment-specific
  // For React Native/Expo, use different approach
}

// ============================================================================
// Export Firebase App Instance
// ============================================================================

export default app;
