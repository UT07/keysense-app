/**
 * DailyChallengeCard Component
 * Full-width card for the HomeScreen showing today's daily challenge
 * with gamification elements: animated gradient border, 2x XP badge,
 * countdown timer, and completion state.
 */

import { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCatEvolutionStore } from '../stores/catEvolutionStore';
import { getDailyChallengeForDate } from '../core/challenges/challengeSystem';
import { COLORS, SPACING, BORDER_RADIUS } from '../theme/tokens';

function formatTimeRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m left`;
}

function getTimeUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

interface DailyChallengeCardProps {
  onPress: () => void;
  masteredSkills?: string[];
}

export function DailyChallengeCard({ onPress, masteredSkills }: DailyChallengeCardProps): React.ReactElement | null {
  const dailyRewards = useCatEvolutionStore((s) => s.dailyRewards);
  const isDailyChallengeCompleted = useCatEvolutionStore((s) => s.isDailyChallengeCompleted);

  const today = new Date().toISOString().split('T')[0];

  // Check if the actual daily challenge condition was satisfied (not just any exercise)
  const challengeDone = isDailyChallengeCompleted();
  const isCompleted = challengeDone;
  const todayDayNum = (() => {
    const start = new Date(dailyRewards.weekStartDate + 'T00:00:00');
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / 86400000);
    if (diff < 0 || diff >= 7) return 0;
    return diff + 1;
  })();
  const todayReward = dailyRewards.days.find(d => d.day === todayDayNum);
  const rewardClaimed = challengeDone && todayReward?.claimed;

  // Countdown timer
  const [timeRemaining, setTimeRemaining] = useState<number>(getTimeUntilMidnight());

  useEffect(() => {
    if (isCompleted) return;

    const interval = setInterval(() => {
      setTimeRemaining(getTimeUntilMidnight());
    }, 60000);
    return () => clearInterval(interval);
  }, [isCompleted]);

  // Shimmer animation
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    shimmerProgress.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.linear }),
      -1, // Infinite loop
      false,
    );
  }, [shimmerProgress]);

  const animatedBorderStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      shimmerProgress.value,
      [0, 0.33, 0.66, 1],
      ['#DC143C', '#FFD700', '#DC143C', '#FFD700'],
    );
    return { borderColor };
  });

  const todayChallenge = useMemo(() => getDailyChallengeForDate(today, masteredSkills), [today, masteredSkills]);

  return (
    <Animated.View style={[styles.cardBorder, animatedBorderStyle]}>
      <View style={styles.cardInner}>
        {/* Top row: Title + XP multiplier badge */}
        <View style={styles.topRow}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name={todayChallenge.icon as any} size={20} color={COLORS.starGold} />
            <Text style={styles.title}>{todayChallenge.label}</Text>
          </View>
          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>{todayChallenge.reward.xpMultiplier}x XP</Text>
          </View>
        </View>

        {/* Middle: Specific challenge description */}
        <Text style={styles.description}>{todayChallenge.description}</Text>
        {todayChallenge.reward.gems > 0 && !isCompleted && (
          <View style={styles.rewardRow}>
            <MaterialCommunityIcons name="diamond-stone" size={14} color={COLORS.gemGold} />
            <Text style={styles.rewardText}>+{todayChallenge.reward.gems} gems</Text>
          </View>
        )}

        {/* Bottom row: Timer or Completed + Button */}
        <View style={styles.bottomRow}>
          {isCompleted ? (
            <View style={styles.completedRow}>
              <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
              <Text style={styles.completedText}>
                {rewardClaimed && todayReward
                  ? `+${todayReward.reward.amount} ${todayReward.reward.type === 'gems' ? 'gems' : todayReward.reward.type} claimed!`
                  : 'Completed!'}
              </Text>
            </View>
          ) : (
            <View style={styles.timerRow}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.timerText}>{formatTimeRemaining(timeRemaining)}</Text>
            </View>
          )}

          {isCompleted ? (
            <View style={styles.completedBadge}>
              <MaterialCommunityIcons name="check-bold" size={18} color={COLORS.success} />
            </View>
          ) : (
            <TouchableOpacity style={styles.playButton} onPress={onPress} activeOpacity={0.7}>
              <Text style={styles.playButtonText}>Play Now</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardBorder: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: '#DC143C',
    overflow: 'hidden',
  },
  cardInner: {
    backgroundColor: '#141414',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg - 2,
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
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  xpBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  xpBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#141414',
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  rewardText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gemGold,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.success,
  },
  playButton: {
    backgroundColor: COLORS.primary,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
});
