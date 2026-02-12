/**
 * PlayScreen - Free play mode with piano keyboard
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function PlayScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      setHasRecording(true);
    } else {
      setIsRecording(true);
    }
  };

  const playRecording = () => {
    // TODO: Implement playback
    console.log('Playing recording...');
  };

  const clearRecording = () => {
    setHasRecording(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Free Play</Text>
        <Text style={styles.subtitle}>Practice and explore freely</Text>
      </View>

      {/* Keyboard Placeholder */}
      <View style={styles.keyboardContainer}>
        <View style={styles.keyboardPlaceholder}>
          <MaterialCommunityIcons name="piano" size={64} color="#BDBDBD" />
          <Text style={styles.placeholderText}>Piano Keyboard</Text>
          <Text style={styles.placeholderSubtext}>
            Connect MIDI keyboard or use touch keyboard
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.controlButton,
            isRecording && styles.controlButtonActive,
          ]}
          onPress={toggleRecording}
        >
          <MaterialCommunityIcons
            name={isRecording ? 'stop-circle' : 'record-circle'}
            size={32}
            color={isRecording ? '#F44336' : '#1976D2'}
          />
          <Text style={styles.controlLabel}>
            {isRecording ? 'Stop' : 'Record'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            !hasRecording && styles.controlButtonDisabled,
          ]}
          onPress={playRecording}
          disabled={!hasRecording}
        >
          <MaterialCommunityIcons
            name="play-circle"
            size={32}
            color={hasRecording ? '#1976D2' : '#BDBDBD'}
          />
          <Text
            style={[
              styles.controlLabel,
              !hasRecording && styles.controlLabelDisabled,
            ]}
          >
            Play
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            !hasRecording && styles.controlButtonDisabled,
          ]}
          onPress={clearRecording}
          disabled={!hasRecording}
        >
          <MaterialCommunityIcons
            name="delete"
            size={32}
            color={hasRecording ? '#F44336' : '#BDBDBD'}
          />
          <Text
            style={[
              styles.controlLabel,
              !hasRecording && styles.controlLabelDisabled,
            ]}
          >
            Clear
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info Cards */}
      <View style={styles.infoContainer}>
        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="information" size={24} color="#1976D2" />
          <Text style={styles.infoText}>
            Connect a MIDI keyboard to get started, or use the on-screen
            keyboard for practice
          </Text>
        </View>

        <View style={styles.infoCard}>
          <MaterialCommunityIcons name="lightbulb" size={24} color="#FFC107" />
          <Text style={styles.infoText}>
            Try recording yourself and playing it back to hear your progress!
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  keyboardContainer: {
    flex: 1,
    padding: 20,
  },
  keyboardPlaceholder: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  controls: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  controlButtonActive: {
    backgroundColor: '#FFEBEE',
  },
  controlButtonDisabled: {
    opacity: 0.5,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  controlLabelDisabled: {
    color: '#999',
  },
  infoContainer: {
    padding: 20,
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
