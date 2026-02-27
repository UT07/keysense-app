/**
 * AuthScreen
 * First screen for unauthenticated users.
 * Offers Apple, Google, Email sign-in, and anonymous skip.
 *
 * - "Skip for now" calls signInAnonymously() with proper error handling
 * - Google/Apple sign-in show an alert if native SDKs are not configured
 * - Firebase Auth persistence ensures the session is remembered across restarts
 *
 * Visual: Cinematic intro with floating musical notes, shimmer app title,
 * Salsa coach at large scale, and enhanced auth buttons.
 */

import React, { useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';
import { SalsaCoach } from '../components/Mascot/SalsaCoach';
import { AnimatedGradientBackground } from '../components/common/AnimatedGradientBackground';
import { PressableScale } from '../components/common/PressableScale';
import { useAuthStore } from '../stores/authStore';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../theme/tokens';
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

// ---------------------------------------------------------------------------
// Floating Musical Note
// ---------------------------------------------------------------------------

interface FloatingNoteConfig {
  id: number;
  symbol: string;
  x: number;
  delay: number;
}

function FloatingNote({ config }: { config: FloatingNoteConfig }): React.ReactElement {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Start with delay, then loop: drift upward while fading in then out
    translateY.value = withDelay(
      config.delay,
      withRepeat(
        withTiming(-120, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1200, easing: Easing.out(Easing.ease) }),
          withTiming(0.6, { duration: 1600 }),
          withTiming(0, { duration: 1200, easing: Easing.in(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [config.delay, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text
      style={[
        styles.floatingNote,
        { left: config.x },
        animatedStyle,
      ]}
    >
      {config.symbol}
    </Animated.Text>
  );
}

// ---------------------------------------------------------------------------
// Shimmer Title
// ---------------------------------------------------------------------------

function ShimmerTitle(): React.ReactElement {
  const shimmerValue = useSharedValue(0.7);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.7, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [shimmerValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shimmerValue.value,
    textShadowColor: `rgba(255, 215, 0, ${shimmerValue.value * 0.6})`,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  }));

  return (
    <Animated.View entering={FadeIn.duration(800)}>
      <Animated.Text style={[styles.appName, animatedStyle]}>
        Purrrfect Keys
      </Animated.Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// AuthScreen
// ---------------------------------------------------------------------------

export function AuthScreen(): React.ReactElement {
  const navigation = useNavigation<AuthNavProp>();
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const signInAnonymously = useAuthStore((s) => s.signInAnonymously);
  const clearError = useAuthStore((s) => s.clearError);
  const { width: screenWidth } = useWindowDimensions();

  // Generate floating note configs
  const notes: FloatingNoteConfig[] = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        id: i,
        symbol: i % 2 === 0 ? '\u266A' : '\u266B',
        x: 20 + ((i * 60) % (Math.min(screenWidth, 400) - 40)),
        delay: i * 400,
      })),
    [screenWidth],
  );

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
    <AnimatedGradientBackground style={styles.container} testID="auth-screen">
      {/* Floating musical notes — decorative, non-interactive */}
      <View style={styles.floatingNotesContainer} pointerEvents="none">
        {notes.map((note) => (
          <FloatingNote key={note.id} config={note} />
        ))}
      </View>

      {/* Hero section: Salsa + App name + Tagline */}
      <Animated.View entering={FadeInUp.duration(600).delay(200)} style={styles.hero}>
        <View style={styles.salsaContainer}>
          <SalsaCoach mood="excited" size="large" />
        </View>
        <ShimmerTitle />
        <Text style={styles.tagline}>Learn piano. Grow cats.</Text>
        <Text style={styles.subtitle}>Sign in to save your progress across devices</Text>
      </Animated.View>

      {error && (
        <TouchableOpacity style={styles.errorBanner} onPress={clearError}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorDismiss}>Tap to dismiss</Text>
        </TouchableOpacity>
      )}

      {/* Auth buttons */}
      <Animated.View entering={FadeInDown.duration(500).delay(500)} style={styles.buttons}>
        {Platform.OS === 'ios' && (
          <PressableScale
            haptic
            onPress={handleAppleSignIn}
            disabled={isLoading}
            testID="apple-signin"
          >
            <View style={[styles.button, styles.appleButton]}>
              <MaterialCommunityIcons name="apple" size={22} color="#000000" style={styles.buttonIcon} />
              <Text style={[styles.buttonText, styles.appleButtonText]}>
                Continue with Apple
              </Text>
            </View>
          </PressableScale>
        )}

        <PressableScale
          haptic
          onPress={handleGoogleSignIn}
          disabled={isLoading}
          testID="google-signin"
        >
          <View style={[styles.button, styles.googleButton]}>
            <MaterialCommunityIcons name="google" size={22} color={COLORS.textPrimary} style={styles.buttonIcon} />
            <Text style={[styles.buttonText, styles.googleButtonText]}>
              Continue with Google
            </Text>
          </View>
        </PressableScale>

        <PressableScale
          haptic
          onPress={handleEmailNav}
          disabled={isLoading}
          testID="email-signin"
        >
          <View style={[styles.button, styles.emailButton]}>
            <MaterialCommunityIcons name="email-outline" size={22} color={COLORS.textPrimary} style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Continue with Email</Text>
          </View>
        </PressableScale>
      </Animated.View>

      <PressableScale
        onPress={handleSkip}
        disabled={isLoading}
        testID="skip-signin"
      >
        <View style={styles.skipButton}>
          {isLoading ? (
            <ActivityIndicator color={COLORS.textMuted} />
          ) : (
            <Text style={styles.skipText}>Skip for now</Text>
          )}
        </View>
      </PressableScale>
    </AnimatedGradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },

  // Floating musical notes overlay
  floatingNotesContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  floatingNote: {
    position: 'absolute',
    bottom: 80,
    fontSize: 28,
    color: COLORS.primary,
    opacity: 0, // initial; animated via Reanimated
  },

  // Hero section
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  salsaContainer: {
    transform: [{ scale: 2 }],
    marginBottom: SPACING.xl + SPACING.lg,
    marginTop: SPACING.lg,
  },
  appName: {
    ...TYPOGRAPHY.display.lg,
    fontSize: 38,
    color: COLORS.starGold,
    letterSpacing: 1,
    marginTop: SPACING.sm,
  },
  tagline: {
    ...TYPOGRAPHY.heading.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    letterSpacing: 0.5,
  },
  subtitle: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  // Error banner
  errorBanner: {
    backgroundColor: 'rgba(244, 67, 54, 0.12)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.25)',
  },
  errorText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '500' as const,
    color: COLORS.error,
  },
  errorDismiss: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },

  // Auth buttons
  buttons: {
    gap: SPACING.md,
  },
  button: {
    ...SHADOWS.md,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  buttonIcon: {
    marginRight: SPACING.sm,
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  appleButtonText: {
    color: '#000000',
  },
  googleButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.cardBorder,
  },
  googleButtonText: {
    color: COLORS.textPrimary,
  },
  emailButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight + '40',
  },
  buttonText: {
    ...TYPOGRAPHY.button.lg,
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },

  // Skip
  skipButton: {
    marginTop: SPACING.lg,
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  skipText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textMuted,
  },
});
