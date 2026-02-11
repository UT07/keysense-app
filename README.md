# 🎹 KeySense - AI-Powered Piano Learning App

> Duolingo-style piano education with real-time MIDI feedback, exercise validation, and adaptive AI coaching.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React_Native-0.76-61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-52.0-000020)](https://expo.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

---

## 🎯 Overview

KeySense is a modern piano learning application that combines:
- **Real-time MIDI input** for hardware keyboard integration
- **Audio engine** with <20ms latency for responsive playback
- **Exercise validation** with intelligent scoring algorithms
- **Touch keyboard** with visual feedback for practice without hardware
- **State persistence** for offline-first user experience

**Status:** Phase 1 Complete ✅ - Core loop integrated and tested

---

##  Features

### ✅ Phase 1 (Complete)

- **MIDI Integration**
  - USB and Bluetooth MIDI device support
  - 3-4ms latency from hardware to software
  - Automatic device detection and connection
  - Fallback to touch keyboard when MIDI unavailable

- **Audio Engine**
  - Web Audio API compatible implementation
  - <20ms touch-to-sound latency
  - ADSR envelope for realistic piano sound
  - Pre-loaded sample management for zero-latency playback

- **Exercise System**
  - JSON-based exercise definitions
  - Real-time note validation
  - Timing-based scoring (perfect/good/ok/miss)
  - Progressive difficulty system
  - Combo counter and visual feedback

- **Touch Keyboard**
  - 2-4 octave range
  - Multi-touch support
  - Visual highlighting for expected notes
  - Haptic feedback on iOS

- **State Management**
  - Zustand for reactive state
  - MMKV for fast persistence
  - Offline-first architecture
  - Automatic progress saving

### 🚧 Phase 2 (Planned)

- Firebase integration for cloud sync
- Gemini AI coaching for personalized feedback
- 30+ beginner exercises across 5 lessons
- Social features (leaderboards, sharing)
- Advanced analytics and progress tracking

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                 User Input                       │
│  MIDI Keyboard │ Touch Keyboard │ Microphone    │
└────────┬────────────────┬────────────────┬──────┘
         │                 │                 │
┌────────▼─────────────────▼─────────────────▼─────┐
│         useExercisePlayback Hook                  │
│  • Coordinates MIDI, audio, validation            │
│  • Manages playback state                         │
│  • Records notes to store                         │
└────────┬──────────────────────────────────────────┘
         │
┌────────▼─────────────────┐    ┌──────────────────┐
│   Exercise Validator      │    │   Audio Engine    │
│  • Note matching          │    │  • Sample playback│
│  • Timing scoring         │    │  • ADSR envelope  │
│  • XP calculation         │    │  • <20ms latency  │
└────────┬─────────────────┘    └──────────────────┘
         │
┌────────▼──────────────────────────────────────────┐
│               ExercisePlayer UI                    │
│  • Piano roll visualization                        │
│  • Real-time feedback                              │
│  • Score display                                   │
│  • Completion modal                                │
└────────────────────────────────────────────────────┘
```

**Key Design Principles:**
1. **Audio code in native modules** - Zero allocations in callbacks
2. **Business logic is pure TypeScript** - No React in `/src/core/`
3. **Offline-first** - Core loop works without network
4. **State persistence** - Progress survives app restarts

For detailed architecture docs, see [ARCHITECTURE.md](ARCHITECTURE.md)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator or Android Emulator (or physical device)
- (Optional) MIDI keyboard for testing

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/keysense-app.git
cd keysense-app

# Install dependencies
npm install --legacy-peer-deps

# Start the development server
npm run start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Quick Demo

```bash
# Start the demo app
npm run start

# The demo will show:
# 1. Welcome screen with "Start Demo Exercise" button
# 2. C Major Scale exercise (5 notes: C-D-E-F-G)
# 3. Touch keyboard for playing notes
# 4. Real-time scoring and feedback
# 5. Completion modal with score
```

---

## 💻 Development

### Project Structure

```
src/
├── core/              # Business logic (pure TypeScript)
│   ├── exercises/     # Validation, scoring
│   ├── music/         # Music theory utilities
│   └── progression/   # XP and level system
├── audio/             # Audio engine
├── input/             # MIDI and touch input
├── stores/            # Zustand state management
├── hooks/             # React hooks
├── screens/           # Screen components
├── components/        # Reusable UI components
└── __tests__/         # Integration tests
```

### Available Scripts

```bash
npm run start          # Start Expo dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator

npm run typecheck      # TypeScript validation
npm run lint           # ESLint + Prettier
npm run lint:fix       # Auto-fix linting issues

npm run test           # Run Jest tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### Development Workflow

1. **Make changes** to source files in `src/`
2. **Run tests** with `npm run test`
3. **Type check** with `npm run typecheck`
4. **Lint** with `npm run lint:fix`
5. **Test on device** with `npm run ios` or `npm run android`
6. **Commit** with descriptive message
7. **Push** to GitHub

---

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test -- src/__tests__/integration

# Coverage report
npm run test:coverage
```

### Test Coverage

- **Core Logic:** 100% coverage for validators and scorers
- **Integration:** Complete exercise flow tested
- **Components:** Critical UI components covered

### Manual Testing Checklist

- [ ] Exercise loads and displays correctly
- [ ] MIDI keyboard triggers notes (requires hardware)
- [ ] Touch keyboard plays audio
- [ ] Real-time feedback shows correct/incorrect
- [ ] Combo counter updates
- [ ] Piano roll scrolls smoothly at 60fps
- [ ] Exercise completes and shows score
- [ ] Progress persists across app restarts

---

## 📚 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design and data flow
- **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Quick reference for developers
- **[INTEGRATION_COMPLETE.md](INTEGRATION_COMPLETE.md)** - Phase 1 completion summary
- **[agent_docs/](agent_docs/)** - Detailed technical documentation
  - `audio-pipeline.md` - Audio latency budgets
  - `exercise-format.md` - Exercise JSON schema
  - `scoring-algorithm.md` - Validation logic
  - `midi-integration.md` - MIDI device handling

---

## 🗺️ Roadmap

### Phase 1: Core Loop ✅ (Complete)
- [x] MIDI input integration
- [x] Audio engine with low latency
- [x] Exercise validation and scoring
- [x] Touch keyboard component
- [x] State management and persistence
- [x] Integration tests

### Phase 2: Content & Backend 🚧 (In Progress)
- [ ] 30 beginner exercises
- [ ] Firebase authentication
- [ ] Firestore progress sync
- [ ] Cloud Functions for XP calculation
- [ ] Gemini AI coaching integration

### Phase 3: Polish & Launch 📅 (Planned)
- [ ] Onboarding flow
- [ ] Settings and customization
- [ ] Achievements and badges
- [ ] Social features
- [ ] App Store submission

### Phase 4: Advanced Features 🔮 (Future)
- [ ] Staff notation display
- [ ] Song library
- [ ] Performance recording
- [ ] Multiplayer challenges
- [ ] Advanced music theory lessons

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** your changes (`git commit -m 'Add AmazingFeature'`)
4. **Push** to the branch (`git push origin feature/AmazingFeature`)
5. **Open** a Pull Request

### Code Style

- Use TypeScript strict mode
- Follow ESLint + Prettier rules (`npm run lint:fix`)
- Add tests for new features
- Update documentation when needed

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Expo** for the amazing React Native framework
- **Web Audio API** for low-latency audio
- **Zustand** for simple state management
- **MMKV** for blazing-fast persistence
- **React Testing Library** for reliable tests

---

## 📧 Contact

Questions or feedback? Open an issue or reach out:

- **GitHub Issues:** [github.com/YOUR_USERNAME/keysense-app/issues](https://github.com/YOUR_USERNAME/keysense-app/issues)
- **Twitter:** [@your_handle](https://twitter.com/your_handle)

---

**Built with ❤️ for piano learners everywhere** 🎹✨
