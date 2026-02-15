# Purrrfect Keys

> Learn piano with real-time feedback, MIDI support, AI coaching, and 8 collectible cat companions.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo_SDK-52-000020)](https://expo.dev/)
[![Tests](https://img.shields.io/badge/Tests-827%20passing-brightgreen)]()

---

## Overview

Purrrfect Keys is a Duolingo-style piano learning app that combines real-time performance analysis with gamification. It scores your playing across four dimensions — accuracy, timing, completeness, and precision — and delivers AI-powered coaching through Salsa, your grey cat mascot with green eyes.

**What makes it different:**
- JSI-based audio with <20ms touch-to-sound latency
- Weighted scoring (not just "right or wrong" detection)
- Offline-first — core learning loop works without network
- AI-generated personalized feedback via Gemini 2.0 Flash

---

## Features

### Core Experience
- 6 structured lessons with 30 exercises (beginner to intermediate)
- Real-time piano roll with scrolling note visualization
- Touch keyboard with haptic feedback and latency compensation
- MIDI keyboard support (USB + Bluetooth)
- Landscape exercise player with dynamic note/keyboard range

### Gamification
- XP system with 20+ levels (exponential `100 * 1.5^(level-1)` curve)
- Daily streaks with freeze protection
- 18 unlockable achievements across 6 categories
- 8 collectible cat characters with backstories and unlock levels
- 68 curated music fun facts between exercises
- AI coach Salsa with 55 mood-based tips (5 moods, score-aware selection)

### AI Coaching
- Gemini 2.0 Flash post-exercise feedback
- 5-tier fallback (ensures coaching always works, even offline)
- Score-aware tip categories: encouragement, technique, practice, music theory

### Infrastructure
- Firebase Authentication (email + anonymous sign-in)
- Cloud sync with offline queue and conflict resolution
- Progress persistence via AsyncStorage with debounced saves
- PostHog analytics integration

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
| Analytics | PostHog |
| Testing | Jest + React Testing Library (827 tests, 30 suites) |

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
npm run test         # Jest tests (827 passing, 30 suites)
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
  audio/             Audio engine (JSI Web Audio + Expo fallback)
  input/             MIDI device handling
  hooks/             React hooks (useExercisePlayback, etc.)
  stores/            Zustand state management
  screens/           Screen components
    ExercisePlayer/  Core exercise experience (landscape)
  components/        Reusable UI
    Keyboard/        Touch piano keyboard
    PianoRoll/       Scrolling note display
    Mascot/          Salsa SVG cat (5 moods, animations)
    FunFact/         Music fun fact cards
  navigation/        React Navigation setup
  services/          Firebase, Gemini AI, PostHog
  content/           Fun facts, tutorials, content loader

content/
  exercises/         JSON exercise definitions (6 lessons, 30 exercises)
  lessons/           Lesson metadata and sequencing
```

**Design principles:**
1. Audio code lives in native modules via JSI — never process audio buffers in JS
2. Business logic is pure TypeScript in `/src/core/` — testable without React
3. Offline-first — core loop works without network
4. Exercise definitions are JSON — content is data, not code
5. Singleton audio engine persists across screen navigations

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

8 unlockable music-themed cats with unique backstories:

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

---

## Development Status

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| 1 | Core Loop | Complete | 100% |
| 2 | Gamification & Polish | Near Complete | ~95% |
| 3 | Firebase Auth + Sync | Complete | 100% |
| 4 | Adaptive Learning (AI) | Designed | 0% |
| 5 | Social & Leagues | Planned | 0% |
| 6 | Music Library (100+ songs) | Planned | 0% |
| 7 | App Store Launch | Planned | 0% |

### Next up: Phase 4 — Adaptive Learning
AI-powered personalized challenges via Gemini. See [docs/plans/2026-02-13-adaptive-learning-design.md](docs/plans/2026-02-13-adaptive-learning-design.md).

---

## License

Proprietary. All rights reserved.
