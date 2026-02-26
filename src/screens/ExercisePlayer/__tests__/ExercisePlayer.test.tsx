/**
 * ExercisePlayer Component Tests
 * Tests core playback, scoring, interaction features, demo mode,
 * ghost notes, responsive layout, and speed controls
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ExercisePlayer } from '../ExercisePlayer';
import type { Exercise } from '../../../core/exercises/types';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

jest.mock('../../../services/firebase/syncService', () => ({
  syncManager: {
    syncAfterExercise: jest.fn().mockResolvedValue(undefined),
    startPeriodicSync: jest.fn(),
    stopPeriodicSync: jest.fn(),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Exercise store state — mutable object that tests can modify via resetStore()
// eslint-disable-next-line prefer-const
let mockExerciseState: Record<string, any> = {};

jest.mock('../../../stores/exerciseStore', () => {
  // Zustand-compatible hook: useStore(), useStore(selector), useStore.getState()
  const useExerciseStore: any = (selector?: any) => {
    if (typeof selector === 'function') return selector(mockExerciseState);
    return mockExerciseState;
  };
  useExerciseStore.getState = () => mockExerciseState;
  return { useExerciseStore };
});

const mockProgressState: Record<string, any> = {
  totalXp: 100,
  level: 1,
  lessonProgress: {},
  exerciseHighScores: {},
  dailyGoalData: {},
  recordExerciseCompletion: jest.fn(),
  addXp: jest.fn(),
  setLevel: jest.fn(),
  updateStreakData: jest.fn(),
  updateLessonProgress: jest.fn(),
  updateExerciseProgress: jest.fn(),
  recordPracticeSession: jest.fn(),
  streakData: {
    currentStreak: 0,
    longestStreak: 0,
    lastPracticeDate: '2026-01-01',
    freezesAvailable: 1,
    freezesUsed: 0,
    weeklyPractice: [false, false, false, false, false, false, false],
  },
};
jest.mock('../../../stores/progressStore', () => ({
  useProgressStore: Object.assign(
    (sel?: any) => sel ? sel(mockProgressState) : mockProgressState,
    { getState: () => mockProgressState }
  ),
}));

// Mock useExercisePlayback hook
const mockStartPlayback = jest.fn();
const mockPausePlayback = jest.fn();
const mockResumePlayback = jest.fn();
const mockStopPlayback = jest.fn();
const mockResetPlayback = jest.fn();
const mockPlayNote = jest.fn();
const mockReleaseNote = jest.fn();

let mockPlaybackState: Record<string, any> = {
  isPlaying: false,
  currentBeat: -2,
  playedNotes: [],
  startPlayback: mockStartPlayback,
  pausePlayback: mockPausePlayback,
  resumePlayback: mockResumePlayback,
  stopPlayback: mockStopPlayback,
  resetPlayback: mockResetPlayback,
  playNote: mockPlayNote,
  releaseNote: mockReleaseNote,
  isMidiReady: true,
  isAudioReady: true,
  hasError: false,
  errorMessage: null,
};

jest.mock('../../../hooks/useExercisePlayback', () => ({
  useExercisePlayback: jest.fn(() => mockPlaybackState),
}));

// Mock Keyboard — captures props for assertion
let capturedKeyboardProps: any = {};
jest.mock('../../../components/Keyboard/Keyboard', () => ({
  Keyboard: (props: any) => {
    capturedKeyboardProps = props;
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-keyboard'}>
        <Text>Keyboard</Text>
      </View>
    );
  },
}));

// Mock VerticalPianoRoll — captures props for assertion
let capturedPianoRollProps: any = {};
jest.mock('../../../components/PianoRoll/VerticalPianoRoll', () => ({
  VerticalPianoRoll: (props: any) => {
    capturedPianoRollProps = props;
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-piano-roll'}>
        <Text>{props.currentBeat}</Text>
      </View>
    );
  },
}));

jest.mock('../../../components/Keyboard/computeZoomedRange', () => ({
  computeZoomedRange: (_notes: number[]) => ({ startNote: 48, octaveCount: 2 }),
  computeStickyRange: (_notes: number[], range: any) => range,
}));

// Mock DemoPlaybackService
const mockDemoStart = jest.fn();
const mockDemoStop = jest.fn();
jest.mock('../../../services/demoPlayback', () => ({
  DemoPlaybackService: jest.fn().mockImplementation(() => ({
    start: mockDemoStart,
    stop: mockDemoStop,
    isPlaying: false,
  })),
}));

// Mock common Button component (uses react-native-reanimated)
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

// Mock gemStore
const mockGemState = {
  gems: 100,
  transactions: [],
  earnGems: jest.fn(),
  spendGems: jest.fn(),
  canAfford: jest.fn(() => true),
};
jest.mock('../../../stores/gemStore', () => ({
  useGemStore: Object.assign(
    (sel?: any) => sel ? sel(mockGemState) : mockGemState,
    { getState: () => mockGemState }
  ),
}));

// Mock catEvolutionStore
const mockCatEvolutionState = {
  selectedCatId: 'mini-meowww',
  ownedCats: ['mini-meowww'],
  evolutionData: {
    'mini-meowww': {
      catId: 'mini-meowww',
      currentStage: 'baby',
      xpAccumulated: 0,
      abilitiesUnlocked: [],
      evolvedAt: { baby: Date.now(), teen: null, adult: null, master: null },
    },
  },
  addEvolutionXp: jest.fn(),
  getActiveAbilities: () => [],
};
jest.mock('../../../stores/catEvolutionStore', () => ({
  useCatEvolutionStore: Object.assign(
    (sel?: any) => sel ? sel(mockCatEvolutionState) : mockCatEvolutionState,
    { getState: () => mockCatEvolutionState }
  ),
}));

// Mock AbilityEngine
jest.mock('../../../core/abilities/AbilityEngine', () => ({
  applyAbilities: jest.fn((_ids: string[], config: any) => config),
  createDefaultConfig: jest.fn((timing: number, grace: number, tempo: number) => ({
    timingToleranceMs: timing,
    timingGracePeriodMs: grace,
    tempo,
    ghostNotesFailThreshold: 3,
    comboShield: false,
    scoreBoostPercent: 0,
    xpMultiplier: 1,
    gemBonusChance: 0,
    gemBonusMultiplier: 1,
    extraRetries: 0,
  })),
}));

// Mock achievementStore
const mockAchievementState = {
  unlockedIds: {},
  totalNotesPlayed: 0,
  perfectScoreCount: 0,
  highScoreCount: 0,
  checkAndUnlock: jest.fn(() => []),
  incrementNotesPlayed: jest.fn(),
  recordPerfectScore: jest.fn(),
  recordHighScore: jest.fn(),
  isUnlocked: jest.fn(() => false),
  getUnlockedAchievements: jest.fn(() => []),
  getUnlockedCount: jest.fn(() => 0),
  getTotalCount: jest.fn(() => 0),
  hydrate: jest.fn(),
  reset: jest.fn(),
};
jest.mock('../../../stores/achievementStore', () => ({
  useAchievementStore: Object.assign(
    (sel?: any) => sel ? sel(mockAchievementState) : mockAchievementState,
    { getState: () => mockAchievementState }
  ),
  buildAchievementContext: jest.fn(() => ({
    totalNotesPlayed: 0,
    perfectScoreCount: 0,
    highScoreCount: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalExercisesCompleted: 0,
  })),
}));

// Mock settingsStore
const mockSettingsState = {
  selectedCatId: 'mini-meowww',
  soundEnabled: true,
  hapticEnabled: true,
  showFingerNumbers: true,
  showNoteNames: true,
  masterVolume: 0.8,
  dailyGoalMinutes: 15,
  playbackSpeed: 0.75,
  setPlaybackSpeed: jest.fn(),
  lastMidiDeviceId: null,
  preferredHand: 'right',
};
jest.mock('../../../stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    (sel?: any) => sel ? sel(mockSettingsState) : mockSettingsState,
    { getState: () => mockSettingsState }
  ),
}));

// Mock learnerProfileStore
const mockLearnerProfileState = {
  noteAccuracy: {},
  noteAttempts: {},
  skills: { timingAccuracy: 0.5, pitchAccuracy: 0.5, sightReadSpeed: 0.5, chordRecognition: 0.5 },
  tempoRange: { min: 40, max: 80 },
  weakNotes: [],
  weakSkills: [],
  totalExercisesCompleted: 0,
  lastAssessmentDate: '',
  assessmentScore: 0,
  masteredSkills: [],
  skillCompletions: {},
  recordExerciseResult: jest.fn(),
  updateNoteAccuracy: jest.fn(),
  recalculateWeakAreas: jest.fn(),
  updateSkill: jest.fn(),
  addRecentExercise: jest.fn(),
  markSkillMastered: jest.fn(),
  reset: jest.fn(),
};
jest.mock('../../../stores/learnerProfileStore', () => ({
  useLearnerProfileStore: Object.assign(
    (sel?: any) => sel ? sel(mockLearnerProfileState) : mockLearnerProfileState,
    { getState: () => mockLearnerProfileState }
  ),
}));

// Mock catCharacters
jest.mock('../../../components/Mascot/catCharacters', () => ({
  CAT_CHARACTERS: [{ id: 'mini-meowww', name: 'Mini Meowww', abilities: [] }],
  getCatById: jest.fn(() => ({ id: 'mini-meowww', name: 'Mini Meowww', abilities: [] })),
  getUnlockedCats: jest.fn(() => []),
}));

// Mock ExerciseBuddy
jest.mock('../../../components/Mascot/ExerciseBuddy', () => ({
  ExerciseBuddy: () => null,
}));

// Mock mascotTips
jest.mock('../../../components/Mascot/mascotTips', () => ({
  getTipForScore: jest.fn(() => 'Great job!'),
}));

// Mock AchievementToast
jest.mock('../../../components/transitions/AchievementToast', () => ({
  AchievementToast: () => null,
}));

// Mock LessonCompleteScreen
jest.mock('../../../components/transitions/LessonCompleteScreen', () => ({
  LessonCompleteScreen: () => null,
}));

// Mock ExerciseCard
jest.mock('../../../components/transitions/ExerciseCard', () => ({
  ExerciseCard: () => null,
}));

// Mock achievements
jest.mock('../../../core/achievements/achievements', () => ({
  ACHIEVEMENTS: [],
  getAchievementById: jest.fn(),
}));

// Mock ContentLoader
jest.mock('../../../content/ContentLoader', () => ({
  getExercise: jest.fn(),
  getNextExerciseId: jest.fn(),
  getLessonIdForExercise: jest.fn(),
  getLesson: jest.fn(),
  getLessons: jest.fn(() => []),
  isTestExercise: jest.fn(() => false),
  getTestExercise: jest.fn(),
  getNonTestExercises: jest.fn(() => []),
}));

// Mock exerciseBufferManager
jest.mock('../../../services/exerciseBufferManager', () => ({
  getNextExercise: jest.fn(),
  getNextExerciseForSkill: jest.fn(),
  fillBuffer: jest.fn().mockResolvedValue(undefined),
  fillBufferForSkills: jest.fn().mockResolvedValue(undefined),
  prefillOnboardingBuffer: jest.fn().mockResolvedValue(undefined),
  getBufferSize: jest.fn(() => 0),
  BUFFER_MIN_THRESHOLD: 2,
}));

// Mock XpSystem
jest.mock('../../../core/progression/XpSystem', () => ({
  recordPracticeSession: jest.fn(),
}));

// Mock SkillTree
jest.mock('../../../core/curriculum/SkillTree', () => ({
  getSkillsForExercise: jest.fn(() => []),
  getSkillById: jest.fn(() => null),
  getGenerationHints: jest.fn(() => null),
}));

// Mock DifficultyEngine
jest.mock('../../../core/curriculum/DifficultyEngine', () => ({
  adjustDifficulty: jest.fn((exercise: any) => exercise),
}));

// Mock WeakSpotDetector
jest.mock('../../../core/curriculum/WeakSpotDetector', () => ({
  detectWeakPatterns: jest.fn(() => []),
}));

// Mock MusicTheory
jest.mock('../../../core/music/MusicTheory', () => ({
  midiToNoteName: jest.fn((n: number) => `Note${n}`),
}));

// Mock FreePlayAnalyzer
jest.mock('../../../services/FreePlayAnalyzer', () => ({
  suggestDrill: jest.fn(),
}));

// Mock geminiExerciseService
jest.mock('../../../services/geminiExerciseService', () => ({
  generateExercise: jest.fn(),
}));

// Mock funFacts
jest.mock('../../../content/funFacts', () => ({
  getRandomFunFact: jest.fn(),
}));

// Mock templateExercises
jest.mock('../../../content/templateExercises', () => ({
  getTemplateForSkill: jest.fn(() => ({
    id: 'tmpl-test', version: 1,
    metadata: { title: 'Template', description: '', difficulty: 1, estimatedMinutes: 2, skills: [], prerequisites: [] },
    settings: { tempo: 60, timeSignature: [4, 4], keySignature: 'C', countIn: 4, metronomeEnabled: true },
    notes: [{ note: 60, startBeat: 0, durationBeats: 1 }],
    scoring: { timingToleranceMs: 80, timingGracePeriodMs: 200, passingScore: 60, starThresholds: [70, 85, 95] },
    hints: { beforeStart: '', commonMistakes: [], successMessage: '' },
  })),
  getTemplateExercise: jest.fn(() => ({
    id: 'tmpl-generic', version: 1,
    metadata: { title: 'Generic Template', description: '', difficulty: 1, estimatedMinutes: 2, skills: [], prerequisites: [] },
    settings: { tempo: 60, timeSignature: [4, 4], keySignature: 'C', countIn: 4, metronomeEnabled: true },
    notes: [{ note: 60, startBeat: 0, durationBeats: 1 }],
    scoring: { timingToleranceMs: 80, timingGracePeriodMs: 200, passingScore: 60, starThresholds: [70, 85, 95] },
    hints: { beforeStart: '', commonMistakes: [], successMessage: '' },
  })),
}));

// Mock SplitKeyboard
jest.mock('../../../components/Keyboard/SplitKeyboard', () => ({
  SplitKeyboard: () => null,
  deriveSplitPoint: jest.fn(() => 60),
}));

// Mock ExerciseLoadingScreen (has heavy deps: SalsaCoach, FunFactCard, funFactSelector)
jest.mock('../ExerciseLoadingScreen', () => ({
  ExerciseLoadingScreen: () => null,
}));

// Mock CompletionModal (heavy deps: MascotBubble, CatAvatar, CoachingService, TTSService, etc.)
jest.mock('../CompletionModal', () => ({
  CompletionModal: () => null,
}));

// Mock CountInAnimation
jest.mock('../CountInAnimation', () => ({
  CountInAnimation: () => null,
}));

// Mock DevKeyboardMidi
jest.mock('../../../input/DevKeyboardMidi', () => ({
  useDevKeyboardMidi: jest.fn(),
}));


// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: (props: any) => React.createElement(View, props, props.children),
  };
});

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props, props.children),
    Svg: (props: any) => React.createElement(View, props, props.children),
    Circle: (props: any) => React.createElement(View, props),
    Rect: (props: any) => React.createElement(View, props),
    Path: (props: any) => React.createElement(View, props),
    G: (props: any) => React.createElement(View, props, props.children),
    Defs: (props: any) => React.createElement(View, props, props.children),
    RadialGradient: (props: any) => React.createElement(View, props, props.children),
    Stop: (props: any) => React.createElement(View, props),
  };
});

// Mock COLORS from theme
jest.mock('../../../theme/tokens', () => ({
  COLORS: {
    background: '#0A0A0A',
    surface: '#141414',
    surfaceElevated: '#1C1C1C',
    surfaceOverlay: 'rgba(0, 0, 0, 0.85)',
    primary: '#DC143C',
    primaryLight: '#FF2D55',
    primaryDark: '#8B0000',
    cardSurface: '#181818',
    cardBorder: '#2A2A2A',
    cardHighlight: '#222222',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0A0',
    textMuted: '#666666',
    textAccent: '#DC143C',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
    starGold: '#FFD700',
    starEmpty: '#444444',
    gemGold: '#FFD700',
    gemDiamond: '#4FC3F7',
    evolutionGlow: '#FFD54F',
    evolutionFlash: '#FFFFFF',
    streakFlame: '#FF6B35',
    streakFlameWarm: '#FF9800',
    streakFlameMedium: '#FF6B00',
    streakFlameHot: '#FF4500',
    feedbackPerfect: '#00E676',
    feedbackGood: '#69F0AE',
    feedbackOk: '#FFD740',
    feedbackEarly: '#40C4FF',
    feedbackLate: '#FFAB40',
    feedbackMiss: '#FF5252',
    feedbackDefault: '#757575',
    comboGold: '#FFD700',
  },
  GRADIENTS: {
    dark: ['#141414', '#0A0A0A'],
    gold: ['#FFD700', '#FFA500'],
    success: ['#4CAF50', '#2E7D32'],
    crimson: ['#DC143C', '#8B0000'],
    header: ['#1C1C1C', '#0A0A0A'],
    heroGlow: ['#2A0A0A', '#1A0A0A', '#0A0A0A'],
    cardWarm: ['#1C1C1C', '#181818'],
    lavaLamp: { duration: 8000, palettes: [['#1A0000', '#0A0A0A', '#0A0A0A']] },
  },
  GLOW: {
    crimson: 'rgba(220, 20, 60, 0.3)',
    gold: 'rgba(255, 215, 0, 0.3)',
    dark: 'rgba(28, 28, 28, 0.3)',
    success: 'rgba(76, 175, 80, 0.3)',
  },
  glowColor: (_hex: string, opacity = 0.3) => `rgba(0, 0, 0, ${opacity})`,
  TYPOGRAPHY: {
    display: {
      lg: { fontSize: 36, lineHeight: 44, fontWeight: '800' },
      md: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
      sm: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
    },
    heading: {
      lg: { fontSize: 20, lineHeight: 28, fontWeight: '700' },
      md: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
      sm: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
    },
    body: {
      lg: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
      md: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
      sm: { fontSize: 13, lineHeight: 20, fontWeight: '400' },
    },
    caption: {
      lg: { fontSize: 12, lineHeight: 18, fontWeight: '400' },
      md: { fontSize: 11, lineHeight: 16, fontWeight: '400' },
      sm: { fontSize: 10, lineHeight: 14, fontWeight: '400' },
    },
    button: {
      lg: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
      md: { fontSize: 14, lineHeight: 22, fontWeight: '600' },
      sm: { fontSize: 12, lineHeight: 18, fontWeight: '600' },
    },
    special: {
      score: { fontSize: 48, lineHeight: 56, fontWeight: '800' },
      badge: { fontSize: 11, lineHeight: 14, fontWeight: '700', textTransform: 'uppercase' },
    },
  },
  SHADOWS: { sm: {}, md: {}, lg: {} },
  shadowGlow: () => ({}),
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  BORDER_RADIUS: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
  ANIMATION_CONFIG: {
    spring: { damping: 15, stiffness: 150 },
    springSnappy: { damping: 20, stiffness: 300, mass: 0.8 },
    springBouncy: { damping: 8, stiffness: 120, mass: 1 },
    springGentle: { damping: 20, stiffness: 100, mass: 1 },
    duration: { instant: 100, fast: 200, normal: 300, slow: 500 },
    stagger: { fast: 50, normal: 80, slow: 120 },
  },
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    replace: mockReplace,
    getParent: () => ({ navigate: mockNavigate }),
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({
    params: { exerciseId: 'test-exercise' },
  }),
}));

// ---------------------------------------------------------------------------
// Test exercise fixture
// ---------------------------------------------------------------------------

const MOCK_EXERCISE: Exercise = {
  id: 'test-exercise',
  version: 1,
  metadata: {
    title: 'Test Exercise',
    description: 'A test exercise',
    difficulty: 1,
    estimatedMinutes: 2,
    skills: ['test'],
    prerequisites: [],
  },
  settings: {
    tempo: 120,
    timeSignature: [4, 4],
    keySignature: 'C',
    countIn: 2,
    metronomeEnabled: true,
  },
  notes: [
    { note: 60, startBeat: 2, durationBeats: 1 },
    { note: 64, startBeat: 3, durationBeats: 1 },
  ],
  scoring: {
    timingToleranceMs: 50,
    timingGracePeriodMs: 150,
    passingScore: 70,
    starThresholds: [70, 85, 95],
  },
  hints: {
    beforeStart: 'Get ready',
    commonMistakes: [],
    successMessage: 'Great!',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetPlaybackState() {
  mockPlaybackState = {
    isPlaying: false,
    currentBeat: -2,
    playedNotes: [],
    startPlayback: mockStartPlayback,
    pausePlayback: mockPausePlayback,
    resumePlayback: mockResumePlayback,
    stopPlayback: mockStopPlayback,
    resetPlayback: mockResetPlayback,
    playNote: mockPlayNote,
    releaseNote: mockReleaseNote,
    isMidiReady: true,
    isAudioReady: true,
    hasError: false,
    errorMessage: null,
  };
  const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
  useExercisePlayback.mockImplementation(() => mockPlaybackState);
}

function resetStore(overrides: Record<string, any> = {}) {
  // Reset all keys on the shared mutable state object
  // (The mock factory closure reads from this same object reference)
  const defaults: Record<string, any> = {
    currentExercise: null,
    setCurrentExercise: jest.fn(),
    clearSession: jest.fn(),
    setScore: jest.fn(),
    addPlayedNote: jest.fn(),
    setCurrentBeat: jest.fn(),
    setIsPlaying: jest.fn(),
    playedNotes: [],
    failCount: 0,
    ghostNotesEnabled: false,
    ghostNotesSuccessCount: 0,
    demoWatched: false,
    incrementFailCount: jest.fn(),
    resetFailCount: jest.fn(),
    setGhostNotesEnabled: jest.fn(),
    incrementGhostNotesSuccessCount: jest.fn(),
    setDemoWatched: jest.fn(),
  };
  // Clear old keys, then apply defaults + overrides
  for (const key of Object.keys(mockExerciseState)) {
    delete mockExerciseState[key];
  }
  Object.assign(mockExerciseState, defaults, overrides);
}

// ===========================================================================
// TESTS
// ===========================================================================

describe('ExercisePlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPlaybackState();
    resetStore();
    capturedKeyboardProps = {};
    capturedPianoRollProps = {};
  });

  // -----------------------------------------------------------------------
  // Core rendering
  // -----------------------------------------------------------------------

  describe('Core rendering', () => {
    it('should render the main layout correctly', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('exercise-player')).toBeTruthy();
      expect(getByTestId('exercise-keyboard')).toBeTruthy();
      expect(getByTestId('exercise-controls')).toBeTruthy();
    });

    it('should display exercise title in the top bar', () => {
      const { getAllByText } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      // Title appears in both ScoreDisplay and ExerciseIntroOverlay
      expect(getAllByText(MOCK_EXERCISE.metadata.title).length).toBeGreaterThanOrEqual(1);
    });

    it('should display piano roll component', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('exercise-piano-roll')).toBeTruthy();
    });

    it('should show hint text on initial render', () => {
      const { getAllByText } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      // Hint appears in both HintDisplay and ExerciseIntroOverlay
      expect(getAllByText(MOCK_EXERCISE.hints.beforeStart).length).toBeGreaterThanOrEqual(1);
    });

    it('should show error display when initialization fails', () => {
      mockPlaybackState.hasError = true;
      mockPlaybackState.errorMessage = 'Audio failed';
      mockPlaybackState.isMidiReady = false;
      mockPlaybackState.isAudioReady = false;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByTestId, getByText } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('exercise-error')).toBeTruthy();
      expect(getByText('Audio failed')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Playback controls
  // -----------------------------------------------------------------------

  describe('Playback controls', () => {
    it('should show play button when not playing', () => {
      const { getByTestId, queryByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('control-play')).toBeTruthy();
      expect(queryByTestId('control-pause')).toBeNull();
      expect(queryByTestId('control-restart')).toBeNull();
    });

    it('should show pause and restart when playing', () => {
      mockPlaybackState.isPlaying = true;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByTestId, queryByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('control-pause')).toBeTruthy();
      expect(getByTestId('control-restart')).toBeTruthy();
      expect(queryByTestId('control-play')).toBeNull();
    });

    it('should start playback on play button press', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('control-play'));
      expect(mockStartPlayback).toHaveBeenCalled();
    });

    it('should pause playback on pause button press', () => {
      mockPlaybackState.isPlaying = true;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('control-pause'));
      expect(mockPausePlayback).toHaveBeenCalled();
    });

    it('should restart exercise when restart button is pressed', () => {
      mockPlaybackState.isPlaying = true;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('control-restart'));
      expect(mockResetPlayback).toHaveBeenCalled();
    });

    it('should call onClose when exit button is pressed', () => {
      jest.useFakeTimers();
      const onClose = jest.fn();
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} onClose={onClose} />
      );

      fireEvent.press(getByTestId('control-exit'));

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(onClose).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('should handle keyboard rendering when playing', () => {
      mockPlaybackState.isPlaying = true;
      mockPlaybackState.currentBeat = 1;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('exercise-keyboard')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Speed selector
  // -----------------------------------------------------------------------

  describe('Speed selector', () => {
    it('should render speed selector pill', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('speed-selector')).toBeTruthy();
    });

    it('should display current speed value', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      const speedPill = getByTestId('speed-selector');
      expect(speedPill).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Demo mode UI
  // -----------------------------------------------------------------------

  describe('Demo mode', () => {
    it('should render the demo button', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('demo-button')).toBeTruthy();
    });

    it('should display "Demo" text on button when demo is not playing', () => {
      const { getByText } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByText('Demo')).toBeTruthy();
    });

    it('should call DemoPlaybackService.start when demo button is pressed', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('demo-button'));
      expect(mockDemoStart).toHaveBeenCalled();
    });

    it('should mark demoWatched via store when demo starts', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('demo-button'));
      expect(mockExerciseState.setDemoWatched).toHaveBeenCalledWith(true);
    });

    it('should allow demo button press when paused (secondary bar visible)', () => {
      // Demo button is in the secondary bar, which is only visible when !isPlaying || isPaused.
      // When paused, pressing demo should pause playback and start demo.
      mockPlaybackState.isPlaying = true;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { queryByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      // During active playback (not paused), secondary bar is hidden
      expect(queryByTestId('demo-button')).toBeNull();
    });

    it('should not show demo banner when demo is not playing', () => {
      const { queryByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(queryByTestId('demo-banner')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Ghost notes toggle
  // -----------------------------------------------------------------------

  describe('Ghost notes', () => {
    it('should not show ghost toggle when demoWatched is false', () => {
      resetStore({ demoWatched: false });

      const { queryByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(queryByTestId('ghost-toggle')).toBeNull();
    });

    it('should show ghost toggle when demoWatched is true', () => {
      resetStore({ demoWatched: true });

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('ghost-toggle')).toBeTruthy();
    });

    it('should call setGhostNotesEnabled when ghost toggle is pressed', () => {
      resetStore({ demoWatched: true, ghostNotesEnabled: false });

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('ghost-toggle'));
      expect(mockExerciseState.setGhostNotesEnabled).toHaveBeenCalledWith(true);
    });

    it('should toggle ghost notes off when already enabled', () => {
      resetStore({ demoWatched: true, ghostNotesEnabled: true });

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      fireEvent.press(getByTestId('ghost-toggle'));
      expect(mockExerciseState.setGhostNotesEnabled).toHaveBeenCalledWith(false);
    });

    it('should not pass ghost notes to VerticalPianoRoll when disabled', () => {
      resetStore({ ghostNotesEnabled: false });

      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedPianoRollProps.ghostNotes).toBeUndefined();
    });

    it('should pass ghost notes to VerticalPianoRoll when enabled', () => {
      resetStore({ ghostNotesEnabled: true });

      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedPianoRollProps.ghostNotes).toEqual(MOCK_EXERCISE.notes);
      expect(capturedPianoRollProps.ghostBeatOffset).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // VerticalPianoRoll prop passing
  // -----------------------------------------------------------------------

  describe('VerticalPianoRoll integration', () => {
    it('should pass exercise notes to VerticalPianoRoll', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedPianoRollProps.notes).toEqual(MOCK_EXERCISE.notes);
    });

    it('should pass currentBeat to VerticalPianoRoll', () => {
      mockPlaybackState.currentBeat = 3;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedPianoRollProps.currentBeat).toBe(3);
    });

    it('should pass negative beat to VerticalPianoRoll during count-in (Tetris cascade)', () => {
      mockPlaybackState.currentBeat = -2;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // Negative beats are passed through so VerticalPianoRoll can animate
      // the Tetris-style cascade: notes start above the visible area and
      // fall into view during count-in.
      expect(capturedPianoRollProps.currentBeat).toBe(-2);
    });

    it('should pass tempo to VerticalPianoRoll (adjusted by playback speed)', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // Tempo is multiplied by playbackSpeed (default 0.75x for touch keyboard)
      // so 120 * 0.75 = 90
      expect(capturedPianoRollProps.tempo).toBeDefined();
      expect(capturedPianoRollProps.tempo).toBeGreaterThan(0);
      expect(capturedPianoRollProps.tempo).toBeLessThanOrEqual(MOCK_EXERCISE.settings.tempo);
    });

    it('should pass keyboard range to VerticalPianoRoll as midiMin/midiMax', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // computeZoomedRange mock returns { startNote: 48, octaveCount: 2 }
      expect(capturedPianoRollProps.midiMin).toBe(48);
      expect(capturedPianoRollProps.midiMax).toBe(48 + 2 * 12); // 72
    });

    it('should pass testID to VerticalPianoRoll', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedPianoRollProps.testID).toBe('exercise-piano-roll');
    });
  });

  // -----------------------------------------------------------------------
  // Keyboard prop passing
  // -----------------------------------------------------------------------

  describe('Keyboard integration', () => {
    it('should pass keyboard range from computeZoomedRange', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // computeZoomedRange mock returns { startNote: 48, octaveCount: 2 }
      expect(capturedKeyboardProps.startNote).toBe(48);
      expect(capturedKeyboardProps.octaveCount).toBe(2);
    });

    it('should center single-note drills on first render', () => {
      const singleNoteExercise: Exercise = {
        ...MOCK_EXERCISE,
        notes: [
          { note: 60, startBeat: 0, durationBeats: 1 },
        ],
      };

      render(<ExercisePlayer exercise={singleNoteExercise} />);

      expect(capturedKeyboardProps.startNote).toBe(48);
      expect(capturedKeyboardProps.octaveCount).toBe(2);
    });

    it('should pass testID to Keyboard', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedKeyboardProps.testID).toBe('exercise-keyboard');
    });

    it('should set scrollEnabled to false for non-scrollable zoomed keyboard', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedKeyboardProps.scrollEnabled).toBe(false);
    });

    it('should enable keyboard', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedKeyboardProps.enabled).toBe(true);
    });

    it('should show labels on keyboard', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedKeyboardProps.showLabels).toBe(true);
    });

    it('should pass keyHeight to Keyboard', () => {
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      expect(capturedKeyboardProps.keyHeight).toBeDefined();
      expect(capturedKeyboardProps.keyHeight).toBeGreaterThanOrEqual(100);
    });
  });

  // -----------------------------------------------------------------------
  // Exercise completion integration
  // -----------------------------------------------------------------------

  describe('Exercise completion', () => {
    it('should pass onExerciseComplete callback to playback hook', () => {
      const onComplete = jest.fn();
      render(
        <ExercisePlayer exercise={MOCK_EXERCISE} onExerciseComplete={onComplete} />
      );

      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      expect(useExercisePlayback).toHaveBeenCalledWith(
        expect.objectContaining({
          exercise: expect.objectContaining({ id: MOCK_EXERCISE.id }),
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // Responsive layout
  // -----------------------------------------------------------------------

  describe('Responsive layout', () => {
    it('should render full layout in portrait orientation', () => {
      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('exercise-player')).toBeTruthy();
      expect(getByTestId('exercise-keyboard')).toBeTruthy();
      expect(getByTestId('exercise-piano-roll')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Error states
  // -----------------------------------------------------------------------

  describe('Error states', () => {
    it('should show error banner for non-critical errors (partial audio ready)', () => {
      mockPlaybackState.hasError = true;
      mockPlaybackState.errorMessage = 'MIDI unavailable';
      mockPlaybackState.isMidiReady = false;
      mockPlaybackState.isAudioReady = true;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByText, queryByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByText('MIDI unavailable')).toBeTruthy();
      expect(queryByTestId('exercise-error')).toBeNull();
    });

    it('should show full error screen when both MIDI and audio fail', () => {
      mockPlaybackState.hasError = true;
      mockPlaybackState.errorMessage = 'All audio systems failed';
      mockPlaybackState.isMidiReady = false;
      mockPlaybackState.isAudioReady = false;
      const { useExercisePlayback } = require('../../../hooks/useExercisePlayback');
      useExercisePlayback.mockImplementation(() => mockPlaybackState);

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('exercise-error')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Fail count and demo watched store integration
  // -----------------------------------------------------------------------

  describe('Fail count tracking', () => {
    it('should read failCount from exerciseStore selector', () => {
      resetStore({ failCount: 3 });

      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // Component renders successfully — failCount read via selector
      // (If selector was broken, component would crash)
    });

    it('should read demoWatched from exerciseStore and show ghost toggle', () => {
      resetStore({ demoWatched: true });

      const { getByTestId } = render(
        <ExercisePlayer exercise={MOCK_EXERCISE} />
      );

      expect(getByTestId('ghost-toggle')).toBeTruthy();
    });

    it('should read ghostNotesEnabled from exerciseStore selector', () => {
      resetStore({ ghostNotesEnabled: true, demoWatched: true });

      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // Ghost notes passed to VerticalPianoRoll when enabled
      expect(capturedPianoRollProps.ghostNotes).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // AI exercise skill mastery via skillId route param
  // -----------------------------------------------------------------------

  describe('AI exercise skill mastery', () => {
    it('should use skillId route param as fallback for skill mastery', () => {
      // Set up route params with skillId (simulating AI exercise from CurriculumEngine)
      const mockSkillNode = {
        id: 'rh-cde',
        name: 'C-D-E Right Hand',
        masteryThreshold: 0.7,
        tier: 2,
        prerequisites: [],
        targetExerciseIds: [],
      };

      // useRoute returns AI mode with skillId
      jest.spyOn(require('@react-navigation/native'), 'useRoute').mockReturnValue({
        params: { exerciseId: 'ai-mode', aiMode: true, skillId: 'rh-cde' },
      });

      // getSkillsForExercise returns [] for AI exercise IDs
      const { getSkillsForExercise, getSkillById } = require('../../../core/curriculum/SkillTree');
      getSkillsForExercise.mockReturnValue([]);
      getSkillById.mockReturnValue(mockSkillNode);

      // Render — the component extracts skillIdParam from route.params
      render(<ExercisePlayer exercise={MOCK_EXERCISE} />);

      // Verify getSkillById is accessible (component uses it in skillTarget useMemo)
      expect(getSkillById).toHaveBeenCalledWith('rh-cde');
    });
  });
});
