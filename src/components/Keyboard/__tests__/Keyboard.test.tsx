/**
 * Keyboard Component Tests
 *
 * Comprehensive UI tests for the interactive piano keyboard.
 * Covers rendering (key counts, props), visual states (highlights,
 * expected notes, labels), layout (height, minWidth, scrollable modes),
 * and interaction (disabled state).
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Keyboard } from '../Keyboard';

// -- Helpers ------------------------------------------------------------------

/**
 * Count white keys in a MIDI range.
 */
function countWhiteKeys(startNote: number, endNote: number): number {
  let count = 0;
  for (let n = startNote; n <= endNote; n++) {
    if (![1, 3, 6, 8, 10].includes(n % 12)) count++;
  }
  return count;
}

/**
 * Count black keys in a MIDI range.
 */
function countBlackKeys(startNote: number, endNote: number): number {
  let count = 0;
  for (let n = startNote; n <= endNote; n++) {
    if ([1, 3, 6, 8, 10].includes(n % 12)) count++;
  }
  return count;
}

/**
 * Extract white key containers from rendered keyboard.
 * White key containers have flex:1 and are not absolutely positioned.
 */
function getWhiteKeyContainers(keyboardElement: any): any[] {
  return keyboardElement.children.filter((child: any) => {
    if (!child || typeof child !== 'object') return false;
    const style = Array.isArray(child.props?.style)
      ? Object.assign({}, ...child.props.style)
      : child.props?.style || {};
    return style.position !== 'absolute' && style.zIndex !== 10;
  });
}

/**
 * Extract black key overlays from rendered keyboard.
 * Black key overlays have position: 'absolute' and zIndex: 10.
 */
function getBlackKeyOverlays(keyboardElement: any): any[] {
  return keyboardElement.children.filter((child: any) => {
    if (!child || typeof child !== 'object') return false;
    const style = Array.isArray(child.props?.style)
      ? Object.assign({}, ...child.props.style)
      : child.props?.style || {};
    return style.position === 'absolute' && style.zIndex === 10;
  });
}

/**
 * Flatten a potentially-arrayed style into a single object.
 */
function flattenStyle(style: any): Record<string, any> {
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
  return style || {};
}

/**
 * Circular-safe JSON stringify for React test trees.
 * Reanimated's Animated.View creates circular fiber references in toJSON().
 */
function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  });
}

// -- Tests --------------------------------------------------------------------

describe('Keyboard', () => {
  // -- 1. Correct number of white keys (default: 2 octaves) --
  describe('White key count', () => {
    it('renders 14 white keys for default 2 octaves starting at C3', () => {
      const startNote = 48;
      const endNote = startNote + 2 * 12 - 1;
      const expectedWhiteKeys = countWhiteKeys(startNote, endNote);
      expect(expectedWhiteKeys).toBe(14);

      const { getByTestId } = render(<Keyboard testID="kb" />);
      const keyboard = getByTestId('kb-keyboard');
      const whiteKeyContainers = getWhiteKeyContainers(keyboard);
      expect(whiteKeyContainers.length).toBe(14);
    });
  });

  // -- 2. Correct number of black keys (default: 2 octaves) --
  describe('Black key count', () => {
    it('renders 10 black keys for default 2 octaves starting at C3', () => {
      const startNote = 48;
      const endNote = startNote + 2 * 12 - 1;
      const expectedBlackKeys = countBlackKeys(startNote, endNote);
      expect(expectedBlackKeys).toBe(10);

      const { getByTestId } = render(<Keyboard testID="kb" />);
      const keyboard = getByTestId('kb-keyboard');
      const blackKeyOverlays = getBlackKeyOverlays(keyboard);
      expect(blackKeyOverlays.length).toBe(10);
    });
  });

  // -- 3. startNote prop shifts the range --
  describe('startNote prop', () => {
    it('changes the rendered range when startNote is C4 (60)', () => {
      const startNote = 60;
      const endNote = startNote + 2 * 12 - 1;
      const expectedWhite = countWhiteKeys(startNote, endNote);
      expect(expectedWhite).toBe(14);

      const { getByTestId } = render(
        <Keyboard startNote={60} testID="kb" />,
      );
      const keyboard = getByTestId('kb-keyboard');
      const whiteKeyContainers = getWhiteKeyContainers(keyboard);
      expect(whiteKeyContainers.length).toBe(expectedWhite);
    });

    it('uses different start note (F3 = 53) and gets correct key counts', () => {
      const startNote = 53;
      const endNote = startNote + 2 * 12 - 1;
      const expectedWhite = countWhiteKeys(startNote, endNote);
      const expectedBlack = countBlackKeys(startNote, endNote);

      const { getByTestId } = render(
        <Keyboard startNote={53} testID="kb" />,
      );
      const keyboard = getByTestId('kb-keyboard');
      expect(getWhiteKeyContainers(keyboard).length).toBe(expectedWhite);
      expect(getBlackKeyOverlays(keyboard).length).toBe(expectedBlack);
    });

    it('shows correct labels after shifting startNote to C4', () => {
      const { getByText, queryByText } = render(
        <Keyboard startNote={60} showLabels={true} testID="kb" />,
      );
      expect(getByText('C4')).toBeTruthy();
      expect(queryByText('C3')).toBeNull();
    });
  });

  // -- 4. octaveCount prop --
  describe('octaveCount prop', () => {
    it('renders 7 white keys for 1 octave', () => {
      const startNote = 48;
      const endNote = startNote + 1 * 12 - 1;
      const expectedWhite = countWhiteKeys(startNote, endNote);
      expect(expectedWhite).toBe(7);

      const { getByTestId } = render(
        <Keyboard octaveCount={1} testID="kb" />,
      );
      const keyboard = getByTestId('kb-keyboard');
      expect(getWhiteKeyContainers(keyboard).length).toBe(7);
    });

    it('renders 5 black keys for 1 octave', () => {
      const startNote = 48;
      const endNote = startNote + 1 * 12 - 1;
      const expectedBlack = countBlackKeys(startNote, endNote);
      expect(expectedBlack).toBe(5);

      const { getByTestId } = render(
        <Keyboard octaveCount={1} testID="kb" />,
      );
      const keyboard = getByTestId('kb-keyboard');
      expect(getBlackKeyOverlays(keyboard).length).toBe(5);
    });

    it('renders 21 white keys for 3 octaves', () => {
      const startNote = 48;
      const endNote = startNote + 3 * 12 - 1;
      const expectedWhite = countWhiteKeys(startNote, endNote);
      expect(expectedWhite).toBe(21);

      const { getByTestId } = render(
        <Keyboard octaveCount={3} testID="kb" />,
      );
      const keyboard = getByTestId('kb-keyboard');
      expect(getWhiteKeyContainers(keyboard).length).toBe(21);
    });

    it('clamps octaveCount to minimum of 1', () => {
      const { getByTestId } = render(
        <Keyboard octaveCount={0} testID="kb" />,
      );
      const keyboard = getByTestId('kb-keyboard');
      expect(getWhiteKeyContainers(keyboard).length).toBe(7);
    });

    it('clamps octaveCount to maximum of 4', () => {
      const startNote = 48;
      const endNote = startNote + 4 * 12 - 1;
      const expectedWhite = countWhiteKeys(startNote, endNote);

      const { getByTestId } = render(
        <Keyboard octaveCount={6} testID="kb" />,
      );
      const keyboard = getByTestId('kb-keyboard');
      expect(getWhiteKeyContainers(keyboard).length).toBe(expectedWhite);
    });
  });

  // -- 5. keyHeight prop sets correct height --
  describe('keyHeight prop', () => {
    it('sets default keyboard height to 80', () => {
      const { getByTestId } = render(<Keyboard testID="kb" />);
      const keyboard = getByTestId('kb-keyboard');
      const style = flattenStyle(keyboard.props.style);
      expect(style.height).toBe(80);
    });

    it('sets custom keyboard height to 120', () => {
      const { getByTestId } = render(<Keyboard keyHeight={120} testID="kb" />);
      const keyboard = getByTestId('kb-keyboard');
      const style = flattenStyle(keyboard.props.style);
      expect(style.height).toBe(120);
    });

    it('applies keyHeight to white key containers', () => {
      const { getByTestId } = render(<Keyboard keyHeight={100} testID="kb" />);
      const keyboard = getByTestId('kb-keyboard');
      const whiteKeyContainers = getWhiteKeyContainers(keyboard);

      expect(whiteKeyContainers.length).toBeGreaterThan(0);
      for (const container of whiteKeyContainers) {
        const style = flattenStyle(container.props.style);
        expect(style.height).toBe(100);
      }
    });

    it('calculates keyboard width from keyHeight in scrollable mode', () => {
      const keyHeight = 100;
      const whiteKeyWidth = keyHeight * 0.7;
      const expectedWidth = 14 * whiteKeyWidth;

      const { getByTestId } = render(
        <Keyboard keyHeight={keyHeight} scrollable={true} testID="kb" />,
      );
      const keyboard = getByTestId('kb-keyboard');
      const style = flattenStyle(keyboard.props.style);
      expect(style.width).toBe(expectedWidth);
    });
  });

  // -- 6. Scrollable mode wraps in ScrollView --
  describe('Scrollable mode', () => {
    it('renders keyboard with numeric width when scrollable=true (default)', () => {
      const { getByTestId } = render(
        <Keyboard testID="kb" scrollable={true} />,
      );
      const keyboard = getByTestId('kb-keyboard');
      const style = flattenStyle(keyboard.props.style);
      expect(typeof style.width).toBe('number');
    });

    it('sets keyboard width to calculated pixel value in scrollable mode', () => {
      const { getByTestId } = render(
        <Keyboard testID="kb" scrollable={true} keyHeight={80} />,
      );
      const keyboard = getByTestId('kb-keyboard');
      const style = flattenStyle(keyboard.props.style);
      const expectedWidth = 14 * (80 * 0.7);
      expect(style.width).toBe(expectedWidth);
    });

    it('container testID is on the outer wrapper', () => {
      const { getByTestId } = render(
        <Keyboard testID="kb" scrollable={true} />,
      );
      expect(getByTestId('kb')).toBeTruthy();
    });
  });

  // -- 7. Non-scrollable mode renders without ScrollView --
  describe('Non-scrollable mode', () => {
    it('sets keyboard width to 100% when scrollable=false', () => {
      const { getByTestId } = render(
        <Keyboard testID="kb" scrollable={false} />,
      );
      const keyboard = getByTestId('kb-keyboard');
      const style = flattenStyle(keyboard.props.style);
      expect(style.width).toBe('100%');
    });

    it('container has touch handlers directly when non-scrollable', () => {
      const onNoteOn = jest.fn();
      const { getByTestId } = render(
        <Keyboard testID="kb" scrollable={false} onNoteOn={onNoteOn} />,
      );
      const container = getByTestId('kb');
      expect(container.props.onTouchStart).toBeDefined();
      expect(container.props.onTouchMove).toBeDefined();
      expect(container.props.onTouchEnd).toBeDefined();
      expect(container.props.onTouchCancel).toBeDefined();
    });

    it('container does not have touch handlers in scrollable mode', () => {
      const { getByTestId } = render(
        <Keyboard testID="kb" scrollable={true} />,
      );
      const container = getByTestId('kb');
      expect(container.props.onTouchStart).toBeUndefined();
    });
  });

  // -- 8. Highlighted notes show visual feedback --
  describe('Highlighted notes', () => {
    it('renders highlight style for highlighted white notes', () => {
      const highlighted = new Set([48, 52]);
      const { toJSON } = render(
        <Keyboard highlightedNotes={highlighted} testID="kb" />,
      );
      const tree = safeStringify(toJSON());
      expect(tree).toContain('#FFE6CC');
    });

    it('does not show highlight style when no notes highlighted', () => {
      const highlighted = new Set<number>();
      const { toJSON } = render(
        <Keyboard highlightedNotes={highlighted} testID="kb" />,
      );
      const tree = safeStringify(toJSON());
      expect(tree).not.toContain('#FFE6CC');
      expect(tree).not.toContain('#B8860B');
    });

    it('renders highlight style for highlighted black notes', () => {
      const highlighted = new Set([49]);
      const { toJSON } = render(
        <Keyboard highlightedNotes={highlighted} testID="kb" />,
      );
      const tree = safeStringify(toJSON());
      expect(tree).toContain('#B8860B');
    });
  });

  // -- 9. Expected notes show expected styling --
  describe('Expected notes', () => {
    it('renders expected style for expected white notes', () => {
      const expected = new Set([48]);
      const { toJSON } = render(
        <Keyboard expectedNotes={expected} testID="kb" />,
      );
      const tree = safeStringify(toJSON());
      expect(tree).toContain('#C8E6C9');
      expect(tree).toContain('#2E7D32');
    });

    it('renders expected style for expected black notes', () => {
      const expected = new Set([49]);
      const { toJSON } = render(
        <Keyboard expectedNotes={expected} testID="kb" />,
      );
      const tree = safeStringify(toJSON());
      expect(tree).toContain('#1B5E20');
    });

    it('does not apply expected style when expectedNotes is empty', () => {
      const expected = new Set<number>();
      const { toJSON } = render(
        <Keyboard expectedNotes={expected} testID="kb" />,
      );
      const tree = safeStringify(toJSON());
      expect(tree).not.toContain('#C8E6C9');
    });
  });

  // -- 10. Shows labels when showLabels is true --
  describe('showLabels=true', () => {
    it('renders note name labels on white keys', () => {
      const { getByText } = render(
        <Keyboard showLabels={true} testID="kb" />,
      );
      expect(getByText('C3')).toBeTruthy();
      expect(getByText('D3')).toBeTruthy();
      expect(getByText('E3')).toBeTruthy();
      expect(getByText('F3')).toBeTruthy();
      expect(getByText('G3')).toBeTruthy();
      expect(getByText('A3')).toBeTruthy();
      expect(getByText('B3')).toBeTruthy();
    });

    it('renders note name labels on black keys', () => {
      const { getByText } = render(
        <Keyboard showLabels={true} testID="kb" />,
      );
      expect(getByText('C#3')).toBeTruthy();
      expect(getByText('D#3')).toBeTruthy();
      expect(getByText('F#3')).toBeTruthy();
      expect(getByText('G#3')).toBeTruthy();
      expect(getByText('A#3')).toBeTruthy();
    });

    it('renders labels with correct octave for startNote=60', () => {
      const { getByText } = render(
        <Keyboard showLabels={true} startNote={60} testID="kb" />,
      );
      expect(getByText('C4')).toBeTruthy();
      expect(getByText('G4')).toBeTruthy();
      expect(getByText('B5')).toBeTruthy();
    });
  });

  // -- 11. Labels hidden when showLabels is false --
  describe('showLabels=false', () => {
    it('does not render note name text when showLabels is false', () => {
      const { queryByText } = render(
        <Keyboard showLabels={false} testID="kb" />,
      );
      expect(queryByText('C3')).toBeNull();
      expect(queryByText('D3')).toBeNull();
      expect(queryByText('C#3')).toBeNull();
    });

    it('does not render note name text by default (showLabels defaults to false)', () => {
      const { queryByText } = render(<Keyboard testID="kb" />);
      expect(queryByText('C3')).toBeNull();
      expect(queryByText('E3')).toBeNull();
      expect(queryByText('F#3')).toBeNull();
    });
  });

  // -- 12. Disabled state prevents callbacks --
  describe('Disabled state', () => {
    it('does not fire onNoteOn when enabled=false and touch occurs', () => {
      const onNoteOn = jest.fn();
      const { getByTestId } = render(
        <Keyboard enabled={false} onNoteOn={onNoteOn} scrollable={false} testID="kb" />,
      );
      const container = getByTestId('kb');

      const mockEvent = {
        nativeEvent: {
          touches: [{ pageX: 50, pageY: 40, identifier: 0 }],
        },
      };
      container.props.onTouchStart?.(mockEvent);
      expect(onNoteOn).not.toHaveBeenCalled();
    });

    it('does not fire onNoteOff when enabled=false', () => {
      const onNoteOff = jest.fn();
      const { getByTestId } = render(
        <Keyboard enabled={false} onNoteOff={onNoteOff} scrollable={false} testID="kb" />,
      );
      const container = getByTestId('kb');

      const mockEvent = {
        nativeEvent: { touches: [] },
      };
      container.props.onTouchEnd?.(mockEvent);
      expect(onNoteOff).not.toHaveBeenCalled();
    });

    it('still renders all keys when disabled', () => {
      const { getByTestId } = render(
        <Keyboard enabled={false} testID="kb" />,
      );
      const keyboard = getByTestId('kb-keyboard');
      const whiteKeys = getWhiteKeyContainers(keyboard);
      const blackKeys = getBlackKeyOverlays(keyboard);
      expect(whiteKeys.length).toBe(14);
      expect(blackKeys.length).toBe(10);
    });
  });

  // -- 13. MinWidth 48px on white keys --
  describe('White key minWidth', () => {
    it('white key containers have minWidth of 48', () => {
      const { getByTestId } = render(<Keyboard testID="kb" />);
      const keyboard = getByTestId('kb-keyboard');
      const whiteKeyContainers = getWhiteKeyContainers(keyboard);

      expect(whiteKeyContainers.length).toBeGreaterThan(0);
      for (const container of whiteKeyContainers) {
        const style = flattenStyle(container.props.style);
        expect(style.minWidth).toBe(48);
      }
    });

    it('minWidth is applied regardless of octaveCount', () => {
      const { getByTestId } = render(
        <Keyboard octaveCount={1} testID="kb" />,
      );
      const keyboard = getByTestId('kb-keyboard');
      const whiteKeyContainers = getWhiteKeyContainers(keyboard);

      for (const container of whiteKeyContainers) {
        const style = flattenStyle(container.props.style);
        expect(style.minWidth).toBe(48);
      }
    });
  });

  // -- Additional edge cases --
  describe('Edge cases', () => {
    it('renders without crashing with no props', () => {
      const { toJSON } = render(<Keyboard />);
      expect(toJSON()).toBeTruthy();
    });

    it('forwards testID to both container and keyboard views', () => {
      const { getByTestId } = render(<Keyboard testID="my-keyboard" />);
      expect(getByTestId('my-keyboard')).toBeTruthy();
      expect(getByTestId('my-keyboard-keyboard')).toBeTruthy();
    });

    it('keyboard layout uses flexDirection row', () => {
      const { getByTestId } = render(<Keyboard testID="kb" />);
      const keyboard = getByTestId('kb-keyboard');
      const style = flattenStyle(keyboard.props.style);
      expect(style.flexDirection).toBe('row');
    });

    it('both highlighted and expected notes can be set simultaneously', () => {
      const highlighted = new Set([48]);
      const expected = new Set([52]);
      const { toJSON } = render(
        <Keyboard
          highlightedNotes={highlighted}
          expectedNotes={expected}
          testID="kb"
        />,
      );
      const tree = safeStringify(toJSON());
      expect(tree).toContain('#FFE6CC');
      expect(tree).toContain('#C8E6C9');
    });

    it('black key overlays have 65% height of keyboard', () => {
      const { getByTestId } = render(<Keyboard testID="kb" />);
      const keyboard = getByTestId('kb-keyboard');
      const blackKeys = getBlackKeyOverlays(keyboard);
      expect(blackKeys.length).toBeGreaterThan(0);
      for (const bk of blackKeys) {
        const style = flattenStyle(bk.props.style);
        expect(style.height).toBe('65%');
      }
    });
  });
});
