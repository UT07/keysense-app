/**
 * Main App Navigation
 * Sets up the navigation structure for Purrrfect Keys
 * Auth flow → Onboarding → Main app
 */

import React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
// CatCollectionScreen is deprecated — CatSwitchScreen serves as the unified gallery
// import { CatCollectionScreen } from '../screens/CatCollectionScreen';
import { SkillAssessmentScreen } from '../screens/SkillAssessmentScreen';
import { DailySessionScreen } from '../screens/DailySessionScreen';
import { SongLibraryScreen } from '../screens/SongLibraryScreen';
import { SongPlayerScreen } from '../screens/SongPlayerScreen';

// Navigation
import { CustomTabBar } from './CustomTabBar';

// Stores
import { useAuthStore } from '../stores/authStore';
import { COLORS } from '../theme/tokens';

// Types
export type RootStackParamList = {
  Auth: undefined;
  EmailAuth: { isLinking?: boolean } | undefined;
  Onboarding: undefined;
  MainTabs: undefined;
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
  CatCollection: undefined;
  SongPlayer: { songId: string };
  Leaderboard: undefined;
  Friends: undefined;
  AddFriend: undefined;
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

/** Placeholder for the Social tab — replaced when SocialScreen is implemented */
function SocialScreenPlaceholder(): React.JSX.Element {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>Social — Coming Soon</Text>
    </View>
  );
}

function LeaderboardPlaceholder(): React.JSX.Element {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>Leaderboard — Coming Soon</Text>
    </View>
  );
}

function FriendsPlaceholder(): React.JSX.Element {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>Friends — Coming Soon</Text>
    </View>
  );
}

function AddFriendPlaceholder(): React.JSX.Element {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: COLORS.textPrimary, fontSize: 16 }}>Add Friend — Coming Soon</Text>
    </View>
  );
}

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
        component={SocialScreenPlaceholder}
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
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
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
                presentation: 'modal',
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
              options={{ presentation: 'modal', headerShown: true, title: 'MIDI Setup' }}
            />
            <RootStack.Screen
              name="MicSetup"
              component={MicSetupScreen}
              options={{ presentation: 'modal' }}
            />
            <RootStack.Screen
              name="Account"
              component={AccountScreen}
              options={{ presentation: 'modal' }}
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
              component={LeaderboardPlaceholder}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="Friends"
              component={FriendsPlaceholder}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="AddFriend"
              component={AddFriendPlaceholder}
              options={{ animation: 'slide_from_bottom' }}
            />
            <RootStack.Screen
              name="CatSwitch"
              component={CatSwitchScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="CatCollection"
              component={CatSwitchScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
