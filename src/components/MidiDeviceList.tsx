/**
 * MIDI Device List Component
 * Displays connected MIDI devices with status and actions
 *
 * Used in:
 * - Settings screen (view connected devices)
 * - Setup wizard (select device)
 * - Device manager (manage preferences)
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { getMidiInput } from '../input/MidiInput';
import MidiDeviceManager from '../input/MidiDevice';
import type { MidiInputState } from '../input/MidiInput';
import type { MidiDeviceInfo } from '../input/MidiDevice';

interface MidiDeviceListProps {
  /**
   * Called when a device is selected
   */
  onSelectDevice?: (device: MidiDeviceInfo) => void;

  /**
   * Called when preferred device changes
   */
  onPreferredDeviceChange?: (deviceId: string) => void;

  /**
   * Show device status indicator
   */
  showStatus?: boolean;

  /**
   * Show compatibility info
   */
  showCompatibility?: boolean;

  /**
   * Allow device selection
   */
  selectable?: boolean;

  /**
   * Allow device forget/remove
   */
  allowForget?: boolean;

  /**
   * Show loading state while scanning
   */
  isScanning?: boolean;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    paddingVertical: 8,
  },
  deviceItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  deviceItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  deviceItemConnected: {
    borderColor: '#4CAF50',
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  statusBadgeConnected: {
    backgroundColor: '#C8E6C9',
  },
  statusBadgeDisconnected: {
    backgroundColor: '#FFCDD2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  statusTextConnected: {
    color: '#2E7D32',
  },
  statusTextDisconnected: {
    color: '#C62828',
  },
  deviceDetails: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginRight: 8,
    minWidth: 80,
  },
  detailValue: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  compatibilityRow: {
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  compatibilityLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    fontWeight: '600',
  },
  compatibilityFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  featureBadgeNo: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FFE0B2',
  },
  featureText: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: '500',
  },
  featureTextNo: {
    color: '#E65100',
  },
  deviceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  actionButtonPrimary: {
    backgroundColor: '#2196F3',
  },
  actionButtonDanger: {
    backgroundColor: '#FF5252',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  actionButtonTextLight: {
    color: 'white',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginVertical: 8,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  preferredBadge: {
    backgroundColor: '#FFF9C4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    marginLeft: 8,
  },
  preferredBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F57F17',
  },
});

/**
 * MIDI Device List Component
 */
export const MidiDeviceList: React.FC<MidiDeviceListProps> = ({
  onSelectDevice,
  onPreferredDeviceChange,
  showStatus = true,
  showCompatibility = true,
  selectable = false,
  allowForget = false,
  isScanning = false,
}) => {
  const [state, setState] = useState<MidiInputState | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<MidiDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [preferredDeviceId, setPreferredDeviceId] = useState<string | null>(null);

  const midiInput = getMidiInput();
  const deviceManager = MidiDeviceManager;

  // Initialize and listen for changes
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Get initial state
        setState(midiInput.getState());

        // Load discovered devices
        const discovered = deviceManager.getDiscoveredDevices();
        setDiscoveredDevices(discovered);

        // Get preferred device
        const preferred = deviceManager.getPreferredDevice();
        if (preferred) {
          setPreferredDeviceId(preferred.id);
        }
      } catch (error) {
        console.error('[MidiDeviceList] Error loading devices:', error);
      }
    };

    loadDevices();

    // Listen for device connection changes
    const unsubscribeConnection = midiInput.onDeviceConnection((device, connected) => {
      setState((prev) =>
        prev
          ? {
              ...prev,
              connectedDevices: connected
                ? [...(prev.connectedDevices || []), device]
                : (prev.connectedDevices || []).filter((d) => d.id !== device.id),
            }
          : null
      );

      // Update discovered devices
      const info = deviceManager.registerDevice(device);
      setDiscoveredDevices((prev) => {
        const index = prev.findIndex((d) => d.id === device.id);
        if (index >= 0) {
          prev[index] = info;
          return [...prev];
        }
        return [...prev, info];
      });
    });

    return () => {
      unsubscribeConnection();
    };
  }, []);

  const handleSelectDevice = (device: MidiDeviceInfo) => {
    if (selectable) {
      setSelectedDeviceId(device.id);
      onSelectDevice?.(device);
    }
  };

  const handleSetPreferred = (deviceId: string) => {
    deviceManager.setPreferredDevice(deviceId);
    setPreferredDeviceId(deviceId);
    onPreferredDeviceChange?.(deviceId);
  };

  const handleForgetDevice = (deviceId: string) => {
    deviceManager.forgetDevice(deviceId);
    setDiscoveredDevices((prev) => prev.filter((d) => d.id !== deviceId));
  };

  const isConnected = (deviceId: string): boolean => {
    return state?.connectedDevices?.some((d) => d.id === deviceId) ?? false;
  };

  const renderDevice = ({ item: device }: { item: MidiDeviceInfo }) => {
    const connected = isConnected(device.id);
    const isPreferred = preferredDeviceId === device.id;
    const isSelected = selectedDeviceId === device.id;

    return (
      <TouchableOpacity
        onPress={() => handleSelectDevice(device)}
        disabled={!selectable}
        activeOpacity={selectable ? 0.7 : 1}
      >
        <View
          style={[
            styles.deviceItem,
            isSelected && styles.deviceItemSelected,
            connected && !isSelected && styles.deviceItemConnected,
          ]}
        >
          {/* Header with name and status */}
          <View style={styles.deviceHeader}>
            <Text style={styles.deviceName} numberOfLines={1}>
              {device.name}
            </Text>
            {isPreferred && (
              <View style={styles.preferredBadge}>
                <Text style={styles.preferredBadgeText}>⭐ PREFERRED</Text>
              </View>
            )}
            {showStatus && (
              <View
                style={[
                  styles.statusBadge,
                  connected && styles.statusBadgeConnected,
                  !connected && styles.statusBadgeDisconnected,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    connected && styles.statusTextConnected,
                    !connected && styles.statusTextDisconnected,
                  ]}
                >
                  {connected ? '🟢 Connected' : '⚪ Offline'}
                </Text>
              </View>
            )}
          </View>

          {/* Device details */}
          <View style={styles.deviceDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Manufacturer:</Text>
              <Text style={styles.detailValue}>{device.manufacturer || 'Unknown'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Connection:</Text>
              <Text style={styles.detailValue}>{device.type.toUpperCase()}</Text>
            </View>
            {device.lastUsedTime && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Last Used:</Text>
                <Text style={styles.detailValue}>
                  {new Date(device.lastUsedTime).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>

          {/* Compatibility info */}
          {showCompatibility && device.compatibility && (
            <View style={styles.compatibilityRow}>
              <Text style={styles.compatibilityLabel}>
                {device.compatibility.isVerified ? '✓ Verified' : '⚠️ Untested'} Device
              </Text>
              <View style={styles.compatibilityFeatures}>
                <View style={[styles.featureBadge, device.compatibility.hasVelocity && { borderColor: '#C8E6C9' }]}>
                  <Text style={styles.featureText}>
                    {device.compatibility.hasVelocity ? '✓' : '✗'} Velocity
                  </Text>
                </View>
                <View style={[styles.featureBadge, device.compatibility.hasSustain && { borderColor: '#C8E6C9' }]}>
                  <Text style={styles.featureText}>
                    {device.compatibility.hasSustain ? '✓' : '✗'} Sustain
                  </Text>
                </View>
                <View style={styles.featureBadge}>
                  <Text style={styles.featureText}>
                    ↻ {device.compatibility.minPolyphony} notes
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Actions */}
          {!selectable && (connected || allowForget) && (
            <View style={styles.deviceActions}>
              {connected && !isPreferred && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonPrimary]}
                  onPress={() => handleSetPreferred(device.id)}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextLight]}>
                    Set as Default
                  </Text>
                </TouchableOpacity>
              )}
              {allowForget && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonDanger]}
                  onPress={() => handleForgetDevice(device.id)}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonTextLight]}>
                    Forget
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Loading state
  if (isScanning && discoveredDevices.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.emptyStateText}>Scanning for MIDI devices...</Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (discoveredDevices.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 24 }}>🎹</Text>
          <Text style={styles.emptyStateText}>No MIDI devices found</Text>
          <Text style={styles.emptyStateText}>
            Connect a USB MIDI keyboard or pair via Bluetooth to get started.
          </Text>
        </View>
      </View>
    );
  }

  // Device list
  return (
    <FlatList
      data={discoveredDevices}
      renderItem={renderDevice}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContainer}
      scrollEnabled={false}
    />
  );
};

export default MidiDeviceList;
