/**
 * WeeklyChallengeCard Component
 * Special gold/crimson card shown on the HomeScreen when the weekly bonus
 * challenge is active (one random day per week). Greater rewards than daily.
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getWeeklyChallengeForWeek,
  isWeeklyChallengeDay,
} from '../core/challenges/challengeSystem';
import { COLORS, SPACING, BORDER_RADIUS } from '../theme/tokens';

/** Get the Monday of the current week as ISO string */
function getMondayISO(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().split('T')[0];
}

interface WeeklyChallengeCardProps {
  onPress: () => void;
  completed?: boolean;
}

export function WeeklyChallengeCard({ onPress, completed }: WeeklyChallengeCardProps): React.ReactElement | null {
  const weekStart = useMemo(() => getMondayISO(), []);
  const isActiveToday = useMemo(() => isWeeklyChallengeDay(weekStart), [weekStart]);
  const challenge = useMemo(() => getWeeklyChallengeForWeek(weekStart), [weekStart]);

  // Only show on the designated challenge day
  if (!isActiveToday) return null;

  return (
    <View style={styles.card}>
      <View style={styles.cardInner}>
        {/* Gold accent stripe */}
        <View style={styles.accentStripe} />

        {/* Header row */}
        <View style={styles.topRow}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="crown" size={20} color="#FFD700" />
            <Text style={styles.title}>Weekly Bonus</Text>
          </View>
          <View style={styles.rewardBadge}>
            <MaterialCommunityIcons name="diamond-stone" size={14} color="#FFD700" />
            <Text style={styles.rewardText}>{challenge.reward.gems}</Text>
          </View>
        </View>

        {/* Challenge info */}
        <View style={styles.challengeRow}>
          <MaterialCommunityIcons name={challenge.icon as any} size={24} color={COLORS.textPrimary} />
          <View style={styles.challengeInfo}>
            <Text style={styles.challengeLabel}>{challenge.label}</Text>
            <Text style={styles.challengeDesc}>{challenge.description}</Text>
          </View>
        </View>

        {/* XP multiplier + action */}
        <View style={styles.bottomRow}>
          <View style={styles.xpBadge}>
            <Text style={styles.xpText}>{challenge.reward.xpMultiplier}x XP</Text>
          </View>

          {completed ? (
            <View style={styles.completedBadge}>
              <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.success} />
              <Text style={styles.completedText}>Done!</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.playButton} onPress={onPress} activeOpacity={0.7}>
              <Text style={styles.playButtonText}>Accept Challenge</Text>
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
    borderColor: '#FFD700',
    overflow: 'hidden',
  },
  cardInner: {
    backgroundColor: '#1A1410',
    padding: SPACING.md,
  },
  accentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#FFD700',
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
    color: '#FFD700',
  },
  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFD700',
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  challengeDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  xpText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFD700',
  },
  playButton: {
    backgroundColor: '#DC143C',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
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
