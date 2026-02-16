# Gamification & Adaptive Learning — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Duolingo-grade personalized piano learning app with AI-generated exercises, living cat companions, split keyboard for two-handed play, and polished UI with celebration animations.

**Architecture:** Zustand stores drive all state (learner profile, cat mood, streaks, daily challenges). Gemini Flash API generates exercises via a background buffer system. UI uses react-native-reanimated for micro-interactions. All new features layer on existing ExercisePlayer/Keyboard/PianoRoll infrastructure.

**Tech Stack:** React Native 0.76, Expo SDK 52, Zustand v5, Firebase Auth + Firestore, Gemini Flash API (REST), react-native-reanimated, expo-haptics

**Design doc:** `docs/plans/2026-02-16-gamification-adaptive-design.md`

---

## Phase A: Foundation Layer (Tasks 1-5)

These tasks create the data infrastructure everything else builds on. No UI changes yet.

---

### Task 1: Design Tokens & Theme System

**Files:**
- Create: `src/theme/tokens.ts`
- Create: `src/theme/animations.ts`
- Modify: `src/theme/colors.ts` (if exists, else create)
- Test: `src/theme/__tests__/tokens.test.ts`

**Context:** Currently colors are scattered as inline constants across components. We need a single source of truth for the expanded palette, gradient definitions, glow effects, and animation configs that every UI task depends on.

**Step 1: Write the failing test**

```typescript
// src/theme/__tests__/tokens.test.ts
import { COLORS, GRADIENTS, GLOW, SPACING, ANIMATION_CONFIG } from '../tokens';

describe('Design Tokens', () => {
  it('exports all required base colors', () => {
    expect(COLORS.background).toBe('#0D0D0D');
    expect(COLORS.surface).toBe('#1A1A1A');
    expect(COLORS.primary).toBe('#DC143C');
    expect(COLORS.cardSurface).toBe('#242424');
    expect(COLORS.textPrimary).toBe('#FFFFFF');
    expect(COLORS.textSecondary).toBe('#AAAAAA');
    expect(COLORS.textMuted).toBe('#666666');
  });

  it('exports gradient arrays with exactly 2 colors', () => {
    expect(GRADIENTS.purple).toHaveLength(2);
    expect(GRADIENTS.gold).toHaveLength(2);
    expect(GRADIENTS.success).toHaveLength(2);
    expect(GRADIENTS.crimson).toHaveLength(2);
  });

  it('exports glow colors as rgba strings', () => {
    expect(GLOW.crimson).toMatch(/^rgba\(/);
    expect(GLOW.gold).toMatch(/^rgba\(/);
    expect(GLOW.purple).toMatch(/^rgba\(/);
  });

  it('exports spacing scale', () => {
    expect(SPACING.xs).toBe(4);
    expect(SPACING.sm).toBe(8);
    expect(SPACING.md).toBe(16);
    expect(SPACING.lg).toBe(24);
    expect(SPACING.xl).toBe(32);
  });

  it('exports animation configs with required fields', () => {
    expect(ANIMATION_CONFIG.spring.damping).toBeDefined();
    expect(ANIMATION_CONFIG.spring.stiffness).toBeDefined();
    expect(ANIMATION_CONFIG.bounce.damping).toBeDefined();
    expect(ANIMATION_CONFIG.fadeIn.duration).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/theme/__tests__/tokens.test.ts --no-coverage`
Expected: FAIL — cannot find module '../tokens'

**Step 3: Write minimal implementation**

```typescript
// src/theme/tokens.ts
export const COLORS = {
  // Base (existing)
  background: '#0D0D0D',
  surface: '#1A1A1A',
  primary: '#DC143C',

  // Cards
  cardSurface: '#242424',
  cardBorder: '#333333',
  cardHighlight: '#2A2A2A',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#AAAAAA',
  textMuted: '#666666',
  textAccent: '#DC143C',

  // Feedback
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',

  // Stars
  starGold: '#FFD700',
  starEmpty: '#444444',
} as const;

export const GRADIENTS = {
  purple: ['#1A0A2E', '#2D1B4E'] as const,
  gold: ['#FFD700', '#FFA500'] as const,
  success: ['#4CAF50', '#2E7D32'] as const,
  crimson: ['#DC143C', '#8B0000'] as const,
  header: ['#1A0A2E', '#0D0D0D'] as const,
} as const;

export const GLOW = {
  crimson: 'rgba(220, 20, 60, 0.3)',
  gold: 'rgba(255, 215, 0, 0.3)',
  purple: 'rgba(138, 43, 226, 0.3)',
  success: 'rgba(76, 175, 80, 0.3)',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const ANIMATION_CONFIG = {
  spring: { damping: 15, stiffness: 150 },
  bounce: { damping: 8, stiffness: 200 },
  fadeIn: { duration: 300 },
  slideUp: { duration: 400 },
  celebration: { duration: 2000 },
} as const;

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/theme/__tests__/tokens.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/theme/tokens.ts src/theme/__tests__/tokens.test.ts
git commit -m "feat: add design tokens for UI overhaul"
```

---

### Task 2: Learner Profile Store

**Files:**
- Create: `src/stores/learnerProfileStore.ts`
- Test: `src/stores/__tests__/learnerProfileStore.test.ts`

**Context:** The learner profile tracks per-note accuracy, skill dimensions, tempo comfort zone, and weak areas. It's updated after every exercise and drives AI exercise generation. Uses Zustand with AsyncStorage persistence (same pattern as progressStore).

**Step 1: Write the failing test**

```typescript
// src/stores/__tests__/learnerProfileStore.test.ts
import { useLearnerProfileStore } from '../learnerProfileStore';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('learnerProfileStore', () => {
  beforeEach(() => {
    useLearnerProfileStore.getState().reset();
  });

  it('initializes with empty profile', () => {
    const state = useLearnerProfileStore.getState();
    expect(state.noteAccuracy).toEqual({});
    expect(state.skills.timingAccuracy).toBe(0.5);
    expect(state.tempoRange).toEqual({ min: 40, max: 80 });
    expect(state.weakNotes).toEqual([]);
    expect(state.totalExercisesCompleted).toBe(0);
  });

  it('updates note accuracy with rolling average', () => {
    const { updateNoteAccuracy } = useLearnerProfileStore.getState();
    updateNoteAccuracy(60, 1.0); // Perfect hit on C4
    expect(useLearnerProfileStore.getState().noteAccuracy[60]).toBe(1.0);

    updateNoteAccuracy(60, 0.0); // Miss on C4
    // Rolling average: (1.0 + 0.0) / 2 = 0.5
    expect(useLearnerProfileStore.getState().noteAccuracy[60]).toBe(0.5);
  });

  it('calculates weak notes (below 70%)', () => {
    const { updateNoteAccuracy, recalculateWeakAreas } = useLearnerProfileStore.getState();
    updateNoteAccuracy(60, 0.9); // Strong
    updateNoteAccuracy(61, 0.5); // Weak
    updateNoteAccuracy(62, 0.3); // Very weak
    recalculateWeakAreas();

    const { weakNotes } = useLearnerProfileStore.getState();
    expect(weakNotes).toContain(61);
    expect(weakNotes).toContain(62);
    expect(weakNotes).not.toContain(60);
  });

  it('updates skill dimensions', () => {
    const { updateSkill } = useLearnerProfileStore.getState();
    updateSkill('timingAccuracy', 0.85);
    expect(useLearnerProfileStore.getState().skills.timingAccuracy).toBe(0.85);
  });

  it('adjusts tempo range on exercise completion', () => {
    const { recordExerciseResult } = useLearnerProfileStore.getState();
    // Good score at 90 BPM → expand upper range
    recordExerciseResult({ tempo: 90, score: 0.9, noteResults: [] });
    const { tempoRange } = useLearnerProfileStore.getState();
    expect(tempoRange.max).toBeGreaterThanOrEqual(90);
  });

  it('increments totalExercisesCompleted', () => {
    const { recordExerciseResult } = useLearnerProfileStore.getState();
    recordExerciseResult({ tempo: 60, score: 0.8, noteResults: [] });
    expect(useLearnerProfileStore.getState().totalExercisesCompleted).toBe(1);
  });

  it('identifies weak skills (below 60%)', () => {
    const store = useLearnerProfileStore.getState();
    store.updateSkill('timingAccuracy', 0.4);
    store.updateSkill('pitchAccuracy', 0.8);
    store.recalculateWeakAreas();

    const { weakSkills } = useLearnerProfileStore.getState();
    expect(weakSkills).toContain('timingAccuracy');
    expect(weakSkills).not.toContain('pitchAccuracy');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/stores/__tests__/learnerProfileStore.test.ts --no-coverage`
Expected: FAIL — cannot find module '../learnerProfileStore'

**Step 3: Write minimal implementation**

```typescript
// src/stores/learnerProfileStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NoteResult {
  midiNote: number;
  accuracy: number; // 0.0-1.0
}

interface ExerciseResult {
  tempo: number;
  score: number; // 0.0-1.0
  noteResults: NoteResult[];
}

interface Skills {
  timingAccuracy: number;
  pitchAccuracy: number;
  sightReadSpeed: number;
  chordRecognition: number;
}

interface LearnerProfileState {
  noteAccuracy: Record<number, number>;
  noteAttempts: Record<number, number>;
  skills: Skills;
  tempoRange: { min: number; max: number };
  weakNotes: number[];
  weakSkills: string[];
  totalExercisesCompleted: number;
  lastAssessmentDate: string;
  assessmentScore: number;

  updateNoteAccuracy: (midiNote: number, accuracy: number) => void;
  updateSkill: (skill: keyof Skills, value: number) => void;
  recalculateWeakAreas: () => void;
  recordExerciseResult: (result: ExerciseResult) => void;
  reset: () => void;
}

const INITIAL_SKILLS: Skills = {
  timingAccuracy: 0.5,
  pitchAccuracy: 0.5,
  sightReadSpeed: 0.5,
  chordRecognition: 0.5,
};

const WEAK_NOTE_THRESHOLD = 0.7;
const WEAK_SKILL_THRESHOLD = 0.6;
const ROLLING_WINDOW = 20;

export const useLearnerProfileStore = create<LearnerProfileState>()(
  persist(
    (set, get) => ({
      noteAccuracy: {},
      noteAttempts: {},
      skills: { ...INITIAL_SKILLS },
      tempoRange: { min: 40, max: 80 },
      weakNotes: [],
      weakSkills: [],
      totalExercisesCompleted: 0,
      lastAssessmentDate: '',
      assessmentScore: 0,

      updateNoteAccuracy: (midiNote: number, accuracy: number) => {
        const { noteAccuracy, noteAttempts } = get();
        const prevAccuracy = noteAccuracy[midiNote] ?? accuracy;
        const attempts = (noteAttempts[midiNote] ?? 0) + 1;
        const weight = Math.min(attempts, ROLLING_WINDOW);
        const newAccuracy = prevAccuracy + (accuracy - prevAccuracy) / weight;

        set({
          noteAccuracy: { ...noteAccuracy, [midiNote]: newAccuracy },
          noteAttempts: { ...noteAttempts, [midiNote]: attempts },
        });
      },

      updateSkill: (skill: keyof Skills, value: number) => {
        const { skills } = get();
        set({ skills: { ...skills, [skill]: Math.max(0, Math.min(1, value)) } });
      },

      recalculateWeakAreas: () => {
        const { noteAccuracy, skills } = get();
        const weakNotes = Object.entries(noteAccuracy)
          .filter(([, acc]) => acc < WEAK_NOTE_THRESHOLD)
          .map(([note]) => Number(note))
          .sort((a, b) => (noteAccuracy[a] ?? 0) - (noteAccuracy[b] ?? 0));

        const weakSkills = (Object.entries(skills) as [keyof Skills, number][])
          .filter(([, val]) => val < WEAK_SKILL_THRESHOLD)
          .map(([skill]) => skill);

        set({ weakNotes, weakSkills });
      },

      recordExerciseResult: (result: ExerciseResult) => {
        const state = get();

        // Update per-note accuracy
        for (const nr of result.noteResults) {
          state.updateNoteAccuracy(nr.midiNote, nr.accuracy);
        }

        // Adjust tempo range
        const { tempoRange } = get();
        let newMax = tempoRange.max;
        let newMin = tempoRange.min;
        if (result.score > 0.85 && result.tempo >= tempoRange.max - 10) {
          newMax = Math.min(200, tempoRange.max + 5);
        }
        if (result.score < 0.6 && result.tempo <= tempoRange.min + 10) {
          newMin = Math.max(30, tempoRange.min - 5);
        }

        set({
          tempoRange: { min: newMin, max: newMax },
          totalExercisesCompleted: state.totalExercisesCompleted + 1,
        });

        // Recalculate weak areas after update
        get().recalculateWeakAreas();
      },

      reset: () => {
        set({
          noteAccuracy: {},
          noteAttempts: {},
          skills: { ...INITIAL_SKILLS },
          tempoRange: { min: 40, max: 80 },
          weakNotes: [],
          weakSkills: [],
          totalExercisesCompleted: 0,
          lastAssessmentDate: '',
          assessmentScore: 0,
        });
      },
    }),
    {
      name: 'keysense_learner_profile',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/stores/__tests__/learnerProfileStore.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/stores/learnerProfileStore.ts src/stores/__tests__/learnerProfileStore.test.ts
git commit -m "feat: add learner profile store for adaptive learning"
```

---

### Task 3: Cat Dialogue System

**Files:**
- Create: `src/content/catDialogue.ts`
- Test: `src/content/__tests__/catDialogue.test.ts`

**Context:** Each of the 8 cats (defined in `src/components/Mascot/catCharacters.ts`) gets ~40 dialogue lines. Dialogues are organized by trigger (exercise_start, exercise_complete_pass, etc.) and optionally by condition (score_high, first_try, etc.). A lookup function selects a random message for a given cat + trigger + condition.

**Step 1: Write the failing test**

```typescript
// src/content/__tests__/catDialogue.test.ts
import {
  getCatDialogue,
  getRandomCatMessage,
  DIALOGUE_TRIGGERS,
  type DialogueTrigger,
} from '../catDialogue';

describe('catDialogue', () => {
  it('returns messages for every cat × trigger combination', () => {
    const catIds = [
      'mini-meowww', 'jazzy', 'chonky-monke', 'luna',
      'biscuit', 'vinyl', 'aria', 'tempo',
    ];
    const triggers: DialogueTrigger[] = [
      'exercise_start', 'exercise_complete_pass', 'exercise_complete_fail',
      'level_up', 'daily_login', 'idle',
    ];

    for (const catId of catIds) {
      for (const trigger of triggers) {
        const messages = getCatDialogue(catId, trigger);
        expect(messages.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns different messages for different conditions', () => {
    const passMessages = getCatDialogue('mini-meowww', 'exercise_complete_pass', 'score_high');
    const failMessages = getCatDialogue('mini-meowww', 'exercise_complete_fail');
    expect(passMessages).not.toEqual(failMessages);
  });

  it('getRandomCatMessage returns a string', () => {
    const msg = getRandomCatMessage('jazzy', 'exercise_start');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('falls back to base trigger if condition not found', () => {
    const msg = getRandomCatMessage('luna', 'exercise_start', 'nonexistent_condition' as any);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('DIALOGUE_TRIGGERS exports all trigger types', () => {
    expect(DIALOGUE_TRIGGERS).toContain('exercise_start');
    expect(DIALOGUE_TRIGGERS).toContain('exercise_complete_pass');
    expect(DIALOGUE_TRIGGERS).toContain('level_up');
    expect(DIALOGUE_TRIGGERS).toContain('daily_login');
    expect(DIALOGUE_TRIGGERS).toContain('idle');
    expect(DIALOGUE_TRIGGERS).toContain('ai_exercise_intro');
  });

  it('each cat has distinct personality in messages', () => {
    const miniMsg = getCatDialogue('mini-meowww', 'exercise_start');
    const tempoMsg = getCatDialogue('tempo', 'exercise_start');
    // Different cats should have different dialogue pools
    expect(miniMsg).not.toEqual(tempoMsg);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/content/__tests__/catDialogue.test.ts --no-coverage`
Expected: FAIL — cannot find module '../catDialogue'

**Step 3: Write implementation**

Create `src/content/catDialogue.ts` with all 8 cats × ~40 messages each. Each cat has a distinct voice matching their personality from `catCharacters.ts`:

- **Mini Meowww:** Eager, uses "!!" and "ooh", encouraging
- **Jazzy:** Cool slang, musical metaphors, "groove", "flow"
- **Chonky Monké:** Lazy humor, self-deprecating, food metaphors
- **Luna:** Mystical, poetic, references moonlight/stars
- **Biscuit:** Warm, motherly, "sweetie", "honey", cozy
- **Vinyl:** Retro references, music nerd, "classic", "vintage"
- **Aria:** Dramatic, operatic, "BRAVO!", superlatives
- **Tempo:** Precise, metrics-focused, "BPM", exact numbers

The file should export:
```typescript
export type DialogueTrigger =
  | 'exercise_start' | 'exercise_mid_great' | 'exercise_mid_miss'
  | 'exercise_complete_pass' | 'exercise_complete_fail'
  | 'level_up' | 'daily_login' | 'idle'
  | 'ai_exercise_intro' | 'achievement_unlock' | 'streak_milestone';

export type DialogueCondition = 'score_high' | 'score_low' | 'streak' | 'first_try' | 'retry';

export const DIALOGUE_TRIGGERS: DialogueTrigger[] = [...];

export function getCatDialogue(
  catId: string,
  trigger: DialogueTrigger,
  condition?: DialogueCondition
): string[];

export function getRandomCatMessage(
  catId: string,
  trigger: DialogueTrigger,
  condition?: DialogueCondition
): string;
```

Due to the size (~320 messages), this file will be large but is pure data. Organize as a nested `Record<catId, Record<trigger, string[]>>` with optional condition overrides.

**Step 4: Run test to verify it passes**

Run: `npx jest src/content/__tests__/catDialogue.test.ts --no-coverage`
Expected: PASS

**Step 5: Run full test suite**

Run: `npx jest --silent`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/content/catDialogue.ts src/content/__tests__/catDialogue.test.ts
git commit -m "feat: add cat dialogue system with 8 cat personalities"
```

---

### Task 4: Cat Mood Engine

**Files:**
- Create: `src/core/catMood.ts`
- Test: `src/core/__tests__/catMood.test.ts`
- Modify: `src/stores/settingsStore.ts` — add `catMood` state field

**Context:** Cat mood = f(practice recency, session performance, streak). Mood affects which dialogue pool is used and how the cat avatar animates. Three moods: happy, neutral, sleepy.

**Step 1: Write the failing test**

```typescript
// src/core/__tests__/catMood.test.ts
import { calculateCatMood, type CatMood } from '../catMood';

describe('calculateCatMood', () => {
  const now = new Date('2026-02-16T12:00:00Z');

  it('returns happy when practiced today with good score and active streak', () => {
    const mood = calculateCatMood({
      lastPracticeDate: '2026-02-16',
      recentScore: 0.8,
      currentStreak: 3,
      now,
    });
    expect(mood).toBe('happy');
  });

  it('returns neutral when practiced in last 48h', () => {
    const mood = calculateCatMood({
      lastPracticeDate: '2026-02-15',
      recentScore: 0.5,
      currentStreak: 1,
      now,
    });
    expect(mood).toBe('neutral');
  });

  it('returns sleepy when no practice in 48h+', () => {
    const mood = calculateCatMood({
      lastPracticeDate: '2026-02-13',
      recentScore: 0,
      currentStreak: 0,
      now,
    });
    expect(mood).toBe('sleepy');
  });

  it('returns happy even with low score if practiced today and has streak', () => {
    const mood = calculateCatMood({
      lastPracticeDate: '2026-02-16',
      recentScore: 0.5,
      currentStreak: 5,
      now,
    });
    expect(mood).toBe('happy');
  });

  it('returns neutral when practiced today but low score and no streak', () => {
    const mood = calculateCatMood({
      lastPracticeDate: '2026-02-16',
      recentScore: 0.3,
      currentStreak: 0,
      now,
    });
    expect(mood).toBe('neutral');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/core/__tests__/catMood.test.ts --no-coverage`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/core/catMood.ts
export type CatMood = 'happy' | 'neutral' | 'sleepy';

interface MoodInput {
  lastPracticeDate: string; // YYYY-MM-DD
  recentScore: number; // 0.0-1.0
  currentStreak: number;
  now?: Date;
}

export function calculateCatMood(input: MoodInput): CatMood {
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);

  if (!input.lastPracticeDate) return 'sleepy';

  const lastPractice = new Date(input.lastPracticeDate + 'T00:00:00Z');
  const hoursSince = (now.getTime() - lastPractice.getTime()) / (1000 * 60 * 60);

  // Sleepy: no practice in 48h+
  if (hoursSince >= 48) return 'sleepy';

  // Happy: practiced today AND (good score OR active streak)
  const practicedToday = input.lastPracticeDate === today;
  if (practicedToday && (input.recentScore >= 0.7 || input.currentStreak >= 3)) {
    return 'happy';
  }

  // Neutral: anything in between
  return 'neutral';
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/core/__tests__/catMood.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/catMood.ts src/core/__tests__/catMood.test.ts
git commit -m "feat: add cat mood engine"
```

---

### Task 5: Gemini AI Exercise Generation Service

**Files:**
- Create: `src/services/geminiExerciseService.ts`
- Create: `src/services/__tests__/geminiExerciseService.test.ts`
- Create: `src/services/exerciseValidator.ts` (AI output validation)

**Context:** This service calls Gemini Flash API to generate exercises based on the learner profile. It validates the AI output against our exercise schema, retries on failure, and falls back to templates. The service is called in the background to fill a buffer of 3-5 pre-generated exercises.

**Step 1: Write the failing test**

```typescript
// src/services/__tests__/geminiExerciseService.test.ts
import {
  generateExercise,
  validateAIExercise,
  type GenerationParams,
} from '../geminiExerciseService';

// Mock fetch for Gemini API
global.fetch = jest.fn();

describe('geminiExerciseService', () => {
  describe('validateAIExercise', () => {
    it('accepts valid exercise JSON', () => {
      const exercise = {
        notes: [
          { note: 60, startBeat: 0, durationBeats: 1 },
          { note: 62, startBeat: 1, durationBeats: 1 },
        ],
        settings: { tempo: 80, timeSignature: [4, 4], keySignature: 'C' },
      };
      expect(validateAIExercise(exercise)).toBe(true);
    });

    it('rejects notes outside playable range', () => {
      const exercise = {
        notes: [{ note: 10, startBeat: 0, durationBeats: 1 }],
        settings: { tempo: 80, timeSignature: [4, 4], keySignature: 'C' },
      };
      expect(validateAIExercise(exercise)).toBe(false);
    });

    it('rejects impossible intervals at fast tempo', () => {
      const exercise = {
        notes: [
          { note: 36, startBeat: 0, durationBeats: 0.5 },
          { note: 84, startBeat: 0.5, durationBeats: 0.5 }, // 4 octave jump
        ],
        settings: { tempo: 140, timeSignature: [4, 4], keySignature: 'C' },
      };
      expect(validateAIExercise(exercise)).toBe(false);
    });

    it('rejects empty notes array', () => {
      const exercise = {
        notes: [],
        settings: { tempo: 80, timeSignature: [4, 4], keySignature: 'C' },
      };
      expect(validateAIExercise(exercise)).toBe(false);
    });

    it('accepts notes within MIDI range 36-96', () => {
      const exercise = {
        notes: [
          { note: 36, startBeat: 0, durationBeats: 1 },
          { note: 96, startBeat: 1, durationBeats: 1 },
        ],
        settings: { tempo: 60, timeSignature: [4, 4], keySignature: 'C' },
      };
      expect(validateAIExercise(exercise)).toBe(true);
    });
  });

  describe('generateExercise', () => {
    it('calls Gemini API and returns parsed exercise', async () => {
      const mockResponse = {
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                notes: [
                  { note: 60, startBeat: 0, durationBeats: 1 },
                  { note: 62, startBeat: 1, durationBeats: 1 },
                ],
                settings: { tempo: 80, timeSignature: [4, 4], keySignature: 'C' },
                metadata: { title: 'AI Practice', difficulty: 2 },
              }),
            }],
          },
        }],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const params: GenerationParams = {
        weakNotes: [61, 63],
        tempoRange: { min: 60, max: 100 },
        difficulty: 2,
        noteCount: 4,
        skills: { timingAccuracy: 0.7, pitchAccuracy: 0.6, sightReadSpeed: 0.5, chordRecognition: 0.5 },
      };

      const exercise = await generateExercise(params, 'test-api-key');
      expect(exercise).not.toBeNull();
      expect(exercise!.notes.length).toBeGreaterThan(0);
      expect(exercise!.settings.tempo).toBe(80);
    });

    it('returns null on API failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const exercise = await generateExercise({
        weakNotes: [], tempoRange: { min: 60, max: 100 },
        difficulty: 1, noteCount: 4,
        skills: { timingAccuracy: 0.5, pitchAccuracy: 0.5, sightReadSpeed: 0.5, chordRecognition: 0.5 },
      }, 'test-key');

      expect(exercise).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/services/__tests__/geminiExerciseService.test.ts --no-coverage`
Expected: FAIL

**Step 3: Write implementation**

The service should:
1. Build a prompt from `GenerationParams` + exercise JSON schema
2. Call `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
3. Parse the JSON from the response text (handle markdown code blocks)
4. Run `validateAIExercise()` on the result
5. If invalid: retry once with adjusted prompt
6. Return `Exercise | null`

The validation function checks:
- Notes array non-empty, max 32 notes
- All MIDI notes in range 36-96
- No interval > 24 semitones (2 octaves) at tempo > 120 BPM
- No interval > 36 semitones (3 octaves) at any tempo
- Tempo between 30-200 BPM
- startBeat values are non-negative and ascending
- durationBeats > 0

**Step 4: Run test to verify it passes**

Run: `npx jest src/services/__tests__/geminiExerciseService.test.ts --no-coverage`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/geminiExerciseService.ts src/services/__tests__/geminiExerciseService.test.ts
git commit -m "feat: add Gemini AI exercise generation service"
```

---

## Phase B: Exercise Buffer & Adaptive Engine (Tasks 6-8)

---

### Task 6: Exercise Buffer Manager

**Files:**
- Create: `src/services/exerciseBufferManager.ts`
- Test: `src/services/__tests__/exerciseBufferManager.test.ts`

**Context:** Manages a cache of 3-5 pre-generated exercises in AsyncStorage. After each exercise completion, checks buffer size and triggers background generation if low. Provides `getNextExercise()` for instant loading.

The buffer manager:
- Stores generated exercises in AsyncStorage under `keysense_exercise_buffer`
- Dequeues from front, enqueues at back (FIFO)
- Triggers generation when buffer < 3
- Falls back to offline templates when no API key or offline
- Max buffer size: 10 (evict oldest beyond this)

**Step 1: Write tests covering buffer lifecycle**

Test cases:
- `getNextExercise()` returns null when buffer empty
- `addExercise()` adds to buffer, `getNextExercise()` returns it
- Buffer auto-fills to target when below threshold (mock generation)
- FIFO ordering: first added = first returned
- Max size enforcement: adding beyond 10 drops oldest
- `getBufferSize()` returns current count

**Step 2-5: Implement, verify, commit**

```bash
git commit -m "feat: add exercise buffer manager for pre-generated AI exercises"
```

---

### Task 7: Offline Template Exercises

**Files:**
- Create: `src/content/templateExercises.ts`
- Test: `src/content/__tests__/templateExercises.test.ts`

**Context:** 30 template exercises per difficulty tier (easy/medium/hard = 90 total). Templates use the same `NoteEvent[]` format as regular exercises. The template selector uses the learner profile to pick exercises targeting weak notes, then swaps specific notes in the template to match the weak-note queue.

Templates are plain exercise objects with placeholder metadata. The selector:
1. Picks templates matching the target difficulty tier
2. Filters for templates that include notes similar to weak notes
3. Swaps notes to focus on weak areas (e.g., replace C with C# if C# is weak)
4. Returns a complete `Exercise` object ready to play

**Step 1: Write tests**

Test cases:
- `getTemplateExercise(difficulty, learnerProfile)` returns valid Exercise
- Templates exist for all 3 difficulty tiers
- Returned exercise focuses on weak notes when profile has them
- Note swapping preserves rhythm and structure
- Returns different exercises on repeated calls (not always the same)

**Step 2-5: Implement, verify, commit**

```bash
git commit -m "feat: add offline template exercises for AI fallback"
```

---

### Task 8: Wire Adaptive Engine to Exercise Completion

**Files:**
- Modify: `src/screens/ExercisePlayer/ExercisePlayer.tsx` — in `handleExerciseCompletion`, call `learnerProfileStore.recordExerciseResult()`
- Modify: `src/hooks/useExercisePlayback.ts` — expose per-note accuracy data in score result
- Test: Update existing ExercisePlayer tests

**Context:** After each exercise, the ExerciseValidator already produces per-note scores. We need to:
1. Map those to `NoteResult[]` (midiNote + accuracy 0-1)
2. Feed them to `learnerProfileStore.recordExerciseResult()`
3. Trigger buffer top-up in background

**Step 1: Write test for the wiring**

Test that `recordExerciseResult` is called with correct data after exercise completion.

**Step 2-5: Implement, verify, commit**

```bash
git commit -m "feat: wire adaptive learning to exercise completion flow"
```

---

## Phase C: Entry Assessment & AI Flow (Tasks 9-10)

---

### Task 9: Skill Assessment Screen

**Files:**
- Create: `src/screens/SkillAssessmentScreen.tsx`
- Modify: `src/navigation/AppNavigator.tsx` — add SkillAssessment route
- Modify: `src/screens/OnboardingScreen.tsx` — add assessment step after Step 2 (experience level)
- Test: `src/screens/__tests__/SkillAssessmentScreen.test.ts`

**Context:** A 5-round mini-exercise during onboarding. Each round increases difficulty. Measures timing + pitch accuracy to create the initial learner profile and determine starting lesson.

**Rounds:**
1. Single notes, 60 BPM (4 quarter notes: C4, D4, E4, C4)
2. Two-note sequence, 70 BPM (C4-E4, D4-F4)
3. C major chord (C4+E4+G4 simultaneous)
4. Faster with accidentals, 80 BPM (C4, D4, F#4, G4)
5. Syncopated rhythm, 90 BPM (C4 on beat 1, E4 on beat 1.5, G4 on beat 2)

Uses the existing Keyboard + simplified PianoRoll. No scoring UI — just cat encouragement between rounds.

**Skip logic** based on results:
- Rounds 1-2 perfect (>90%) → skip Lessons 1-2
- Rounds 1-3 perfect → skip Lessons 1-4
- All rounds perfect → start at post-curriculum AI exercises
- Any round <60% → start from that difficulty level

**Step 1-5: Write tests, implement screen, wire to navigation, commit**

```bash
git commit -m "feat: add skill assessment screen for onboarding"
```

---

### Task 10: Post-Curriculum AI Exercise Flow

**Files:**
- Modify: `src/screens/ExercisePlayer/ExercisePlayer.tsx` — handle AI exercises (no exerciseId in route, load from buffer)
- Modify: `src/screens/HomeScreen.tsx` — "Continue" card shows AI exercise when post-curriculum
- Modify: `src/content/ContentLoader.ts` — add `isPostCurriculum(progressStore)` helper

**Context:** When a user completes all 6 lessons, their "Continue" button on HomeScreen loads from the AI exercise buffer instead of a static exercise. The ExercisePlayer detects this via a route param `aiMode: true`.

**Step 1-5: Tests, implementation, commit**

```bash
git commit -m "feat: post-curriculum AI exercise flow"
```

---

## Phase D: UI Overhaul (Tasks 11-17)

---

### Task 11: HomeScreen Redesign

**Files:**
- Modify: `src/screens/HomeScreen.tsx` — complete visual overhaul
- May need: `expo-linear-gradient` (check if already installed)

**Context:** Current HomeScreen has basic cards. Redesign to Duolingo-style with:
- Hero section: large cat with XP ring, streak flame, daily goal arc
- Daily challenge card with shimmer border
- Continue learning card with exercise preview
- Quick stats row (4 pills)
- Animated stagger on mount

Use design tokens from Task 1. Use CatAvatar with mood from catMood engine. Cat speech bubble from MascotBubble component.

**Step 1-5: Implement section by section, verify on simulator, commit**

```bash
git commit -m "feat: redesign HomeScreen with Duolingo-style polish"
```

---

### Task 12: Level Map Redesign

**Files:**
- Modify: `src/screens/LevelMapScreen.tsx`

**Context:** Replace zigzag lines with Duolingo-style winding path. Larger nodes (80px), clearer states (gold completed, crimson current with glow, grey locked). Decorative elements (paw prints, music notes). Parallax scroll effect.

Key changes:
- Node size: 72px → 80px
- Completed: gold fill + check + stars below
- Current: crimson + animated glow ring + "START" text
- Locked: grey + lock + level requirement text
- Path: curved Bezier with dotted connector style
- Background: subtle floating music notes (reanimated)

**Step 1-5: Implement, verify, commit**

```bash
git commit -m "feat: redesign level map with winding path and polish"
```

---

### Task 13: Exercise Completion Celebration

**Files:**
- Modify: `src/screens/ExercisePlayer/CompletionModal.tsx`
- Create: `src/components/Confetti.tsx` (lightweight confetti animation)

**Context:** Current completion modal is functional but flat. Add:
- Score counter animates from 0 to final (1s, easing)
- Stars light up one by one (300ms stagger) with haptic per star
- 3 stars → full confetti burst (30 particles, 2s)
- Cat jumps with celebration animation
- "+X XP" flies up and fades
- Cat dialogue from catDialogue system replaces generic tips

**Step 1-5: Implement, verify, commit**

```bash
git commit -m "feat: add celebration animations to completion modal"
```

---

### Task 14: Profile Screen & Achievement Showcase

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`

**Context:** Redesign with:
- Large cat avatar with themed gradient background (cat's color)
- Level badge: circular with progress ring
- Stats grid: 2x2 cards with gradients and animated counters
- Achievement row: horizontal scroll of badges, glow on recent unlocks
- Weekly practice chart: improved bar chart with crimson bars

**Step 1-5: Implement, verify, commit**

```bash
git commit -m "feat: redesign profile screen with achievement showcase"
```

---

### Task 15: Daily Challenge Card Component

**Files:**
- Create: `src/components/DailyChallengeCard.tsx`
- Modify: `src/screens/HomeScreen.tsx` — integrate card
- Modify: `src/stores/progressStore.ts` — add `dailyChallenge` state

**Context:** Full-width card on HomeScreen showing today's AI challenge. Features:
- Animated gradient border (shimmer effect)
- Cat speech bubble introducing the challenge
- "2x XP" badge
- Timer until refresh (hours:minutes)
- Tap → navigate to ExercisePlayer with the daily exercise

Daily challenge generated at midnight, stored in progressStore, loaded from exercise buffer.

**Step 1-5: Tests, implement, verify, commit**

```bash
git commit -m "feat: add daily challenge card with streak integration"
```

---

### Task 16: Streak Flame & XP Animations

**Files:**
- Create: `src/components/StreakFlame.tsx` (animated flame icon)
- Create: `src/components/XpPopup.tsx` (floating "+10 XP" animation)
- Modify: `src/screens/HomeScreen.tsx` — integrate streak display
- Modify: `src/screens/ExercisePlayer/ExercisePlayer.tsx` — show XP popup on note hit

**Context:**
- StreakFlame: Animated flame icon that flickers. Size scales with streak length (small <7, medium 7-30, large 30+).
- XpPopup: "+10 XP" text that floats up and fades out (500ms). Triggered on exercise completion.

**Step 1-5: Implement, verify, commit**

```bash
git commit -m "feat: add streak flame and XP popup animations"
```

---

### Task 17: Onboarding Visual Polish

**Files:**
- Modify: `src/screens/OnboardingScreen.tsx`

**Context:**
- Replace dot indicators with animated progress bar + cat walking along it
- Animated slide transitions between steps (react-native-reanimated shared transitions)
- Different cat for each step (Mini Meowww step 1, Jazzy step 2, etc.)
- Skill assessment integration from Task 9

**Step 1-5: Implement, verify, commit**

```bash
git commit -m "feat: polish onboarding with animations and cat guides"
```

---

## Phase E: Keyboard & Two-Handed Play (Tasks 18-19)

---

### Task 18: Split Keyboard Component

**Files:**
- Create: `src/components/Keyboard/SplitKeyboard.tsx`
- Modify: `src/core/exercises/types.ts` — add `hands?: 'left' | 'right' | 'both'` to Exercise
- Test: `src/components/Keyboard/__tests__/SplitKeyboard.test.ts`

**Context:** Two stacked Keyboard instances for two-handed play. Each half gets its own `startNote`, `octaveCount`, `focusNote`, and touch responder. Layout:
- Top: right hand keyboard (1.5 octaves, keyHeight: 55)
- Bottom: left hand keyboard (1.5 octaves, keyHeight: 55)

Both auto-scroll independently via `focusNote`.

Uses the existing `<Keyboard>` component — SplitKeyboard is a wrapper that:
1. Splits exercise notes by `hand` field or `splitPoint`
2. Manages two `focusNote` values (one per hand)
3. Merges `onNoteOn`/`onNoteOff` callbacks from both halves

**Step 1-5: Tests, implement, verify, commit**

```bash
git commit -m "feat: add split keyboard for two-handed play"
```

---

### Task 19: Wire Split Keyboard to ExercisePlayer

**Files:**
- Modify: `src/screens/ExercisePlayer/ExercisePlayer.tsx` — auto-detect keyboard mode, render SplitKeyboard when needed
- Modify: `src/components/PianoRoll/PianoRoll.tsx` — support split display (two lanes)

**Context:** ExercisePlayer auto-selects keyboard mode:
```typescript
const keyboardMode = exercise.hands === 'both' ? 'split'
  : (maxNote - minNote > 36) ? 'split' : 'normal';
```

When split: render `<SplitKeyboard>` instead of `<Keyboard>`, and render two PianoRoll instances (one per hand).

**Step 1-5: Implement, verify with exercise-04 (Lesson 4, both hands), commit**

```bash
git commit -m "feat: wire split keyboard to exercise player"
```

---

## Phase F: Achievement Expansion & Final Polish (Tasks 20-22)

---

### Task 20: Expand Achievements to 30+

**Files:**
- Modify: `src/core/achievements/achievements.ts` — add new achievements
- Modify: `src/stores/achievementStore.ts` — add new condition types
- Test: Update achievement tests

**Context:** Add achievements per design doc Section 4.2. New condition types needed:
- `session_exercises` (exercises in one session)
- `ai_exercises_first_try` (AI exercises passed first attempt)
- `weak_note_improved` (note accuracy improved by 30%)
- `flow_zone_streak` (consecutive exercises in 65-85% score range)
- `time_of_day` (early bird / night owl)

**Step 1-5: Tests, implement, verify, commit**

```bash
git commit -m "feat: expand achievement system to 30+ achievements"
```

---

### Task 21: Cat Quests & Signature Exercises

**Files:**
- Create: `src/services/catQuestService.ts`
- Modify: `src/screens/HomeScreen.tsx` — show cat quest card
- Test: `src/services/__tests__/catQuestService.test.ts`

**Context:** Cats give daily "quests" based on learner profile:
- "Hey! Try playing F# major today!" (targets weak notes)
- "Let's work on your timing — I have a rhythm exercise for you!"
- Quest selection reads from learnerProfileStore.weakNotes and weakSkills

Each cat also has a "signature exercise" — a short, themed piece that unlocks when selected.

**Step 1-5: Tests, implement, verify, commit**

```bash
git commit -m "feat: add cat quests and signature exercises"
```

---

### Task 22: Final Integration & Verification

**Files:**
- All modified files

**Steps:**

1. Run TypeScript check:
   ```bash
   npx tsc --noEmit
   ```
   Expected: 0 errors

2. Run full test suite:
   ```bash
   npx jest --silent
   ```
   Expected: All tests pass

3. Test on iOS simulator:
   ```bash
   npx expo start --port 8081
   ```
   Verify:
   - HomeScreen shows cat with mood, streak, daily challenge
   - Level map has polished path with clear states
   - Exercise completion has confetti for 3 stars
   - Profile shows achievement showcase
   - Onboarding includes skill assessment
   - AI exercises load from buffer (post-curriculum)
   - Split keyboard works for two-hand exercises

4. Test on physical device (Dev Build):
   - Multi-touch on split keyboard (both hands)
   - Auto-scroll follows notes on both halves
   - Performance: no frame drops during celebrations

5. Commit final state:
   ```bash
   git commit -m "feat: complete gamification & adaptive learning overhaul"
   ```

---

## Dependency Graph

```
Task 1 (Design Tokens) ──────┬── Task 11 (HomeScreen)
                              ├── Task 12 (Level Map)
                              ├── Task 13 (Completion)
                              ├── Task 14 (Profile)
                              ├── Task 15 (Daily Challenge)
                              ├── Task 16 (Streak/XP)
                              └── Task 17 (Onboarding)

Task 2 (Learner Profile) ────┬── Task 5 (Gemini Service)
                              ├── Task 8 (Wire to completion)
                              └── Task 9 (Skill Assessment)

Task 3 (Cat Dialogue) ───────┬── Task 11 (HomeScreen)
                              ├── Task 13 (Completion)
                              └── Task 21 (Cat Quests)

Task 4 (Cat Mood) ───────────── Task 11 (HomeScreen)

Task 5 (Gemini Service) ─────── Task 6 (Buffer Manager)
Task 6 (Buffer Manager) ─────┬── Task 7 (Offline Templates)
                              ├── Task 10 (Post-Curriculum)
                              └── Task 15 (Daily Challenge)

Task 7 (Templates) ──────────── Task 10 (Post-Curriculum)

Task 18 (Split Keyboard) ────── Task 19 (Wire to Player)

Tasks 1-19 ───────────────────── Task 22 (Final Verification)
```

**Parallelizable groups:**
- Tasks 1, 2, 3, 4 can run in parallel
- Tasks 5, 6, 7 are sequential
- Tasks 11-17 (UI) can run in parallel after Task 1
- Tasks 18-19 (keyboard) independent of Tasks 11-17
- Task 20, 21 can run after Tasks 2, 3
