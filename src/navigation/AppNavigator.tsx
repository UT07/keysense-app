/**
 * Main App Navigation
 * Sets up the navigation structure for Purrrfect Keys
 * Auth flow → Onboarding → Main app
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { ExercisePlayer } from '../screens/ExercisePlayer/ExercisePlayer';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { MidiSetupScreen } from '../screens/MidiSetupScreen';
import { LevelMapScreen } from '../screens/LevelMapScreen';
import { PlayScreen } from '../screens/PlayScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { EmailAuthScreen } from '../screens/EmailAuthScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { LessonIntroScreen } from '../screens/LessonIntroScreen';
import { CatSwitchScreen } from '../screens/CatSwitchScreen';

// Stores
import { useAuthStore } from '../stores/authStore';

// Types
export type RootStackParamList = {
  Auth: undefined;
  EmailAuth: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
  Exercise: { exerciseId: string };
  LessonIntro: { lessonId: string };
  MidiSetup: undefined;
  Account: undefined;
  CatSwitch: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Learn: undefined;
  Play: undefined;
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Main tab navigator (Home, Learn, Play, Profile)
 */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#DC143C',
        tabBarInactiveTintColor: '#666666',
        tabBarStyle: {
          backgroundColor: '#111111',
          borderTopColor: '#222222',
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Learn"
        component={LevelMapScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="school" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Play"
        component={PlayScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="piano" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account" size={size} color={color} />
          ),
        }}
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
              options={{ presentation: 'modal' }}
            />
            <RootStack.Screen
              name="Exercise"
              component={ExercisePlayer as unknown as React.ComponentType<Record<string, unknown>>}
              options={{ animation: 'fade' }}
            />
            <RootStack.Screen
              name="LessonIntro"
              component={LessonIntroScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <RootStack.Screen
              name="MidiSetup"
              component={MidiSetupScreen}
              options={{ presentation: 'modal', headerShown: true, title: 'MIDI Setup' }}
            />
            <RootStack.Screen
              name="Account"
              component={AccountScreen}
              options={{ presentation: 'modal' }}
            />
            <RootStack.Screen
              name="CatSwitch"
              component={CatSwitchScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
