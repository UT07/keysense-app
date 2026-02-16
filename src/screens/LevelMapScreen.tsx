/**
 * LevelMapScreen - Duolingo-style vertical scrolling level map
 * Winding path with 80px nodes, gold/crimson/grey states,
 * Bezier curve connectors, decorative elements, parallax scroll
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
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useProgressStore } from '../stores/progressStore';
import { getLessons, getLessonExercises } from '../content/ContentLoader';
import type { LessonManifest } from '../content/ContentLoader';
import { COLORS, GRADIENTS, SPACING, BORDER_RADIUS } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const NODE_SIZE = 80;
const NODE_SPACING_Y = 150;
const ZIGZAG_OFFSET = SCREEN_WIDTH * 0.2;

type NodeState = 'completed' | 'current' | 'locked';

interface LessonNodeData {
  lesson: LessonManifest;
  state: NodeState;
  stars: number;
  completedCount: number;
  totalExercises: number;
  targetExerciseId: string | null;
}

function useLessonNodes(): LessonNodeData[] {
  const { lessonProgress } = useProgressStore();
  const lessons = useMemo(() => getLessons(), []);

  return useMemo(() => {
    let foundCurrent = false;

    return lessons.map((lesson, index) => {
      const progress = lessonProgress[lesson.id];
      const isCompleted = progress?.status === 'completed';
      const prevLessonId = index > 0 ? lessons[index - 1].id : null;
      const isPrevCompleted = index === 0 || lessonProgress[prevLessonId!]?.status === 'completed';

      const exercises = getLessonExercises(lesson.id);
      const exerciseScores = progress?.exerciseScores ?? {};
      const completedCount = Object.values(exerciseScores).filter((s) => s.completedAt != null).length;
      const totalStars = Object.values(exerciseScores).reduce(
        (sum, s) => sum + (s.stars ?? 0),
        0
      );

      const nextExercise = exercises.find((ex) => {
        const score = exerciseScores[ex.id];
        return !score || score.completedAt == null;
      });
      const targetExerciseId = nextExercise?.id ?? exercises[0]?.id ?? null;

      let state: NodeState;
      if (isCompleted) {
        state = 'completed';
      } else if (isPrevCompleted && !foundCurrent) {
        state = 'current';
        foundCurrent = true;
      } else {
        state = 'locked';
      }

      return { lesson, state, stars: totalStars, completedCount, totalExercises: exercises.length, targetExerciseId };
    });
  }, [lessons, lessonProgress]);
}

function getNodeX(index: number): number {
  const center = SCREEN_WIDTH / 2;
  // S-curve pattern for more visual interest
  const offset = ZIGZAG_OFFSET * Math.sin((index * Math.PI) / 2);
  return center + offset;
}

function getNodeY(index: number, totalNodes: number): number {
  const reverseIndex = totalNodes - 1 - index;
  return 100 + reverseIndex * NODE_SPACING_Y;
}

function getConnectorPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const midY = (fromY + toY) / 2;
  const controlOffset = Math.abs(toX - fromX) * 0.3;
  return `M ${fromX} ${fromY} C ${fromX + controlOffset} ${midY - 20}, ${toX - controlOffset} ${midY + 20}, ${toX} ${toY}`;
}

/** Animated pulsing glow ring for current node */
function PulsingGlow() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.5,
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
          Animated.timing(opacityAnim, { toValue: 0.5, duration: 0, useNativeDriver: true }),
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

/** Star display with gold/empty stars */
function StarRow({ earned, max }: { earned: number; max: number }) {
  const display = Math.min(3, max);
  // Normalize: if max exercises is 5 and you earned 12 stars, cap display at 3
  const filled = Math.min(display, Math.ceil(earned / Math.max(1, max / 3)));
  return (
    <View style={styles.starRow}>
      {Array.from({ length: display }).map((_, i) => (
        <MaterialCommunityIcons
          key={i}
          name={i < filled ? 'star' : 'star-outline'}
          size={16}
          color={i < filled ? COLORS.starGold : COLORS.starEmpty}
        />
      ))}
    </View>
  );
}

/** Individual lesson node */
function LessonNode({
  data,
  x,
  y,
  onPress,
}: {
  data: LessonNodeData;
  x: number;
  y: number;
  onPress: () => void;
}) {
  const config = NODE_CONFIGS[data.state];

  return (
    <TouchableOpacity
      activeOpacity={data.state === 'locked' ? 1 : 0.7}
      onPress={onPress}
      style={[styles.nodeWrapper, { left: x - NODE_SIZE / 2, top: y - NODE_SIZE / 2 }]}
    >
      {data.state === 'current' && <PulsingGlow />}

      <View style={[styles.nodeCircle, config.circleStyle]}>
        {/* Inner content */}
        {data.state === 'completed' && (
          <MaterialCommunityIcons name="check-bold" size={32} color="#FFFFFF" />
        )}
        {data.state === 'current' && (
          <View style={styles.startBtnInner}>
            <MaterialCommunityIcons name="play" size={28} color="#FFFFFF" />
          </View>
        )}
        {data.state === 'locked' && (
          <MaterialCommunityIcons name="lock" size={24} color={COLORS.textMuted} />
        )}
      </View>

      {/* Label below node */}
      <Text style={[styles.nodeLabel, config.labelStyle]} numberOfLines={2}>
        {data.lesson.metadata.title}
      </Text>

      {/* Stars for completed */}
      {data.state === 'completed' && (
        <StarRow earned={data.stars} max={data.totalExercises} />
      )}

      {/* "START" text for current */}
      {data.state === 'current' && (
        <View style={styles.startChip}>
          <Text style={styles.startChipText}>START</Text>
        </View>
      )}

      {/* Progress count for current with progress */}
      {data.state === 'current' && data.completedCount > 0 && (
        <Text style={styles.nodeProgress}>
          {data.completedCount}/{data.totalExercises}
        </Text>
      )}

      {/* Level requirement for locked */}
      {data.state === 'locked' && (
        <Text style={styles.lockedHint}>Complete previous</Text>
      )}
    </TouchableOpacity>
  );
}

/** Decorative floating music notes on the path */
function DecorationLayer({ count, height }: { count: number; height: number }) {
  const decorations = useMemo(() => {
    const items: { x: number; y: number; char: string; opacity: number }[] = [];
    const chars = ['\u266A', '\u266B', '\u2669', '\u{1F3B5}'];
    for (let i = 0; i < count; i++) {
      items.push({
        x: 20 + Math.random() * (SCREEN_WIDTH - 40),
        y: 80 + Math.random() * (height - 160),
        char: chars[i % chars.length],
        opacity: 0.06 + Math.random() * 0.06,
      });
    }
    return items;
  }, [count, height]);

  return (
    <>
      {decorations.map((d, i) => (
        <Text
          key={`deco-${i}`}
          style={[
            styles.decoration,
            { left: d.x, top: d.y, opacity: d.opacity },
          ]}
        >
          {d.char}
        </Text>
      ))}
    </>
  );
}

export function LevelMapScreen() {
  const navigation = useNavigation<NavProp>();
  const nodes = useLessonNodes();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const currentIndex = nodes.findIndex((n) => n.state === 'current');
    if (currentIndex >= 0 && scrollRef.current) {
      const y = getNodeY(currentIndex, nodes.length);
      const scrollTarget = Math.max(0, y - SCREEN_HEIGHT / 2 + NODE_SIZE);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: scrollTarget, animated: true });
      }, 300);
    }
  }, [nodes]);

  const handleNodePress = useCallback(
    (data: LessonNodeData) => {
      if (data.state === 'locked') return;
      navigation.navigate('LessonIntro', { lessonId: data.lesson.id });
    },
    [navigation]
  );

  const contentHeight = 100 + nodes.length * NODE_SPACING_Y + 80;

  const connectors = useMemo(() => {
    const paths: React.ReactElement[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const fromX = getNodeX(i);
      const fromY = getNodeY(i, nodes.length);
      const toX = getNodeX(i + 1);
      const toY = getNodeY(i + 1, nodes.length);

      const isFromCompleted = nodes[i].state === 'completed';
      const isToAvailable = nodes[i + 1].state !== 'locked';

      let pathColor: string;
      let pathWidth: number;
      let dashArray: string | undefined;

      if (isFromCompleted && isToAvailable) {
        pathColor = COLORS.starGold;
        pathWidth = 3;
        dashArray = undefined;
      } else if (isFromCompleted) {
        pathColor = COLORS.success;
        pathWidth = 3;
        dashArray = undefined;
      } else {
        pathColor = COLORS.cardBorder;
        pathWidth = 2;
        dashArray = '10,8';
      }

      paths.push(
        <Path
          key={`path-${i}`}
          d={getConnectorPath(fromX, fromY, toX, toY)}
          stroke={pathColor}
          strokeWidth={pathWidth}
          fill="none"
          strokeDasharray={dashArray}
          strokeLinecap="round"
        />
      );
    }
    return paths;
  }, [nodes]);

  const completedCount = nodes.filter((n) => n.state === 'completed').length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[GRADIENTS.header[0], GRADIENTS.header[1], COLORS.background]}
        style={styles.header}
      >
        <Text style={styles.title}>Your Journey</Text>
        <View style={styles.headerStats}>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.success} />
            <Text style={styles.headerBadgeText}>{completedCount}/{nodes.length}</Text>
          </View>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="star" size={16} color={COLORS.starGold} />
            <Text style={styles.headerBadgeText}>
              {nodes.reduce((s, n) => s + n.stars, 0)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{ height: contentHeight }}
        showsVerticalScrollIndicator={false}
      >
        {/* Decorative elements */}
        <DecorationLayer count={12} height={contentHeight} />

        {/* SVG Connectors */}
        <Svg
          width={SCREEN_WIDTH}
          height={contentHeight}
          style={StyleSheet.absoluteFill}
        >
          {connectors}
        </Svg>

        {/* Nodes */}
        {nodes.map((data, index) => (
          <LessonNode
            key={data.lesson.id}
            data={data}
            x={getNodeX(index)}
            y={getNodeY(index, nodes.length)}
            onPress={() => handleNodePress(data)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const NODE_CONFIGS = {
  completed: {
    circleStyle: {
      backgroundColor: COLORS.starGold,
      borderColor: '#D4A800',
      shadowColor: COLORS.starGold,
      shadowOpacity: 0.3,
      shadowRadius: 8,
    } as const,
    labelStyle: { color: COLORS.textSecondary } as const,
  },
  current: {
    circleStyle: {
      backgroundColor: COLORS.primary,
      borderColor: '#A3102E',
      shadowColor: COLORS.primary,
      shadowOpacity: 0.4,
      shadowRadius: 12,
    } as const,
    labelStyle: { color: COLORS.primary, fontWeight: '700' as const } as const,
  },
  locked: {
    circleStyle: {
      backgroundColor: COLORS.cardSurface,
      borderColor: COLORS.cardBorder,
    } as const,
    labelStyle: { color: COLORS.textMuted } as const,
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: SPACING.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerStats: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
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
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  // Nodes
  nodeWrapper: {
    position: 'absolute',
    width: NODE_SIZE + 80,
    alignItems: 'center',
  },
  pulsingGlow: {
    position: 'absolute',
    width: NODE_SIZE + 24,
    height: NODE_SIZE + 24,
    borderRadius: (NODE_SIZE + 24) / 2,
    backgroundColor: COLORS.primary,
    top: -12,
  },
  nodeCircle: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  startBtnInner: {
    width: NODE_SIZE - 12,
    height: NODE_SIZE - 12,
    borderRadius: (NODE_SIZE - 12) / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: NODE_SIZE + 60,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  startChip: {
    marginTop: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  startChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  nodeProgress: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  lockedHint: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  // Decorations
  decoration: {
    position: 'absolute',
    fontSize: 24,
    color: COLORS.textMuted,
  },
});

export default LevelMapScreen;
