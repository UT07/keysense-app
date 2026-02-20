# Purrrfect Keys - AI-Powered Piano Learning App

## Project Overview
A Duolingo-style piano learning app with real-time feedback, MIDI support, and AI coaching.
Built with React Native (Expo) + Firebase + Gemini AI.

**Stack:** Expo SDK 52+, TypeScript 5.x, react-native-audio-api, Zustand, Firebase

## Current Sprint: 16-Week Roadmap (Feb 17 → Jun 8, 2026)

**Codebase Health:** 75 test suites, 1,725 tests passing, 0 TypeScript errors

Previous sprints all COMPLETE:
- Phase 4+ (Gamification + Adaptive Learning + UI Overhaul): 22/22 tasks
- Avatar Redesign + Rive System: committed
- Gameplay UX Rework: 10/10 tasks
- QA Sprint: 18 new test suites, 6 bug fixes
- Bug Fix Sprint (Feb 19-20): 10+ issues closed, cross-device sync, Google Sign-In, Detox E2E
- Phase 5 (Adaptive Learning Revamp): 18/18 tasks, ~150+ new tests

**Recently Completed (Feb 20, 2026):**
- Phase 5 Adaptive Learning Revamp: all 18 tasks (5.1-5.18) across 7 batches complete
- SkillTree data model: DAG of ~30 skill nodes with categories and prerequisites
- CurriculumEngine: AI session planner (warm-up + lesson + challenge) using learner profile
- AI exercise generation upgrade: skill-aware generation with warm-up/challenge convenience methods
- DailySessionScreen: "Today's Practice" with AI-picked sessions, replaces static lesson list on Home
- Voice coaching pipeline: VoiceCoachingService + TTSService (expo-speech) + per-cat voice configs
- Offline coaching templates: 50+ pre-generated coaching strings for Gemini fallback
- WeakSpotDetector: pattern-based detection (note/transition/timing/hand weaknesses)
- DifficultyEngine: progressive difficulty adjustment (5 BPM per mastered exercise)
- FreePlayAnalyzer: key/scale detection + drill generation from free play sessions
- PlayScreen analysis card: post-play feedback after 2s silence with "Generate Drill" button
- Cross-device sync improvements: sequential migration/pull, XP sync, createGamificationData guard
- Piano roll Tetris cascade: notes fall from top during count-in (removed effectiveBeat clamp)
- TTSService lazy loading: prevents crashes when expo-speech native module unavailable

**Active Roadmap:**
- ~~Phase 5: Adaptive Learning Revamp (Weeks 1-3)~~ COMPLETE
- Phase 6: Avatar Evolution & Gamification (Weeks 4-6) — Pokemon evolution, gems, abilities
- Phase 7: Game Feel & Polish (Weeks 7-8) — micro-interactions, Rive, transitions
- Phase 8: Audio Input (Weeks 9-10) — mic polyphonic detection (R&D parallel from Week 1)
- Music Library (parallel pipeline, UI integration Weeks 11-12)
- Phase 9: Social & Leaderboards (Weeks 11-12)
- Phase 10: QA + Launch (Weeks 13-16)

See `docs/plans/2026-02-17-16-week-roadmap.md` for full details.

## Quick Commands

```bash
# Development
npm run start              # Start Expo dev server
npm run ios                # Run on iOS simulator
npm run android            # Run on Android emulator
npm run web                # Run web version (limited)

# Quality
npm run typecheck          # TypeScript validation
npm run lint               # ESLint + Prettier
npm run lint:fix           # Auto-fix linting issues
npm run test               # Run Jest tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report

# Building
npm run build:ios          # EAS Build for iOS
npm run build:android      # EAS Build for Android
npm run build:preview      # Internal testing build

# Utilities
npm run generate:exercise  # Create new exercise from template
npm run measure:latency    # Audio latency test harness
```

## Architecture Principles

1. **Audio code lives in native modules** - Never process audio buffers in JS
2. **Business logic is pure TypeScript** - No React imports in `/src/core/`
3. **State management with Zustand** - See `/src/stores/` for patterns
4. **Exercise definitions are JSON** - See @agent_docs/exercise-format.md
5. **Offline-first** - Core loop must work without network

## Project Structure

```
src/
├── content/              # Exercise/lesson content loading from JSON
│   ├── ContentLoader.ts  # Static registry: getExercise(), getLessons(), etc.
│   └── catDialogue.ts   # Cat personality dialogue system (8 cats x 40 messages)
├── core/                 # Platform-agnostic business logic (NO React imports)
│   ├── exercises/        # Exercise validation, scoring algorithms
│   ├── curriculum/       # SkillTree, CurriculumEngine, WeakSpotDetector, DifficultyEngine
│   ├── music/            # Music theory utilities (notes, scales, chords)
│   ├── progression/      # XP calculation, level unlocks
│   ├── analytics/        # Event tracking abstraction
│   └── catMood.ts          # Cat mood engine (happy/neutral/sleepy)
├── audio/                # Audio engine abstraction
│   ├── AudioEngine.ts    # Interface definition
│   ├── ExpoAudioEngine.ts # expo-av implementation with sound pooling
│   ├── WebAudioEngine.ts  # react-native-audio-api JSI implementation
│   ├── createAudioEngine.ts # Factory: tries WebAudio, falls back to Expo
│   └── samples/          # Piano sample management
├── input/                # Input handling
│   ├── MidiInput.ts      # MIDI device handling
│   └── PitchDetector.ts  # Microphone fallback (TurboModule wrapper)
├── stores/               # Zustand stores
│   ├── exerciseStore.ts  # Current exercise state
│   ├── progressStore.ts  # User progress, XP, streaks, lesson progress
│   ├── settingsStore.ts  # User preferences
│   └── learnerProfileStore.ts  # Adaptive learning: per-note accuracy, skills, tempo range
├── screens/              # Screen components
│   └── ExercisePlayer/   # Main exercise gameplay screen
├── components/           # Reusable UI components
│   ├── Keyboard/         # Piano keyboard (smart zoomed range per exercise)
│   │   ├── SplitKeyboard.tsx  # Two-handed split keyboard
│   │   └── computeZoomedRange.ts  # Smart octave selection from exercise notes
│   ├── PianoRoll/        # VerticalPianoRoll (falling notes) + legacy PianoRoll
│   ├── Mascot/           # Cat avatars (CatAvatar, KeysieSvg, RiveCatAvatar, ExerciseBuddy, MascotBubble)
│   ├── transitions/      # ExerciseCard, LessonCompleteScreen, AchievementToast, ConfettiEffect
│   └── common/           # ScoreRing, PressableScale, buttons, cards
├── hooks/                # Custom React hooks
│   └── useExercisePlayback.ts  # Playback timing, completion, MIDI events
├── services/             # External integrations + internal services
│   └── demoPlayback.ts   # DemoPlaybackService (visual-only note demonstration)
├── navigation/           # React Navigation setup
├── services/             # External integrations
│   ├── firebase/         # Auth, Firestore, Functions
│   ├── ai/               # Gemini AI coaching (GeminiCoach + CoachingService + VoiceCoachingService)
│   ├── tts/              # TTSService (expo-speech wrapper) + catVoiceConfig (per-cat voice params)
│   ├── analytics/        # PostHog
│   ├── FreePlayAnalyzer.ts  # Free play analysis with key/scale detection
│   └── geminiExerciseService.ts  # AI exercise generation via Gemini Flash (skill-aware)
├── theme/                # Design system
│   └── tokens.ts  # Design tokens, colors, gradients, spacing
└── utils/                # Shared utilities
```

## Key Files to Understand

| File | Purpose |
|------|---------|
| `src/content/ContentLoader.ts` | Exercise/lesson loading from JSON (static require registry) |
| `src/audio/createAudioEngine.ts` | Audio factory: WebAudioEngine (JSI) with ExpoAudioEngine fallback |
| `src/audio/ExpoAudioEngine.ts` | Audio playback with round-robin voice pools (50 pre-loaded sounds) |
| `src/core/exercises/ExerciseValidator.ts` | Core scoring logic - pure TS, heavily tested |
| `src/core/exercises/types.ts` | Exercise and score type definitions |
| `src/input/MidiInput.ts` | MIDI device connection and event handling |
| `src/stores/exerciseStore.ts` | Exercise session state management |
| `src/stores/progressStore.ts` | XP, levels, streaks, lesson progress, daily goals |
| `src/screens/ExercisePlayer/ExercisePlayer.tsx` | Main gameplay screen with scoring + completion |
| `src/components/Keyboard/Keyboard.tsx` | Interactive piano keyboard (dynamic range) |
| `src/components/PianoRoll/PianoRoll.tsx` | Transform-based scrolling note display |
| `src/services/ai/GeminiCoach.ts` | AI coaching via Gemini 2.0 Flash with fallback |
| `src/hooks/useExercisePlayback.ts` | Playback timing, MIDI events, completion handler |
| `src/components/Mascot/CatAvatar.tsx` | Animated SVG cat avatar (floating idle, bounce entry, glow aura) |
| `src/components/Mascot/ExerciseBuddy.tsx` | In-exercise cat companion with contextual reactions |
| `src/components/Mascot/RiveCatAvatar.tsx` | Rive-animated cat avatar (high-fidelity animations) |
| `src/components/common/ScoreRing.tsx` | Animated SVG circle score indicator |
| `src/components/Keyboard/keyboardHitTest.ts` | Multi-touch coordinate-to-MIDI mapping |
| `src/components/Keyboard/computeZoomedRange.ts` | Smart octave selection (1-2 octaves from exercise notes) |
| `src/components/PianoRoll/VerticalPianoRoll.tsx` | Falling-note display (top-to-bottom, Synthesia-style) |
| `src/services/demoPlayback.ts` | Demo mode: visual-only note playback with cat dialogue |
| `src/content/catDialogue.ts` | Cat personality dialogue (8 cats, ~320 messages, trigger-based) |
| `src/core/curriculum/SkillTree.ts` | DAG of ~30 skill nodes: note-finding, intervals, scales, chords, rhythm, hand-independence, songs |
| `src/core/curriculum/CurriculumEngine.ts` | AI session planner: generateSessionPlan() -> warm-up + lesson + challenge |
| `src/core/curriculum/WeakSpotDetector.ts` | Pattern-based weak spot detection (note/transition/timing/hand) |
| `src/core/curriculum/DifficultyEngine.ts` | Progressive difficulty adjustment (5 BPM per mastered exercise) |
| `src/screens/DailySessionScreen.tsx` | "Today's Practice" screen with AI-picked warm-up/lesson/challenge sections |
| `src/services/ai/VoiceCoachingService.ts` | Enhanced coaching with cat personality integration |
| `src/services/tts/TTSService.ts` | expo-speech wrapper with lazy loading and graceful degradation |
| `src/services/tts/catVoiceConfig.ts` | Per-cat voice parameters (8 cats x pitch/rate/language) |
| `src/services/FreePlayAnalyzer.ts` | Free play analysis: key/scale detection, drill generation |
| `src/content/offlineCoachingTemplates.ts` | 50+ pre-generated coaching strings for offline fallback |
| `src/stores/learnerProfileStore.ts` | Adaptive learning: per-note accuracy, skills, tempo range, mastered skills |
| `src/stores/authStore.ts` | Firebase Auth: anonymous, email, Google, Apple sign-in + linking |
| `src/services/firebase/syncService.ts` | Cross-device sync: offline queue + Firestore pull/merge |
| `src/services/firebase/dataMigration.ts` | One-time local→cloud migration on first sign-in |
| `docs/plans/2026-02-16-gamification-adaptive-design.md` | Current sprint design doc |
| `docs/plans/2026-02-16-gamification-adaptive-implementation.md` | Current sprint implementation plan (22 tasks) |
| `content/exercises/` | JSON exercise definitions (30 exercises, 6 lessons) |

## Code Style

- **TypeScript:** Strict mode, no `any` types, explicit return types on exports
- **React:** Functional components only, hooks for logic extraction
- **Imports:** Use ES modules, destructure where possible
- **Naming:** camelCase for variables/functions, PascalCase for components/types
- **Files:** One component per file, colocate styles and tests

```typescript
// ✅ Good
import { useState, useCallback } from 'react';
import type { Exercise, NoteEvent } from '@/core/exercises/types';

export function useExercisePlayer(exercise: Exercise): ExercisePlayerState {
  // ...
}

// ❌ Bad
import React from 'react';  // Don't import React namespace
const exercise: any = {};   // No any types
```

## Audio Development Rules

**CRITICAL: Audio buffer processing must NEVER happen in JavaScript.**

```typescript
// ❌ NEVER DO THIS - allocates on every callback, causes glitches
onAudioBuffer((buffer: Float32Array) => {
  const analysis = new Float32Array(buffer.length);  // BAD!
  processBuffer(analysis);
});

// ✅ CORRECT - pre-allocated buffers
const analysisBuffer = new Float32Array(4096);
onAudioBuffer((buffer: Float32Array) => {
  analysisBuffer.set(buffer);
  processBuffer(analysisBuffer);
});
```

**Latency Targets:**
- Touch → Sound: <20ms
- MIDI → Sound: <15ms
- Microphone → Pitch detection: <150ms (fallback only)

## Testing Strategy

| Layer | Tool | Location |
|-------|------|----------|
| Core logic | Jest | `src/core/**/__tests__/` |
| Components | React Testing Library | `src/components/**/__tests__/` |
| Integration | Jest + mocks | `src/__tests__/integration/` |
| E2E | Detox | `e2e/` |
| Audio latency | Custom harness | `scripts/measure-latency.ts` |

**1,725 tests, 75 suites.** Run tests before committing:
```bash
npm run typecheck && npm run test
```

## Reference Documentation

For detailed guidance on specific topics, read these files:

- @agent_docs/architecture.md - System design and data flow
- @agent_docs/audio-pipeline.md - Audio latency budgets and patterns
- @agent_docs/exercise-format.md - Exercise JSON schema and examples
- @agent_docs/scoring-algorithm.md - Note validation and scoring logic
- @agent_docs/midi-integration.md - MIDI device handling
- @agent_docs/firebase-schema.md - Firestore data models
- @agent_docs/ai-coaching.md - Gemini prompts and caching
- @agent_docs/stabilization-report.md - Full changelog of all fixes and improvements
- @agent_docs/feature-level-map.md - Planned Duolingo-style level map UI

## Common Tasks

### Adding a New Exercise
1. Create JSON in `content/exercises/lesson-X/exercise-Y.json`
2. Follow schema in @agent_docs/exercise-format.md
3. Add to lesson manifest in `content/lessons/lesson-X.json`
4. Test with `npm run validate:exercises`

### Adding a New Screen
1. Create component in `src/screens/NewScreen.tsx`
2. Add to navigation in `src/navigation/AppNavigator.tsx`
3. Add screen params to `RootStackParamList` in `src/navigation/AppNavigator.tsx`

### Modifying Scoring Logic
1. Update algorithm in `src/core/exercises/ExerciseValidator.ts`
2. Update tests in `src/core/exercises/__tests__/`
3. Document changes in @agent_docs/scoring-algorithm.md

## Environment Variables

```bash
# .env.local (never commit!)
EXPO_PUBLIC_FIREBASE_API_KEY=xxx
EXPO_PUBLIC_FIREBASE_PROJECT_ID=xxx
EXPO_PUBLIC_GEMINI_API_KEY=xxx
POSTHOG_API_KEY=xxx
```

## IMPORTANT REMINDERS

1. **Always test audio changes on physical devices** - Simulators have unreliable audio
2. **MIDI testing requires actual hardware** - Use a MIDI keyboard for integration tests
3. **Exercise content is version-controlled** - Update version number when changing exercises
4. **Firebase rules changes require review** - Security-critical
5. **Run typecheck before committing** - CI will fail otherwise
6. **Pitch detection is fallback only** - Optimize for MIDI input first
7. **react-native-screens PINNED to 4.4.0** — versions 4.19+ have Fabric codegen bug with RN 0.76. After version changes, clean iOS build: `rm -rf ios/Pods ios/Podfile.lock ios/build && cd ios && pod install`
