/**
 * PressableScale Component Tests
 *
 * Tests the animated Pressable wrapper with spring scale on press.
 * Validates onPress, onLongPress, disabled state, testID forwarding,
 * children rendering, custom scaleDown, style passthrough, and
 * SoundManager integration.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { PressableScale } from '../PressableScale';
import { soundManager } from '../../../audio/SoundManager';

jest.mock('../../../audio/SoundManager', () => ({
  soundManager: { play: jest.fn() },
}));

const mockSoundManagerPlay = soundManager.play as jest.Mock;

describe('PressableScale', () => {
  beforeEach(() => {
    mockSoundManagerPlay.mockClear();
  });

  describe('Basic rendering', () => {
    it('renders without crashing with minimal props', () => {
      const { getByText } = render(
        <PressableScale>
          <Text>Hello</Text>
        </PressableScale>,
      );
      expect(getByText('Hello')).toBeTruthy();
    });

    it('renders text children', () => {
      const { getByText } = render(
        <PressableScale>
          <Text>Press Me</Text>
        </PressableScale>,
      );
      expect(getByText('Press Me')).toBeTruthy();
    });

    it('renders complex children (nested views)', () => {
      const { getByText, getByTestId } = render(
        <PressableScale testID="wrapper">
          <View testID="inner-view">
            <Text>Line 1</Text>
            <Text>Line 2</Text>
          </View>
        </PressableScale>,
      );
      expect(getByText('Line 1')).toBeTruthy();
      expect(getByText('Line 2')).toBeTruthy();
      expect(getByTestId('inner-view')).toBeTruthy();
    });

    it('renders multiple children', () => {
      const { getByText } = render(
        <PressableScale>
          <Text>Child 1</Text>
          <Text>Child 2</Text>
          <Text>Child 3</Text>
        </PressableScale>,
      );
      expect(getByText('Child 1')).toBeTruthy();
      expect(getByText('Child 2')).toBeTruthy();
      expect(getByText('Child 3')).toBeTruthy();
    });
  });

  describe('onPress interaction', () => {
    it('calls onPress when pressed', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <PressableScale onPress={onPress}>
          <Text>Button</Text>
        </PressableScale>,
      );
      fireEvent.press(getByText('Button'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('calls onPress multiple times on multiple presses', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <PressableScale onPress={onPress}>
          <Text>Multi</Text>
        </PressableScale>,
      );
      fireEvent.press(getByText('Multi'));
      fireEvent.press(getByText('Multi'));
      fireEvent.press(getByText('Multi'));
      expect(onPress).toHaveBeenCalledTimes(3);
    });

    it('does not crash when onPress is undefined', () => {
      const { getByText } = render(
        <PressableScale>
          <Text>No Handler</Text>
        </PressableScale>,
      );
      // Should not throw
      expect(() => fireEvent.press(getByText('No Handler'))).not.toThrow();
    });
  });

  describe('onLongPress interaction', () => {
    it('calls onLongPress on long press', () => {
      const onLongPress = jest.fn();
      const { getByText } = render(
        <PressableScale onLongPress={onLongPress}>
          <Text>Long Press</Text>
        </PressableScale>,
      );
      fireEvent(getByText('Long Press'), 'longPress');
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('does not crash when onLongPress is undefined', () => {
      const { getByText } = render(
        <PressableScale>
          <Text>No Long</Text>
        </PressableScale>,
      );
      expect(() =>
        fireEvent(getByText('No Long'), 'longPress'),
      ).not.toThrow();
    });

    it('supports both onPress and onLongPress simultaneously', () => {
      const onPress = jest.fn();
      const onLongPress = jest.fn();
      const { getByText } = render(
        <PressableScale onPress={onPress} onLongPress={onLongPress}>
          <Text>Both</Text>
        </PressableScale>,
      );
      fireEvent.press(getByText('Both'));
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onLongPress).not.toHaveBeenCalled();

      fireEvent(getByText('Both'), 'longPress');
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Disabled state', () => {
    it('does not call onPress when disabled', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <PressableScale onPress={onPress} disabled>
          <Text>Disabled</Text>
        </PressableScale>,
      );
      fireEvent.press(getByText('Disabled'));
      expect(onPress).not.toHaveBeenCalled();
    });

    it('does not call onLongPress when disabled', () => {
      const onLongPress = jest.fn();
      const { getByText } = render(
        <PressableScale onLongPress={onLongPress} disabled>
          <Text>Disabled Long</Text>
        </PressableScale>,
      );
      fireEvent(getByText('Disabled Long'), 'longPress');
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('still renders children when disabled', () => {
      const { getByText } = render(
        <PressableScale disabled>
          <Text>Still Visible</Text>
        </PressableScale>,
      );
      expect(getByText('Still Visible')).toBeTruthy();
    });

    it('disabled=false allows pressing', () => {
      const onPress = jest.fn();
      const { getByText } = render(
        <PressableScale onPress={onPress} disabled={false}>
          <Text>Enabled</Text>
        </PressableScale>,
      );
      fireEvent.press(getByText('Enabled'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('testID prop', () => {
    it('forwards testID to the AnimatedPressable', () => {
      const { getByTestId } = render(
        <PressableScale testID="my-button">
          <Text>With ID</Text>
        </PressableScale>,
      );
      expect(getByTestId('my-button')).toBeTruthy();
    });

    it('works without testID', () => {
      const { getByText } = render(
        <PressableScale>
          <Text>No ID</Text>
        </PressableScale>,
      );
      expect(getByText('No ID')).toBeTruthy();
    });

    it('testID allows press events by testID', () => {
      const onPress = jest.fn();
      const { getByTestId } = render(
        <PressableScale onPress={onPress} testID="press-target">
          <Text>Target</Text>
        </PressableScale>,
      );
      fireEvent.press(getByTestId('press-target'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('scaleDown prop', () => {
    it('renders with default scaleDown (0.97)', () => {
      const { getByText } = render(
        <PressableScale>
          <Text>Default Scale</Text>
        </PressableScale>,
      );
      expect(getByText('Default Scale')).toBeTruthy();
    });

    it('renders with custom scaleDown value', () => {
      const { getByText } = render(
        <PressableScale scaleDown={0.9}>
          <Text>Custom Scale</Text>
        </PressableScale>,
      );
      expect(getByText('Custom Scale')).toBeTruthy();
    });

    it('renders with scaleDown=0.5', () => {
      const { getByText } = render(
        <PressableScale scaleDown={0.5}>
          <Text>Half Scale</Text>
        </PressableScale>,
      );
      expect(getByText('Half Scale')).toBeTruthy();
    });

    it('renders with scaleDown=1.0 (no scale)', () => {
      const { getByText } = render(
        <PressableScale scaleDown={1.0}>
          <Text>No Scale</Text>
        </PressableScale>,
      );
      expect(getByText('No Scale')).toBeTruthy();
    });
  });

  describe('Style prop', () => {
    it('accepts and applies style prop', () => {
      const { getByTestId } = render(
        <PressableScale
          testID="styled"
          style={{ backgroundColor: 'red', padding: 10 }}
        >
          <Text>Styled</Text>
        </PressableScale>,
      );
      const element = getByTestId('styled');
      // The style should contain our custom styles (as part of an array with animated styles)
      expect(element).toBeTruthy();
    });

    it('renders with undefined style', () => {
      const { getByText } = render(
        <PressableScale style={undefined}>
          <Text>No Style</Text>
        </PressableScale>,
      );
      expect(getByText('No Style')).toBeTruthy();
    });

    it('renders with empty object style', () => {
      const { getByText } = render(
        <PressableScale style={{}}>
          <Text>Empty Style</Text>
        </PressableScale>,
      );
      expect(getByText('Empty Style')).toBeTruthy();
    });
  });

  describe('Press in/out animations', () => {
    it('handles pressIn event without crashing', () => {
      const { getByTestId } = render(
        <PressableScale testID="anim-target">
          <Text>Animate</Text>
        </PressableScale>,
      );
      expect(() =>
        fireEvent(getByTestId('anim-target'), 'pressIn'),
      ).not.toThrow();
    });

    it('handles pressOut event without crashing', () => {
      const { getByTestId } = render(
        <PressableScale testID="anim-target-out">
          <Text>Animate Out</Text>
        </PressableScale>,
      );
      expect(() =>
        fireEvent(getByTestId('anim-target-out'), 'pressOut'),
      ).not.toThrow();
    });

    it('handles pressIn followed by pressOut without crashing', () => {
      const { getByTestId } = render(
        <PressableScale testID="full-press">
          <Text>Full Press</Text>
        </PressableScale>,
      );
      const target = getByTestId('full-press');
      expect(() => {
        fireEvent(target, 'pressIn');
        fireEvent(target, 'pressOut');
      }).not.toThrow();
    });
  });

  describe('Re-rendering stability', () => {
    it('re-renders when onPress callback changes', () => {
      const onPress1 = jest.fn();
      const onPress2 = jest.fn();
      const { getByText, rerender } = render(
        <PressableScale onPress={onPress1}>
          <Text>Rerender</Text>
        </PressableScale>,
      );

      fireEvent.press(getByText('Rerender'));
      expect(onPress1).toHaveBeenCalledTimes(1);

      rerender(
        <PressableScale onPress={onPress2}>
          <Text>Rerender</Text>
        </PressableScale>,
      );

      fireEvent.press(getByText('Rerender'));
      expect(onPress2).toHaveBeenCalledTimes(1);
      expect(onPress1).toHaveBeenCalledTimes(1); // Not called again
    });

    it('re-renders when children change', () => {
      const { getByText, queryByText, rerender } = render(
        <PressableScale>
          <Text>Old</Text>
        </PressableScale>,
      );
      expect(getByText('Old')).toBeTruthy();

      rerender(
        <PressableScale>
          <Text>New</Text>
        </PressableScale>,
      );
      expect(getByText('New')).toBeTruthy();
      expect(queryByText('Old')).toBeNull();
    });

    it('re-renders when disabled state toggles', () => {
      const onPress = jest.fn();
      const { getByText, rerender } = render(
        <PressableScale onPress={onPress} disabled>
          <Text>Toggle</Text>
        </PressableScale>,
      );

      fireEvent.press(getByText('Toggle'));
      expect(onPress).not.toHaveBeenCalled();

      rerender(
        <PressableScale onPress={onPress} disabled={false}>
          <Text>Toggle</Text>
        </PressableScale>,
      );

      fireEvent.press(getByText('Toggle'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Prop combinations', () => {
    it('renders with all props simultaneously', () => {
      const onPress = jest.fn();
      const onLongPress = jest.fn();
      const { getByTestId, getByText } = render(
        <PressableScale
          onPress={onPress}
          onLongPress={onLongPress}
          disabled={false}
          scaleDown={0.95}
          style={{ margin: 5 }}
          testID="full-props"
        >
          <Text>All Props</Text>
        </PressableScale>,
      );

      expect(getByTestId('full-props')).toBeTruthy();
      expect(getByText('All Props')).toBeTruthy();

      fireEvent.press(getByTestId('full-props'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('SoundManager integration (soundOnPress)', () => {
    it('plays button_press sound by default on pressIn', () => {
      const { getByTestId } = render(
        <PressableScale testID="sound-default">
          <Text>Default Sound</Text>
        </PressableScale>,
      );
      fireEvent(getByTestId('sound-default'), 'pressIn');
      expect(mockSoundManagerPlay).toHaveBeenCalledWith('button_press');
      expect(mockSoundManagerPlay).toHaveBeenCalledTimes(1);
    });

    it('does not play sound when soundOnPress is false', () => {
      const { getByTestId } = render(
        <PressableScale testID="sound-off" soundOnPress={false}>
          <Text>No Sound</Text>
        </PressableScale>,
      );
      fireEvent(getByTestId('sound-off'), 'pressIn');
      expect(mockSoundManagerPlay).not.toHaveBeenCalled();
    });

    it('skips manual Haptics when soundOnPress is active', () => {
       
      const HapticsMock = require('expo-haptics');
      HapticsMock.impactAsync.mockClear();

      const { getByTestId } = render(
        <PressableScale testID="no-double-haptic" haptic soundOnPress>
          <Text>No Double Haptic</Text>
        </PressableScale>,
      );
      fireEvent(getByTestId('no-double-haptic'), 'pressIn');

      // SoundManager was called (it handles haptic internally)
      expect(mockSoundManagerPlay).toHaveBeenCalledWith('button_press');
      // Manual Haptics should NOT be called — SoundManager handles it
      expect(HapticsMock.impactAsync).not.toHaveBeenCalled();
    });

    it('falls back to manual Haptics when soundOnPress=false and haptic=true', () => {
       
      const HapticsMock = require('expo-haptics');
      HapticsMock.impactAsync.mockClear();

      const { getByTestId } = render(
        <PressableScale testID="manual-haptic" haptic soundOnPress={false}>
          <Text>Manual Haptic</Text>
        </PressableScale>,
      );
      fireEvent(getByTestId('manual-haptic'), 'pressIn');

      // SoundManager should NOT be called
      expect(mockSoundManagerPlay).not.toHaveBeenCalled();
      // Manual Haptics SHOULD be called
      expect(HapticsMock.impactAsync).toHaveBeenCalledTimes(1);
    });

    it('plays sound on each pressIn event', () => {
      const { getByTestId } = render(
        <PressableScale testID="multi-press">
          <Text>Multi</Text>
        </PressableScale>,
      );
      const target = getByTestId('multi-press');
      fireEvent(target, 'pressIn');
      fireEvent(target, 'pressOut');
      fireEvent(target, 'pressIn');
      expect(mockSoundManagerPlay).toHaveBeenCalledTimes(2);
    });
  });
});
