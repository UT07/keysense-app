/**
 * InputManager unit tests
 *
 * Tests: auto-detection priority, manual method selection,
 * note event forwarding, lifecycle management, timing constants.
 */

import {
  InputManager,
  INPUT_TIMING_MULTIPLIERS,
  INPUT_LATENCY_COMPENSATION_MS,
} from '../InputManager';
import type { MidiNoteEvent } from '../../core/exercises/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Track mock MIDI state
let mockMidiIsReady = false;
let mockMidiDevices: any[] = [];
const mockMidiNoteCallbacks: Array<(event: MidiNoteEvent) => void> = [];

jest.mock('../MidiInput', () => ({
  getMidiInput: () => ({
    initialize: jest.fn(async () => {
      mockMidiIsReady = true;
    }),
    dispose: jest.fn(async () => {
      mockMidiIsReady = false;
    }),
    isReady: () => mockMidiIsReady,
    getConnectedDevices: jest.fn(async () => mockMidiDevices),
    onNoteEvent: jest.fn((cb: (event: MidiNoteEvent) => void) => {
      mockMidiNoteCallbacks.push(cb);
      return () => {
        const idx = mockMidiNoteCallbacks.indexOf(cb);
        if (idx > -1) mockMidiNoteCallbacks.splice(idx, 1);
      };
    }),
    getState: () => ({
      isInitialized: mockMidiIsReady,
      connectedDevices: mockMidiDevices,
      activeDeviceId: null,
    }),
    connectDevice: jest.fn(),
    disconnectDevice: jest.fn(),
    onDeviceConnection: jest.fn(() => () => {}),
    onControlChange: jest.fn(() => () => {}),
  }),
}));

// Mock AudioCapture (configureAudioSessionForRecording)
jest.mock('../AudioCapture', () => ({
  configureAudioSessionForRecording: jest.fn(),
  requestMicrophonePermission: jest.fn(async () => true),
  checkMicrophonePermission: jest.fn(async () => true),
}));

// Mock MicrophoneInput
let mockMicPermissionGranted = false;
const mockMicNoteCallbacks: Array<(event: MidiNoteEvent) => void> = [];
let mockMicIsActive = false;

jest.mock('../MicrophoneInput', () => ({
  MicrophoneInput: jest.fn(),
  createMicrophoneInput: jest.fn(async () => {
    if (!mockMicPermissionGranted) return null;
    return {
      onNoteEvent: jest.fn((cb: (event: MidiNoteEvent) => void) => {
        mockMicNoteCallbacks.push(cb);
        return () => {
          const idx = mockMicNoteCallbacks.indexOf(cb);
          if (idx > -1) mockMicNoteCallbacks.splice(idx, 1);
        };
      }),
      start: jest.fn(async () => { mockMicIsActive = true; }),
      stop: jest.fn(async () => { mockMicIsActive = false; }),
      dispose: jest.fn(() => { mockMicIsActive = false; }),
      getIsActive: () => mockMicIsActive,
      getEstimatedLatencyMs: () => 120,
    };
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNoteOn(note: number, source?: 'midi' | 'mic' | 'touch'): MidiNoteEvent {
  return {
    type: 'noteOn',
    note,
    velocity: 80,
    timestamp: Date.now(),
    channel: 0,
    inputSource: source,
  };
}

function resetMocks() {
  mockMidiIsReady = false;
  mockMidiDevices = [];
  mockMicPermissionGranted = false;
  mockMicIsActive = false;
  mockMidiNoteCallbacks.length = 0;
  mockMicNoteCallbacks.length = 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InputManager', () => {
  beforeEach(resetMocks);

  // =========================================================================
  // Initialization & auto-detection
  // =========================================================================

  describe('auto-detection', () => {
    it('defaults to touch when no MIDI devices and mic permission denied', async () => {
      const manager = new InputManager({ preferred: 'auto' });
      await manager.initialize();

      expect(manager.activeMethod).toBe('touch');
      expect(manager.getIsInitialized()).toBe(true);

      manager.dispose();
    });

    it('selects MIDI when MIDI device is connected', async () => {
      mockMidiDevices = [{ id: 'dev-1', name: 'Test Keyboard', type: 'usb', connected: true }];

      const manager = new InputManager({ preferred: 'auto' });
      await manager.initialize();

      expect(manager.activeMethod).toBe('midi');

      manager.dispose();
    });

    it('selects mic in auto mode when no MIDI and mic permission already granted', async () => {
      // Auto mode tries MIDI > Mic (if already permitted) > Touch
      mockMicPermissionGranted = true;

      const manager = new InputManager({ preferred: 'auto' });
      await manager.initialize();

      expect(manager.activeMethod).toBe('mic');

      manager.dispose();
    });

    it('selects touch in auto mode when no MIDI and mic permission not granted', async () => {
      // Mic permission not granted — auto mode doesn't request it, just falls back to touch
      mockMicPermissionGranted = false;
      // Override checkMicrophonePermission to return false
      const { checkMicrophonePermission } = require('../AudioCapture');
      (checkMicrophonePermission as jest.Mock).mockResolvedValueOnce(false);

      const manager = new InputManager({ preferred: 'auto' });
      await manager.initialize();

      expect(manager.activeMethod).toBe('touch');

      manager.dispose();
    });

    it('prioritizes MIDI over mic when both available', async () => {
      mockMidiDevices = [{ id: 'dev-1', name: 'Test Keyboard', type: 'usb', connected: true }];
      mockMicPermissionGranted = true;

      const manager = new InputManager({ preferred: 'auto' });
      await manager.initialize();

      expect(manager.activeMethod).toBe('midi');

      manager.dispose();
    });
  });

  // =========================================================================
  // Manual method selection
  // =========================================================================

  describe('manual method selection', () => {
    it('forces MIDI when preferred=midi', async () => {
      const manager = new InputManager({ preferred: 'midi' });
      await manager.initialize();

      expect(manager.activeMethod).toBe('midi');
      manager.dispose();
    });

    it('forces mic when preferred=mic and permission granted', async () => {
      mockMicPermissionGranted = true;

      const manager = new InputManager({ preferred: 'mic' });
      await manager.initialize();

      expect(manager.activeMethod).toBe('mic');
      manager.dispose();
    });

    it('falls back to touch when preferred=mic but permission denied', async () => {
      const manager = new InputManager({ preferred: 'mic' });
      await manager.initialize();

      expect(manager.activeMethod).toBe('touch');
      manager.dispose();
    });

    it('forces touch when preferred=touch', async () => {
      mockMidiDevices = [{ id: 'dev-1', name: 'Test Keyboard', type: 'usb', connected: true }];
      mockMicPermissionGranted = true;

      const manager = new InputManager({ preferred: 'touch' });
      await manager.initialize();

      expect(manager.activeMethod).toBe('touch');
      manager.dispose();
    });
  });

  // =========================================================================
  // Note event forwarding
  // =========================================================================

  describe('note event forwarding', () => {
    it('forwards MIDI note events to callbacks', async () => {
      mockMidiDevices = [{ id: 'dev-1', name: 'Test Keyboard', type: 'usb', connected: true }];

      const manager = new InputManager({ preferred: 'midi' });
      await manager.initialize();
      await manager.start();

      const events: MidiNoteEvent[] = [];
      manager.onNoteEvent((e) => events.push(e));

      // Simulate MIDI note
      const noteOn = makeNoteOn(60, 'midi');
      mockMidiNoteCallbacks.forEach((cb) => cb(noteOn));

      expect(events).toHaveLength(1);
      expect(events[0].note).toBe(60);

      manager.dispose();
    });

    it('forwards mic note events to callbacks', async () => {
      mockMicPermissionGranted = true;

      const manager = new InputManager({ preferred: 'mic' });
      await manager.initialize();
      await manager.start();

      const events: MidiNoteEvent[] = [];
      manager.onNoteEvent((e) => events.push(e));

      // Simulate mic note
      const noteOn = makeNoteOn(64, 'mic');
      mockMicNoteCallbacks.forEach((cb) => cb(noteOn));

      expect(events).toHaveLength(1);
      expect(events[0].note).toBe(64);

      manager.dispose();
    });

    it('does not forward MIDI events when active method is mic', async () => {
      mockMicPermissionGranted = true;

      const manager = new InputManager({ preferred: 'mic' });
      await manager.initialize();
      await manager.start();

      const events: MidiNoteEvent[] = [];
      manager.onNoteEvent((e) => events.push(e));

      // Simulate MIDI note (should be ignored since method is mic)
      const noteOn = makeNoteOn(60, 'midi');
      mockMidiNoteCallbacks.forEach((cb) => cb(noteOn));

      expect(events).toHaveLength(0);

      manager.dispose();
    });

    it('unsubscribe stops receiving events', async () => {
      mockMidiDevices = [{ id: 'dev-1', name: 'Test Keyboard', type: 'usb', connected: true }];

      const manager = new InputManager({ preferred: 'midi' });
      await manager.initialize();

      const events: MidiNoteEvent[] = [];
      const unsub = manager.onNoteEvent((e) => events.push(e));

      // First event — received
      mockMidiNoteCallbacks.forEach((cb) => cb(makeNoteOn(60, 'midi')));
      expect(events).toHaveLength(1);

      // Unsubscribe
      unsub();

      // Second event — not received
      mockMidiNoteCallbacks.forEach((cb) => cb(makeNoteOn(64, 'midi')));
      expect(events).toHaveLength(1);

      manager.dispose();
    });
  });

  // =========================================================================
  // Lifecycle
  // =========================================================================

  describe('lifecycle', () => {
    it('start/stop manages mic capture', async () => {
      mockMicPermissionGranted = true;

      const manager = new InputManager({ preferred: 'mic' });
      await manager.initialize();

      expect(manager.getIsStarted()).toBe(false);

      await manager.start();
      expect(manager.getIsStarted()).toBe(true);
      expect(mockMicIsActive).toBe(true);

      await manager.stop();
      expect(manager.getIsStarted()).toBe(false);
      expect(mockMicIsActive).toBe(false);

      manager.dispose();
    });

    it('dispose cleans up everything', async () => {
      mockMicPermissionGranted = true;

      const manager = new InputManager({ preferred: 'mic' });
      await manager.initialize();
      await manager.start();

      manager.dispose();

      expect(manager.getIsInitialized()).toBe(false);
      expect(manager.getIsStarted()).toBe(false);
    });

    it('initialize is idempotent', async () => {
      const manager = new InputManager({ preferred: 'touch' });
      await manager.initialize();
      await manager.initialize(); // Should not throw

      expect(manager.getIsInitialized()).toBe(true);
      manager.dispose();
    });
  });

  // =========================================================================
  // Runtime method switching
  // =========================================================================

  describe('switchMethod', () => {
    it('switches from touch to mic', async () => {
      mockMicPermissionGranted = true;

      const manager = new InputManager({ preferred: 'touch' });
      await manager.initialize();
      expect(manager.activeMethod).toBe('touch');

      await manager.switchMethod('mic');
      expect(manager.activeMethod).toBe('mic');

      manager.dispose();
    });

    it('restarts if was previously started', async () => {
      mockMicPermissionGranted = true;

      const manager = new InputManager({ preferred: 'touch' });
      await manager.initialize();
      await manager.start();
      expect(manager.getIsStarted()).toBe(true);

      await manager.switchMethod('mic');
      expect(manager.getIsStarted()).toBe(true);
      expect(manager.activeMethod).toBe('mic');

      manager.dispose();
    });
  });

  // =========================================================================
  // Timing constants
  // =========================================================================

  describe('timing constants', () => {
    it('MIDI has 1.0x timing multiplier', () => {
      expect(INPUT_TIMING_MULTIPLIERS.midi).toBe(1.0);
    });

    it('touch has 1.0x timing multiplier', () => {
      expect(INPUT_TIMING_MULTIPLIERS.touch).toBe(1.0);
    });

    it('mic has 1.5x timing multiplier', () => {
      expect(INPUT_TIMING_MULTIPLIERS.mic).toBe(1.5);
    });

    it('MIDI has 0ms latency compensation', () => {
      expect(INPUT_LATENCY_COMPENSATION_MS.midi).toBe(0);
    });

    it('touch has 20ms latency compensation', () => {
      expect(INPUT_LATENCY_COMPENSATION_MS.touch).toBe(20);
    });

    it('mic has 100ms latency compensation', () => {
      expect(INPUT_LATENCY_COMPENSATION_MS.mic).toBe(100);
    });

    it('getTimingMultiplier returns correct value', async () => {
      mockMidiDevices = [{ id: 'dev-1', name: 'Test Keyboard', type: 'usb', connected: true }];
      const manager = new InputManager({ preferred: 'midi' });
      await manager.initialize();

      expect(manager.getTimingMultiplier()).toBe(1.0);
      manager.dispose();
    });

    it('getLatencyCompensationMs returns correct value for mic', async () => {
      mockMicPermissionGranted = true;
      const manager = new InputManager({ preferred: 'mic' });
      await manager.initialize();

      expect(manager.getLatencyCompensationMs()).toBe(100);
      manager.dispose();
    });
  });
});
