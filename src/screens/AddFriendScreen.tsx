/**
 * AddFriendScreen — Friend code display + entry
 *
 * Top: Shows user's own 6-char friend code with Copy/Share actions
 * Bottom: Text input to enter a friend's code and send a request
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { useSettingsStore } from '../stores/settingsStore';
import {
  registerFriendCode,
  lookupFriendCode,
  sendFriendRequest,
  getUserPublicProfile,
} from '../services/firebase/socialService';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ---------------------------------------------------------------------------
// Clipboard helper — expo-clipboard is optional
// ---------------------------------------------------------------------------

let ClipboardModule: { setStringAsync: (s: string) => Promise<boolean> } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ClipboardModule = require('expo-clipboard');
} catch {
  ClipboardModule = null;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (ClipboardModule?.setStringAsync) {
      await ClipboardModule.setStringAsync(text);
      return true;
    }
    // Fallback: use Share sheet which also lets user copy
    await Share.share({ message: text });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddFriendScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const isAnonymous = useAuthStore((s) => s.isAnonymous);
  const friendCode = useSocialStore((s) => s.friendCode);
  const setFriendCode = useSocialStore((s) => s.setFriendCode);
  const friends = useSocialStore((s) => s.friends);
  const addFriend = useSocialStore((s) => s.addFriend);
  const displayName = useSettingsStore((s) => s.displayName);
  const selectedCatId = useSettingsStore((s) => s.selectedCatId);

  const [inputCode, setInputCode] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLooking, setIsLooking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth gate: anonymous users cannot use friend codes
  if (isAnonymous) {
    return (
      <SafeAreaView style={styles.container} testID="add-friend-screen">
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="add-friend-back"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Friend</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.authGateContainer}>
          <MaterialCommunityIcons name="account-lock" size={64} color={COLORS.textMuted} />
          <Text style={styles.authGateTitle}>Sign In Required</Text>
          <Text style={styles.authGateSubtitle}>
            Sign in to generate your friend code and add friends.
          </Text>
          <TouchableOpacity
            style={styles.authGateButton}
            onPress={() => navigation.navigate('Auth')}
          >
            <Text style={styles.authGateButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Register friend code on mount if not yet set
  useEffect(() => {
    if (!friendCode && user?.uid) {
      setIsRegistering(true);
      registerFriendCode(user.uid)
        .then((code) => {
          setFriendCode(code);
        })
        .catch(() => {
          setError('Failed to generate your friend code. Try again later.');
        })
        .finally(() => setIsRegistering(false));
    }
  }, [friendCode, user?.uid, setFriendCode]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!friendCode) return;
    const ok = await copyToClipboard(friendCode);
    if (ok) {
      setCopied(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [friendCode]);

  const handleShare = useCallback(async () => {
    if (!friendCode) return;
    try {
      await Share.share({
        message: `Add me on Purrrfect Keys! My friend code is: ${friendCode}`,
      });
    } catch {
      // User cancelled or error — no action needed
    }
  }, [friendCode]);

  const handleAddFriend = useCallback(async () => {
    const code = inputCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError('Friend codes are 6 characters long.');
      return;
    }

    if (code === friendCode) {
      setError("That's your own code!");
      return;
    }

    if (!user?.uid) {
      setError('You must be signed in to add friends.');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLooking(true);

    try {
      const friendUid = await lookupFriendCode(code);
      if (!friendUid) {
        setError('No user found with that code. Double-check and try again.');
        setIsLooking(false);
        return;
      }

      // Check if already friends or pending
      const existing = friends.find((f) => f.uid === friendUid);
      if (existing) {
        if (existing.status === 'accepted') {
          setError('You are already friends!');
        } else {
          setError('A friend request is already pending.');
        }
        setIsLooking(false);
        return;
      }

      // Fetch the friend's profile to get their display name and cat
      const friendProfile = await getUserPublicProfile(friendUid);
      const friendDisplayName = friendProfile?.displayName || 'Player';
      const friendCatId = friendProfile?.selectedCatId || '';

      await sendFriendRequest(
        user.uid,
        friendUid,
        displayName || 'Player',
        selectedCatId,
        friendDisplayName,
        friendCatId,
      );

      // Add to local store with actual profile data
      addFriend({
        uid: friendUid,
        displayName: friendDisplayName,
        selectedCatId: friendCatId,
        status: 'pending_outgoing',
        connectedAt: Date.now(),
      });

      setSuccess('Friend request sent!');
      setInputCode('');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLooking(false);
    }
  }, [inputCode, friendCode, user?.uid, friends, addFriend, displayName, selectedCatId]);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container} testID="add-friend-screen">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="add-friend-back"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Friend</Text>
          <View style={styles.backButton} />
        </View>

        {/* Your Code Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Friend Code</Text>
          <Text style={styles.sectionSubtitle}>
            Share this code so friends can find you
          </Text>

          <View style={styles.codeCard}>
            {isRegistering ? (
              <ActivityIndicator color={COLORS.primary} size="large" />
            ) : friendCode ? (
              <Text style={styles.codeText}>{friendCode}</Text>
            ) : (
              <Text style={styles.codeTextMuted}>------</Text>
            )}
          </View>

          <View style={styles.codeActions}>
            <TouchableOpacity
              style={[styles.actionButton, copied && styles.actionButtonActive]}
              onPress={handleCopy}
              disabled={!friendCode}
            >
              <MaterialCommunityIcons
                name={copied ? 'check' : 'content-copy'}
                size={18}
                color={copied ? COLORS.success : COLORS.textPrimary}
              />
              <Text style={[styles.actionButtonText, copied && styles.actionButtonTextActive]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleShare}
              disabled={!friendCode}
            >
              <MaterialCommunityIcons name="share-variant" size={18} color={COLORS.textPrimary} />
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Add Friend Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add a Friend</Text>
          <Text style={styles.sectionSubtitle}>
            Enter their 6-character friend code
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputCode}
              onChangeText={(text) => {
                setInputCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                setError(null);
                setSuccess(null);
              }}
              placeholder="ABCDEF"
              placeholderTextColor={COLORS.textMuted}
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleAddFriend}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.addButton,
              (inputCode.length < 6 || isLooking) && styles.addButtonDisabled,
            ]}
            onPress={handleAddFriend}
            disabled={inputCode.length < 6 || isLooking}
          >
            {isLooking ? (
              <ActivityIndicator color={COLORS.textPrimary} size="small" />
            ) : (
              <Text style={styles.addButtonText}>Add Friend</Text>
            )}
          </TouchableOpacity>

          {error && (
            <View style={styles.messageBanner}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.messageBanner}>
              <MaterialCommunityIcons name="check-circle-outline" size={16} color={COLORS.success} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.heading.md,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  codeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    ...SHADOWS.md,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 8,
  },
  codeTextMuted: {
    fontFamily: 'monospace',
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 8,
  },
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionButtonActive: {
    borderColor: COLORS.success,
  },
  actionButtonText: {
    ...TYPOGRAPHY.button.md,
    color: COLORS.textPrimary,
  },
  actionButtonTextActive: {
    color: COLORS.success,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  inputRow: {
    marginBottom: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    color: COLORS.textPrimary,
    fontFamily: 'monospace',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 6,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    ...TYPOGRAPHY.button.lg,
    color: COLORS.textPrimary,
  },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.sm,
  },
  errorText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.error,
    flex: 1,
  },
  successText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.success,
    flex: 1,
  },
  // Auth gate for anonymous users
  authGateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  authGateTitle: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  authGateSubtitle: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  authGateButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
  },
  authGateButtonText: {
    ...TYPOGRAPHY.button.lg,
    color: COLORS.textPrimary,
  },
});
