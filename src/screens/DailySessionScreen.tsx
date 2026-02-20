/**
 * DailySessionScreen — "Today's Practice"
 *
 * AI-picked session: warm-up → lesson → challenge, with explanations
 * of WHY each exercise was chosen. Replaces the static lesson list
 * as the primary learning entry point.
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { generateSessionPlan, type SessionPlan, type ExerciseRef } from '../core/curriculum/CurriculumEngine';
import { getExercise } from '../content/ContentLoader';
import { useLearnerProfileStore } from '../stores/learnerProfileStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Section colors
const SECTION_COLORS = {
  warmUp: { accent: '#FF9800', bg: 'rgba(255, 152, 0, 0.08)', border: 'rgba(255, 152, 0, 0.2)' },
  lesson: { accent: '#2196F3', bg: 'rgba(33, 150, 243, 0.08)', border: 'rgba(33, 150, 243, 0.2)' },
  challenge: { accent: '#9C27B0', bg: 'rgba(156, 39, 176, 0.08)', border: 'rgba(156, 39, 176, 0.2)' },
} as const;

const SECTION_ICONS = {
  warmUp: 'fire' as const,
  lesson: 'book-open-variant' as const,
  challenge: 'lightning-bolt' as const,
};

const SECTION_LABELS = {
  warmUp: 'Warm Up',
  lesson: "Today's Lesson",
  challenge: 'Challenge',
};

export function DailySessionScreen() {
  const navigation = useNavigation<NavProp>();
  const profile = useLearnerProfileStore();

  const plan: SessionPlan = useMemo(() => {
    return generateSessionPlan(
      {
        noteAccuracy: profile.noteAccuracy,
        noteAttempts: profile.noteAttempts,
        skills: profile.skills,
        tempoRange: profile.tempoRange,
        weakNotes: profile.weakNotes,
        weakSkills: profile.weakSkills,
        totalExercisesCompleted: profile.totalExercisesCompleted,
        lastAssessmentDate: profile.lastAssessmentDate,
        assessmentScore: profile.assessmentScore,
        masteredSkills: profile.masteredSkills,
      },
      profile.masteredSkills
    );
  }, [profile]);

  const totalExercises = plan.warmUp.length + plan.lesson.length + plan.challenge.length;

  const handleExercisePress = useCallback(
    (ref: ExerciseRef) => {
      if (ref.source === 'ai') {
        navigation.navigate('Exercise', { exerciseId: 'ai-mode', aiMode: true });
      } else {
        navigation.navigate('Exercise', { exerciseId: ref.exerciseId });
      }
    },
    [navigation]
  );

  const handleBrowseLessons = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Learn' } as any);
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} testID="daily-session-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Today's Practice</Text>
            <Text style={styles.headerSubtitle}>
              {totalExercises} exercise{totalExercises !== 1 ? 's' : ''} picked for you
            </Text>
          </View>
        </View>

        {/* Warm Up Section */}
        <SessionSection
          sectionKey="warmUp"
          exercises={plan.warmUp}
          onExercisePress={handleExercisePress}
        />

        {/* Lesson Section */}
        <SessionSection
          sectionKey="lesson"
          exercises={plan.lesson}
          onExercisePress={handleExercisePress}
        />

        {/* Challenge Section */}
        <SessionSection
          sectionKey="challenge"
          exercises={plan.challenge}
          onExercisePress={handleExercisePress}
        />

        {/* AI Reasoning */}
        {plan.reasoning.length > 0 && (
          <View style={styles.reasoningCard}>
            <View style={styles.reasoningHeader}>
              <MaterialCommunityIcons name="robot-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.reasoningTitle}>Why these exercises?</Text>
            </View>
            {plan.reasoning.map((reason, i) => (
              <Text key={i} style={styles.reasoningText}>
                {reason}
              </Text>
            ))}
          </View>
        )}

        {/* Browse All Lessons Link */}
        <TouchableOpacity
          style={styles.browseLessonsBtn}
          onPress={handleBrowseLessons}
        >
          <MaterialCommunityIcons name="view-grid-outline" size={18} color={COLORS.textSecondary} />
          <Text style={styles.browseLessonsText}>Browse All Lessons</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// Session Section Component
// ============================================================================

function SessionSection({
  sectionKey,
  exercises,
  onExercisePress,
}: {
  sectionKey: 'warmUp' | 'lesson' | 'challenge';
  exercises: ExerciseRef[];
  onExercisePress: (ref: ExerciseRef) => void;
}) {
  const colors = SECTION_COLORS[sectionKey];
  const icon = SECTION_ICONS[sectionKey];
  const label = SECTION_LABELS[sectionKey];

  if (exercises.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconBg, { backgroundColor: colors.bg }]}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.accent} />
        </View>
        <Text style={[styles.sectionLabel, { color: colors.accent }]}>{label}</Text>
      </View>

      {exercises.map((ref, i) => (
        <ExerciseCard
          key={`${ref.exerciseId}-${i}`}
          exerciseRef={ref}
          colors={colors}
          onPress={() => onExercisePress(ref)}
        />
      ))}
    </View>
  );
}

// ============================================================================
// Exercise Card Component
// ============================================================================

function ExerciseCard({
  exerciseRef,
  colors,
  onPress,
}: {
  exerciseRef: ExerciseRef;
  colors: { accent: string; bg: string; border: string };
  onPress: () => void;
}) {
  const exercise = exerciseRef.source === 'static' ? getExercise(exerciseRef.exerciseId) : null;
  const title = exercise?.metadata.title ?? (exerciseRef.source === 'ai' ? 'AI-Generated Exercise' : exerciseRef.exerciseId);
  const difficulty = exercise?.metadata.difficulty ?? 1;

  return (
    <TouchableOpacity
      style={[styles.exerciseCard, { borderColor: colors.border, backgroundColor: colors.bg }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.exerciseCardContent}>
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseTitle}>{title}</Text>
          <Text style={styles.exerciseReason}>{exerciseRef.reason}</Text>
          <View style={styles.exerciseMeta}>
            {exerciseRef.source === 'ai' && (
              <View style={styles.aiTag}>
                <MaterialCommunityIcons name="robot" size={12} color={COLORS.info} />
                <Text style={styles.aiTagText}>AI</Text>
              </View>
            )}
            <View style={styles.difficultyDots}>
              {Array.from({ length: 5 }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.difficultyDot,
                    i < difficulty && { backgroundColor: colors.accent },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
        <View style={[styles.playIconBg, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons name="play" size={20} color="#FFFFFF" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.lg,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  backBtn: {
    padding: SPACING.sm,
    marginRight: SPACING.sm,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Sections
  section: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  sectionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  // Exercise Cards
  exerciseCard: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  exerciseCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  exerciseReason: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.info,
  },
  difficultyDots: {
    flexDirection: 'row',
    gap: 3,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.cardBorder,
  },
  playIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  // Reasoning
  reasoningCard: {
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.md,
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  reasoningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  reasoningText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 4,
    paddingLeft: SPACING.lg + SPACING.sm,
  },
  // Browse lessons
  browseLessonsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderStyle: 'dashed',
  },
  browseLessonsText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
