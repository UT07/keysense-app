# KeySense: AI-Powered Piano Learning App
## Product Requirements Document v2.0 (Updated February 2026)

---

## 1. Executive Summary

### 1.1 Vision Statement

KeySense is a mobile-first piano learning application that combines Duolingo's habit-forming mechanics with professional-grade real-time feedback. Unlike competitors that simply detect "right or wrong notes," KeySense analyzes *how* you play—timing precision, touch dynamics, and technique patterns—delivering actionable coaching that was previously only available from human instructors.

### 1.2 Core Value Proposition

**For beginner-to-intermediate pianists** who struggle with unstructured practice and delayed feedback, **KeySense** provides **instant, technique-focused coaching** through AI-powered performance analysis, **unlike Simply Piano or Yousician** which only validate note accuracy without addressing *how* you play.

### 1.3 Target Users

| Persona | Description | Primary Need | Success Metric |
|---------|-------------|--------------|----------------|
| **Complete Beginner** | Never touched a piano, owns a MIDI keyboard | Structured 10-min daily routine | Complete first song in 2 weeks |
| **Returning Adult** | Played as a child, wants to restart | Quick wins, flexible schedule | Play a recognizable song in 1 week |
| **Self-Taught Intermediate** | Can play some songs, hit a plateau | Technique correction, theory gaps | Master one new technique per month |
| **MIDI Keyboard Owner** | Has hardware, needs software to learn | Leverage existing equipment | Immediate value from purchase |

### 1.4 Key Constraints

| Constraint | Requirement | Rationale |
|------------|-------------|-----------|
| **Timeline** | 12-week MVP | Solo developer with AI assistance |
| **Platform** | iOS + Android (React Native) | Maximum reach, single codebase |
| **Input Method** | MIDI-first, microphone fallback | Reliability over complexity |
| **Latency** | <20ms playback, <150ms feedback | Professional feel |
| **Privacy** | On-device audio processing | Differentiator, GDPR compliance |
| **Offline** | Core learning loop works offline | Subway practice, unreliable wifi |

---

## 2. Product Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        KEYSENSE APP                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   UI Layer  │  │ Game Logic  │  │    Audio Engine         │ │
│  │  (React +   │◄─┤  (Zustand)  │◄─┤  (react-native-audio-   │ │
│  │  Reanimated)│  │             │  │   api + TurboModules)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│         │               │                      │                │
│         ▼               ▼                      ▼                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Exercise Engine (Pure TypeScript)              ││
│  │  • Note validation  • Timing scoring  • Progress tracking   ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Data Layer                               ││
│  │  Local: AsyncStorage     Cloud: Firebase (optional sync)   ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Framework** | Expo SDK 52+ (Development Build) | Native module access + OTA updates |
| **Language** | TypeScript 5.x (strict mode) | Type safety, AI code generation |
| **Audio Playback** | react-native-audio-api | <10ms latency, Web Audio API compatible |
| **MIDI Input** | react-native-midi | USB + Bluetooth MIDI support |
| **Pitch Detection** | Custom C++ TurboModule (YIN) | Fallback for non-MIDI users |
| **UI Animation** | react-native-reanimated 3 | 60fps keyboard animations |
| **Graphics** | @shopify/react-native-skia | Piano roll rendering |
| **State** | Zustand v5 | Simple, performant, TypeScript-first |
| **Local Storage** | AsyncStorage (@react-native-async-storage) | Expo Go compatible; migrate to MMKV for production builds |
| **Backend** | Firebase (Auth, Firestore, Functions) | Rapid development, generous free tier |
| **AI Coaching** | Gemini 1.5 Flash | Cost-effective, fast responses |
| **Analytics** | PostHog | Privacy-friendly, self-hostable |

### 2.3 Platform Abstraction Strategy

```typescript
// All business logic in pure TypeScript (no React imports)
src/
├── core/                    # Platform-agnostic
│   ├── exercises/           # Exercise validation, scoring
│   ├── music/               # Music theory utilities
│   ├── progression/         # XP, levels, unlocks
│   └── analytics/           # Event tracking abstraction
├── audio/                   # Audio abstraction layer
│   ├── AudioEngine.ts       # Interface definition
│   ├── AudioEngine.native.ts # react-native-audio-api impl
│   └── AudioEngine.web.ts   # Web Audio API impl (future)
├── input/                   # Input abstraction
│   ├── MidiInput.ts         # MIDI handling
│   └── MicrophoneInput.ts   # Pitch detection (fallback)
└── ui/                      # React Native components
    ├── components/          # Reusable UI
    ├── screens/             # Screen components
    └── navigation/          # React Navigation setup
```

---

## 3. Core Features (MVP)

### 3.1 Feature Priority Matrix

| Feature | Priority | Effort | Impact | MVP? |
|---------|----------|--------|--------|------|
| Interactive Piano Keyboard | P0 | High | Critical | ✅ |
| MIDI Input Support | P0 | Medium | Critical | ✅ |
| Exercise Player | P0 | High | Critical | ✅ |
| Real-time Scoring | P0 | High | Critical | ✅ |
| Progress System (XP/Levels) | P0 | Medium | High | ✅ |
| 30 Curated Exercises | P0 | Medium | Critical | ✅ |
| Streak Tracking | P1 | Low | High | ✅ |
| AI Coach (post-exercise) | P1 | Medium | High | ✅ |
| Firebase Sync | P1 | Medium | Medium | ✅ |
| Microphone Fallback | P2 | High | Medium | ⚠️ Limited |
| Social/Leaderboards | P3 | Medium | Low | ❌ |
| Web Version | P3 | High | Medium | ❌ |
| Guitar Support | Deferred to v2.0 | Very High | Medium | ❌ |

> **MVP Decision:** Piano-only. Guitar support deferred to v2.0. MIDI input is primary; pitch detection is fallback only.

### 3.2 Interactive Piano Keyboard

#### 3.2.1 Requirements

| Requirement | Specification | Validation |
|-------------|---------------|------------|
| Visual Range | 2 octaves (C3-C5), scrollable to 4 | User can see and interact with all keys |
| Touch Response | <16ms from touch to visual feedback | Measured with high-speed camera |
| Audio Latency | <20ms from touch to sound | Measured with audio analysis |
| Multi-touch | Support 10 simultaneous touches | Test chord playing |
| Velocity | Map touch pressure to volume (iOS) | Soft/loud distinction audible |
| ADSR Envelope | Attack 10ms, Decay 100ms, Sustain 0.7, Release 200ms | Natural piano feel |
| Visual Feedback | Key depression animation, note highlighting | Clear cause-effect |

#### 3.2.2 Sound Generation Strategy

```
Sample Strategy: 5 base samples per octave (C2, C3, C4, C5, C6)
├── Format: 16-bit WAV, 44.1kHz, mono
├── Size: ~500KB per sample × 5 = 2.5MB total
├── Pitch Shifting: playbackRate = 2^((targetMidi - sourceMidi) / 12)
├── Quality: Acceptable for ±3 semitones from source
└── Preloading: All samples decoded at app launch
```

#### 3.2.3 Implementation Notes

```typescript
// Envelope implementation (react-native-audio-api)
function playNote(midiNote: number, velocity: number = 0.8) {
  const now = audioContext.currentTime;
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  
  // Select nearest sample and calculate playback rate
  const { buffer, baseNote } = getNearestSample(midiNote);
  source.buffer = buffer;
  source.playbackRate.value = Math.pow(2, (midiNote - baseNote) / 12);
  
  // ADSR envelope
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(velocity, now + 0.01);  // Attack
  gain.gain.exponentialRampToValueAtTime(velocity * 0.7, now + 0.11); // Decay
  
  source.connect(gain).connect(audioContext.destination);
  source.start(now);
  
  return { source, gain, startTime: now };
}

function releaseNote(noteState: NoteState) {
  const now = audioContext.currentTime;
  noteState.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  noteState.source.stop(now + 0.25);
}
```

### 3.3 MIDI Input System

#### 3.3.1 Requirements

| Requirement | Specification |
|-------------|---------------|
| USB MIDI | Class-compliant devices via OTG (Android) / Camera Kit (iOS) |
| Bluetooth MIDI | BLE MIDI standard |
| Latency | <5ms from physical key to app event |
| Velocity | 0-127 MIDI velocity mapped to audio gain |
| Sustain Pedal | CC64 support for sustain |
| Auto-detection | Prompt when MIDI device connected |

#### 3.3.2 MIDI Event Processing

```typescript
interface MidiNoteEvent {
  type: 'noteOn' | 'noteOff';
  note: number;        // MIDI note number (0-127)
  velocity: number;    // 0-127, 0 = noteOff for running status
  timestamp: number;   // High-resolution timestamp
  channel: number;     // MIDI channel (usually 0)
}

// Event flow
MIDI Device → Native Module → JS Callback → Exercise Validator → UI Update
             │                │              │
             └── <5ms ────────┴── <10ms ─────┴── <16ms ──→ Total <31ms
```

### 3.4 Exercise System

#### 3.4.1 Exercise Definition Schema

```typescript
interface Exercise {
  id: string;
  version: number;
  metadata: {
    title: string;
    description: string;
    difficulty: 1 | 2 | 3 | 4 | 5;
    estimatedMinutes: number;
    skills: string[];           // e.g., ["right-hand", "c-major", "quarter-notes"]
    prerequisites: string[];    // Exercise IDs
  };
  settings: {
    tempo: number;              // BPM
    timeSignature: [number, number]; // e.g., [4, 4]
    keySignature: string;       // e.g., "C", "G", "F"
    countIn: number;            // Beats before start
    metronomeEnabled: boolean;
  };
  notes: NoteEvent[];
  scoring: {
    timingToleranceMs: number;  // ±ms for "perfect"
    timingGracePeriodMs: number; // ±ms for "good"
    passingScore: number;       // 0-100
    starThresholds: [number, number, number]; // 1-star, 2-star, 3-star
  };
  hints: {
    beforeStart: string;
    commonMistakes: { pattern: string; advice: string }[];
    successMessage: string;
  };
}

interface NoteEvent {
  note: number;           // MIDI note number
  startBeat: number;      // Beat position (float for subdivisions)
  durationBeats: number;  // Note length in beats
  hand?: 'left' | 'right';
  finger?: 1 | 2 | 3 | 4 | 5;
}
```

#### 3.4.2 Exercise Categories (MVP: 30 exercises)

| Category | Count | Description |
|----------|-------|-------------|
| **Orientation** | 3 | Find middle C, keyboard geography |
| **Right Hand Basics** | 8 | C position, simple melodies |
| **Left Hand Basics** | 5 | Bass notes, simple patterns |
| **Both Hands** | 6 | Hands together, simple coordination |
| **C Major Scale** | 4 | Scale patterns, finger crossing |
| **Simple Songs** | 4 | Mary Had a Little Lamb, Ode to Joy, etc. |

### 3.5 Scoring System

#### 3.5.1 Per-Note Scoring

```typescript
interface NoteScore {
  expected: NoteEvent;
  played: MidiNoteEvent | null;
  timingOffsetMs: number;    // Negative = early, positive = late
  timingScore: number;       // 0-100
  velocityScore: number;     // 0-100 (optional, for dynamics exercises)
  isCorrectPitch: boolean;
  isExtraNote: boolean;      // Played but not expected
  isMissedNote: boolean;     // Expected but not played
}

// Timing score calculation
function calculateTimingScore(offsetMs: number, tolerance: number, grace: number): number {
  const absOffset = Math.abs(offsetMs);
  if (absOffset <= tolerance) return 100;  // Perfect
  if (absOffset <= grace) {
    // Linear interpolation between perfect and good
    return 100 - ((absOffset - tolerance) / (grace - tolerance)) * 30;
  }
  if (absOffset <= grace * 2) {
    // Exponential decay for "okay" timing
    return 70 * Math.exp(-(absOffset - grace) / grace);
  }
  return 0;  // Missed
}
```

#### 3.5.2 Exercise Scoring

```typescript
interface ExerciseScore {
  overall: number;           // 0-100
  stars: 0 | 1 | 2 | 3;
  breakdown: {
    accuracy: number;        // % correct notes
    timing: number;          // Average timing score
    completeness: number;    // % of notes attempted
    extraNotes: number;      // Penalty for wrong notes
  };
  details: NoteScore[];
  xpEarned: number;
  isNewHighScore: boolean;
  isPassed: boolean;
}

// Weighting
const SCORE_WEIGHTS = {
  accuracy: 0.40,      // Did you play the right notes?
  timing: 0.35,        // Did you play them at the right time?
  completeness: 0.15,  // Did you play all the notes?
  extraNotes: 0.10,    // Penalty for extra notes (inverted)
};
```

### 3.6 Progression System

#### 3.6.1 XP and Levels

```typescript
// XP sources
const XP_REWARDS = {
  exerciseComplete: 10,
  exerciseFirstTime: 25,
  exercisePerfect: 50,     // 3 stars
  dailyGoalMet: 30,
  streakBonus: (days: number) => Math.min(days * 5, 50),
  lessonComplete: 100,
};

// Level curve (exponential)
function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Level 1: 100 XP
// Level 2: 150 XP (250 total)
// Level 3: 225 XP (475 total)
// Level 5: 506 XP (1,268 total)
// Level 10: 3,844 XP (11,685 total)
```

#### 3.6.2 Streak System

```typescript
interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string;  // ISO date
  freezesAvailable: number;
  freezesUsed: number;
  weeklyPractice: boolean[]; // Last 7 days
}

// Streak rules
// - Practice = complete at least 1 exercise
// - Streak breaks at midnight local time
// - 1 free freeze per week (earned, not purchased)
// - Freeze auto-applied if user has one and misses a day
```

### 3.7 AI Coach

#### 3.7.1 Integration Points

| Trigger | Input | Output |
|---------|-------|--------|
| Post-exercise (score < 80%) | Score breakdown, note errors | 2-3 sentences of advice |
| Post-exercise (score ≥ 80%) | Score breakdown | Encouragement + next challenge |
| "Help" button | Current exercise, user history | Contextual hint |
| Weekly summary | Week's practice data | Progress insights |

#### 3.7.2 Prompt Engineering

```typescript
const COACH_SYSTEM_PROMPT = `
You are a friendly, encouraging piano teacher helping a beginner learn keyboard.

RULES:
1. Keep responses under 3 sentences
2. Focus on ONE specific improvement
3. Use simple, non-technical language
4. Always end with encouragement
5. Reference specific notes/measures when possible
6. Never contradict the scoring data provided

PERSONA:
- Warm and patient
- Celebrates small wins
- Focuses on progress, not perfection
`;

interface CoachInput {
  exerciseId: string;
  exerciseTitle: string;
  score: ExerciseScore;
  attemptNumber: number;
  recentScores: number[];  // Last 5 attempts
  userLevel: number;
}

// Example output:
// "Your timing on the second measure is rushing a bit—try counting 
// '1-2-3-4' out loud as you play. You nailed the C-E-G chord though! 
// One more try and I bet you'll crack 85%."
```

---

## 4. User Experience

### 4.1 Onboarding Flow

```
1. Welcome Screen
   └── "Learn piano in 5 minutes a day"
   
2. Experience Level
   └── "Complete beginner" / "I know some basics" / "Returning player"
   
3. Equipment Check
   └── "Do you have a MIDI keyboard?"
        ├── Yes → MIDI setup wizard
        └── No → "You can use the screen keyboard to start"
   
4. Goal Setting
   └── "What's your goal?"
        ├── "Play my favorite songs"
        ├── "Learn proper technique"
        └── "Just explore and have fun"
   
5. First Lesson (immediate value)
   └── Play your first notes (guided, no failure possible)
   
6. Daily Reminder Setup
   └── Notification time preference
```

### 4.2 Main Navigation

```
┌─────────────────────────────────────┐
│           KeySense                  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │     Today's Practice        │   │
│  │  🔥 5 day streak            │   │
│  │  ████████░░ 80% of daily    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │     Continue Learning       │   │
│  │  Lesson 4: C Major Scale    │   │
│  │  ▶ Exercise 2/5             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌───────┐ ┌───────┐ ┌───────┐    │
│  │ Songs │ │Practice│ │ More  │    │
│  └───────┘ └───────┘ └───────┘    │
│                                     │
├─────────────────────────────────────┤
│  🏠 Home  📚 Learn  🎹 Play  👤 Me  │
└─────────────────────────────────────┘
```

### 4.3 Exercise Player UI

```
┌─────────────────────────────────────┐
│  ← Exercise 3 of 5                  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │      Piano Roll / Staff     │   │  ← Scrolling note display
│  │   ───●───●───●───●───      │   │
│  │      ↓   ↓   ↓   ↓         │   │  ← Current position line
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      Visual Keyboard        │   │  ← Highlights expected keys
│  │  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐     │   │
│  │  │ │█│ │█│ │ │█│ │█│ │     │   │
│  │  └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘     │   │
│  └─────────────────────────────┘   │
│                                     │
│    ♩ = 80        ⏸ Pause     🔁    │  ← Tempo, controls
│                                     │
├─────────────────────────────────────┤
│  Tip: Keep your wrist relaxed      │  ← Contextual hint
└─────────────────────────────────────┘
```

---

## 5. Technical Specifications

### 5.1 Performance Requirements

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| App startup | <2s cold, <500ms warm | Performance profiling |
| Touch-to-sound latency | <20ms | Audio analysis tool |
| Touch-to-visual latency | <16ms | High-speed camera |
| MIDI-to-sound latency | <15ms | Oscilloscope |
| Frame rate | 60fps during exercises | React DevTools |
| Memory usage | <150MB active | Xcode/Android Studio |
| Battery drain | <5% per 15min session | Device monitoring |
| Offline bundle size | <50MB | App store metrics |

### 5.2 Audio Pipeline Specifications

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUDIO PIPELINE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PLAYBACK PATH (Touch/MIDI → Sound)                            │
│  ─────────────────────────────────                             │
│  Input Event (0ms)                                              │
│      ↓                                                          │
│  JS Event Handler (2ms)                                         │
│      ↓                                                          │
│  AudioContext.createBufferSource() (1ms)                        │
│      ↓                                                          │
│  GainNode envelope setup (1ms)                                  │
│      ↓                                                          │
│  source.start() (0ms - scheduled)                               │
│      ↓                                                          │
│  Audio buffer fill + DAC (10-15ms)                              │
│      ↓                                                          │
│  Sound output                                                   │
│                                                                 │
│  TOTAL: 14-19ms ✓                                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DETECTION PATH (Microphone → Feedback) - FALLBACK ONLY        │
│  ───────────────────────────────────────────────────            │
│  Microphone input (continuous)                                  │
│      ↓                                                          │
│  Native buffer accumulation (93ms @ 4096 samples)               │
│      ↓                                                          │
│  C++ YIN pitch detection (5-10ms)                               │
│      ↓                                                          │
│  TurboModule callback to JS (2ms)                               │
│      ↓                                                          │
│  Exercise validator (1ms)                                       │
│      ↓                                                          │
│  UI update via Reanimated (16ms)                                │
│                                                                 │
│  TOTAL: ~120ms ⚠️ (acceptable for feedback, not real-time)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Data Models

```typescript
// User Profile (Firestore: users/{uid})
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
  settings: {
    dailyGoalMinutes: number;
    reminderTime: string | null;
    soundEnabled: boolean;
    hapticEnabled: boolean;
    preferredHand: 'right' | 'left' | 'both';
  };
  equipment: {
    hasMidiKeyboard: boolean;
    midiDeviceName: string | null;
  };
  subscription: {
    tier: 'free' | 'pro';
    expiresAt: Timestamp | null;
  };
}

// Progress (Firestore: users/{uid}/progress/{lessonId})
interface LessonProgress {
  lessonId: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  exerciseScores: Record<string, ExerciseProgress>;
  bestScore: number;
  completedAt: Timestamp | null;
  totalAttempts: number;
  totalTimeSpentSeconds: number;
}

interface ExerciseProgress {
  exerciseId: string;
  highScore: number;
  stars: 0 | 1 | 2 | 3;
  attempts: number;
  lastAttemptAt: Timestamp;
  averageScore: number;
}

// Gamification (Firestore: users/{uid})
interface GamificationData {
  xp: number;
  level: number;
  streak: StreakData;
  achievements: string[];  // Achievement IDs
  dailyProgress: {
    date: string;
    exercisesCompleted: number;
    minutesPracticed: number;
    xpEarned: number;
  };
}

// Local-only (AsyncStorage, persisted via Zustand persist middleware)
interface LocalPreferences {
  lastMidiDeviceId: string | null;
  audioBufferSize: number;
  metronomeVolume: number;
  keyboardVolume: number;
  showFingerNumbers: boolean;
  showNoteNames: boolean;
}
```

### 5.4 API Contracts

```typescript
// Firebase Cloud Functions

// POST /generateCoachFeedback
interface CoachFeedbackRequest {
  exerciseId: string;
  score: ExerciseScore;
  userLevel: number;
  attemptNumber: number;
}

interface CoachFeedbackResponse {
  feedback: string;
  suggestedNextAction: 'retry' | 'continue' | 'practice_specific';
  practiceExerciseId?: string;
}

// POST /syncProgress
interface SyncProgressRequest {
  lastSyncTimestamp: number;
  localChanges: ProgressChange[];
}

interface SyncProgressResponse {
  serverChanges: ProgressChange[];
  newSyncTimestamp: number;
  conflicts: ConflictResolution[];
}
```

---

## 6. Development Phases

### Phase 0: Foundation (Weeks 1-2) — COMPLETE

| Task | Deliverable | Status |
|------|-------------|--------|
| Project scaffolding | Expo SDK 52 + TypeScript strict | Done |
| Audio engine integration | Mock AudioEngine (native pending dev build) | Done |
| Latency measurement | Test harness in scripts/ | Done |
| Piano samples | Sample management system | Done |
| Basic keyboard UI | 2-octave scrollable keyboard | Done |

**Gate:** App builds and runs on iOS simulator.

### Phase 1: Core Loop (Weeks 3-5) — COMPLETE

| Task | Deliverable | Status |
|------|-------------|--------|
| MIDI input | MidiInput + MidiDevice classes | Done |
| Exercise player | Landscape layout with piano roll, keyboard, scoring | Done |
| Scoring engine | ExerciseValidator + ScoringEngine (433 tests passing) | Done |
| 10 exercises | Exercise JSON format + default exercise | Done |
| Basic progress | Zustand stores + AsyncStorage persistence | Done |
| Navigation | Bottom tabs + modal stack (Exercise, MidiSetup) | Done |
| Stabilization | 0 TS errors, 433/433 tests, crash fix, layout redesign | Done |

**Gate:** Complete one full exercise with accurate scoring. Passed.

### Phase 2: Gamification (Weeks 6-7)

| Task | Deliverable | Success Criteria |
|------|-------------|------------------|
| XP system | Earn and display XP | Level up celebration |
| Streak tracking | Daily streak with UI | Streak maintained across days |
| 20 more exercises | Content expansion | 3 complete lessons |
| Onboarding flow | First-time user experience | <3 min to first note |
| MIDI setup wizard | Device connection flow | 90% success rate |

**Gate:** Day-3 retention >40% in internal testing

### Phase 3: Polish & AI (Weeks 8-10)

| Task | Deliverable | Success Criteria |
|------|-------------|------------------|
| Firebase integration | Auth + sync | Cross-device progress |
| AI Coach | Post-exercise feedback | Relevant, helpful advice |
| Microphone fallback | Basic pitch detection | Works for single notes |
| UI polish | Animations, transitions | 60fps, delightful feel |
| Sound design | UI sounds, celebrations | Cohesive audio identity |

**Gate:** NPS >40 in beta testing

### Phase 4: Launch Prep (Weeks 11-12)

| Task | Deliverable | Success Criteria |
|------|-------------|------------------|
| Performance optimization | Profiling + fixes | All perf targets met |
| App Store assets | Screenshots, descriptions | Approved by stores |
| Analytics integration | PostHog events | Key funnels tracked |
| Crash reporting | Sentry integration | <1% crash rate |
| Beta testing | 50 external users | Critical bugs fixed |

**Gate:** App Store approval

---

## 7. Success Metrics

### 7.1 North Star Metric

**Weekly Active Learners (WAL):** Users who complete at least 3 exercises in a 7-day period.

### 7.2 Key Performance Indicators

| Metric | Week 1 Target | Month 1 Target | Month 3 Target |
|--------|---------------|----------------|----------------|
| Daily Active Users | 100 | 500 | 2,000 |
| D1 Retention | 40% | 45% | 50% |
| D7 Retention | 20% | 25% | 30% |
| D30 Retention | - | 15% | 20% |
| Exercises/Session | 3 | 4 | 5 |
| Session Length | 5 min | 7 min | 10 min |
| MIDI Connection Rate | 30% | 35% | 40% |

### 7.3 Technical Health Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Crash-free sessions | >99% | <98% |
| ANR rate (Android) | <0.5% | >1% |
| App startup time | <2s | >3s |
| Audio latency p95 | <25ms | >35ms |
| API error rate | <1% | >2% |

---

## 8. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Audio latency varies by device | High | High | Device capability detection, graceful degradation |
| MIDI connection issues | Medium | Medium | Comprehensive troubleshooting guide, fallback to screen |
| Content production bottleneck | Medium | High | JSON-based exercises, AI-assisted generation |
| AI coaching costs | Low | Medium | Aggressive caching, rate limiting, local fallbacks |
| App Store rejection | Low | High | Follow guidelines strictly, prepare appeals |
| Competitor feature parity | Medium | Low | Focus on differentiation (technique feedback) |

---

## 9. Privacy & Safety Architecture

### 9.1 Privacy-by-Default

| Principle | Implementation |
|-----------|---------------|
| **On-device audio** | All audio processing happens locally; no audio data transmitted |
| **Minimal data collection** | Only structured scoring data (note accuracy, timing) sent to AI coach |
| **No PII in AI prompts** | Coach prompts contain exercise ID, score breakdown — never names or emails |
| **Opt-in sync** | Firebase sync is optional; app works fully offline |
| **Local-first storage** | All progress stored locally via AsyncStorage; cloud is backup |

### 9.2 AI Coach Safety Guardrails

```typescript
// AI coaching constraints
const AI_SAFETY = {
  maxOutputTokens: 150,           // Keep responses concise
  temperature: 0.7,               // Balanced creativity/consistency
  forbiddenPhrases: [             // Never include in responses
    'as an AI', 'I am a language model', 'I cannot',
    'metacarpal', 'proprioception'  // Too technical for beginners
  ],
  rateLimit: {
    perHour: 20,
    perDay: 100,
  },
  fallbackEnabled: true,          // Template responses when API unavailable
  cacheTTL: 24 * 60 * 60 * 1000, // Cache for 24h to reduce costs
};
```

### 9.3 Content Generation Pipeline (Future)

For scaling beyond 30 hand-crafted exercises:
1. AI generates exercise JSON from musical concepts
2. Automated validation against exercise schema
3. Difficulty scoring via algorithm (not human judgment)
4. Human review for quality gate before publication

---

## 10. Future Roadmap (Post-MVP)

### v1.1 (Month 2-3)
- Exercise loading from content library (JSON → ExerciseStore)
- Improved microphone detection (pitch detection TurboModule)
- Song library expansion (10 popular songs, public domain)
- Practice reminders with smart timing

### v1.2 (Month 4-5)
- Subscription model (Pro tier)
- Advanced technique analysis
- Social features (share progress)
- Web portability via react-native-audio-api (Web Audio API compatible)

### v2.0 (Month 6+)
- Web version (leveraging audio API portability)
- Teacher dashboard (B2B)
- Guitar support (new instrument module)
- Custom song import (MusicXML/MIDI file parsing)

---

## 11. Appendix

### 11.1 Competitive Analysis Summary

| Feature | KeySense | Simply Piano | Yousician | Flowkey |
|---------|----------|--------------|-----------|---------|
| Real-time feedback | ✅ | ✅ | ✅ | ✅ |
| Technique analysis | ✅ | ❌ | ❌ | ❌ |
| AI coaching | ✅ | ❌ | ❌ | ❌ |
| MIDI support | ✅ | ✅ | ✅ | ✅ |
| Offline mode | ✅ | ❌ | ❌ | ❌ |
| Privacy-first | ✅ | ❌ | ❌ | ❌ |
| Price (annual) | $99 | $150 | $120 | $120 |

### 11.2 Content Guidelines

- All exercises must be original or public domain
- Song arrangements must be simplified for learning
- Avoid songs with complex licensing (Disney, etc.)
- Include diverse musical styles and cultures

### 11.3 Accessibility Requirements

- VoiceOver/TalkBack support for navigation
- High contrast mode option
- Adjustable text sizes
- Colorblind-friendly note coloring

### 11.4 Technology Decision Log

| Decision | Choice | Rationale | Alternatives Considered |
|----------|--------|-----------|------------------------|
| Audio library | react-native-audio-api | Web Audio API compatible, <10ms latency, future web portability | expo-av (too high latency), native modules (not portable) |
| State management | Zustand v5 | Simple API, TypeScript-first, persist middleware | Redux (too much boilerplate), Jotai (less ecosystem) |
| Local storage | AsyncStorage | Expo Go compatible for dev; migrate to MMKV for prod | MMKV (requires dev build), SQLite (overkill for KV) |
| AI model | Gemini 1.5 Flash | Cost-effective ($0.021/call), fast responses | GPT-4o-mini (higher cost), Claude Haiku (less music knowledge) |
| Build system | Expo Development Build | Native module access + OTA updates | bare React Native (harder to maintain) |
| Scoring weights | 40/35/15/10 | MIDI-optimized: accuracy and timing dominate | Equal weights (doesn't reflect piano learning priorities) |
| Pitch detection | Deferred to post-MVP | MIDI provides ground truth; mic adds complexity | Ship with mic (too much scope for 12 weeks) |

### 11.5 Audio Library Comparison

| Library | Latency | Web Audio API | Expo Go | Notes |
|---------|---------|--------------|---------|-------|
| react-native-audio-api | <10ms | Yes | No (dev build) | Best for production |
| expo-av | 50-100ms | No | Yes | Current mock target |
| react-native-sound | 20-50ms | No | No | Deprecated |
| @nicolo-ribaudo/react-native-audio-api | <10ms | Partial | No | Fork, less maintained |
