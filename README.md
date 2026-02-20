# Purrrfect Keys

> Learn piano with real-time feedback, MIDI support, AI coaching, and collectible cat companions.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo_SDK-52-000020)](https://expo.dev/)
[![Tests](https://img.shields.io/badge/Tests-1725%20passing-brightgreen)]()

---

## Overview

Purrrfect Keys is a Duolingo-style piano learning app that combines real-time performance analysis with AI-driven adaptive learning. It scores your playing across four dimensions -- accuracy, timing, completeness, and precision -- and delivers personalized coaching through your cat companion.

**What makes it different:**
- AI curriculum engine that personalizes exercises from Day 1
- JSI-based audio with <20ms touch-to-sound latency
- Weighted scoring (not just "right or wrong" detection)
- Voice coaching with per-cat personality via TTS
- Offline-first -- core learning loop works without network
- Free play mode with real-time pattern analysis and drill generation

---

## Features

### Core Experience
- 6 structured lessons with 30 exercises (beginner to intermediate)
- AI-generated exercises targeting weak spots and skill gaps
- Real-time vertical piano roll with falling notes (Synthesia-style)
- Touch keyboard with haptic feedback and latency compensation
- MIDI keyboard support (USB + Bluetooth)
- Landscape exercise player with dynamic note/keyboard range
- Free play mode with post-play analysis and "Generate Drill" CTA

### Adaptive Learning (Phase 5)
- **SkillTree** -- DAG of ~30 skill nodes: notes -> intervals -> scales -> chords -> songs
- **CurriculumEngine** -- AI session planner: warm-up + lesson + challenge, explains why each exercise was chosen
- **DailySessionScreen** -- "Today's Practice" replacing static lesson list
- **WeakSpotDetector** -- pattern-based detection (note transitions, timing, hand-specific issues)
- **DifficultyEngine** -- progressive difficulty: 5 BPM per mastered exercise, gradual note range expansion
- **FreePlayAnalyzer** -- detects key/scale from free play, suggests targeted drills

### Voice Coaching
- Gemini 2.0 Flash generates personalized feedback from learner profile + score
- Per-cat voice settings via expo-speech TTS (8 cats x pitch/rate/language)
- 50+ offline coaching templates for when Gemini is unavailable
- Pre-exercise tips: "Focus on your left hand this time"

### Gamification
- XP system with 20+ levels (exponential `100 * 1.5^(level-1)` curve)
- Daily streaks with freeze protection
- 18 unlockable achievements across 6 categories
- 8 collectible cat characters with backstories and unlock levels
- 68 curated music fun facts between exercises
- Cat companion with mood-based dialogue (8 cats x 40 messages)

### Infrastructure
- Firebase Authentication (anonymous, email, Google Sign-In, Apple Sign-In)
- Cross-device sync with offline queue, Firestore pull/merge, conflict resolution
- Progress persistence via AsyncStorage with debounced saves
- PostHog analytics integration
- Detox E2E test suite (15 suites)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native (Expo SDK 52+) |
| Language | TypeScript 5.x (strict mode) |
| Audio | react-native-audio-api via JSI (<1ms overhead) |
| State | Zustand v5 with AsyncStorage persistence |
| Navigation | React Navigation 6 (native stack + bottom tabs) |
| Animation | react-native-reanimated 3 |
| Backend | Firebase (Auth, Firestore, Cloud Functions) |
| AI | Google Gemini 2.0 Flash |
| TTS | expo-speech (per-cat voice config) |
| Analytics | PostHog |
| Testing | Jest + React Testing Library (1,725 tests, 75 suites) |
| E2E | Detox (15 suites) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npx expo`)
- iOS Simulator or Android Emulator
- (Optional) USB/Bluetooth MIDI keyboard

### Installation

```bash
git clone https://github.com/UT07/purrrfectKeys.git
cd purrrfect-keys
npm install --legacy-peer-deps
```

### Environment Variables

Create `.env.local` at the project root:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=your_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_key
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_google_client_id
POSTHOG_API_KEY=your_posthog_key
```

### Development

```bash
npx expo start --port 8081   # Start dev server
npm run ios                   # Run on iOS simulator
npm run android               # Run on Android emulator
```

### Quality Checks

```bash
npm run typecheck    # TypeScript validation (0 errors)
npm run test         # Jest tests (1,725 passing, 75 suites)
npm run lint         # ESLint + Prettier
npm run lint:fix     # Auto-fix linting issues
```

---

## Architecture

```
src/
  core/              Pure TypeScript business logic (no React imports)
    exercises/       Exercise validation, scoring algorithms
    music/           Music theory utilities (notes, scales, chords)
    progression/     XP calculation, level unlocks
    achievements/    Achievement definitions and checking
    curriculum/      SkillTree, CurriculumEngine, WeakSpotDetector, DifficultyEngine
  audio/             Audio engine (JSI Web Audio + Expo fallback)
  input/             MIDI device handling
  hooks/             React hooks (useExercisePlayback, etc.)
  stores/            Zustand state management
  screens/           Screen components
    ExercisePlayer/  Core exercise experience (landscape)
  components/        Reusable UI
    Keyboard/        Touch piano keyboard (dynamic range, smart zooming)
    PianoRoll/       Vertical falling-note display (Synthesia-style)
    Mascot/          Cat avatars (SVG + Rive, 5 moods, animations)
    transitions/     ExerciseCard, LessonComplete, AchievementToast
    common/          ScoreRing, PressableScale, buttons, cards
  navigation/        React Navigation setup
  services/          External integrations
    firebase/        Auth, Firestore sync, data migration
    ai/              Gemini coaching (GeminiCoach, CoachingService, VoiceCoachingService)
    tts/             Text-to-speech (expo-speech, per-cat voice config)
  content/           Exercise loader, cat dialogue, offline coaching templates

content/
  exercises/         JSON exercise definitions (6 lessons, 30 exercises)
  lessons/           Lesson metadata and sequencing
```

**Design principles:**
1. Audio code lives in native modules via JSI -- never process audio buffers in JS
2. Business logic is pure TypeScript in `/src/core/` -- testable without React
3. Offline-first -- core loop works without network
4. Exercise definitions are JSON -- content is data, not code
5. Singleton audio engine persists across screen navigations
6. AI is the teacher -- curriculum adapts from Day 1 based on learner profile

---

## Scoring System

Exercises are scored on four weighted dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Accuracy | 40% | Correct notes played |
| Timing | 35% | Timing precision (per-note ms offset from expected beat) |
| Completeness | 15% | Percentage of expected notes covered |
| Extra Notes | 10% | Penalty for wrong/extra notes played |

Touch input receives 20ms latency compensation and minimum 60ms/160ms timing tolerances to account for platform latency.

Stars are awarded at configurable thresholds (typically 60/80/95).

---

## Cat Characters

8 music-themed cats with unique backstories:

| Cat | Unlock | Skill | Personality |
|-----|--------|-------|-------------|
| Mini Meowww | Level 1 | Precision & Expression | Tiny but Mighty |
| Jazzy | Level 2 | Jazz Improvisation | Cool & Smooth |
| Chonky Monke | Level 3 | Power Chords & Bass | Absolute Unit |
| Luna | Level 5 | Moonlight Compositions | Mysterious |
| Biscuit | Level 8 | C Major Specialist | Cozy & Warm |
| Vinyl | Level 12 | DJ & Mixing | Hipster |
| Aria | Level 15 | Opera & Perfect Pitch | Elegant |
| Tempo | Level 20 | Speed Playing | Hyperactive |

---

## Exercise Format

Exercises are defined as JSON. See [agent_docs/exercise-format.md](agent_docs/exercise-format.md) for the full schema.

```json
{
  "id": "lesson-01-ex-01",
  "metadata": { "title": "Find Middle C", "difficulty": 1 },
  "settings": { "tempo": 50, "timeSignature": [4, 4], "countIn": 4 },
  "notes": [
    { "note": 60, "startBeat": 0, "durationBeats": 1, "hand": "right" }
  ],
  "scoring": { "timingToleranceMs": 75, "passingScore": 60 }
}
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](CLAUDE.md) | Development conventions and project guide |
| [agent_docs/architecture.md](agent_docs/architecture.md) | System design and data flow |
| [agent_docs/audio-pipeline.md](agent_docs/audio-pipeline.md) | Audio latency budgets |
| [agent_docs/exercise-format.md](agent_docs/exercise-format.md) | Exercise JSON schema |
| [agent_docs/scoring-algorithm.md](agent_docs/scoring-algorithm.md) | Scoring logic details |
| [agent_docs/midi-integration.md](agent_docs/midi-integration.md) | MIDI device handling |
| [agent_docs/ai-coaching.md](agent_docs/ai-coaching.md) | Gemini coaching integration |
| [agent_docs/stabilization-report.md](agent_docs/stabilization-report.md) | Full changelog |
| [docs/plans/2026-02-17-16-week-roadmap.md](docs/plans/2026-02-17-16-week-roadmap.md) | 16-week development roadmap |

---

## Development Status

| Phase | Name | Status |
|-------|------|--------|
| 1 | Core Loop | Complete |
| 2 | Gamification & Polish | Complete |
| 3 | Firebase Auth + Sync | Complete |
| 4 | Adaptive Learning Foundation | Complete |
| 4+ | Gamification + Adaptive + UI Overhaul | Complete (22/22 tasks) |
| QA | Bug Fix Sprint | Complete (10+ issues) |
| **5** | **Adaptive Learning Revamp** | **Complete (18/18 tasks)** |
| 6 | Avatar Evolution & Gamification | Next up |
| 7 | Game Feel & Polish | Planned |
| 8 | Audio Input (Mic) | R&D parallel |
| 9 | Social & Leaderboards | Planned |
| 10 | QA + Launch | Planned |

**Target launch:** June 8, 2026. See [16-week roadmap](docs/plans/2026-02-17-16-week-roadmap.md) for details.

---

## License

Proprietary. All rights reserved.
