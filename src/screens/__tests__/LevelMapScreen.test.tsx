/**
 * LevelMapScreen UI Tests
 *
 * Tests the Duolingo-style vertical level map: lesson node rendering,
 * state-driven styling (completed / current / locked), navigation on tap,
 * header stats display, and auto-scroll to current node.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Navigation mock
// ---------------------------------------------------------------------------

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: {} }),
  NavigationContainer: ({ children }: any) => children,
}));

// ---------------------------------------------------------------------------
// react-native-svg mock (LevelMapScreen uses Svg + Path for connectors)
// ---------------------------------------------------------------------------

jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const RN = require('react-native');

  const Svg = ({ children, ...props }: any) =>
    mockReact.createElement(RN.View, { ...props, testID: 'svg-container' }, children);

  const Path = (props: any) =>
    mockReact.createElement(RN.View, { ...props, testID: `svg-path-${props.stroke || 'default'}` });

  return { __esModule: true, default: Svg, Svg, Path };
});

// ---------------------------------------------------------------------------
// expo-linear-gradient mock
// ---------------------------------------------------------------------------

jest.mock('expo-linear-gradient', () => {
  const mockReact = require('react');
  const RN = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      mockReact.createElement(RN.View, { ...props, testID: 'linear-gradient' }, children),
  };
});

// ---------------------------------------------------------------------------
// Zustand store mocks
// ---------------------------------------------------------------------------

let mockProgressState: any = {
  totalXp: 500,
  level: 3,
  streakData: { currentStreak: 5, longestStreak: 10, lastPracticeDate: '2026-02-16' },
  lessonProgress: {},
  dailyGoalData: {},
  recordExerciseCompletion: jest.fn(),
  addXp: jest.fn(),
  setLevel: jest.fn(),
  updateStreakData: jest.fn(),
  updateLessonProgress: jest.fn(),
  updateExerciseProgress: jest.fn(),
  getLessonProgress: jest.fn(),
  getExerciseProgress: jest.fn(),
  recordPracticeSession: jest.fn(),
  updateDailyGoal: jest.fn(),
  reset: jest.fn(),
};

jest.mock('../../stores/progressStore', () => ({
  useProgressStore: Object.assign(
    (sel?: any) => (sel ? sel(mockProgressState) : mockProgressState),
    { getState: () => mockProgressState },
  ),
}));

// ---------------------------------------------------------------------------
// ContentLoader mock — 3 lessons with exercises
// ---------------------------------------------------------------------------

const MOCK_LESSONS = [
  {
    id: 'lesson-01',
    version: 1,
    metadata: { title: 'Hello Piano', description: 'First steps', difficulty: 1, estimatedMinutes: 10, skills: ['notes'] },
    exercises: [
      { id: 'lesson-01-ex-01', title: 'Find Middle C', order: 1, required: true },
      { id: 'lesson-01-ex-02', title: 'Keyboard Geo', order: 2, required: true },
    ],
    unlockRequirement: null,
    xpReward: 50,
    estimatedMinutes: 10,
  },
  {
    id: 'lesson-02',
    version: 1,
    metadata: { title: 'C Major Scale', description: 'Scales intro', difficulty: 2, estimatedMinutes: 15, skills: ['scales'] },
    exercises: [
      { id: 'lesson-02-ex-01', title: 'CDE Simple', order: 1, required: true },
      { id: 'lesson-02-ex-02', title: 'CDEFG', order: 2, required: true },
      { id: 'lesson-02-ex-03', title: 'Full Scale', order: 3, required: true },
    ],
    unlockRequirement: { type: 'lesson', lessonId: 'lesson-01' },
    xpReward: 75,
    estimatedMinutes: 15,
  },
  {
    id: 'lesson-03',
    version: 1,
    metadata: { title: 'Simple Melodies', description: 'Play songs', difficulty: 2, estimatedMinutes: 20, skills: ['melodies'] },
    exercises: [
      { id: 'lesson-03-ex-01', title: 'Mary Lamb', order: 1, required: true },
    ],
    unlockRequirement: { type: 'lesson', lessonId: 'lesson-02' },
    xpReward: 100,
    estimatedMinutes: 20,
  },
];

const MOCK_EXERCISES: Record<string, any[]> = {
  'lesson-01': MOCK_LESSONS[0].exercises,
  'lesson-02': MOCK_LESSONS[1].exercises,
  'lesson-03': MOCK_LESSONS[2].exercises,
};

jest.mock('../../content/ContentLoader', () => ({
  getLessons: () => MOCK_LESSONS,
  getLessonExercises: (id: string) => MOCK_EXERCISES[id] ?? [],
}));

// ---------------------------------------------------------------------------
// Import component under test AFTER all mocks are set up
// ---------------------------------------------------------------------------

import { LevelMapScreen } from '../LevelMapScreen';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
  mockNavigate.mockClear();
  mockProgressState = {
    ...mockProgressState,
    lessonProgress: {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LevelMapScreen', () => {
  beforeEach(resetMocks);

  // =========================================================================
  // Rendering basics
  // =========================================================================

  it('renders the header title "Your Journey"', () => {
    const { getByText } = render(<LevelMapScreen />);
    expect(getByText('Your Journey')).toBeTruthy();
  });

  it('renders all lesson nodes with their titles', () => {
    const { getByText } = render(<LevelMapScreen />);
    expect(getByText('Hello Piano')).toBeTruthy();
    expect(getByText('C Major Scale')).toBeTruthy();
    expect(getByText('Simple Melodies')).toBeTruthy();
  });

  it('renders gradient header', () => {
    const { getByTestId } = render(<LevelMapScreen />);
    expect(getByTestId('linear-gradient')).toBeTruthy();
  });

  // =========================================================================
  // Node states — fresh user (no progress)
  // =========================================================================

  describe('fresh user (no progress)', () => {
    beforeEach(() => {
      mockProgressState.lessonProgress = {};
    });

    it('shows lesson 1 as current (play icon + START chip)', () => {
      const { getByText, getAllByText } = render(<LevelMapScreen />);
      expect(getByText('START')).toBeTruthy();
      // The play icon is rendered as text "play" by our icon mock
      expect(getAllByText('play').length).toBeGreaterThanOrEqual(1);
    });

    it('shows lessons 2 and 3 as locked', () => {
      const { getAllByText } = render(<LevelMapScreen />);
      // Lock icons rendered as "lock" text by mock
      const locks = getAllByText('lock');
      expect(locks).toHaveLength(2);
    });

    it('shows "Complete previous" hint on locked lessons', () => {
      const { getAllByText } = render(<LevelMapScreen />);
      const hints = getAllByText('Complete previous');
      expect(hints).toHaveLength(2);
    });

    it('header shows 0/3 completed count', () => {
      const { getByText } = render(<LevelMapScreen />);
      expect(getByText('0/3')).toBeTruthy();
    });
  });

  // =========================================================================
  // Node states — lesson 1 completed
  // =========================================================================

  describe('lesson 1 completed', () => {
    beforeEach(() => {
      mockProgressState.lessonProgress = {
        'lesson-01': {
          status: 'completed',
          exerciseScores: {
            'lesson-01-ex-01': { completedAt: '2026-02-15', stars: 3 },
            'lesson-01-ex-02': { completedAt: '2026-02-15', stars: 2 },
          },
        },
      };
    });

    it('shows lesson 1 with check icon (completed)', () => {
      const { getAllByText } = render(<LevelMapScreen />);
      expect(getAllByText('check-bold').length).toBeGreaterThanOrEqual(1);
    });

    it('shows stars for completed lesson', () => {
      const { getAllByText } = render(<LevelMapScreen />);
      // Stars are rendered as "star" or "star-outline" by the icon mock
      const stars = getAllByText('star');
      expect(stars.length).toBeGreaterThanOrEqual(1);
    });

    it('shows lesson 2 as current', () => {
      const { getByText } = render(<LevelMapScreen />);
      expect(getByText('START')).toBeTruthy();
    });

    it('shows lesson 3 still locked', () => {
      const { getAllByText } = render(<LevelMapScreen />);
      const locks = getAllByText('lock');
      expect(locks).toHaveLength(1);
    });

    it('header shows 1/3 completed count', () => {
      const { getByText } = render(<LevelMapScreen />);
      expect(getByText('1/3')).toBeTruthy();
    });
  });

  // =========================================================================
  // Node states — all completed
  // =========================================================================

  describe('all lessons completed', () => {
    beforeEach(() => {
      mockProgressState.lessonProgress = {
        'lesson-01': {
          status: 'completed',
          exerciseScores: {
            'lesson-01-ex-01': { completedAt: '2026-02-15', stars: 3 },
            'lesson-01-ex-02': { completedAt: '2026-02-15', stars: 3 },
          },
        },
        'lesson-02': {
          status: 'completed',
          exerciseScores: {
            'lesson-02-ex-01': { completedAt: '2026-02-16', stars: 3 },
            'lesson-02-ex-02': { completedAt: '2026-02-16', stars: 2 },
            'lesson-02-ex-03': { completedAt: '2026-02-16', stars: 3 },
          },
        },
        'lesson-03': {
          status: 'completed',
          exerciseScores: {
            'lesson-03-ex-01': { completedAt: '2026-02-16', stars: 3 },
          },
        },
      };
    });

    it('shows all 3 check icons', () => {
      const { getAllByText } = render(<LevelMapScreen />);
      expect(getAllByText('check-bold')).toHaveLength(3);
    });

    it('shows no locked nodes', () => {
      const { queryAllByText } = render(<LevelMapScreen />);
      expect(queryAllByText('lock')).toHaveLength(0);
    });

    it('shows no START chip', () => {
      const { queryByText } = render(<LevelMapScreen />);
      expect(queryByText('START')).toBeNull();
    });

    it('header shows 3/3 completed count', () => {
      const { getByText } = render(<LevelMapScreen />);
      expect(getByText('3/3')).toBeTruthy();
    });
  });

  // =========================================================================
  // Current lesson with partial progress
  // =========================================================================

  describe('current lesson with partial progress', () => {
    beforeEach(() => {
      mockProgressState.lessonProgress = {
        'lesson-01': {
          status: 'in_progress',
          exerciseScores: {
            'lesson-01-ex-01': { completedAt: '2026-02-15', stars: 2 },
            // ex-02 not yet completed
          },
        },
      };
    });

    it('shows progress count on current lesson (1/2)', () => {
      const { getByText } = render(<LevelMapScreen />);
      expect(getByText('1/2')).toBeTruthy();
    });
  });

  // =========================================================================
  // Navigation
  // =========================================================================

  describe('navigation', () => {
    it('navigates to LessonIntro when tapping current lesson', () => {
      const { getByText } = render(<LevelMapScreen />);
      fireEvent.press(getByText('Hello Piano'));
      expect(mockNavigate).toHaveBeenCalledWith('LessonIntro', { lessonId: 'lesson-01' });
    });

    it('navigates to LessonIntro when tapping completed lesson', () => {
      mockProgressState.lessonProgress = {
        'lesson-01': {
          status: 'completed',
          exerciseScores: {
            'lesson-01-ex-01': { completedAt: '2026-02-15', stars: 3 },
            'lesson-01-ex-02': { completedAt: '2026-02-15', stars: 3 },
          },
        },
      };
      const { getByText } = render(<LevelMapScreen />);
      fireEvent.press(getByText('Hello Piano'));
      expect(mockNavigate).toHaveBeenCalledWith('LessonIntro', { lessonId: 'lesson-01' });
    });

    it('does NOT navigate when tapping a locked lesson', () => {
      const { getByText } = render(<LevelMapScreen />);
      fireEvent.press(getByText('C Major Scale'));
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SVG connectors
  // =========================================================================

  it('renders SVG connector paths between nodes', () => {
    const { getByTestId } = render(<LevelMapScreen />);
    // SVG container is present
    expect(getByTestId('svg-container')).toBeTruthy();
  });

  // =========================================================================
  // Header star total
  // =========================================================================

  it('displays total stars across all completed lessons', () => {
    mockProgressState.lessonProgress = {
      'lesson-01': {
        status: 'completed',
        exerciseScores: {
          'lesson-01-ex-01': { completedAt: '2026-02-15', stars: 3 },
          'lesson-01-ex-02': { completedAt: '2026-02-15', stars: 2 },
        },
      },
    };
    const { getByText } = render(<LevelMapScreen />);
    // Total stars: 3 + 2 = 5 displayed in header badge
    expect(getByText('5')).toBeTruthy();
  });
});
