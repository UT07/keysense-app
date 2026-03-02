/**
 * MIDI Setup Wizard Screen
 * User-friendly flow for connecting MIDI keyboards
 *
 * Flow:
 * 1. Welcome & Instructions
 * 2. Device Detection
 * 3. Device Selection
 * 4. Verification Test
 * 5. Confirmation & Save
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMidiInput } from '../input/MidiInput';
import MidiDeviceManager from '../input/MidiDevice';
import type { MidiDevice } from '../input/MidiInput';
import type { MidiNoteEvent } from '../core/exercises/types';
import { logger } from '../utils/logger';

/**
 * Setup Step Type
 */
type SetupStep = 'welcome' | 'detecting' | 'select' | 'verify' | 'success';

interface MidiSetupScreenProps {
  onComplete?: (deviceId: string) => void;
  onCancel?: () => void;
}

/**
 * MIDI Setup Screen Component
 */
export const MidiSetupScreen: React.FC<MidiSetupScreenProps> = ({
  onComplete,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<SetupStep>('welcome');
  const [availableDevices, setAvailableDevices] = useState<MidiDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<MidiDevice | null>(null);
  const [_isDetecting, setIsDetecting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<
    'pending' | 'testing' | 'success' | 'failed'
  >('pending');
  const [testNoteDetected, setTestNoteDetected] = useState(false);

  /**
   * Initialize MIDI system on mount
   */
  useEffect(() => {
    const initMidi = async () => {
      try {
        await getMidiInput().initialize();
        logger.log('[MidiSetupScreen] MIDI initialized');
      } catch (error) {
        console.error('[MidiSetupScreen] MIDI init failed:', error);
        Alert.alert('Error', 'Failed to initialize MIDI. Please check your device.');
      }
    };

    initMidi();
  }, []);

  /**
   * Start device detection
   */
  const startDetection = async () => {
    setIsDetecting(true);
    setStep('detecting');

    try {
      // Get currently connected devices
      const devices = await getMidiInput().getConnectedDevices();
      setAvailableDevices(devices);

      if (devices.length === 0) {
        Alert.alert(
          'No Devices Found',
          'Please connect a MIDI keyboard and try again.\n\n' +
            'iOS: Use Apple Camera Connection Kit\n' +
            'Android: Use USB OTG adapter or Bluetooth'
        );
        setStep('welcome');
      } else if (devices.length === 1) {
        // Auto-select single device
        setSelectedDevice(devices[0]);
        setStep('verify');
      } else {
        // Let user choose
        setStep('select');
      }
    } catch (error) {
      console.error('[MidiSetupScreen] Detection failed:', error);
      Alert.alert('Detection Failed', 'Could not access MIDI devices. Try again?');
      setStep('welcome');
    } finally {
      setIsDetecting(false);
    }
  };

  /**
   * Test selected device by waiting for a note
   */
  const startVerification = async () => {
    if (!selectedDevice) return;

    setVerificationStatus('testing');
    setTestNoteDetected(false);

    // Listen for note
    const timer = setTimeout(() => {
      setVerificationStatus('failed');
      unsubscribe();
    }, 15000); // 15 second timeout — first-time users need time to read instructions

    const unsubscribe = getMidiInput().onNoteEvent((event: MidiNoteEvent) => {
      if (event.type === 'noteOn' && event.velocity > 0) {
        clearTimeout(timer);
        setTestNoteDetected(true);
        setVerificationStatus('success');
        unsubscribe();
      }
    });
  };

  /**
   * Handle verification success
   */
  const handleVerificationSuccess = () => {
    if (selectedDevice) {
      // Save device preference
      MidiDeviceManager.registerDevice(selectedDevice);
      MidiDeviceManager.setPreferredDevice(selectedDevice.id);
      MidiDeviceManager.setAutoConnectEnabled(true);

      setStep('success');

      // Call completion callback
      setTimeout(() => {
        onComplete?.(selectedDevice.id);
      }, 1500);
    }
  };

  /**
   * Handle verification retry
   */
  const handleVerificationRetry = () => {
    setVerificationStatus('pending');
    setTestNoteDetected(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f5f5f5' }}
      contentContainerStyle={{ paddingTop: insets.top }}
      testID="midi-setup-screen"
    >
      <View style={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
        {/* Header */}
        <View style={{ marginBottom: 30 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 8 }}>
            Connect Your MIDI Keyboard
          </Text>
          <Text style={{ fontSize: 14, color: '#666' }}>
            {step === 'welcome' && 'Follow these steps to set up your MIDI keyboard'}
            {step === 'detecting' && 'Searching for devices...'}
            {step === 'select' && 'Choose your keyboard'}
            {step === 'verify' && 'Testing connection'}
            {step === 'success' && '✓ Ready to play!'}
          </Text>
        </View>

        {/* Welcome Step */}
        {step === 'welcome' && <WelcomeStep onStart={startDetection} onCancel={onCancel} />}

        {/* Detecting Step */}
        {step === 'detecting' && <DetectingStep />}

        {/* Select Step */}
        {step === 'select' && (
          <SelectStep
            devices={availableDevices}
            selectedDevice={selectedDevice}
            onSelect={(device) => {
              setSelectedDevice(device);
              setStep('verify');
            }}
            onBack={() => setStep('welcome')}
          />
        )}

        {/* Verify Step */}
        {step === 'verify' && selectedDevice && (
          <VerifyStep
            device={selectedDevice}
            status={verificationStatus}
            noteDetected={testNoteDetected}
            onStart={startVerification}
            onRetry={handleVerificationRetry}
            onSuccess={handleVerificationSuccess}
            onBack={() => setStep(availableDevices.length > 1 ? 'select' : 'welcome')}
          />
        )}

        {/* Success Step */}
        {step === 'success' && selectedDevice && <SuccessStep device={selectedDevice} />}
      </View>
    </ScrollView>
  );
};

/**
 * Welcome Step Component
 */
const WelcomeStep: React.FC<{
  onStart: () => void;
  onCancel?: () => void;
}> = ({ onStart, onCancel }) => {
  const instructions =
    Platform.OS === 'ios'
      ? [
          'Connect your MIDI keyboard to your iPad using the Apple Camera Connection Kit (Lightning or USB-C)',
          'Power on the MIDI keyboard',
          'Tap "Connect" below',
        ]
      : [
          'Connect your MIDI keyboard using USB OTG adapter, or pair via Bluetooth',
          'Power on the MIDI keyboard',
          'Tap "Connect" below',
        ];

  return (
    <View>
      {/* Instructions */}
      <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 12 }}>
          📋 Setup Instructions
        </Text>
        {instructions.map((instruction, index) => (
          <View key={index} style={{ flexDirection: 'row', marginBottom: index < instructions.length - 1 ? 12 : 0 }}>
            <Text style={{ fontSize: 14, color: '#333', marginRight: 12, fontWeight: '600' }}>
              {index + 1}.
            </Text>
            <Text style={{ flex: 1, fontSize: 14, color: '#333', lineHeight: 20 }}>
              {instruction}
            </Text>
          </View>
        ))}
      </View>

      {/* Supported Devices */}
      <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 12 }}>
          ✓ Supported Keyboards
        </Text>
        <Text style={{ fontSize: 13, color: '#666', lineHeight: 20 }}>
          Yamaha P-125/225, Roland FP-30X, Casio CDP-S130, M-Audio Hammer 88, Korg microKEY, Alesis Q88, and most class-compliant USB MIDI keyboards
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={{ gap: 12 }}>
        <TouchableOpacity
          onPress={onStart}
          style={{
            backgroundColor: '#007AFF',
            borderRadius: 8,
            paddingVertical: 16,
            alignItems: 'center',
          }}
          testID="midi-search-devices"
        >
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
            🔍 Search for Devices
          </Text>
        </TouchableOpacity>

        {onCancel && (
          <TouchableOpacity
            onPress={onCancel}
            style={{
              backgroundColor: '#f0f0f0',
              borderRadius: 8,
              paddingVertical: 16,
              alignItems: 'center',
            }}
            testID="midi-cancel"
          >
            <Text style={{ color: '#333', fontSize: 16, fontWeight: '600' }}>
              Cancel
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/**
 * Detecting Step Component
 */
const DetectingStep: React.FC = () => {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
        Scanning for MIDI devices...
      </Text>
      <Text style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
        Make sure your keyboard is connected and powered on
      </Text>
    </View>
  );
};

/**
 * Select Step Component
 */
const SelectStep: React.FC<{
  devices: MidiDevice[];
  selectedDevice: MidiDevice | null;
  onSelect: (device: MidiDevice) => void;
  onBack: () => void;
}> = ({ devices, selectedDevice, onSelect, onBack }) => {
  return (
    <View>
      <View style={{ marginBottom: 24 }}>
        {devices.map((device) => (
          <TouchableOpacity
            key={device.id}
            onPress={() => onSelect(device)}
            style={{
              backgroundColor: selectedDevice?.id === device.id ? '#E3F2FD' : 'white',
              borderRadius: 8,
              padding: 16,
              marginBottom: 8,
              borderWidth: selectedDevice?.id === device.id ? 2 : 1,
              borderColor: selectedDevice?.id === device.id ? '#007AFF' : '#ddd',
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
              {device.name}
            </Text>
            <Text style={{ fontSize: 12, color: '#666' }}>
              {device.manufacturer} • {device.type.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={onBack}
        style={{
          backgroundColor: '#f0f0f0',
          borderRadius: 8,
          paddingVertical: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#333', fontSize: 14, fontWeight: '600' }}>
          ← Back
        </Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Verify Step Component
 */
const VerifyStep: React.FC<{
  device: MidiDevice;
  status: 'pending' | 'testing' | 'success' | 'failed';
  noteDetected: boolean;
  onStart: () => void;
  onRetry: () => void;
  onSuccess: () => void;
  onBack: () => void;
}> = ({ device, status, noteDetected, onStart, onRetry, onSuccess, onBack }) => {
  return (
    <View>
      {/* Device Info */}
      <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
          {device.name}
        </Text>
        <Text style={{ fontSize: 12, color: '#666' }}>
          {device.manufacturer} • {device.type.toUpperCase()}
        </Text>
      </View>

      {/* Testing Area */}
      <View style={{ backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 24, alignItems: 'center' }}>
        {status === 'pending' && (
          <>
            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 16 }}>
              🎹 Play a note on your keyboard
            </Text>
            <Text style={{ fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 20 }}>
              Press any key and we'll detect it to verify the connection works
            </Text>
          </>
        )}

        {status === 'testing' && (
          <>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
              Listening for notes...
            </Text>
          </>
        )}

        {status === 'success' && (
          <>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>✓</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#4CAF50' }}>
              Connection Successful!
            </Text>
            <Text style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
              Detected: {noteDetected ? 'Note received ✓' : 'Waiting for note'}
            </Text>
          </>
        )}

        {status === 'failed' && (
          <>
            <Text style={{ fontSize: 28, marginBottom: 8 }}>✗</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#FF5252' }}>
              No notes detected
            </Text>
            <Text style={{ fontSize: 12, color: '#666', marginTop: 8, textAlign: 'center' }}>
              Make sure the keyboard is connected and powered on
            </Text>
          </>
        )}
      </View>

      {/* Action Buttons */}
      <View style={{ gap: 12 }}>
        {status === 'pending' && (
          <TouchableOpacity
            onPress={onStart}
            style={{
              backgroundColor: '#007AFF',
              borderRadius: 8,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
              Start Test
            </Text>
          </TouchableOpacity>
        )}

        {status === 'success' && (
          <TouchableOpacity
            onPress={onSuccess}
            style={{
              backgroundColor: '#4CAF50',
              borderRadius: 8,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
              Confirm & Continue
            </Text>
          </TouchableOpacity>
        )}

        {status === 'failed' && (
          <TouchableOpacity
            onPress={onRetry}
            style={{
              backgroundColor: '#FF9800',
              borderRadius: 8,
              paddingVertical: 16,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
              Try Again
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onBack}
          style={{
            backgroundColor: '#f0f0f0',
            borderRadius: 8,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#333', fontSize: 14, fontWeight: '600' }}>
            ← Back
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * Success Step Component
 */
const SuccessStep: React.FC<{ device: MidiDevice }> = ({ device }) => {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🎉</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
        All Set!
      </Text>
      <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 }}>
        Your {device.name} is ready to use
      </Text>
      <Text style={{ fontSize: 12, color: '#999' }}>
        Redirecting to lessons...
      </Text>
    </View>
  );
};

export default MidiSetupScreen;
