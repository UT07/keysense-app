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
import { PressableScale } from '../components/common/PressableScale';
import { AnimatedProgressBar } from '../components/common/AnimatedProgressBar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedGradientBackground } from '../components/common/AnimatedGradientBackground';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { DailyChallengeCard } from '../components/DailyChallengeCard';
// WeeklyChallengeCard and MonthlyChallengeCard kept for future re-integration
// import { WeeklyChallengeCard } from '../components/WeeklyChallengeCard';
// import { MonthlyChallengeCard } from '../components/MonthlyChallengeCard';
import { getDailyChallengeForDate } from '../core/challenges/challengeSystem';
import type { SkillCategory } from '../core/curriculum/SkillTree';
import { MusicLibrarySpotlight } from '../components/MusicLibrarySpotlight';
import { ReviewChallengeCard } from '../components/ReviewChallengeCard';
import { useSongStore } from '../stores/songStore';
import { CatAvatar } from '../components/Mascot/CatAvatar';
import { SalsaCoach } from '../components/Mascot/SalsaCoach';
import { StreakFlame } from '../components/StreakFlame';
import { getRandomCatMessage } from '../content/catDialogue';
import { calculateCatMood } from '../core/catMood';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useGemStore } from '../stores/gemStore';
import { useCatEvolutionStore, xpToNextStage } from '../stores/catEvolutionStore';
import { EVOLUTION_XP_THRESHOLDS } from '../stores/types';
import { getLessons } from '../content/ContentLoader';
import { getNextSkillToLearn } from '../core/curriculum/CurriculumEngine';
import { SKILL_TREE } from '../core/curriculum/SkillTree';
import { useLearnerProfileStore } from '../stores/learnerProfileStore';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, glowColor } from '../theme/tokens';
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

/**
 * Maps a challenge category or type to the best skill ID for AI exercise generation.
 * For category-specific challenges, finds the first unmastered skill in that category.
 * For generic challenges, picks a skill from the user's current learning tier.
 */
function getSkillIdForChallenge(
  category: SkillCategory | undefined,
  masteredSkillIds: string[],
): string {
  const masteredSet = new Set(masteredSkillIds);

  // Category-specific: find first unmastered skill in that category
  if (category) {
    const match = SKILL_TREE.find(
      (s) => s.category === category && !masteredSet.has(s.id),
    );
    if (match) return match.id;
    // All mastered in category — pick last one for a review exercise
    const lastInCat = [...SKILL_TREE].reverse().find((s) => s.category === category);
    if (lastInCat) return lastInCat.id;
  }

  // Generic challenge: pick from current tier (first unmastered skill overall)
  const nextSkill = SKILL_TREE.find((s) => !masteredSet.has(s.id));
  return nextSkill?.id ?? SKILL_TREE[0].id;
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

  // Curriculum-driven progress
  const masteredSkills = useLearnerProfileStore((s) => s.masteredSkills);
  const totalSkills = SKILL_TREE.length;
  const skillProgress = Math.round((masteredSkills.length / totalSkills) * 100);

  const { nextExerciseTitle, currentLessonLabel, totalCompleted } = useMemo(() => {
    const nextSkill = getNextSkillToLearn(masteredSkills);
    const lessons = getLessons();
    let totalDone = 0;
    for (const lesson of lessons) {
      const lp = lessonProgress[lesson.id];
      const completedCount = lp
        ? Object.values(lp.exerciseScores).filter((s) => s.completedAt != null).length
        : 0;
      totalDone += completedCount;
    }

    return {
      nextExerciseTitle: nextSkill?.name ?? "Today's Practice",
      currentLessonLabel: `${masteredSkills.length} skills mastered`,
      totalCompleted: totalDone,
    };
  }, [lessonProgress, masteredSkills]);

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

  // Gem store
  const gems = useGemStore((s) => s.gems);

  // Cat evolution store
  const evolutionData = useCatEvolutionStore((s) => s.evolutionData);
  const activeCatId = selectedCatId ?? 'mini-meowww';
  const activeCatEvolution = evolutionData[activeCatId];
  const evolutionNext = useMemo(
    () => (activeCatEvolution ? xpToNextStage(activeCatEvolution.xpAccumulated) : null),
    [activeCatEvolution],
  );
  const evolutionProgressPct = useMemo(() => {
    if (!activeCatEvolution) return 0;
    const currentXp = activeCatEvolution.xpAccumulated;
    const stage = activeCatEvolution.currentStage;
    const stageStart = EVOLUTION_XP_THRESHOLDS[stage];
    if (!evolutionNext) return 100; // at master
    const nextThreshold = stageStart + evolutionNext.xpNeeded + (currentXp - stageStart);
    const range = nextThreshold - stageStart;
    if (range <= 0) return 100;
    return Math.min(100, Math.round(((currentXp - stageStart) / range) * 100));
  }, [activeCatEvolution, evolutionNext]);

  // Stagger animation
  const fadeAnims = useRef(
    Array.from({ length: 8 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 8 }, () => new Animated.Value(30))
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
    opacity: fadeAnims[Math.min(index, 7)],
    transform: [{ translateY: slideAnims[Math.min(index, 7)] }],
  });

  // Goal arc offset
  const goalArcOffset = GOAL_ARC_CIRCUMFERENCE * (1 - dailyGoalProgress);

  const streak = streakData?.currentStreak ?? 0;

  // Song library data for spotlight card
  const songSummaries = useSongStore((s) => s.summaries);
  const totalSongs = songSummaries.length || 124;
  const genres = useMemo(() => {
    const genreSet = new Set(songSummaries.map((s) => s.metadata.genre));
    return genreSet.size || 6;
  }, [songSummaries]);
  const featuredSong = useMemo(() => {
    if (songSummaries.length === 0) return null;
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
    );
    const idx = dayOfYear % songSummaries.length;
    const s = songSummaries[idx];
    return {
      title: s.metadata.title,
      artist: s.metadata.artist,
      genre: s.metadata.genre,
      difficulty: s.metadata.difficulty,
    };
  }, [songSummaries]);

  // Decayed skills for review card
  const decayedSkillIds = useMemo(() => {
    const profile = useLearnerProfileStore.getState();
    if (!profile.calculateDecayedSkills) return [];
    return profile.calculateDecayedSkills();
  }, []);

  return (
    <SafeAreaView style={styles.container} testID="home-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section with lava lamp gradient */}
        <Animated.View style={staggerStyle(0)}>
          <AnimatedGradientBackground
            style={styles.hero}
          >
            {/* Top bar: greeting + gem counter + settings */}
            <View style={styles.topBar}>
              <View>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.greetingName}>{displayName}</Text>
              </View>
              <View style={styles.topBarRight}>
                <View style={styles.gemCounter} testID="gem-counter">
                  <MaterialCommunityIcons name="diamond-stone" size={18} color={COLORS.gemGold} />
                  <Text style={styles.gemCountText}>{gems}</Text>
                </View>
                <TouchableOpacity
                  style={styles.settingsBtn}
                  onPress={onNavigateToSettings ?? (() => navigation.navigate('MidiSetup'))}
                >
                  <MaterialCommunityIcons name="cog-outline" size={24} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
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
                    mood={mascotMood}
                    showGlow={dailyGoalProgress >= 1}
                    evolutionStage={activeCatEvolution?.currentStage}
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

              {/* Evolution XP progress bar */}
              {activeCatEvolution && (
                <View style={styles.evolutionBar} testID="evolution-progress">
                  <MaterialCommunityIcons name="paw" size={14} color={COLORS.evolutionGlow} />
                  <View style={styles.evolutionTrack}>
                    <View style={[styles.evolutionFill, { width: `${evolutionProgressPct}%` }]} />
                  </View>
                  <Text style={styles.evolutionLabel}>
                    {activeCatEvolution.currentStage === 'master'
                      ? 'MAX'
                      : evolutionNext
                        ? `${evolutionNext.xpNeeded} to ${evolutionNext.nextStage}`
                        : ''}
                  </Text>
                </View>
              )}
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
          </AnimatedGradientBackground>
        </Animated.View>

        {/* Music Library Spotlight */}
        <Animated.View style={[styles.section, staggerStyle(1)]}>
          <MusicLibrarySpotlight
            totalSongs={totalSongs}
            totalGenres={genres}
            featuredSong={featuredSong}
            onBrowse={() => navigation.navigate('MainTabs', { screen: 'Songs' } as any)}
            onPlayFeatured={() => navigation.navigate('MainTabs', { screen: 'Songs' } as any)}
          />
        </Animated.View>

        {/* Continue Learning Card */}
        <Animated.View style={[styles.section, staggerStyle(2)]}>
          <Text style={styles.sectionTitle}>Continue Learning</Text>
          <PressableScale
            haptic
            onPress={onNavigateToExercise ?? (() => {
              navigation.navigate('MainTabs', { screen: 'Learn' } as any);
            })}
            testID="home-continue-learning"
          >
            <View style={styles.continueCard}>
              <LinearGradient
                colors={[COLORS.cardHighlight, COLORS.cardSurface]}
                style={styles.continueCardInner}
              >
                <View style={styles.continueTop}>
                  <View style={styles.continuePlayIcon}>
                    <MaterialCommunityIcons name="play" size={24} color={COLORS.textPrimary} />
                  </View>
                  <View style={styles.continueInfo}>
                    <Text style={styles.continueLabel}>{currentLessonLabel}</Text>
                    <Text style={styles.continueTitle}>{nextExerciseTitle}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textMuted} />
                </View>
                <View style={styles.continueProgressRow}>
                  <AnimatedProgressBar
                    progress={skillProgress / 100}
                    color={COLORS.primary}
                    height={6}
                    style={styles.continueProgressBar}
                  />
                  <Text style={styles.continueProgressText}>{skillProgress}%</Text>
                </View>
              </LinearGradient>
            </View>
          </PressableScale>
        </Animated.View>

        {/* Review Challenge (conditional — only when skills are decaying) */}
        {decayedSkillIds.length > 0 && (
          <Animated.View style={[styles.section, staggerStyle(3)]}>
            <ReviewChallengeCard
              decayedSkills={decayedSkillIds}
              onStartReview={() => {
                navigation.navigate('Exercise', {
                  exerciseId: 'ai-mode',
                  aiMode: true,
                  skillId: decayedSkillIds[0],
                });
              }}
            />
          </Animated.View>
        )}

        {/* Salsa coach greeting */}
        <Animated.View style={[styles.section, staggerStyle(4)]}>
          <SalsaCoach
            mood={mascotMood}
            size="small"
            showCatchphrase
            catchphrase={catMessage}
          />
        </Animated.View>

        {/* Daily Challenge Card */}
        <Animated.View style={[styles.section, staggerStyle(5)]}>
          <DailyChallengeCard onPress={() => {
            const challenge = getDailyChallengeForDate(today);
            const skillId = getSkillIdForChallenge(challenge.category, masteredSkills);
            navigation.navigate('Exercise', {
              exerciseId: 'ai-mode',
              aiMode: true,
              skillId,
            });
          }} />
        </Animated.View>

        {/* Quick Stats Row */}
        <Animated.View style={[styles.section, staggerStyle(6)]}>
          <View style={styles.statsPillRow}>
            <StatPill icon="music-note" label="Exercises" value={totalCompleted} color={COLORS.primary} />
            <StatPill icon="book-open-variant" label="Lessons" value={Object.values(lessonProgress).filter(l => l.status === 'completed').length} color={COLORS.info} />
            <StatPill icon="fire" label="Streak" value={streak} color={COLORS.streakFlame} />
            <StatPill icon="star" label="Stars" value={Object.values(lessonProgress).reduce((sum, l) => sum + Object.values(l.exerciseScores).reduce((s, e) => s + (e.stars ?? 0), 0), 0)} color={COLORS.starGold} />
          </View>
        </Animated.View>

        {/* Quick Actions Grid */}
        <Animated.View style={[styles.section, staggerStyle(7)]}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <ActionCard
              icon="book-open-outline"
              label="Learn"
              gradient={[COLORS.primaryDark, COLORS.cardSurface]}
              onPress={onNavigateToLesson ?? (() => navigation.navigate('DailySession'))}
            />
            <ActionCard
              icon="music-note-sixteenth-dotted"
              label="Songs"
              gradient={[COLORS.primaryDark, COLORS.cardSurface]}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Songs' } as any)}
            />
            <ActionCard
              icon="piano"
              label="Free Play"
              gradient={[COLORS.cardHighlight, COLORS.cardSurface]}
              onPress={onNavigateToSongs ?? (() => navigation.navigate('FreePlay'))}
            />
            <ActionCard
              icon="cat"
              label="Collection"
              gradient={[COLORS.cardHighlight, COLORS.cardSurface]}
              onPress={() => navigation.navigate('CatCollection')}
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
    <PressableScale haptic onPress={onPress} style={styles.actionCardWrapper}>
      <View style={styles.actionCard}>
        <LinearGradient colors={gradient as [string, string]} style={styles.actionCardGradient}>
          <MaterialCommunityIcons name={icon as any} size={28} color={COLORS.textPrimary} />
          <Text style={styles.actionLabel}>{label}</Text>
        </LinearGradient>
      </View>
    </PressableScale>
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
    ...TYPOGRAPHY.body.md,
    fontWeight: '500' as const,
    color: COLORS.textSecondary,
  },
  greetingName: {
    ...TYPOGRAPHY.heading.lg,
    fontWeight: '700' as const,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  gemCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: glowColor(COLORS.starGold, 0.1),
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: glowColor(COLORS.starGold, 0.25),
  },
  gemCountText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '800' as const,
    color: COLORS.gemGold,
  },
  settingsBtn: {
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: glowColor(COLORS.textPrimary, 0.05),
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
    backgroundColor: glowColor(COLORS.starGold, 0.1),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: glowColor(COLORS.starGold, 0.2),
  },
  levelText: {
    ...TYPOGRAPHY.body.sm,
    fontWeight: '700' as const,
    color: COLORS.starGold,
  },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: glowColor(COLORS.starGold, 0.1),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: glowColor(COLORS.starGold, 0.2),
  },
  xpText: {
    ...TYPOGRAPHY.body.sm,
    fontWeight: '700' as const,
    color: COLORS.starGold,
  },
  goalTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  goalLabel: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  goalValue: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '700' as const,
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
    backgroundColor: glowColor(COLORS.success, 0.15),
    borderRadius: BORDER_RADIUS.full,
  },
  goalCompleteText: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600' as const,
    color: COLORS.success,
  },
  // Evolution XP bar
  evolutionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    width: GOAL_ARC_SIZE + 40,
  },
  evolutionTrack: {
    flex: 1,
    height: 6,
    backgroundColor: glowColor(COLORS.evolutionGlow, 0.25),
    borderRadius: 3,
    overflow: 'hidden',
  },
  evolutionFill: {
    height: '100%',
    backgroundColor: COLORS.evolutionGlow,
    borderRadius: 3,
    minWidth: 4,
  },
  evolutionLabel: {
    ...TYPOGRAPHY.caption.sm,
    fontWeight: '600' as const,
    fontSize: 9,
    color: COLORS.evolutionGlow,
    minWidth: 50,
  },
  // Sections
  section: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.heading.md,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  // Continue Card
  continueCard: {
    ...SHADOWS.sm,
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
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '500' as const,
    color: COLORS.textMuted,
  },
  continueTitle: {
    ...TYPOGRAPHY.heading.sm,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  continueProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  continueProgressBar: {
    flex: 1,
  },
  continueProgressText: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600' as const,
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
    ...SHADOWS.sm,
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
    ...TYPOGRAPHY.heading.md,
    fontWeight: '800' as const,
  },
  statPillLabel: {
    ...TYPOGRAPHY.special.badge,
    color: COLORS.textMuted,
    fontSize: 10,
  },
  // Actions grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionCardWrapper: {
    width: (SCREEN_WIDTH - SPACING.md * 2 - SPACING.sm) / 2,
  },
  actionCard: {
    ...SHADOWS.sm,
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
    ...TYPOGRAPHY.body.sm,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
  },
});
