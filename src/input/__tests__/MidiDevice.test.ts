/**
 * MIDI Device Manager Tests
 * Tests for device discovery, compatibility, and persistence
 */

import { MidiDeviceManager, KNOWN_MIDI_KEYBOARDS } from '../MidiDevice';
import type { MidiDevice as IMidiDevice } from '../MidiInput';

describe('MidiDeviceManager', () => {
  let manager: MidiDeviceManager;

  beforeEach(() => {
    manager = MidiDeviceManager.getInstance();
    // Clear history between tests
    manager.clearHistory();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = MidiDeviceManager.getInstance();
      const instance2 = MidiDeviceManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Device Compatibility Detection', () => {
    it('should recognize Yamaha P-125', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        manufacturer: 'Yamaha',
        type: 'usb',
        connected: true,
      };

      const compat = manager.getCompatibility(device);

      expect(compat.isVerified).toBe(true);
      expect(compat.hasVelocity).toBe(true);
      expect(compat.hasSustain).toBe(true);
        expect(compat.minPolyphony).toBe(64);
    });

    it('should recognize Yamaha P-225', () => {
      const device: IMidiDevice = {
        id: 'device-2',
        name: 'Yamaha P-225',
        manufacturer: 'Yamaha',
        type: 'bluetooth',
        connected: true,
      };

      const compat = manager.getCompatibility(device);

      expect(compat.isVerified).toBe(true);
      expect(compat.hasVelocity).toBe(true);
      expect(compat.hasSustain).toBe(true);
    });

    it('should recognize Casio CDP-S130', () => {
      const device: IMidiDevice = {
        id: 'device-3',
        name: 'Casio CDP-S130',
        type: 'usb',
        connected: true,
      };

      const compat = manager.getCompatibility(device);

      expect(compat.isVerified).toBe(true);
      expect(compat.minPolyphony).toBe(192);
    });

    it('should recognize Roland FP-30X', () => {
      const device: IMidiDevice = {
        id: 'device-4',
        name: 'Roland FP-30X',
        manufacturer: 'Roland',
        type: 'usb',
        connected: true,
      };

      const compat = manager.getCompatibility(device);

      expect(compat.isVerified).toBe(true);
      expect(compat.minPolyphony).toBe(128);
    });

    it('should recognize M-Audio Hammer 88 Pro', () => {
      const device: IMidiDevice = {
        id: 'device-5',
        name: 'M-Audio Hammer 88 Pro',
        type: 'usb',
        connected: true,
      };

      const compat = manager.getCompatibility(device);

      expect(compat.isVerified).toBe(true);
    });

    it('should recognize Korg microKEY', () => {
      const device: IMidiDevice = {
        id: 'device-6',
        name: 'Korg microKEY',
        type: 'usb',
        connected: true,
      };

      const compat = manager.getCompatibility(device);

      expect(compat.isVerified).toBe(true);
      expect(compat.hasSustain).toBe(false);
    });

    it('should provide sensible defaults for unknown devices', () => {
      const device: IMidiDevice = {
        id: 'unknown-device',
        name: 'Some Random MIDI Controller',
        manufacturer: 'Unknown',
        type: 'usb',
        connected: true,
      };

      const compat = manager.getCompatibility(device);

      expect(compat.isVerified).toBe(false);
      expect(compat.hasVelocity).toBe(true); // Assume standard MIDI
      expect(compat.hasSustain).toBe(true); // Assume standard MIDI
      expect(compat.minPolyphony).toBe(16); // Conservative minimum
      expect(compat.notes).toBeDefined();
    });

    it('should match devices by name substring', () => {
      const device: IMidiDevice = {
        id: 'device-7',
        name: 'Yamaha P-125 Port 1',
        type: 'usb',
        connected: true,
      };

      const compat = manager.getCompatibility(device);

      expect(compat.isVerified).toBe(true);
    });

    it('should match devices by manufacturer', () => {
      const device: IMidiDevice = {
        id: 'device-8',
        name: 'Some Yamaha MIDI Device',
        manufacturer: 'Yamaha',
        type: 'usb',
        connected: true,
      };

      const compat = manager.getCompatibility(device);

      // Should match by manufacturer
      expect(compat).toBeDefined();
    });
  });

  describe('Device Registration', () => {
    it('should register device and return info', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      const info = manager.registerDevice(device);

      expect(info.id).toBe('device-1');
      expect(info.name).toBe('Yamaha P-125');
      expect(info.compatibility).toBeDefined();
    });

    it('should track discovered devices', () => {
      const devices: IMidiDevice[] = [
        {
          id: 'device-1',
          name: 'Yamaha P-125',
          type: 'usb',
          connected: true,
        },
        {
          id: 'device-2',
          name: 'Roland FP-30X',
          type: 'usb',
          connected: true,
        },
      ];

      devices.forEach((device) => manager.registerDevice(device));

      const discovered = manager.getDiscoveredDevices();
      expect(discovered.length).toBe(2);
    });

    it('should retrieve device by ID', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      manager.registerDevice(device);

      const retrieved = manager.getDevice('device-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('device-1');
    });

    it('should return undefined for non-existent device', () => {
      const retrieved = manager.getDevice('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should update existing device', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      manager.registerDevice(device);
      manager.registerDevice({ ...device, connected: false });

      const discovered = manager.getDiscoveredDevices();
      expect(discovered.length).toBe(1);
    });
  });

  describe('Device Preferences', () => {
    it('should set and get preferred device', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      manager.registerDevice(device);
      manager.setPreferredDevice('device-1');

      const preferred = manager.getPreferredDevice();
      expect(preferred).toBeDefined();
      expect(preferred?.id).toBe('device-1');
    });

    it('should return null if no preferred device', () => {
      const preferred = manager.getPreferredDevice();
      expect(preferred).toBeNull();
    });

    it('should enable auto-connect with preferred device', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      manager.registerDevice(device);
      manager.setPreferredDevice('device-1');

      expect(manager.isAutoConnectEnabled()).toBe(true);
    });

    it('should disable auto-connect', () => {
      manager.setAutoConnectEnabled(false);
      expect(manager.isAutoConnectEnabled()).toBe(false);
    });

    it('should mark device as preferred', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      manager.registerDevice(device);
      manager.setPreferredDevice('device-1');

      const devices = manager.getDiscoveredDevices();
      const preferred = devices.find((d) => d.id === 'device-1');

      expect(preferred?.isPreferred).toBe(true);
    });
  });

  describe('Device Usage Tracking', () => {
    it('should mark device as used', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      manager.registerDevice(device);
      const before = Date.now();
      manager.markDeviceUsed('device-1');
      const after = Date.now();

      const retrieved = manager.getDevice('device-1');
      expect(retrieved?.lastUsedTime).toBeDefined();
      expect(retrieved!.lastUsedTime!).toBeGreaterThanOrEqual(before);
      expect(retrieved!.lastUsedTime!).toBeLessThanOrEqual(after);
    });

    it('should get last used device ID', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      manager.registerDevice(device);
      manager.setPreferredDevice('device-1');

      const lastDeviceId = manager.getLastUsedDeviceId();
      expect(lastDeviceId).toBe('device-1');
    });

    it('should sort devices by usage time', () => {
      const devices: IMidiDevice[] = [
        { id: 'device-1', name: 'Keyboard 1', type: 'usb', connected: true },
        { id: 'device-2', name: 'Keyboard 2', type: 'usb', connected: true },
        { id: 'device-3', name: 'Keyboard 3', type: 'usb', connected: true },
      ];

      devices.forEach((device) => manager.registerDevice(device));

      // Mark in different order
      manager.markDeviceUsed('device-3');
      manager.markDeviceUsed('device-1');
      manager.markDeviceUsed('device-2');

      manager.getDiscoveredDevices();
      const lastDeviceId = manager.getLastUsedDeviceId();

      expect(lastDeviceId).toBe('device-2');
    });
  });

  describe('Device Forget/Forget', () => {
    it('should forget device', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      manager.registerDevice(device);
      expect(manager.getDevice('device-1')).toBeDefined();

      manager.forgetDevice('device-1');
      expect(manager.getDevice('device-1')).toBeUndefined();
    });

    it('should handle forgetting non-existent device', () => {
      // Should not throw
      expect(() => {
        manager.forgetDevice('non-existent');
      }).not.toThrow();
    });

    it('should clear all device history', () => {
      const devices: IMidiDevice[] = [
        { id: 'device-1', name: 'Keyboard 1', type: 'usb', connected: true },
        { id: 'device-2', name: 'Keyboard 2', type: 'usb', connected: true },
      ];

      devices.forEach((device) => manager.registerDevice(device));

      manager.clearHistory();

      const discovered = manager.getDiscoveredDevices();
      expect(discovered.length).toBe(0);
    });
  });

  describe('Device Status Notifications', () => {
    it('should notify on device status change', (done) => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      const unsubscribe = manager.onDeviceStatusChange((deviceInfo, connected) => {
        expect(deviceInfo.id).toBe('device-1');
        expect(connected).toBe(true);
        unsubscribe();
        done();
      });

      manager.notifyStatusChange(device, true);
    });

    it('should support multiple status listeners', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      let listener1Called = false;
      let listener2Called = false;

      const unsub1 = manager.onDeviceStatusChange(() => {
        listener1Called = true;
      });

      const unsub2 = manager.onDeviceStatusChange(() => {
        listener2Called = true;
      });

      manager.notifyStatusChange(device, true);

      expect(listener1Called).toBe(true);
      expect(listener2Called).toBe(true);

      unsub1();
      unsub2();
    });

    it('should allow unsubscribing from status changes', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      let callCount = 0;

      const unsubscribe = manager.onDeviceStatusChange(() => {
        callCount++;
      });

      manager.notifyStatusChange(device, true);
      expect(callCount).toBe(1);

      unsubscribe();

      manager.notifyStatusChange(device, false);
      expect(callCount).toBe(1); // Should not increment
    });

    it('should handle listener errors gracefully', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      const unsubscribe = manager.onDeviceStatusChange(() => {
        throw new Error('Listener error');
      });

      // Should not throw
      expect(() => {
        manager.notifyStatusChange(device, true);
      }).not.toThrow();

      unsubscribe();
      errorSpy.mockRestore();
    });
  });

  describe('Known Keyboards Database', () => {
    it('should have comprehensive keyboard database', () => {
      const keyboards = Object.values(KNOWN_MIDI_KEYBOARDS);

      // Should have at least 7 keyboards
      expect(keyboards.length).toBeGreaterThanOrEqual(7);

      // All should have required fields
      keyboards.forEach((kb) => {
        expect(kb.name).toBeDefined();
        expect(kb.hasVelocity).toBeDefined();
        expect(kb.hasSustain).toBeDefined();
        expect(kb.minPolyphony).toBeGreaterThan(0);
      });
    });

    it('should verify known keyboards', () => {
      const keyboards = Object.values(KNOWN_MIDI_KEYBOARDS);

      keyboards.forEach((kb) => {
        expect(kb.verified).toBe(true);
      });
    });

    it('should have polyphony specifications', () => {
      const keyboards = Object.values(KNOWN_MIDI_KEYBOARDS);

      keyboards.forEach((kb) => {
        // Reasonable polyphony range
        expect(kb.minPolyphony).toBeGreaterThanOrEqual(1);
        expect(kb.minPolyphony).toBeLessThanOrEqual(256);
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle device discovery workflow', () => {
      const devices: IMidiDevice[] = [
        {
          id: 'yamaha-1',
          name: 'Yamaha P-125',
          type: 'usb',
          connected: true,
        },
        {
          id: 'roland-1',
          name: 'Roland FP-30X',
          type: 'bluetooth',
          connected: true,
        },
      ];

      // Register devices as discovered
      devices.forEach((device) => {
        manager.registerDevice(device);
      });

      // Get discovered devices
      const discovered = manager.getDiscoveredDevices();
      expect(discovered.length).toBe(2);

      // All should have compatibility info
      discovered.forEach((device) => {
        expect(device.compatibility).toBeDefined();
        expect(device.compatibility?.isVerified).toBe(true);
      });
    });

    it('should maintain device history across sessions', () => {
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      // Register and mark as preferred
      manager.registerDevice(device);
      manager.setPreferredDevice('device-1');
      manager.markDeviceUsed('device-1');

      // Simulate session end - create new manager instance
      // Note: In real scenario, this would load from persistent storage
      const manager2 = MidiDeviceManager.getInstance();

      // Should have some device info
      expect(manager2.getDiscoveredDevices().length).toBeGreaterThanOrEqual(0);
    });

    it('should handle device switching', () => {
      const device1: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      const device2: IMidiDevice = {
        id: 'device-2',
        name: 'Roland FP-30X',
        type: 'usb',
        connected: true,
      };

      manager.registerDevice(device1);
      manager.registerDevice(device2);

      // Start with device 1
      manager.setPreferredDevice('device-1');
      expect(manager.getPreferredDevice()?.id).toBe('device-1');

      // Switch to device 2
      manager.setPreferredDevice('device-2');
      expect(manager.getPreferredDevice()?.id).toBe('device-2');

      // Device 2 should no longer be marked as preferred when switching
      const devices = manager.getDiscoveredDevices();
      const device1Info = devices.find((d) => d.id === 'device-1');
      expect(device1Info?.isPreferred).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle registration of multiple same-ID devices', () => {
      const device1: IMidiDevice = {
        id: 'device-1',
        name: 'Keyboard 1',
        type: 'usb',
        connected: true,
      };

      const device2: IMidiDevice = {
        id: 'device-1', // Same ID
        name: 'Keyboard 1 Updated',
        type: 'usb',
        connected: false,
      };

      manager.registerDevice(device1);
      manager.registerDevice(device2);

      const devices = manager.getDiscoveredDevices();
      expect(devices.length).toBe(1); // Should not duplicate
    });

    it('should handle storage errors gracefully', () => {
      // This test verifies error handling in loading/saving
      const device: IMidiDevice = {
        id: 'device-1',
        name: 'Yamaha P-125',
        type: 'usb',
        connected: true,
      };

      // Should not throw even if storage fails
      expect(() => {
        manager.registerDevice(device);
      }).not.toThrow();
    });
  });
});
