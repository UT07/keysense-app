/**
 * Main App Navigation
 * Sets up the navigation structure for KeySense
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

// Stores
import { useSettingsStore } from '../stores/settingsStore';

// Types
export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
  Exercise: { exerciseId: string };
  MidiSetup: undefined;
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
        tabBarActiveTintColor: '#1976D2',
        tabBarInactiveTintColor: '#757575',
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
 */
export function AppNavigator() {
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);

  return (
    <NavigationContainer>
      <RootStack.Navigator
        initialRouteName={hasCompletedOnboarding ? 'MainTabs' : 'Onboarding'}
        screenOptions={{
          headerShown: false,
        }}
      >
        <RootStack.Screen
          name="Onboarding"
          component={OnboardingScreen}
        />
        <RootStack.Screen
          name="MainTabs"
          component={MainTabs}
        />
        <RootStack.Screen
          name="Exercise"
          component={ExercisePlayer as unknown as React.ComponentType<Record<string, unknown>>}
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
          }}
        />
        <RootStack.Screen
          name="MidiSetup"
          component={MidiSetupScreen}
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'MIDI Setup',
          }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
