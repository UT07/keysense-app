/**
 * AuthScreen
 * First screen for unauthenticated users.
 * Offers Apple, Google, Email sign-in, and anonymous skip.
 *
 * - "Skip for now" calls signInAnonymously() with proper error handling
 * - Google/Apple sign-in show an alert if native SDKs are not configured
 * - Firebase Auth persistence ensures the session is remembered across restarts
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CatAvatar } from '../components/Mascot/CatAvatar';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import type { RootStackParamList } from '../navigation/AppNavigator';

type AuthNavProp = NativeStackNavigationProp<RootStackParamList>;

/**
 * Check whether the Apple Sign-In native module is available and functional.
 * Returns false when expo-apple-authentication is not installed or not linked.
 */
function isAppleAuthAvailable(): boolean {
  try {
    const AppleAuth = require('expo-apple-authentication');
    return AppleAuth.isAvailableAsync != null;
  } catch {
    return false;
  }
}

/**
 * Check whether the Google Sign-In native module is available and functional.
 * Returns false when @react-native-google-signin is not installed or not linked.
 */
function isGoogleAuthAvailable(): boolean {
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    return GoogleSignin != null && typeof GoogleSignin.signIn === 'function';
  } catch {
    return false;
  }
}

export function AuthScreen(): React.ReactElement {
  const navigation = useNavigation<AuthNavProp>();
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const signInAnonymously = useAuthStore((s) => s.signInAnonymously);
  const clearError = useAuthStore((s) => s.clearError);

  const handleAppleSignIn = useCallback(async () => {
    if (!isAppleAuthAvailable()) {
      Alert.alert(
        'Coming Soon',
        'Apple Sign-In is not yet configured for this build. Use email or skip for now.',
      );
      return;
    }

    try {
      const AppleAuth = require('expo-apple-authentication');
      const crypto = require('expo-crypto');

      // Generate a random raw nonce, then SHA256 hash it for Apple.
      // Firebase expects the RAW nonce as rawNonce; Apple receives the hash.
      const rawNonce = Math.random().toString(36).substring(2, 18) + Math.random().toString(36).substring(2, 18);
      const hashedNonce = await crypto.digestStringAsync(
        crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const appleCredential = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (appleCredential.identityToken) {
        await useAuthStore.getState().signInWithApple(appleCredential.identityToken, rawNonce);
      }
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === 'ERR_REQUEST_CANCELED') return;
      console.warn('[AuthScreen] Apple sign-in error:', err);
      Alert.alert('Sign-In Failed', errObj.message ?? 'Apple Sign-In failed. Please try again.');
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    if (!isGoogleAuthAvailable()) {
      Alert.alert(
        'Coming Soon',
        'Google Sign-In is not yet configured for this build. Use email or skip for now.',
      );
      return;
    }

    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      // v16 returns { type: 'success' | 'cancelled', data } instead of throwing
      if (response.type === 'cancelled') return;
      const idToken = response.data?.idToken;
      if (!idToken) {
        Alert.alert('Sign-In Failed', 'No authentication token received. Please try again.');
        return;
      }
      await useAuthStore.getState().signInWithGoogle(idToken);
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === 'SIGN_IN_CANCELLED') return;
      console.warn('[AuthScreen] Google sign-in error:', err);
      Alert.alert('Sign-In Failed', errObj.message ?? 'Google Sign-In failed. Please try again.');
    }
  }, []);

  const handleEmailNav = useCallback(() => {
    navigation.navigate('EmailAuth');
  }, [navigation]);

  const handleSkip = useCallback(async () => {
    await signInAnonymously();
    // If sign-in failed, show an Alert (the error banner is also set but
    // may be too subtle to notice on first try).
    const storeError = useAuthStore.getState().error;
    if (storeError) {
      Alert.alert('Could not skip', storeError);
    }
    // If it succeeded, isAuthenticated becomes true and AppNavigator
    // automatically navigates away from this screen.
  }, [signInAnonymously]);

  return (
    <View style={styles.container} testID="auth-screen">
      <View style={styles.hero}>
        <CatAvatar catId={useSettingsStore.getState().selectedCatId ?? 'mini-meowww'} size="large" showGlow />
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
            testID="apple-signin"
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
          testID="google-signin"
        >
          <Text style={[styles.buttonText, styles.googleButtonText]}>
            Continue with Google
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.emailButton]}
          onPress={handleEmailNav}
          disabled={isLoading}
          testID="email-signin"
        >
          <Text style={styles.buttonText}>Continue with Email</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.skipButton}
        onPress={handleSkip}
        disabled={isLoading}
        testID="skip-signin"
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
