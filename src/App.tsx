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
import { useLearnerProfileStore } from './stores/learnerProfileStore';
import { levelFromXp } from './core/progression/XpSystem';
import { syncManager } from './services/firebase/syncService';
import { migrateLocalToCloud } from './services/firebase/dataMigration';
import { hydrateGemStore } from './stores/gemStore';
import { hydrateCatEvolutionStore } from './stores/catEvolutionStore';
import { hydrateSongStore } from './stores/songStore';

// Configure Google Sign-In at module level (synchronous, must run before any signIn call)
// iosClientId is passed explicitly so the native module doesn't need GoogleService-Info.plist
// in the app bundle (avoids crash on dev client builds without the plist baked in).
try {
  const { GoogleSignin } = require('@react-native-google-signin/google-signin');
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (webClientId) {
    GoogleSignin.configure({
      webClientId,
      iosClientId: '619761780367-tqf3t4srqtkklkigep0clojvoailsteu.apps.googleusercontent.com',
    });
    console.log('[App] Google Sign-In configured');
  } else {
    console.warn('[App] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not set — Google Sign-In will not work');
  }
} catch {
  // Package not available (e.g. Expo Go) — Google Sign-In button will show "Coming Soon"
}

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync().catch(() => {
  // Catching errors in case SplashScreen is not available
});

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle != null) {
      clearTimeout(timeoutHandle);
    }
  }
}

export default function App(): React.ReactElement {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare(): Promise<void> {
      try {
        // ── Phase 1: Local hydration (fast, AsyncStorage only) ──────────
        // Runs BEFORE auth to ensure hasCompletedOnboarding, progress, and
        // learner profile are in the stores before any screen renders.

        // Hydrate settings state (onboarding flag, preferences, profile)
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

        // Hydrate progress state from AsyncStorage
        const savedProgress = await PersistenceManager.loadState(
          STORAGE_KEYS.PROGRESS,
          null
        );

        if (savedProgress) {
          const { totalXp, streakData, lessonProgress, dailyGoalData } =
            savedProgress as Record<string, unknown>;
          const xp = (totalXp as number) ?? 0;
          useProgressStore.setState({
            ...(totalXp != null ? { totalXp: xp } : {}),
            level: levelFromXp(xp),
            ...(streakData ? { streakData: streakData as any } : {}),
            ...(lessonProgress ? { lessonProgress: lessonProgress as any } : {}),
            ...(dailyGoalData ? { dailyGoalData: dailyGoalData as any } : {}),
          });
          console.log('[App] Progress state hydrated from storage (level', levelFromXp(xp), ')');
        }

        // Hydrate achievement state
        await useAchievementStore.getState().hydrate();
        console.log('[App] Achievement state hydrated from storage');

        // Hydrate full learner profile state (adaptive learning, note accuracy, skills, weak areas)
        const learnerData = await PersistenceManager.loadState(STORAGE_KEYS.LEARNER_PROFILE, null);
        if (learnerData) {
          const ld = learnerData as Record<string, unknown>;
          useLearnerProfileStore.setState({
            ...(ld.noteAccuracy ? { noteAccuracy: ld.noteAccuracy as Record<number, number> } : {}),
            ...(ld.noteAttempts ? { noteAttempts: ld.noteAttempts as Record<number, number> } : {}),
            ...(ld.skills ? { skills: ld.skills as any } : {}),
            ...(ld.tempoRange ? { tempoRange: ld.tempoRange as any } : {}),
            ...(ld.weakNotes ? { weakNotes: ld.weakNotes as number[] } : {}),
            ...(ld.weakSkills ? { weakSkills: ld.weakSkills as string[] } : {}),
            ...(ld.totalExercisesCompleted != null ? { totalExercisesCompleted: ld.totalExercisesCompleted as number } : {}),
            ...(ld.lastAssessmentDate ? { lastAssessmentDate: ld.lastAssessmentDate as string } : {}),
            ...(ld.assessmentScore != null ? { assessmentScore: ld.assessmentScore as number } : {}),
            ...(ld.masteredSkills ? { masteredSkills: ld.masteredSkills as string[] } : {}),
            ...(ld.skillMasteryData ? { skillMasteryData: ld.skillMasteryData as any } : {}),
            ...(ld.recentExerciseIds ? { recentExerciseIds: ld.recentExerciseIds as string[] } : {}),
          });
          const masteredCount = (ld.masteredSkills as string[] | undefined)?.length ?? 0;
          const noteCount = Object.keys(ld.noteAccuracy ?? {}).length;
          console.log(`[App] Learner profile fully hydrated (${masteredCount} mastered skills, ${noteCount} note records)`);
        }

        // Hydrate gem store (gem balance, transactions)
        await hydrateGemStore();
        console.log('[App] Gem store hydrated');

        // Hydrate cat evolution store (owned cats, evolution data, daily rewards)
        await hydrateCatEvolutionStore();
        console.log('[App] Cat evolution store hydrated');

        // Hydrate song store (mastery, recent songs, request counter)
        await hydrateSongStore();
        console.log('[App] Song store hydrated');

        // ── Phase 2: Firebase Auth (network, may be slow) ──────────────
        try {
          await withTimeout(useAuthStore.getState().initAuth(), 8000, 'initAuth');
        } catch (authInitError) {
          console.warn(
            '[App] Auth initialization did not resolve in time. Continuing with unauthenticated fallback.',
            authInitError,
          );
          useAuthStore.setState({
            user: null,
            isAnonymous: false,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }

        // Sync Firebase display name to settingsStore AFTER both hydration and auth.
        const authUser = useAuthStore.getState().user;
        if (authUser?.displayName) {
          useSettingsStore.getState().setDisplayName(authUser.displayName);
        }
      } catch (e) {
        console.warn('[App] Failed during app preparation:', e);
      } finally {
        // App is ready to render — local state is hydrated, auth resolved.
        setAppIsReady(true);
      }

      // ── Phase 3: Cloud sync (background, non-blocking) ──────────────
      // Runs AFTER setAppIsReady so it doesn't delay the splash screen.
      try {
        const authState = useAuthStore.getState();
        if (authState.isAuthenticated) {
          syncManager.startPeriodicSync();
          console.log('[App] Periodic sync started');
        }

        if (authState.isAuthenticated && !authState.isAnonymous) {
          try {
            const migrationResult = await migrateLocalToCloud();
            if (migrationResult.migrated) {
              console.log('[App] Local data migrated to cloud');
            }
          } catch (err) {
            console.warn('[App] Migration failed:', err);
          }

          try {
            const pullResult = await syncManager.pullRemoteProgress();
            if (pullResult.merged) {
              console.log('[App] Remote progress merged into local state');
            } else if (pullResult.pulled) {
              console.log('[App] Remote progress checked — no new data');
            }
          } catch (err) {
            console.warn('[App] Remote progress pull failed:', err);
          }
        }
      } catch (e) {
        console.warn('[App] Cloud sync error (non-blocking):', e);
      }
    }

    // Failsafe: Force app ready after 5s if auth/hydration hangs
    const failsafeTimeout = setTimeout(() => {
      console.warn('[App] Hydration took too long, forcing app ready');
      setAppIsReady(true);
    }, 5000);

    prepare().then(() => clearTimeout(failsafeTimeout));

    // Lock all screens to portrait by default.
    // ExercisePlayer overrides to landscape on mount and restores portrait on unmount.
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
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
