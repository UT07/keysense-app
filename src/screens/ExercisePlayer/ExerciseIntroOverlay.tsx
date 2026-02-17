/**
 * Exercise Intro Overlay
 *
 * Shows exercise objectives and key info before gameplay starts.
 * Displays title, description, tempo, key signature, and a fun fact.
 * User taps "Ready" to dismiss and begin the exercise.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Exercise } from '@/core/exercises/types';
import { COLORS } from '@/theme/tokens';

interface ExerciseIntroOverlayProps {
  exercise: Exercise;
  onReady: () => void;
  testID?: string;
}

export function ExerciseIntroOverlay({
  exercise,
  onReady,
  testID,
}: ExerciseIntroOverlayProps): React.ReactElement {
  const { title, description, difficulty } = exercise.metadata;
  const { tempo, keySignature, timeSignature } = exercise.settings;
  const difficultyStars = '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
  const hand = exercise.notes.some(n => n.hand === 'left') && exercise.notes.some(n => n.hand === 'right')
    ? 'Both hands'
    : exercise.notes.some(n => n.hand === 'left')
      ? 'Left hand'
      : 'Right hand';
  const noteCount = exercise.notes.length;

  return (
    <View style={styles.overlay} testID={testID}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Tempo</Text>
            <Text style={styles.infoValue}>{tempo} BPM</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Key</Text>
            <Text style={styles.infoValue}>{keySignature}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>{timeSignature[0]}/{timeSignature[1]}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Hand</Text>
            <Text style={styles.infoValue}>{hand}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.statText}>{noteCount} notes</Text>
          <Text style={styles.statText}>{difficultyStars}</Text>
        </View>

        {exercise.hints?.beforeStart && (
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>{exercise.hints.beforeStart}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.readyButton}
          onPress={onReady}
          testID={testID ? `${testID}-ready` : 'intro-ready'}
          activeOpacity={0.8}
        >
          <Text style={styles.readyButtonText}>Ready</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  infoItem: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 72,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  statText: {
    fontSize: 13,
    color: '#888',
  },
  tipBox: {
    backgroundColor: 'rgba(220, 20, 60, 0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    width: '100%',
  },
  tipText: {
    fontSize: 13,
    color: '#CCC',
    lineHeight: 18,
  },
  readyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  readyButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});
