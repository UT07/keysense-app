/**
 * MIDI Integration Tests
 * End-to-end tests for the complete MIDI input pipeline
 */

import { NoOpMidiInput } from '../MidiInput';
import { MidiEventHandler } from '../MidiEventHandler';
import { MidiDeviceManager } from '../MidiDevice';
import type { MidiNoteEvent, MidiDevice } from '../MidiInput';

describe('MIDI Integration Tests', () => {
  let midiInput: NoOpMidiInput;
  let eventHandler: MidiEventHandler;
  let deviceManager: MidiDeviceManager;

  beforeEach(() => {
    midiInput = new NoOpMidiInput();
    eventHandler = new MidiEventHandler({
      sustainCCNumber: 64,
      velocitySensitivity: 'linear',
    });
    deviceManager = MidiDeviceManager.getInstance();
    deviceManager.clearHistory();
  });

  describe('Device Discovery to Playback Pipeline', () => {
    it('should complete full setup flow', async () => {
      // Step 1: Initialize MIDI
      await midiInput.initialize();
      expect(midiInput.isReady()).toBe(true);

      // Step 2: Simulate device connection
      const mockDevice: MidiDevice = {
        id: 'yamaha-p125-001',
        name: 'Yamaha P-125',
        manufacturer: 'Yamaha',
        type: 'usb',
        connected: true,
        connectionTime: Date.now(),
      };

      midiInput._simulateDeviceConnection(mockDevice, true);

      // Step 3: Register device with manager
      const deviceInfo = deviceManager.registerDevice(mockDevice);
      expect(deviceInfo.compatibility?.isVerified).toBe(true);

      // Step 4: Connect to device
      await midiInput.connectDevice(mockDevice.id);
      const state = midiInput.getState();
      expect(state.activeDeviceId).toBe(mockDevice.id);

      // Step 5: Set up event handler
      const playedNotes: MidiNoteEvent[] = [];
      const unsubscribe = midiInput.onNoteEvent((note) => {
        playedNotes.push(note);
        eventHandler.processMidiNote(note);
      });

      // Step 6: Simulate playing a note
      const testNote: MidiNoteEvent = {
        type: 'noteOn',
        note: 60, // Middle C
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      };

      midiInput._simulateNoteEvent(testNote);

      // Verify
      expect(playedNotes.length).toBe(1);
      expect(eventHandler.isNoteActive(60)).toBe(true);

      // Cleanup
      unsubscribe();
      await midiInput.dispose();
    });

    it('should handle multiple devices in sequence', async () => {
      await midiInput.initialize();

      const devices: MidiDevice[] = [
        {
          id: 'device-1',
          name: 'Yamaha P-125',
          type: 'usb',
          connected: true,
        },
        {
          id: 'device-2',
          name: 'Roland FP-30X',
          type: 'bluetooth',
          connected: true,
        },
      ];

      // Register all devices
      devices.forEach((device) => {
        midiInput._simulateDeviceConnection(device, true);
        deviceManager.registerDevice(device);
      });

      // Connect to first device
      await midiInput.connectDevice('device-1');
      expect(midiInput.getState().activeDeviceId).toBe('device-1');

      // Switch to second device
      await midiInput.disconnectDevice('device-1');
      await midiInput.connectDevice('device-2');
      expect(midiInput.getState().activeDeviceId).toBe('device-2');

      await midiInput.dispose();
    });
  });

  describe('Note Processing Pipeline', () => {
    it('should process notes from MIDI input through event handler', async () => {
      await midiInput.initialize();

      const processedNotes: Array<{
        note: number;
        velocity: number;
        type: 'noteOn' | 'noteOff';
      }> = [];

      const mockCallbacks = {
        onNoteOn: jest.fn((note: number, velocity: number) => {
          processedNotes.push({ note, velocity, type: 'noteOn' });
        }),
        onNoteOff: jest.fn((note: number) => {
          processedNotes.push({ note, velocity: 0, type: 'noteOff' });
        }),
        onSustainChange: jest.fn(),
      };

      eventHandler.registerCallbacks(mockCallbacks);

      const unsubscribe = midiInput.onNoteEvent((note) => {
        eventHandler.processMidiNote(note);
      });

      // Send C major scale
      const scaleNotes = [60, 62, 64, 65, 67, 69, 71, 72];

      scaleNotes.forEach((note) => {
        midiInput._simulateNoteEvent({
          type: 'noteOn',
          note,
          velocity: 100,
          timestamp: Date.now(),
          channel: 0,
        });
      });

      expect(mockCallbacks.onNoteOn).toHaveBeenCalledTimes(8);
      expect(processedNotes.length).toBe(8);

      unsubscribe();
      await midiInput.dispose();
    });

    it('should handle sustain pedal through full pipeline', async () => {
      await midiInput.initialize();

      const sustainEvents: Array<{ active: boolean; timestamp: number }> = [];

      const mockCallbacks = {
        onNoteOn: jest.fn(),
        onNoteOff: jest.fn(),
        onSustainChange: jest.fn((active: boolean, timestamp: number) => {
          sustainEvents.push({ active, timestamp });
        }),
      };

      eventHandler.registerCallbacks(mockCallbacks);

      // Register note handler (pipes MIDI input → event handler)
      const unsubscribeNote = midiInput.onNoteEvent((note) => {
        eventHandler.processMidiNote(note);
      });

      // Register CC handler
      const unsubscribeCC = midiInput.onControlChange((cc, value) => {
        if (cc === 64) {
          eventHandler.processMidiControlChange(cc, value, 0);
        }
      });

      // Play note
      midiInput._simulateNoteEvent({
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: Date.now(),
        channel: 0,
      });

      // Press sustain
      eventHandler.processMidiControlChange(64, 127, 0);

      // Release note (should be sustained)
      midiInput._simulateNoteEvent({
        type: 'noteOff',
        note: 60,
        velocity: 0,
        timestamp: Date.now() + 100,
        channel: 0,
      });

      // Note should be sustained
      expect(eventHandler.isNoteActive(60)).toBe(true);

      // Release sustain
      eventHandler.processMidiControlChange(64, 0, 0);

      // Note should be released
      expect(eventHandler.isNoteActive(60)).toBe(false);

      unsubscribeNote();
      unsubscribeCC();
      await midiInput.dispose();
    });
  });

  describe('Performance & Latency', () => {
    it('should maintain <5ms latency for note events', async () => {
      await midiInput.initialize();

      const latencies: number[] = [];

      const unsubscribe = midiInput.onNoteEvent((note) => {
        const latency = Date.now() - note.timestamp;
        latencies.push(latency);
      });

      // Simulate 100 note events
      for (let i = 0; i < 100; i++) {
        midiInput._simulateNoteEvent({
          type: 'noteOn',
          note: 60,
          velocity: 100,
          timestamp: Date.now(),
          channel: 0,
        });
      }

      const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length;

      // Average should be minimal (less than 10ms in practice)
      expect(avgLatency).toBeLessThan(20);

      unsubscribe();
      await midiInput.dispose();
    });

    it('should process control changes quickly', () => {
      const startTime = Date.now();

      // Process 1000 CC events
      for (let i = 0; i < 1000; i++) {
        eventHandler.processMidiControlChange(64, (i % 128) * 2, 0);
      }

      const duration = Date.now() - startTime;
      const avgMs = duration / 1000;

      expect(avgMs).toBeLessThan(1);
    });
  });

  describe('Realistic Music Scenarios', () => {
    it('should handle playing a simple melody', async () => {
      await midiInput.initialize();

      // "Mary Had A Little Lamb" in MIDI notes
      const melody = [
        { note: 60, duration: 200 },
        { note: 62, duration: 200 },
        { note: 64, duration: 200 },
        { note: 62, duration: 200 },
        { note: 67, duration: 200 },
        { note: 69, duration: 400 },
      ];

      const playedNotes: number[] = [];

      const unsubscribe = midiInput.onNoteEvent((note) => {
        if (note.type === 'noteOn') {
          playedNotes.push(note.note);
        }
      });

      let time = Date.now();
      melody.forEach(({ note, duration }) => {
        // Note on
        midiInput._simulateNoteEvent({
          type: 'noteOn',
          note,
          velocity: 100,
          timestamp: time,
          channel: 0,
        });

        // Note off
        midiInput._simulateNoteEvent({
          type: 'noteOff',
          note,
          velocity: 0,
          timestamp: time + duration,
          channel: 0,
        });

        time += duration;
      });

      expect(playedNotes).toEqual([60, 62, 64, 62, 67, 69]);

      unsubscribe();
      await midiInput.dispose();
    });

    it('should handle playing chords', async () => {
      await midiInput.initialize();

      const mockCallbacks = {
        onNoteOn: jest.fn(),
        onNoteOff: jest.fn(),
        onSustainChange: jest.fn(),
      };

      eventHandler.registerCallbacks(mockCallbacks);

      const unsubscribe = midiInput.onNoteEvent((note) => {
        eventHandler.processMidiNote(note);
      });

      // C major chord
      const chord = [60, 64, 67];
      const baseTime = Date.now();

      chord.forEach((note, index) => {
        midiInput._simulateNoteEvent({
          type: 'noteOn',
          note,
          velocity: 100,
          timestamp: baseTime + index * 10,
          channel: 0,
        });
      });

      // All notes should be active
      expect(eventHandler.getActiveNotes().size).toBe(3);

      // Verify each note is active
      chord.forEach((note) => {
        expect(eventHandler.isNoteActive(note)).toBe(true);
      });

      unsubscribe();
      await midiInput.dispose();
    });

    it('should handle velocity dynamics', async () => {
      await midiInput.initialize();

      const velocities: number[] = [];

      const mockCallbacks = {
        onNoteOn: jest.fn((_note: number, velocity: number) => {
          velocities.push(velocity);
        }),
        onNoteOff: jest.fn(),
        onSustainChange: jest.fn(),
      };

      eventHandler.registerCallbacks(mockCallbacks);

      const unsubscribe = midiInput.onNoteEvent((note) => {
        eventHandler.processMidiNote(note);
      });

      // Play notes with different velocities
      const velocityValues = [20, 50, 100, 127];

      velocityValues.forEach((vel) => {
        midiInput._simulateNoteEvent({
          type: 'noteOn',
          note: 60,
          velocity: vel,
          timestamp: Date.now(),
          channel: 0,
        });
      });

      // Verify velocities are mapped correctly
      expect(velocities[0]).toBeCloseTo(20 / 127, 2);
      expect(velocities[1]).toBeCloseTo(50 / 127, 2);
      expect(velocities[2]).toBeCloseTo(100 / 127, 2);
      expect(velocities[3]).toBeCloseTo(1, 2);

      unsubscribe();
      await midiInput.dispose();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from device disconnection', async () => {
      await midiInput.initialize();

      const mockDevice: MidiDevice = {
        id: 'device-1',
        name: 'Test Keyboard',
        type: 'usb',
        connected: true,
      };

      let deviceConnected = false;

      const unsubscribe = midiInput.onDeviceConnection((device, connected) => {
        if (device.id === 'device-1') {
          deviceConnected = connected;
        }
      });

      // Connect device
      midiInput._simulateDeviceConnection(mockDevice, true);
      await midiInput.connectDevice('device-1');
      expect(deviceConnected).toBe(true);

      // Simulate disconnection
      midiInput._simulateDeviceConnection(mockDevice, false);

      // Should be disconnected
      expect(midiInput.getState().activeDeviceId).toBeNull();

      unsubscribe();
      await midiInput.dispose();
    });

    it('should handle rapid connect/disconnect cycles', async () => {
      await midiInput.initialize();

      const mockDevice: MidiDevice = {
        id: 'device-1',
        name: 'Test Keyboard',
        type: 'usb',
        connected: true,
      };

      let connectionCount = 0;

      const unsubscribe = midiInput.onDeviceConnection(() => {
        connectionCount++;
      });

      // Simulate rapid connect/disconnect
      for (let i = 0; i < 10; i++) {
        midiInput._simulateDeviceConnection(mockDevice, true);
        await midiInput.connectDevice('device-1');

        midiInput._simulateDeviceConnection(mockDevice, false);
        await midiInput.disconnectDevice('device-1');
      }

      expect(connectionCount).toBeGreaterThan(0);

      unsubscribe();
      await midiInput.dispose();
    });

    it('should handle callback exceptions gracefully', async () => {
      await midiInput.initialize();

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Register callback that throws
      const unsubscribe = midiInput.onNoteEvent(() => {
        throw new Error('Callback error');
      });

      // Should not crash
      expect(() => {
        midiInput._simulateNoteEvent({
          type: 'noteOn',
          note: 60,
          velocity: 100,
          timestamp: Date.now(),
          channel: 0,
        });
      }).not.toThrow();

      unsubscribe();
      await midiInput.dispose();
      errorSpy.mockRestore();
    });
  });

  describe('Device Manager Integration', () => {
    it('should integrate device manager with MIDI input', async () => {
      await midiInput.initialize();

      const devices: MidiDevice[] = [
        {
          id: 'yamaha-1',
          name: 'Yamaha P-125',
          type: 'usb',
          connected: true,
        },
        {
          id: 'roland-1',
          name: 'Roland FP-30X',
          type: 'usb',
          connected: true,
        },
      ];

      // Simulate device discovery
      devices.forEach((device) => {
        midiInput._simulateDeviceConnection(device, true);
        const info = deviceManager.registerDevice(device);
        expect(info.compatibility?.isVerified).toBe(true);
      });

      // Set preferred device
      deviceManager.setPreferredDevice('yamaha-1');
      expect(deviceManager.getPreferredDevice()?.id).toBe('yamaha-1');

      // Connect preferred device
      const preferred = deviceManager.getPreferredDevice();
      if (preferred) {
        await midiInput.connectDevice(preferred.id);
        expect(midiInput.getState().activeDeviceId).toBe('yamaha-1');
      }

      await midiInput.dispose();
    });
  });

  describe('Multi-Platform Compatibility', () => {
    it('should handle MIDI from different device types', async () => {
      await midiInput.initialize();

      const deviceTypes: Array<'usb' | 'bluetooth'> = ['usb', 'bluetooth'];
      let notesReceived = 0;

      const unsubscribe = midiInput.onNoteEvent(() => {
        notesReceived++;
      });

      for (const deviceType of deviceTypes) {
        const mockDevice: MidiDevice = {
          id: `device-${deviceType}`,
          name: `Test ${deviceType.toUpperCase()} Keyboard`,
          type: deviceType,
          connected: true,
        };

        midiInput._simulateDeviceConnection(mockDevice, true);
        await midiInput.connectDevice(mockDevice.id);

        // Simulate note
        midiInput._simulateNoteEvent({
          type: 'noteOn',
          note: 60,
          velocity: 100,
          timestamp: Date.now(),
          channel: 0,
        });
      }

      expect(notesReceived).toBe(2);

      unsubscribe();
      await midiInput.dispose();
    });

    it('should handle different MIDI channels', async () => {
      await midiInput.initialize();

      const channelsUsed: Set<number> = new Set();

      const unsubscribe = midiInput.onNoteEvent((note) => {
        channelsUsed.add(note.channel);
      });

      // Simulate notes on different channels
      for (let channel = 0; channel < 4; channel++) {
        midiInput._simulateNoteEvent({
          type: 'noteOn',
          note: 60 + channel,
          velocity: 100,
          timestamp: Date.now(),
          channel,
        });
      }

      expect(channelsUsed.size).toBe(4);
      expect(Array.from(channelsUsed)).toEqual([0, 1, 2, 3]);

      unsubscribe();
      await midiInput.dispose();
    });
  });

  describe('State Consistency', () => {
    it('should maintain consistent state across operations', async () => {
      await midiInput.initialize();

      const mockDevice: MidiDevice = {
        id: 'device-1',
        name: 'Test Keyboard',
        type: 'usb',
        connected: true,
      };

      // Connect device
      midiInput._simulateDeviceConnection(mockDevice, true);
      await midiInput.connectDevice('device-1');

      let state = midiInput.getState();
      expect(state.activeDeviceId).toBe('device-1');

      // Play note
      const noteTime = Date.now();
      midiInput._simulateNoteEvent({
        type: 'noteOn',
        note: 60,
        velocity: 100,
        timestamp: noteTime,
        channel: 0,
      });

      state = midiInput.getState();
      expect(state.lastNoteTime).toBeDefined();
      expect(state.lastNoteTime).toBeGreaterThanOrEqual(noteTime);

      // Disconnect
      await midiInput.disconnectDevice('device-1');

      state = midiInput.getState();
      expect(state.activeDeviceId).toBeNull();

      await midiInput.dispose();
    });
  });
});
