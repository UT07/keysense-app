/**
 * MIDI Device Manager
 * Device detection, management, and reconnection logic
 *
 * Responsibilities:
 * - Discover available MIDI devices (USB and Bluetooth)
 * - Auto-detect and prompt user when device connected
 * - Handle device disconnection and reconnection
 * - Maintain device preferences (last used device)
 * - Provide device compatibility information
 * - Cache device information for quick access
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MidiDevice as IMidiDevice } from './MidiInput';

/**
 * Known MIDI keyboards and their specs for compatibility
 */
export const KNOWN_MIDI_KEYBOARDS = {
  // Yamaha
  P125: {
    name: 'Yamaha P-125',
    manufacturer: 'Yamaha',
    hasVelocity: true,
    hasSustain: true,
    minPolyphony: 64,
    verified: true,
  },
  P225: {
    name: 'Yamaha P-225',
    manufacturer: 'Yamaha',
    hasVelocity: true,
    hasSustain: true,
    minPolyphony: 64,
    verified: true,
  },
  // Casio
  CDPs130: {
    name: 'Casio CDP-S130',
    manufacturer: 'Casio',
    hasVelocity: true,
    hasSustain: true,
    minPolyphony: 192,
    verified: true,
  },
  // Roland
  FP30X: {
    name: 'Roland FP-30X',
    manufacturer: 'Roland',
    hasVelocity: true,
    hasSustain: true,
    minPolyphony: 128,
    verified: true,
  },
  // M-Audio
  HammerKey88: {
    name: 'M-Audio Hammer 88 Pro',
    manufacturer: 'M-Audio',
    hasVelocity: true,
    hasSustain: true,
    minPolyphony: 64,
    verified: true,
  },
  // Korg
  MicroKey: {
    name: 'Korg microKEY',
    manufacturer: 'Korg',
    hasVelocity: true,
    hasSustain: false,
    minPolyphony: 1,
    verified: true,
  },
  // Alesis
  Q88: {
    name: 'Alesis Q88',
    manufacturer: 'Alesis',
    hasVelocity: true,
    hasSustain: true,
    minPolyphony: 128,
    verified: true,
  },
} as const;

/**
 * Device Compatibility Info
 */
export interface DeviceCompatibility {
  isVerified: boolean;
  hasVelocity: boolean;
  hasSustain: boolean;
  minPolyphony: number;
  notes?: string;
}

/**
 * MIDI Device with Extended Info
 */
export interface MidiDeviceInfo extends IMidiDevice {
  compatibility?: DeviceCompatibility;
  lastUsedTime?: number;
  isPreferred?: boolean;
}

/**
 * Device Storage Keys
 */
const STORAGE_KEYS = {
  lastDeviceId: 'midi_last_device_id',
  lastDeviceName: 'midi_last_device_name',
  discoveredDevices: 'midi_discovered_devices',
  autoConnectEnabled: 'midi_auto_connect_enabled',
} as const;

/**
 * Storage wrapper for AsyncStorage
 */
class MidiStorage {
  private prefix = 'midi-devices:';

  async getString(key: string): Promise<string | null> {
    return await AsyncStorage.getItem(this.prefix + key);
  }

  async getNumber(key: string): Promise<number | undefined> {
    const value = await AsyncStorage.getItem(this.prefix + key);
    return value ? parseFloat(value) : undefined;
  }

  async getBoolean(key: string): Promise<boolean | undefined> {
    const value = await AsyncStorage.getItem(this.prefix + key);
    return value ? value === 'true' : undefined;
  }

  async set(key: string, value: string | number | boolean): Promise<void> {
    await AsyncStorage.setItem(this.prefix + key, String(value));
  }

  async delete(key: string): Promise<void> {
    await AsyncStorage.removeItem(this.prefix + key);
  }

  async clearAll(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const midiKeys = keys.filter(k => k.startsWith(this.prefix));
    await AsyncStorage.multiRemove(midiKeys);
  }
}

/**
 * MIDI Device Manager
 */
export class MidiDeviceManager {
  private static instance: MidiDeviceManager;
  private storage: MidiStorage;
  private discoveredDevices: Map<string, MidiDeviceInfo> = new Map();
  private statusListeners: Array<(device: MidiDeviceInfo, connected: boolean) => void> = [];

  // In-memory cache for synchronous reads (async storage is fire-and-forget persistence)
  private preferredDeviceId: string | null = null;
  private lastUsedDeviceId: string | null = null;
  private autoConnect: boolean = false;

  private constructor() {
    this.storage = new MidiStorage();
    // Load devices asynchronously (fire-and-forget)
    this._loadDiscoveredDevices().catch(err =>
      console.error('[MIDI Device] Failed to load devices:', err)
    );
  }

  static getInstance(): MidiDeviceManager {
    if (!MidiDeviceManager.instance) {
      MidiDeviceManager.instance = new MidiDeviceManager();
    }
    return MidiDeviceManager.instance;
  }

  /**
   * Get device compatibility information
   * Returns verification status and capabilities
   */
  getCompatibility(device: IMidiDevice): DeviceCompatibility {
    // Try to match against known keyboards
    for (const [_key, specs] of Object.entries(KNOWN_MIDI_KEYBOARDS)) {
      if (this._deviceMatches(device, specs)) {
        return {
          isVerified: specs.verified,
          hasVelocity: specs.hasVelocity,
          hasSustain: specs.hasSustain,
          minPolyphony: specs.minPolyphony,
        };
      }
    }

    // Default for unknown USB/Bluetooth MIDI devices
    // Assume MIDI compliance (class-compliant)
    return {
      isVerified: false,
      hasVelocity: true,  // Standard MIDI
      hasSustain: true,   // Standard MIDI
      minPolyphony: 16,   // Conservative minimum
      notes: 'Untested device - may require firmware update',
    };
  }

  /**
   * Register device as discovered
   */
  registerDevice(device: IMidiDevice): MidiDeviceInfo {
    const compatibility = this.getCompatibility(device);
    const existing = this.discoveredDevices.get(device.id);
    const info: MidiDeviceInfo = {
      ...device,
      compatibility,
      lastUsedTime: existing?.lastUsedTime,
    };

    this.discoveredDevices.set(device.id, info);
    this._saveDiscoveredDevices();

    return info;
  }

  /**
   * Get all discovered devices (with history)
   */
  getDiscoveredDevices(): MidiDeviceInfo[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): MidiDeviceInfo | undefined {
    return this.discoveredDevices.get(deviceId);
  }

  /**
   * Mark device as last used
   */
  markDeviceUsed(deviceId: string): void {
    const device = this.discoveredDevices.get(deviceId);
    if (device) {
      device.lastUsedTime = Date.now();
      this.lastUsedDeviceId = deviceId;
      this.storage.set(`device_last_used_${deviceId}`, device.lastUsedTime);
      this._saveDiscoveredDevices();
    }
  }

  /**
   * Get last used device ID (most recently used, or preferred if none used)
   */
  getLastUsedDeviceId(): string | null {
    return this.lastUsedDeviceId ?? this.preferredDeviceId;
  }

  /**
   * Set preferred device for auto-connect
   */
  setPreferredDevice(deviceId: string): void {
    this.preferredDeviceId = deviceId;
    this.autoConnect = true;

    // Persist (fire-and-forget)
    this.storage.set(STORAGE_KEYS.lastDeviceId, deviceId);
    this.storage.set(STORAGE_KEYS.autoConnectEnabled, true);

    // Update preferences
    this.discoveredDevices.forEach((device, id) => {
      device.isPreferred = id === deviceId;
    });
  }

  /**
   * Get preferred device
   */
  getPreferredDevice(): MidiDeviceInfo | null {
    const deviceId = this.getLastUsedDeviceId();
    if (!deviceId) return null;

    const device = this.discoveredDevices.get(deviceId);
    return device ?? null;
  }

  /**
   * Check if auto-connect is enabled
   */
  isAutoConnectEnabled(): boolean {
    return this.autoConnect;
  }

  /**
   * Enable/disable auto-connect
   */
  setAutoConnectEnabled(enabled: boolean): void {
    this.autoConnect = enabled;
    this.storage.set(STORAGE_KEYS.autoConnectEnabled, enabled);
  }

  /**
   * Register listener for device status changes
   */
  onDeviceStatusChange(
    callback: (device: MidiDeviceInfo, connected: boolean) => void
  ): () => void {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify listeners of status change
   */
  notifyStatusChange(device: IMidiDevice, connected: boolean): void {
    const info = this.registerDevice(device);
    this.statusListeners.forEach(callback => {
      try {
        callback(info, connected);
      } catch (error) {
        console.error('[MIDI Device] Error in status listener:', error);
      }
    });
  }

  /**
   * Forget a device (remove from history)
   */
  forgetDevice(deviceId: string): void {
    this.discoveredDevices.delete(deviceId);
    this.storage.delete(`device_last_used_${deviceId}`);
    this._saveDiscoveredDevices();
  }

  /**
   * Clear all device history
   */
  clearHistory(): void {
    this.discoveredDevices.clear();
    this.preferredDeviceId = null;
    this.lastUsedDeviceId = null;
    this.autoConnect = false;
    this.storage.clearAll();
    console.log('[MIDI Device] Cleared all device history');
  }

  /**
   * Check if device matches known specs
   */
  private _deviceMatches(device: IMidiDevice, specs: any): boolean {
    // Match by name (exact or contains)
    if (device.name && specs.name) {
      return (
        device.name.includes(specs.name) ||
        specs.name.includes(device.name) ||
        device.name === specs.name
      );
    }

    // Match by manufacturer
    if (device.manufacturer && specs.manufacturer) {
      return device.manufacturer === specs.manufacturer;
    }

    return false;
  }

  /**
   * Load discovered devices from storage
   */
  private async _loadDiscoveredDevices(): Promise<void> {
    try {
      const data = await this.storage.getString(STORAGE_KEYS.discoveredDevices);
      if (data) {
        const devices = JSON.parse(data);
        for (const [id, device] of Object.entries(devices)) {
          this.discoveredDevices.set(id, device as MidiDeviceInfo);
        }
        console.log(`[MIDI Device] Loaded ${this.discoveredDevices.size} devices from storage`);
      }
    } catch (error) {
      console.error('[MIDI Device] Error loading devices:', error);
    }
  }

  /**
   * Save discovered devices to storage
   */
  private async _saveDiscoveredDevices(): Promise<void> {
    try {
      const data: Record<string, MidiDeviceInfo> = {};
      this.discoveredDevices.forEach((device, id) => {
        data[id] = device;
      });
      await this.storage.set(STORAGE_KEYS.discoveredDevices, JSON.stringify(data));
    } catch (error) {
      console.error('[MIDI Device] Error saving devices:', error);
    }
  }
}

export default MidiDeviceManager.getInstance();
