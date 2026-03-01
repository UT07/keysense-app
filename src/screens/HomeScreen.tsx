/**
 * HomeScreen Component
 * Duolingo-style home dashboard with hero section, cat companion,
 * daily goal arc, streak flame, stats pills, and continue learning card
 */

import React, { useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { PressableScale } from '../components/common/PressableScale';
import { AnimatedProgressBar } from '../components/common/AnimatedProgressBar';
import { GameCard } from '../components/common/GameCard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GradientMeshBackground } from '../components/effects';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { DailyChallengeCard } from '../components/DailyChallengeCard';
import { DailyRewardCalendar } from '../components/DailyRewardCalendar';
import { getDailyChallengeForDate } from '../core/challenges/challengeSystem';
import type { SkillCategory } from '../core/curriculum/SkillTree';
import { MusicLibrarySpotlight } from '../components/MusicLibrarySpotlight';
import { ReviewChallengeCard } from '../components/ReviewChallengeCard';
import { useSongStore } from '../stores/songStore';
import { Cat3DCanvas } from '../components/Mascot/3d';
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
import { generateSessionPlan } from '../core/curriculum/CurriculumEngine';
import type { ExerciseRef } from '../core/curriculum/CurriculumEngine';
import { SKILL_TREE, getSkillById } from '../core/curriculum/SkillTree';
import { getExercise } from '../content/ContentLoader';
import { useLearnerProfileStore } from '../stores/learnerProfileStore';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, glowColor } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/AppNavigator';

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

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
 * Only picks skills within the user's current tier range (not ahead of progress).
 */
function getSkillIdForChallenge(
  category: SkillCategory | undefined,
  masteredSkillIds: string[],
): string {
  const masteredSet = new Set(masteredSkillIds);

  // Determine the user's current tier ceiling (highest tier with a mastered skill + 1)
  let maxTier = 1;
  for (const skill of SKILL_TREE) {
    if (masteredSet.has(skill.id) && skill.tier > maxTier) {
      maxTier = skill.tier;
    }
  }
  const tierCeiling = maxTier + 1; // Allow one tier ahead

  // Category-specific: find first unmastered skill in that category within reach
  if (category) {
    const match = SKILL_TREE.find(
      (s) => s.category === category && !masteredSet.has(s.id) && s.tier <= tierCeiling,
    );
    if (match) return match.id;
    // All reachable skills mastered — pick last mastered one for review
    const lastMastered = [...SKILL_TREE]
      .reverse()
      .find((s) => s.category === category && masteredSet.has(s.id));
    if (lastMastered) return lastMastered.id;
  }

  // Generic challenge: pick first unmastered skill within reach
  const nextSkill = SKILL_TREE.find(
    (s) => !masteredSet.has(s.id) && s.tier <= tierCeiling,
  );
  return nextSkill?.id ?? SKILL_TREE[0].id;
}

export interface HomeScreenProps {
  onNavigateToSettings?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
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

  const totalCompleted = useMemo(() => {
    const lessons = getLessons();
    let totalDone = 0;
    for (const lesson of lessons) {
      const lp = lessonProgress[lesson.id];
      const completedCount = lp
        ? Object.values(lp.exerciseScores).filter((s) => s.completedAt != null).length
        : 0;
      totalDone += completedCount;
    }
    return totalDone;
  }, [lessonProgress]);

  // Today's Practice session plan (mini version of DailySessionScreen)
  const sessionPlan = useMemo(() => {
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
      profile.masteredSkills,
    );
  }, [masteredSkills]);

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
    [navigation],
  );

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
  const dailyRewards = useCatEvolutionStore((s) => s.dailyRewards);
  const claimDailyReward = useCatEvolutionStore((s) => s.claimDailyReward);
  const isDailyChallengeCompleted = useCatEvolutionStore((s) => s.isDailyChallengeCompleted);
  const advanceDailyRewardDate = useCatEvolutionStore((s) => s.advanceDailyRewardDate);

  // Advance daily rewards calendar on mount
  useEffect(() => {
    advanceDailyRewardDate();
  }, [advanceDailyRewardDate]);
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

  // Pulsing animation for the Continue Learning / Today's Practice card
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Shake animation for the Daily Challenge card (subtle horizontal shake every 5s)
  const shakeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const shake = () => {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 3, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -3, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 2, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -2, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    };
    // Initial shake after a short delay
    const initialTimeout = setTimeout(shake, 1000);
    // Repeat every 5 seconds
    const interval = setInterval(shake, 5000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [shakeAnim]);

  // Stagger animation
  const fadeAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(30))
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
    opacity: fadeAnims[Math.min(index, 9)],
    transform: [{ translateY: slideAnims[Math.min(index, 9)] }],
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
        {/* Hero Section with animated gradient mesh */}
        <Animated.View style={staggerStyle(0)}>
          <View style={styles.hero}>
            <GradientMeshBackground accent="home" />
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
                {/* Cat avatar in center — 3D model with SVG fallback */}
                <View style={styles.avatarInRing}>
                  <Cat3DCanvas
                    catId={selectedCatId ?? 'mini-meowww'}
                    size={120}
                    mood={mascotMood}
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
          </View>
        </Animated.View>

        {/* Today's Practice */}
        <Animated.View style={[styles.section, staggerStyle(1), { transform: [{ scale: pulseAnim }] }]}>
          <GameCard rarity="rare" testID="practice-game-card">
            <View style={styles.practiceHeader}>
              <Text style={styles.sectionTitle}>Today's Practice</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('DailySession')}
                style={styles.seeAllBtn}
              >
                <Text style={styles.seeAllText}>See All</Text>
                <MaterialCommunityIcons name="chevron-right" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.practiceProgressRow}>
              <AnimatedProgressBar
                progress={skillProgress / 100}
                color={COLORS.primary}
                height={6}
                style={{ flex: 1 }}
              />
              <Text style={styles.practiceProgressText}>{masteredSkills.length}/{totalSkills} skills</Text>
            </View>
            <HomePracticeSections plan={sessionPlan} onExercisePress={handleExercisePress} />
          </GameCard>
        </Animated.View>

        {/* Daily Challenge Card */}
        <Animated.View style={[styles.section, staggerStyle(2), { transform: [{ translateX: shakeAnim }] }]}>
          <GameCard rarity="epic" testID="challenge-game-card">
            <DailyChallengeCard masteredSkills={masteredSkills} onPress={() => {
              const challenge = getDailyChallengeForDate(today, masteredSkills);
              const skillId = getSkillIdForChallenge(challenge.category, masteredSkills);
              navigation.navigate('Exercise', {
                exerciseId: 'ai-mode',
                aiMode: true,
                skillId,
              });
            }} />
          </GameCard>
        </Animated.View>

        {/* Daily Reward Calendar */}
        <Animated.View style={[styles.section, staggerStyle(3)]}>
          <DailyRewardCalendar
            days={dailyRewards.days}
            currentDay={dailyRewards.currentDay}
            onClaim={(day) => claimDailyReward(day)}
            dailyChallengeCompleted={isDailyChallengeCompleted()}
          />
        </Animated.View>

        {/* Quick Stats Row */}
        <Animated.View style={[styles.section, staggerStyle(4)]}>
          <View style={styles.statsPillRow}>
            <StatPill icon="music-note" label="Exercises" value={totalCompleted} color={COLORS.primary} />
            <StatPill icon="book-open-variant" label="Lessons" value={Object.values(lessonProgress).filter(l => l.status === 'completed').length} color={COLORS.info} />
            <StatPill icon="fire" label="Streak" value={streak} color={COLORS.streakFlame} />
            <StatPill icon="star" label="Stars" value={Object.values(lessonProgress).reduce((sum, l) => sum + Object.values(l.exerciseScores).reduce((s, e) => s + (e.stars ?? 0), 0), 0)} color={COLORS.starGold} />
          </View>
        </Animated.View>

        {/* Music Library Spotlight */}
        <Animated.View style={[styles.section, staggerStyle(5)]}>
          <GameCard rarity="common" testID="music-library-game-card">
            <MusicLibrarySpotlight
              totalSongs={totalSongs}
              totalGenres={genres}
              featuredSong={featuredSong}
              onBrowse={() => navigation.navigate('MainTabs', { screen: 'Songs' })}
              onPlayFeatured={() => navigation.navigate('MainTabs', { screen: 'Songs' })}
            />
          </GameCard>
        </Animated.View>

        {/* Free Play */}
        <Animated.View style={[styles.section, staggerStyle(6)]}>
          <PressableScale haptic onPress={() => navigation.navigate('FreePlay')}>
            <View style={styles.freePlayCard} testID="free-play-card">
              <View style={styles.freePlayIconContainer}>
                <MaterialCommunityIcons name="piano" size={28} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.freePlayTitle}>Free Play</Text>
                <Text style={styles.freePlaySubtitle}>Practice freely on the keyboard</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textMuted} />
            </View>
          </PressableScale>
        </Animated.View>

        {/* Review Challenge (conditional — only when skills are decaying) */}
        {decayedSkillIds.length > 0 && (
          <Animated.View style={[styles.section, staggerStyle(7)]}>
            <GameCard rarity="rare" testID="review-game-card">
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
            </GameCard>
          </Animated.View>
        )}

        {/* Salsa coach greeting */}
        <Animated.View style={[styles.section, staggerStyle(8)]}>
          <SalsaCoach
            mood={mascotMood}
            size="small"
            showCatchphrase
            speakCatchphrase={false}
            catchphrase={catMessage}
          />
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
/** Section colors matching DailySessionScreen */
const PRACTICE_SECTION_COLORS = {
  warmUp: { accent: COLORS.warning, bg: glowColor(COLORS.warning, 0.08), border: glowColor(COLORS.warning, 0.2), icon: 'fire' as const, label: 'Warm Up' },
  lesson: { accent: COLORS.info, bg: glowColor(COLORS.info, 0.08), border: glowColor(COLORS.info, 0.2), icon: 'book-open-variant' as const, label: 'Lesson' },
  challenge: { accent: COLORS.primaryLight, bg: glowColor(COLORS.primaryLight, 0.08), border: glowColor(COLORS.primaryLight, 0.2), icon: 'lightning-bolt' as const, label: 'Challenge' },
} as const;

/** Compact practice sections for the HomeScreen dashboard */
function HomePracticeSections({ plan, onExercisePress }: {
  plan: { warmUp: ExerciseRef[]; lesson: ExerciseRef[]; challenge: ExerciseRef[] };
  onExercisePress: (ref: ExerciseRef) => void;
}) {
  return (
    <View style={styles.practiceContainer}>
      {(['warmUp', 'lesson', 'challenge'] as const).map((key) => {
        const exercises = plan[key];
        if (exercises.length === 0) return null;
        const sec = PRACTICE_SECTION_COLORS[key];
        return (
          <View key={key} style={styles.practiceSection}>
            <View style={styles.practiceSectionHeader}>
              <View style={[styles.practiceSectionIcon, { backgroundColor: sec.bg }]}>
                <MaterialCommunityIcons name={sec.icon} size={14} color={sec.accent} />
              </View>
              <Text style={[styles.practiceSectionLabel, { color: sec.accent }]}>{sec.label}</Text>
            </View>
            {exercises.map((ref, i) => {
              const exercise = ref.source === 'static' ? getExercise(ref.exerciseId) : null;
              const isAI = ref.source === 'ai' || ref.source === 'ai-with-fallback';
              const skillNode = isAI ? getSkillById(ref.skillNodeId) : null;
              const title = exercise?.metadata.title ?? skillNode?.name ?? 'AI Exercise';
              return (
                <PressableScale key={`${ref.exerciseId}-${i}`} haptic onPress={() => onExercisePress(ref)}>
                  <View style={[styles.practiceExerciseCard, { borderColor: sec.border, backgroundColor: sec.bg }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.practiceExerciseTitle} numberOfLines={1}>{title}</Text>
                      <Text style={styles.practiceExerciseReason} numberOfLines={1}>{ref.reason}</Text>
                    </View>
                    <View style={[styles.practicePlayIcon, { backgroundColor: sec.accent }]}>
                      <MaterialCommunityIcons name="play" size={16} color={COLORS.textPrimary} />
                    </View>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        );
      })}
    </View>
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
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
    overflow: 'hidden',
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
  // Today's Practice
  practiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingBottom: SPACING.sm,
  },
  seeAllText: {
    ...TYPOGRAPHY.body.sm,
    fontWeight: '600' as const,
    color: COLORS.primary,
  },
  practiceProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  practiceProgressText: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600' as const,
    color: COLORS.textMuted,
    minWidth: 60,
    textAlign: 'right',
  },
  practiceContainer: {
    gap: SPACING.sm,
  },
  practiceSection: {
    gap: SPACING.xs,
  },
  practiceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 2,
  },
  practiceSectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  practiceSectionLabel: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  practiceExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  practiceExerciseTitle: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '600' as const,
    color: COLORS.textPrimary,
  },
  practiceExerciseReason: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  practicePlayIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Free Play card
  freePlayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    gap: SPACING.md,
    ...SHADOWS.sm,
  },
  freePlayIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: glowColor(COLORS.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  freePlayTitle: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
  },
  freePlaySubtitle: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
