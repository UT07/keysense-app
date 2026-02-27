# Phase 8 Completion: Polyphonic Detection + Polish

**Date:** 2026-02-26
**Status:** Approved
**Scope:** Complete Phase 8 (Audio Input) with full polyphonic ML detection, noise calibration, and accuracy testing.

## 1. Polyphonic Detection via ONNX Runtime + Basic Pitch

### Architecture

```
AudioCapture (existing)
    ↓ Float32Array buffers (2048 samples @ 44.1kHz)
PolyphonicDetector (NEW)
    ├── Loads Basic Pitch ONNX model on init
    ├── Resamples 44.1kHz → 22.05kHz (model requirement)
    ├── Accumulates frames into model window
    ├── Runs ONNX inference → note/onset/contour frames
    └── Post-processes: frameToNotes() → PolyphonicFrame[]
    ↓
MultiNoteTracker (NEW)
    ├── Tracks up to 6 simultaneous notes
    ├── Per-note onset/release hysteresis
    ├── Onset hold: 30ms, Release hold: 60ms
    └── Emits MidiNoteEvent[] (same interface)
    ↓
MicrophoneInput (MODIFIED)
    ├── mode: 'monophonic' | 'polyphonic'
    ├── polyphonic: uses PolyphonicDetector + MultiNoteTracker
    ├── monophonic: uses YINPitchDetector + NoteTracker (existing)
    ├── Falls back to monophonic if ONNX fails to load
    └── Same MidiNoteEvent output
    ↓
InputManager → useExercisePlayback → scoring (unchanged)
```

### New Files

| File | Purpose |
|------|---------|
| `src/input/PolyphonicDetector.ts` | ONNX model wrapper — load, resample, infer, post-process |
| `src/input/MultiNoteTracker.ts` | Multi-note hysteresis (onset/release per active note) |
| `src/input/__tests__/PolyphonicDetector.test.ts` | Unit tests with synthetic chord signals |
| `src/input/__tests__/MultiNoteTracker.test.ts` | Hysteresis tests for simultaneous notes |
| `assets/models/basic-pitch.onnx` | Spotify Basic Pitch model (~5MB) |

### Modified Files

| File | Change |
|------|--------|
| `src/input/MicrophoneInput.ts` | Add polyphonic mode, constructor option, fallback logic |
| `src/input/InputManager.ts` | Pass polyphonic preference from settings |
| `src/stores/settingsStore.ts` | Add `micDetectionMode: 'monophonic' \| 'polyphonic'` |
| `src/screens/ProfileScreen.tsx` | Mic detection mode toggle in settings |
| `package.json` | Add `onnxruntime-react-native` dependency |

### Dependencies

```
onnxruntime-react-native: ^1.17  (ONNX inference engine)
```

### Latency Budget

| Stage | Monophonic (YIN) | Polyphonic (ONNX) |
|-------|-----------------|-------------------|
| Buffer fill (2048 @ 44.1kHz) | 46ms | 46ms |
| Resample to 22.05kHz | — | 2ms |
| Detection/Inference | 8ms | 50ms |
| Tracker hysteresis | 40ms onset | 30ms onset |
| Total pipeline | ~94ms | ~128ms |
| Compensation applied | -100ms | -120ms |
| **Effective latency** | **~0ms** | **~8ms** |
| Timing tolerance multiplier | 1.5x | 1.5x |

### Model Details

- **Model:** Spotify Basic Pitch (ONNX format)
- **Input:** 22050Hz mono audio, ~2s windows with overlap
- **Output:** 3 tensors — note frames, onset frames, contour frames
- **Post-processing:** Threshold note activations → note events with onset/offset
- **Cold start:** ~1-2s model loading (cached after first load)

### Fallback Strategy

```
1. Try loading ONNX model
2. If success → polyphonic mode active
3. If failure (missing model, OOM, unsupported device) → fall back to YIN monophonic
4. User can manually switch in settings
```

## 2. Ambient Noise Calibration

### AmbientNoiseCalibrator

New utility that records 2 seconds of silence to measure ambient noise floor, then auto-tunes detection thresholds.

| File | Purpose |
|------|---------|
| `src/input/AmbientNoiseCalibrator.ts` | Record silence → compute RMS → set thresholds |
| `src/screens/MicSetupScreen.tsx` | Add calibration step after permission grant |

### Calibration Flow

```
1. User grants mic permission
2. "Please stay quiet for 2 seconds..." prompt
3. Record 2s of ambient audio
4. Compute RMS energy of ambient noise
5. Set YIN confidence threshold = max(0.5, noiseRMS * 3)
6. Set Basic Pitch note threshold = max(0.3, noiseRMS * 2)
7. Store in settingsStore for persistence
```

## 3. Accuracy Test Harness

| File | Purpose |
|------|---------|
| `scripts/mic-accuracy-test.ts` | Synthetic signal → detector → compare expected vs detected |

Tests synthetic sine waves (single notes + chords) through both YIN and BasicPitch detectors, measuring:
- Note accuracy (correct MIDI note %)
- Onset timing accuracy (ms offset)
- False positive rate
- Chord detection accuracy (% of notes in chord correctly identified)

## 4. Parallel Tracks (Separate from Phase 8)

### 4a. 3D Cat Avatars with Three.js + Blender

**Decision:** Replace SVG composable system with real-time 3D rendering.

- Model 12 cats in Blender with bone rigs
- Export as glTF/GLB format
- Render in-app via `react-three-fiber` + `expo-three`
- Animate with skeletal animations (idle/celebrate/teach/sleep/play/curious/sad)
- **This is a separate project phase** — will need its own design doc

### 4b. Sound Design

- ~20-30 UI sounds (button taps, achievement unlock, evolution, gem collect)
- Cat audio (meow variants per personality)
- Background ambient (practice room atmosphere)
- **Also separate** — can start asset creation in parallel

## 5. Success Criteria

- [ ] ONNX model loads successfully on iOS simulator
- [ ] Polyphonic detection identifies C major triad (C-E-G) with >80% accuracy
- [ ] Single-note detection maintains >95% accuracy (regression check)
- [ ] Fallback to YIN works when ONNX is unavailable
- [ ] Ambient calibration reduces false positives in noisy environments
- [ ] All existing tests pass (2,416+ tests, 0 failures)
- [ ] New tests for PolyphonicDetector and MultiNoteTracker (target: 20+ tests)
