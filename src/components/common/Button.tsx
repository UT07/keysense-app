/**
 * Button Component
 * Reusable button with multiple variants and sizes
 */

import React, { useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const COLORS = {
  primary: '#2196F3',
  secondary: '#757575',
  danger: '#F44336',
  outline: '#2196F3',
  text: '#FFFFFF',
  outlineText: '#2196F3',
  disabled: '#CCCCCC',
  disabledText: '#999999',
};

const SIZES = {
  small: { paddingVertical: 8, paddingHorizontal: 16, fontSize: 12 },
  medium: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 14 },
  large: { paddingVertical: 14, paddingHorizontal: 24, fontSize: 16 },
};

/**
 * Button Component
 * Supports different variants (primary, secondary, danger, outline)
 * and sizes (small, medium, large)
 */
export const Button = React.memo(
  ({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    disabled = false,
    loading = false,
    icon,
    style,
    testID,
  }: ButtonProps) => {
    const scaleValue = useSharedValue(1);

    const handlePressIn = useCallback(() => {
      scaleValue.value = withTiming(0.95, {
        duration: 100,
        easing: Easing.out(Easing.cubic),
      });
    }, [scaleValue]);

    const handlePressOut = useCallback(() => {
      scaleValue.value = withTiming(1, {
        duration: 100,
        easing: Easing.out(Easing.cubic),
      });
    }, [scaleValue]);

    const handlePress = useCallback(() => {
      if (!disabled && !loading) {
        onPress();
      }
    }, [disabled, loading, onPress]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scaleValue.value }],
    }));

    const getBackgroundColor = () => {
      if (disabled) return COLORS.disabled;
      switch (variant) {
        case 'primary':
          return COLORS.primary;
        case 'secondary':
          return COLORS.secondary;
        case 'danger':
          return COLORS.danger;
        case 'outline':
          return 'transparent';
        default:
          return COLORS.primary;
      }
    };

    const getTextColor = () => {
      if (disabled) return COLORS.disabledText;
      return variant === 'outline' ? COLORS.outlineText : COLORS.text;
    };

    const sizeStyle = SIZES[size];
    const backgroundColor = getBackgroundColor();
    const textColor = getTextColor();

    return (
      <Animated.View style={[animatedStyle, style]}>
        <TouchableOpacity
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || loading}
          activeOpacity={0.8}
          testID={testID}
          style={[
            styles.button,
            {
              backgroundColor,
              paddingVertical: sizeStyle.paddingVertical,
              paddingHorizontal: sizeStyle.paddingHorizontal,
              borderWidth: variant === 'outline' ? 2 : 0,
              borderColor:
                variant === 'outline' ? COLORS.outline : 'transparent',
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={textColor} size="small" />
          ) : (
            <Text
              style={[
                styles.buttonText,
                {
                  fontSize: sizeStyle.fontSize,
                  color: textColor,
                },
              ]}
            >
              {icon && <>{icon} </>}
              {title}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }
);

Button.displayName = 'Button';

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
