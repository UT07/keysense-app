/**
 * LevelMapScreen - Vertical scrolling level map (replaces LearnScreen)
 * Nodes zigzag left-right, connected by SVG paths
 * Node states: completed (green), current (pulsing), locked (grey)
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
import { useProgressStore } from '../stores/progressStore';
import { getLessons, getLessonExercises } from '../content/ContentLoader';
import type { LessonManifest } from '../content/ContentLoader';
import type { RootStackParamList } from '../navigation/AppNavigator';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const NODE_SIZE = 72;
const NODE_SPACING_Y = 130;
const ZIGZAG_OFFSET = SCREEN_WIDTH * 0.22;

type NodeState = 'completed' | 'current' | 'locked';

interface LessonNodeData {
  lesson: LessonManifest;
  state: NodeState;
  stars: number;
  completedCount: number;
  totalExercises: number;
  targetExerciseId: string | null;
}

/**
 * Compute node data from lesson manifests and progress
 */
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

      // Calculate stars and completion
      const exercises = getLessonExercises(lesson.id);
      const exerciseScores = progress?.exerciseScores ?? {};
      const completedCount = Object.values(exerciseScores).filter((s) => s.completedAt != null).length;

      // Total stars across completed exercises
      const totalStars = Object.values(exerciseScores).reduce(
        (sum, s) => sum + (s.stars ?? 0),
        0
      );

      // Find target exercise (first uncompleted)
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

      return {
        lesson,
        state,
        stars: totalStars,
        completedCount,
        totalExercises: exercises.length,
        targetExerciseId,
      };
    });
  }, [lessons, lessonProgress]);
}

/**
 * Get x position for zigzag layout
 */
function getNodeX(index: number): number {
  const center = SCREEN_WIDTH / 2;
  return index % 2 === 0 ? center - ZIGZAG_OFFSET : center + ZIGZAG_OFFSET;
}

/**
 * Get y position for node (top-down, inverted for bottom-up feel)
 */
function getNodeY(index: number, totalNodes: number): number {
  // Bottom node is index 0, top node is last
  const reverseIndex = totalNodes - 1 - index;
  return 80 + reverseIndex * NODE_SPACING_Y;
}

/**
 * Generate SVG path between two nodes
 */
function getConnectorPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): string {
  const midY = (fromY + toY) / 2;
  return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`;
}

/**
 * Pulsing current node indicator
 */
function PulsingRing() {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.4,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [scaleAnim, opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.pulsingRing,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    />
  );
}

/**
 * Star display for completed nodes
 */
function StarDisplay({ stars, max }: { stars: number; max: number }) {
  return (
    <View style={styles.starRow}>
      {Array.from({ length: Math.min(3, max) }).map((_, i) => (
        <MaterialCommunityIcons
          key={i}
          name={i < stars ? 'star' : 'star-outline'}
          size={14}
          color={i < stars ? '#FFD700' : '#BDBDBD'}
        />
      ))}
    </View>
  );
}

/**
 * Individual lesson node
 */
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
  const nodeStyle = NODE_STYLES[data.state];

  const icon: IconName =
    data.state === 'completed'
      ? 'check-bold'
      : data.state === 'locked'
        ? 'lock'
        : 'play';

  return (
    <TouchableOpacity
      activeOpacity={data.state === 'locked' ? 1 : 0.7}
      onPress={onPress}
      style={[
        styles.nodeWrapper,
        {
          left: x - NODE_SIZE / 2,
          top: y - NODE_SIZE / 2,
        },
      ]}
    >
      {data.state === 'current' && <PulsingRing />}

      <View style={[styles.nodeCircle, nodeStyle.circle]}>
        <MaterialCommunityIcons
          name={icon}
          size={28}
          color={nodeStyle.iconColor}
        />
      </View>

      {/* Label */}
      <Text
        style={[styles.nodeLabel, nodeStyle.label]}
        numberOfLines={2}
      >
        {data.lesson.metadata.title}
      </Text>

      {/* Stars for completed lessons */}
      {data.state === 'completed' && (
        <StarDisplay stars={data.stars} max={data.totalExercises} />
      )}

      {/* Progress for current lesson */}
      {data.state === 'current' && data.completedCount > 0 && (
        <Text style={styles.progressText}>
          {data.completedCount}/{data.totalExercises}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/**
 * Main LevelMapScreen
 */
export function LevelMapScreen() {
  const navigation = useNavigation<NavProp>();
  const nodes = useLessonNodes();
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to current lesson
  useEffect(() => {
    const currentIndex = nodes.findIndex((n) => n.state === 'current');
    if (currentIndex >= 0 && scrollRef.current) {
      const y = getNodeY(currentIndex, nodes.length);
      // Scroll so current node is centered
      const scrollTarget = Math.max(0, y - Dimensions.get('window').height / 2 + NODE_SIZE);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: scrollTarget, animated: true });
      }, 300);
    }
  }, [nodes]);

  const handleNodePress = useCallback(
    (data: LessonNodeData) => {
      if (data.state === 'locked') {
        // Could show a toast — for now, do nothing
        return;
      }
      if (data.targetExerciseId) {
        navigation.navigate('Exercise', { exerciseId: data.targetExerciseId });
      }
    },
    [navigation]
  );

  // Total content height
  const contentHeight = 80 + nodes.length * NODE_SPACING_Y + 60;

  // Build SVG connectors
  const connectors = useMemo(() => {
    const paths: React.ReactElement[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const fromX = getNodeX(i);
      const fromY = getNodeY(i, nodes.length);
      const toX = getNodeX(i + 1);
      const toY = getNodeY(i + 1, nodes.length);

      const isCompleted = nodes[i].state === 'completed';
      const pathColor = isCompleted ? '#4CAF50' : '#E0E0E0';
      const pathWidth = isCompleted ? 3 : 2;

      paths.push(
        <Path
          key={`path-${i}`}
          d={getConnectorPath(fromX, fromY, toX, toY)}
          stroke={pathColor}
          strokeWidth={pathWidth}
          fill="none"
          strokeDasharray={isCompleted ? undefined : '8,6'}
        />
      );
    }
    return paths;
  }, [nodes]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Journey</Text>
        <Text style={styles.subtitle}>
          {nodes.filter((n) => n.state === 'completed').length}/{nodes.length} lessons completed
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{ height: contentHeight }}
        showsVerticalScrollIndicator={false}
      >
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

/**
 * Style variants per node state
 */
const NODE_STYLES = {
  completed: {
    circle: {
      backgroundColor: '#4CAF50',
      borderColor: '#388E3C',
    },
    iconColor: '#FFFFFF',
    label: { color: '#333333' },
  },
  current: {
    circle: {
      backgroundColor: '#1976D2',
      borderColor: '#1565C0',
    },
    iconColor: '#FFFFFF',
    label: { color: '#1976D2', fontWeight: '700' as const },
  },
  locked: {
    circle: {
      backgroundColor: '#E0E0E0',
      borderColor: '#BDBDBD',
    },
    iconColor: '#9E9E9E',
    label: { color: '#9E9E9E' },
  },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#212121',
  },
  subtitle: {
    fontSize: 14,
    color: '#757575',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  nodeWrapper: {
    position: 'absolute',
    width: NODE_SIZE + 60,
    alignItems: 'center',
  },
  pulsingRing: {
    position: 'absolute',
    width: NODE_SIZE + 16,
    height: NODE_SIZE + 16,
    borderRadius: (NODE_SIZE + 16) / 2,
    backgroundColor: '#1976D2',
    top: -8,
  },
  nodeCircle: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  nodeLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: NODE_SIZE + 50,
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1976D2',
    marginTop: 2,
  },
});

export default LevelMapScreen;
