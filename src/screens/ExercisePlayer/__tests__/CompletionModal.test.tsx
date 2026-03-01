/**
 * CompletionModal Component Tests
 * Tests score display, star ratings, XP, action buttons, and pass/fail styling
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CompletionModal } from '../CompletionModal';
import type { Exercise, ExerciseScore } from '../../../core/exercises/types';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: {
      View: React.forwardRef((props: any, ref: any) =>
        React.createElement(View, { ...props, ref })
      ),
      Text: React.forwardRef((props: any, ref: any) =>
        React.createElement(Text, { ...props, ref })
      ),
      createAnimatedComponent: (Component: any) => Component,
    },
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: (fn: any) => fn(),
    withTiming: (val: any) => val,
    withSpring: (val: any) => val,
    withDelay: (_d: any, val: any) => val,
    withRepeat: (val: any) => val,
    withSequence: (...args: any[]) => args[args.length - 1],
    Easing: {
      out: (fn: any) => fn,
      cubic: (t: any) => t,
      linear: (t: any) => t,
      in: (fn: any) => fn,
    },
    FadeIn: { duration: () => ({ delay: () => ({ springify: () => ({}) }) }) },
    FadeInUp: { duration: () => ({ delay: () => ({ springify: () => ({}) }), springify: () => ({}) }), delay: () => ({ duration: () => ({}) }), springify: () => ({}) },
    FadeInDown: { duration: () => ({ delay: () => ({ springify: () => ({}) }), springify: () => ({}) }), springify: () => ({}) },
    runOnJS: (fn: any) => fn,
  };
});

jest.mock('../../../audio/SoundManager', () => ({
  soundManager: { play: jest.fn(), preload: jest.fn() },
}));

jest.mock('../../../components/Mascot/MascotBubble', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    MascotBubble: ({ message, mood }: any) =>
      React.createElement(
        View,
        { testID: 'mascot-bubble' },
        React.createElement(Text, null, message),
        React.createElement(Text, null, mood)
      ),
  };
});

jest.mock('../../../components/Mascot/CatAvatar', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CatAvatar: (props: any) =>
      React.createElement(View, { testID: 'cat-avatar', ...props }),
  };
});

jest.mock('../../../components/Mascot/3d', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Cat3DCanvas: (props: any) =>
      React.createElement(View, { testID: `cat-3d-${props.catId || 'default'}`, ...props }),
  };
});

jest.mock('../../../components/transitions/ConfettiEffect', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ConfettiEffect: (props: any) =>
      React.createElement(View, { testID: props.testID || 'confetti' }),
  };
});

jest.mock('../../../components/XpPopup', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    XpPopup: ({ amount }: any) =>
      React.createElement(Text, { testID: 'xp-popup' }, '+' + amount + ' XP'),
  };
});

jest.mock('../../../components/FunFact/FunFactCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    FunFactCard: (props: any) =>
      React.createElement(View, { testID: props.testID || 'fun-fact-card' }),
  };
});

jest.mock('../../../content/catDialogue', () => ({
  getRandomCatMessage: jest.fn(() => 'Great job, meow!'),
}));

jest.mock('../../../content/funFactSelector', () => ({
  getFactForExerciseType: jest.fn(() => ({
    id: 'fact-1',
    text: 'Piano has 88 keys',
    category: 'instrument',
    difficulty: 'beginner',
  })),
}));

jest.mock('../../../services/ai/CoachingService', () => ({
  coachingService: {
    generateFeedback: jest.fn().mockResolvedValue({
      feedback: 'Nice work! Focus on timing next time.',
      suggestedAction: 'continue',
    }),
  },
}));

jest.mock('../../../stores/progressStore', () => ({
  useProgressStore: Object.assign(jest.fn(() => ({})), {
    getState: jest.fn(() => ({
      level: 3,
      recordExerciseCompletion: jest.fn(),
    })),
  }),
}));

jest.mock('../../../stores/settingsStore', () => ({
  useSettingsStore: jest.fn((selector: any) => {
    const state = { selectedCatId: 'mini-meowww' };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

jest.mock('../../../stores/catEvolutionStore', () => ({
  useCatEvolutionStore: jest.fn((selector: any) => {
    const state = {
      evolutionData: {
        'mini-meowww': { currentStage: 'baby' },
      },
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

jest.mock('../../../components/Mascot/SalsaCoach', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SalsaCoach: (props: any) =>
      React.createElement(View, { testID: 'salsa-coach', ...props }),
  };
});

jest.mock('../../../services/tts/TTSService', () => ({
  ttsService: { speak: jest.fn(), stop: jest.fn() },
}));

jest.mock('../../../content/ContentLoader', () => ({
  getLessonIdForExercise: jest.fn(() => null),
}));

jest.mock('../../../components/common/Button', () => ({
  Button: (props: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={props.onPress} testID={props.testID} disabled={props.disabled}>
        <Text>{props.title}</Text>
      </TouchableOpacity>
    );
  },
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_EXERCISE: Exercise = {
  id: 'test-ex-1',
  version: 1,
  metadata: {
    title: 'C Major Scale',
    description: 'Play the C major scale ascending',
    difficulty: 2,
    estimatedMinutes: 3,
    skills: ['right-hand', 'c-major'],
    prerequisites: [],
  },
  settings: {
    tempo: 120,
    timeSignature: [4, 4],
    keySignature: 'C',
    countIn: 4,
    metronomeEnabled: true,
  },
  notes: [
    { note: 60, startBeat: 0, durationBeats: 1 },
    { note: 62, startBeat: 1, durationBeats: 1 },
    { note: 64, startBeat: 2, durationBeats: 1 },
  ],
  scoring: {
    timingToleranceMs: 50,
    timingGracePeriodMs: 150,
    passingScore: 70,
    starThresholds: [70, 85, 95],
  },
  hints: {
    beforeStart: 'Use your right hand',
    commonMistakes: [],
    successMessage: 'Well done!',
  },
};

const mockPassingScore: ExerciseScore = {
  overall: 85,
  breakdown: {
    accuracy: 90,
    timing: 80,
    completeness: 85,
    extraNotes: 0,
    duration: 90,
  },
  stars: 2,
  xpEarned: 50,
  isPassed: true,
  isNewHighScore: false,
  details: [],
};

const mockFailingScore: ExerciseScore = {
  overall: 40,
  breakdown: {
    accuracy: 45,
    timing: 35,
    completeness: 40,
    extraNotes: 10,
    duration: 50,
  },
  stars: 0,
  xpEarned: 5,
  isPassed: false,
  isNewHighScore: false,
  details: [],
};

const mockPerfectScore: ExerciseScore = {
  overall: 98,
  breakdown: {
    accuracy: 100,
    timing: 95,
    completeness: 100,
    extraNotes: 0,
    duration: 98,
  },
  stars: 3,
  xpEarned: 100,
  isPassed: true,
  isNewHighScore: true,
  details: [],
};

const mockOneStarScore: ExerciseScore = {
  overall: 72,
  breakdown: {
    accuracy: 75,
    timing: 70,
    completeness: 72,
    extraNotes: 5,
    duration: 70,
  },
  stars: 1,
  xpEarned: 20,
  isPassed: true,
  isNewHighScore: false,
  details: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompletionModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // 1. Renders score percentage
  it('renders score percentage sign', () => {
    const { getByText } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    // The animated counter starts at 0, but the "%" label is always visible
    expect(getByText('%')).toBeTruthy();
  });

  // 2. Shows star rating (0 stars)
  it('shows 0 stars with all star-outline icons for failing score', () => {
    const { getAllByText } = render(
      <CompletionModal
        score={mockFailingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    const starOutlines = getAllByText('star-outline');
    expect(starOutlines.length).toBe(3);
  });

  // 2b. Shows star rating (2 stars)
  it('shows 2 filled stars and 1 outline for passing score', () => {
    const { getAllByText } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    // 2 filled star icons + 1 'star' icon from the result section = 3 total
    const filledStars = getAllByText('star', { exact: true });
    const outlineStars = getAllByText('star-outline', { exact: true });
    expect(filledStars.length).toBe(3); // 2 star rating + 1 result icon
    expect(outlineStars.length).toBe(1);
  });

  // 2c. Shows star rating (3 stars)
  it('shows 3 filled stars for perfect score', () => {
    const { getAllByText } = render(
      <CompletionModal
        score={mockPerfectScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    const filledStars = getAllByText('star', { exact: true });
    expect(filledStars.length).toBe(3);
  });

  // 3. Shows XP earned
  it('shows XP earned value', () => {
    const { getByText } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(getByText('+50')).toBeTruthy();
    expect(getByText('XP Earned')).toBeTruthy();
  });

  // 4. Retry button calls onRetry
  it('calls onRetry when retry button is pressed', () => {
    const onRetry = jest.fn();
    const { getByTestId } = render(
      <CompletionModal
        score={mockFailingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        onRetry={onRetry}
        skipAnimation
      />
    );

    fireEvent.press(getByTestId('completion-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  // 5. Close button calls onClose
  it('calls onClose when continue button is pressed', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={onClose}
        skipAnimation
      />
    );

    fireEvent.press(getByTestId('completion-continue'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // 6. Next exercise button appears when onNextExercise provided
  it('shows Next Exercise button when onNextExercise is provided and passed', () => {
    const onNext = jest.fn();
    const { getByTestId } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        onNextExercise={onNext}
        skipAnimation
      />
    );

    const nextBtn = getByTestId('completion-next');
    expect(nextBtn).toBeTruthy();
    fireEvent.press(nextBtn);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  // 7. Next exercise button hidden when not provided
  it('hides Next Exercise button when onNextExercise is not provided', () => {
    const { queryByTestId } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(queryByTestId('completion-next')).toBeNull();
  });

  // 8. Mastery test button appears when onStartTest provided
  it('shows mastery test button when onStartTest is provided and passed', () => {
    const onStartTest = jest.fn();
    const { getByTestId } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        onStartTest={onStartTest}
        skipAnimation
      />
    );

    const testBtn = getByTestId('completion-start-test');
    expect(testBtn).toBeTruthy();
    fireEvent.press(testBtn);
    expect(onStartTest).toHaveBeenCalledTimes(1);
  });

  // 9. Demo button appears when onStartDemo provided
  it('shows demo button when onStartDemo is provided', () => {
    const onStartDemo = jest.fn();
    const { getByTestId } = render(
      <CompletionModal
        score={mockFailingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        onStartDemo={onStartDemo}
        skipAnimation
      />
    );

    const demoBtn = getByTestId('demo-prompt-button');
    expect(demoBtn).toBeTruthy();
    fireEvent.press(demoBtn);
    expect(onStartDemo).toHaveBeenCalledTimes(1);
  });

  // 10. Shows "Failed" styling when score below passing
  it('shows Try Again! text when score is below passing', () => {
    const { getByText } = render(
      <CompletionModal
        score={mockFailingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(getByText('Try Again!')).toBeTruthy();
  });

  // 11. Shows passing styling when score above threshold
  it('shows Great Job! text when score is passing with 2 stars', () => {
    const { getByText } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(getByText('Great Job!')).toBeTruthy();
  });

  // Additional coverage: result text variants
  it('shows Outstanding! for 3-star score', () => {
    const { getByText } = render(
      <CompletionModal
        score={mockPerfectScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(getByText('Outstanding!')).toBeTruthy();
  });

  it('shows Good Effort! for 1-star score', () => {
    const { getByText } = render(
      <CompletionModal
        score={mockOneStarScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(getByText('Good Effort!')).toBeTruthy();
  });

  it('renders exercise title in header', () => {
    const { getByText } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(getByText('C Major Scale')).toBeTruthy();
  });

  it('renders breakdown bars with correct values', () => {
    const { getByText, getAllByText } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(getByText('Accuracy')).toBeTruthy();
    expect(getByText('Timing')).toBeTruthy();
    expect(getByText('Completeness')).toBeTruthy();
    expect(getByText('Duration')).toBeTruthy();
    expect(getByText('Extra Notes')).toBeTruthy();
    // 90% appears twice (accuracy + duration), so use getAllByText
    expect(getAllByText('90%').length).toBeGreaterThanOrEqual(1);
    expect(getByText('80%')).toBeTruthy();
    expect(getByText('85%')).toBeTruthy();
  });

  it('renders confetti for 3-star scores', () => {
    const { getByTestId } = render(
      <CompletionModal
        score={mockPerfectScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(getByTestId('completion-confetti')).toBeTruthy();
  });

  it('does not render confetti for non-3-star scores', () => {
    const { queryByTestId } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(queryByTestId('completion-confetti')).toBeNull();
  });

  it('shows New Record badge for new high score', () => {
    const { getByText } = render(
      <CompletionModal
        score={mockPerfectScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(getByText('New Record!')).toBeTruthy();
  });

  it('hides mastery test button when score is not passed', () => {
    const { queryByTestId } = render(
      <CompletionModal
        score={mockFailingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        onStartTest={jest.fn()}
        skipAnimation
      />
    );

    expect(queryByTestId('completion-start-test')).toBeNull();
  });

  it('shows Mastery Test Complete subtitle in test mode', () => {
    const { getByText } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        isTestMode={true}
        skipAnimation
      />
    );

    expect(getByText('Mastery Test Complete!')).toBeTruthy();
  });

  it('shows Exercise Complete subtitle when not in test mode', () => {
    const { getByText } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        skipAnimation
      />
    );

    expect(getByText('Exercise Complete!')).toBeTruthy();
  });

  it('mastery test button takes priority over next exercise button', () => {
    const { queryByTestId, getByTestId } = render(
      <CompletionModal
        score={mockPassingScore}
        exercise={MOCK_EXERCISE}
        onClose={jest.fn()}
        onNextExercise={jest.fn()}
        onStartTest={jest.fn()}
        skipAnimation
      />
    );

    expect(getByTestId('completion-start-test')).toBeTruthy();
    expect(queryByTestId('completion-next')).toBeNull();
  });
});
