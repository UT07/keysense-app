/**
 * LessonIntroScreen UI Tests
 *
 * Tests the pre-lesson overview screen: header rendering, exercise list,
 * skills display, progress tracking, start/replay button, error state,
 * tutorial section visibility, and navigation.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Navigation mock with route params
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams: any = { lessonId: 'lesson-01' };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// ---------------------------------------------------------------------------
// expo-linear-gradient mock
// ---------------------------------------------------------------------------

jest.mock('expo-linear-gradient', () => {
  const mockReact = require('react');
  const RN = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      mockReact.createElement(RN.View, props, children),
  };
});

// ---------------------------------------------------------------------------
// Component mocks (CatAvatar, MascotBubble, FunFactCard)
// ---------------------------------------------------------------------------

jest.mock('../../components/Mascot/CatAvatar', () => ({
  CatAvatar: (props: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `cat-avatar-${props.catId}` });
  },
}));

jest.mock('../../components/Mascot/MascotBubble', () => ({
  MascotBubble: (props: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'mascot-bubble' }, props.message);
  },
}));

jest.mock('../../components/FunFact/FunFactCard', () => ({
  FunFactCard: (props: any) => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: props.testID ?? 'fun-fact-card' }, 'Fun fact');
  },
}));

// ---------------------------------------------------------------------------
// Content mocks
// ---------------------------------------------------------------------------

const MOCK_LESSON = {
  id: 'lesson-01',
  version: 1,
  metadata: {
    title: 'Hello Piano',
    description: 'First steps on the keyboard',
    difficulty: 1,
    estimatedMinutes: 10,
    skills: ['notes', 'rhythm'],
  },
  exercises: [
    { id: 'lesson-01-ex-01', title: 'Find Middle C', order: 1, required: true },
    { id: 'lesson-01-ex-02', title: 'Keyboard Geography', order: 2, required: true },
    { id: 'lesson-01-ex-03', title: 'Bonus Challenge', order: 3, required: false },
  ],
  unlockRequirement: null,
  xpReward: 50,
  estimatedMinutes: 10,
};

jest.mock('../../content/ContentLoader', () => ({
  getLesson: (id: string) => (id === 'lesson-01' ? MOCK_LESSON : null),
  getLessons: () => [MOCK_LESSON],
  getLessonExercises: () => MOCK_LESSON.exercises,
}));

jest.mock('../../content/funFactSelector', () => ({
  getFactForLesson: () => ({
    id: 'test-fact',
    text: 'Pianos have 88 keys',
    category: 'instrument',
    icon: 'piano',
  }),
}));

const MOCK_TUTORIAL = {
  title: 'Getting Started',
  steps: [
    { icon: 'music-note', text: 'Find the middle C key' },
    { icon: 'hand-pointing-right', text: 'Press gently with your index finger' },
  ],
  tip: 'Relax your wrists while playing!',
};

jest.mock('../../content/lessonTutorials', () => ({
  getLessonTutorial: (id: string) => (id === 'lesson-01' ? MOCK_TUTORIAL : null),
}));

// ---------------------------------------------------------------------------
// SkillTree mock — returns skill node lookups for AI navigation
// ---------------------------------------------------------------------------

const SKILL_LOOKUP: Record<string, { id: string }[]> = {
  'lesson-01-ex-01': [{ id: 'find-middle-c' }],
  'lesson-01-ex-02': [{ id: 'keyboard-geography' }],
  'lesson-01-ex-03': [],
};

jest.mock('../../core/curriculum/SkillTree', () => ({
  getSkillsForExercise: (exId: string) => SKILL_LOOKUP[exId] ?? [],
}));

// ---------------------------------------------------------------------------
// Zustand store mocks
// ---------------------------------------------------------------------------

let mockProgressState: any = {
  totalXp: 0,
  level: 1,
  streakData: { currentStreak: 0 },
  lessonProgress: {},
  dailyGoalData: {},
};

jest.mock('../../stores/progressStore', () => ({
  useProgressStore: Object.assign(
    (sel?: any) => (sel ? sel(mockProgressState) : mockProgressState),
    { getState: () => mockProgressState },
  ),
}));

const mockSetShowTutorials = jest.fn();

let mockSettingsState: any = {
  selectedCatId: 'mini-meowww',
  showTutorials: true,
  setShowTutorials: mockSetShowTutorials,
  displayName: 'Test',
  hasCompletedOnboarding: true,
};

jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    (sel?: any) => (sel ? sel(mockSettingsState) : mockSettingsState),
    { getState: () => mockSettingsState },
  ),
}));

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------

import { LessonIntroScreen } from '../LessonIntroScreen';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockSetShowTutorials.mockClear();
  mockRouteParams = { lessonId: 'lesson-01' };
  mockProgressState.lessonProgress = {};
  mockSettingsState.showTutorials = true;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LessonIntroScreen', () => {
  beforeEach(resetMocks);

  // =========================================================================
  // Header rendering
  // =========================================================================

  it('renders lesson number label', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('LESSON 1')).toBeTruthy();
  });

  it('renders lesson title', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('Hello Piano')).toBeTruthy();
  });

  it('renders lesson description', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('First steps on the keyboard')).toBeTruthy();
  });

  it('renders XP reward badge', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('50 XP')).toBeTruthy();
  });

  // =========================================================================
  // Exercise list
  // =========================================================================

  it('renders "Exercises" section title', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('Exercises')).toBeTruthy();
  });

  it('lists all exercise titles', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('Find Middle C')).toBeTruthy();
    expect(getByText('Keyboard Geography')).toBeTruthy();
    expect(getByText('Bonus Challenge')).toBeTruthy();
  });

  it('shows BONUS badge for non-required exercises', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('BONUS')).toBeTruthy();
  });

  it('shows check icon for completed exercises', () => {
    mockProgressState.lessonProgress = {
      'lesson-01': {
        status: 'in_progress',
        exerciseScores: {
          'lesson-01-ex-01': { completedAt: '2026-02-16', stars: 3 },
        },
      },
    };
    const { getAllByText } = render(<LessonIntroScreen />);
    // "check" icon from our mock + "check-circle" for completed indicator
    expect(getAllByText('check').length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Skills display
  // =========================================================================

  it('renders "Skills You\'ll Learn" section', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText("Skills You'll Learn")).toBeTruthy();
  });

  it('renders skill chips with formatted names', () => {
    const { getByText } = render(<LessonIntroScreen />);
    // "notes" -> "Notes", "rhythm" -> "Rhythm"
    expect(getByText('Notes')).toBeTruthy();
    expect(getByText('Rhythm')).toBeTruthy();
  });

  // =========================================================================
  // Info row
  // =========================================================================

  it('renders difficulty label', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('Difficulty')).toBeTruthy();
  });

  it('renders estimated time', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('~10 min')).toBeTruthy();
  });

  it('renders progress count (0/3 for fresh user)', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('0/3')).toBeTruthy();
  });

  // =========================================================================
  // Mascot & fun fact
  // =========================================================================

  it('renders CatAvatar with selected cat', () => {
    const { getByTestId } = render(<LessonIntroScreen />);
    expect(getByTestId('cat-avatar-mini-meowww')).toBeTruthy();
  });

  it('renders mascot bubble', () => {
    const { getByTestId } = render(<LessonIntroScreen />);
    expect(getByTestId('mascot-bubble')).toBeTruthy();
  });

  it('renders fun fact card', () => {
    const { getByTestId } = render(<LessonIntroScreen />);
    expect(getByTestId('lesson-intro-fun-fact')).toBeTruthy();
  });

  // =========================================================================
  // Tutorial section
  // =========================================================================

  it('shows tutorial when showTutorials is true', () => {
    mockSettingsState.showTutorials = true;
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('Getting Started')).toBeTruthy();
  });

  it('shows tutorial steps', () => {
    mockSettingsState.showTutorials = true;
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('Find the middle C key')).toBeTruthy();
    expect(getByText('Press gently with your index finger')).toBeTruthy();
  });

  it('shows tutorial tip', () => {
    mockSettingsState.showTutorials = true;
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('Relax your wrists while playing!')).toBeTruthy();
  });

  it('hides tutorial when dismissed via close button', () => {
    mockSettingsState.showTutorials = true;
    const { getByText, queryByText } = render(<LessonIntroScreen />);
    // The close button renders "close" icon text
    fireEvent.press(getByText('close'));
    expect(queryByText('Getting Started')).toBeNull();
  });

  it('calls setShowTutorials when toggling tutorial visibility', () => {
    const { getByText } = render(<LessonIntroScreen />);
    fireEvent.press(getByText('Hide tutorials'));
    expect(mockSetShowTutorials).toHaveBeenCalledWith(false);
  });

  // =========================================================================
  // Start button
  // =========================================================================

  it('shows "Start Lesson" button for incomplete lesson', () => {
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('Start Lesson')).toBeTruthy();
  });

  it('shows "Replay Lesson" button when all exercises completed', () => {
    mockProgressState.lessonProgress = {
      'lesson-01': {
        status: 'completed',
        exerciseScores: {
          'lesson-01-ex-01': { completedAt: '2026-02-16', stars: 3 },
          'lesson-01-ex-02': { completedAt: '2026-02-16', stars: 3 },
          'lesson-01-ex-03': { completedAt: '2026-02-16', stars: 2 },
        },
      },
    };
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('Replay Lesson')).toBeTruthy();
  });

  it('navigates to first uncompleted exercise on Start', () => {
    const { getByText } = render(<LessonIntroScreen />);
    fireEvent.press(getByText('Start Lesson'));
    expect(mockNavigate).toHaveBeenCalledWith('Exercise', {
      exerciseId: 'lesson-01-ex-01',
    });
  });

  it('navigates to second exercise when first is completed', () => {
    mockProgressState.lessonProgress = {
      'lesson-01': {
        status: 'in_progress',
        exerciseScores: {
          'lesson-01-ex-01': { completedAt: '2026-02-16', stars: 3 },
        },
      },
    };
    const { getByText } = render(<LessonIntroScreen />);
    fireEvent.press(getByText('Start Lesson'));
    expect(mockNavigate).toHaveBeenCalledWith('Exercise', {
      exerciseId: 'lesson-01-ex-02',
    });
  });

  // =========================================================================
  // Navigation
  // =========================================================================

  it('calls goBack when pressing back button', () => {
    const { getByText } = render(<LessonIntroScreen />);
    fireEvent.press(getByText('arrow-left'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // Error state — lesson not found
  // =========================================================================

  it('shows "Lesson not found" for invalid lessonId', () => {
    mockRouteParams = { lessonId: 'nonexistent' };
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('Lesson not found')).toBeTruthy();
  });

  it('shows Go Back button in error state', () => {
    mockRouteParams = { lessonId: 'nonexistent' };
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('Go Back')).toBeTruthy();
  });

  it('navigates back from error state', () => {
    mockRouteParams = { lessonId: 'nonexistent' };
    const { getByText } = render(<LessonIntroScreen />);
    fireEvent.press(getByText('Go Back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // Progress display
  // =========================================================================

  it('shows correct completed count with partial progress', () => {
    mockProgressState.lessonProgress = {
      'lesson-01': {
        status: 'in_progress',
        exerciseScores: {
          'lesson-01-ex-01': { completedAt: '2026-02-16', stars: 2 },
          'lesson-01-ex-02': { completedAt: '2026-02-16', stars: 3 },
        },
      },
    };
    const { getByText } = render(<LessonIntroScreen />);
    expect(getByText('2/3')).toBeTruthy();
  });
});
