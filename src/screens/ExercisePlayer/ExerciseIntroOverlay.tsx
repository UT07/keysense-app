/**
 * Exercise Intro Overlay
 *
 * Shows exercise objectives and key info before gameplay starts.
 * Displays title, description, tempo, key signature, and a fun fact.
 * User taps "Ready" to dismiss and begin the exercise.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { Exercise } from '@/core/exercises/types';
import { coachingService } from '@/services/ai/CoachingService';
import { useLearnerProfileStore } from '@/stores/learnerProfileStore';
import { COLORS, BORDER_RADIUS, SPACING, glowColor } from '@/theme/tokens';

interface ExerciseIntroOverlayProps {
  exercise: Exercise;
  onReady: () => void;
  /** Shows a "Watch First" button to preview the exercise at slow speed */
  onWatchFirst?: () => void;
  skillTarget?: string;
  testID?: string;
}

export function ExerciseIntroOverlay({
  exercise,
  onReady,
  onWatchFirst,
  skillTarget,
  testID,
}: ExerciseIntroOverlayProps): React.ReactElement {
  const { title, description, difficulty } = exercise.metadata;
  const { tempo, keySignature, timeSignature } = exercise.settings;
  const difficultyStars = '★'.repeat(difficulty) + '☆'.repeat(5 - difficulty);
  const hasLeft = exercise.notes.some(n => n.hand === 'left');
  const hasRight = exercise.notes.some(n => n.hand === 'right');
  const hand = hasLeft && hasRight
    ? 'Both hands'
    : hasLeft
      ? 'Left hand'
      : hasRight
        ? 'Right hand'
        : 'Both hands';
  const noteCount = exercise.notes.length;

  // AI coaching tip (async, shows static hint while loading)
  const [coachTip, setCoachTip] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const weakNotes = useLearnerProfileStore.getState().weakNotes;
    coachingService.generatePreExerciseTip(title, weakNotes).then((tip) => {
      if (!cancelled) setCoachTip(tip);
    });
    return () => { cancelled = true; };
  }, [title]);

  return (
    <View style={styles.overlay} testID={testID}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {skillTarget && (
          <View style={styles.skillBadge}>
            <Text style={styles.skillBadgeLabel}>SKILL</Text>
            <Text style={styles.skillBadgeText}>{skillTarget}</Text>
          </View>
        )}
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

        {(exercise.hints?.beforeStart || coachTip) && (
          <View style={styles.tipBox}>
            {exercise.hints?.beforeStart && (
              <Text style={styles.tipText}>{exercise.hints.beforeStart}</Text>
            )}
            {coachTip && coachTip !== exercise.hints?.beforeStart && (
              <Text style={styles.coachTipText}>{coachTip}</Text>
            )}
          </View>
        )}

        <View style={styles.buttonRow}>
          {onWatchFirst && (
            <TouchableOpacity
              style={styles.watchButton}
              onPress={() => { onWatchFirst(); }}
              testID={testID ? `${testID}-watch` : 'intro-watch'}
              activeOpacity={0.8}
            >
              <Text style={styles.watchButtonText}>Watch First</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.readyButton, onWatchFirst ? styles.readyButtonWithWatch : null]}
            onPress={onReady}
            testID={testID ? `${testID}-ready` : 'intro-ready'}
            activeOpacity={0.8}
          >
            <Text style={styles.readyButtonText}>Ready</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surfaceOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  skillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: glowColor(COLORS.primary, 0.12),
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: SPACING.sm,
  },
  skillBadgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  skillBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
    backgroundColor: COLORS.cardHighlight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 72,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  statText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  tipBox: {
    backgroundColor: glowColor(COLORS.primary, 0.1),
    borderRadius: 10,
    padding: SPACING.sm + 4,
    marginBottom: 20,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    width: '100%',
  },
  tipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  coachTipText: {
    fontSize: 13,
    color: COLORS.primaryLight,
    lineHeight: 18,
    marginTop: 6,
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  watchButton: {
    flex: 1,
    backgroundColor: COLORS.cardHighlight,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  watchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  readyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: '100%',
    alignItems: 'center',
  },
  readyButtonWithWatch: {
    flex: 1,
    width: undefined,
    paddingHorizontal: 20,
  },
  readyButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
});
