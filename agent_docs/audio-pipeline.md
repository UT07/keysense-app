# Audio Pipeline Documentation

## Overview

KeySense has two audio paths:
1. **Playback:** Touch/MIDI → Sound (target: <20ms)
2. **Detection:** Microphone → Pitch → Feedback (target: <150ms)

This document details the implementation, optimization strategies, and debugging approaches.

## Latency Budgets

### Playback Path (Critical)

```
┌─────────────────────────────────────────────────────────────┐
│                    PLAYBACK LATENCY BUDGET                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Stage                          Budget    Cumulative        │
│  ─────                          ──────    ──────────        │
│  Touch event → React Native     2ms       2ms               │
│  React event handler            1ms       3ms               │
│  Zustand dispatch               1ms       4ms               │
│  AudioEngine.playNote()         1ms       5ms               │
│  Native bridge (JSI)            1ms       6ms               │
│  AudioContext operations        2ms       8ms               │
│  Buffer fill (platform audio)   8-12ms    16-20ms           │
│                                                             │
│  TOTAL TARGET: <20ms                                        │
│  ACCEPTABLE:   <25ms                                        │
│  DEGRADED:     25-35ms (show latency warning)               │
│  UNUSABLE:     >35ms                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Detection Path — Monophonic (YIN)

```
┌─────────────────────────────────────────────────────────────┐
│              MONOPHONIC DETECTION LATENCY BUDGET             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Stage                          Budget    Cumulative        │
│  ─────                          ──────    ──────────        │
│  Microphone → buffer fill       93ms*     93ms              │
│  C++ YIN algorithm              8ms       101ms             │
│  TurboModule callback           2ms       103ms             │
│  ExerciseValidator              1ms       104ms             │
│  Zustand update                 1ms       105ms             │
│  Reanimated UI update          16ms       121ms             │
│                                                             │
│  * 4096 samples @ 44.1kHz = 93ms                           │
│  Compensation applied: -100ms                               │
│  EFFECTIVE LATENCY: ~21ms                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Detection Path — Polyphonic (ONNX Basic Pitch)

```
┌─────────────────────────────────────────────────────────────┐
│             POLYPHONIC DETECTION LATENCY BUDGET              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Stage                          Budget    Cumulative        │
│  ─────                          ──────    ──────────        │
│  Microphone → buffer fill       46ms*     46ms              │
│  Resample 44.1→22.05kHz         2ms       48ms              │
│  ONNX inference (Basic Pitch)  50ms       98ms              │
│  MultiNoteTracker hysteresis   30ms      128ms              │
│  ExerciseValidator              1ms      129ms              │
│  Zustand + UI update           16ms      145ms              │
│                                                             │
│  * 2048 samples @ 44.1kHz = 46ms                           │
│  Compensation applied: -120ms                               │
│  EFFECTIVE LATENCY: ~25ms                                   │
│  Timing tolerance: 1.5x multiplier for mic input           │
│                                                             │
│  Pipeline: AudioCapture → PolyphonicDetector                │
│            → MultiNoteTracker → MidiNoteEvent               │
│  Fallback: If ONNX fails → YIN monophonic                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Current Audio Implementation

**Active engine:** `ExpoAudioEngine` (expo-av) with round-robin voice pools
**Planned upgrade:** `react-native-audio-api` (Web Audio API, requires RN 0.77+ for codegen)

The ExpoAudioEngine uses pre-loaded `Audio.Sound` objects with `replayAsync()` for atomic stop+play:
- `VOICES_PER_NOTE = 2` — two sound objects per note, cycling via round-robin index
- Pre-loads C3-C5 (25 notes × 2 voices = 50 sound objects) during `initialize()`
- Notes outside pre-loaded range fall back to dynamic `createAndPlaySound()`
- No blocking flags — round-robin ensures a fresh voice is always available

## AudioEngine Interface

### Interface

```typescript
// src/audio/AudioEngine.ts

export interface IAudioEngine {
  // Lifecycle
  initialize(): Promise<void>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  dispose(): void;
  
  // Playback
  playNote(note: number, velocity?: number): NoteHandle;
  releaseNote(handle: NoteHandle): void;
  releaseAllNotes(): void;
  
  // Configuration
  setVolume(volume: number): void;
  getLatency(): number;
  
  // Status
  isReady(): boolean;
  getState(): AudioContextState;
}

export interface NoteHandle {
  note: number;
  startTime: number;
  release: () => void;
}
```

### Native Implementation

```typescript
// src/audio/AudioEngine.native.ts

import { AudioContext, AudioBuffer } from 'react-native-audio-api';

class NativeAudioEngine implements IAudioEngine {
  private context: AudioContext | null = null;
  private samples: Map<number, AudioBuffer> = new Map();
  private activeNotes: Map<number, NoteHandle> = new Map();
  private masterGain: GainNode | null = null;
  
  async initialize(): Promise<void> {
    // Create audio context with low latency hint
    this.context = new AudioContext({
      sampleRate: 44100,
      // Platform will use lowest possible buffer size
    });
    
    // Create master gain for volume control
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    
    // Preload all samples
    await this.preloadSamples();
  }
  
  private async preloadSamples(): Promise<void> {
    const sampleNotes = [36, 48, 60, 72, 84]; // C2, C3, C4, C5, C6
    
    for (const note of sampleNotes) {
      const response = await fetch(`asset://samples/piano-${note}.wav`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
      this.samples.set(note, audioBuffer);
    }
  }
  
  playNote(note: number, velocity: number = 0.8): NoteHandle {
    if (!this.context || !this.masterGain) {
      throw new Error('AudioEngine not initialized');
    }
    
    const now = this.context.currentTime;
    
    // Find nearest sample and calculate pitch shift
    const { buffer, baseNote } = this.getNearestSample(note);
    const playbackRate = Math.pow(2, (note - baseNote) / 12);
    
    // Create source
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    
    // Create envelope
    const envelope = this.context.createGain();
    
    // ADSR
    const attack = 0.01;
    const decay = 0.1;
    const sustain = 0.7;
    const release = 0.2;
    
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.exponentialRampToValueAtTime(velocity, now + attack);
    envelope.gain.exponentialRampToValueAtTime(
      velocity * sustain, 
      now + attack + decay
    );
    
    // Connect and start
    source.connect(envelope);
    envelope.connect(this.masterGain);
    source.start(now);
    
    const handle: NoteHandle = {
      note,
      startTime: now,
      release: () => this.doRelease(source, envelope, now, release),
    };
    
    // Stop any existing note at this pitch
    this.activeNotes.get(note)?.release();
    this.activeNotes.set(note, handle);
    
    return handle;
  }
  
  private doRelease(
    source: AudioBufferSourceNode,
    envelope: GainNode,
    startTime: number,
    releaseDuration: number
  ): void {
    const now = this.context!.currentTime;
    const minDuration = 0.05; // Minimum note duration
    
    // Ensure minimum duration
    const releaseStart = Math.max(now, startTime + minDuration);
    
    envelope.gain.cancelScheduledValues(releaseStart);
    envelope.gain.setValueAtTime(envelope.gain.value, releaseStart);
    envelope.gain.exponentialRampToValueAtTime(0.001, releaseStart + releaseDuration);
    
    source.stop(releaseStart + releaseDuration + 0.01);
  }
  
  private getNearestSample(note: number): { buffer: AudioBuffer; baseNote: number } {
    const sampleNotes = [36, 48, 60, 72, 84];
    
    let nearest = sampleNotes[0];
    let minDistance = Math.abs(note - nearest);
    
    for (const sampleNote of sampleNotes) {
      const distance = Math.abs(note - sampleNote);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = sampleNote;
      }
    }
    
    return {
      buffer: this.samples.get(nearest)!,
      baseNote: nearest,
    };
  }
  
  getLatency(): number {
    // Returns current output latency in seconds
    return this.context?.outputLatency ?? 0;
  }
}

export default new NativeAudioEngine();
```

## MIDI Input

### Event Flow

```
MIDI Device (hardware)
    │
    ▼ USB/BLE protocol
react-native-midi Native Module
    │
    ▼ Native event listener
JSI callback (no serialization overhead)
    │
    ▼
MidiInput.onNoteEvent(event)
    │
    ├──▶ exerciseStore.handleNoteEvent(event)
    │       └──▶ validator.validateNote()
    │
    └──▶ audioEngine.playNote(event.note, event.velocity / 127)
            └──▶ [if using screen keyboard sound]
```

### Implementation

```typescript
// src/input/MidiInput.ts

import { MidiManager, MidiDevice, MidiMessage } from 'react-native-midi';

export interface MidiNoteEvent {
  type: 'noteOn' | 'noteOff';
  note: number;
  velocity: number;
  timestamp: number;
  channel: number;
}

type MidiEventCallback = (event: MidiNoteEvent) => void;

class MidiInputManager {
  private device: MidiDevice | null = null;
  private callbacks: Set<MidiEventCallback> = new Set();
  private isScanning = false;
  
  async startScanning(): Promise<MidiDevice[]> {
    if (this.isScanning) return [];
    
    this.isScanning = true;
    try {
      return await MidiManager.getDevices();
    } finally {
      this.isScanning = false;
    }
  }
  
  async connect(deviceId: string): Promise<void> {
    if (this.device) {
      await this.disconnect();
    }
    
    this.device = await MidiManager.openDevice(deviceId);
    this.device.setMessageListener(this.handleMessage);
  }
  
  async disconnect(): Promise<void> {
    if (this.device) {
      await this.device.close();
      this.device = null;
    }
  }
  
  subscribe(callback: MidiEventCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
  
  private handleMessage = (message: MidiMessage): void => {
    // Parse MIDI message
    const [status, data1, data2] = message.data;
    const channel = status & 0x0F;
    const messageType = status & 0xF0;
    
    let event: MidiNoteEvent | null = null;
    
    switch (messageType) {
      case 0x90: // Note On
        if (data2 > 0) {
          event = {
            type: 'noteOn',
            note: data1,
            velocity: data2,
            timestamp: message.timestamp,
            channel,
          };
        } else {
          // Velocity 0 = Note Off (running status)
          event = {
            type: 'noteOff',
            note: data1,
            velocity: 0,
            timestamp: message.timestamp,
            channel,
          };
        }
        break;
        
      case 0x80: // Note Off
        event = {
          type: 'noteOff',
          note: data1,
          velocity: data2,
          timestamp: message.timestamp,
          channel,
        };
        break;
    }
    
    if (event) {
      for (const callback of this.callbacks) {
        callback(event);
      }
    }
  };
  
  isConnected(): boolean {
    return this.device !== null;
  }
  
  getConnectedDevice(): MidiDevice | null {
    return this.device;
  }
}

export const midiInput = new MidiInputManager();
```

## Pitch Detection (Fallback)

### YIN Algorithm Overview

The YIN algorithm detects fundamental frequency (pitch) from audio:

1. Compute autocorrelation difference function
2. Apply cumulative mean normalization
3. Find first dip below threshold
4. Refine with parabolic interpolation

### C++ TurboModule

```cpp
// modules/pitch-detector/cpp/PitchDetector.cpp

#include <cmath>
#include <vector>

class YINPitchDetector {
private:
    int sampleRate;
    int bufferSize;
    float threshold;
    std::vector<float> yinBuffer;
    
public:
    YINPitchDetector(int sr = 44100, int bs = 4096, float th = 0.15f)
        : sampleRate(sr), bufferSize(bs), threshold(th) {
        yinBuffer.resize(bufferSize / 2);
    }
    
    struct PitchResult {
        float frequency;
        float confidence;
        bool voiced;
    };
    
    PitchResult detect(const float* audioBuffer) {
        // Step 1: Difference function
        for (int tau = 0; tau < bufferSize / 2; tau++) {
            yinBuffer[tau] = 0;
            for (int i = 0; i < bufferSize / 2; i++) {
                float delta = audioBuffer[i] - audioBuffer[i + tau];
                yinBuffer[tau] += delta * delta;
            }
        }
        
        // Step 2: Cumulative mean normalized difference
        yinBuffer[0] = 1;
        float runningSum = 0;
        for (int tau = 1; tau < bufferSize / 2; tau++) {
            runningSum += yinBuffer[tau];
            yinBuffer[tau] *= tau / runningSum;
        }
        
        // Step 3: Find first dip below threshold
        int tauEstimate = -1;
        for (int tau = 2; tau < bufferSize / 2; tau++) {
            if (yinBuffer[tau] < threshold) {
                while (tau + 1 < bufferSize / 2 && 
                       yinBuffer[tau + 1] < yinBuffer[tau]) {
                    tau++;
                }
                tauEstimate = tau;
                break;
            }
        }
        
        if (tauEstimate == -1) {
            return { 0.0f, 0.0f, false };
        }
        
        // Step 4: Parabolic interpolation for better precision
        float betterTau = parabolicInterpolation(tauEstimate);
        float frequency = sampleRate / betterTau;
        float confidence = 1.0f - yinBuffer[tauEstimate];
        
        return { frequency, confidence, true };
    }
    
private:
    float parabolicInterpolation(int tau) {
        if (tau <= 0 || tau >= bufferSize / 2 - 1) {
            return tau;
        }
        
        float s0 = yinBuffer[tau - 1];
        float s1 = yinBuffer[tau];
        float s2 = yinBuffer[tau + 1];
        
        float adjustment = (s2 - s0) / (2 * (2 * s1 - s2 - s0));
        return tau + adjustment;
    }
};
```

## Performance Optimization

### 1. Pre-allocate Buffers

```typescript
// ✅ Allocate once at startup
const BUFFER_SIZE = 4096;
const analysisBuffer = new Float32Array(BUFFER_SIZE);
const fftBuffer = new Float32Array(BUFFER_SIZE);

// ❌ Never allocate in audio callbacks
function badCallback(buffer: Float32Array) {
  const analysis = new Float32Array(buffer.length); // BAD!
}
```

### 2. Use Worklets for UI Updates

```typescript
// Use Reanimated worklets for smooth UI during audio
import { useAnimatedStyle, withSpring } from 'react-native-reanimated';

function KeyboardKey({ note, isActive }: Props) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(isActive ? 4 : 0) }],
    backgroundColor: isActive ? '#4CAF50' : '#FFFFFF',
  }));
  
  return <Animated.View style={animatedStyle} />;
}
```

### 3. Batch State Updates

```typescript
// ✅ Batch multiple updates
exerciseStore.setState(state => ({
  ...state,
  noteScores: [...state.noteScores, newScore],
  currentScore: calculateScore([...state.noteScores, newScore]),
  activeNotes: new Set([...state.activeNotes, event.note]),
}));

// ❌ Don't trigger multiple updates
exerciseStore.addNoteScore(newScore);
exerciseStore.updateScore();
exerciseStore.setActiveNote(event.note);
```

## Debugging Audio Issues

### Latency Measurement

```typescript
// scripts/measure-latency.ts
import { audioEngine } from '@/audio/AudioEngine';

async function measureLatency(): Promise<void> {
  const iterations = 100;
  const latencies: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    
    await new Promise<void>(resolve => {
      const handle = audioEngine.playNote(60);
      // Use AudioContext's own timing
      const scheduledTime = handle.startTime;
      const outputLatency = audioEngine.getLatency();
      
      latencies.push(outputLatency * 1000);
      
      setTimeout(() => {
        handle.release();
        resolve();
      }, 100);
    });
  }
  
  const avg = latencies.reduce((a, b) => a + b) / latencies.length;
  const max = Math.max(...latencies);
  const min = Math.min(...latencies);
  
  console.log(`Latency: avg=${avg.toFixed(1)}ms, min=${min.toFixed(1)}ms, max=${max.toFixed(1)}ms`);
}
```

### Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Glitchy audio | GC during callback | Pre-allocate buffers |
| High latency | Wrong buffer size | Reduce buffer, check device |
| No sound | AudioContext suspended | Call resume() on user gesture |
| Crackling | CPU overload | Reduce polyphony, optimize DSP |
| Pitch drift | Sample rate mismatch | Match device sample rate |
