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
    navigation.navigate('EmailAuth');
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
