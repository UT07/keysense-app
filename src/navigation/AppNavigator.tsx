/**
 * Main App Navigation
 * Sets up the navigation structure for Purrrfect Keys
 * Auth flow → Onboarding → Main app
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { ExercisePlayer } from '../screens/ExercisePlayer/ExercisePlayer';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { MidiSetupScreen } from '../screens/MidiSetupScreen';
import { MicSetupScreen } from '../screens/MicSetupScreen';
import { LevelMapScreen } from '../screens/LevelMapScreen';
import { PlayScreen } from '../screens/PlayScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { EmailAuthScreen } from '../screens/EmailAuthScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { TierIntroScreen } from '../screens/TierIntroScreen';
import { CatSwitchScreen } from '../screens/CatSwitchScreen';
import { SkillAssessmentScreen } from '../screens/SkillAssessmentScreen';
import { DailySessionScreen } from '../screens/DailySessionScreen';
import { SongLibraryScreen } from '../screens/SongLibraryScreen';
import { SongPlayerScreen } from '../screens/SongPlayerScreen';
import { SocialScreen } from '../screens/SocialScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { AddFriendScreen } from '../screens/AddFriendScreen';
import { CatStudioScreen } from '../screens/CatStudioScreen';
// Navigation
import { CustomTabBar } from './CustomTabBar';

// Stores
import { useAuthStore } from '../stores/authStore';

// Types
export type RootStackParamList = {
  Auth: undefined;
  EmailAuth: { isLinking?: boolean } | undefined;
  Onboarding: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Exercise: {
    exerciseId: string;
    testMode?: boolean;
    aiMode?: boolean;
    skillId?: string;
    freePlayContext?: {
      detectedKey: string | null;
      suggestedDrillType: string;
      weakNotes: number[];
    };
  };
  TierIntro: { tier: number; locked?: boolean };
  SkillAssessment: undefined;
  DailySession: undefined;
  LevelMap: undefined;
  FreePlay: undefined;
  MidiSetup: undefined;
  MicSetup: undefined;
  Account: undefined;
  CatSwitch: undefined;
  SongPlayer: { songId: string };
  Leaderboard: undefined;
  Friends: undefined;
  AddFriend: undefined;
  CatStudio: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Learn: undefined;
  Songs: undefined;
  Social: undefined;
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Main tab navigator (Home, Learn, Songs, Social, Profile)
 */
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarButtonTestID: 'tab-home' }}
      />
      <Tab.Screen
        name="Learn"
        component={LevelMapScreen}
        options={{ tabBarButtonTestID: 'tab-learn' }}
      />
      <Tab.Screen
        name="Songs"
        component={SongLibraryScreen}
        options={{ tabBarButtonTestID: 'tab-songs' }}
      />
      <Tab.Screen
        name="Social"
        component={SocialScreen}
        options={{ tabBarButtonTestID: 'tab-social' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarButtonTestID: 'tab-profile' }}
      />
    </Tab.Navigator>
  );
}


/**
 * Root navigation stack
 * Conditionally shows auth, onboarding, or main app screens
 */
export function AppNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitializing = useAuthStore((s) => s.isInitializing);

  // Only block rendering during initial auth state detection (first boot).
  // Do NOT block during in-app operations (sign out, delete account) —
  // that causes a white screen flash while async cleanup runs.
  if (isInitializing) {
    return null;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 350,
        }}
      >
        {!isAuthenticated ? (
          <>
            <RootStack.Screen name="Auth" component={AuthScreen} />
            <RootStack.Screen name="EmailAuth" component={EmailAuthScreen} />
          </>
        ) : (
          <>
            {/* Authenticated users always land on MainTabs.
                Onboarding only shows once for first-time users, never blocks. */}
            <RootStack.Screen name="MainTabs" component={MainTabs} />
            <RootStack.Screen
              name="Onboarding"
              component={OnboardingScreen}
              options={{
                presentation: 'transparentModal',
                animation: 'fade',
                gestureEnabled: false,  // Prevent swipe-to-dismiss — must complete all steps
              }}
            />
            <RootStack.Screen
              name="Exercise"
              component={ExercisePlayer as unknown as React.ComponentType<Record<string, unknown>>}
              options={{ animation: 'slide_from_bottom' }}
            />
            <RootStack.Screen
              name="TierIntro"
              component={TierIntroScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="MidiSetup"
              component={MidiSetupScreen}
              options={{ presentation: 'transparentModal', animation: 'fade', headerShown: true, title: 'MIDI Setup' }}
            />
            <RootStack.Screen
              name="MicSetup"
              component={MicSetupScreen}
              options={{ presentation: 'transparentModal', animation: 'fade' }}
            />
            <RootStack.Screen
              name="Account"
              component={AccountScreen}
              options={{ presentation: 'transparentModal', animation: 'fade' }}
            />
            <RootStack.Screen
              name="SkillAssessment"
              component={SkillAssessmentScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="DailySession"
              component={DailySessionScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="LevelMap"
              component={LevelMapScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="FreePlay"
              component={PlayScreen}
              options={{ animation: 'fade' }}
            />
            <RootStack.Screen
              name="SongPlayer"
              component={SongPlayerScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="Leaderboard"
              component={LeaderboardScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="Friends"
              component={FriendsScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="AddFriend"
              component={AddFriendScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <RootStack.Screen
              name="CatSwitch"
              component={CatSwitchScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="CatStudio"
              component={CatStudioScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
