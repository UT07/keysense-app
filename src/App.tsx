/**
 * Main App component
 * Entry point for the Purrrfect Keys application
 */

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as ScreenOrientation from 'expo-screen-orientation';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './navigation/AppNavigator';
import { PersistenceManager, STORAGE_KEYS } from './stores/persistence';
import { useProgressStore } from './stores/progressStore';
import { useSettingsStore } from './stores/settingsStore';
import { useAuthStore } from './stores/authStore';
import { useAchievementStore } from './stores/achievementStore';
import { levelFromXp } from './core/progression/XpSystem';
import { syncManager } from './services/firebase/syncService';
import { migrateLocalToCloud } from './services/firebase/dataMigration';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync().catch(() => {
  // Catching errors in case SplashScreen is not available
});

export default function App(): React.ReactElement {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare(): Promise<void> {
      try {
        // Initialize Firebase Auth (resolves current user state)
        await useAuthStore.getState().initAuth();

        // Hydrate progress state from AsyncStorage
        const savedProgress = await PersistenceManager.loadState(
          STORAGE_KEYS.PROGRESS,
          null
        );

        if (savedProgress) {
          // Merge saved data into the store (only data fields, not actions)
          const { totalXp, streakData, lessonProgress, dailyGoalData } =
            savedProgress as Record<string, unknown>;
          const xp = (totalXp as number) ?? 0;
          useProgressStore.setState({
            ...(totalXp != null ? { totalXp: xp } : {}),
            // Always recalculate level from XP (fixes stale persisted level)
            level: levelFromXp(xp),
            ...(streakData ? { streakData: streakData as any } : {}),
            ...(lessonProgress ? { lessonProgress: lessonProgress as any } : {}),
            ...(dailyGoalData ? { dailyGoalData: dailyGoalData as any } : {}),
          });
          console.log('[App] Progress state hydrated from storage (level', levelFromXp(xp), ')');
        }

        // Hydrate settings state (onboarding, preferences, profile)
        const savedSettings = await PersistenceManager.loadState(STORAGE_KEYS.SETTINGS, null);
        if (savedSettings) {
          const {
            hasCompletedOnboarding, experienceLevel, learningGoal,
            dailyGoalMinutes, masterVolume, displayName, avatarEmoji, selectedCatId,
            soundEnabled, hapticEnabled, metronomeVolume, keyboardVolume,
            showFingerNumbers, showNoteNames, preferredHand, darkMode, showTutorials,
            lastMidiDeviceId, lastMidiDeviceName, autoConnectMidi,
          } = savedSettings as Record<string, unknown>;
          useSettingsStore.setState({
            ...(hasCompletedOnboarding != null ? { hasCompletedOnboarding: hasCompletedOnboarding as boolean } : {}),
            ...(experienceLevel ? { experienceLevel: experienceLevel as 'beginner' | 'intermediate' | 'returning' } : {}),
            ...(learningGoal ? { learningGoal: learningGoal as 'songs' | 'technique' | 'exploration' } : {}),
            ...(dailyGoalMinutes != null ? { dailyGoalMinutes: dailyGoalMinutes as number } : {}),
            ...(masterVolume != null ? { masterVolume: masterVolume as number } : {}),
            ...(displayName ? { displayName: displayName as string } : {}),
            ...(avatarEmoji ? { avatarEmoji: avatarEmoji as string } : {}),
            ...(selectedCatId ? { selectedCatId: selectedCatId as string } : {}),
            ...(soundEnabled != null ? { soundEnabled: soundEnabled as boolean } : {}),
            ...(hapticEnabled != null ? { hapticEnabled: hapticEnabled as boolean } : {}),
            ...(metronomeVolume != null ? { metronomeVolume: metronomeVolume as number } : {}),
            ...(keyboardVolume != null ? { keyboardVolume: keyboardVolume as number } : {}),
            ...(showFingerNumbers != null ? { showFingerNumbers: showFingerNumbers as boolean } : {}),
            ...(showNoteNames != null ? { showNoteNames: showNoteNames as boolean } : {}),
            ...(preferredHand ? { preferredHand: preferredHand as 'right' | 'left' | 'both' } : {}),
            ...(darkMode != null ? { darkMode: darkMode as boolean } : {}),
            ...(showTutorials != null ? { showTutorials: showTutorials as boolean } : {}),
            ...(lastMidiDeviceId !== undefined ? { lastMidiDeviceId: lastMidiDeviceId as string | null } : {}),
            ...(lastMidiDeviceName !== undefined ? { lastMidiDeviceName: lastMidiDeviceName as string | null } : {}),
            ...(autoConnectMidi != null ? { autoConnectMidi: autoConnectMidi as boolean } : {}),
          });
          console.log('[App] Settings state hydrated from storage (onboarding:', hasCompletedOnboarding, ')');
        }

        // Sync Firebase display name to settingsStore AFTER hydration.
        // MUST happen after settings hydration — otherwise setDisplayName's
        // debounced save captures default state (hasCompletedOnboarding: false)
        // and overwrites the hydrated value 500ms later.
        const authUser = useAuthStore.getState().user;
        if (authUser?.displayName) {
          useSettingsStore.getState().setDisplayName(authUser.displayName);
        }

        // Hydrate achievement state
        await useAchievementStore.getState().hydrate();
        console.log('[App] Achievement state hydrated from storage');

        // Start periodic cloud sync (every 5 minutes) if user is authenticated
        const authState = useAuthStore.getState();
        if (authState.isAuthenticated) {
          syncManager.startPeriodicSync();
          console.log('[App] Periodic sync started');
        }

        // Migrate local progress to cloud on first non-anonymous sign-in
        if (authState.isAuthenticated && !authState.isAnonymous) {
          migrateLocalToCloud().then((result) => {
            if (result.migrated) {
              console.log('[App] Local data migrated to cloud');
            }
          });
        }
      } catch (e) {
        console.warn('[App] Failed to hydrate progress state:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();

    // Lock all screens to portrait by default.
    // ExercisePlayer overrides to landscape on mount and restores portrait on unmount.
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync().catch(() => {
        // Catching errors in case SplashScreen is not available
      });
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return <></>;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppContent />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppContent(): React.ReactElement {
  return (
    <AppNavigator />
  );
}
