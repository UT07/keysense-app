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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Cat3DCanvas } from '../components/Mascot/3d';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import { GoogleAuthProvider, OAuthProvider, EmailAuthProvider } from 'firebase/auth';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { logger } from '../utils/logger';

function isGoogleAuthAvailable(): boolean {
  try {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    return GoogleSignin != null && typeof GoogleSignin.signIn === 'function';
  } catch {
    return false;
  }
}

function isAppleAuthAvailable(): boolean {
  try {
    const AppleAuth = require('expo-apple-authentication');
    return AppleAuth.isAvailableAsync != null;
  } catch {
    return false;
  }
}

type AccountNavProp = NativeStackNavigationProp<RootStackParamList>;

export function AccountScreen(): React.ReactElement {
  const navigation = useNavigation<AccountNavProp>();
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

  const handleReauthAndDelete = useCallback(async () => {
    const reauthAndDelete = useAuthStore.getState().reauthenticateAndDelete;

    // Determine provider
    const providers = user?.providerData?.map(p => p.providerId) ?? [];

    if (providers.includes('google.com')) {
      try {
        if (!isGoogleAuthAvailable()) {
          Alert.alert('Error', 'Google Sign-In is not available.');
          return;
        }
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        await GoogleSignin.hasPlayServices();
        const response = await GoogleSignin.signIn();
        if (response.type === 'cancelled') return;
        const idToken = response.data?.idToken;
        if (!idToken) return;
        const credential = GoogleAuthProvider.credential(idToken);
        await reauthAndDelete(credential);
      } catch (err) {
        logger.warn('[AccountScreen] Google re-auth failed:', err);
        Alert.alert('Re-authentication Failed', 'Please try again.');
      }
    } else if (providers.includes('apple.com')) {
      try {
        if (!isAppleAuthAvailable()) {
          Alert.alert('Error', 'Apple Sign-In is not available.');
          return;
        }
        const AppleAuth = require('expo-apple-authentication');
        const crypto = require('expo-crypto');
        const rawNonce = Math.random().toString(36).substring(2, 18) + Math.random().toString(36).substring(2, 18);
        const hashedNonce = await crypto.digestStringAsync(
          crypto.CryptoDigestAlgorithm.SHA256,
          rawNonce
        );
        const cred = await AppleAuth.signInAsync({
          requestedScopes: [AppleAuth.AppleAuthenticationScope.EMAIL],
          nonce: hashedNonce,
        });
        if (cred.identityToken) {
          const provider = new OAuthProvider('apple.com');
          const credential = provider.credential({
            idToken: cred.identityToken,
            rawNonce,
          });
          await reauthAndDelete(credential);
        }
      } catch (err) {
        logger.warn('[AccountScreen] Apple re-auth failed:', err);
        Alert.alert('Re-authentication Failed', 'Please try again.');
      }
    } else if (providers.includes('password')) {
      Alert.prompt(
        'Re-authenticate',
        'Enter your password to confirm account deletion.',
        async (password) => {
          if (!password || !user?.email) return;
          const credential = EmailAuthProvider.credential(user.email, password);
          await reauthAndDelete(credential);
        },
        'secure-text'
      );
    } else {
      Alert.alert('Error', 'Unable to determine sign-in method for re-authentication.');
    }
  }, [user]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all progress, cats, and gems. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            const result = await authDeleteAccount();
            if (result === 'REQUIRES_REAUTH') {
              Alert.alert(
                'Verify Your Identity',
                'For security, you need to sign in one more time to confirm the deletion. Your account will be deleted immediately after.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign In to Delete', style: 'destructive', onPress: handleReauthAndDelete },
                ]
              );
            }
          },
        },
      ]
    );
  }, [authDeleteAccount, handleReauthAndDelete]);

  const handleSaveName = useCallback(async () => {
    if (newName.trim().length < 2) return;
    await authUpdateDisplayName(newName.trim());
    setIsEditingName(false);
  }, [newName, authUpdateDisplayName]);

  const handleLinkGoogle = useCallback(async () => {
    if (!isGoogleAuthAvailable()) {
      Alert.alert('Coming Soon', 'Google Sign-In is not yet configured for this build.');
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
        Alert.alert('Link Failed', 'No authentication token received. Please try again.');
        return;
      }
      await useAuthStore.getState().linkWithGoogle(idToken);
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === 'SIGN_IN_CANCELLED') return;
      logger.warn('[AccountScreen] Google link error:', err);
      Alert.alert('Link Failed', errObj.message ?? 'Google linking failed. Please try again.');
    }
  }, []);

  const handleLinkApple = useCallback(async () => {
    if (!isAppleAuthAvailable()) {
      Alert.alert('Coming Soon', 'Apple Sign-In is not yet configured for this build.');
      return;
    }

    try {
      const AppleAuth = require('expo-apple-authentication');
      const crypto = require('expo-crypto');
      // Generate a random raw nonce, then SHA256 hash it for Apple.
      // Firebase expects the RAW nonce; Apple receives the hash.
      const rawNonce = Math.random().toString(36).substring(2, 18) + Math.random().toString(36).substring(2, 18);
      const hashedNonce = await crypto.digestStringAsync(
        crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      const cred = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (cred.identityToken) {
        await useAuthStore.getState().linkWithApple(cred.identityToken, rawNonce);
      }
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string };
      if (errObj.code === 'ERR_REQUEST_CANCELED') return;
      logger.warn('[AccountScreen] Apple link error:', err);
      Alert.alert('Link Failed', errObj.message ?? 'Apple linking failed. Please try again.');
    }
  }, []);

  const selectedCatId = useSettingsStore((s) => s.selectedCatId);

  // Anonymous user → show account linking CTA
  if (isAnonymous) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} testID="account-screen">
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} testID="account-back">
          <Text style={styles.backText}>← Account</Text>
        </TouchableOpacity>

        <View style={styles.anonHero}>
          <Cat3DCanvas catId={selectedCatId ?? 'mini-meowww'} size={120} pose="idle" forceSVG />
          <Text style={styles.anonTitle}>Create an account to save your progress across devices!</Text>
        </View>

        <View style={styles.linkButtons}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.linkButton, styles.appleLink]}
              onPress={handleLinkApple}
              testID="account-link-apple"
            >
              <Text style={[styles.linkButtonText, { color: COLORS.background }]}>Link with Apple</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.linkButton, styles.googleLink]}
            onPress={handleLinkGoogle}
            testID="account-link-google"
          >
            <Text style={styles.linkButtonText}>Link with Google</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.linkButton, styles.emailLink]}
            onPress={() => navigation.navigate('EmailAuth', { isLinking: true })}
            testID="account-link-email"
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} testID="account-screen">
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} testID="account-back">
        <Text style={styles.backText}>← Account</Text>
      </TouchableOpacity>

      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.displayName ?? '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
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
        <TouchableOpacity
          style={styles.dangerRow}
          onPress={handleSignOut}
          disabled={isLoading}
          testID="account-signout"
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.error} />
          ) : (
            <Text style={styles.dangerText}>Sign Out</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dangerRow}
          onPress={handleDeleteAccount}
          disabled={isLoading}
          testID="account-delete"
        >
          <Text style={[styles.dangerText, styles.deleteText]}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: 60, paddingBottom: 40 },
  backButton: { marginBottom: SPACING.lg },
  backText: { ...TYPOGRAPHY.body.md, color: COLORS.primary, fontWeight: '600' },
  // Anonymous hero
  anonHero: { alignItems: 'center', marginBottom: SPACING.xl },
  anonTitle: { ...TYPOGRAPHY.body.lg, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.md, lineHeight: 26 },
  linkButtons: { gap: SPACING.sm + 4, marginBottom: SPACING.xl },
  linkButton: { height: 52, borderRadius: BORDER_RADIUS.lg, justifyContent: 'center', alignItems: 'center', ...SHADOWS.sm },
  appleLink: { backgroundColor: COLORS.textPrimary },
  googleLink: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.cardBorder },
  emailLink: { backgroundColor: COLORS.primary },
  linkButtonText: { ...TYPOGRAPHY.body.md, fontWeight: '700', color: COLORS.textPrimary },
  infoBox: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.cardBorder },
  infoTitle: { ...TYPOGRAPHY.body.md, color: COLORS.textPrimary, fontWeight: '600' },
  infoBody: { ...TYPOGRAPHY.body.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  // Authenticated
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.xl },
  profileInfo: { flex: 1 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', ...SHADOWS.sm },
  avatarText: { ...TYPOGRAPHY.heading.lg, color: COLORS.textPrimary },
  displayName: { ...TYPOGRAPHY.heading.lg, color: COLORS.textPrimary },
  email: { ...TYPOGRAPHY.body.sm, color: COLORS.textSecondary, marginTop: 2 },
  nameEdit: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  nameInput: { backgroundColor: COLORS.surface, color: COLORS.textPrimary, borderRadius: BORDER_RADIUS.sm, paddingHorizontal: SPACING.sm + 4, paddingVertical: 6, ...TYPOGRAPHY.body.md, minWidth: 150, borderWidth: 1, borderColor: COLORS.cardBorder },
  saveText: { ...TYPOGRAPHY.body.md, color: COLORS.primary, fontWeight: '600' },
  cancelText: { ...TYPOGRAPHY.body.md, color: COLORS.textMuted },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { ...TYPOGRAPHY.special.badge, color: COLORS.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: SPACING.sm },
  row: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  rowText: { ...TYPOGRAPHY.body.md, color: COLORS.textPrimary },
  rowAction: { ...TYPOGRAPHY.body.sm, color: COLORS.primary, fontWeight: '600' },
  dangerSection: { marginTop: SPACING.md },
  dangerRow: { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 83, 80, 0.15)' },
  dangerText: { ...TYPOGRAPHY.body.md, color: COLORS.error, fontWeight: '600' },
  deleteText: { color: COLORS.error },
  errorText: { ...TYPOGRAPHY.body.sm, color: COLORS.error, textAlign: 'center', marginBottom: SPACING.md },
});
