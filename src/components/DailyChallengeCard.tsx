/**
 * DailyChallengeCard Component
 * Full-width card for the HomeScreen showing today's daily challenge
 * with gamification elements: animated gradient border, 2x XP badge,
 * countdown timer, and completion state.
 */

import { useEffect, useState } from 'react';
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
import { useProgressStore } from '../stores/progressStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../theme/tokens';

const MOTIVATIONAL_TEXTS = [
  "Play today's surprise exercise to earn double XP!",
  'Complete the daily challenge and keep your streak alive!',
  'A quick challenge a day keeps the rust away!',
  'Earn bonus XP with today\'s special exercise!',
  'Push your skills further with today\'s challenge!',
] as const;

function getMotivationalText(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return MOTIVATIONAL_TEXTS[dayOfYear % MOTIVATIONAL_TEXTS.length];
}

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
}

export function DailyChallengeCard({ onPress }: DailyChallengeCardProps): React.ReactElement | null {
  const { dailyGoalData } = useProgressStore();

  const today = new Date().toISOString().split('T')[0];
  const isCompleted = (dailyGoalData[today]?.exercisesCompleted ?? 0) > 0;

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
      -1,
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

  const motivationalText = getMotivationalText();

  return (
    <Animated.View style={[styles.cardBorder, animatedBorderStyle]}>
      <View style={styles.cardInner}>
        {/* Top row: Title + 2x XP badge */}
        <View style={styles.topRow}>
          <View style={styles.titleRow}>
            <MaterialCommunityIcons name="trophy-outline" size={20} color={COLORS.starGold} />
            <Text style={styles.title}>Daily Challenge</Text>
          </View>
          <View style={styles.xpBadge}>
            <Text style={styles.xpBadgeText}>2x XP</Text>
          </View>
        </View>

        {/* Middle: Description */}
        <Text style={styles.description}>{motivationalText}</Text>

        {/* Bottom row: Timer or Completed + Button */}
        <View style={styles.bottomRow}>
          {isCompleted ? (
            <View style={styles.completedRow}>
              <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
              <Text style={styles.completedText}>Completed!</Text>
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
    backgroundColor: '#1A1A2E',
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
    color: '#1A1A2E',
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
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
