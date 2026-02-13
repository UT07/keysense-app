/**
 * Main App component
 * Entry point for the KeySense application
 */

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './navigation/AppNavigator';
import { PersistenceManager, STORAGE_KEYS } from './stores/persistence';
import { useProgressStore } from './stores/progressStore';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync().catch(() => {
  // Catching errors in case SplashScreen is not available
});

export default function App(): React.ReactElement {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare(): Promise<void> {
      try {
        // Hydrate progress state from AsyncStorage
        const savedProgress = await PersistenceManager.loadState(
          STORAGE_KEYS.PROGRESS,
          null
        );

        if (savedProgress) {
          // Merge saved data into the store (only data fields, not actions)
          const { totalXp, level, streakData, lessonProgress, dailyGoalData } =
            savedProgress as Record<string, unknown>;
          useProgressStore.setState({
            ...(totalXp != null ? { totalXp: totalXp as number } : {}),
            ...(level != null ? { level: level as number } : {}),
            ...(streakData ? { streakData: streakData as any } : {}),
            ...(lessonProgress ? { lessonProgress: lessonProgress as any } : {}),
            ...(dailyGoalData ? { dailyGoalData: dailyGoalData as any } : {}),
          });
          console.log('[App] Progress state hydrated from storage');
        }
      } catch (e) {
        console.warn('[App] Failed to hydrate progress state:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
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
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppContent(): React.ReactElement {
  return (
    <AppNavigator />
  );
}
