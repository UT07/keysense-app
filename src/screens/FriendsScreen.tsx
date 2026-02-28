/**
 * FriendsScreen — Friends list + activity feed
 *
 * Tab toggle: "Friends" | "Activity"
 * Friends tab: pending requests + accepted friends list
 * Activity tab: chronological feed of friend milestones
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSocialStore } from '../stores/socialStore';
import { useAuthStore } from '../stores/authStore';
import { acceptFriendRequest, removeFriendConnection } from '../services/firebase/socialService';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import { PressableScale } from '../components/common/PressableScale';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { FriendConnection, ActivityFeedItem } from '../stores/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type TabKey = 'friends' | 'activity';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function activityIcon(type: ActivityFeedItem['type']): string {
  switch (type) {
    case 'level_up': return 'arrow-up-bold';
    case 'evolution': return 'star';
    case 'streak_milestone': return 'fire';
    case 'song_mastered': return 'music-note';
    case 'league_promoted': return 'trophy';
    default: return 'bell';
  }
}

function activityIconColor(type: ActivityFeedItem['type']): string {
  switch (type) {
    case 'level_up': return COLORS.info;
    case 'evolution': return COLORS.starGold;
    case 'streak_milestone': return COLORS.streakFlame;
    case 'song_mastered': return COLORS.primary;
    case 'league_promoted': return COLORS.starGold;
    default: return COLORS.textSecondary;
  }
}

// Emoji mapping for cat avatars (matches cat selection IDs)
function catEmoji(catId: string): string {
  const map: Record<string, string> = {
    'mini-meowww': '\uD83D\uDC31',
    'jazzy': '\uD83C\uDFB7',
    'luna': '\uD83C\uDF19',
    'ballymakawww': '\u2618\uFE0F',
    'shibu': '\uD83C\uDFCE\uFE0F',
    'bella': '\uD83D\uDC51',
    'coco': '\uD83C\uDF6B',
    'professor-whiskers': '\uD83E\uDDD1\u200D\uD83C\uDF93',
    'captain-tuna': '\u2693',
    'midnight': '\uD83C\uDF1A',
    'duchess': '\uD83D\uDC8E',
    'chonky-monke': '\uD83D\uDE48',
  };
  return map[catId] || '\uD83D\uDC31';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PendingRequestRow({
  friend,
  onAccept,
  onDecline,
  isProcessing,
}: {
  friend: FriendConnection;
  onAccept: () => void;
  onDecline: () => void;
  isProcessing: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.friendRow}>
      <Text style={styles.friendEmoji}>{catEmoji(friend.selectedCatId)}</Text>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName} numberOfLines={1}>
          {friend.displayName || 'Player'}
        </Text>
        <Text style={styles.friendSubtitle}>wants to be friends</Text>
      </View>
      <View style={styles.pendingActions}>
        {isProcessing ? (
          <ActivityIndicator color={COLORS.primary} size="small" />
        ) : (
          <>
            <TouchableOpacity style={styles.acceptButton} onPress={onAccept}>
              <MaterialCommunityIcons name="check" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
              <MaterialCommunityIcons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

function AcceptedFriendRow({
  friend,
}: {
  friend: FriendConnection;
}): React.JSX.Element {
  return (
    <View style={styles.friendRow}>
      <Text style={styles.friendEmoji}>{catEmoji(friend.selectedCatId)}</Text>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName} numberOfLines={1}>
          {friend.displayName || 'Player'}
        </Text>
      </View>
      <PressableScale
        style={styles.challengeButton}
        onPress={() => {
          // Navigate to challenge flow — for now just show alert
          Alert.alert(
            'Challenge',
            `Challenge ${friend.displayName || 'Friend'} to beat your score!`,
            [{ text: 'OK' }],
          );
        }}
      >
        <MaterialCommunityIcons name="sword-cross" size={16} color={COLORS.textPrimary} />
        <Text style={styles.challengeButtonText}>Challenge</Text>
      </PressableScale>
    </View>
  );
}

function ActivityRow({ item }: { item: ActivityFeedItem }): React.JSX.Element {
  const iconName = activityIcon(item.type);
  const iconColor = activityIconColor(item.type);

  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, { backgroundColor: `${iconColor}20` }]}>
        <MaterialCommunityIcons name={iconName as never} size={18} color={iconColor} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityText} numberOfLines={2}>
          <Text style={styles.activityFriendName}>{item.friendDisplayName}</Text>
          {' '}
          {item.detail}
        </Text>
        <Text style={styles.activityTime}>{getRelativeTime(item.timestamp)}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FriendsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const friends = useSocialStore((s) => s.friends);
  const activityFeed = useSocialStore((s) => s.activityFeed);
  const updateFriendStatus = useSocialStore((s) => s.updateFriendStatus);
  const removeFriend = useSocialStore((s) => s.removeFriend);

  const [activeTab, setActiveTab] = useState<TabKey>('friends');
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  const pendingIncoming = useMemo(
    () => friends.filter((f) => f.status === 'pending_incoming'),
    [friends],
  );

  const acceptedFriends = useMemo(
    () => friends.filter((f) => f.status === 'accepted'),
    [friends],
  );

  const handleAcceptRequest = useCallback(
    async (friendUid: string) => {
      if (!user?.uid) return;
      setProcessingUid(friendUid);
      try {
        await acceptFriendRequest(user.uid, friendUid);
        updateFriendStatus(friendUid, 'accepted');
      } catch {
        Alert.alert('Error', 'Failed to accept request. Please try again.');
      } finally {
        setProcessingUid(null);
      }
    },
    [user?.uid, updateFriendStatus],
  );

  const handleDeclineRequest = useCallback(
    async (friendUid: string) => {
      if (!user?.uid) return;
      setProcessingUid(friendUid);
      try {
        await removeFriendConnection(user.uid, friendUid);
        removeFriend(friendUid);
      } catch {
        Alert.alert('Error', 'Failed to decline request. Please try again.');
      } finally {
        setProcessingUid(null);
      }
    },
    [user?.uid, removeFriend],
  );

  // ---------------------------------------------------------------------------
  // Friends tab content
  // ---------------------------------------------------------------------------

  const renderFriendsTab = useCallback(() => {
    if (pendingIncoming.length === 0 && acceptedFriends.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="account-group-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptySubtitle}>
            Add friends to see their progress and challenge them!
          </Text>
          <PressableScale
            style={styles.emptyActionButton}
            onPress={() => navigation.navigate('AddFriend')}
          >
            <MaterialCommunityIcons name="account-plus" size={20} color={COLORS.textPrimary} />
            <Text style={styles.emptyActionText}>Add Friend</Text>
          </PressableScale>
        </View>
      );
    }

    return (
      <FlatList
        data={[...pendingIncoming, ...acceptedFriends]}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          if (item.status === 'pending_incoming') {
            return (
              <PendingRequestRow
                friend={item}
                onAccept={() => handleAcceptRequest(item.uid)}
                onDecline={() => handleDeclineRequest(item.uid)}
                isProcessing={processingUid === item.uid}
              />
            );
          }
          return <AcceptedFriendRow friend={item} />;
        }}
        ListHeaderComponent={
          pendingIncoming.length > 0 ? (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>
                Pending Requests ({pendingIncoming.length})
              </Text>
            </View>
          ) : null
        }
      />
    );
  }, [pendingIncoming, acceptedFriends, processingUid, handleAcceptRequest, handleDeclineRequest, navigation]);

  // ---------------------------------------------------------------------------
  // Activity tab content
  // ---------------------------------------------------------------------------

  const renderActivityTab = useCallback(() => {
    if (activityFeed.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="timeline-text-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptySubtitle}>
            Add friends to see their activity here
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={activityFeed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => <ActivityRow item={item} />}
      />
    );
  }, [activityFeed]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} testID="friends-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID="friends-back"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friends</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddFriend')}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="account-plus" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Tab Toggle */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'friends' && styles.tabTextActive,
            ]}
          >
            Friends
          </Text>
          {pendingIncoming.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingIncoming.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
          onPress={() => setActiveTab('activity')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'activity' && styles.tabTextActive,
            ]}
          >
            Activity
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'friends' ? renderFriendsTab() : renderActivityTab()}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.xs,
  },
  tabActive: {
    backgroundColor: COLORS.surfaceElevated,
  },
  tabText: {
    ...TYPOGRAPHY.button.md,
    color: COLORS.textMuted,
  },
  tabTextActive: {
    color: COLORS.textPrimary,
  },
  badge: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...TYPOGRAPHY.caption.sm,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },

  // List
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  sectionHeader: {
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  sectionHeaderText: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Friend row
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  friendEmoji: {
    fontSize: 28,
    marginRight: SPACING.md,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    ...TYPOGRAPHY.heading.sm,
    color: COLORS.textPrimary,
  },
  friendSubtitle: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pendingActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.sm + 2,
  },
  challengeButtonText: {
    ...TYPOGRAPHY.button.sm,
    color: COLORS.textPrimary,
  },

  // Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textPrimary,
  },
  activityFriendName: {
    fontWeight: '700',
  },
  activityTime: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textMuted,
    marginTop: 4,
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    ...TYPOGRAPHY.heading.md,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.lg,
  },
  emptyActionText: {
    ...TYPOGRAPHY.button.md,
    color: COLORS.textPrimary,
  },
});
