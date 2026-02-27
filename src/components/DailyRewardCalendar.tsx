/**
 * DailyRewardCalendar — 7-day horizontal reward strip
 *
 * Duolingo-style daily reward row showing:
 * - Past days: checkmark (claimed) or X (missed)
 * - Today: pulsing glow border with claim button
 * - Future days: reward preview
 */

import { useCallback } from 'react';
import type { ReactElement } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, SPACING, BORDER_RADIUS } from '../theme/tokens';
import type { DailyRewardDay } from '../stores/types';

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

interface DailyRewardCalendarProps {
  days: DailyRewardDay[];
  currentDay: number; // 1-7
  onClaim: (day: number) => void;
  /** Whether today's daily challenge has been completed (required to claim) */
  dailyChallengeCompleted?: boolean;
}

function RewardIcon({ type, size = 16 }: { type: DailyRewardDay['reward']['type']; size?: number }): ReactElement {
  switch (type) {
    case 'gems':
      return <MaterialCommunityIcons name="diamond-stone" size={size} color={COLORS.gemGold} />;
    case 'xp_boost':
      return <MaterialCommunityIcons name="lightning-bolt" size={size} color="#FF9800" />;
    case 'streak_freeze':
      return <MaterialCommunityIcons name="snowflake" size={size} color="#42A5F5" />;
    case 'chest':
      return <MaterialCommunityIcons name="treasure-chest" size={size} color={COLORS.gemGold} />;
  }
}

function DayCell({
  day,
  isToday,
  isClaimed,
  isPast,
  onClaim,
  disabled = false,
}: {
  day: DailyRewardDay;
  isToday: boolean;
  isClaimed: boolean;
  isPast: boolean;
  onClaim: () => void;
  disabled?: boolean;
}): ReactElement {
  const glowOpacity = useSharedValue(0.3);

  // Only today is claimable — past unclaimed days are missed (expired at midnight)
  const isMissed = isPast && !isClaimed;
  const isClaimable = !isClaimed && !disabled && isToday;

  // Pulsing glow for claimable rewards
  if (isClaimable) {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: isToday
      ? `rgba(255, 215, 0, ${glowOpacity.value})`
      : `rgba(76, 175, 80, ${glowOpacity.value})`,
  }));

  const handlePress = useCallback(() => {
    if (isClaimable) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onClaim();
    }
  }, [isClaimable, onClaim]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!isClaimable}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.dayCell,
          isClaimed && styles.dayCellClaimed,
          isToday && !isClaimed && styles.dayCellToday,
          isClaimable && glowStyle,
          isMissed && styles.dayCellMissed,
        ]}
      >
        <Text style={[
          styles.dayLabel,
          isToday && styles.dayLabelToday,
          isMissed && styles.dayLabelMissed,
        ]}>
          {DAY_LABELS[day.day - 1]}
        </Text>

        {isClaimed ? (
          <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
        ) : isMissed ? (
          <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.textMuted} />
        ) : (
          <RewardIcon type={day.reward.type} />
        )}

        <Text style={[
          styles.rewardAmount,
          isClaimed && styles.rewardAmountClaimed,
          isMissed && styles.rewardAmountMissed,
        ]}>
          {isMissed ? '—' :
           day.reward.type === 'xp_boost' ? '2x' :
           day.reward.type === 'streak_freeze' ? '1' :
           day.reward.amount}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export function DailyRewardCalendar({
  days,
  currentDay,
  onClaim,
  dailyChallengeCompleted = false,
}: DailyRewardCalendarProps): ReactElement {
  const todayClaimable = dailyChallengeCompleted;

  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="calendar-star" size={18} color={COLORS.gemGold} />
        <Text style={styles.title}>Daily Rewards</Text>
      </View>
      <View style={styles.daysRow}>
        {days.map((day) => (
          <DayCell
            key={day.day}
            day={day}
            isToday={day.day === currentDay}
            isClaimed={day.claimed}
            isPast={day.day < currentDay}
            onClaim={() => onClaim(day.day)}
            disabled={!todayClaimable}
          />
        ))}
      </View>
      {!dailyChallengeCompleted && currentDay >= 1 && currentDay <= 7 && (
        <View style={styles.challengeHint}>
          <MaterialCommunityIcons name="lock" size={12} color={COLORS.textMuted} />
          <Text style={styles.challengeHintText}>
            Complete today's challenge to unlock rewards
          </Text>
        </View>
      )}
      {days.some(d => d.day < currentDay && !d.claimed) && (
        <View style={styles.challengeHint}>
          <MaterialCommunityIcons name="close-circle-outline" size={12} color={COLORS.textMuted} />
          <Text style={styles.challengeHintText}>
            Missed days expire at midnight
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayCell: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: 6,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minWidth: 42,
    gap: 4,
  },
  dayCellClaimed: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  dayCellToday: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 2,
  },
  dayCellMissed: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    opacity: 0.5,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  dayLabelToday: {
    color: COLORS.gemGold,
    fontWeight: '800',
  },
  dayLabelMissed: {
    color: COLORS.textMuted,
  },
  rewardAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  rewardAmountClaimed: {
    color: COLORS.success,
  },
  rewardAmountMissed: {
    color: COLORS.textMuted,
  },
  challengeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.sm,
    justifyContent: 'center',
  },
  challengeHintText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
});
