# Phase 2 Completion - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Phase 2 — Level Map UI, Lessons 2-6 E2E, Onboarding Flow, UI Polish + Doc Updates

**Architecture:** Four independent work streams that can be parallelized. Level Map replaces LearnScreen. Onboarding wires up existing OnboardingScreen with persistence. Lessons 2-6 validation ensures content integrity. UI polish adds gradients, shadows, and micro-animations across existing screens.

**Tech Stack:** React Native (Expo), TypeScript, Zustand, react-native-svg, Animated API, AsyncStorage

**Working directory:** `/Users/ut/Documents/KeySense/keysense-app/`

---

## Stream A: Lessons 2-6 E2E Testing (Foundation — Do First)

### Task A1: Content Integrity Tests for Lessons 2-6

**Files:**
- Modify: `src/content/__tests__/ContentLoader.test.ts`
- Read: `content/lessons/lesson-02.json` through `lesson-06.json`
- Read: All exercise JSON files in `content/exercises/lesson-02/` through `lesson-06/`

**Step 1: Write failing tests for Lessons 2-6 content**

Add to the existing `ContentLoader.test.ts`:

```typescript
describe('Lesson 2-6 content integrity', () => {
  const lessonIds = ['lesson-02', 'lesson-03', 'lesson-04', 'lesson-05', 'lesson-06'];

  lessonIds.forEach((lessonId) => {
    describe(lessonId, () => {
      it('should load lesson manifest', () => {
        const lesson = getLesson(lessonId);
        expect(lesson).not.toBeNull();
        expect(lesson!.id).toBe(lessonId);
        expect(lesson!.metadata.title).toBeTruthy();
      });

      it('should have valid exercises that load', () => {
        const lesson = getLesson(lessonId);
        expect(lesson).not.toBeNull();
        const exercises = getLessonExercises(lessonId);
        expect(exercises.length).toBe(lesson!.exercises.length);

        exercises.forEach((ex) => {
          expect(ex.id).toBeTruthy();
          expect(ex.notes.length).toBeGreaterThan(0);
          expect(ex.settings.tempo).toBeGreaterThan(0);
          expect(ex.scoring.passingScore).toBeGreaterThanOrEqual(0);
          expect(ex.scoring.passingScore).toBeLessThanOrEqual(100);
        });
      });

      it('should have valid MIDI ranges', () => {
        const exercises = getLessonExercises(lessonId);
        exercises.forEach((ex) => {
          ex.notes.forEach((note) => {
            expect(note.note).toBeGreaterThanOrEqual(21);
            expect(note.note).toBeLessThanOrEqual(108);
            expect(note.startBeat).toBeGreaterThanOrEqual(0);
            expect(note.durationBeats).toBeGreaterThan(0);
          });
        });
      });

      it('should have ascending star thresholds', () => {
        const exercises = getLessonExercises(lessonId);
        exercises.forEach((ex) => {
          const [one, two, three] = ex.scoring.starThresholds;
          expect(one).toBeLessThan(two);
          expect(two).toBeLessThan(three);
          expect(ex.scoring.passingScore).toBeLessThanOrEqual(one);
        });
      });

      it('should have valid unlock requirements', () => {
        const lesson = getLesson(lessonId);
        if (lesson!.unlockRequirement) {
          const reqLesson = getLesson(lesson!.unlockRequirement.lessonId);
          expect(reqLesson).not.toBeNull();
        }
      });

      it('should support next exercise navigation', () => {
        const exercises = getLessonExercises(lessonId);
        for (let i = 0; i < exercises.length - 1; i++) {
          const nextId = getNextExerciseId(lessonId, exercises[i].id);
          expect(nextId).toBe(exercises[i + 1].id);
        }
        // Last exercise returns null
        const lastId = getNextExerciseId(lessonId, exercises[exercises.length - 1].id);
        expect(lastId).toBeNull();
      });
    });
  });
});
```

**Step 2: Run tests**

```bash
npx jest src/content/__tests__/ContentLoader.test.ts --verbose
```

Expected: Tests should pass if content JSON is valid. Fix any failures by correcting the exercise JSON files.

**Step 3: Fix any content issues found**

Common issues to check:
- Exercise IDs in lesson manifest must match IDs in exercise JSON files
- Exercise IDs in ContentLoader EXERCISE_REGISTRY must match manifest IDs
- Star thresholds must be ascending and passingScore <= starThresholds[0]
- All MIDI notes in 21-108 range

**Step 4: Run scoring pipeline test for each lesson**

Add to same test file:

```typescript
import { scoreExercise } from '../../core/exercises/ExerciseValidator';

describe('Scoring pipeline for all lessons', () => {
  const lessonIds = ['lesson-01', 'lesson-02', 'lesson-03', 'lesson-04', 'lesson-05', 'lesson-06'];

  lessonIds.forEach((lessonId) => {
    it(`${lessonId}: perfect play should score 100%`, () => {
      const exercises = getLessonExercises(lessonId);
      exercises.forEach((ex) => {
        // Simulate perfect play: each note played at exact expected time
        const msPerBeat = 60000 / ex.settings.tempo;
        const perfectNotes = ex.notes.map((note) => ({
          type: 'noteOn' as const,
          note: note.note,
          velocity: 64,
          timestamp: note.startBeat * msPerBeat,
          channel: 0,
        }));
        const score = scoreExercise(ex, perfectNotes);
        expect(score.overall).toBeGreaterThanOrEqual(90);
        expect(score.isPassed).toBe(true);
        expect(score.stars).toBeGreaterThanOrEqual(2);
      });
    });

    it(`${lessonId}: no notes played should score 0`, () => {
      const exercises = getLessonExercises(lessonId);
      exercises.forEach((ex) => {
        const score = scoreExercise(ex, []);
        expect(score.overall).toBeLessThanOrEqual(10);
        expect(score.isPassed).toBe(false);
      });
    });
  });
});
```

**Step 5: Run all tests and commit**

```bash
npx jest --silent && npx tsc --noEmit
git add src/content/__tests__/ContentLoader.test.ts
git commit -m "test: add E2E content integrity tests for lessons 2-6"
```

---

## Stream B: Onboarding Flow Activation

### Task B1: Wire Onboarding to Persistence

The OnboardingScreen already exists at `src/screens/OnboardingScreen.tsx` with 4 steps.
It just needs to: (a) persist completion to settingsStore, (b) read the flag in AppNavigator.

**Files:**
- Modify: `src/stores/settingsStore.ts` — add `hasCompletedOnboarding` field
- Modify: `src/stores/types.ts` — add to SettingsStoreState interface
- Modify: `src/navigation/AppNavigator.tsx` — read from store instead of hardcoded `true`
- Modify: `src/screens/OnboardingScreen.tsx` — persist on completion

**Step 1: Add `hasCompletedOnboarding` to settings store types**

In `src/stores/types.ts`, add to the SettingsStoreState interface:

```typescript
hasCompletedOnboarding: boolean;
setHasCompletedOnboarding: (completed: boolean) => void;
```

**Step 2: Add to settingsStore defaults and action**

In `src/stores/settingsStore.ts`:

Add to `defaultSettings`:
```typescript
hasCompletedOnboarding: false,
```

Add action in `create()`:
```typescript
setHasCompletedOnboarding: (completed: boolean) => {
  set({ hasCompletedOnboarding: completed });
  debouncedSave({ ...get(), hasCompletedOnboarding: completed });
},
```

**Step 3: Update AppNavigator to read from store**

```typescript
import { useSettingsStore } from '../stores/settingsStore';

export function AppNavigator() {
  const hasCompletedOnboarding = useSettingsStore((s) => s.hasCompletedOnboarding);
  // ... rest stays the same
}
```

**Step 4: Update OnboardingScreen to persist on completion**

In `OnboardingScreen.tsx`, import the store and call on final step:

```typescript
import { useSettingsStore } from '../stores/settingsStore';

// Inside OnboardingScreen:
const setHasCompletedOnboarding = useSettingsStore((s) => s.setHasCompletedOnboarding);

const handleNext = () => {
  if (step === 4) {
    setHasCompletedOnboarding(true);
    navigation.navigate('MainTabs');
  } else {
    setStep((prev) => prev + 1);
  }
};
```

**Step 5: Also persist experience level, goal, and hasMidi to settingsStore**

Add fields to types and store:
```typescript
// In types.ts SettingsStoreState:
experienceLevel: 'beginner' | 'intermediate' | 'returning' | null;
learningGoal: 'songs' | 'technique' | 'exploration' | null;

// In settingsStore defaults:
experienceLevel: null,
learningGoal: null,
```

Update OnboardingScreen to save these on step transitions.

**Step 6: Run tests and commit**

```bash
npx tsc --noEmit && npx jest --silent
git add src/stores/settingsStore.ts src/stores/types.ts src/navigation/AppNavigator.tsx src/screens/OnboardingScreen.tsx
git commit -m "feat: wire onboarding flow to persistence"
```

---

## Stream C: Level Map UI

### Task C1: Install react-native-svg

**Step 1: Check if already installed**
```bash
npx expo install react-native-svg
```

**Step 2: Verify it works**
```bash
npx tsc --noEmit
```

### Task C2: Create LevelMapScreen Component

**Files:**
- Create: `src/screens/LevelMapScreen.tsx`
- Modify: `src/navigation/AppNavigator.tsx` — replace LearnScreen import

**Step 1: Create the LevelMapScreen**

The screen uses a FlatList with inverted layout. Each lesson is a node connected by SVG paths.

Key data flow:
- `ContentLoader.getLessons()` → ordered lesson list
- `progressStore.lessonProgress[id]` → completion status
- `getLessonExercises(id)` → exercise count for progress

Node states:
- `completed`: All exercises have `completedAt` — green circle with checkmark
- `current`: First lesson where `status !== 'completed'` — pulsing blue, larger
- `locked`: Previous lesson not completed — grey with lock icon

Layout: Nodes zigzag left-right, connected by curved SVG paths.

```typescript
// src/screens/LevelMapScreen.tsx
import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useProgressStore } from '../stores/progressStore';
import { getLessons, getLessonExercises, getLesson } from '../content/ContentLoader';
import type { RootStackParamList } from '../navigation/AppNavigator';
// ... full implementation in task
```

The component should:
1. Render lesson nodes with SVG path connectors
2. Auto-scroll to current lesson
3. Show star count for completed lessons
4. Pulse animation on current node
5. Navigate to first uncompleted exercise on tap
6. Show lock icon + "Complete X to unlock" toast on locked node tap

**Step 2: Replace LearnScreen in AppNavigator**

```typescript
// Change import
import { LevelMapScreen } from '../screens/LevelMapScreen';

// Change Tab.Screen
<Tab.Screen
  name="Learn"
  component={LevelMapScreen}
  // ...
/>
```

**Step 3: Run and verify**
```bash
npx tsc --noEmit && npx jest --silent
```

**Step 4: Commit**
```bash
git add src/screens/LevelMapScreen.tsx src/navigation/AppNavigator.tsx
git commit -m "feat: add Duolingo-style level map (replaces flat lesson list)"
```

### Task C3: Level Map Polish

- Add pulse animation to current node (Animated.loop)
- Add path fill animation when lesson completes
- Add celebration effect (stars fly out) — optional micro-animation
- Test landscape/portrait behavior

---

## Stream D: UI Polish + Doc Updates

### Task D1: Update Technical Specification

**Files:**
- Modify: `TECHNICAL_SPECIFICATION.md` — update persistence (MMKV → AsyncStorage), store patterns

Key changes:
- Replace MMKV references with AsyncStorage
- Remove SQLite references
- Update Zustand store pattern to match v5 API
- Update component hierarchy to reflect actual navigation

### Task D2: Update PRD Phase Status

**Files:**
- Modify: `keysense-app/PRD.md` — mark Phase 2 items as done/in-progress

### Task D3: HomeScreen Polish

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

Changes:
- Add subtle gradient background to header area
- Improve card shadows and border radius consistency
- Add level progress bar in header (shows XP toward next level)

### Task D4: ProfileScreen Polish

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`

Changes:
- Add gradient to stats header
- Improve achievement preview section
- Add weekly practice chart visualization

### Task D5: CompletionModal Polish

**Files:**
- Modify: `src/screens/ExercisePlayer/CompletionModal.tsx`

Changes:
- Add confetti-style celebration for 3-star scores
- Improve score circle with gradient ring
- Better visual distinction between pass/fail states

---

## Execution Order

```
┌──────────────────────────────────────────────┐
│ Stream A: Lessons 2-6 E2E (Task A1)         │  ← Do first (foundation)
├──────────────────────────────────────────────┤
│                                              │
│  In parallel after A1:                       │
│  ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ Stream B   │ │ Stream C   │ │ Stream D │ │
│  │ Onboarding │ │ Level Map  │ │ UI Polish│ │
│  │ B1         │ │ C1→C2→C3   │ │ D1→D5   │ │
│  └────────────┘ └────────────┘ └──────────┘ │
│                                              │
├──────────────────────────────────────────────┤
│ Final: npx tsc --noEmit && npx jest --silent │
│ Commit all remaining changes                 │
└──────────────────────────────────────────────┘
```

---

## Verification Checklist

- [ ] 0 TypeScript errors
- [ ] All tests pass (expect ~490+ with new tests)
- [ ] Lessons 2-6 exercises all loadable and scorable
- [ ] Level Map renders with correct node states
- [ ] Onboarding flow works end-to-end (new user → first exercise)
- [ ] Score completion screen shows rounded integers
- [ ] UI polish applied to HomeScreen, ProfileScreen, CompletionModal
- [ ] Docs updated (Tech Spec, PRD)
