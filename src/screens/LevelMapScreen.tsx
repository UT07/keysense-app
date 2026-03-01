/**
 * LevelMapScreen - Adventure-style winding path level map
 *
 * Circular nodes connected by SVG bezier curves in a zigzag pattern.
 * Inspired by Duolingo's skill tree / adventure game overworld.
 * Shows 15 tier nodes, all powered by AI-generated exercises.
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  FadeInUp,
} from 'react-native-reanimated';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useLearnerProfileStore } from '../stores/learnerProfileStore';
import { useProgressStore } from '../stores/progressStore';
import { useGemStore } from '../stores/gemStore';
import { useCatEvolutionStore } from '../stores/catEvolutionStore';
import { SKILL_TREE } from '../core/curriculum/SkillTree';
import { hasTierMasteryTestPassed } from '../core/curriculum/tierMasteryTest';
import { Cat3DCanvas } from '../components/Mascot/3d';
import { SalsaCoach } from '../components/Mascot/SalsaCoach';
import { COLORS, GRADIENTS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import { GradientMeshBackground } from '../components/effects';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Layout constants
const NODE_SIZE_CURRENT = 76;
const NODE_SIZE_NORMAL = 64;
const NODE_SIZE_LOCKED = 52;
const VERTICAL_SPACING = 130;
const SECTION_BANNER_HEIGHT = 50;
const TIER_LABEL_HEIGHT = 28;
const SALSA_AREA_HEIGHT = 100; // Space reserved for Salsa coach at the top
const TOP_PADDING = SALSA_AREA_HEIGHT + 12;
const BOTTOM_PADDING = 140;

/** Zigzag X fractions: center, left, center, right (repeating) */
const X_PATTERN = [0.5, 0.25, 0.5, 0.75];

// ---------------------------------------------------------------------------
// Tier theme data — each tier gets a unique environment color scheme
// ---------------------------------------------------------------------------

interface TierTheme {
  backgroundGradient: readonly [string, string];
  nodeColor: string;
  pathColor: string;
  label: string;
  emoji: string;
}

const TIER_THEMES: Record<number, TierTheme> = {
  1:  { backgroundGradient: ['#1A3A1A', '#0A1F0A'], nodeColor: '#4CAF50', pathColor: '#2E7D32', label: 'Grassland', emoji: '\u{1F331}' },
  2:  { backgroundGradient: ['#1A2A3A', '#0A1520'], nodeColor: '#42A5F5', pathColor: '#1565C0', label: 'Lake', emoji: '\u{1F30A}' },
  3:  { backgroundGradient: ['#3A2A1A', '#1F1508'], nodeColor: '#FF9800', pathColor: '#E65100', label: 'Desert', emoji: '\u{1F3DC}\uFE0F' },
  4:  { backgroundGradient: ['#2A3A2A', '#0F1F0F'], nodeColor: '#66BB6A', pathColor: '#388E3C', label: 'Forest', emoji: '\u{1F332}' },
  5:  { backgroundGradient: ['#3A3A2A', '#1F1F0A'], nodeColor: '#FFCA28', pathColor: '#F9A825', label: 'Plains', emoji: '\u{1F33E}' },
  6:  { backgroundGradient: ['#2A2A3A', '#0F0F20'], nodeColor: '#7E57C2', pathColor: '#4527A0', label: 'Night', emoji: '\u{1F303}' },
  7:  { backgroundGradient: ['#1A3A3A', '#0A1F1F'], nodeColor: '#26C6DA', pathColor: '#00838F', label: 'Ocean', emoji: '\u{1F30A}' },
  8:  { backgroundGradient: ['#3A1A2A', '#200A15'], nodeColor: '#EC407A', pathColor: '#AD1457', label: 'Cave', emoji: '\u{1FAA8}' },
  9:  { backgroundGradient: ['#2A2A1A', '#15150A'], nodeColor: '#FFA726', pathColor: '#EF6C00', label: 'Mountain', emoji: '\u{1F3D4}\uFE0F' },
  10: { backgroundGradient: ['#2A1A2A', '#150A15'], nodeColor: '#CE93D8', pathColor: '#7B1FA2', label: 'Concert Hall', emoji: '\u{1F3B5}' },
  11: { backgroundGradient: ['#1A1A3A', '#0A0A20'], nodeColor: '#5C6BC0', pathColor: '#283593', label: 'Jazz Club', emoji: '\u{1F3B7}' },
  12: { backgroundGradient: ['#3A2A2A', '#1F0F0F'], nodeColor: '#EF5350', pathColor: '#C62828', label: 'Volcano', emoji: '\u{1F30B}' },
  13: { backgroundGradient: ['#2A3A3A', '#0F1F1F'], nodeColor: '#80DEEA', pathColor: '#00838F', label: 'Crystal', emoji: '\u{1F48E}' },
  14: { backgroundGradient: ['#1A2A2A', '#0A1515'], nodeColor: '#AED581', pathColor: '#558B2F', label: 'Sky', emoji: '\u{2601}\uFE0F' },
  15: { backgroundGradient: ['#0A0A2A', '#050515'], nodeColor: '#FFD700', pathColor: '#FFA000', label: 'Space', emoji: '\u{1F680}' },
};

const DEFAULT_TIER_THEME: TierTheme = {
  backgroundGradient: ['#1A1A1A', '#0A0A0A'],
  nodeColor: COLORS.primary,
  pathColor: COLORS.primaryDark,
  label: 'Unknown',
  emoji: '\u{1F3B9}',
};

/** Metadata for each tier */
const TIER_META: Record<number, { title: string; icon: string }> = {
  1: { title: 'Note Finding', icon: 'music-note' },
  2: { title: 'Right Hand', icon: 'hand-pointing-right' },
  3: { title: 'Left Hand', icon: 'hand-pointing-left' },
  4: { title: 'Both Hands', icon: 'hand-clap' },
  5: { title: 'Scales', icon: 'stairs' },
  6: { title: 'Black Keys', icon: 'piano' },
  7: { title: 'G & F Major', icon: 'key-variant' },
  8: { title: 'Minor Keys', icon: 'music-accidental-flat' },
  9: { title: 'Chords', icon: 'cards' },
  10: { title: 'Songs', icon: 'music' },
  11: { title: 'Rhythm', icon: 'metronome' },
  12: { title: 'Arpeggios', icon: 'wave' },
  13: { title: 'Expression', icon: 'volume-high' },
  14: { title: 'Sight Reading', icon: 'eye' },
  15: { title: 'Performance', icon: 'trophy' },
};

/**
 * Cat companion per tier — lower tiers get starters/easy cats,
 * higher tiers get more exotic/expensive cats.
 * Maps tier number → catId. Each cat appears once or twice.
 */
const TIER_CAT_COMPANIONS: Record<number, string> = {
  1: 'mini-meowww',    // Starter — beginner friendly
  2: 'luna',           // Starter — mysterious moonlight
  3: 'jazzy',          // Starter — cool jazz
  4: 'biscuit',        // Cozy, fundamentals
  5: 'ballymakawww',   // Folk trad, scales & technique
  6: 'mini-meowww',    // Precision, black keys
  7: 'bella',          // Classical, key signatures
  8: 'sable',          // Dramatic, minor keys
  9: 'aria',           // Opera, chords
  10: 'shibu',         // Zen, popular songs
  11: 'tempo',         // Speed, rhythm
  12: 'ballymakawww',  // Folk arpeggios
  13: 'coda',          // Orchestral, expression
  14: 'aria',          // Perfect pitch, sight reading
  15: 'chonky-monke',  // Legendary, performance mastery
};

/** Section milestones */
const TIER_SECTIONS: Record<number, { label: string; icon: string; color: string }> = {
  0: { label: 'Beginner', icon: 'seed-outline', color: '#4CAF50' },
  4: { label: 'Fundamentals', icon: 'book-open-variant', color: '#2196F3' },
  6: { label: 'Intermediate', icon: 'fire', color: '#FF9800' },
  10: { label: 'Advanced', icon: 'lightning-bolt', color: '#9C27B0' },
  14: { label: 'Mastery', icon: 'crown', color: COLORS.starGold },
};

/** Cats unlockable at each section milestone */
const SECTION_CAT_REWARDS: Record<number, string> = {
  4: 'biscuit',
  6: 'ballymakawww',
  10: 'aria',
  14: 'coda',
};

type NodeState = 'completed' | 'passed' | 'current' | 'locked';

interface TierNodeData {
  tier: number;
  title: string;
  icon: string;
  state: NodeState;
  masteredCount: number;
  totalSkills: number;
  firstUnmasteredSkillId: string | null;
  testPassed: boolean;
}

interface NodePosition {
  x: number;
  y: number;
  size: number;
}

// ---------------------------------------------------------------------------
// Data hook
// ---------------------------------------------------------------------------

function useTierNodes(): TierNodeData[] {
  const masteredSkills = useLearnerProfileStore((s) => s.masteredSkills);
  const tierTestResults = useProgressStore((s) => s.tierTestResults);

  return useMemo(() => {
    const masteredSet = new Set(masteredSkills);
    const skillsByTier = new Map<number, typeof SKILL_TREE>();
    for (const skill of SKILL_TREE) {
      const list = skillsByTier.get(skill.tier) ?? [];
      list.push(skill);
      skillsByTier.set(skill.tier, list);
    }
    const tiers = Array.from(skillsByTier.keys()).sort((a, b) => a - b);

    const rawTiers = tiers.map((tier) => {
      const skills = skillsByTier.get(tier) ?? [];
      const masteredCount = skills.filter((s) => masteredSet.has(s.id)).length;
      const totalSkills = skills.length;
      const isComplete = totalSkills > 0 && masteredCount === totalSkills;
      const meta = TIER_META[tier] ?? { title: `Tier ${tier}`, icon: 'star' };
      const firstUnmastered = skills.find((s) => !masteredSet.has(s.id));
      return {
        tier, title: meta.title, icon: meta.icon,
        masteredCount, totalSkills, isComplete,
        firstUnmasteredSkillId: firstUnmastered?.id ?? null,
      };
    });

    const accessible = rawTiers.map((_, i) => i === 0 || rawTiers[i - 1].isComplete);
    let currentIndex = -1;
    for (let i = rawTiers.length - 1; i >= 0; i--) {
      if (accessible[i] && !rawTiers[i].isComplete) { currentIndex = i; break; }
    }

    return rawTiers.map((raw, i) => {
      let state: NodeState;
      if (raw.isComplete) state = 'completed';
      else if (accessible[i] && i === currentIndex) state = 'current';
      else if (accessible[i]) state = 'passed';
      else state = 'locked';
      return {
        tier: raw.tier, title: raw.title, icon: raw.icon, state,
        masteredCount: raw.masteredCount, totalSkills: raw.totalSkills,
        firstUnmasteredSkillId: raw.firstUnmasteredSkillId,
        testPassed: hasTierMasteryTestPassed(raw.tier, tierTestResults),
      };
    });
  }, [masteredSkills, tierTestResults]);
}

// ---------------------------------------------------------------------------
// Position calculation
// ---------------------------------------------------------------------------

function useNodePositions(nodes: TierNodeData[], screenWidth: number) {
  return useMemo(() => {
    const usableWidth = screenWidth - SPACING.lg * 2;
    const positions: NodePosition[] = new Array(nodes.length);
    const sectionBannerPositions: { index: number; y: number }[] = [];
    const tierLabelPositions: { tier: number; y: number }[] = [];
    let currentY = TOP_PADDING;
    let patternIndex = 0;
    let previousTier = -1;

    // Bottom-to-top: place highest tier at top, tier 1 at bottom
    for (let ri = nodes.length - 1; ri >= 0; ri--) {
      // Section banners placed before their first node (in visual order)
      if (TIER_SECTIONS[ri]) {
        sectionBannerPositions.push({ index: ri, y: currentY });
        currentY += SECTION_BANNER_HEIGHT;
      }

      // Tier theme label at each tier's zone
      const currentTier = nodes[ri].tier;
      if (currentTier !== previousTier) {
        tierLabelPositions.push({ tier: currentTier, y: currentY });
        currentY += TIER_LABEL_HEIGHT;
      }
      previousTier = currentTier;

      const state = nodes[ri].state;
      const size = state === 'current' ? NODE_SIZE_CURRENT
        : state === 'locked' ? NODE_SIZE_LOCKED
        : NODE_SIZE_NORMAL;

      const xFrac = X_PATTERN[patternIndex % X_PATTERN.length];
      const x = SPACING.lg + usableWidth * xFrac;

      positions[ri] = { x, y: currentY, size };
      currentY += VERTICAL_SPACING;
      patternIndex++;
    }

    const totalHeight = currentY + BOTTOM_PADDING;
    return { positions, sectionBannerPositions, tierLabelPositions, totalHeight };
  }, [nodes, screenWidth]);
}

// ---------------------------------------------------------------------------
// Node style helpers
// ---------------------------------------------------------------------------

function getNodeColors(state: NodeState, theme: TierTheme) {
  switch (state) {
    case 'completed':
      return {
        bg: COLORS.starGold,
        border: COLORS.starGold,
        iconColor: '#1A1400',
        textColor: COLORS.textPrimary,
        subtitleColor: COLORS.starGold,
      };
    case 'passed':
      return {
        bg: COLORS.success,
        border: COLORS.success,
        iconColor: '#FFFFFF',
        textColor: COLORS.textPrimary,
        subtitleColor: COLORS.success,
      };
    case 'current':
      return {
        bg: theme.nodeColor,
        border: theme.nodeColor,
        iconColor: '#FFFFFF',
        textColor: COLORS.textPrimary,
        subtitleColor: theme.nodeColor,
      };
    case 'locked':
    default:
      return {
        bg: COLORS.cardSurface,
        border: COLORS.cardBorder,
        iconColor: COLORS.textMuted,
        textColor: COLORS.textMuted,
        subtitleColor: COLORS.textMuted,
      };
  }
}

// ---------------------------------------------------------------------------
// PulsingGlow (Reanimated)
// ---------------------------------------------------------------------------

function PulsingGlow({ size, color }: { size: number; color?: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 1500 }),
        withTiming(1, { duration: 0 }),
      ),
      -1,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1500 }),
        withTiming(0.4, { duration: 0 }),
      ),
      -1,
    );
  }, [scale, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const glowSize = size + 20;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: glowSize,
          height: glowSize,
          borderRadius: glowSize / 2,
          backgroundColor: color ?? COLORS.primary,
          left: -(glowSize - size) / 2,
          top: -(glowSize - size) / 2,
        },
        animStyle,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// PathConnections (SVG)
// ---------------------------------------------------------------------------

function PathConnections({
  positions,
  nodes,
  totalHeight,
  screenWidth,
}: {
  positions: NodePosition[];
  nodes: TierNodeData[];
  totalHeight: number;
  screenWidth: number;
}) {
  if (positions.length < 2) return null;

  const paths: React.ReactElement[] = [];

  for (let i = 0; i < positions.length - 1; i++) {
    const from = positions[i];
    const to = positions[i + 1];
    const fromY = from.y + from.size / 2;
    const toY = to.y + to.size / 2;
    const midY = (fromY + toY) / 2;

    // Control point: use the source node's X for a natural S-curve
    const controlX = from.x;

    const d = `M ${from.x} ${fromY} Q ${controlX} ${midY} ${to.x} ${toY}`;

    const isCompleted = nodes[i].state === 'completed' || nodes[i].state === 'passed';
    const tierTheme = TIER_THEMES[nodes[i].tier] ?? DEFAULT_TIER_THEME;

    paths.push(
      <Path
        key={`path-${i}`}
        d={d}
        stroke={isCompleted ? 'rgba(255, 215, 0, 0.25)' : `${tierTheme.pathColor}30`}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={isCompleted ? undefined : '8 8'}
      />
    );
  }

  return (
    <Svg
      width={screenWidth}
      height={totalHeight}
      style={StyleSheet.absoluteFill}
    >
      {paths}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// PathNode
// ---------------------------------------------------------------------------

function PathNode({
  data,
  position,
  index,
  onPress,
  tierCatId,
}: {
  data: TierNodeData;
  position: NodePosition;
  index: number;
  onPress: () => void;
  tierCatId: string;
}) {
  const theme = TIER_THEMES[data.tier] ?? DEFAULT_TIER_THEME;
  const colors = getNodeColors(data.state, theme);
  const { size } = position;
  const nodeTestID = data.state === 'current' ? 'lesson-node-current' : `tier-node-${data.tier}`;

  // Icon inside the circle -- crown for completed + test passed
  const iconName = data.state === 'completed' && data.testPassed ? 'crown'
    : data.state === 'completed' ? 'check-bold'
    : data.state === 'passed' ? 'check'
    : data.state === 'locked' ? 'lock'
    : data.icon;

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).duration(300)}
      style={[
        styles.nodeWrapper,
        {
          left: position.x - size / 2,
          top: position.y,
          width: size,
          alignItems: 'center',
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        testID={nodeTestID}
        style={{ alignItems: 'center' }}
      >
        {/* Pulsing glow for current */}
        {data.state === 'current' && <PulsingGlow size={size} color={theme.nodeColor} />}

        {/* Circle node */}
        <View style={[
          styles.nodeCircle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.bg,
            borderColor: colors.border,
            borderWidth: data.state === 'current' ? 3 : 2,
          },
          data.state === 'current' && { ...SHADOWS.md, shadowColor: theme.nodeColor },
          data.state === 'completed' && { ...SHADOWS.sm, shadowColor: COLORS.starGold },
        ]}>
          <MaterialCommunityIcons
            name={iconName as any}
            size={data.state === 'current' ? 28 : data.state === 'locked' ? 20 : 24}
            color={colors.iconColor}
          />
        </View>

        {/* Label below */}
        <View style={styles.nodeLabel}>
          <Text style={[styles.nodeTier, { color: colors.subtitleColor }]}>
            {data.tier}
          </Text>
          <Text
            style={[styles.nodeTitle, { color: colors.textColor }]}
            numberOfLines={1}
          >
            {data.title}
          </Text>
          {data.state !== 'locked' && data.totalSkills > 0 && (
            <Text style={[styles.nodeProgress, { color: colors.subtitleColor }]}>
              {data.masteredCount}/{data.totalSkills}
            </Text>
          )}
        </View>

        {/* START chip */}
        {data.state === 'current' && (
          <View style={[styles.startChip, { backgroundColor: theme.nodeColor }]} testID="lesson-node-start-chip">
            <Text style={styles.startChipText}>START</Text>
            <MaterialCommunityIcons name="chevron-right" size={12} color={COLORS.textPrimary} />
          </View>
        )}

        {/* TEST chip -- shown when all skills mastered but test not passed */}
        {data.state === 'completed' && !data.testPassed && (
          <View style={styles.testChip} testID={`tier-${data.tier}-test-chip`}>
            <MaterialCommunityIcons name="trophy-outline" size={10} color={COLORS.starGold} />
            <Text style={styles.testChipText}>TEST</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Cat companion for this tier */}
      <View style={[
        styles.catCompanion,
        data.state === 'locked' && styles.catCompanionLocked,
      ]}>
        <Cat3DCanvas
          catId={tierCatId}
          size={48}
          mood={data.state === 'current' ? 'encouraging' : data.state === 'completed' ? 'happy' : 'teaching'}
          pose={data.state === 'current' ? 'teach' : data.state === 'completed' ? 'celebrate' : 'idle'}
          forceSVG
        />
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// SectionBanner
// ---------------------------------------------------------------------------

function SectionBanner({
  section,
  y,
  isCompleted,
  rewardCatId,
  ownedCats,
}: {
  section: { label: string; icon: string; color: string };
  y: number;
  isCompleted: boolean;
  rewardCatId?: string;
  ownedCats: string[];
}) {
  const catOwned = rewardCatId ? ownedCats.includes(rewardCatId) : false;

  return (
    <View style={[styles.sectionBanner, { top: y }]}>
      <View style={styles.sectionBannerLine} />
      <View style={[styles.sectionBannerPill, { borderColor: `${section.color}40` }]}>
        <MaterialCommunityIcons
          name={section.icon as any}
          size={14}
          color={isCompleted ? section.color : COLORS.textMuted}
        />
        <Text style={[
          styles.sectionLabel,
          { color: isCompleted ? section.color : COLORS.textMuted },
        ]}>
          {section.label}
        </Text>
        {rewardCatId && (
          <View style={styles.sectionRewardBadge}>
            {catOwned ? (
              <Cat3DCanvas
                catId={rewardCatId}
                size={40}
                mood="happy"
                pose="idle"
                forceSVG
              />
            ) : (
              <View style={styles.sectionRewardLocked}>
                <MaterialCommunityIcons name="cat" size={12} color={COLORS.textMuted} />
                <MaterialCommunityIcons name="lock" size={8} color={COLORS.textMuted} style={{ position: 'absolute', right: -2, bottom: -2 }} />
              </View>
            )}
          </View>
        )}
      </View>
      <View style={styles.sectionBannerLine} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// TierThemeLabel — subtle zone label between tier transitions
// ---------------------------------------------------------------------------

function TierThemeLabel({ tier, y }: { tier: number; y: number }) {
  const theme = TIER_THEMES[tier] ?? DEFAULT_TIER_THEME;
  return (
    <View style={[styles.tierThemeLabel, { top: y }]} testID={`tier-theme-label-${tier}`}>
      <Text style={[styles.tierThemeLabelText, { color: `${theme.nodeColor}80` }]}>
        {theme.emoji} {theme.label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export function LevelMapScreen() {
  const navigation = useNavigation<NavProp>();
  const canGoBack = useNavigationState((s) => s.routes.length > 1);
  const nodes = useTierNodes();
  const scrollRef = useRef<ScrollView>(null);
  const hasAutoScrolledRef = useRef(false); // BUG-020 fix: only auto-scroll once on mount
  const { width: screenWidth } = useWindowDimensions();
  const gems = useGemStore((s) => s.gems);
  const ownedCats = useCatEvolutionStore((s) => s.ownedCats);

  const { positions, sectionBannerPositions, tierLabelPositions, totalHeight } = useNodePositions(nodes, screenWidth);

  // Auto-scroll to current node on initial mount only
  // BUG-020 fix: was re-scrolling on every store update, jumping the user's scroll position
  useEffect(() => {
    if (hasAutoScrolledRef.current) return;
    const currentIndex = nodes.findIndex((n) => n.state === 'current');
    if (currentIndex >= 0 && positions[currentIndex] && scrollRef.current) {
      hasAutoScrolledRef.current = true;
      const targetY = Math.max(0, positions[currentIndex].y - 250);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: targetY, animated: true });
      }, 400);
    }
  }, [nodes, positions]);

  const handleNodePress = useCallback(
    (data: TierNodeData) => {
      navigation.navigate('TierIntro', {
        tier: data.tier,
        locked: data.state === 'locked',
      });
    },
    [navigation]
  );

  const handleGoBack = useCallback(() => { navigation.goBack(); }, [navigation]);

  const completedCount = nodes.filter((n) => n.state === 'completed').length;

  // Section completion state
  const isSectionCompleted = useMemo(() => {
    const result: Record<number, boolean> = {};
    const sectionStarts = Object.keys(TIER_SECTIONS).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < sectionStarts.length; i++) {
      const start = sectionStarts[i];
      const end = i + 1 < sectionStarts.length ? sectionStarts[i + 1] : nodes.length;
      const sectionNodes = nodes.slice(start, end);
      result[start] = sectionNodes.length > 0 && sectionNodes.every((n) => n.state === 'completed');
    }
    return result;
  }, [nodes]);

  return (
    <View style={styles.container} testID="level-map-screen">
      <GradientMeshBackground accent="learn" />
      {/* Header */}
      <LinearGradient
        colors={[GRADIENTS.header[0], GRADIENTS.header[1], COLORS.background]}
        style={styles.header}
      >
        <View style={styles.headerTopRow}>
          {canGoBack ? (
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton} testID="level-map-back">
              <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backButton} />
          )}
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

      {/* Scrollable map */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { height: totalHeight }]}
        showsVerticalScrollIndicator={false}
        testID="level-map-scroll"
      >
        {/* SVG path connections (behind everything) */}
        <PathConnections
          positions={positions}
          nodes={nodes}
          totalHeight={totalHeight}
          screenWidth={screenWidth}
        />

        {/* Section banners (absolutely positioned) */}
        {sectionBannerPositions.map(({ index, y }) => {
          const section = TIER_SECTIONS[index];
          return (
            <SectionBanner
              key={`section-${index}`}
              section={section}
              y={y}
              isCompleted={isSectionCompleted[index] ?? false}
              rewardCatId={SECTION_CAT_REWARDS[index]}
              ownedCats={ownedCats}
            />
          );
        })}

        {/* Tier theme labels (absolutely positioned) */}
        {tierLabelPositions.map(({ tier, y }) => (
          <TierThemeLabel key={`tier-label-${tier}`} tier={tier} y={y} />
        ))}

        {/* Path nodes (absolutely positioned) */}
        {nodes.map((data, index) => (
          <PathNode
            key={`node-${data.tier}`}
            data={data}
            position={positions[index]}
            index={index}
            onPress={() => handleNodePress(data)}
            tierCatId={TIER_CAT_COMPANIONS[data.tier] ?? 'mini-meowww'}
          />
        ))}

        {/* Salsa at the top — cheering you toward the summit */}
        <View style={[styles.salsaFooter, { top: 0, height: SALSA_AREA_HEIGHT }]}>
          <SalsaCoach mood="encouraging" size="small" showCatchphrase />
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: SPACING.lg },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  title: { ...TYPOGRAPHY.display.md, color: COLORS.textPrimary },
  headerStats: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm, justifyContent: 'center' },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BORDER_RADIUS.full,
  },
  headerBadgeText: { ...TYPOGRAPHY.body.md, fontWeight: '700', color: COLORS.textSecondary },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { position: 'relative' },

  // Node
  nodeWrapper: { position: 'absolute', alignItems: 'center' },
  nodeCircle: {
    alignItems: 'center', justifyContent: 'center',
  },
  nodeLabel: { alignItems: 'center', marginTop: 6, width: 100 },
  nodeTier: {
    ...TYPOGRAPHY.caption.lg, fontWeight: '800', letterSpacing: 1,
  },
  nodeTitle: {
    ...TYPOGRAPHY.caption.lg, fontWeight: '600', textAlign: 'center',
  },
  nodeProgress: {
    ...TYPOGRAPHY.caption.sm, fontWeight: '600', marginTop: 1,
  },

  // START chip
  startChip: {
    flexDirection: 'row', alignItems: 'center',
    gap: 2, marginTop: 6, backgroundColor: COLORS.primary,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: BORDER_RADIUS.full,
  },
  startChipText: {
    ...TYPOGRAPHY.special.badge, fontWeight: '800',
    color: COLORS.textPrimary, letterSpacing: 1,
  },

  // TEST chip
  testChip: {
    flexDirection: 'row', alignItems: 'center',
    gap: 2, marginTop: 4, backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: BORDER_RADIUS.full,
    borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  testChipText: {
    ...TYPOGRAPHY.special.badge, fontWeight: '800',
    color: COLORS.starGold, letterSpacing: 1, fontSize: 9,
  },

  // Cat companion
  catCompanion: {
    position: 'absolute',
    right: -44,
    top: 4,
  },
  catCompanionLocked: {
    opacity: 0.3,
  },

  // Section banner
  sectionBanner: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, height: SECTION_BANNER_HEIGHT,
  },
  sectionBannerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  sectionBannerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  sectionLabel: {
    ...TYPOGRAPHY.caption.lg, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  sectionRewardBadge: { marginLeft: 4 },
  sectionRewardLocked: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Tier theme label
  tierThemeLabel: {
    position: 'absolute', left: 0, right: 0,
    height: TIER_LABEL_HEIGHT,
    alignItems: 'center', justifyContent: 'center',
  },
  tierThemeLabelText: {
    ...TYPOGRAPHY.caption.sm, fontWeight: '600',
    letterSpacing: 1, textTransform: 'uppercase',
  },

  // Salsa footer
  salsaFooter: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
});

export default LevelMapScreen;
