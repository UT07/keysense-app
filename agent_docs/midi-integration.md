# MIDI Integration Guide

## Current Status

The MIDI pipeline is fully implemented at the JavaScript level but requires a native module for actual hardware input.

### What Works
- `NativeMidiInput` class: handles device discovery, note events, control change, connection/disconnection via `NativeModules.RNMidi`
- `NoOpMidiInput` class: fallback for development without native module
- `useExercisePlayback` hook: subscribes to MIDI events, routes noteOn to scoring, handles noteOff for sound release
- MIDI event filtering: only `noteOn` events are recorded for scoring (noteOff is filtered)
- Timestamp normalization: MIDI timestamps are normalized to `Date.now()` domain for consistent scoring
- Unit tests: full coverage in `src/input/__tests__/MidiInput.test.ts` and `MidiDevice.test.ts`

### What's Pending
- **Native module (`react-native-midi` or `@nicksenger/react-native-midi`)**: requires RN 0.77+ for codegen compatibility
- **Dev Build with native MIDI**: once module is installed, `NativeMidiInput` activates automatically

## MIDI Testing Setup (macOS)

### Prerequisites
- VMPK (Virtual MIDI Piano Keyboard): already installed via Homebrew (`brew install --cask vmpk`)
- macOS IAC Driver: built-in virtual MIDI bus

### Step 1: Enable IAC Driver
1. Open **Audio MIDI Setup** (Spotlight → "Audio MIDI Setup")
2. From the menu: **Window → Show MIDI Studio**
3. Double-click **IAC Driver**
4. Check **"Device is online"**
5. Ensure at least one port exists (default: "Bus 1")
6. Click **Apply**

### Step 2: Configure VMPK
1. Open VMPK (`/opt/homebrew/Caskroom/vmpk/0.9.1/vmpk.app`)
2. Go to **Edit → MIDI Connections**
3. Set **MIDI Out Driver** to **CoreMIDI**
4. Set **Output MIDI Port** to **IAC Driver Bus 1**
5. Click **OK**

### Step 3: Verify MIDI Flow
With IAC Driver and VMPK configured:
1. Open **MIDI Monitor** (free from App Store) or use terminal: `ioreg -l | grep MIDI`
2. Play notes on VMPK — MIDI Monitor should show note events
3. Once native module is installed in the Dev Build, these events will flow to the app

## Testing Without Hardware

### Unit Tests
```bash
npx jest src/input/__tests__/ --verbose
```

### Simulated MIDI Events
The `NoOpMidiInput` class exposes test methods:
```typescript
const midiInput = getMidiInput() as NoOpMidiInput;

// Simulate note on
midiInput._simulateNoteEvent({
  type: 'noteOn',
  note: 60,
  velocity: 100,
  timestamp: Date.now(),
  channel: 0,
});

// Simulate device connection
midiInput._simulateDeviceConnection({
  id: 'test-device-1',
  name: 'Test Keyboard',
  type: 'usb',
  connected: true,
}, true);
```

### Integration Testing
The `src/__tests__/integration/ExerciseFlow.test.tsx` test suite exercises the full MIDI → scoring pipeline using simulated events.

## Architecture

```
Physical MIDI Keyboard / VMPK
    ↓
IAC Driver (macOS virtual MIDI bus)
    ↓
react-native-midi (NativeModule — NOT YET INSTALLED)
    ↓
NativeEventEmitter → 'midiNote' event
    ↓
NativeMidiInput._setupNativeListeners()
    ↓
MidiNoteCallback → useExercisePlayback
    ↓
├── noteOn → normalize timestamp → playedNotesRef → scoring
└── noteOff → audioEngine.releaseNote()
```

## Key Files

| File | Purpose |
|------|---------|
| `src/input/MidiInput.ts` | MIDI abstraction (NativeMidiInput + NoOpMidiInput) |
| `src/hooks/useExercisePlayback.ts` | MIDI event subscription and scoring integration |
| `src/input/__tests__/MidiInput.test.ts` | Unit tests for MIDI input |
| `src/input/__tests__/MidiDevice.test.ts` | Unit tests for device management |
| `src/screens/MidiSetup/` | MIDI setup wizard UI |

## Phase 3 Integration Plan

When RN 0.77+ is available:
1. Install `react-native-midi` (or equivalent CoreMIDI bridge)
2. Rebuild Dev Build with native module
3. Enable IAC Driver on macOS
4. Test with VMPK → IAC → Dev Build on simulator
5. Test with physical MIDI keyboard → Dev Build on device
6. Measure latency (target: <5ms MIDI → JS event)
