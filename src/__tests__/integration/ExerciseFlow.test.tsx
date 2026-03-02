/**
 * Integration Test: Exercise Flow
 * Tests the complete exercise playback experience from start to finish
 *
 * Tests:
 * 1. Exercise loading
 * 2. Control interactions (play, pause, restart, exit)
 * 3. State transitions
 * 4. Exercise completion
 */

import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { ExercisePlayer } from '../../screens/ExercisePlayer/ExercisePlayer';
import type { Exercise, MidiNoteEvent } from '../../core/exercises/types';

// Mock Firebase sync service (avoid loading firebase/config in test env)
jest.mock('../../services/firebase/syncService', () => ({
  syncManager: {
    syncAfterExercise: jest.fn().mockResolvedValue(undefined),
    startPeriodicSync: jest.fn(),
    stopPeriodicSync: jest.fn(),
  },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock exercise store — Zustand-compatible (selector + getState)
 
let mockExerciseState: Record<string, any> = {
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

jest.mock('../../stores/exerciseStore', () => {
  const useExerciseStore: any = (selector?: any) => {
    if (typeof selector === 'function') return selector(mockExerciseState);
    return mockExerciseState;
  };
  useExerciseStore.getState = () => mockExerciseState;
  return { useExerciseStore };
});

// Mock progress store
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
jest.mock('../../stores/progressStore', () => ({
  useProgressStore: Object.assign(
    (sel?: any) => sel ? sel(mockProgressState) : mockProgressState,
    { getState: () => mockProgressState }
  ),
}));

// Mock useExercisePlayback hook
const mockStartPlayback = jest.fn();
const mockPausePlayback = jest.fn();
const mockStopPlayback = jest.fn();
const mockResetPlayback = jest.fn();
const mockPlayNote = jest.fn();
const mockReleaseNote = jest.fn();

let mockPlaybackState: {
  isPlaying: boolean;
  currentBeat: number;
  playedNotes: MidiNoteEvent[];
  startPlayback: jest.Mock;
  pausePlayback: jest.Mock;
  stopPlayback: jest.Mock;
  resetPlayback: jest.Mock;
  playNote: jest.Mock;
  releaseNote: jest.Mock;
  isMidiReady: boolean;
  isAudioReady: boolean;
  hasError: boolean;
  errorMessage: string | null;
  activeInputMethod: string;
  lastExternalNoteRef: { current: null };
  externalNoteCount: number;
} = {
  isPlaying: false,
  currentBeat: -1,
  playedNotes: [],
  startPlayback: mockStartPlayback,
  pausePlayback: mockPausePlayback,
  stopPlayback: mockStopPlayback,
  resetPlayback: mockResetPlayback,
  playNote: mockPlayNote,
  releaseNote: mockReleaseNote,
  isMidiReady: true,
  isAudioReady: true,
  hasError: false,
  errorMessage: null,
  activeInputMethod: 'touch',
  lastExternalNoteRef: { current: null },
  externalNoteCount: 0,
};

jest.mock('../../hooks/useExercisePlayback', () => ({
  useExercisePlayback: jest.fn(() => mockPlaybackState),
}));

// Mock Button component (uses react-native-reanimated)
jest.mock('../../components/common/Button', () => ({
  Button: (props: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={props.onPress} testID={props.testID} disabled={props.disabled}>
        <Text>{props.title}</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock('../../components/Keyboard/Keyboard', () => ({
  Keyboard: (props: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-keyboard'}>
        <Text>Keyboard</Text>
      </View>
    );
  },
}));

jest.mock('../../components/PianoRoll/VerticalPianoRoll', () => ({
  VerticalPianoRoll: (props: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID={props.testID || 'mock-piano-roll'}>
        <Text>{props.currentBeat}</Text>
      </View>
    );
  },
}));

jest.mock('../../components/Keyboard/computeZoomedRange', () => ({
  computeZoomedRange: (_notes: number[]) => ({ startNote: 48, octaveCount: 2 }),
  computeStickyRange: (_notes: number[], range: any) => range,
}));

// Mock gemStore
const mockGemState = { gems: 100, transactions: [], earnGems: jest.fn(), spendGems: jest.fn(), canAfford: jest.fn(() => true) };
jest.mock('../../stores/gemStore', () => ({
  useGemStore: Object.assign(
    (sel?: any) => sel ? sel(mockGemState) : mockGemState,
    { getState: () => mockGemState }
  ),
}));

// Mock catEvolutionStore
const mockCatEvolutionState = {
  selectedCatId: 'mini-meowww',
  ownedCats: ['mini-meowww'],
  evolutionData: { 'mini-meowww': { catId: 'mini-meowww', currentStage: 'baby', xpAccumulated: 0, abilitiesUnlocked: [], evolvedAt: { baby: Date.now(), teen: null, adult: null, master: null } } },
  addEvolutionXp: jest.fn(),
  getActiveAbilities: () => [],
};
jest.mock('../../stores/catEvolutionStore', () => ({
  useCatEvolutionStore: Object.assign(
    (sel?: any) => sel ? sel(mockCatEvolutionState) : mockCatEvolutionState,
    { getState: () => mockCatEvolutionState }
  ),
}));

// Mock AbilityEngine
jest.mock('../../core/abilities/AbilityEngine', () => ({
  applyAbilities: jest.fn((_ids: string[], config: any) => config),
  createDefaultConfig: jest.fn((timing: number, grace: number, tempo: number) => ({
    timingToleranceMs: timing, timingGracePeriodMs: grace, tempo,
    ghostNotesFailThreshold: 3, comboShield: false, scoreBoostPercent: 0,
    xpMultiplier: 1, gemBonusChance: 0, gemBonusMultiplier: 1, extraRetries: 0,
  })),
}));

// Mock achievementStore
const mockAchievementState = {
  unlockedIds: {}, totalNotesPlayed: 0, perfectScoreCount: 0, highScoreCount: 0,
  checkAndUnlock: jest.fn(() => []), incrementNotesPlayed: jest.fn(),
  recordPerfectScore: jest.fn(), recordHighScore: jest.fn(),
  isUnlocked: jest.fn(() => false), getUnlockedAchievements: jest.fn(() => []),
  getUnlockedCount: jest.fn(() => 0), getTotalCount: jest.fn(() => 0),
  hydrate: jest.fn(), reset: jest.fn(),
};
jest.mock('../../stores/achievementStore', () => ({
  useAchievementStore: Object.assign(
    (sel?: any) => sel ? sel(mockAchievementState) : mockAchievementState,
    { getState: () => mockAchievementState }
  ),
  buildAchievementContext: jest.fn(() => ({
    totalNotesPlayed: 0, perfectScoreCount: 0, highScoreCount: 0,
    currentStreak: 0, longestStreak: 0, totalExercisesCompleted: 0,
  })),
}));

// Mock settingsStore
const mockSettingsState = {
  selectedCatId: 'mini-meowww', soundEnabled: true, hapticEnabled: true,
  showFingerNumbers: true, showNoteNames: true, masterVolume: 0.8,
  dailyGoalMinutes: 15, playbackSpeed: 0.75 as const, setPlaybackSpeed: jest.fn(),
  lastMidiDeviceId: null, preferredHand: 'right',
};
jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: Object.assign(
    (sel?: any) => sel ? sel(mockSettingsState) : mockSettingsState,
    { getState: () => mockSettingsState }
  ),
}));

// Mock learnerProfileStore
const mockLearnerProfileState = {
  noteAccuracy: {}, noteAttempts: {},
  skills: { timingAccuracy: 0.5, pitchAccuracy: 0.5, sightReadSpeed: 0.5, chordRecognition: 0.5 },
  tempoRange: { min: 40, max: 80 }, weakNotes: [], weakSkills: [],
  totalExercisesCompleted: 0, lastAssessmentDate: '', assessmentScore: 0,
  masteredSkills: [], skillCompletions: {},
  recordExerciseResult: jest.fn(), updateNoteAccuracy: jest.fn(),
  recalculateWeakAreas: jest.fn(), updateSkill: jest.fn(),
  addRecentExercise: jest.fn(), markSkillMastered: jest.fn(), reset: jest.fn(),
};
jest.mock('../../stores/learnerProfileStore', () => ({
  useLearnerProfileStore: Object.assign(
    (sel?: any) => sel ? sel(mockLearnerProfileState) : mockLearnerProfileState,
    { getState: () => mockLearnerProfileState }
  ),
}));

// Mock catCharacters
jest.mock('../../components/Mascot/catCharacters', () => ({
  CAT_CHARACTERS: [{ id: 'mini-meowww', name: 'Mini Meowww', abilities: [] }],
  getCatById: jest.fn(() => ({ id: 'mini-meowww', name: 'Mini Meowww', abilities: [] })),
  getUnlockedCats: jest.fn(() => []),
}));

// Mock ExerciseBuddy
jest.mock('../../components/Mascot/ExerciseBuddy', () => ({ ExerciseBuddy: () => null }));
jest.mock('../../components/Mascot/mascotTips', () => ({ getTipForScore: jest.fn(() => 'Great job!') }));
jest.mock('../../components/transitions/AchievementToast', () => ({ AchievementToast: () => null }));
jest.mock('../../components/transitions/LessonCompleteScreen', () => ({ LessonCompleteScreen: () => null }));
jest.mock('../../components/transitions/ExerciseCard', () => ({ ExerciseCard: () => null }));
jest.mock('../../core/achievements/achievements', () => ({ ACHIEVEMENTS: [], getAchievementById: jest.fn() }));
jest.mock('../../content/ContentLoader', () => ({
  getExercise: jest.fn(), getNextExerciseId: jest.fn(), getLessonIdForExercise: jest.fn(),
  getLesson: jest.fn(), getLessons: jest.fn(() => []), isTestExercise: jest.fn(() => false),
  getTestExercise: jest.fn(), getNonTestExercises: jest.fn(() => []),
}));
jest.mock('../../services/exerciseBufferManager', () => ({
  getNextExercise: jest.fn(), getNextExerciseForSkill: jest.fn(), fillBuffer: jest.fn(), fillBufferForSkills: jest.fn(), prefillOnboardingBuffer: jest.fn(), getBufferSize: jest.fn(() => 0), BUFFER_MIN_THRESHOLD: 2,
}));
jest.mock('../../core/progression/XpSystem', () => ({ recordPracticeSession: jest.fn() }));
jest.mock('../../core/curriculum/SkillTree', () => ({ getSkillsForExercise: jest.fn(() => []), getSkillById: jest.fn(() => null), getGenerationHints: jest.fn(() => null) }));
jest.mock('../../core/curriculum/DifficultyEngine', () => ({ adjustDifficulty: jest.fn((e: any) => e) }));
jest.mock('../../core/curriculum/WeakSpotDetector', () => ({ detectWeakPatterns: jest.fn(() => []) }));
jest.mock('../../core/music/MusicTheory', () => ({ midiToNoteName: jest.fn((n: number) => `Note${n}`) }));
jest.mock('../../services/FreePlayAnalyzer', () => ({ suggestDrill: jest.fn() }));
jest.mock('../../services/geminiExerciseService', () => ({ generateExercise: jest.fn() }));
jest.mock('../../content/funFacts', () => ({ getRandomFunFact: jest.fn() }));
jest.mock('../../content/templateExercises', () => ({
  getTemplateForSkill: jest.fn(() => ({ id: 'tmpl-test', version: 1, metadata: { title: 'Template', description: '', difficulty: 1, estimatedMinutes: 2, skills: [], prerequisites: [] }, settings: { tempo: 60, timeSignature: [4, 4], keySignature: 'C', countIn: 4, metronomeEnabled: true }, notes: [{ note: 60, startBeat: 0, durationBeats: 1 }], scoring: { timingToleranceMs: 80, timingGracePeriodMs: 200, passingScore: 60, starThresholds: [70, 85, 95] }, hints: { beforeStart: '', commonMistakes: [], successMessage: '' } })),
  getTemplateExercise: jest.fn(() => ({ id: 'tmpl-generic', version: 1, metadata: { title: 'Generic', description: '', difficulty: 1, estimatedMinutes: 2, skills: [], prerequisites: [] }, settings: { tempo: 60, timeSignature: [4, 4], keySignature: 'C', countIn: 4, metronomeEnabled: true }, notes: [{ note: 60, startBeat: 0, durationBeats: 1 }], scoring: { timingToleranceMs: 80, timingGracePeriodMs: 200, passingScore: 60, starThresholds: [70, 85, 95] }, hints: { beforeStart: '', commonMistakes: [], successMessage: '' } })),
}));
jest.mock('../../components/Keyboard/SplitKeyboard', () => ({ SplitKeyboard: () => null, deriveSplitPoint: jest.fn(() => 60) }));
jest.mock('../../screens/ExercisePlayer/ExerciseLoadingScreen', () => ({ ExerciseLoadingScreen: () => null }));
jest.mock('../../screens/ExercisePlayer/CompletionModal', () => ({ CompletionModal: () => null }));
jest.mock('../../screens/ExercisePlayer/CountInAnimation', () => ({ CountInAnimation: () => null }));
jest.mock('../../input/DevKeyboardMidi', () => ({ useDevKeyboardMidi: jest.fn() }));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: (props: any) => React.createElement(View, props, props.children) };
});

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

jest.mock('../../audio/SoundManager', () => ({
  soundManager: { play: jest.fn(), preload: jest.fn() },
}));

jest.mock('../../theme/tokens', () => ({
  getComboTier: (combo: number) => {
    if (combo >= 20) return { name: 'LEGENDARY', minCombo: 20, color: '#FF2D55', glowColor: 'rgba(255,45,85,0.6)', borderColor: '#FF2D55', label: 'LEGENDARY!' };
    if (combo >= 15) return { name: 'SUPER', minCombo: 15, color: '#FFD700', glowColor: 'rgba(255,215,0,0.5)', borderColor: '#FFD700', label: 'SUPER!' };
    if (combo >= 10) return { name: 'FIRE', minCombo: 10, color: '#FF6B35', glowColor: 'rgba(255,107,53,0.4)', borderColor: '#FF6B35', label: 'FIRE!' };
    if (combo >= 5) return { name: 'GOOD', minCombo: 5, color: '#4CAF50', glowColor: 'rgba(76,175,80,0.3)', borderColor: '#4CAF50', label: 'NICE!' };
    return { name: 'NORMAL', minCombo: 0, color: '#FFFFFF', glowColor: 'rgba(255,255,255,0)', borderColor: '#FFFFFF', label: '' };
  },
  COMBO_TIERS: [
    { name: 'NORMAL', minCombo: 0, color: '#FFFFFF', glowColor: 'rgba(255,255,255,0)', borderColor: '#FFFFFF', label: '' },
    { name: 'GOOD', minCombo: 5, color: '#4CAF50', glowColor: 'rgba(76,175,80,0.3)', borderColor: '#4CAF50', label: 'NICE!' },
    { name: 'FIRE', minCombo: 10, color: '#FF6B35', glowColor: 'rgba(255,107,53,0.4)', borderColor: '#FF6B35', label: 'FIRE!' },
    { name: 'SUPER', minCombo: 15, color: '#FFD700', glowColor: 'rgba(255,215,0,0.5)', borderColor: '#FFD700', label: 'SUPER!' },
    { name: 'LEGENDARY', minCombo: 20, color: '#FF2D55', glowColor: 'rgba(255,45,85,0.6)', borderColor: '#FF2D55', label: 'LEGENDARY!' },
  ],
  COLORS: {
    background: '#0A0A0A', surface: '#141414', surfaceElevated: '#1C1C1C',
    surfaceOverlay: 'rgba(0, 0, 0, 0.85)', primary: '#DC143C', primaryLight: '#FF2D55',
    primaryDark: '#8B0000', cardSurface: '#181818', cardBorder: '#2A2A2A', cardHighlight: '#222222',
    textPrimary: '#FFFFFF', textSecondary: '#A0A0A0', textMuted: '#666666', textAccent: '#DC143C',
    success: '#4CAF50', warning: '#FF9800', error: '#F44336', info: '#2196F3',
    starGold: '#FFD700', starEmpty: '#444444', gemGold: '#FFD700', gemDiamond: '#4FC3F7',
    evolutionGlow: '#FFD54F', evolutionFlash: '#FFFFFF',
    streakFlame: '#FF6B35', streakFlameWarm: '#FF9800', streakFlameMedium: '#FF6B00', streakFlameHot: '#FF4500',
    feedbackPerfect: '#00E676', feedbackGood: '#69F0AE', feedbackOk: '#FFD740',
    feedbackEarly: '#40C4FF', feedbackLate: '#FFAB40', feedbackMiss: '#FF5252', feedbackDefault: '#757575',
    comboGold: '#FFD700',
  },
  GRADIENTS: { dark: ['#141414', '#0A0A0A'], gold: ['#FFD700', '#FFA500'], heroGlow: ['#2A0A0A', '#1A0A0A', '#0A0A0A'], cardWarm: ['#1C1C1C', '#181818'], header: ['#1C1C1C', '#0A0A0A'], crimson: ['#DC143C', '#8B0000'], lavaLamp: { duration: 8000, palettes: [['#1A0000', '#0A0A0A', '#0A0A0A']] } },
  GLOW: { crimson: 'rgba(220, 20, 60, 0.3)', gold: 'rgba(255, 215, 0, 0.3)', dark: 'rgba(28, 28, 28, 0.3)', success: 'rgba(76, 175, 80, 0.3)' },
  glowColor: (_hex: string, opacity = 0.3) => `rgba(0, 0, 0, ${opacity})`,
  TYPOGRAPHY: {
    display: { lg: { fontSize: 36, lineHeight: 44, fontWeight: '800' }, md: { fontSize: 28, lineHeight: 36, fontWeight: '700' }, sm: { fontSize: 24, lineHeight: 32, fontWeight: '700' } },
    heading: { lg: { fontSize: 20, lineHeight: 28, fontWeight: '700' }, md: { fontSize: 18, lineHeight: 26, fontWeight: '600' }, sm: { fontSize: 16, lineHeight: 24, fontWeight: '600' } },
    body: { lg: { fontSize: 16, lineHeight: 24, fontWeight: '400' }, md: { fontSize: 14, lineHeight: 22, fontWeight: '400' }, sm: { fontSize: 13, lineHeight: 20, fontWeight: '400' } },
    caption: { lg: { fontSize: 12, lineHeight: 18, fontWeight: '400' }, md: { fontSize: 11, lineHeight: 16, fontWeight: '400' }, sm: { fontSize: 10, lineHeight: 14, fontWeight: '400' } },
    button: { lg: { fontSize: 16, lineHeight: 24, fontWeight: '600' }, md: { fontSize: 14, lineHeight: 22, fontWeight: '600' }, sm: { fontSize: 12, lineHeight: 18, fontWeight: '600' } },
    special: { score: { fontSize: 48, lineHeight: 56, fontWeight: '800' }, badge: { fontSize: 11, lineHeight: 14, fontWeight: '700', textTransform: 'uppercase' } },
  },
  SHADOWS: { sm: {}, md: {}, lg: {} },
  shadowGlow: () => ({}),
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  BORDER_RADIUS: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
  ANIMATION_CONFIG: { spring: { damping: 15, stiffness: 150 }, duration: { instant: 100, fast: 200, normal: 300, slow: 500 } },
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate, goBack: mockGoBack, replace: mockReplace,
    getParent: () => ({ navigate: mockNavigate }),
    dispatch: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => jest.fn()),
  }),
  useRoute: () => ({ params: { exerciseId: 'test-exercise-1' } }),
}));

// Mock DemoPlaybackService
jest.mock('../../services/demoPlayback', () => ({
  DemoPlaybackService: jest.fn().mockImplementation(() => ({
    start: jest.fn(), stop: jest.fn(), isPlaying: false,
  })),
}));

// Test exercise - simple C major scale
const TEST_EXERCISE: Exercise = {
  id: 'test-exercise-1',
  version: 1,
  metadata: {
    title: 'C Major Scale Test',
    description: 'Play C-D-E-F',
    difficulty: 1,
    estimatedMinutes: 1,
    skills: ['right-hand', 'c-major'],
    prerequisites: [],
  },
  settings: {
    tempo: 120,
    timeSignature: [4, 4],
    keySignature: 'C',
    countIn: 1, // 1 beat count-in for faster testing
    metronomeEnabled: false,
  },
  notes: [
    { note: 60, startBeat: 0, durationBeats: 1 }, // C
    { note: 62, startBeat: 1, durationBeats: 1 }, // D
    { note: 64, startBeat: 2, durationBeats: 1 }, // E
    { note: 65, startBeat: 3, durationBeats: 1 }, // F
  ],
  scoring: {
    timingToleranceMs: 50,
    timingGracePeriodMs: 150,
    passingScore: 70,
    starThresholds: [70, 85, 95],
  },
  hints: {
    beforeStart: 'Play C-D-E-F in order',
    commonMistakes: [
      {
        pattern: 'wrong-notes',
        advice: 'Make sure to play the correct notes',
      },
    ],
    successMessage: 'Great job!',
  },
};

describe('Exercise Flow Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset playback state
    mockPlaybackState = {
      isPlaying: false,
      currentBeat: -1,
      playedNotes: [],
      startPlayback: mockStartPlayback,
      pausePlayback: mockPausePlayback,
      stopPlayback: mockStopPlayback,
      resetPlayback: mockResetPlayback,
      playNote: mockPlayNote,
      releaseNote: mockReleaseNote,
      isMidiReady: true,
      isAudioReady: true,
      hasError: false,
      errorMessage: null,
      activeInputMethod: 'touch',
      lastExternalNoteRef: { current: null },
      externalNoteCount: 0,
    };
    const { useExercisePlayback } = require('../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);
  });

  it('loads exercise and displays initial state', async () => {
    const { getByTestId, getAllByText } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    await waitFor(() => {
      expect(getByTestId('exercise-player')).toBeTruthy();
      // Title appears in both ScoreDisplay and ExerciseIntroOverlay
      expect(getAllByText('C Major Scale Test').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('starts playback on play button press', async () => {
    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    const startButton = getByTestId('control-play');
    await act(async () => {
      fireEvent.press(startButton);
    });

    expect(mockStartPlayback).toHaveBeenCalled();
  });

  it('shows keyboard and piano roll', async () => {
    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    expect(getByTestId('exercise-keyboard')).toBeTruthy();
    expect(getByTestId('exercise-piano-roll')).toBeTruthy();
  });

  it('shows pause and restart when playing', async () => {
    mockPlaybackState.isPlaying = true;
    mockPlaybackState.currentBeat = 1;
    const { useExercisePlayback } = require('../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    expect(getByTestId('control-pause')).toBeTruthy();
    expect(getByTestId('control-restart')).toBeTruthy();
  });

  it('pauses playback on pause button press', async () => {
    mockPlaybackState.isPlaying = true;
    const { useExercisePlayback } = require('../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    const pauseButton = getByTestId('control-pause');
    await act(async () => {
      fireEvent.press(pauseButton);
    });

    expect(mockPausePlayback).toHaveBeenCalled();
  });

  it('restarts exercise on restart button press', async () => {
    mockPlaybackState.isPlaying = true;
    const { useExercisePlayback } = require('../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    const restartButton = getByTestId('control-restart');
    await act(async () => {
      fireEvent.press(restartButton);
    });

    expect(mockResetPlayback).toHaveBeenCalled();
  });

  it('shows error display when initialization fails', async () => {
    mockPlaybackState.hasError = true;
    mockPlaybackState.errorMessage = 'Audio initialization failed';
    mockPlaybackState.isMidiReady = false;
    mockPlaybackState.isAudioReady = false;
    const { useExercisePlayback } = require('../../hooks/useExercisePlayback');
    useExercisePlayback.mockImplementation(() => mockPlaybackState);

    const { getByTestId, getByText } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    await waitFor(() => {
      expect(getByTestId('exercise-error')).toBeTruthy();
      expect(getByText('Audio initialization failed')).toBeTruthy();
    });
  });

  it('exits exercise properly', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} onClose={onClose} />
    );

    const exitButton = getByTestId('control-exit');
    await act(async () => {
      fireEvent.press(exitButton);
    });

    // handleExit defers navigation via setTimeout
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(onClose).toHaveBeenCalled();
    expect(mockStopPlayback).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('displays hint before start', async () => {
    const { getAllByText } = render(
      <ExercisePlayer exercise={TEST_EXERCISE} />
    );

    // Hint appears in both HintDisplay and ExerciseIntroOverlay
    expect(getAllByText('Play C-D-E-F in order').length).toBeGreaterThanOrEqual(1);
  });
});
