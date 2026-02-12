# KeySense - Piano Learning App

> Real-time piano learning with MIDI integration, intelligent scoring, and adaptive coaching.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo_SDK-52-000020)](https://expo.dev/)
[![Tests](https://img.shields.io/badge/Tests-433%20passing-brightgreen)]()

---

## Overview

KeySense is a mobile piano learning app that combines Duolingo-style gamification with real-time performance feedback. It analyzes timing precision and note accuracy to deliver technique-focused coaching — not just "right or wrong" detection.

**Key differentiators:**
- MIDI-first input with <20ms audio latency
- Weighted scoring: accuracy (40%), timing (35%), completeness (15%), precision (10%)
- Offline-first — core learning loop works without network
- On-device audio processing (privacy by default)

---

## Features

### Implemented

- **MIDI Input** — USB and Bluetooth MIDI device support with auto-detection
- **Audio Engine** — Web Audio API compatible, ADSR envelope, pre-loaded sample playback
- **Exercise Player** — Landscape layout with scrolling piano roll, full-width keyboard, real-time scoring
- **Scoring Engine** — Per-note timing analysis with configurable tolerance windows
- **Touch Keyboard** — 2-octave scrollable keyboard with haptic feedback and note highlighting
- **XP & Progression** — Level system, streak tracking, daily goals
- **State Persistence** — Zustand + AsyncStorage, offline-first architecture
- **Navigation** — Bottom tabs (Home, Learn, Play, Profile) + modal screens (Exercise, MIDI Setup)

### Planned

- Exercise content library (30+ exercises across 6 categories)
- Firebase cloud sync and authentication
- Gemini 1.5 Flash AI coaching (post-exercise feedback)
- Onboarding flow with MIDI setup wizard
- Microphone pitch detection fallback

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 52+ (Development Build) |
| Language | TypeScript 5.x (strict mode) |
| Audio | react-native-audio-api (mock for dev, native for production) |
| MIDI | react-native-midi (USB + Bluetooth) |
| State | Zustand v5 with persist middleware |
| Storage | AsyncStorage (dev) / MMKV (production) |
| Backend | Firebase (Auth, Firestore, Cloud Functions) |
| AI | Gemini 1.5 Flash |
| Analytics | PostHog |

---

## Architecture

```
src/
├── core/              # Pure TypeScript business logic (no React imports)
│   ├── exercises/     # Exercise validation, scoring algorithms
│   ├── music/         # Music theory utilities (notes, scales, chords)
│   └── progression/   # XP calculation, level unlocks
├── audio/             # Audio engine abstraction
├── input/             # MIDI device handling, pitch detection
├── stores/            # Zustand state management
├── hooks/             # React hooks (useExercisePlayback, etc.)
├── screens/           # Screen components
│   └── ExercisePlayer/  # Core exercise experience
├── components/        # Reusable UI (Keyboard, PianoRoll, common)
├── navigation/        # React Navigation setup
├── services/          # Firebase, AI coaching, analytics
└── utils/             # Shared utilities
```

**Design principles:**
1. Audio code lives in native modules — no JS buffer processing
2. Business logic is pure TypeScript — testable without React
3. Offline-first — core loop works without network
4. Exercise definitions are JSON — content is data, not code

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npx expo`)
- iOS Simulator or Android Emulator
- (Optional) USB/Bluetooth MIDI keyboard

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/keysense-app.git
cd keysense-app
npm install --legacy-peer-deps
```

### Development

```bash
npm run start          # Start Expo dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
```

### Quality Checks

```bash
npm run typecheck      # TypeScript validation (0 errors)
npm run test           # Jest tests (433 passing)
npm run lint           # ESLint + Prettier
npm run lint:fix       # Auto-fix linting issues
```

---

## Testing

| Layer | Tool | Coverage |
|-------|------|----------|
| Core logic | Jest | 18 suites, 433 tests |
| Components | React Testing Library | Exercise player, score display |
| Integration | Jest + mocks | Full exercise flow |
| E2E | Detox (planned) | Critical user journeys |

```bash
npm run test                    # All tests
npm run test:coverage           # Coverage report
npm run test -- --testPathPattern=ExercisePlayer  # Specific suite
```

---

## Scoring System

The scoring algorithm evaluates four dimensions:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Accuracy | 40% | Correct notes played |
| Timing | 35% | Timing precision (per-note ms offset) |
| Completeness | 15% | Percentage of notes attempted |
| Precision | 10% | Penalty for extra/wrong notes |

Timing windows are configurable per exercise difficulty:

| Difficulty | Perfect | Good | Pass Score |
|------------|---------|------|------------|
| Beginner | 75ms | 200ms | 60% |
| Intermediate | 50ms | 150ms | 70% |
| Advanced | 25ms | 75ms | 80% |

---

## Exercise Format

Exercises are defined as JSON files. See [agent_docs/exercise-format.md](agent_docs/exercise-format.md) for the full schema.

```json
{
  "id": "lesson-01-ex-01",
  "metadata": { "title": "Find Middle C", "difficulty": 1 },
  "settings": { "tempo": 60, "timeSignature": [4, 4], "countIn": 4 },
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
| [PRD.md](PRD.md) | Product requirements and specifications |
| [CLAUDE.md](CLAUDE.md) | Development conventions and project guide |
| [agent_docs/architecture.md](agent_docs/architecture.md) | System design and data flow |
| [agent_docs/audio-pipeline.md](agent_docs/audio-pipeline.md) | Audio latency budgets and patterns |
| [agent_docs/exercise-format.md](agent_docs/exercise-format.md) | Exercise JSON schema |
| [agent_docs/scoring-algorithm.md](agent_docs/scoring-algorithm.md) | Scoring logic details |
| [agent_docs/ai-coaching.md](agent_docs/ai-coaching.md) | Gemini coaching integration |

---

## Roadmap

### Phase 1: Core Loop (Complete)
- [x] MIDI input and audio engine
- [x] Exercise player with real-time scoring
- [x] Touch keyboard with visual feedback
- [x] XP/progression system
- [x] State persistence (offline-first)
- [x] Navigation system
- [x] 433 tests passing, 0 TypeScript errors

### Phase 2: Content & Gamification (In Progress)
- [ ] Exercise loading from content library
- [ ] 30 curated exercises across 6 categories
- [ ] Onboarding flow
- [ ] MIDI setup wizard improvements

### Phase 3: Backend & AI
- [ ] Firebase authentication and cloud sync
- [ ] Gemini AI coaching (post-exercise feedback)
- [ ] Analytics integration (PostHog)

### Phase 4: Polish & Launch
- [ ] Performance optimization and native audio engine
- [ ] App Store submission
- [ ] Beta testing program

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Run `npm run typecheck && npm run test` before committing
4. Open a Pull Request

### Code Style
- TypeScript strict mode, no `any` types
- Functional components only
- Tests required for core logic changes

---

## License

MIT License. See [LICENSE](LICENSE) for details.
