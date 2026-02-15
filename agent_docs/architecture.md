# KeySense Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (React Native)                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   Screens   │  │ Components  │  │   Stores    │  │  Services   │   │
│  │  (React)    │  │  (React)    │  │  (Zustand)  │  │ (Firebase,  │   │
│  │             │  │             │  │             │  │  Gemini)    │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │           │
│         └────────────────┴────────┬───────┴────────────────┘           │
│                                   │                                     │
│                          ┌────────▼────────┐                           │
│                          │   Core Logic    │  ← Pure TypeScript        │
│                          │  (exercises,    │    No React imports       │
│                          │   scoring,      │    100% testable          │
│                          │   progression)  │                           │
│                          └────────┬────────┘                           │
│                                   │                                     │
│         ┌─────────────────────────┼─────────────────────────┐          │
│         │                         │                         │          │
│  ┌──────▼──────┐          ┌───────▼───────┐         ┌───────▼───────┐ │
│  │ Audio Engine│          │  MIDI Input   │         │Pitch Detector │ │
│  │  (react-    │          │ (react-native │         │  (Custom C++  │ │
│  │  native-    │          │    -midi)     │         │  TurboModule) │ │
│  │  audio-api) │          │               │         │               │ │
│  └──────┬──────┘          └───────┬───────┘         └───────┬───────┘ │
│         │                         │                         │          │
└─────────┼─────────────────────────┼─────────────────────────┼──────────┘
          │                         │                         │
          ▼                         ▼                         ▼
    ┌───────────┐            ┌───────────┐            ┌───────────┐
    │  Speakers │            │   MIDI    │            │Microphone │
    │           │            │ Keyboard  │            │           │
    └───────────┘            └───────────┘            └───────────┘
```

## Data Flow

### Exercise Playback Flow

```
1. User starts exercise
   └── ExerciseStore.startExercise(exerciseId)
       ├── Load exercise JSON from content/
       ├── Initialize scoring state
       └── Trigger countdown

2. During exercise
   ├── MidiInput receives note events
   │   └── { note: 60, velocity: 80, timestamp: 1234567890 }
   │
   ├── ExerciseValidator.validateNote()
   │   ├── Match to expected note
   │   ├── Calculate timing offset
   │   └── Return NoteScore
   │
   ├── AudioEngine.playNote() [if screen keyboard]
   │
   └── UI updates via Zustand subscription
       ├── Highlight played key
       ├── Show timing indicator
       └── Update score display

3. Exercise complete
   └── ExerciseStore.finishExercise()
       ├── Calculate final score
       ├── Award XP
       ├── Check achievements
       ├── Request AI feedback (if score < threshold)
       └── Persist to local storage + sync to Firebase
```

### Audio Pipeline Details

```
PLAYBACK (Touch → Sound)
========================

Touch Event (0ms)
    │
    ▼ React Native gesture system
JS Event Handler (~2ms)
    │
    ▼ Zustand action dispatch
AudioEngine.playNote(note, velocity) (~1ms)
    │
    ▼ react-native-audio-api (JSI)
Native AudioContext (~1ms)
    │
    ├─▶ Get preloaded AudioBuffer
    ├─▶ Create AudioBufferSourceNode
    ├─▶ Set playbackRate for pitch shifting
    ├─▶ Create GainNode for envelope
    └─▶ Connect nodes and start()
    │
    ▼ Platform audio system
Audio buffer fill + DAC (~10-15ms)
    │
    ▼
Sound Output

TOTAL: 14-19ms ✓


PITCH DETECTION (Microphone → Feedback) - FALLBACK
===================================================

Microphone (continuous input)
    │
    ▼ Native audio capture (Oboe/AVAudioEngine)
Buffer accumulation (~93ms at 4096 samples, 44.1kHz)
    │
    ▼ C++ TurboModule
YIN Pitch Detection Algorithm (~5-10ms)
    │ Output: { frequency: 440.0, confidence: 0.92 }
    │
    ▼ JSI callback to JavaScript
ExerciseValidator.validatePitch() (~1ms)
    │
    ▼ Zustand state update
UI Reanimated update (~16ms)

TOTAL: ~120ms ⚠️ (acceptable for feedback loop)
```

## State Management

### Store Organization

```typescript
// exerciseStore.ts - Current exercise session
interface ExerciseState {
  // Current exercise
  exercise: Exercise | null;
  status: 'idle' | 'countdown' | 'playing' | 'paused' | 'complete';
  
  // Playback state
  currentBeat: number;
  tempo: number;
  isMetronomeEnabled: boolean;
  
  // Scoring
  noteScores: NoteScore[];
  currentScore: number;
  
  // Actions
  startExercise: (id: string) => Promise<void>;
  pauseExercise: () => void;
  resumeExercise: () => void;
  finishExercise: () => ExerciseScore;
  handleNoteEvent: (event: MidiNoteEvent) => void;
}

// progressStore.ts - Persistent user progress
interface ProgressState {
  // Gamification
  xp: number;
  level: number;
  streak: StreakData;
  
  // Progress tracking
  lessonProgress: Record<string, LessonProgress>;
  exerciseHighScores: Record<string, number>;
  
  // Sync status
  lastSyncTimestamp: number;
  pendingChanges: ProgressChange[];
  
  // Actions
  addXp: (amount: number, source: string) => void;
  updateExerciseProgress: (exerciseId: string, score: ExerciseScore) => void;
  syncWithCloud: () => Promise<void>;
}

// settingsStore.ts - User preferences
interface SettingsState {
  // Audio
  keyboardVolume: number;
  metronomeVolume: number;
  
  // Display
  showFingerNumbers: boolean;
  showNoteNames: boolean;
  highContrastMode: boolean;
  
  // Input
  preferredInputMethod: 'midi' | 'microphone' | 'screen';
  midiDeviceId: string | null;
  
  // Actions
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
}
```

## Component Hierarchy

```
App (state hydration: progressStore + settingsStore from MMKV)
├── NavigationContainer
│   ├── RootStack (NativeStack)
│   │   ├── Onboarding (if !hasCompletedOnboarding)
│   │   │   └── OnboardingScreen (4 steps: Welcome, Experience, Equipment, Goal)
│   │   │
│   │   ├── MainTabs (BottomTab)
│   │   │   ├── Home
│   │   │   │   └── HomeScreen
│   │   │   │       ├── Time-aware greeting
│   │   │   │       ├── ContinueLearning (dynamic next exercise)
│   │   │   │       └── QuickActions (Learn, Practice, Songs, Settings)
│   │   │   │
│   │   │   ├── Learn
│   │   │   │   └── LevelMapScreen (Duolingo-style vertical map)
│   │   │   │       ├── LessonNode[] (completed/current/locked)
│   │   │   │       └── SVG PathConnectors
│   │   │   │
│   │   │   ├── Play
│   │   │   │   └── PlayScreen (free play keyboard)
│   │   │   │
│   │   │   └── Profile
│   │   │       └── ProfileScreen
│   │   │           ├── StatsGrid (XP, level, streak, exercises)
│   │   │           ├── Daily goal picker
│   │   │           ├── Volume control
│   │   │           └── SettingsList
│   │   │
│   │   ├── Exercise (fade animation, landscape lock)
│   │   │   └── ExercisePlayer
│   │   │       ├── TopBar (ScoreDisplay + HintDisplay + ExerciseControls)
│   │   │       ├── PianoRoll (transform-based scroll, dynamic MIDI range)
│   │   │       ├── FeedbackOverlay (PERFECT/GOOD/EARLY/LATE/MISS + combo)
│   │   │       ├── Keyboard (dynamic range, auto-scroll to focus note)
│   │   │       ├── CountInAnimation
│   │   │       ├── ExerciseCard (quick mid-lesson transition, auto-dismiss)
│   │   │       ├── CompletionModal (full score + AI coaching + Keysie)
│   │   │       ├── LessonCompleteScreen (full celebration)
│   │   │       └── AchievementToast (XP, level-up)
│   │   │
│   │   └── MidiSetup (modal)
│   │       └── MidiSetupScreen (5-step wizard)
```

## Error Handling Strategy

```typescript
// Errors are categorized by recoverability
enum ErrorSeverity {
  // User can retry, no data loss
  TRANSIENT = 'transient',
  
  // Requires user action (e.g., reconnect MIDI)
  RECOVERABLE = 'recoverable',
  
  // Feature degradation but app continues
  DEGRADED = 'degraded',
  
  // App cannot continue
  FATAL = 'fatal',
}

// Example error handling
try {
  await midiInput.connect(deviceId);
} catch (error) {
  if (error.code === 'DEVICE_DISCONNECTED') {
    // RECOVERABLE: Show reconnection UI
    showMidiReconnectModal();
  } else if (error.code === 'PERMISSION_DENIED') {
    // DEGRADED: Fall back to screen keyboard
    settingsStore.setInputMethod('screen');
    showToast('Using screen keyboard - MIDI permission denied');
  } else {
    // TRANSIENT: Log and retry
    analytics.logError(error);
    throw error;
  }
}
```

## Performance Optimization Patterns

### 1. Pre-allocation for Audio

```typescript
// ✅ Allocate once, reuse
class AudioBufferPool {
  private readonly pool: Float32Array[];
  private readonly size = 4096;
  
  constructor(count: number = 8) {
    this.pool = Array.from(
      { length: count },
      () => new Float32Array(this.size)
    );
  }
  
  acquire(): Float32Array {
    return this.pool.pop() ?? new Float32Array(this.size);
  }
  
  release(buffer: Float32Array): void {
    if (buffer.length === this.size && this.pool.length < 8) {
      this.pool.push(buffer);
    }
  }
}
```

### 2. Memoization for Expensive Calculations

```typescript
// ✅ Memoize music theory calculations
const noteNameCache = new Map<number, string>();

export function midiToNoteName(midiNote: number): string {
  if (noteNameCache.has(midiNote)) {
    return noteNameCache.get(midiNote)!;
  }
  
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const name = `${noteNames[midiNote % 12]}${octave}`;
  
  noteNameCache.set(midiNote, name);
  return name;
}
```

### 3. Selective Re-rendering

```typescript
// ✅ Use Zustand selectors to prevent unnecessary renders
function KeyboardKey({ note }: { note: number }) {
  // Only re-render when THIS key's active state changes
  const isActive = useExerciseStore(
    useCallback(state => state.activeNotes.has(note), [note])
  );
  
  return <PressableKey note={note} isActive={isActive} />;
}
```

## Security Considerations

1. **API Keys:** Never in code, always in environment variables
2. **Audio Data:** Processed on-device, never transmitted
3. **User Progress:** Encrypted in transit (TLS), at rest (Firebase)
4. **AI Prompts:** No PII included in Gemini requests
5. **MIDI Data:** Local only, not logged or transmitted
