/**
 * ProfileScreen - User profile, stats, and settings
 * Features cat character avatar system with backstories and unlock levels
 * Duolingo-style gamification polish: progress ring, gradient stats, horizontal achievements
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Platform,
  Animated as RNAnimated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAchievementStore } from '../stores/achievementStore';
import { useGemStore } from '../stores/gemStore';
import { useCatEvolutionStore, xpToNextStage } from '../stores/catEvolutionStore';
import { EVOLUTION_XP_THRESHOLDS } from '../stores/types';
import { ACHIEVEMENTS } from '../core/achievements/achievements';
import type { Achievement } from '../core/achievements/achievements';
import { Cat3DCanvas } from '../components/Mascot/3d';
import { CAT_CHARACTERS, getCatById } from '../components/Mascot/catCharacters';
import { StreakFlame } from '../components/StreakFlame';
import { getLevelProgress } from '../core/progression/XpSystem';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, GRADIENTS, glowColor, shadowGlow } from '../theme/tokens';
import { useAuthStore } from '../stores/authStore';
import type { RootStackParamList } from '../navigation/AppNavigator';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

type ProfileNavProp = NativeStackNavigationProp<RootStackParamList>;

const DAILY_GOAL_OPTIONS = [5, 10, 15, 20];
const VOLUME_OPTIONS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1.0 },
];

/** Stat card accent colors for gradient overlays */
const STAT_ACCENTS = {
  level: glowColor(COLORS.primary, 0.2),
  xp: glowColor(COLORS.starGold, 0.2),
  streak: glowColor(COLORS.warning, 0.2),
  lessons: glowColor(COLORS.success, 0.2),
} as const;

const STAT_ACCENT_BORDERS = {
  level: glowColor(COLORS.primary, 0.45),
  xp: glowColor(COLORS.starGold, 0.45),
  streak: glowColor(COLORS.warning, 0.45),
  lessons: glowColor(COLORS.success, 0.45),
} as const;

const STAT_ICON_COLORS = {
  level: COLORS.primary,
  xp: COLORS.starGold,
  streak: COLORS.warning,
  lessons: COLORS.success,
} as const;

type StatAccentKey = keyof typeof STAT_ACCENTS;

/** Shield background icon for each stat badge */
const STAT_SHIELD_ICONS: Record<StatAccentKey, IconName> = {
  level: 'shield-star',
  xp: 'shield-star-outline',
  streak: 'shield-half-full',
  lessons: 'shield-check',
} as const;

interface StatItem {
  icon: IconName;
  label: string;
  value: number;
  accentKey: StatAccentKey;
  useFlame?: boolean;
}

/** Hook for animated count-up from 0 to target value */
function useCountUp(target: number, duration: number = 800): RNAnimated.Value {
  const animValue = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    animValue.setValue(0);
    const animation = RNAnimated.timing(animValue, {
      toValue: target,
      duration,
      useNativeDriver: false,
    });

    animation.start();

    return () => {
      animation.stop();
      animValue.stopAnimation();
    };
  }, [animValue, target, duration]);

  return animValue;
}

/** Animated stat value text that counts up from 0 */
function AnimatedStatValue({ value, color }: { value: number; color: string }): React.ReactElement {
  const animValue = useCountUp(value);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const listenerId = animValue.addListener(({ value: v }) => {
      setDisplayValue(Math.round(v));
    });
    return () => {
      animValue.removeListener(listenerId);
    };
  }, [animValue]);

  return (
    <Text style={[styles.statValue, { color }]}>{displayValue}</Text>
  );
}

/** Animated shimmer pulse wrapper for unlocked achievements */
function ShimmerBadge({ children, isUnlocked }: { children: React.ReactNode; isUnlocked: boolean }): React.ReactElement {
  const shimmerOpacity = useSharedValue(1);

  useEffect(() => {
    if (isUnlocked) {
      shimmerOpacity.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      shimmerOpacity.value = 1;
    }
  }, [isUnlocked, shimmerOpacity]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: isUnlocked ? shimmerOpacity.value : 0.5,
  }));

  return (
    <Animated.View style={shimmerStyle}>
      {children}
    </Animated.View>
  );
}

/** Animated streak badge with cycling orange-to-red color */
function StreakStatBadge({ value }: { value: number }): React.ReactElement {
  const colorProgress = useSharedValue(0);

  useEffect(() => {
    colorProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [colorProgress]);

  const colorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      colorProgress.value,
      [0, 0.5, 1],
      [COLORS.streakFlameWarm, COLORS.streakFlameMedium, COLORS.streakFlameHot],
    ),
  }));

  return (
    <View style={styles.streakBadgeContainer}>
      <StreakFlame streak={value} showCount={false} size="medium" />
      <Animated.Text style={[styles.streakBadgeValue, colorStyle]}>
        {value}
      </Animated.Text>
    </View>
  );
}

/** Get the last 7 days of practice data for the chart */
function useWeeklyPractice(): { day: string; minutes: number }[] {
  const { dailyGoalData } = useProgressStore();

  return useMemo(() => {
    const days: { day: string; minutes: number }[] = [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const dayLabel = dayLabels[date.getDay()];
      const minutes = dailyGoalData[key]?.minutesPracticed ?? 0;
      days.push({ day: dayLabel, minutes });
    }
    return days;
  }, [dailyGoalData]);
}

/** Achievements section as horizontal scroll with circular badges */
function AchievementsSection(): React.ReactElement {
  const { unlockedIds } = useAchievementStore();
  const unlockedSet = useMemo(() => new Set(Object.keys(unlockedIds)), [unlockedIds]);
  const unlockedCount = unlockedSet.size;
  const totalCount = ACHIEVEMENTS.length;

  // Determine recently unlocked (within last 24 hours)
  const recentlyUnlockedSet = useMemo(() => {
    const recent = new Set<string>();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const [id, timestamp] of Object.entries(unlockedIds)) {
      if (new Date(timestamp).getTime() > oneDayAgo) {
        recent.add(id);
      }
    }
    return recent;
  }, [unlockedIds]);

  // Sort: unlocked first (newest first), then locked
  const sortedAchievements = useMemo(() => {
    const unlocked: Achievement[] = [];
    const locked: Achievement[] = [];
    for (const a of ACHIEVEMENTS) {
      if (unlockedSet.has(a.id)) {
        unlocked.push(a);
      } else {
        locked.push(a);
      }
    }
    // Sort unlocked by unlock time (newest first)
    unlocked.sort((a, b) => {
      const timeA = unlockedIds[a.id] ?? '';
      const timeB = unlockedIds[b.id] ?? '';
      return timeB.localeCompare(timeA);
    });
    return [...unlocked, ...locked];
  }, [unlockedSet, unlockedIds]);

  const handleBadgePress = useCallback((achievement: Achievement, isUnlocked: boolean) => {
    if (isUnlocked) {
      Alert.alert(
        achievement.title,
        `${achievement.description}\n\n+${achievement.xpReward} XP`,
      );
    } else {
      Alert.alert(
        achievement.title,
        achievement.description,
      );
    }
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.achievementHeader}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <Text style={styles.achievementCounter}>
          {unlockedCount}/{totalCount}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.achievementScrollContent}
      >
        {sortedAchievements.map((achievement) => {
          const isUnlocked = unlockedSet.has(achievement.id);
          const isRecent = recentlyUnlockedSet.has(achievement.id);
          return (
            <TouchableOpacity
              key={achievement.id}
              style={styles.achievementBadgeContainer}
              onPress={() => handleBadgePress(achievement, isUnlocked)}
              activeOpacity={0.7}
            >
              <ShimmerBadge isUnlocked={isUnlocked}>
                <View
                  style={[
                    styles.achievementBadge,
                    isUnlocked
                      ? styles.achievementBadgeUnlocked
                      : styles.achievementBadgeLocked,
                    isRecent && styles.achievementBadgeRecent,
                  ]}
                >
                  {isUnlocked ? (
                    <MaterialCommunityIcons
                      name={achievement.icon as IconName}
                      size={32}
                      color={COLORS.starGold}
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="lock"
                      size={24}
                      color={COLORS.textMuted}
                    />
                  )}
                </View>
              </ShimmerBadge>
              <Text
                style={[
                  styles.achievementBadgeLabel,
                  !isUnlocked && styles.achievementBadgeLabelLocked,
                ]}
                numberOfLines={2}
              >
                {achievement.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** SVG progress ring for level display */
function LevelProgressRing({
  percent,
  level,
  size,
  catColor,
}: {
  percent: number;
  level: number;
  size: number;
  catColor: string;
}): React.ReactElement {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = (1 - percent / 100) * circumference;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={COLORS.cardBorder}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Foreground progress */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={catColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </Svg>
      {/* Center content */}
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={styles.levelRingLabel}>Level</Text>
          <Text style={[styles.levelRingValue, { color: catColor }]}>{level}</Text>
        </View>
      </View>
    </View>
  );
}

export function ProfileScreen(): React.ReactElement {
  const navigation = useNavigation<ProfileNavProp>();
  const { totalXp, level, streakData, lessonProgress } = useProgressStore();
  const {
    dailyGoalMinutes, masterVolume, displayName, selectedCatId,
    preferredInputMethod, micDetectionMode,
    setDailyGoalMinutes, setMasterVolume, setDisplayName,
    setPreferredInputMethod, setMicDetectionMode,
  } = useSettingsStore();
  const weeklyPractice = useWeeklyPractice();
  const totalWeekMinutes = weeklyPractice.reduce((sum, d) => sum + d.minutes, 0);
  const maxDayMinutes = Math.max(...weeklyPractice.map(d => d.minutes), 1);

  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showVolumePicker, setShowVolumePicker] = useState(false);
  const [showInputPicker, setShowInputPicker] = useState(false);
  const [showDetectionModePicker, setShowDetectionModePicker] = useState(false);
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [editingName, setEditingName] = useState(displayName);

  const selectedCat = getCatById(selectedCatId) ?? CAT_CHARACTERS[0];
  const catColor = selectedCat.color;

  // Gem balance
  const gems = useGemStore((s) => s.gems);

  // Cat evolution
  const evolutionData = useCatEvolutionStore((s) => s.evolutionData[selectedCatId]);
  const evolutionStage = evolutionData?.currentStage ?? 'baby';
  const evolutionXp = evolutionData?.xpAccumulated ?? 0;
  const nextStageInfo = xpToNextStage(evolutionXp);

  // Level progress
  const levelProgress = getLevelProgress(totalXp);

  // Calculate total lessons completed
  const completedLessons = Object.values(lessonProgress).filter(
    (lesson) => lesson.status === 'completed'
  ).length;

  const stats: StatItem[] = [
    { icon: 'trophy', label: 'Level', value: level, accentKey: 'level' },
    { icon: 'star', label: 'Total XP', value: totalXp, accentKey: 'xp' },
    { icon: 'fire', label: 'Day Streak', value: streakData.currentStreak, accentKey: 'streak', useFlame: true },
    { icon: 'book-open', label: 'Lessons Done', value: completedLessons, accentKey: 'lessons' },
  ];

  // Goal line height for the chart
  const goalLineHeight = dailyGoalMinutes > 0
    ? Math.max(8, (dailyGoalMinutes / Math.max(maxDayMinutes, dailyGoalMinutes)) * 80)
    : 0;

  const handleSaveName = useCallback(() => {
    const trimmed = editingName.trim();
    if (trimmed.length > 0) {
      setDisplayName(trimmed);
      // Also push to Firebase Auth so it syncs across devices
      const { updateDisplayName, user } = useAuthStore.getState();
      if (user && !user.isAnonymous) {
        updateDisplayName(trimmed).catch(() => {});
      }
    }
    setShowNameEditor(false);
  }, [editingName, setDisplayName]);

  return (
    <SafeAreaView style={styles.container} testID="profile-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="profile-scroll"
      >
        {/* Gradient Header with cat avatar centerpiece and level progress ring */}
        <LinearGradient
          colors={[catColor + '22', COLORS.surface, COLORS.background]}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => navigation.navigate('CatSwitch')}
            activeOpacity={0.7}
            testID="profile-open-cat-switch"
          >
            {/* Circular halo glow behind avatar */}
            <View style={[styles.avatarHalo, { backgroundColor: glowColor(catColor, 0.18) }]} />
            <View style={[styles.avatarHaloInner, { borderColor: glowColor(catColor, 0.25) }]} />
            <Cat3DCanvas catId={selectedCatId} size={140} evolutionStage={evolutionStage} />
            <View style={styles.editBadge}>
              <MaterialCommunityIcons name="pencil" size={12} color={COLORS.textPrimary} />
            </View>
          </TouchableOpacity>

          {/* Level progress ring */}
          <LevelProgressRing
            percent={levelProgress.percentToNextLevel}
            level={levelProgress.level}
            size={80}
            catColor={catColor}
          />
          <Text style={styles.xpToNextText}>
            {levelProgress.xpToNextLevel} XP to next
          </Text>

          <TouchableOpacity onPress={() => { setEditingName(displayName); setShowNameEditor(true); }}>
            <View style={styles.nameRow}>
              <Text style={styles.username}>{displayName}</Text>
              <MaterialCommunityIcons name="pencil-outline" size={16} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
          <Text style={styles.subtitle}>
            Level {level} Pianist {selectedCat.personality ? `\u00B7 ${selectedCat.name}` : ''}
          </Text>
        </LinearGradient>

        {/* Stats Grid — game-style shield badges */}
        <View style={styles.statsGrid}>
          {stats.map((stat) => {
            const accentColor = STAT_ICON_COLORS[stat.accentKey];
            return (
              <LinearGradient
                key={stat.label}
                colors={[...GRADIENTS.cardWarm]}
                style={[
                  styles.statCard,
                  { borderColor: STAT_ACCENT_BORDERS[stat.accentKey] },
                  shadowGlow(accentColor, 8) as Record<string, unknown>,
                ]}
              >
                <View style={[styles.statAccentOverlay, { backgroundColor: STAT_ACCENTS[stat.accentKey] }]} />
                {/* Shield background watermark */}
                <View style={styles.shieldWatermark}>
                  <MaterialCommunityIcons
                    name={STAT_SHIELD_ICONS[stat.accentKey]}
                    size={64}
                    color={glowColor(accentColor, 0.08)}
                  />
                </View>
                {stat.useFlame ? (
                  <StreakStatBadge value={stat.value} />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name={stat.icon}
                      size={28}
                      color={accentColor}
                    />
                    <AnimatedStatValue value={stat.value} color={COLORS.textPrimary} />
                  </>
                )}
                <Text style={styles.statLabel}>{stat.label}</Text>
              </LinearGradient>
            );
          })}
          {/* Gem balance badge */}
          <LinearGradient
            colors={[...GRADIENTS.cardWarm]}
            style={[
              styles.statCard,
              { borderColor: glowColor(COLORS.starGold, 0.45) },
              shadowGlow(COLORS.gemGold, 8) as Record<string, unknown>,
            ]}
          >
            <View style={[styles.statAccentOverlay, { backgroundColor: glowColor(COLORS.starGold, 0.2) }]} />
            <View style={styles.shieldWatermark}>
              <MaterialCommunityIcons
                name="shield-star-outline"
                size={64}
                color={glowColor(COLORS.gemGold, 0.08)}
              />
            </View>
            <MaterialCommunityIcons name="diamond-stone" size={28} color={COLORS.gemGold} />
            <AnimatedStatValue value={gems} color={COLORS.textPrimary} />
            <Text style={styles.statLabel}>Gems</Text>
          </LinearGradient>
        </View>

        {/* Evolution Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Evolution Progress</Text>
          <View style={styles.evolutionCard}>
            <View style={styles.evolutionHeader}>
              <MaterialCommunityIcons name="paw" size={32} color={COLORS.evolutionGlow} />
              <View style={styles.evolutionHeaderText}>
                <Text style={styles.evolutionStageName}>
                  {selectedCat.name}
                </Text>
                <Text style={styles.evolutionStageLabel}>
                  {evolutionStage.charAt(0).toUpperCase() + evolutionStage.slice(1)} Stage
                </Text>
              </View>
              <View style={styles.evolutionXpBadge}>
                <MaterialCommunityIcons name="star-four-points" size={14} color={COLORS.evolutionGlow} />
                <Text style={styles.evolutionXpBadgeText}>{evolutionXp} XP</Text>
              </View>
            </View>
            {nextStageInfo ? (
              <>
                <View style={styles.evolutionBarTrack}>
                  <View
                    style={[
                      styles.evolutionBarFill,
                      {
                        width: `${Math.max(3, Math.min(100, Math.round(
                          ((evolutionXp - EVOLUTION_XP_THRESHOLDS[evolutionStage]) /
                            (EVOLUTION_XP_THRESHOLDS[nextStageInfo.nextStage] - EVOLUTION_XP_THRESHOLDS[evolutionStage])) * 100
                        )))}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.evolutionFooter}>
                  <Text style={styles.evolutionXpText}>
                    {evolutionXp - EVOLUTION_XP_THRESHOLDS[evolutionStage]} / {EVOLUTION_XP_THRESHOLDS[nextStageInfo.nextStage] - EVOLUTION_XP_THRESHOLDS[evolutionStage]} XP
                  </Text>
                  <Text style={styles.evolutionNextLabel}>
                    Next: {nextStageInfo.nextStage.charAt(0).toUpperCase() + nextStageInfo.nextStage.slice(1)}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.evolutionMaxBadge}>
                <MaterialCommunityIcons name="crown" size={16} color={COLORS.starGold} />
                <Text style={styles.evolutionMaxText}>Max stage reached!</Text>
              </View>
            )}
          </View>
        </View>

        {/* Weekly Practice Chart */}
        <View style={styles.section}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <Text style={styles.chartTotal}>{totalWeekMinutes} min total</Text>
          </View>
          <View style={styles.chartContainer}>
            {/* Goal line (dashed) */}
            {goalLineHeight > 0 && (
              <View
                style={[
                  styles.goalLine,
                  { bottom: goalLineHeight + 28 },
                ]}
              >
                <View style={styles.goalLineDash} />
                <Text style={styles.goalLineLabel}>{dailyGoalMinutes}m</Text>
              </View>
            )}
            {weeklyPractice.map((day, index) => {
              const effectiveMax = Math.max(maxDayMinutes, dailyGoalMinutes);
              const barHeight = day.minutes > 0
                ? Math.max(8, (day.minutes / effectiveMax) * 80)
                : 4;
              const isToday = index === 6;
              return (
                <View key={day.day} style={styles.chartColumn}>
                  <Text style={styles.chartMinutes}>
                    {day.minutes > 0 ? day.minutes : ''}
                  </Text>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: barHeight,
                          width: isToday ? 22 : 16,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                          borderBottomLeftRadius: 2,
                          borderBottomRightRadius: 2,
                          backgroundColor: day.minutes > 0
                            ? (isToday ? COLORS.primary : COLORS.primary + '88')
                            : COLORS.cardBorder,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartDay, isToday && styles.chartDayActive]}>
                    {day.day}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Achievements as horizontal scroll */}
        <AchievementsSection />

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <TouchableOpacity style={styles.settingItem} onPress={() => setShowGoalPicker(!showGoalPicker)}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="target" size={24} color={COLORS.textSecondary} />
              <Text style={styles.settingLabel}>Daily Goal</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>{dailyGoalMinutes} min</Text>
              <MaterialCommunityIcons name={showGoalPicker ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
          {showGoalPicker && (
            <View style={styles.pickerRow}>
              {DAILY_GOAL_OPTIONS.map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[styles.pickerChip, dailyGoalMinutes === mins && styles.pickerChipActive]}
                  onPress={() => { setDailyGoalMinutes(mins); setShowGoalPicker(false); }}
                >
                  <Text style={[styles.pickerChipText, dailyGoalMinutes === mins && styles.pickerChipTextActive]}>
                    {mins} min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.settingItem} onPress={() => setShowVolumePicker(!showVolumePicker)}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="volume-high" size={24} color={COLORS.textSecondary} />
              <Text style={styles.settingLabel}>Volume</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>{Math.round(masterVolume * 100)}%</Text>
              <MaterialCommunityIcons name={showVolumePicker ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
          {showVolumePicker && (
            <View style={styles.pickerRow}>
              {VOLUME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pickerChip, masterVolume === opt.value && styles.pickerChipActive]}
                  onPress={() => { setMasterVolume(opt.value); setShowVolumePicker(false); }}
                >
                  <Text style={[styles.pickerChipText, masterVolume === opt.value && styles.pickerChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.settingItem} onPress={() => setShowInputPicker(!showInputPicker)}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="music-note" size={24} color={COLORS.textSecondary} />
              <Text style={styles.settingLabel}>Input Method</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>
                {preferredInputMethod === 'auto' ? 'Auto' : preferredInputMethod === 'midi' ? 'MIDI' : preferredInputMethod === 'mic' ? 'Mic' : 'Touch'}
              </Text>
              <MaterialCommunityIcons name={showInputPicker ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
          {showInputPicker && (
            <View style={styles.pickerRow}>
              {([
                { value: 'auto', label: 'Auto', icon: 'auto-fix' },
                { value: 'midi', label: 'MIDI', icon: 'piano' },
                { value: 'mic', label: 'Mic', icon: 'microphone' },
                { value: 'touch', label: 'Touch', icon: 'gesture-tap' },
              ] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pickerChip, preferredInputMethod === opt.value && styles.pickerChipActive]}
                  onPress={() => {
                    if (opt.value === 'mic') {
                      // Set 'mic' explicitly — 'auto' mode skips mic to avoid
                      // iOS audio routing to earpiece. MicSetupScreen handles
                      // permission; preference must be stored regardless.
                      setPreferredInputMethod('mic');
                      navigation.navigate('MicSetup');
                      setShowInputPicker(false);
                    } else {
                      setPreferredInputMethod(opt.value);
                      setShowInputPicker(false);
                    }
                  }}
                >
                  <Text style={[styles.pickerChipText, preferredInputMethod === opt.value && styles.pickerChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {(preferredInputMethod === 'mic' || preferredInputMethod === 'auto') && (
            <>
              <TouchableOpacity style={styles.settingItem} onPress={() => setShowDetectionModePicker(!showDetectionModePicker)}>
                <View style={styles.settingLeft}>
                  <MaterialCommunityIcons name="waveform" size={24} color={COLORS.textSecondary} />
                  <Text style={styles.settingLabel}>Mic Detection</Text>
                </View>
                <View style={styles.settingRight}>
                  <Text style={styles.settingValue}>
                    {micDetectionMode === 'polyphonic' ? 'Chords' : 'Single Notes'}
                  </Text>
                  <MaterialCommunityIcons name={showDetectionModePicker ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textMuted} />
                </View>
              </TouchableOpacity>
              {showDetectionModePicker && (
                <View style={styles.pickerRow}>
                  {([
                    { value: 'monophonic' as const, label: 'Single Notes' },
                    { value: 'polyphonic' as const, label: 'Chords (AI)' },
                  ]).map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.pickerChip, micDetectionMode === opt.value && styles.pickerChipActive]}
                      onPress={() => {
                        setMicDetectionMode(opt.value);
                        setShowDetectionModePicker(false);
                      }}
                    >
                      <Text style={[styles.pickerChipText, micDetectionMode === opt.value && styles.pickerChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('CatSwitch')}
            testID="profile-open-cat-switch-row"
          >
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="cat" size={24} color={COLORS.textSecondary} />
              <Text style={styles.settingLabel}>Change Cat</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('MidiSetup')}
            testID="profile-open-midi-setup"
          >
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="piano" size={24} color={COLORS.textSecondary} />
              <Text style={styles.settingLabel}>MIDI Setup</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('Account')}
            testID="profile-open-account"
          >
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="account-cog" size={24} color={COLORS.textSecondary} />
              <Text style={styles.settingLabel}>Account</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('About Purrrfect Keys', 'Purrrfect Keys v1.0.0\nAI-Powered Piano Learning\n\nLearn piano with real-time feedback, MIDI support, and AI coaching.')}
          >
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="information" size={24} color={COLORS.textSecondary} />
              <Text style={styles.settingLabel}>About</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Name Editor Modal */}
      <Modal visible={showNameEditor} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Name</Text>
            <TextInput
              style={styles.nameInput}
              value={editingName}
              onChangeText={setEditingName}
              maxLength={30}
              autoFocus
              selectTextOnFocus
              placeholder="Your name"
              placeholderTextColor={COLORS.textMuted}
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowNameEditor(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleSaveName}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  avatarContainer: {
    marginBottom: SPACING.md,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 160,
  },
  avatarHalo: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
  },
  avatarHaloInner: {
    position: 'absolute',
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 2,
  },
  editBadge: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  username: {
    ...TYPOGRAPHY.display.sm,
    fontWeight: '800' as const,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.heading.sm,
    fontWeight: '400' as const,
    color: COLORS.textSecondary,
  },
  // Level progress ring
  levelRingLabel: {
    ...TYPOGRAPHY.caption.md,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  levelRingValue: {
    ...TYPOGRAPHY.display.sm,
    fontSize: 22,
    fontWeight: '800' as const,
  },
  xpToNextText: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600' as const,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  // Stats grid — shield badge style
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.md - 4,
  },
  statCard: {
    ...SHADOWS.md,
    flex: 1,
    minWidth: '45%',
    padding: SPACING.lg - 2,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  statAccentOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.lg,
  },
  shieldWatermark: {
    position: 'absolute',
    right: -4,
    bottom: -6,
    opacity: 1,
  },
  statValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900' as const,
    marginTop: SPACING.xs,
  },
  statLabel: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  // Streak badge
  streakBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakBadgeValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900' as const,
  },
  // Sections
  section: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.heading.lg,
    fontWeight: '800' as const,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  // Settings
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md - 4,
  },
  settingLabel: {
    ...TYPOGRAPHY.heading.sm,
    fontWeight: '400' as const,
    color: COLORS.textPrimary,
  },
  settingValue: {
    ...TYPOGRAPHY.heading.sm,
    fontWeight: '400' as const,
    color: COLORS.textSecondary,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  pickerChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.cardSurface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  pickerChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pickerChipText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  pickerChipTextActive: {
    color: COLORS.textPrimary,
  },
  // Chart
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  chartTotal: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '600' as const,
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    paddingBottom: SPACING.md - 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    height: 140,
    position: 'relative',
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  chartMinutes: {
    ...TYPOGRAPHY.caption.sm,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  chartBarTrack: {
    width: 24,
    height: 80,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartBar: {
    minHeight: 4,
  },
  chartDay: {
    ...TYPOGRAPHY.caption.md,
    fontWeight: '500' as const,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  chartDayActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  // Goal line
  goalLine: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 0,
  },
  goalLineDash: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: glowColor('#FFFFFF', 0.2),
  },
  goalLineLabel: {
    ...TYPOGRAPHY.caption.sm,
    fontSize: 9,
    fontWeight: '600' as const,
    color: glowColor('#FFFFFF', 0.3),
    marginLeft: SPACING.xs,
  },
  // Achievement badges (horizontal scroll)
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  achievementCounter: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '600' as const,
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  achievementScrollContent: {
    paddingRight: SPACING.md,
    gap: SPACING.md,
  },
  achievementBadgeContainer: {
    alignItems: 'center',
    width: 80,
  },
  achievementBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  achievementBadgeUnlocked: {
    backgroundColor: glowColor(COLORS.starGold, 0.18),
    borderWidth: 2,
    borderColor: glowColor(COLORS.starGold, 0.4),
    ...(Platform.OS === 'ios' ? {
      shadowColor: COLORS.starGold,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    } : { elevation: 4 }),
  },
  achievementBadgeLocked: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  achievementBadgeRecent: {
    shadowColor: COLORS.starGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  achievementBadgeLabel: {
    ...TYPOGRAPHY.caption.md,
    fontWeight: '500' as const,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  achievementBadgeLabelLocked: {
    color: COLORS.textMuted,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalCard: {
    ...SHADOWS.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modalTitle: {
    ...TYPOGRAPHY.heading.lg,
    fontWeight: '800' as const,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  nameInput: {
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md - 4,
    ...TYPOGRAPHY.heading.sm,
    fontWeight: '400' as const,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.cardSurface,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md - 4,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: SPACING.md - 4,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.cardSurface,
    alignItems: 'center',
  },
  modalCancelText: {
    ...TYPOGRAPHY.button.lg,
    color: COLORS.textSecondary,
  },
  modalSave: {
    flex: 1,
    paddingVertical: SPACING.md - 4,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    ...TYPOGRAPHY.button.lg,
    color: COLORS.textPrimary,
  },
  // Evolution progress
  evolutionCard: {
    ...SHADOWS.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: glowColor(COLORS.evolutionGlow, 0.25),
  },
  evolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  evolutionHeaderText: {
    flex: 1,
  },
  evolutionStageName: {
    ...TYPOGRAPHY.heading.sm,
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
  },
  evolutionStageLabel: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.evolutionGlow,
    fontWeight: '600' as const,
    marginTop: 1,
  },
  evolutionXpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: glowColor(COLORS.evolutionGlow, 0.12),
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
  },
  evolutionXpBadgeText: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '700' as const,
    color: COLORS.evolutionGlow,
  },
  evolutionBarTrack: {
    height: 10,
    backgroundColor: COLORS.cardBorder,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  evolutionBarFill: {
    height: '100%',
    backgroundColor: COLORS.evolutionGlow,
    borderRadius: 5,
  },
  evolutionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  evolutionXpText: {
    ...TYPOGRAPHY.caption.lg,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  evolutionNextLabel: {
    ...TYPOGRAPHY.caption.md,
    fontWeight: '600' as const,
    color: COLORS.evolutionGlow,
  },
  evolutionMaxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    backgroundColor: glowColor(COLORS.starGold, 0.1),
    borderRadius: BORDER_RADIUS.sm,
  },
  evolutionMaxText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: '700' as const,
    color: COLORS.starGold,
  },
});
