/**
 * CustomTabBar
 *
 * Polished bottom tab bar replacing the default React Navigation tab bar.
 * Features animated icon scaling, dot indicator, and haptic feedback.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, SHADOWS } from '../theme/tokens';

// ---------------------------------------------------------------------------
// Icon config per tab route
// ---------------------------------------------------------------------------

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface TabIconConfig {
  active: IconName;
  inactive: IconName;
}

const TAB_ICONS: Record<string, TabIconConfig> = {
  Home: { active: 'home', inactive: 'home' },
  Learn: { active: 'map-marker-path', inactive: 'map-marker-path' },
  Songs: { active: 'music-note', inactive: 'music-note-outline' },
  Social: { active: 'account-group', inactive: 'account-group-outline' },
  Profile: { active: 'account-circle', inactive: 'account-circle-outline' },
};

const ICON_SIZE = 26;
const TAB_BAR_HEIGHT = 60;
const DOT_SIZE = 4;
const DOT_OFFSET = 4;

const SPRING_CONFIG = { damping: 12, stiffness: 200 };
const TIMING_CONFIG = { duration: 200 };

// ---------------------------------------------------------------------------
// Individual tab button
// ---------------------------------------------------------------------------

interface TabButtonProps {
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  testID?: string;
}

function TabButton({
  routeName,
  isFocused,
  onPress,
  onLongPress,
  testID,
}: TabButtonProps): React.ReactElement {
  const iconConfig = TAB_ICONS[routeName] ?? TAB_ICONS.Home;

  const iconAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: withSpring(isFocused ? 1.15 : 1.0, SPRING_CONFIG) },
      ],
    };
  }, [isFocused]);

  const dotAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isFocused ? 1 : 0, TIMING_CONFIG),
    };
  }, [isFocused]);

  const handlePress = (): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={routeName}
      onPress={handlePress}
      onLongPress={onLongPress}
      style={styles.tabButton}
      testID={testID}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.iconWrapper, iconAnimatedStyle]}>
        <MaterialCommunityIcons
          name={isFocused ? iconConfig.active : iconConfig.inactive}
          size={ICON_SIZE}
          color={isFocused ? COLORS.primary : COLORS.textMuted}
          testID={`tab-icon-${routeName}`}
        />
      </Animated.View>
      <Animated.View style={[styles.dot, dotAnimatedStyle]} />
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Custom tab bar
// ---------------------------------------------------------------------------

export function CustomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps): React.ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        SHADOWS.sm as Record<string, unknown>,
        { paddingBottom: insets.bottom },
      ]}
      testID="custom-tab-bar"
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const testID =
          (options as Record<string, unknown>).tabBarButtonTestID as
            | string
            | undefined;

        const onPress = (): void => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = (): void => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TabButton
            key={route.key}
            routeName={route.name}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            testID={testID}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: COLORS.primary,
    marginTop: DOT_OFFSET,
  },
});
