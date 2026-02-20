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
import { CatAvatar } from '../components/Mascot/CatAvatar';
import { useSettingsStore } from '../stores/settingsStore';
import { useAuthStore } from '../stores/authStore';
import type { RootStackParamList } from '../navigation/AppNavigator';

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
      console.warn('[AccountScreen] Google link error:', err);
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
      console.warn('[AccountScreen] Apple link error:', err);
      Alert.alert('Link Failed', errObj.message ?? 'Apple linking failed. Please try again.');
    }
  }, []);

  // Anonymous user → show account linking CTA
  if (isAnonymous) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} testID="account-screen">
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} testID="account-back">
          <Text style={styles.backText}>← Account</Text>
        </TouchableOpacity>

        <View style={styles.anonHero}>
          <CatAvatar catId={useSettingsStore.getState().selectedCatId ?? 'mini-meowww'} size="large" />
          <Text style={styles.anonTitle}>Create an account to save your progress across devices!</Text>
        </View>

        <View style={styles.linkButtons}>
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.linkButton, styles.appleLink]}
              onPress={handleLinkApple}
              testID="account-link-apple"
            >
              <Text style={[styles.linkButtonText, { color: '#000' }]}>Link with Apple</Text>
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
            <ActivityIndicator color="#FF6B6B" />
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
  profileInfo: { flex: 1 },
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
