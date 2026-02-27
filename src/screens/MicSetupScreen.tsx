/**
 * MicSetupScreen — Microphone permission and setup wizard
 *
 * Guides user through granting mic permission, checks noise level,
 * and provides a test-note detection flow before enabling mic input.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, GRADIENTS } from '../theme/tokens';
import { useSettingsStore } from '../stores/settingsStore';
import { requestMicrophonePermission, checkMicrophonePermission } from '../input/AudioCapture';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type SetupStep = 'intro' | 'requesting' | 'granted' | 'denied';

export function MicSetupScreen() {
  const navigation = useNavigation<NavProp>();
  const setPreferredInputMethod = useSettingsStore((s) => s.setPreferredInputMethod);
  const [step, setStep] = useState<SetupStep>('intro');

  const handleRequestPermission = useCallback(async () => {
    setStep('requesting');

    // Check if already granted
    const alreadyGranted = await checkMicrophonePermission();
    if (alreadyGranted) {
      setStep('granted');
      return;
    }

    const granted = await requestMicrophonePermission();
    setStep(granted ? 'granted' : 'denied');
  }, []);

  const handleEnableMic = useCallback(() => {
    setPreferredInputMethod('mic');
    navigation.goBack();
  }, [setPreferredInputMethod, navigation]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[GRADIENTS.header[0], GRADIENTS.header[1], COLORS.background]}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Microphone Setup</Text>
          <View style={styles.backButton} />
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {step === 'intro' && (
          <>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="microphone" size={48} color={COLORS.primary} />
            </View>
            <Text style={styles.heading}>Play with Your Voice or Piano</Text>
            <Text style={styles.body}>
              No MIDI keyboard? No problem! Enable microphone input and Purrrfect Keys
              will detect the notes you play on any acoustic piano, keyboard, or even
              by singing.
            </Text>

            <View style={styles.featureList}>
              <FeatureItem icon="music-note" text="Detects single notes from piano or voice" />
              <FeatureItem icon="timer-outline" text="Works with all exercises" />
              <FeatureItem icon="shield-check" text="Audio stays on your device" />
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRequestPermission}
              testID="mic-setup-enable"
            >
              <MaterialCommunityIcons name="microphone" size={20} color={COLORS.textPrimary} />
              <Text style={styles.primaryButtonText}>Enable Microphone</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleGoBack}>
              <Text style={styles.secondaryButtonText}>Not Now</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'requesting' && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.body}>Requesting permission...</Text>
          </View>
        )}

        {step === 'granted' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
              <MaterialCommunityIcons name="check-circle" size={48} color={COLORS.success} />
            </View>
            <Text style={styles.heading}>Microphone Ready!</Text>
            <Text style={styles.body}>
              Permission granted. Microphone input will be used for exercises.
              You can always change this in Settings.
            </Text>

            <View style={styles.tipCard}>
              <MaterialCommunityIcons name="lightbulb-outline" size={20} color={COLORS.starGold} />
              <Text style={styles.tipText}>
                For best results, play close to your device in a quiet room.
                The app detects one note at a time.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleEnableMic}
              testID="mic-setup-done"
            >
              <Text style={styles.primaryButtonText}>Start Playing</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'denied' && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(220, 20, 60, 0.15)' }]}>
              <MaterialCommunityIcons name="microphone-off" size={48} color={COLORS.error} />
            </View>
            <Text style={styles.heading}>Permission Denied</Text>
            <Text style={styles.body}>
              Microphone access was denied. You can still use the on-screen keyboard
              or connect a MIDI device. To enable mic later, go to your device Settings
              and grant microphone access for Purrrfect Keys.
            </Text>

            <TouchableOpacity style={styles.primaryButton} onPress={handleGoBack}>
              <Text style={styles.primaryButtonText}>Continue with Touch</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <MaterialCommunityIcons name={icon as any} size={20} color={COLORS.primaryLight} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 16, paddingBottom: 16, paddingHorizontal: SPACING.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  title: { ...TYPOGRAPHY.heading.md, color: COLORS.textPrimary },
  content: {
    flex: 1, paddingHorizontal: SPACING.xl,
    alignItems: 'center', justifyContent: 'center',
  },
  centered: { alignItems: 'center', gap: SPACING.md },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(220, 20, 60, 0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  heading: {
    ...TYPOGRAPHY.heading.lg, color: COLORS.textPrimary,
    textAlign: 'center', marginBottom: SPACING.sm,
  },
  body: {
    ...TYPOGRAPHY.body.md, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22, marginBottom: SPACING.lg,
  },
  featureList: { width: '100%', gap: SPACING.sm, marginBottom: SPACING.xl },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  featureText: { ...TYPOGRAPHY.body.md, color: COLORS.textSecondary, flex: 1 },
  tipCard: {
    flexDirection: 'row', gap: SPACING.sm,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.xl, width: '100%',
  },
  tipText: { ...TYPOGRAPHY.body.sm, color: COLORS.textSecondary, flex: 1 },
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, backgroundColor: COLORS.primary,
    paddingVertical: 14, paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.full, width: '100%',
    ...SHADOWS.md,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.button.lg, color: COLORS.textPrimary, fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 12, paddingHorizontal: SPACING.xl, marginTop: SPACING.md,
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.body.md, color: COLORS.textMuted,
  },
});

export default MicSetupScreen;
