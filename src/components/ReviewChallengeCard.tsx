/**
 * ReviewChallengeCard Component
 *
 * Warning-colored card displayed on HomeScreen when skills have decayed
 * (not practiced in 14+ days). Shows the count of fading skills and
 * navigates to a review session on tap.
 */

import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableScale } from './common/PressableScale';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  glowColor,
} from '../theme/tokens';

export interface ReviewChallengeCardProps {
  decayedSkills: string[];
  onStartReview: () => void;
}

export function ReviewChallengeCard({
  decayedSkills,
  onStartReview,
}: ReviewChallengeCardProps): React.ReactElement | null {
  if (decayedSkills.length === 0) {
    return null;
  }

  const count = decayedSkills.length;

  return (
    <PressableScale
      testID="review-challenge-card"
      onPress={onStartReview}
      haptic
      style={styles.card}
    >
      <View style={styles.row}>
        {/* Icon circle */}
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons
            name="refresh"
            size={20}
            color={COLORS.warning}
          />
        </View>

        {/* Text content */}
        <View style={styles.textContent}>
          <Text style={styles.title}>Skills Need Review</Text>
          <Text style={styles.subtitle}>
            {count} skill(s) fading — quick review to stay sharp
          </Text>
        </View>

        {/* Count badge */}
        <View testID="review-challenge-start" style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>

        {/* Chevron */}
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={COLORS.textMuted}
        />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glowColor(COLORS.warning, 0.08),
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: glowColor(COLORS.warning, 0.2),
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: glowColor(COLORS.warning, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.heading.sm,
    color: COLORS.textPrimary,
  },
  subtitle: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    ...TYPOGRAPHY.button.sm,
    color: COLORS.background,
  },
});
