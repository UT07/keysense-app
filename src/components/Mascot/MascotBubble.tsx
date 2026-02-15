/**
 * MascotBubble Component
 * Displays Salsa the piano mascot with a speech bubble
 * MVP uses emoji-based rendering with mood-tinted avatar
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { KeysieSvg } from './KeysieSvg';
import type { MascotMood } from './mascotTips';

export interface MascotBubbleProps {
  mood: MascotMood;
  message: string;
  size?: 'small' | 'medium' | 'large';
  showBubble?: boolean;
  onDismiss?: () => void;
}

const MOOD_COLORS: Record<MascotMood, string> = {
  happy: '#1B3A1B',
  encouraging: '#1B2A3A',
  excited: '#3A351B',
  teaching: '#2A1B3A',
  celebrating: '#3A1B2A',
};

const MOOD_BORDER_COLORS: Record<MascotMood, string> = {
  happy: '#2E7D32',
  encouraging: '#1565C0',
  excited: '#F9A825',
  teaching: '#7B1FA2',
  celebrating: '#DC143C',
};

const AVATAR_SIZES = {
  small: 36,
  medium: 48,
  large: 64,
};

const MESSAGE_FONT_SIZES = {
  small: 11,
  medium: 13,
  large: 15,
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * MascotBubble - Keysie mascot with animated speech bubble
 * Uses emoji rendering as MVP, with mood-based color tinting
 */
export const MascotBubble: React.FC<MascotBubbleProps> = ({
  mood,
  message,
  size = 'medium',
  showBubble = true,
  onDismiss,
}) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    // Entrance animation: fade in with slight bounce
    opacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
    scale.value = withSequence(
      withTiming(1.05, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, {
        duration: 150,
        easing: Easing.inOut(Easing.cubic),
      })
    );
  }, [opacity, scale]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // Bubble fade in slightly delayed
  const bubbleOpacity = useSharedValue(0);

  useEffect(() => {
    bubbleOpacity.value = withDelay(
      150,
      withTiming(1, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [bubbleOpacity]);

  const bubbleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: bubbleOpacity.value,
  }));

  const avatarSize = AVATAR_SIZES[size];
  const fontSize = MESSAGE_FONT_SIZES[size];
  const bgColor = MOOD_COLORS[mood];
  const borderColor = MOOD_BORDER_COLORS[mood];

  return (
    <Animated.View
      style={[styles.container, containerAnimatedStyle]}
      testID="mascot-bubble"
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: bgColor,
            borderColor: borderColor,
          },
        ]}
        testID="mascot-avatar"
      >
        <KeysieSvg mood={mood} size="small" pixelSize={Math.round(avatarSize * 0.8)} />
      </View>

      {/* Speech Bubble */}
      {showBubble && (
        <Animated.View style={[styles.bubbleWrapper, bubbleAnimatedStyle]}>
          {/* Triangle pointer */}
          <View
            style={[
              styles.bubblePointer,
              { borderRightColor: '#252525' },
            ]}
          />
          {/* Bubble content */}
          <View
            style={[
              styles.bubble,
              {
                maxWidth: SCREEN_WIDTH * 0.65,
                borderColor: borderColor,
              },
            ]}
          >
            <Text style={[styles.message, { fontSize }]}>{message}</Text>
            {onDismiss && (
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={onDismiss}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID="mascot-dismiss"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={14}
                  color="#666666"
                />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
};

MascotBubble.displayName = 'MascotBubble';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingTop: 6,
  },
  bubblePointer: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginTop: 8,
  },
  bubble: {
    backgroundColor: '#252525',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  message: {
    color: '#E0E0E0',
    lineHeight: 18,
    flex: 1,
  },
  dismissButton: {
    padding: 2,
    marginTop: -2,
  },
});

export default MascotBubble;
