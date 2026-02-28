/**
 * SocialScreen - Social hub with league, friends, and challenges
 *
 * Three sections:
 * 1. League Card — current tier, rank, weekly XP, "View Leaderboard" button
 * 2. Friends Section — friend count, pending requests, navigation buttons
 * 3. Active Challenges — pending/active FriendChallenge cards
 *
 * Auth gate: anonymous users see a sign-in prompt instead.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { useSocialStore } from '../stores/socialStore';
import { useLeagueStore } from '../stores/leagueStore';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import { PressableScale } from '../components/common/PressableScale';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// League tier display configuration
const LEAGUE_TIER_CONFIG = {
  bronze: { color: '#CD7F32', label: 'Bronze', icon: 'shield-outline' as const },
  silver: { color: '#C0C0C0', label: 'Silver', icon: 'shield-half-full' as const },
  gold: { color: '#FFD700', label: 'Gold', icon: 'shield-star' as const },
  diamond: { color: '#B9F2FF', label: 'Diamond', icon: 'shield-crown' as const },
} as const;

// ---------------------------------------------------------------------------
// Auth Gate Component
// ---------------------------------------------------------------------------

function AuthGate({ onSignIn }: { onSignIn: () => void }): React.JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.authGateContainer}>
        <MaterialCommunityIcons
          name="account-group"
          size={80}
          color={COLORS.textMuted}
        />
        <Text style={styles.authGateTitle}>Social Features</Text>
        <Text style={styles.authGateSubtitle}>
          Sign in to unlock leagues, friends, and challenges
        </Text>
        <PressableScale onPress={onSignIn} style={styles.authGateButton}>
          <Text style={styles.authGateButtonText}>Sign In</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// League Card
// ---------------------------------------------------------------------------

function LeagueCard(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const membership = useLeagueStore((s) => s.membership);

  const tier = membership?.tier ?? 'bronze';
  const config = LEAGUE_TIER_CONFIG[tier];

  const handleViewLeaderboard = useCallback(() => {
    navigation.navigate('Leaderboard');
  }, [navigation]);

  if (!membership) {
    return (
      <View style={[styles.card, styles.leagueCard]}>
        <View style={styles.leagueHeader}>
          <MaterialCommunityIcons
            name="shield-outline"
            size={32}
            color={COLORS.textMuted}
          />
          <Text style={styles.leagueTitle}>Weekly League</Text>
        </View>
        <Text style={styles.leagueNoMembership}>
          Complete exercises to join this week's league!
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.leagueCard, { borderColor: config.color }]}>
      <View style={styles.leagueHeader}>
        <View style={[styles.tierBadge, { backgroundColor: config.color + '20' }]}>
          <MaterialCommunityIcons
            name={config.icon}
            size={28}
            color={config.color}
          />
        </View>
        <View style={styles.leagueHeaderText}>
          <Text style={[styles.leagueTierLabel, { color: config.color }]}>
            {config.label} League
          </Text>
          <Text style={styles.leagueWeek}>
            Week of {membership.weekStart}
          </Text>
        </View>
      </View>

      <View style={styles.leagueStats}>
        <View style={styles.leagueStat}>
          <Text style={styles.leagueStatValue}>#{membership.rank}</Text>
          <Text style={styles.leagueStatLabel}>Rank</Text>
        </View>
        <View style={styles.leagueStatDivider} />
        <View style={styles.leagueStat}>
          <Text style={styles.leagueStatValue}>
            {membership.weeklyXp.toLocaleString()}
          </Text>
          <Text style={styles.leagueStatLabel}>Weekly XP</Text>
        </View>
        <View style={styles.leagueStatDivider} />
        <View style={styles.leagueStat}>
          <Text style={styles.leagueStatValue}>{membership.totalMembers}</Text>
          <Text style={styles.leagueStatLabel}>Members</Text>
        </View>
      </View>

      <PressableScale
        onPress={handleViewLeaderboard}
        style={[styles.actionButton, { backgroundColor: config.color + '20' }]}
        testID="social-view-leaderboard"
      >
        <MaterialCommunityIcons name="trophy" size={18} color={config.color} />
        <Text style={[styles.actionButtonText, { color: config.color }]}>
          View Leaderboard
        </Text>
      </PressableScale>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Friends Section
// ---------------------------------------------------------------------------

function FriendsSection(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const friends = useSocialStore((s) => s.friends);

  const acceptedCount = useMemo(
    () => friends.filter((f) => f.status === 'accepted').length,
    [friends],
  );

  const pendingCount = useMemo(
    () => friends.filter((f) => f.status === 'pending_incoming').length,
    [friends],
  );

  const handleViewFriends = useCallback(() => {
    navigation.navigate('Friends');
  }, [navigation]);

  const handleAddFriend = useCallback(() => {
    navigation.navigate('AddFriend');
  }, [navigation]);

  return (
    <View style={[styles.card, styles.friendsCard]}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons
          name="account-multiple"
          size={24}
          color={COLORS.textPrimary}
        />
        <Text style={styles.sectionTitle}>Friends</Text>
        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      <Text style={styles.friendsCount}>
        {acceptedCount} {acceptedCount === 1 ? 'friend' : 'friends'}
        {pendingCount > 0 && (
          <Text style={styles.pendingText}>
            {' '} ({pendingCount} pending)
          </Text>
        )}
      </Text>

      <View style={styles.friendsActions}>
        <PressableScale
          onPress={handleViewFriends}
          style={[styles.actionButton, styles.friendsActionButton]}
          testID="social-view-friends"
        >
          <MaterialCommunityIcons
            name="account-group"
            size={18}
            color={COLORS.primary}
          />
          <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>
            View Friends
          </Text>
        </PressableScale>

        <PressableScale
          onPress={handleAddFriend}
          style={[styles.actionButton, styles.addFriendButton]}
          testID="social-add-friend"
        >
          <MaterialCommunityIcons
            name="account-plus"
            size={18}
            color={COLORS.textPrimary}
          />
          <Text style={[styles.actionButtonText, { color: COLORS.textPrimary }]}>
            Add Friend
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Challenge Card
// ---------------------------------------------------------------------------

function ChallengeCard({
  challenge,
}: {
  challenge: {
    id: string;
    fromDisplayName: string;
    exerciseTitle: string;
    fromScore: number;
    toScore: number | null;
    status: 'pending' | 'completed' | 'expired';
    expiresAt: number;
  };
}): React.JSX.Element {
  const timeLeft = useMemo(() => {
    const remaining = challenge.expiresAt - Date.now();
    if (remaining <= 0) return 'Expired';
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  }, [challenge.expiresAt]);

  const statusColor =
    challenge.status === 'completed'
      ? COLORS.success
      : challenge.status === 'expired'
        ? COLORS.textMuted
        : COLORS.warning;

  return (
    <View style={styles.challengeCard}>
      <View style={styles.challengeHeader}>
        <MaterialCommunityIcons name="sword-cross" size={20} color={COLORS.warning} />
        <Text style={styles.challengeTitle} numberOfLines={1}>
          {challenge.exerciseTitle}
        </Text>
      </View>

      <Text style={styles.challengeOpponent}>
        vs. {challenge.fromDisplayName}
      </Text>

      <View style={styles.challengeScores}>
        <Text style={styles.challengeScore}>
          Their score: {challenge.fromScore}%
        </Text>
        {challenge.toScore !== null ? (
          <Text style={styles.challengeScore}>
            Your score: {challenge.toScore}%
          </Text>
        ) : (
          <Text style={[styles.challengeScore, { color: COLORS.warning }]}>
            Not played yet
          </Text>
        )}
      </View>

      <View style={styles.challengeFooter}>
        <Text style={[styles.challengeStatus, { color: statusColor }]}>
          {challenge.status === 'completed'
            ? 'Completed'
            : challenge.status === 'expired'
              ? 'Expired'
              : 'Pending'}
        </Text>
        <Text style={styles.challengeTime}>{timeLeft}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Active Challenges Section
// ---------------------------------------------------------------------------

function ActiveChallengesSection(): React.JSX.Element {
  const challenges = useSocialStore((s) => s.challenges);

  const activeChallenges = useMemo(
    () => challenges.filter((c) => c.status === 'pending' || c.status === 'completed'),
    [challenges],
  );

  return (
    <View style={[styles.card, styles.challengesCard]}>
      <View style={styles.sectionHeader}>
        <MaterialCommunityIcons
          name="sword-cross"
          size={24}
          color={COLORS.textPrimary}
        />
        <Text style={styles.sectionTitle}>Challenges</Text>
      </View>

      {activeChallenges.length === 0 ? (
        <Text style={styles.emptyChallenges}>
          No active challenges. Challenge a friend to beat your score!
        </Text>
      ) : (
        activeChallenges.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} />
        ))
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export function SocialScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const isAnonymous = useAuthStore((s) => s.isAnonymous);

  const handleSignIn = useCallback(() => {
    navigation.navigate('Auth');
  }, [navigation]);

  if (isAnonymous) {
    return <AuthGate onSignIn={handleSignIn} />;
  }

  return (
    <SafeAreaView style={styles.container} testID="social-screen">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="social-scroll"
      >
        <Text style={styles.screenTitle}>Social</Text>

        <LeagueCard />
        <FriendsSection />
        <ActiveChallengesSection />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  screenTitle: {
    ...TYPOGRAPHY.display.md,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },

  // Auth gate
  authGateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  authGateTitle: {
    ...TYPOGRAPHY.display.sm,
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  authGateSubtitle: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  authGateButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
  },
  authGateButtonText: {
    ...TYPOGRAPHY.button.lg,
    color: COLORS.textPrimary,
  },

  // Card base
  card: {
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },

  // League card
  leagueCard: {
    borderWidth: 1.5,
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  tierBadge: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leagueHeaderText: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  leagueTierLabel: {
    ...TYPOGRAPHY.heading.lg,
  },
  leagueWeek: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leagueTitle: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
    marginLeft: SPACING.sm,
  },
  leagueNoMembership: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },
  leagueStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  leagueStat: {
    alignItems: 'center',
    flex: 1,
  },
  leagueStatValue: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
  },
  leagueStatLabel: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leagueStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.cardBorder,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
    marginLeft: SPACING.sm,
    flex: 1,
  },

  // Friends card
  friendsCard: {},
  friendsCount: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  pendingText: {
    color: COLORS.warning,
  },
  pendingBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
  },
  pendingBadgeText: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  friendsActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  friendsActionButton: {
    flex: 1,
    backgroundColor: COLORS.primary + '15',
  },
  addFriendButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
  },

  // Action button (shared)
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  actionButtonText: {
    ...TYPOGRAPHY.button.md,
  },

  // Challenges card
  challengesCard: {},
  emptyChallenges: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  // Individual challenge card
  challengeCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  challengeTitle: {
    ...TYPOGRAPHY.heading.sm,
    color: COLORS.textPrimary,
    flex: 1,
  },
  challengeOpponent: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  challengeScores: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  challengeScore: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.textSecondary,
  },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: SPACING.sm,
  },
  challengeStatus: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600',
  },
  challengeTime: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textMuted,
  },
});
