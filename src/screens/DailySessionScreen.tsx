/**
 * DailySessionScreen — "Today's Practice"
 *
 * AI-picked session: warm-up -> lesson -> challenge, with explanations
 * of WHY each exercise was chosen. Primary learning entry point (Learn tab).
 * Recomputes the session plan when returning from exercises via useFocusEffect.
 */

import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { GameCard } from '../components/common/GameCard';
import { AnimatedProgressBar } from '../components/common/AnimatedProgressBar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { generateSessionPlan, getNextSkillToLearn, type SessionPlan, type SessionType, type ExerciseRef } from '../core/curriculum/CurriculumEngine';
import { getSkillsNeedingReview, getSkillById } from '../core/curriculum/SkillTree';
import { SKILL_TREE } from '../core/curriculum/SkillTree';
import { getExercise } from '../content/ContentLoader';
import { midiToNoteName } from '../core/music/MusicTheory';
import { useLearnerProfileStore } from '../stores/learnerProfileStore';
import { useGemStore } from '../stores/gemStore';
import { SalsaCoach } from '../components/Mascot/SalsaCoach';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, glowColor, type RarityLevel } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// Section colors
const SECTION_COLORS = {
  warmUp: { accent: COLORS.warning, bg: glowColor(COLORS.warning, 0.08), border: glowColor(COLORS.warning, 0.2) },
  lesson: { accent: COLORS.info, bg: glowColor(COLORS.info, 0.08), border: glowColor(COLORS.info, 0.2) },
  challenge: { accent: COLORS.primaryLight, bg: glowColor(COLORS.primaryLight, 0.08), border: glowColor(COLORS.primaryLight, 0.2) },
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

const SECTION_RARITY: Record<'warmUp' | 'lesson' | 'challenge', RarityLevel> = {
  warmUp: 'common',
  lesson: 'rare',
  challenge: 'epic',
};

/** Replace MIDI numbers in reasoning strings with note names */
function humanizeReasoning(text: string): string {
  return text.replace(/MIDI (\d+)/g, (_match, num) => {
    const midi = parseInt(num, 10);
    if (isNaN(midi) || midi < 21 || midi > 108) return _match;
    return midiToNoteName(midi);
  });
}

export function DailySessionScreen() {
  const navigation = useNavigation<NavProp>();

  // Subscribe only to fields needed for rendering (avoids re-renders on every note accuracy update)
  const masteredSkills = useLearnerProfileStore((s) => s.masteredSkills);
  const totalExercisesCompleted = useLearnerProfileStore((s) => s.totalExercisesCompleted);

  // Gem balance
  const gems = useGemStore((s) => s.gems);

  // Recompute session plan on focus (picks up newly mastered skills after exercises)
  const [focusCounter, setFocusCounter] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusCounter((c) => c + 1);
    }, [])
  );

  const plan: SessionPlan = useMemo(() => {
    // Read full profile snapshot inside useMemo — only triggered by focusCounter
    const profile = useLearnerProfileStore.getState();
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
        skillMasteryData: profile.skillMasteryData,
        recentExerciseIds: profile.recentExerciseIds,
      },
      profile.masteredSkills
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCounter]);

  const totalExercises = plan.warmUp.length + plan.lesson.length + plan.challenge.length;
  const masteredCount = masteredSkills.length;
  const totalSkills = SKILL_TREE.length;
  const isNewUser = masteredCount === 0 && totalExercisesCompleted === 0;

  const nextSkill = useMemo(
    () => getNextSkillToLearn(masteredSkills),
    [masteredSkills]
  );

  const skillMasteryData = useLearnerProfileStore((s) => s.skillMasteryData);
  const decayedSkillCount = useMemo(
    () => getSkillsNeedingReview(masteredSkills, skillMasteryData ?? {}).length,
    [masteredSkills, skillMasteryData]
  );

  const handleExercisePress = useCallback(
    (ref: ExerciseRef) => {
      if (ref.source === 'ai' || ref.source === 'ai-with-fallback') {
        navigation.navigate('Exercise', {
          exerciseId: ref.fallbackExerciseId ?? 'ai-mode',
          aiMode: true,
          skillId: ref.skillNodeId,
        });
      } else {
        navigation.navigate('Exercise', { exerciseId: ref.exerciseId });
      }
    },
    [navigation]
  );

  const handleBrowseLessons = useCallback(() => {
    navigation.navigate('LevelMap');
  }, [navigation]);

  const handleAssessment = useCallback(() => {
    navigation.navigate('SkillAssessment');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} testID="daily-session-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="daily-session-scroll"
      >
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="daily-session-back"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Today's Practice</Text>
              <SessionTypeBadge type={plan.sessionType} />
              <View style={{ flex: 1 }} />
              <View style={styles.gemCounter}>
                <MaterialCommunityIcons name="diamond-stone" size={16} color={COLORS.gemGold} />
                <Text style={styles.gemCounterText}>{gems}</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              {totalExercises} exercise{totalExercises !== 1 ? 's' : ''} picked for you
              {decayedSkillCount > 0 ? ` \u2022 ${decayedSkillCount} skill${decayedSkillCount > 1 ? 's' : ''} need review` : ''}
            </Text>
          </View>
        </View>

        {/* Salsa coach motivation */}
        <View style={styles.salsaRow}>
          <SalsaCoach mood="teaching" size="small" showCatchphrase />
        </View>

        {/* Skill Progress Card */}
        <View style={styles.skillProgressCard}>
          <View style={styles.skillProgressRow}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={18} color={COLORS.primary} />
            <Text style={styles.skillProgressText}>
              {masteredCount}/{totalSkills} skills
              {nextSkill ? ` \u2022 Next: ${nextSkill.name}` : ' \u2022 All mastered!'}
            </Text>
          </View>
          <AnimatedProgressBar
            progress={masteredCount / totalSkills}
            color={COLORS.primary}
            height={6}
          />
        </View>

        {/* New User Welcome Card */}
        {isNewUser && (
          <View style={styles.welcomeCard}>
            <MaterialCommunityIcons name="hand-wave" size={28} color={COLORS.starGold} />
            <Text style={styles.welcomeTitle}>Welcome to Purrrfect Keys!</Text>
            <Text style={styles.welcomeBody}>
              Your practice is personalized based on your skills and performance.
              Take a quick assessment so we can find the right starting point.
            </Text>
            <TouchableOpacity
              style={styles.assessmentBtn}
              onPress={handleAssessment}
              activeOpacity={0.7}
              testID="daily-session-assessment-cta"
            >
              <MaterialCommunityIcons name="clipboard-check-outline" size={18} color={COLORS.textPrimary} />
              <Text style={styles.assessmentBtnText}>Quick Assessment</Text>
            </TouchableOpacity>
          </View>
        )}

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
                {humanizeReasoning(reason)}
              </Text>
            ))}
          </View>
        )}

        {/* Browse All Lessons Link */}
        <TouchableOpacity
          style={styles.browseLessonsBtn}
          onPress={handleBrowseLessons}
          testID="daily-session-browse-lessons"
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
// Session Type Badge
// ============================================================================

const SESSION_TYPE_CONFIG: Record<SessionType, { label: string; color: string; icon: 'school' | 'refresh' | 'lightning-bolt' | 'shuffle-variant' }> = {
  'new-material': { label: 'New Material', color: COLORS.success, icon: 'school' },
  review: { label: 'Review Day', color: COLORS.warning, icon: 'refresh' },
  challenge: { label: 'Challenge Day', color: COLORS.primaryLight, icon: 'lightning-bolt' },
  mixed: { label: 'Mixed', color: COLORS.info, icon: 'shuffle-variant' },
};

function SessionTypeBadge({ type }: { type: SessionType }) {
  const config = SESSION_TYPE_CONFIG[type];
  return (
    <View style={[styles.sessionTypeBadge, { backgroundColor: glowColor(config.color, 0.1) }]}>
      <MaterialCommunityIcons name={config.icon} size={14} color={config.color} />
      <Text style={[styles.sessionTypeBadgeText, { color: config.color }]}>{config.label}</Text>
    </View>
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
  const rarity = SECTION_RARITY[sectionKey];

  if (exercises.length === 0) return null;

  return (
    <View style={styles.section}>
      <Animated.View
        entering={FadeInUp.delay(0).duration(400)}
        style={styles.sectionHeader}
      >
        <View style={[styles.sectionIconBg, { backgroundColor: colors.bg }]}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.accent} />
        </View>
        <Text style={[styles.sectionLabel, { color: colors.accent }]}>{label}</Text>
      </Animated.View>

      {exercises.map((ref, i) => (
        <Animated.View
          key={`${ref.exerciseId}-${i}`}
          entering={FadeInUp.delay((i + 1) * 100).duration(400)}
        >
          <SessionExerciseCard
            exerciseRef={ref}
            rarity={rarity}
            colors={colors}
            onPress={() => onExercisePress(ref)}
          />
        </Animated.View>
      ))}
    </View>
  );
}

// ============================================================================
// Exercise Card Component (renamed to avoid conflict with transitions/ExerciseCard)
// ============================================================================

function SessionExerciseCard({
  exerciseRef,
  rarity,
  colors,
  onPress,
}: {
  exerciseRef: ExerciseRef;
  rarity: RarityLevel;
  colors: { accent: string; bg: string; border: string };
  onPress: () => void;
}) {
  const exercise = exerciseRef.source === 'static' ? getExercise(exerciseRef.exerciseId) : null;
  const isAI = exerciseRef.source === 'ai' || exerciseRef.source === 'ai-with-fallback';
  const skillNode = isAI ? getSkillById(exerciseRef.skillNodeId) : null;
  const title = exercise?.metadata.title ?? skillNode?.name ?? (isAI ? 'AI-Generated Exercise' : exerciseRef.exerciseId);
  const difficulty = exercise?.metadata.difficulty ?? 1;

  return (
    <GameCard
      rarity={rarity}
      onPress={onPress}
      style={styles.exerciseGameCard}
    >
      <View style={styles.exerciseCardContent}>
        <View style={styles.exerciseInfo}>
          <Text style={styles.exerciseTitle}>{title}</Text>
          <Text style={styles.exerciseReason}>{humanizeReasoning(exerciseRef.reason)}</Text>
          <View style={styles.exerciseMeta}>
            {isAI && (
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
            <View style={styles.gemRewardHint}>
              <MaterialCommunityIcons name="diamond-stone" size={10} color={COLORS.gemGold} />
              <Text style={styles.gemRewardHintText}>5 for 90%+, 15 for perfect</Text>
            </View>
          </View>
        </View>
        <View style={[styles.playIconBg, { backgroundColor: colors.accent }]}>
          <MaterialCommunityIcons name="play" size={20} color={COLORS.textPrimary} />
        </View>
      </View>
    </GameCard>
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
  salsaRow: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    padding: SPACING.xs,
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sessionTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sessionTypeBadgeText: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600' as const,
  },
  headerTitle: {
    ...TYPOGRAPHY.display.sm,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Skill Progress
  skillProgressCard: {
    ...SHADOWS.sm,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.lg,
  },
  skillProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  skillProgressText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '600' as const,
    color: COLORS.textPrimary,
  },
  // skillProgressBar uses AnimatedProgressBar component
  // Welcome card
  welcomeCard: {
    marginHorizontal: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: glowColor(COLORS.starGold, 0.06),
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: glowColor(COLORS.starGold, 0.15),
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  welcomeTitle: {
    ...TYPOGRAPHY.heading.md,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  welcomeBody: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  assessmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
  },
  assessmentBtnText: {
    ...TYPOGRAPHY.button.lg,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
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
    ...TYPOGRAPHY.heading.sm,
    fontWeight: '700' as const,
  },
  // Exercise Cards (GameCard wrapper)
  exerciseGameCard: {
    marginBottom: SPACING.sm,
  },
  exerciseCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseTitle: {
    ...TYPOGRAPHY.heading.sm,
    color: COLORS.textPrimary,
  },
  exerciseReason: {
    ...TYPOGRAPHY.body.sm,
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
    backgroundColor: glowColor(COLORS.info, 0.15),
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aiTagText: {
    ...TYPOGRAPHY.caption.md,
    fontWeight: '600' as const,
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
    ...TYPOGRAPHY.body.md,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  reasoningText: {
    ...TYPOGRAPHY.body.sm,
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
    ...TYPOGRAPHY.body.md,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  // Gem counter
  gemCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: glowColor(COLORS.starGold, 0.1),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  gemCounterText: {
    ...TYPOGRAPHY.body.sm,
    fontWeight: '700' as const,
    color: COLORS.gemGold,
  },
  // Gem reward hint on exercise cards
  gemRewardHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  gemRewardHintText: {
    ...TYPOGRAPHY.caption.sm,
    color: COLORS.textMuted,
  },
});
