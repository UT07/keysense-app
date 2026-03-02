/**
 * LeaderboardScreen - Weekly league standings
 *
 * Shows league members sorted by weekly XP with:
 * - Header: league tier badge + week date range
 * - Standings FlatList: top 3 get medal icons, current user highlighted
 * - Promotion zone (top 10): green left border
 * - Demotion zone (bottom 5): red left border
 * - Pull-to-refresh: fetches latest standings from Firestore
 * - Footer: user's current rank summary
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useLeagueStore } from '../stores/leagueStore';
import type { LeagueStandingEntry } from '../stores/leagueStore';
import { useAuthStore } from '../stores/authStore';
import { getLeagueStandings } from '../services/firebase/leagueService';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import { PressableScale } from '../components/common/PressableScale';
import { Cat3DCanvas } from '../components/Mascot/3d';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// League tier display configuration
const LEAGUE_TIER_CONFIG = {
  bronze: { color: '#CD7F32', label: 'Bronze', icon: 'shield-outline' as const },
  silver: { color: '#C0C0C0', label: 'Silver', icon: 'shield-half-full' as const },
  gold: { color: '#FFD700', label: 'Gold', icon: 'shield-star' as const },
  diamond: { color: '#B9F2FF', label: 'Diamond', icon: 'shield-crown' as const },
} as const;

// Medal icons for top 3
const MEDAL_COLORS: Record<number, string> = {
  1: '#FFD700', // Gold
  2: '#C0C0C0', // Silver
  3: '#CD7F32', // Bronze
};

// Promotion: top 10 get green zone; demotion: bottom 5 get red zone
const PROMOTION_CUTOFF = 10;
const DEMOTION_FROM_BOTTOM = 5;

// ---------------------------------------------------------------------------
// Podium — Top 3 hero section with cat avatars
// ---------------------------------------------------------------------------

const PODIUM_HEIGHTS = [80, 100, 60]; // 2nd, 1st, 3rd pedestal heights
const PODIUM_MEDAL_SIZES = { 1: 22, 2: 18, 3: 16 };
const PODIUM_CAT_SIZES = { 1: 72, 2: 56, 3: 56 };

function PodiumPedestal({
  entry,
  place,
  isCurrentUser,
}: {
  entry: LeagueStandingEntry | undefined;
  place: 1 | 2 | 3;
  isCurrentUser: boolean;
}) {
  if (!entry) return <View style={styles.podiumSlot} />;

  const height = PODIUM_HEIGHTS[place === 2 ? 0 : place === 1 ? 1 : 2];
  const catSize = PODIUM_CAT_SIZES[place];
  const medalColor = MEDAL_COLORS[place];

  return (
    <Animated.View
      entering={FadeInUp.delay(place === 1 ? 200 : place === 2 ? 100 : 300).duration(400)}
      style={styles.podiumSlot}
    >
      {/* Cat avatar */}
      <View style={[styles.podiumAvatar, isCurrentUser && styles.podiumAvatarCurrent]}>
        <Cat3DCanvas
          catId={entry.selectedCatId ?? 'mini-meowww'}
          size={catSize}
          pose={place === 1 ? 'celebrate' : 'idle'}
          forceSVG
        />
      </View>

      {/* Medal */}
      <MaterialCommunityIcons
        name="medal"
        size={PODIUM_MEDAL_SIZES[place]}
        color={medalColor}
        style={styles.podiumMedal}
      />

      {/* Name */}
      <Text
        style={[styles.podiumName, isCurrentUser && styles.podiumNameCurrent]}
        numberOfLines={1}
      >
        {entry.displayName}
      </Text>

      {/* XP */}
      <Text style={styles.podiumXp}>{entry.weeklyXp.toLocaleString()} XP</Text>

      {/* Pedestal block */}
      <LinearGradient
        colors={[medalColor + '40', medalColor + '15']}
        style={[styles.podiumBlock, { height }]}
      >
        <Text style={[styles.podiumRank, { color: medalColor }]}>{place}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

function Podium({
  standings,
  currentUserUid,
}: {
  standings: LeagueStandingEntry[];
  currentUserUid: string;
}) {
  if (standings.length < 1) return null;

  const first = standings.find((s) => s.rank === 1);
  const second = standings.find((s) => s.rank === 2);
  const third = standings.find((s) => s.rank === 3);

  return (
    <View style={styles.podiumContainer}>
      <PodiumPedestal entry={second} place={2} isCurrentUser={second?.uid === currentUserUid} />
      <PodiumPedestal entry={first} place={1} isCurrentUser={first?.uid === currentUserUid} />
      <PodiumPedestal entry={third} place={3} isCurrentUser={third?.uid === currentUserUid} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Standings Row
// ---------------------------------------------------------------------------

function StandingsRow({
  entry,
  isCurrentUser,
  totalMembers,
}: {
  entry: LeagueStandingEntry;
  isCurrentUser: boolean;
  totalMembers: number;
}): React.JSX.Element {
  const isTopThree = entry.rank <= 3;
  const isPromotion = entry.rank <= PROMOTION_CUTOFF;
  const isDemotion = entry.rank > totalMembers - DEMOTION_FROM_BOTTOM;

  // Zone indicator (left border color)
  const zoneBorderColor = isPromotion
    ? COLORS.success
    : isDemotion
      ? COLORS.error
      : 'transparent';

  return (
    <View
      style={[
        styles.row,
        isCurrentUser && styles.rowCurrentUser,
        { borderLeftColor: zoneBorderColor, borderLeftWidth: 3 },
        isTopThree && styles.rowTopThree,
      ]}
    >
      {/* Rank */}
      <View style={styles.rankContainer}>
        {isTopThree ? (
          <MaterialCommunityIcons
            name="medal"
            size={24}
            color={MEDAL_COLORS[entry.rank]}
          />
        ) : (
          <Text style={styles.rankText}>{entry.rank}</Text>
        )}
      </View>

      {/* User info */}
      <View style={styles.userInfo}>
        <Text
          style={[
            styles.displayName,
            isCurrentUser && styles.displayNameCurrent,
          ]}
          numberOfLines={1}
        >
          {entry.displayName}
          {isCurrentUser ? ' (You)' : ''}
        </Text>
      </View>

      {/* Weekly XP */}
      <View style={styles.xpContainer}>
        <Text
          style={[
            styles.xpValue,
            isCurrentUser && styles.xpValueCurrent,
          ]}
        >
          {entry.weeklyXp.toLocaleString()}
        </Text>
        <Text style={styles.xpLabel}>XP</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export function LeaderboardScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const membership = useLeagueStore((s) => s.membership);
  const standings = useLeagueStore((s) => s.standings);
  const isLoadingStandings = useLeagueStore((s) => s.isLoadingStandings);
  const setStandings = useLeagueStore((s) => s.setStandings);
  const setLoadingStandings = useLeagueStore((s) => s.setLoadingStandings);
  const currentUserUid = useAuthStore((s) => s.user?.uid ?? '');

  const [refreshing, setRefreshing] = useState(false);

  // Auto-fetch standings on mount
  useEffect(() => {
    if (!membership?.leagueId) return;
    let cancelled = false;

    setLoadingStandings(true);
    getLeagueStandings(membership.leagueId)
      .then((data) => {
        if (!cancelled) setStandings(data);
      })
      .catch((err) => {
        console.warn('[Leaderboard] Auto-fetch failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoadingStandings(false);
      });

    return () => { cancelled = true; };
  }, [membership?.leagueId, setStandings, setLoadingStandings]);

  const tier = membership?.tier ?? 'bronze';
  const config = LEAGUE_TIER_CONFIG[tier];
  const totalMembers = standings.length || membership?.totalMembers || 0;

  // Compute current user's rank from standings
  const currentUserRank = useMemo(() => {
    const entry = standings.find((s) => s.uid === currentUserUid);
    return entry?.rank ?? membership?.rank ?? null;
  }, [standings, currentUserUid, membership?.rank]);

  // Fetch latest standings from Firestore
  const handleRefresh = useCallback(async () => {
    if (!membership?.leagueId) return;
    setRefreshing(true);
    setLoadingStandings(true);
    try {
      const data = await getLeagueStandings(membership.leagueId);
      setStandings(data);
    } catch (err) {
      console.warn('[Leaderboard] Failed to fetch standings:', err);
    } finally {
      setRefreshing(false);
      setLoadingStandings(false);
    }
  }, [membership?.leagueId, setStandings, setLoadingStandings]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Week date range display
  const weekRange = useMemo(() => {
    if (!membership?.weekStart) return '';
    const start = new Date(membership.weekStart + 'T00:00:00Z');
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);

    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
    return `${fmt(start)} - ${fmt(end)}`;
  }, [membership?.weekStart]);

  const renderItem = useCallback(
    ({ item }: { item: LeagueStandingEntry }) => (
      <StandingsRow
        entry={item}
        isCurrentUser={item.uid === currentUserUid}
        totalMembers={totalMembers}
      />
    ),
    [currentUserUid, totalMembers],
  );

  const keyExtractor = useCallback((item: LeagueStandingEntry) => item.uid, []);

  // No league membership
  if (!membership) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <PressableScale onPress={handleGoBack} style={styles.backButton}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={COLORS.textPrimary}
            />
          </PressableScale>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="trophy-outline"
            size={64}
            color={COLORS.textMuted}
          />
          <Text style={styles.emptyText}>
            Join a league by completing exercises this week!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} testID="leaderboard-screen">
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={handleGoBack} style={styles.backButton} testID="leaderboard-back">
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={COLORS.textPrimary}
          />
        </PressableScale>
        <View style={styles.headerCenter}>
          <View style={styles.headerTierRow}>
            <MaterialCommunityIcons
              name={config.icon}
              size={22}
              color={config.color}
            />
            <Text style={[styles.headerTitle, { color: config.color }]}>
              {config.label} League
            </Text>
          </View>
          <Text style={styles.headerWeek}>{weekRange}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Podium hero section for top 3 */}
      {standings.length > 0 && (
        <Podium standings={standings} currentUserUid={currentUserUid} />
      )}

      {/* Zone legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
          <Text style={styles.legendText}>Promotion zone</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.error }]} />
          <Text style={styles.legendText}>Demotion zone</Text>
        </View>
      </View>

      {/* Standings list (4th place onwards — top 3 are in the podium) */}
      {isLoadingStandings && standings.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={standings.filter((s) => s.rank > 3)}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyListContainer}>
              <Text style={styles.emptyListText}>
                Pull down to load standings
              </Text>
            </View>
          }
        />
      )}

      {/* Pinned current user row */}
      {currentUserRank !== null && currentUserRank > 3 && (() => {
        const me = standings.find((s) => s.uid === currentUserUid);
        if (!me) return null;
        return (
          <View style={styles.pinnedFooter}>
            <View style={styles.pinnedRank}>
              <Text style={styles.pinnedRankText}>{currentUserRank}</Text>
            </View>
            <Cat3DCanvas
              catId={me.selectedCatId ?? 'mini-meowww'}
              size={36}
              pose="idle"
              forceSVG
            />
            <Text style={styles.pinnedName} numberOfLines={1}>
              {me.displayName} (You)
            </Text>
            <View style={styles.pinnedXp}>
              <Text style={styles.pinnedXpValue}>{me.weeklyXp.toLocaleString()}</Text>
              <Text style={styles.pinnedXpLabel}>XP</Text>
            </View>
          </View>
        );
      })()}
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerTitle: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
  },
  headerWeek: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  headerSpacer: {
    width: 32, // Balance back button
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
  },

  // Standings list
  listContent: {
    paddingVertical: SPACING.sm,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  rowCurrentUser: {
    backgroundColor: COLORS.primary + '10',
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    marginHorizontal: SPACING.sm,
    marginVertical: SPACING.xs,
  },
  rowTopThree: {
    paddingVertical: SPACING.md + 2,
  },

  // Rank
  rankContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    ...TYPOGRAPHY.body.lg,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  // User info
  userInfo: {
    flex: 1,
    marginHorizontal: SPACING.md,
  },
  displayName: {
    ...TYPOGRAPHY.body.lg,
    color: COLORS.textPrimary,
  },
  displayNameCurrent: {
    fontWeight: '700',
    color: COLORS.primary,
  },

  // XP
  xpContainer: {
    alignItems: 'flex-end',
    minWidth: 70,
  },
  xpValue: {
    ...TYPOGRAPHY.heading.md,
    color: COLORS.textPrimary,
  },
  xpValueCurrent: {
    color: COLORS.primary,
  },
  xpLabel: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.textSecondary,
  },

  // Empty / Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyText: {
    ...TYPOGRAPHY.body.lg,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  emptyListContainer: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  emptyListText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textMuted,
  },

  // Podium
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  podiumSlot: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 120,
  },
  podiumAvatar: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.xs,
  },
  podiumAvatarCurrent: {
    borderColor: COLORS.primary,
    ...SHADOWS.md,
  },
  podiumMedal: {
    marginBottom: 2,
  },
  podiumName: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 100,
  },
  podiumNameCurrent: {
    color: COLORS.primary,
  },
  podiumXp: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  podiumBlock: {
    width: '85%',
    borderTopLeftRadius: BORDER_RADIUS.sm,
    borderTopRightRadius: BORDER_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumRank: {
    ...TYPOGRAPHY.heading.lg,
    fontWeight: '800',
  },

  // Pinned current-user footer
  pinnedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary + '40',
    backgroundColor: COLORS.primary + '10',
    gap: SPACING.sm,
  },
  pinnedRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinnedRankText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.primary,
    fontWeight: '800',
  },
  pinnedName: {
    flex: 1,
    ...TYPOGRAPHY.body.md,
    color: COLORS.primary,
    fontWeight: '700',
  },
  pinnedXp: {
    alignItems: 'flex-end',
  },
  pinnedXpValue: {
    ...TYPOGRAPHY.heading.sm,
    color: COLORS.primary,
  },
  pinnedXpLabel: {
    ...TYPOGRAPHY.caption.sm,
    color: COLORS.textSecondary,
  },
});
