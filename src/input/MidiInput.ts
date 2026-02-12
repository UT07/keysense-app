/**
 * MIDI input abstraction layer
 * Handles MIDI device connection and event processing
 * Ultra-low latency implementation with native module integration
 *
 * Architecture:
 * - NativeModule (react-native-midi): <2ms
 * - JS Event Handler (MidiEventHandler): <3ms
 * - Total latency target: <5ms
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { MidiNoteEvent } from '@/core/exercises/types';
export type { MidiNoteEvent } from '@/core/exercises/types';

const { RNMidi } = NativeModules;

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
 * Integrates with react-native-midi for USB and Bluetooth MIDI
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
  private midiEmitter: NativeEventEmitter | null = null;
  private eventSubscriptions: any[] = [];

  async initialize(): Promise<void> {
    if (this.state.isInitialized) {
      return;
    }

    try {
      // Initialize native MIDI module
      if (RNMidi && RNMidi.initialize) {
        await RNMidi.initialize();
        console.log('[MIDI] Native module initialized');
      }

      // Set up event emitter
      if (RNMidi) {
        this.midiEmitter = new NativeEventEmitter(RNMidi);
        this._setupNativeListeners();
      }

      // Get initial device list
      const devices = await this.getConnectedDevices();
      console.log(`[MIDI] Found ${devices.length} connected devices`);

      this.state.isInitialized = true;
    } catch (error) {
      console.error('[MIDI] Initialization failed:', error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    try {
      if (RNMidi && RNMidi.shutdown) {
        await RNMidi.shutdown();
      }

      // Clean up subscriptions
      this.eventSubscriptions.forEach((sub) => sub?.remove?.());
      this.eventSubscriptions = [];

      this.state.isInitialized = false;
      this.noteCallbacks = [];
      this.connectionCallbacks = [];
      this.controlChangeCallbacks = [];
      console.log('[MIDI] Shutdown complete');
    } catch (error) {
      console.error('[MIDI] Shutdown error:', error);
    }
  }

  async getConnectedDevices(): Promise<MidiDevice[]> {
    try {
      if (!RNMidi || !RNMidi.getDevices) {
        return [];
      }

      const devices = await RNMidi.getDevices();
      const midiDevices: MidiDevice[] = devices.map((d: any) => ({
        id: d.id,
        name: d.name || 'Unknown Device',
        manufacturer: d.manufacturer,
        type: d.type || 'input',
        connected: d.connected ?? true,
        connectionTime: d.connectionTime,
      }));

      this.state.connectedDevices = midiDevices;
      return midiDevices;
    } catch (error) {
      console.error('[MIDI] Error getting devices:', error);
      return [];
    }
  }

  async connectDevice(deviceId: string): Promise<void> {
    const device = this.state.connectedDevices.find((d) => d.id === deviceId);
    if (device) {
      this.state.activeDeviceId = deviceId;
      console.log(`[MIDI] Connected to device: ${device.name}`);
      this.connectionCallbacks.forEach((cb) => cb(device, true));
    }
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    const device = this.state.connectedDevices.find((d) => d.id === deviceId);
    if (device && this.state.activeDeviceId === deviceId) {
      this.state.activeDeviceId = null;
      console.log(`[MIDI] Disconnected from device: ${device.name}`);
      this.connectionCallbacks.forEach((cb) => cb(device, false));
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

  private _setupNativeListeners(): void {
    if (!this.midiEmitter) return;

    // MIDI Note Events
    const noteSub = this.midiEmitter.addListener('midiNote', (event: any) => {
      const midiEvent: MidiNoteEvent = {
        type: event.type === 'noteOn' ? 'noteOn' : 'noteOff',
        note: event.note,
        velocity: event.velocity,
        timestamp: event.timestamp ?? Date.now(),
        channel: event.channel ?? 0,
      };

      this.state.lastNoteTime = Date.now();
      this.noteCallbacks.forEach((cb) => {
        try {
          cb(midiEvent);
        } catch (error) {
          console.error('[MIDI] Error in note callback:', error);
        }
      });
    });

    // Control Change Events
    const ccSub = this.midiEmitter.addListener('midiControlChange', (event: any) => {
      this.controlChangeCallbacks.forEach((cb) => {
        try {
          cb(event.cc, event.value, event.channel ?? 0);
        } catch (error) {
          console.error('[MIDI] Error in CC callback:', error);
        }
      });
    });

    // Device Connected
    const connectedSub = this.midiEmitter.addListener(
      'midiDeviceConnected',
      async (event: any) => {
        const device: MidiDevice = {
          id: event.id,
          name: event.name || 'Unknown Device',
          manufacturer: event.manufacturer,
          type: event.type || 'input',
          connected: true,
          connectionTime: Date.now(),
        };

        this.state.connectedDevices.push(device);
        this.connectionCallbacks.forEach((cb) => {
          try {
            cb(device, true);
          } catch (error) {
            console.error('[MIDI] Error in connection callback:', error);
          }
        });
      }
    );

    // Device Disconnected
    const disconnectedSub = this.midiEmitter.addListener(
      'midiDeviceDisconnected',
      (event: any) => {
        const index = this.state.connectedDevices.findIndex((d) => d.id === event.id);
        if (index !== -1) {
          const [device] = this.state.connectedDevices.splice(index, 1);
          if (this.state.activeDeviceId === device.id) {
            this.state.activeDeviceId = null;
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
    );

    this.eventSubscriptions = [noteSub, ccSub, connectedSub, disconnectedSub];
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
      // Add device to connected list if not already present
      if (!this.state.connectedDevices.find((d) => d.id === device.id)) {
        this.state.connectedDevices.push(device);
      }
    } else {
      // Remove device from connected list
      this.state.connectedDevices = this.state.connectedDevices.filter(
        (d) => d.id !== device.id
      );
      // Clear active device if it was the disconnected one
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
    // Try to use native implementation if MIDI module is available
    const useNative = Platform.OS !== 'web' && RNMidi !== undefined;
    midiInputInstance = useNative ? new NativeMidiInput() : new NoOpMidiInput();
    console.log(
      `[MIDI] Using ${useNative ? 'native' : 'no-op'} MIDI input implementation`
    );
  }
  return midiInputInstance;
}

export function setMidiInput(input: MidiInput): void {
  midiInputInstance = input;
}
