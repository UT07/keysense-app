/**
 * LevelMapScreen - Vertical level progression map
 * Clean card-based layout with vertical spine, section headers,
 * and state-driven node styling (completed/current/locked).
 *
 * Shows 15 tier nodes: tiers 1-6 map to static lessons, tiers 7-15
 * are AI-generated skill groups from the SkillTree.
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useProgressStore } from '../stores/progressStore';
import { useLearnerProfileStore } from '../stores/learnerProfileStore';
import { useGemStore } from '../stores/gemStore';
import { getLessons, getExercise } from '../content/ContentLoader';
import { SKILL_TREE, getSkillById } from '../core/curriculum/SkillTree';
import { SalsaCoach } from '../components/Mascot/SalsaCoach';
import { COLORS, GRADIENTS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_HEIGHT = Dimensions.get('window').height;

// Icon size for the node indicator circle
const INDICATOR_SIZE = 48;

/** Metadata for each tier — title and icon shown on the level map */
const TIER_META: Record<number, { title: string; icon: string }> = {
  1: { title: 'Note Finding', icon: 'music-note' },
  2: { title: 'Right Hand Melodies', icon: 'hand-pointing-right' },
  3: { title: 'Left Hand Basics', icon: 'hand-pointing-left' },
  4: { title: 'Both Hands', icon: 'hand-clap' },
  5: { title: 'Scales & Technique', icon: 'stairs' },
  6: { title: 'Popular Songs', icon: 'music' },
  7: { title: 'Black Keys', icon: 'piano' },
  8: { title: 'G & F Major', icon: 'key-variant' },
  9: { title: 'Minor Keys', icon: 'music-accidental-flat' },
  10: { title: 'Chord Progressions', icon: 'cards' },
  11: { title: 'Advanced Rhythm', icon: 'metronome' },
  12: { title: 'Arpeggios', icon: 'wave' },
  13: { title: 'Expression', icon: 'volume-high' },
  14: { title: 'Sight Reading', icon: 'eye' },
  15: { title: 'Performance', icon: 'trophy' },
};

/** Section labels — keyed by first tier index (0-based) in the section */
const TIER_SECTIONS: Record<number, string> = {
  0: 'Beginner',
  4: 'Fundamentals',
  6: 'Intermediate',
  10: 'Advanced',
  14: 'Mastery',
};

type NodeState = 'completed' | 'passed' | 'current' | 'locked';

interface TierNodeData {
  tier: number;
  title: string;
  icon: string;
  state: NodeState;
  masteredCount: number;
  totalSkills: number;
  /** For tiers 1-6: the lesson ID to navigate to */
  lessonId: string | null;
  /** For tiers 7-15: the first unmastered skill ID for AI exercise */
  firstUnmasteredSkillId: string | null;
}

/**
 * Build tier nodes by combining static lesson data (tiers 1-6) with
 * SkillTree tier groups (tiers 7-15). Completion state is derived from
 * masteredSkills in the learnerProfileStore.
 */
function useTierNodes(): TierNodeData[] {
  const { lessonProgress } = useProgressStore();
  const masteredSkills = useLearnerProfileStore((s) => s.masteredSkills);
  const lessons = useMemo(() => getLessons(), []);

  return useMemo(() => {
    const masteredSet = new Set(masteredSkills);

    // Group skills by tier
    const skillsByTier = new Map<number, typeof SKILL_TREE>();
    for (const skill of SKILL_TREE) {
      const list = skillsByTier.get(skill.tier) ?? [];
      list.push(skill);
      skillsByTier.set(skill.tier, list);
    }

    // Get all unique tiers sorted
    const tiers = Array.from(skillsByTier.keys()).sort((a, b) => a - b);

    // Explicit tier-to-lesson mapping
    const TIER_TO_LESSON: Record<number, string> = {
      1: 'lesson-01', 2: 'lesson-02', 3: 'lesson-03',
      4: 'lesson-04', 5: 'lesson-05', 6: 'lesson-06',
    };

    // Pass 1: compute raw data with passable/complete status per tier
    interface RawTier {
      tier: number;
      title: string;
      icon: string;
      masteredCount: number;
      totalSkills: number;
      isComplete: boolean;
      isPassable: boolean;
      lessonId: string | null;
      firstUnmasteredSkillId: string | null;
    }

    const rawTiers: RawTier[] = tiers.map((tier) => {
      const skills = skillsByTier.get(tier) ?? [];
      const masteredCount = skills.filter((s) => masteredSet.has(s.id)).length;
      const totalSkills = skills.length;
      const isComplete = totalSkills > 0 && masteredCount === totalSkills;

      const meta = TIER_META[tier] ?? { title: `Tier ${tier}`, icon: 'star' };
      const lessonId = TIER_TO_LESSON[tier] ?? null;
      const lesson = lessonId ? lessons.find((l) => l.id === lessonId) ?? null : null;

      const isPassable = isComplete || (lesson != null && lessonProgress[lesson.id]?.status === 'completed');

      const firstUnmastered = skills.find((s) => !masteredSet.has(s.id));

      return {
        tier,
        title: meta.title,
        icon: meta.icon,
        masteredCount,
        totalSkills,
        isComplete,
        isPassable,
        lessonId,
        firstUnmasteredSkillId: firstUnmastered?.id ?? null,
      };
    });

    // Pass 2: determine accessibility
    const accessible: boolean[] = rawTiers.map((_, i) =>
      i === 0 || rawTiers[i - 1].isPassable,
    );

    // Find the highest accessible non-completed tier → that's "current"
    let currentIndex = -1;
    for (let i = rawTiers.length - 1; i >= 0; i--) {
      if (accessible[i] && !rawTiers[i].isComplete) {
        currentIndex = i;
        break;
      }
    }

    // Pass 3: assign node states
    const nodes: TierNodeData[] = rawTiers.map((raw, i) => {
      let state: NodeState;
      if (raw.isComplete) {
        state = 'completed';
      } else if (accessible[i] && i === currentIndex) {
        state = 'current';
      } else if (accessible[i]) {
        state = 'passed';
      } else {
        state = 'locked';
      }

      return {
        tier: raw.tier,
        title: raw.title,
        icon: raw.icon,
        state,
        masteredCount: raw.masteredCount,
        totalSkills: raw.totalSkills,
        lessonId: raw.lessonId,
        firstUnmasteredSkillId: raw.firstUnmasteredSkillId,
      };
    });

    return nodes;
  }, [lessons, lessonProgress, masteredSkills]);
}

/** Animated pulsing glow ring for current node indicator */
function PulsingGlow() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.6,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scaleAnim, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.pulsingGlow,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    />
  );
}

/** Get colors/config for node state */
function getNodeConfig(state: NodeState) {
  switch (state) {
    case 'completed':
      return {
        indicatorBg: COLORS.starGold,
        indicatorBorder: COLORS.starGold,
        iconColor: '#1A1400',
        iconName: 'check-bold' as const,
        titleColor: COLORS.textPrimary,
        subtitleColor: COLORS.starGold,
        cardBorder: 'rgba(255, 215, 0, 0.2)',
        cardBg: 'rgba(255, 215, 0, 0.05)',
        spineDotColor: COLORS.starGold,
      };
    case 'passed':
      return {
        indicatorBg: COLORS.success,
        indicatorBorder: COLORS.success,
        iconColor: '#FFFFFF',
        iconName: 'check' as const,
        titleColor: COLORS.textPrimary,
        subtitleColor: COLORS.success,
        cardBorder: 'rgba(76, 175, 80, 0.2)',
        cardBg: 'rgba(76, 175, 80, 0.05)',
        spineDotColor: COLORS.success,
      };
    case 'current':
      return {
        indicatorBg: COLORS.primary,
        indicatorBorder: COLORS.primaryLight,
        iconColor: '#FFFFFF',
        iconName: 'play' as const,
        titleColor: COLORS.textPrimary,
        subtitleColor: COLORS.primaryLight,
        cardBorder: 'rgba(220, 20, 60, 0.3)',
        cardBg: 'rgba(220, 20, 60, 0.08)',
        spineDotColor: COLORS.primary,
      };
    case 'locked':
    default:
      return {
        indicatorBg: COLORS.cardSurface,
        indicatorBorder: COLORS.cardBorder,
        iconColor: COLORS.textMuted,
        iconName: 'lock' as const,
        titleColor: COLORS.textMuted,
        subtitleColor: COLORS.textMuted,
        cardBorder: COLORS.cardBorder,
        cardBg: 'transparent',
        spineDotColor: COLORS.cardBorder,
      };
  }
}

/** Single tier row — indicator dot on spine + card with title, icon, progress */
function TierRow({
  data,
  onPress,
  isLast,
}: {
  data: TierNodeData;
  onPress: () => void;
  isLast: boolean;
}) {
  const config = getNodeConfig(data.state);
  const nodeTestID = data.state === 'current'
    ? 'lesson-node-current'
    : `tier-node-${data.tier}`;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      testID={nodeTestID}
      style={styles.rowContainer}
    >
      {/* Spine line segment (hidden on last item) */}
      <View style={styles.spineColumn}>
        {/* Indicator circle */}
        <View style={styles.indicatorWrapper}>
          {data.state === 'current' && <PulsingGlow />}
          <View style={[
            styles.indicator,
            {
              backgroundColor: config.indicatorBg,
              borderColor: config.indicatorBorder,
            },
            data.state === 'current' && styles.indicatorCurrent,
          ]}>
            <MaterialCommunityIcons
              name={config.iconName}
              size={data.state === 'current' ? 22 : 20}
              color={config.iconColor}
            />
          </View>
        </View>
        {/* Spine line below */}
        {!isLast && (
          <View style={[
            styles.spineLine,
            {
              backgroundColor: data.state === 'completed' || data.state === 'passed'
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(255, 255, 255, 0.04)',
            },
          ]} />
        )}
      </View>

      {/* Card content */}
      <View style={[
        styles.card,
        {
          borderColor: config.cardBorder,
          backgroundColor: config.cardBg,
        },
        data.state === 'current' && styles.cardCurrent,
      ]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.tierNumber, { color: config.subtitleColor }]}>
              {data.tier}
            </Text>
            <View style={styles.cardTitleGroup}>
              <Text
                style={[styles.cardTitle, { color: config.titleColor }]}
                numberOfLines={1}
              >
                {data.title}
              </Text>
              {/* Progress or locked hint */}
              {data.state === 'locked' ? (
                <Text style={styles.lockedHint}>Complete previous</Text>
              ) : (
                <Text style={[styles.progressText, { color: config.subtitleColor }]}>
                  {data.masteredCount}/{data.totalSkills} skills
                </Text>
              )}
            </View>
          </View>

          {/* Right side icon */}
          <View style={[styles.cardIcon, { opacity: data.state === 'locked' ? 0.3 : 0.6 }]}>
            <MaterialCommunityIcons
              name={data.icon as any}
              size={24}
              color={data.state === 'locked' ? COLORS.textMuted : config.subtitleColor}
            />
          </View>
        </View>

        {/* Progress bar for non-locked nodes */}
        {data.state !== 'locked' && data.totalSkills > 0 && (
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBg}>
              <View style={[
                styles.progressBarFill,
                {
                  width: `${Math.round((data.masteredCount / data.totalSkills) * 100)}%`,
                  backgroundColor: data.state === 'completed'
                    ? COLORS.starGold
                    : data.state === 'passed'
                      ? COLORS.success
                      : COLORS.primary,
                },
              ]} />
            </View>
          </View>
        )}

        {/* START chip for current */}
        {data.state === 'current' && (
          <View style={styles.startChip} testID="lesson-node-start-chip">
            <Text style={styles.startChipText}>START</Text>
            <MaterialCommunityIcons name="chevron-right" size={14} color={COLORS.textPrimary} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function LevelMapScreen() {
  const navigation = useNavigation<NavProp>();
  const nodes = useTierNodes();
  const scrollRef = useRef<ScrollView>(null);
  const gems = useGemStore((s) => s.gems);

  // Auto-scroll to current node
  useEffect(() => {
    const currentIndex = nodes.findIndex((n) => n.state === 'current');
    if (currentIndex >= 0 && scrollRef.current) {
      // Approximate row height: ~100px per row
      const scrollTarget = Math.max(0, currentIndex * 100 - SCREEN_HEIGHT / 3);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: scrollTarget, animated: true });
      }, 300);
    }
  }, [nodes]);

  const handleNodePress = useCallback(
    (data: TierNodeData) => {
      // Tiers with static lessons (1-6): always open LessonIntroScreen
      if (data.lessonId) {
        navigation.navigate('LessonIntro', {
          lessonId: data.lessonId,
          locked: data.state === 'locked',
        });
        return;
      }

      // Tiers 7+: locked nodes do nothing
      if (data.state === 'locked') return;

      // Tiers 7+ with unmastered skills: navigate to AI exercise
      if (data.firstUnmasteredSkillId) {
        const skill = getSkillById(data.firstUnmasteredSkillId);
        const fallback = skill?.targetExerciseIds.find((id) => getExercise(id));
        navigation.navigate('Exercise', {
          exerciseId: fallback ?? 'ai-mode',
          aiMode: true,
          skillId: data.firstUnmasteredSkillId,
        });
      }
    },
    [navigation]
  );

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const completedCount = nodes.filter((n) => n.state === 'completed').length;

  // Build flat list with section headers injected
  const listItems: Array<
    | { type: 'section'; label: string; key: string }
    | { type: 'node'; data: TierNodeData; index: number; key: string }
  > = useMemo(() => {
    const items: typeof listItems = [];
    nodes.forEach((data, index) => {
      // Insert section header if this index has one
      const sectionLabel = TIER_SECTIONS[index];
      if (sectionLabel) {
        items.push({ type: 'section', label: sectionLabel, key: `section-${index}` });
      }
      items.push({ type: 'node', data, index, key: `node-${data.tier}` });
    });
    return items;
  }, [nodes]);

  return (
    <View style={styles.container} testID="level-map-screen">
      <LinearGradient
        colors={[GRADIENTS.header[0], GRADIENTS.header[1], COLORS.background]}
        style={styles.header}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            onPress={handleGoBack}
            style={styles.backButton}
            testID="level-map-back"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Your Journey</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.headerStats}>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.success} />
            <Text style={styles.headerBadgeText}>{completedCount}/{nodes.length}</Text>
          </View>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="star" size={16} color={COLORS.starGold} />
            <Text style={styles.headerBadgeText}>
              {nodes.reduce((s, n) => s + n.masteredCount, 0)} skills
            </Text>
          </View>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="diamond-stone" size={16} color={COLORS.gemGold} />
            <Text style={styles.headerBadgeText}>{gems}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="level-map-scroll"
      >
        {listItems.map((item) => {
          if (item.type === 'section') {
            return (
              <View key={item.key} style={styles.sectionHeader}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionLabel}>{item.label}</Text>
                <View style={styles.sectionLine} />
              </View>
            );
          }
          return (
            <TierRow
              key={item.key}
              data={item.data}
              onPress={() => handleNodePress(item.data)}
              isLast={item.index === nodes.length - 1}
            />
          );
        })}

        {/* Salsa at journey start (bottom) */}
        <View style={styles.salsaFooter}>
          <SalsaCoach mood="encouraging" size="small" showCatchphrase />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: SPACING.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    ...TYPOGRAPHY.display.md,
    color: COLORS.textPrimary,
  },
  headerStats: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    justifyContent: 'center',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  headerBadgeText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACING.md,
    paddingBottom: 120,
    paddingHorizontal: SPACING.md,
  },

  // Section headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingLeft: INDICATOR_SIZE + SPACING.md + 4, // align with card area
    paddingRight: SPACING.sm,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sectionLabel: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // Row
  rowContainer: {
    flexDirection: 'row',
    minHeight: 80,
  },
  spineColumn: {
    width: INDICATOR_SIZE + SPACING.md,
    alignItems: 'center',
  },
  indicatorWrapper: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  indicator: {
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorCurrent: {
    width: INDICATOR_SIZE + 4,
    height: INDICATOR_SIZE + 4,
    borderRadius: (INDICATOR_SIZE + 4) / 2,
    borderWidth: 3,
  },
  pulsingGlow: {
    position: 'absolute',
    width: INDICATOR_SIZE + 16,
    height: INDICATOR_SIZE + 16,
    borderRadius: (INDICATOR_SIZE + 16) / 2,
    backgroundColor: COLORS.primary,
  },
  spineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -4,
    borderRadius: 1,
  },

  // Card
  card: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.sm,
    marginLeft: 4,
  },
  cardCurrent: {
    ...SHADOWS.md,
    shadowColor: COLORS.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  tierNumber: {
    ...TYPOGRAPHY.display.sm,
    fontWeight: '800',
    width: 32,
    textAlign: 'center',
  },
  cardTitleGroup: {
    flex: 1,
  },
  cardTitle: {
    ...TYPOGRAPHY.heading.sm,
    fontWeight: '600',
  },
  progressText: {
    ...TYPOGRAPHY.caption.md,
    fontWeight: '600',
    marginTop: 1,
  },
  lockedHint: {
    ...TYPOGRAPHY.caption.md,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 1,
  },
  cardIcon: {
    marginLeft: SPACING.sm,
  },

  // Progress bar
  progressBarContainer: {
    marginTop: 8,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 3,
    borderRadius: 2,
  },

  // Start chip
  startChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginTop: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  startChipText: {
    ...TYPOGRAPHY.special.badge,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },

  // Salsa footer
  salsaFooter: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
});

export default LevelMapScreen;
