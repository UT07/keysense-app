/**
 * MIDI input abstraction layer
 * Handles MIDI device connection and event processing
 * Ultra-low latency implementation via @motiz88/react-native-midi (Web MIDI API)
 *
 * Architecture:
 * - requestMIDIAccess() → MIDIAccess (Expo native module)
 * - MIDIInput.onmidimessage → raw MIDI bytes → parsed MidiNoteEvent
 * - Total latency target: <5ms
 */

import { Platform } from 'react-native';
import type { MidiNoteEvent } from '@/core/exercises/types';
export type { MidiNoteEvent } from '@/core/exercises/types';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer?: string;
  type: 'input' | 'output' | 'usb' | 'bluetooth';
  connected: boolean;
  connectionTime?: number;
}

export interface MidiInputState {
  isInitialized: boolean;
  connectedDevices: MidiDevice[];
  activeDeviceId: string | null;
  lastNoteTime?: number;
}

export type MidiNoteCallback = (note: MidiNoteEvent) => void;
export type MidiConnectionCallback = (device: MidiDevice, connected: boolean) => void;
export type MidiControlChangeCallback = (cc: number, value: number, channel: number) => void;

export interface MidiInput {
  // Initialization
  initialize(): Promise<void>;
  dispose(): Promise<void>;

  // Device management
  getConnectedDevices(): Promise<MidiDevice[]>;
  connectDevice(deviceId: string): Promise<void>;
  disconnectDevice(deviceId: string): Promise<void>;

  // Callbacks
  onNoteEvent(callback: MidiNoteCallback): () => void;
  onDeviceConnection(callback: MidiConnectionCallback): () => void;
  onControlChange(callback: MidiControlChangeCallback): () => void;

  // State
  getState(): MidiInputState;
  isReady(): boolean;
}

/**
 * Native MIDI Input Implementation
 * Uses @motiz88/react-native-midi which provides the Web MIDI API
 */
export class NativeMidiInput implements MidiInput {
  state: MidiInputState = {
    isInitialized: false,
    connectedDevices: [],
    activeDeviceId: null,
  };

  private noteCallbacks: MidiNoteCallback[] = [];
  private connectionCallbacks: MidiConnectionCallback[] = [];
  private controlChangeCallbacks: MidiControlChangeCallback[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private midiAccess: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private activeInput: any = null;

  async initialize(): Promise<void> {
    if (this.state.isInitialized) {
      return;
    }

    try {
      // Import the Web MIDI API polyfill from @motiz88/react-native-midi
      const { requestMIDIAccess } = require('@motiz88/react-native-midi');
      this.midiAccess = await requestMIDIAccess();
      console.log('[MIDI] Web MIDI access granted');

      // Listen for device connection/disconnection
      this.midiAccess.onstatechange = this._handleStateChange.bind(this);

      // Get initial device list
      await this.getConnectedDevices();
      console.log(`[MIDI] Found ${this.state.connectedDevices.length} connected devices`);

      this.state.isInitialized = true;
    } catch (error) {
      console.error('[MIDI] Initialization failed:', error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    try {
      // Disconnect active input
      if (this.activeInput) {
        this.activeInput.onmidimessage = null;
        this.activeInput = null;
      }

      if (this.midiAccess) {
        this.midiAccess.onstatechange = null;
        this.midiAccess = null;
      }

      this.state.isInitialized = false;
      this.state.connectedDevices = [];
      this.state.activeDeviceId = null;
      this.noteCallbacks = [];
      this.connectionCallbacks = [];
      this.controlChangeCallbacks = [];
      console.log('[MIDI] Shutdown complete');
    } catch (error) {
      console.error('[MIDI] Shutdown error:', error);
    }
  }

  async getConnectedDevices(): Promise<MidiDevice[]> {
    if (!this.midiAccess) return [];

    const devices: MidiDevice[] = [];
    // Web MIDI API: midiAccess.inputs is a Map-like of MIDIInput objects
    this.midiAccess.inputs.forEach((input: { id: string; name: string; manufacturer: string; state: string }) => {
      devices.push({
        id: input.id,
        name: input.name || 'Unknown Device',
        manufacturer: input.manufacturer,
        type: 'input',
        connected: input.state === 'connected',
      });
    });

    this.state.connectedDevices = devices;
    return devices;
  }

  async connectDevice(deviceId: string): Promise<void> {
    if (!this.midiAccess) return;

    // Disconnect current device if any
    if (this.activeInput) {
      this.activeInput.onmidimessage = null;
      this.activeInput = null;
    }

    const input = this.midiAccess.inputs.get(deviceId);
    if (!input) {
      console.warn(`[MIDI] Device ${deviceId} not found`);
      return;
    }

    // Set up MIDI message listener on this input
    input.onmidimessage = this._handleMidiMessage.bind(this);
    this.activeInput = input;
    this.state.activeDeviceId = deviceId;

    console.log(`[MIDI] Connected to device: ${input.name}`);
    const device = this.state.connectedDevices.find((d) => d.id === deviceId);
    if (device) {
      this.connectionCallbacks.forEach((cb) => cb(device, true));
    }
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    if (this.activeInput && this.state.activeDeviceId === deviceId) {
      this.activeInput.onmidimessage = null;
      this.activeInput = null;
      this.state.activeDeviceId = null;

      const device = this.state.connectedDevices.find((d) => d.id === deviceId);
      console.log(`[MIDI] Disconnected from device: ${device?.name}`);
      if (device) {
        this.connectionCallbacks.forEach((cb) => cb(device, false));
      }
    }
  }

  onNoteEvent(callback: MidiNoteCallback): () => void {
    this.noteCallbacks.push(callback);
    return () => {
      const index = this.noteCallbacks.indexOf(callback);
      if (index > -1) this.noteCallbacks.splice(index, 1);
    };
  }

  onDeviceConnection(callback: MidiConnectionCallback): () => void {
    this.connectionCallbacks.push(callback);
    return () => {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) this.connectionCallbacks.splice(index, 1);
    };
  }

  onControlChange(callback: MidiControlChangeCallback): () => void {
    this.controlChangeCallbacks.push(callback);
    return () => {
      const index = this.controlChangeCallbacks.indexOf(callback);
      if (index > -1) this.controlChangeCallbacks.splice(index, 1);
    };
  }

  getState(): MidiInputState {
    return { ...this.state };
  }

  isReady(): boolean {
    return this.state.isInitialized;
  }

  /**
   * Parse raw MIDI message bytes from Web MIDI API
   * Status byte format: [message type (4 bits) | channel (4 bits)]
   */
  private _handleMidiMessage(event: { data: Uint8Array; timeStamp: number }): void {
    const [status, data1, data2] = event.data;
    const channel = status & 0x0f;
    const messageType = status & 0xf0;

    switch (messageType) {
      case 0x90: {
        // Note On (velocity 0 = Note Off per MIDI running status)
        const noteEvent: MidiNoteEvent = {
          type: data2 > 0 ? 'noteOn' : 'noteOff',
          note: data1,
          velocity: data2,
          timestamp: Date.now(), // Normalize to JS time domain
          channel,
        };
        this.state.lastNoteTime = Date.now();
        this.noteCallbacks.forEach((cb) => {
          try {
            cb(noteEvent);
          } catch (error) {
            console.error('[MIDI] Error in note callback:', error);
          }
        });
        break;
      }
      case 0x80: {
        // Note Off
        const noteOffEvent: MidiNoteEvent = {
          type: 'noteOff',
          note: data1,
          velocity: data2,
          timestamp: Date.now(),
          channel,
        };
        this.noteCallbacks.forEach((cb) => {
          try {
            cb(noteOffEvent);
          } catch (error) {
            console.error('[MIDI] Error in note callback:', error);
          }
        });
        break;
      }
      case 0xb0: {
        // Control Change
        this.controlChangeCallbacks.forEach((cb) => {
          try {
            cb(data1, data2, channel);
          } catch (error) {
            console.error('[MIDI] Error in CC callback:', error);
          }
        });
        break;
      }
    }
  }

  /**
   * Handle Web MIDI API state change events (device connect/disconnect)
   */
  private _handleStateChange(event: { port: { id: string; name: string; manufacturer: string; type: string; state: string } }): void {
    const port = event.port;
    if (port.type !== 'input') return;

    if (port.state === 'connected') {
      const device: MidiDevice = {
        id: port.id,
        name: port.name || 'Unknown Device',
        manufacturer: port.manufacturer,
        type: 'input',
        connected: true,
        connectionTime: Date.now(),
      };
      if (!this.state.connectedDevices.find((d) => d.id === device.id)) {
        this.state.connectedDevices.push(device);
      }
      this.connectionCallbacks.forEach((cb) => {
        try {
          cb(device, true);
        } catch (error) {
          console.error('[MIDI] Error in connection callback:', error);
        }
      });
    } else if (port.state === 'disconnected') {
      const index = this.state.connectedDevices.findIndex((d) => d.id === port.id);
      if (index !== -1) {
        const [device] = this.state.connectedDevices.splice(index, 1);
        if (this.state.activeDeviceId === device.id) {
          this.state.activeDeviceId = null;
          if (this.activeInput) {
            this.activeInput.onmidimessage = null;
            this.activeInput = null;
          }
        }
        this.connectionCallbacks.forEach((cb) => {
          try {
            cb(device, false);
          } catch (error) {
            console.error('[MIDI] Error in disconnection callback:', error);
          }
        });
      }
    }
  }

  // For testing
  _simulateNoteEvent(note: MidiNoteEvent): void {
    this.noteCallbacks.forEach((cb) => cb(note));
  }

  _simulateDeviceConnection(device: MidiDevice, connected: boolean): void {
    this.connectionCallbacks.forEach((cb) => cb(device, connected));
  }
}

/**
 * No-op implementation for testing
 */
export class NoOpMidiInput implements MidiInput {
  state: MidiInputState = {
    isInitialized: false,
    connectedDevices: [],
    activeDeviceId: null,
  };

  private noteCallbacks: MidiNoteCallback[] = [];
  private connectionCallbacks: MidiConnectionCallback[] = [];
  private controlChangeCallbacks: MidiControlChangeCallback[] = [];

  async initialize(): Promise<void> {
    this.state.isInitialized = true;
  }

  async dispose(): Promise<void> {
    this.state.isInitialized = false;
    this.noteCallbacks = [];
    this.connectionCallbacks = [];
    this.controlChangeCallbacks = [];
  }

  async getConnectedDevices(): Promise<MidiDevice[]> {
    return this.state.connectedDevices;
  }

  async connectDevice(deviceId: string): Promise<void> {
    this.state.activeDeviceId = deviceId;
    const device = this.state.connectedDevices.find((d) => d.id === deviceId);
    if (device) {
      this.connectionCallbacks.forEach((cb) => cb(device, true));
    }
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    if (this.state.activeDeviceId === deviceId) {
      this.state.activeDeviceId = null;
      const device = this.state.connectedDevices.find((d) => d.id === deviceId);
      if (device) {
        this.connectionCallbacks.forEach((cb) => cb(device, false));
      }
    }
  }

  onNoteEvent(callback: MidiNoteCallback): () => void {
    this.noteCallbacks.push(callback);
    return () => {
      const index = this.noteCallbacks.indexOf(callback);
      if (index > -1) this.noteCallbacks.splice(index, 1);
    };
  }

  onDeviceConnection(callback: MidiConnectionCallback): () => void {
    this.connectionCallbacks.push(callback);
    return () => {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) this.connectionCallbacks.splice(index, 1);
    };
  }

  onControlChange(callback: MidiControlChangeCallback): () => void {
    this.controlChangeCallbacks.push(callback);
    return () => {
      const index = this.controlChangeCallbacks.indexOf(callback);
      if (index > -1) this.controlChangeCallbacks.splice(index, 1);
    };
  }

  getState(): MidiInputState {
    return { ...this.state, connectedDevices: [...this.state.connectedDevices] };
  }

  isReady(): boolean {
    return this.state.isInitialized;
  }

  // For testing only
  _simulateNoteEvent(note: MidiNoteEvent): void {
    this.state.lastNoteTime = Date.now();
    this.noteCallbacks.forEach((cb) => {
      try {
        cb(note);
      } catch (error) {
        console.error('[MIDI] Error in note callback:', error);
      }
    });
  }

  _simulateDeviceConnection(device: MidiDevice, connected: boolean): void {
    if (connected) {
      if (!this.state.connectedDevices.find((d) => d.id === device.id)) {
        this.state.connectedDevices.push(device);
      }
    } else {
      this.state.connectedDevices = this.state.connectedDevices.filter(
        (d) => d.id !== device.id
      );
      if (this.state.activeDeviceId === device.id) {
        this.state.activeDeviceId = null;
      }
    }
    this.connectionCallbacks.forEach((cb) => cb(device, connected));
  }
}

// Default instance - use native if available, fallback to no-op
let midiInputInstance: MidiInput | null = null;

export function getMidiInput(): MidiInput {
  if (!midiInputInstance) {
    // Try to use native Web MIDI API if @motiz88/react-native-midi is available
    let useNative = false;
    if (Platform.OS !== 'web') {
      try {
        require('@motiz88/react-native-midi');
        useNative = true;
      } catch {
        // Native MIDI module not linked in this build
      }
    }
    midiInputInstance = useNative ? new NativeMidiInput() : new NoOpMidiInput();
    console.log(
      `[MIDI] Using ${useNative ? 'native (Web MIDI API)' : 'no-op'} MIDI input implementation`
    );
  }
  return midiInputInstance;
}

export function setMidiInput(input: MidiInput): void {
  midiInputInstance = input;
}
