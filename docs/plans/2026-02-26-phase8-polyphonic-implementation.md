# Phase 8 Completion: Polyphonic Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ML-based polyphonic pitch detection (Spotify Basic Pitch via ONNX Runtime) so the microphone input can detect chords, complete ambient noise calibration, and polish remaining Phase 8 items.

**Architecture:** AudioCapture streams buffers → PolyphonicDetector resamples to 22.05kHz and runs ONNX inference → MultiNoteTracker applies per-note hysteresis → MicrophoneInput routes events as standard MidiNoteEvent[]. YIN stays as monophonic fallback. Same interface for scoring/UI.

**Tech Stack:** onnxruntime-react-native, Spotify Basic Pitch ONNX model, TypeScript, Jest

---

## Task 1: Install ONNX Runtime and Download Model

**Files:**
- Modify: `package.json` (add dependency)
- Create: `assets/models/README.md` (model documentation)
- Create: `assets/models/basic-pitch.onnx` (download from Spotify)

**Step 1: Install onnxruntime-react-native**

Run:
```bash
npm install onnxruntime-react-native
```
Expected: Package added to package.json dependencies

**Step 2: Download Basic Pitch ONNX model**

Run:
```bash
mkdir -p assets/models
# Download from Spotify's basic-pitch releases (ONNX format)
python3 -c "
from basic_pitch import ICASSP_2022_MODEL_PATH
import shutil
shutil.copy(ICASSP_2022_MODEL_PATH, 'assets/models/basic-pitch.onnx')
print('Model copied successfully')
"
```

If Python basic-pitch not available, download the ONNX model from:
https://github.com/spotify/basic-pitch/tree/main/basic_pitch/saved_models/icassp_2022/nmp

Alternative: Convert TFLite model to ONNX:
```bash
pip install basic-pitch
python3 -c "
import basic_pitch
import os
model_dir = os.path.dirname(basic_pitch.__file__)
print(f'Model directory: {model_dir}/saved_models/')
# Copy the onnx model
"
```

**Step 3: Add model to metro bundler config (if needed)**

Check if `metro.config.js` needs `.onnx` added to asset extensions.

**Step 4: Document the model**

Create `assets/models/README.md`:
```markdown
# ML Models

## basic-pitch.onnx
- **Source:** Spotify Basic Pitch (ICASSP 2022)
- **License:** Apache 2.0
- **Size:** ~5MB
- **Input:** 22050Hz mono audio, ~2s windows
- **Output:** note frames, onset frames, contour frames
- **Paper:** https://arxiv.org/abs/2210.01524
```

**Step 5: Commit**

```bash
git add package.json package-lock.json assets/models/
git commit -m "feat(phase8): add onnxruntime-react-native and Basic Pitch model"
```

---

## Task 2: PolyphonicDetector — Core ONNX Wrapper

**Files:**
- Create: `src/input/PolyphonicDetector.ts`
- Test: `src/input/__tests__/PolyphonicDetector.test.ts`

**Step 1: Write the failing test**

Create `src/input/__tests__/PolyphonicDetector.test.ts`:
```typescript
import { PolyphonicDetector, PolyphonicFrame } from '../PolyphonicDetector';

// Mock onnxruntime-react-native
const mockRun = jest.fn();
jest.mock('onnxruntime-react-native', () => ({
  InferenceSession: {
    create: jest.fn().mockResolvedValue({
      run: mockRun,
      release: jest.fn(),
    }),
  },
  Tensor: jest.fn().mockImplementation((type: string, data: Float32Array, dims: number[]) => ({
    type,
    data,
    dims,
  })),
}));

function generateSineWave(frequency: number, sampleRate: number, numSamples: number, amplitude = 0.8): Float32Array {
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / sampleRate);
  }
  return buffer;
}

function generateChord(frequencies: number[], sampleRate: number, numSamples: number, amplitude = 0.5): Float32Array {
  const buffer = new Float32Array(numSamples);
  for (const freq of frequencies) {
    for (let i = 0; i < numSamples; i++) {
      buffer[i] += (amplitude / frequencies.length) * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
  }
  return buffer;
}

describe('PolyphonicDetector', () => {
  let detector: PolyphonicDetector;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock ONNX model output: 88 note bins × N frames
    // Simulate C4 (MIDI 60) detected with high confidence
    mockRun.mockResolvedValue({
      note: { data: new Float32Array(88).fill(0), dims: [1, 1, 88] },
      onset: { data: new Float32Array(88).fill(0), dims: [1, 1, 88] },
      contour: { data: new Float32Array(360).fill(0), dims: [1, 1, 360] },
    });
  });

  it('should initialize and load the ONNX model', async () => {
    detector = new PolyphonicDetector();
    await detector.initialize();
    expect(detector.isReady()).toBe(true);
  });

  it('should return empty frames for silence', async () => {
    detector = new PolyphonicDetector();
    await detector.initialize();
    const silence = new Float32Array(2048).fill(0);
    const frames = await detector.detect(silence);
    expect(frames).toEqual([]);
  });

  it('should detect a single note from model output', async () => {
    // Mock: C4 (note index 60-21=39 in 88-key range) active
    const noteData = new Float32Array(88).fill(0);
    noteData[39] = 0.9; // C4 = MIDI 60, index = 60 - 21 = 39
    const onsetData = new Float32Array(88).fill(0);
    onsetData[39] = 0.8;
    mockRun.mockResolvedValue({
      note: { data: noteData, dims: [1, 1, 88] },
      onset: { data: onsetData, dims: [1, 1, 88] },
      contour: { data: new Float32Array(360).fill(0), dims: [1, 1, 360] },
    });

    detector = new PolyphonicDetector();
    await detector.initialize();
    const buffer = generateSineWave(261.63, 44100, 2048);
    const frames = await detector.detect(buffer);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames[0].notes).toContainEqual(expect.objectContaining({ midiNote: 60 }));
  });

  it('should detect a chord (C-E-G) from model output', async () => {
    // Mock: C4, E4, G4 all active
    const noteData = new Float32Array(88).fill(0);
    noteData[39] = 0.85; // C4 (60-21)
    noteData[43] = 0.80; // E4 (64-21)
    noteData[46] = 0.82; // G4 (67-21)
    const onsetData = new Float32Array(88).fill(0);
    onsetData[39] = 0.8;
    onsetData[43] = 0.75;
    onsetData[46] = 0.77;
    mockRun.mockResolvedValue({
      note: { data: noteData, dims: [1, 1, 88] },
      onset: { data: onsetData, dims: [1, 1, 88] },
      contour: { data: new Float32Array(360).fill(0), dims: [1, 1, 360] },
    });

    detector = new PolyphonicDetector();
    await detector.initialize();
    const buffer = generateChord([261.63, 329.63, 392.0], 44100, 2048);
    const frames = await detector.detect(buffer);
    expect(frames.length).toBeGreaterThan(0);
    const detectedNotes = frames[0].notes.map(n => n.midiNote);
    expect(detectedNotes).toContain(60);
    expect(detectedNotes).toContain(64);
    expect(detectedNotes).toContain(67);
  });

  it('should resample from 44100 to 22050 Hz', async () => {
    detector = new PolyphonicDetector();
    await detector.initialize();
    const buffer = generateSineWave(440, 44100, 4096);
    await detector.detect(buffer);
    // Verify ONNX was called with resampled data
    const tensorCall = mockRun.mock.calls[0];
    expect(tensorCall).toBeDefined();
  });

  it('should return isReady false before initialization', () => {
    detector = new PolyphonicDetector();
    expect(detector.isReady()).toBe(false);
  });

  it('should handle model loading failure gracefully', async () => {
    const { InferenceSession } = require('onnxruntime-react-native');
    InferenceSession.create.mockRejectedValueOnce(new Error('Model load failed'));
    detector = new PolyphonicDetector();
    await expect(detector.initialize()).rejects.toThrow('Model load failed');
    expect(detector.isReady()).toBe(false);
  });

  it('should dispose and release model resources', async () => {
    detector = new PolyphonicDetector();
    await detector.initialize();
    detector.dispose();
    expect(detector.isReady()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/input/__tests__/PolyphonicDetector.test.ts --no-coverage`
Expected: FAIL — PolyphonicDetector module not found

**Step 3: Write implementation**

Create `src/input/PolyphonicDetector.ts`:
```typescript
/**
 * Polyphonic pitch detection using Spotify Basic Pitch ONNX model.
 * Detects multiple simultaneous notes (chords) from audio input.
 *
 * Pipeline: AudioBuffer → resample to 22050Hz → ONNX inference → note extraction
 */

import { InferenceSession, Tensor } from 'onnxruntime-react-native';

// Basic Pitch model constants
const MODEL_SAMPLE_RATE = 22050;
const MODEL_NOTE_BINS = 88; // Piano range: A0 (21) to C8 (108)
const MIDI_OFFSET = 21;     // Lowest note in model output = MIDI 21 (A0)
const NOTE_THRESHOLD = 0.5; // Minimum activation to consider a note present
const ONSET_THRESHOLD = 0.5; // Minimum onset activation

export interface DetectedNote {
  midiNote: number;
  confidence: number;
  isOnset: boolean;
}

export interface PolyphonicFrame {
  notes: DetectedNote[];
  timestamp: number;
}

export interface PolyphonicDetectorConfig {
  modelPath?: string;
  inputSampleRate?: number;
  noteThreshold?: number;
  onsetThreshold?: number;
  maxPolyphony?: number;
}

export class PolyphonicDetector {
  private session: InferenceSession | null = null;
  private ready = false;
  private readonly config: Required<PolyphonicDetectorConfig>;
  // Pre-allocated resampling buffer
  private resampleBuffer: Float32Array;

  constructor(config?: Partial<PolyphonicDetectorConfig>) {
    this.config = {
      modelPath: config?.modelPath ?? 'basic-pitch.onnx',
      inputSampleRate: config?.inputSampleRate ?? 44100,
      noteThreshold: config?.noteThreshold ?? NOTE_THRESHOLD,
      onsetThreshold: config?.onsetThreshold ?? ONSET_THRESHOLD,
      maxPolyphony: config?.maxPolyphony ?? 6,
    };
    // Pre-allocate resample buffer (halved for 44100→22050)
    const maxResampledSize = Math.ceil(4096 * MODEL_SAMPLE_RATE / this.config.inputSampleRate);
    this.resampleBuffer = new Float32Array(maxResampledSize);
  }

  async initialize(): Promise<void> {
    this.session = await InferenceSession.create(this.config.modelPath);
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  async detect(audioBuffer: Float32Array): Promise<PolyphonicFrame[]> {
    if (!this.session || !this.ready) return [];

    // Resample to 22050Hz if needed
    const resampled = this.resample(audioBuffer);
    if (resampled.length === 0) return [];

    // Create input tensor
    const inputTensor = new Tensor('float32', resampled, [1, resampled.length]);

    // Run inference
    const results = await this.session.run({ audio: inputTensor });

    // Extract notes from model output
    return this.extractNotes(results);
  }

  private resample(buffer: Float32Array): Float32Array {
    if (this.config.inputSampleRate === MODEL_SAMPLE_RATE) {
      return buffer;
    }

    const ratio = MODEL_SAMPLE_RATE / this.config.inputSampleRate;
    const outputLength = Math.floor(buffer.length * ratio);

    // Ensure buffer is large enough
    if (this.resampleBuffer.length < outputLength) {
      this.resampleBuffer = new Float32Array(outputLength);
    }

    // Simple linear interpolation resampling (sufficient for 2:1 downsampling)
    for (let i = 0; i < outputLength; i++) {
      const srcIdx = i / ratio;
      const srcIdxFloor = Math.floor(srcIdx);
      const frac = srcIdx - srcIdxFloor;
      const a = buffer[srcIdxFloor] ?? 0;
      const b = buffer[Math.min(srcIdxFloor + 1, buffer.length - 1)] ?? 0;
      this.resampleBuffer[i] = a + frac * (b - a);
    }

    return this.resampleBuffer.subarray(0, outputLength);
  }

  private extractNotes(results: Record<string, any>): PolyphonicFrame[] {
    const noteOutput = results.note?.data as Float32Array | undefined;
    const onsetOutput = results.onset?.data as Float32Array | undefined;

    if (!noteOutput) return [];

    const numFrames = Math.floor(noteOutput.length / MODEL_NOTE_BINS);
    const frames: PolyphonicFrame[] = [];

    for (let f = 0; f < numFrames; f++) {
      const frameOffset = f * MODEL_NOTE_BINS;
      const notes: DetectedNote[] = [];

      for (let n = 0; n < MODEL_NOTE_BINS; n++) {
        const noteActivation = noteOutput[frameOffset + n];
        if (noteActivation >= this.config.noteThreshold) {
          const onsetActivation = onsetOutput
            ? onsetOutput[frameOffset + n]
            : 0;

          notes.push({
            midiNote: n + MIDI_OFFSET,
            confidence: noteActivation,
            isOnset: onsetActivation >= this.config.onsetThreshold,
          });
        }
      }

      // Limit polyphony to maxPolyphony (keep highest confidence)
      if (notes.length > this.config.maxPolyphony) {
        notes.sort((a, b) => b.confidence - a.confidence);
        notes.length = this.config.maxPolyphony;
      }

      if (notes.length > 0) {
        frames.push({ notes, timestamp: Date.now() });
      }
    }

    return frames;
  }

  dispose(): void {
    if (this.session) {
      this.session.release();
      this.session = null;
    }
    this.ready = false;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/input/__tests__/PolyphonicDetector.test.ts --no-coverage`
Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add src/input/PolyphonicDetector.ts src/input/__tests__/PolyphonicDetector.test.ts
git commit -m "feat(phase8): add PolyphonicDetector with ONNX Basic Pitch model"
```

---

## Task 3: MultiNoteTracker — Polyphonic Hysteresis

**Files:**
- Create: `src/input/MultiNoteTracker.ts`
- Test: `src/input/__tests__/MultiNoteTracker.test.ts`

**Step 1: Write the failing test**

Create `src/input/__tests__/MultiNoteTracker.test.ts`:
```typescript
import { MultiNoteTracker, MultiNoteTrackerConfig } from '../MultiNoteTracker';
import type { PolyphonicFrame, DetectedNote } from '../PolyphonicDetector';
import type { NoteEvent } from '../PitchDetector';

describe('MultiNoteTracker', () => {
  let tracker: MultiNoteTracker;
  let events: NoteEvent[];
  const defaultConfig: MultiNoteTrackerConfig = {
    onsetHoldMs: 30,
    releaseHoldMs: 60,
  };

  beforeEach(() => {
    events = [];
    tracker = new MultiNoteTracker(defaultConfig);
    tracker.onNoteEvent((e) => events.push(e));
  });

  function makeFrame(notes: Array<{ midi: number; confidence?: number; onset?: boolean }>, ts?: number): PolyphonicFrame {
    return {
      notes: notes.map(n => ({
        midiNote: n.midi,
        confidence: n.confidence ?? 0.9,
        isOnset: n.onset ?? true,
      })),
      timestamp: ts ?? Date.now(),
    };
  }

  it('should emit noteOn for a new note onset', () => {
    tracker.update(makeFrame([{ midi: 60 }]));
    expect(events).toEqual([
      expect.objectContaining({ type: 'noteOn', midiNote: 60 }),
    ]);
  });

  it('should emit noteOn for all notes in a chord', () => {
    tracker.update(makeFrame([{ midi: 60 }, { midi: 64 }, { midi: 67 }]));
    const noteOns = events.filter(e => e.type === 'noteOn');
    expect(noteOns).toHaveLength(3);
    expect(noteOns.map(e => e.midiNote).sort()).toEqual([60, 64, 67]);
  });

  it('should not re-emit noteOn for sustained notes', () => {
    tracker.update(makeFrame([{ midi: 60, onset: true }]));
    tracker.update(makeFrame([{ midi: 60, onset: false }])); // sustained, no onset
    const noteOns = events.filter(e => e.type === 'noteOn');
    expect(noteOns).toHaveLength(1);
  });

  it('should emit noteOff when a note disappears from frames', () => {
    tracker.update(makeFrame([{ midi: 60 }, { midi: 64 }]));
    // Remove E4, keep C4
    tracker.update(makeFrame([{ midi: 60 }], Date.now() + 100));
    const noteOffs = events.filter(e => e.type === 'noteOff');
    expect(noteOffs).toContainEqual(expect.objectContaining({ midiNote: 64 }));
  });

  it('should emit noteOff for all notes on reset', () => {
    tracker.update(makeFrame([{ midi: 60 }, { midi: 64 }]));
    tracker.reset();
    const noteOffs = events.filter(e => e.type === 'noteOff');
    expect(noteOffs).toHaveLength(2);
  });

  it('should handle note transitions (old note off, new note on)', () => {
    tracker.update(makeFrame([{ midi: 60 }]));
    tracker.update(makeFrame([{ midi: 62 }], Date.now() + 100));
    expect(events).toContainEqual(expect.objectContaining({ type: 'noteOff', midiNote: 60 }));
    expect(events).toContainEqual(expect.objectContaining({ type: 'noteOn', midiNote: 62 }));
  });

  it('should track up to 6 simultaneous notes', () => {
    const notes = [60, 62, 64, 65, 67, 69].map(midi => ({ midi }));
    tracker.update(makeFrame(notes));
    const noteOns = events.filter(e => e.type === 'noteOn');
    expect(noteOns).toHaveLength(6);
  });

  it('should return active notes via getActiveNotes()', () => {
    tracker.update(makeFrame([{ midi: 60 }, { midi: 64 }]));
    expect(tracker.getActiveNotes().sort()).toEqual([60, 64]);
  });

  it('should unsubscribe properly', () => {
    const unsub = tracker.onNoteEvent(() => {});
    unsub();
    // Should not throw
    tracker.update(makeFrame([{ midi: 60 }]));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/input/__tests__/MultiNoteTracker.test.ts --no-coverage`
Expected: FAIL — MultiNoteTracker module not found

**Step 3: Write implementation**

Create `src/input/MultiNoteTracker.ts`:
```typescript
/**
 * Multi-note hysteresis tracker for polyphonic detection.
 * Tracks up to N simultaneous notes, emitting noteOn/noteOff events
 * with the same NoteEvent interface as the monophonic NoteTracker.
 */

import type { PolyphonicFrame } from './PolyphonicDetector';
import type { NoteEvent } from './PitchDetector';

export interface MultiNoteTrackerConfig {
  onsetHoldMs: number;   // Min time before emitting noteOn (default: 30)
  releaseHoldMs: number; // Min silence before emitting noteOff (default: 60)
}

type NoteEventCallback = (event: NoteEvent) => void;

const DEFAULT_CONFIG: MultiNoteTrackerConfig = {
  onsetHoldMs: 30,
  releaseHoldMs: 60,
};

export class MultiNoteTracker {
  private readonly config: MultiNoteTrackerConfig;
  private activeNotes = new Map<number, { startTime: number; lastSeen: number }>();
  private callbacks = new Set<NoteEventCallback>();

  constructor(config?: Partial<MultiNoteTrackerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  onNoteEvent(callback: NoteEventCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  update(frame: PolyphonicFrame): void {
    const now = frame.timestamp;
    const currentMidiNotes = new Set(frame.notes.map(n => n.midiNote));

    // Check for note releases (active notes no longer in frame)
    for (const [midiNote, state] of this.activeNotes) {
      if (!currentMidiNotes.has(midiNote)) {
        const silenceDuration = now - state.lastSeen;
        if (silenceDuration >= this.config.releaseHoldMs) {
          this.emit({ type: 'noteOff', midiNote, confidence: 0, timestamp: now });
          this.activeNotes.delete(midiNote);
        }
      }
    }

    // Check for new note onsets
    for (const note of frame.notes) {
      const existing = this.activeNotes.get(note.midiNote);
      if (existing) {
        // Update lastSeen for sustained notes
        existing.lastSeen = now;
      } else if (note.isOnset) {
        // New note onset
        this.activeNotes.set(note.midiNote, { startTime: now, lastSeen: now });
        this.emit({
          type: 'noteOn',
          midiNote: note.midiNote,
          confidence: note.confidence,
          timestamp: now,
        });
      }
    }
  }

  reset(): void {
    const now = Date.now();
    for (const [midiNote] of this.activeNotes) {
      this.emit({ type: 'noteOff', midiNote, confidence: 0, timestamp: now });
    }
    this.activeNotes.clear();
  }

  getActiveNotes(): number[] {
    return Array.from(this.activeNotes.keys());
  }

  private emit(event: NoteEvent): void {
    for (const cb of this.callbacks) {
      cb(event);
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/input/__tests__/MultiNoteTracker.test.ts --no-coverage`
Expected: All 9 tests PASS

**Step 5: Commit**

```bash
git add src/input/MultiNoteTracker.ts src/input/__tests__/MultiNoteTracker.test.ts
git commit -m "feat(phase8): add MultiNoteTracker for polyphonic hysteresis"
```

---

## Task 4: Integrate Polyphonic Mode into MicrophoneInput

**Files:**
- Modify: `src/input/MicrophoneInput.ts`
- Modify: `src/stores/settingsStore.ts` (add micDetectionMode)
- Test: Existing tests should still pass + add new tests

**Step 1: Add micDetectionMode to settingsStore**

In `src/stores/settingsStore.ts`, add to the default settings:
```typescript
micDetectionMode: 'monophonic' as 'monophonic' | 'polyphonic',
```

Add setter:
```typescript
setMicDetectionMode: (mode: 'monophonic' | 'polyphonic') => {
  set({ micDetectionMode: mode });
  debouncedSave({ ...get(), micDetectionMode: mode });
},
```

**Step 2: Add polyphonic mode to MicrophoneInput**

Modify `src/input/MicrophoneInput.ts`:
- Add `mode` property to MicrophoneInputConfig
- Import PolyphonicDetector and MultiNoteTracker
- In `initialize()`, if mode is 'polyphonic', create PolyphonicDetector + MultiNoteTracker pipeline
- If PolyphonicDetector fails to init, fall back to monophonic YIN
- Same `MidiNoteEvent` output interface regardless of mode

Key changes:
```typescript
// Add to MicrophoneInputConfig:
mode?: 'monophonic' | 'polyphonic';

// In constructor, store mode:
this.mode = config?.mode ?? 'monophonic';

// In initialize(), add polyphonic path:
if (this.mode === 'polyphonic') {
  try {
    this.polyDetector = new PolyphonicDetector();
    await this.polyDetector.initialize();
    this.multiTracker = new MultiNoteTracker();
    // Wire: AudioCapture → PolyphonicDetector → MultiNoteTracker → callbacks
  } catch {
    console.warn('Polyphonic detection unavailable, falling back to monophonic');
    this.mode = 'monophonic';
    // Fall through to existing YIN setup
  }
}
```

**Step 3: Update InputManager to pass mode**

In `src/input/InputManager.ts`, when creating MicrophoneInput, read `micDetectionMode` from settingsStore and pass it.

**Step 4: Run all tests**

Run: `npx jest --no-coverage`
Expected: All tests PASS (2416+)

**Step 5: Commit**

```bash
git add src/input/MicrophoneInput.ts src/input/InputManager.ts src/stores/settingsStore.ts
git commit -m "feat(phase8): integrate polyphonic mode into MicrophoneInput + InputManager"
```

---

## Task 5: Ambient Noise Calibration

**Files:**
- Create: `src/input/AmbientNoiseCalibrator.ts`
- Create: `src/input/__tests__/AmbientNoiseCalibrator.test.ts`
- Modify: `src/screens/MicSetupScreen.tsx` (add calibration step)

**Step 1: Write the failing test**

Create `src/input/__tests__/AmbientNoiseCalibrator.test.ts`:
```typescript
import { AmbientNoiseCalibrator, CalibrationResult } from '../AmbientNoiseCalibrator';

// Mock AudioCapture
jest.mock('../AudioCapture', () => ({
  AudioCapture: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    start: jest.fn(),
    stop: jest.fn(),
    dispose: jest.fn(),
    onAudioBuffer: jest.fn().mockReturnValue(jest.fn()),
  })),
}));

describe('AmbientNoiseCalibrator', () => {
  it('should compute RMS from silence (near-zero)', async () => {
    const calibrator = new AmbientNoiseCalibrator();
    const result = calibrator.computeRMS(new Float32Array(1024).fill(0));
    expect(result).toBeCloseTo(0, 5);
  });

  it('should compute RMS from a constant signal', () => {
    const calibrator = new AmbientNoiseCalibrator();
    const buffer = new Float32Array(1024).fill(0.5);
    const rms = calibrator.computeRMS(buffer);
    expect(rms).toBeCloseTo(0.5, 2);
  });

  it('should recommend appropriate thresholds from quiet environment', () => {
    const calibrator = new AmbientNoiseCalibrator();
    const thresholds = calibrator.computeThresholds(0.01); // Very quiet
    expect(thresholds.yinConfidence).toBeGreaterThanOrEqual(0.5);
    expect(thresholds.yinConfidence).toBeLessThanOrEqual(0.9);
    expect(thresholds.noteThreshold).toBeGreaterThanOrEqual(0.3);
  });

  it('should recommend relaxed thresholds for noisy environment', () => {
    const calibrator = new AmbientNoiseCalibrator();
    const thresholds = calibrator.computeThresholds(0.15); // Moderate noise
    // Noisy = needs higher confidence to avoid false positives
    expect(thresholds.yinConfidence).toBeGreaterThan(0.5);
    expect(thresholds.noteThreshold).toBeGreaterThan(0.3);
  });

  it('should return calibration result with all fields', () => {
    const calibrator = new AmbientNoiseCalibrator();
    const thresholds = calibrator.computeThresholds(0.05);
    expect(thresholds).toHaveProperty('yinConfidence');
    expect(thresholds).toHaveProperty('yinThreshold');
    expect(thresholds).toHaveProperty('noteThreshold');
    expect(thresholds).toHaveProperty('ambientRMS');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/input/__tests__/AmbientNoiseCalibrator.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `src/input/AmbientNoiseCalibrator.ts`:
```typescript
/**
 * Ambient noise calibration for microphone input.
 * Records 2 seconds of ambient audio, measures RMS energy,
 * and auto-tunes detection thresholds accordingly.
 */

export interface CalibrationResult {
  ambientRMS: number;
  yinThreshold: number;
  yinConfidence: number;
  noteThreshold: number;
}

export class AmbientNoiseCalibrator {
  computeRMS(buffer: Float32Array): number {
    if (buffer.length === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    return Math.sqrt(sumSquares / buffer.length);
  }

  computeThresholds(ambientRMS: number): CalibrationResult {
    // Scale thresholds based on ambient noise level
    // Quiet room: RMS ~0.01  → standard thresholds
    // Moderate:    RMS ~0.05  → slightly relaxed
    // Noisy:       RMS ~0.15+ → highly relaxed
    const noiseFactor = Math.min(ambientRMS / 0.1, 1.0); // 0-1 scale

    return {
      ambientRMS,
      yinThreshold: 0.15 + noiseFactor * 0.15,       // 0.15 (quiet) → 0.30 (noisy)
      yinConfidence: 0.5 + noiseFactor * 0.3,         // 0.5 (quiet) → 0.8 (noisy)
      noteThreshold: 0.3 + noiseFactor * 0.3,         // 0.3 (quiet) → 0.6 (noisy)
    };
  }

  /**
   * Run full calibration: record 2s of ambient audio, compute thresholds.
   * Requires AudioCapture to be initialized and started.
   */
  async calibrate(getAudioBuffer: () => Promise<Float32Array[]>): Promise<CalibrationResult> {
    const buffers = await getAudioBuffer();
    if (buffers.length === 0) {
      return this.computeThresholds(0);
    }
    // Compute average RMS across all buffers
    let totalRMS = 0;
    for (const buf of buffers) {
      totalRMS += this.computeRMS(buf);
    }
    const avgRMS = totalRMS / buffers.length;
    return this.computeThresholds(avgRMS);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/input/__tests__/AmbientNoiseCalibrator.test.ts --no-coverage`
Expected: All 5 tests PASS

**Step 5: Wire calibration into MicSetupScreen**

Modify `src/screens/MicSetupScreen.tsx`:
- Add `'calibrating'` to the step states
- After permission granted, show "Calibrating... please stay quiet for 2 seconds"
- Record 2s of ambient audio via AudioCapture
- Compute thresholds via AmbientNoiseCalibrator
- Store calibration result in settingsStore

**Step 6: Commit**

```bash
git add src/input/AmbientNoiseCalibrator.ts src/input/__tests__/AmbientNoiseCalibrator.test.ts src/screens/MicSetupScreen.tsx
git commit -m "feat(phase8): add ambient noise calibration for mic input"
```

---

## Task 6: Settings UI for Detection Mode

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`
- Modify: `src/screens/MicSetupScreen.tsx`

**Step 1: Add detection mode toggle to ProfileScreen**

In the input method settings section of ProfileScreen, add a "Detection Mode" picker below the input method selector:
- Label: "Mic Detection"
- Options: "Single Notes" (monophonic) | "Chords" (polyphonic)
- Only shown when preferredInputMethod is 'mic' or 'auto'

**Step 2: Add detection mode info to MicSetupScreen**

In the MicSetupScreen 'granted' state, add a tip card explaining:
- "Chord Detection: Detects multiple notes at once (uses AI model, ~5MB)"
- "Single Note: Lightweight detection for melodies"

**Step 3: Run all tests**

Run: `npx jest --no-coverage`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/screens/ProfileScreen.tsx src/screens/MicSetupScreen.tsx
git commit -m "feat(phase8): add polyphonic detection mode toggle in settings"
```

---

## Task 7: Update Latency Compensation for Polyphonic

**Files:**
- Modify: `src/input/InputManager.ts`

**Step 1: Add polyphonic latency constant**

```typescript
export const INPUT_LATENCY_COMPENSATION_MS: Record<string, number> = {
  midi: 0,
  touch: 20,
  mic: 100,
  mic_poly: 120, // Polyphonic adds ~20ms for ONNX inference overhead
};
```

**Step 2: Update getLatencyCompensationMs to check detection mode**

Read `micDetectionMode` from settingsStore and return appropriate compensation.

**Step 3: Run all tests**

Run: `npx jest --no-coverage`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/input/InputManager.ts
git commit -m "feat(phase8): adjust latency compensation for polyphonic detection mode"
```

---

## Task 8: Full Test Suite Verification + Mock Updates

**Files:**
- Modify: Any test files that mock settingsStore (if `micDetectionMode` breaks them)
- Run: Full test suite

**Step 1: Run full test suite**

Run: `npx jest --no-coverage`

**Step 2: Fix any broken mocks**

If tests fail due to new `micDetectionMode` in settingsStore, add it to mock defaults:
```typescript
micDetectionMode: 'monophonic',
```

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix(phase8): update test mocks for polyphonic detection settings"
```

---

## Task 9: Update Documentation

**Files:**
- Modify: `CLAUDE.md` (update Phase 8 status)
- Modify: `agent_docs/stabilization-report.md` (add Phase 8 completion section)
- Modify: `agent_docs/audio-pipeline.md` (add polyphonic pipeline docs)

**Step 1: Update CLAUDE.md**

- Phase 8 status: COMPLETE (including polyphonic detection)
- Add PolyphonicDetector, MultiNoteTracker, AmbientNoiseCalibrator to key files table
- Update test count

**Step 2: Update stabilization report**

Add section for Phase 8 completion with polyphonic detection details.

**Step 3: Update audio pipeline docs**

Add polyphonic detection pipeline diagram and latency budget.

**Step 4: Commit**

```bash
git add CLAUDE.md agent_docs/stabilization-report.md agent_docs/audio-pipeline.md
git commit -m "docs: update Phase 8 completion with polyphonic detection"
```

---

## Summary

| Task | Files | Tests | Description |
|------|-------|-------|-------------|
| 1 | package.json, assets/models/ | — | Install ONNX Runtime + download model |
| 2 | PolyphonicDetector.ts | 7 tests | ONNX model wrapper |
| 3 | MultiNoteTracker.ts | 9 tests | Multi-note hysteresis |
| 4 | MicrophoneInput.ts, InputManager.ts, settingsStore.ts | — | Integration |
| 5 | AmbientNoiseCalibrator.ts, MicSetupScreen.tsx | 5 tests | Noise calibration |
| 6 | ProfileScreen.tsx, MicSetupScreen.tsx | — | Settings UI |
| 7 | InputManager.ts | — | Latency compensation |
| 8 | Test mocks | — | Fix any broken tests |
| 9 | Docs | — | Update documentation |

**Total new tests:** ~21
**Total new files:** 4 (PolyphonicDetector, MultiNoteTracker, AmbientNoiseCalibrator, + 3 test files)
**Modified files:** ~8
