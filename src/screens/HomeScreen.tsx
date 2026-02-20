/**
 * HomeScreen Component
 * Duolingo-style home dashboard with hero section, cat companion,
 * daily goal arc, streak flame, stats pills, and continue learning card
 */

import React, { useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { DailyChallengeCard } from '../components/DailyChallengeCard';
import { CatAvatar } from '../components/Mascot/CatAvatar';
import { MascotBubble } from '../components/Mascot/MascotBubble';
import { StreakFlame } from '../components/StreakFlame';
import { getRandomCatMessage } from '../content/catDialogue';
import { calculateCatMood } from '../core/catMood';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getLessons, getLessonExercises, isPostCurriculum } from '../content/ContentLoader';
import { COLORS, GRADIENTS, SPACING, BORDER_RADIUS } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/AppNavigator';

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const GOAL_ARC_SIZE = 140;
const GOAL_ARC_STROKE = 8;
const GOAL_ARC_RADIUS = (GOAL_ARC_SIZE - GOAL_ARC_STROKE) / 2;
const GOAL_ARC_CIRCUMFERENCE = 2 * Math.PI * GOAL_ARC_RADIUS;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
}

export interface HomeScreenProps {
  onNavigateToExercise?: () => void;
  onNavigateToLesson?: () => void;
  onNavigateToSongs?: () => void;
  onNavigateToSettings?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToExercise,
  onNavigateToLesson,
  onNavigateToSongs,
  onNavigateToSettings,
}) => {
  const navigation = useNavigation<HomeNavProp>();

  // Store connections
  const { totalXp, level, streakData, dailyGoalData, lessonProgress } = useProgressStore();
  const { dailyGoalMinutes, displayName, hasCompletedOnboarding, selectedCatId } = useSettingsStore();

  // Onboarding guard
  const hasShownOnboarding = useRef(false);
  useEffect(() => {
    if (!hasCompletedOnboarding && !hasShownOnboarding.current) {
      hasShownOnboarding.current = true;
      navigation.navigate('Onboarding');
    }
  }, [hasCompletedOnboarding, navigation]);

  // Daily goal progress
  const today = new Date().toISOString().split('T')[0];
  const todayGoal = dailyGoalData[today];
  const minutesPracticedToday = todayGoal?.minutesPracticed ?? 0;
  const dailyGoalProgress = dailyGoalMinutes > 0 ? Math.min(1, minutesPracticedToday / dailyGoalMinutes) : 0;

  // Next exercise computation
  const { nextExerciseTitle, nextExerciseId, currentLessonLabel, exerciseProgress, totalCompleted } = useMemo(() => {
    const lessons = getLessons();
    let totalDone = 0;
    let totalEx = 0;
    for (const lesson of lessons) {
      const exercises = getLessonExercises(lesson.id);
      totalEx += exercises.length;
      const lp = lessonProgress[lesson.id];
      const completedCount = lp
        ? Object.values(lp.exerciseScores).filter((s) => s.completedAt != null).length
        : 0;
      totalDone += completedCount;
    }

    for (const lesson of lessons) {
      const exercises = getLessonExercises(lesson.id);
      if (exercises.length === 0) continue;
      const lp = lessonProgress[lesson.id];
      const completedCount = lp
        ? Object.values(lp.exerciseScores).filter((s) => s.completedAt != null).length
        : 0;
      const progress = Math.round((completedCount / exercises.length) * 100);
      if (completedCount < exercises.length) {
        const nextEx = exercises.find((ex) => {
          const score = lp?.exerciseScores[ex.id];
          return !score || score.completedAt == null;
        });
        return {
          nextExerciseTitle: nextEx?.metadata.title ?? exercises[0].metadata.title,
          nextExerciseId: nextEx?.id ?? exercises[0].id,
          currentLessonLabel: lesson.metadata.title,
          exerciseProgress: progress,
          totalCompleted: totalDone,
          totalExercises: totalEx,
        };
      }
    }
    const allComplete = isPostCurriculum(lessonProgress);
    return {
      nextExerciseTitle: allComplete ? 'AI Practice' : 'All Complete!',
      nextExerciseId: null as string | null,
      currentLessonLabel: allComplete ? 'Adaptive Practice' : (lessons[lessons.length - 1]?.metadata.title ?? 'Lessons'),
      exerciseProgress: 100,
      totalCompleted: totalDone,
      totalExercises: totalEx,
    };
  }, [lessonProgress]);

  // Cat mood & dialogue
  const catMood = useMemo(() => calculateCatMood({
    lastPracticeDate: streakData?.lastPracticeDate ?? '',
    recentScore: 0.7,
    currentStreak: streakData?.currentStreak ?? 0,
  }), [streakData]);

  const catMessage = useMemo(() => {
    const catId = selectedCatId ?? 'mini-meowww';
    return getRandomCatMessage(catId, 'daily_login');
  }, [selectedCatId]);

  const mascotMood = catMood === 'happy' ? 'happy' : catMood === 'sleepy' ? 'encouraging' : 'teaching';

  // Stagger animation
  const fadeAnims = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(30))
  ).current;

  useEffect(() => {
    const animations = fadeAnims.map((anim, i) =>
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: i * 100,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnims[i], {
          toValue: 0,
          duration: 400,
          delay: i * 100,
          useNativeDriver: true,
        }),
      ])
    );
    Animated.stagger(80, animations).start();
  }, [fadeAnims, slideAnims]);

  const staggerStyle = (index: number) => ({
    opacity: fadeAnims[Math.min(index, 5)],
    transform: [{ translateY: slideAnims[Math.min(index, 5)] }],
  });

  // Goal arc offset
  const goalArcOffset = GOAL_ARC_CIRCUMFERENCE * (1 - dailyGoalProgress);

  const streak = streakData?.currentStreak ?? 0;

  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section with gradient */}
        <Animated.View style={staggerStyle(0)}>
          <LinearGradient
            colors={[GRADIENTS.header[0], GRADIENTS.header[1], COLORS.background]}
            style={styles.hero}
          >
            {/* Top bar: greeting + settings */}
            <View style={styles.topBar}>
              <View>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.greetingName}>{displayName}</Text>
              </View>
              <TouchableOpacity
                style={styles.settingsBtn}
                onPress={onNavigateToSettings ?? (() => navigation.navigate('MidiSetup'))}
              >
                <MaterialCommunityIcons name="cog-outline" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Center: Cat avatar with goal arc + streak */}
            <View style={styles.heroCenter}>
              {/* Daily goal arc ring */}
              <View style={styles.goalArcContainer}>
                <Svg width={GOAL_ARC_SIZE} height={GOAL_ARC_SIZE}>
                  {/* Background ring */}
                  <Circle
                    cx={GOAL_ARC_SIZE / 2}
                    cy={GOAL_ARC_SIZE / 2}
                    r={GOAL_ARC_RADIUS}
                    stroke={COLORS.cardBorder}
                    strokeWidth={GOAL_ARC_STROKE}
                    fill="transparent"
                  />
                  {/* Progress ring */}
                  <Circle
                    cx={GOAL_ARC_SIZE / 2}
                    cy={GOAL_ARC_SIZE / 2}
                    r={GOAL_ARC_RADIUS}
                    stroke={dailyGoalProgress >= 1 ? COLORS.success : COLORS.primary}
                    strokeWidth={GOAL_ARC_STROKE}
                    fill="transparent"
                    strokeDasharray={`${GOAL_ARC_CIRCUMFERENCE}`}
                    strokeDashoffset={goalArcOffset}
                    strokeLinecap="round"
                    rotation="-90"
                    origin={`${GOAL_ARC_SIZE / 2}, ${GOAL_ARC_SIZE / 2}`}
                  />
                </Svg>
                {/* Cat avatar in center */}
                <View style={styles.avatarInRing}>
                  <CatAvatar
                    catId={selectedCatId ?? 'mini-meowww'}
                    size="large"
                    showGlow={dailyGoalProgress >= 1}
                  />
                </View>
              </View>

              {/* Streak flame + level badge row */}
              <View style={styles.heroStats}>
                <StreakFlame streak={streak} size="small" />
                <View style={styles.levelBadge}>
                  <MaterialCommunityIcons name="shield-star" size={18} color={COLORS.starGold} />
                  <Text style={styles.levelText}>Lv. {level}</Text>
                </View>
                <View style={styles.xpPill}>
                  <MaterialCommunityIcons name="lightning-bolt" size={16} color={COLORS.starGold} />
                  <Text style={styles.xpText}>{totalXp} XP</Text>
                </View>
              </View>
            </View>

            {/* Goal progress text */}
            <View style={styles.goalTextRow}>
              <Text style={styles.goalLabel}>Daily Goal</Text>
              <Text style={[styles.goalValue, dailyGoalProgress >= 1 && { color: COLORS.success }]}>
                {minutesPracticedToday}/{dailyGoalMinutes} min
              </Text>
            </View>
            {dailyGoalProgress >= 1 && (
              <View style={styles.goalCompleteChip}>
                <MaterialCommunityIcons name="check-circle" size={14} color={COLORS.success} />
                <Text style={styles.goalCompleteText}>Goal complete!</Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Cat speech bubble */}
        <Animated.View style={[styles.section, staggerStyle(1)]}>
          <MascotBubble
            mood={mascotMood}
            message={catMessage}
            size="small"
          />
        </Animated.View>

        {/* Daily Challenge Card */}
        <Animated.View style={[styles.section, staggerStyle(2)]}>
          <DailyChallengeCard onPress={() => {
            if (nextExerciseId) {
              navigation.navigate('Exercise', { exerciseId: nextExerciseId });
            }
          }} />
        </Animated.View>

        {/* Continue Learning Card */}
        <Animated.View style={[styles.section, staggerStyle(3)]}>
          <Text style={styles.sectionTitle}>Continue Learning</Text>
          <TouchableOpacity
            style={styles.continueCard}
            onPress={onNavigateToExercise ?? (() => {
              if (nextExerciseId) {
                navigation.navigate('Exercise', { exerciseId: nextExerciseId });
              } else if (isPostCurriculum(lessonProgress)) {
                navigation.navigate('Exercise', { exerciseId: 'ai-mode', aiMode: true });
              } else {
                navigation.navigate('MainTabs', { screen: 'Learn' } as any);
              }
            })}
            activeOpacity={0.7}
            testID="home-continue-learning"
          >
            <LinearGradient
              colors={[COLORS.cardHighlight, COLORS.cardSurface]}
              style={styles.continueCardInner}
            >
              <View style={styles.continueTop}>
                <View style={styles.continuePlayIcon}>
                  <MaterialCommunityIcons name="play" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.continueInfo}>
                  <Text style={styles.continueLabel}>{currentLessonLabel}</Text>
                  <Text style={styles.continueTitle}>{nextExerciseTitle}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textMuted} />
              </View>
              <View style={styles.continueProgressRow}>
                <View style={styles.continueProgressTrack}>
                  <View style={[styles.continueProgressFill, { width: `${exerciseProgress}%` }]} />
                </View>
                <Text style={styles.continueProgressText}>{exerciseProgress}%</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Quick Stats Row */}
        <Animated.View style={[styles.section, staggerStyle(4)]}>
          <View style={styles.statsPillRow}>
            <StatPill icon="music-note" label="Exercises" value={totalCompleted} color={COLORS.primary} />
            <StatPill icon="book-open-variant" label="Lessons" value={Object.values(lessonProgress).filter(l => l.status === 'completed').length} color={COLORS.info} />
            <StatPill icon="fire" label="Streak" value={streak} color="#FF6B00" />
            <StatPill icon="star" label="Stars" value={Object.values(lessonProgress).reduce((sum, l) => sum + Object.values(l.exerciseScores).reduce((s, e) => s + (e.stars ?? 0), 0), 0)} color={COLORS.starGold} />
          </View>
        </Animated.View>

        {/* Quick Actions Grid */}
        <Animated.View style={[styles.section, staggerStyle(5)]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <ActionCard
              icon="book-open-outline"
              label="Learn"
              gradient={['#1A0A2E', '#2D1B4E']}
              onPress={onNavigateToLesson ?? (() => navigation.navigate('MainTabs', { screen: 'Learn' } as any))}
            />
            <ActionCard
              icon="music-box-multiple"
              label="Practice"
              gradient={['#0A1A2E', '#1B2D4E']}
              onPress={onNavigateToExercise ?? (() => {
                if (nextExerciseId) {
                  navigation.navigate('Exercise', { exerciseId: nextExerciseId });
                } else if (isPostCurriculum(lessonProgress)) {
                  navigation.navigate('Exercise', { exerciseId: 'ai-mode', aiMode: true });
                } else {
                  navigation.navigate('MainTabs', { screen: 'Learn' } as any);
                }
              })}
            />
            <ActionCard
              icon="piano"
              label="Free Play"
              gradient={['#1A2E0A', '#2D4E1B']}
              onPress={onNavigateToSongs ?? (() => navigation.navigate('MainTabs', { screen: 'Play' } as any))}
            />
            <ActionCard
              icon="tune-variant"
              label="Settings"
              gradient={['#2E1A0A', '#4E2D1B']}
              onPress={onNavigateToSettings ?? (() => navigation.navigate('MidiSetup'))}
            />
          </View>
        </Animated.View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

HomeScreen.displayName = 'HomeScreen';

/** Stat pill component for the quick stats row */
function StatPill({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <View style={styles.statPill}>
      <MaterialCommunityIcons name={icon as any} size={18} color={color} />
      <Text style={[styles.statPillValue, { color }]}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
    </View>
  );
}

/** Action card with gradient background */
function ActionCard({ icon, label, gradient, onPress }: { icon: string; label: string; gradient: readonly [string, string] | string[]; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.7}>
      <LinearGradient colors={gradient as [string, string]} style={styles.actionCardGradient}>
        <MaterialCommunityIcons name={icon as any} size={28} color={COLORS.textPrimary} />
        <Text style={styles.actionLabel}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: SPACING.lg,
  },
  // Hero
  hero: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  greetingName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  settingsBtn: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  heroCenter: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  goalArcContainer: {
    width: GOAL_ARC_SIZE,
    height: GOAL_ARC_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInRing: {
    position: 'absolute',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  levelText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.starGold,
  },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  xpText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.starGold,
  },
  goalTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  goalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  goalCompleteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
    marginTop: SPACING.xs,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: BORDER_RADIUS.full,
  },
  goalCompleteText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  // Sections
  section: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  // Continue Card
  continueCard: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  continueCardInner: {
    padding: SPACING.md,
  },
  continueTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  continuePlayIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  continueInfo: {
    flex: 1,
  },
  continueLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  continueTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  continueProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  continueProgressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.cardBorder,
    borderRadius: 3,
    overflow: 'hidden',
  },
  continueProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  continueProgressText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    minWidth: 32,
    textAlign: 'right',
  },
  // Stats pills
  statsPillRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 2,
  },
  statPillValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statPillLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  // Actions grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionCard: {
    width: (SCREEN_WIDTH - SPACING.md * 2 - SPACING.sm) / 2,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  actionCardGradient: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
