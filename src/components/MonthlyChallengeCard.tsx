/**
 * MonthlyChallengeCard Component
 * Prominent card shown on HomeScreen when the monthly challenge is active.
 * Multi-exercise challenge (3-5 exercises within 48h window).
 * Shows progress bar and countdown.
 */

import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getMonthlyChallengeForMonth,
  isMonthlyChallengeActive,
} from '../core/challenges/challengeSystem';
import { COLORS, SPACING, BORDER_RADIUS } from '../theme/tokens';

function getCurrentMonthISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatCountdown(endTime: number): string {
  const remaining = Math.max(0, endTime - Date.now());
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  return `${hours}h ${minutes}m left`;
}

interface MonthlyChallengeCardProps {
  onPress: () => void;
  exercisesCompletedToday: number;
  completed?: boolean;
}

export function MonthlyChallengeCard({
  onPress,
  exercisesCompletedToday,
  completed,
}: MonthlyChallengeCardProps): React.ReactElement | null {
  const monthISO = useMemo(() => getCurrentMonthISO(), []);
  const isActive = useMemo(() => isMonthlyChallengeActive(monthISO), [monthISO]);
  const challenge = useMemo(() => getMonthlyChallengeForMonth(monthISO), [monthISO]);

  // Countdown timer
  const endTime = useMemo(() => {
    const year = parseInt(monthISO.split('-')[0], 10);
    const month = parseInt(monthISO.split('-')[1], 10) - 1;
    const startDate = new Date(year, month, challenge.challengeDay, 0, 0, 0);
    return startDate.getTime() + challenge.durationHours * 3600000;
  }, [monthISO, challenge]);

  const [countdown, setCountdown] = useState(formatCountdown(endTime));

  useEffect(() => {
    if (!isActive || completed) return;
    const interval = setInterval(() => {
      setCountdown(formatCountdown(endTime));
    }, 60000);
    return () => clearInterval(interval);
  }, [isActive, completed, endTime]);

  if (!isActive) return null;

  const progress = Math.min(exercisesCompletedToday, challenge.exercisesRequired);
  const progressPct = (progress / challenge.exercisesRequired) * 100;

  return (
    <View style={styles.card}>
      <View style={styles.cardInner}>
        {/* Header */}
        <View style={styles.topRow}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="calendar-star" size={22} color="#E040FB" />
            <Text style={styles.title}>Monthly Challenge</Text>
          </View>
          <View style={styles.rewardBadge}>
            <MaterialCommunityIcons name="diamond-stone" size={14} color={COLORS.gemGold} />
            <Text style={styles.rewardText}>{challenge.reward.gems}</Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.description}>{challenge.description}</Text>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {progress}/{challenge.exercisesRequired}
          </Text>
        </View>

        {/* Bottom row */}
        <View style={styles.bottomRow}>
          <View style={styles.timerRow}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.timerText}>{countdown}</Text>
          </View>

          {completed ? (
            <View style={styles.completedBadge}>
              <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.success} />
              <Text style={styles.completedText}>Claimed!</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.playButton} onPress={onPress} activeOpacity={0.7}>
              <Text style={styles.playButtonText}>
                {progress >= challenge.exercisesRequired ? 'Claim Reward' : 'Play Now'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: '#E040FB',
    overflow: 'hidden',
  },
  cardInner: {
    backgroundColor: '#1A101A',
    padding: SPACING.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#E040FB',
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(224, 64, 251, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(224, 64, 251, 0.3)',
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.gemGold,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    backgroundColor: 'rgba(224, 64, 251, 0.15)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E040FB',
    borderRadius: 5,
    minWidth: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E040FB',
    minWidth: 30,
    textAlign: 'right',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  playButton: {
    backgroundColor: '#E040FB',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
});
