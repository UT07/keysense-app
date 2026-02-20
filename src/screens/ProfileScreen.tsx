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
  Animated as RNAnimated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAchievementStore } from '../stores/achievementStore';
import { ACHIEVEMENTS } from '../core/achievements/achievements';
import type { Achievement } from '../core/achievements/achievements';
import { CatAvatar } from '../components/Mascot/CatAvatar';
import { CAT_CHARACTERS, getCatById } from '../components/Mascot/catCharacters';
import { StreakFlame } from '../components/StreakFlame';
import { getLevelProgress } from '../core/progression/XpSystem';
import { COLORS, SPACING, BORDER_RADIUS } from '../theme/tokens';
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
  level: 'rgba(220, 20, 60, 0.15)',    // crimson
  xp: 'rgba(255, 215, 0, 0.15)',       // gold
  streak: 'rgba(255, 152, 0, 0.15)',    // orange
  lessons: 'rgba(76, 175, 80, 0.15)',   // green
} as const;

const STAT_ACCENT_BORDERS = {
  level: 'rgba(220, 20, 60, 0.3)',
  xp: 'rgba(255, 215, 0, 0.3)',
  streak: 'rgba(255, 152, 0, 0.3)',
  lessons: 'rgba(76, 175, 80, 0.3)',
} as const;

const STAT_ICON_COLORS = {
  level: '#DC143C',
  xp: '#FFD700',
  streak: '#FF9800',
  lessons: '#4CAF50',
} as const;

type StatAccentKey = keyof typeof STAT_ACCENTS;

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
                    color="#FFD700"
                  />
                ) : (
                  <MaterialCommunityIcons
                    name="lock"
                    size={24}
                    color="#555555"
                  />
                )}
              </View>
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
          stroke="#333333"
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
    setDailyGoalMinutes, setMasterVolume, setDisplayName,
  } = useSettingsStore();
  const weeklyPractice = useWeeklyPractice();
  const totalWeekMinutes = weeklyPractice.reduce((sum, d) => sum + d.minutes, 0);
  const maxDayMinutes = Math.max(...weeklyPractice.map(d => d.minutes), 1);

  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showVolumePicker, setShowVolumePicker] = useState(false);
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [editingName, setEditingName] = useState(displayName);

  const selectedCat = getCatById(selectedCatId) ?? CAT_CHARACTERS[0];
  const catColor = selectedCat.color;

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
        {/* Gradient Header with cat avatar and level progress ring */}
        <LinearGradient
          colors={[catColor + '22', '#1A1A2E', COLORS.background]}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => navigation.navigate('CatSwitch')}
            activeOpacity={0.7}
            testID="profile-open-cat-switch"
          >
            <CatAvatar catId={selectedCatId} size="large" showTooltipOnTap={false} />
            <View style={styles.editBadge}>
              <MaterialCommunityIcons name="pencil" size={12} color="#FFF" />
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
              <MaterialCommunityIcons name="pencil-outline" size={16} color="#666666" />
            </View>
          </TouchableOpacity>
          <Text style={styles.subtitle}>
            Level {level} Pianist {selectedCat.personality ? `\u00B7 ${selectedCat.name}` : ''}
          </Text>
        </LinearGradient>

        {/* Stats Grid with gradient backgrounds */}
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <LinearGradient
              key={stat.label}
              colors={['#1E1E32', '#1A1A2E']}
              style={[
                styles.statCard,
                { borderColor: STAT_ACCENT_BORDERS[stat.accentKey] },
              ]}
            >
              <View style={[styles.statAccentOverlay, { backgroundColor: STAT_ACCENTS[stat.accentKey] }]} />
              {stat.useFlame ? (
                <StreakFlame streak={stat.value} showCount={false} size="small" />
              ) : (
                <MaterialCommunityIcons
                  name={stat.icon}
                  size={32}
                  color={STAT_ICON_COLORS[stat.accentKey]}
                />
              )}
              <AnimatedStatValue value={stat.value} color={COLORS.textPrimary} />
              <Text style={styles.statLabel}>{stat.label}</Text>
            </LinearGradient>
          ))}
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
                            : '#333333',
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
              <MaterialCommunityIcons name="target" size={24} color="#B0B0B0" />
              <Text style={styles.settingLabel}>Daily Goal</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>{dailyGoalMinutes} min</Text>
              <MaterialCommunityIcons name={showGoalPicker ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
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
              <MaterialCommunityIcons name="volume-high" size={24} color="#B0B0B0" />
              <Text style={styles.settingLabel}>Volume</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={styles.settingValue}>{Math.round(masterVolume * 100)}%</Text>
              <MaterialCommunityIcons name={showVolumePicker ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
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

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('CatSwitch')}
            testID="profile-open-cat-switch-row"
          >
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="cat" size={24} color="#B0B0B0" />
              <Text style={styles.settingLabel}>Change Cat</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('MidiSetup')}
            testID="profile-open-midi-setup"
          >
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="piano" size={24} color="#B0B0B0" />
              <Text style={styles.settingLabel}>MIDI Setup</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('Account')}
            testID="profile-open-account"
          >
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="account-cog" size={24} color="#B0B0B0" />
              <Text style={styles.settingLabel}>Account</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => Alert.alert('About Purrrfect Keys', 'Purrrfect Keys v1.0.0\nAI-Powered Piano Learning\n\nLearn piano with real-time feedback, MIDI support, and AI coaching.')}
          >
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="information" size={24} color="#B0B0B0" />
              <Text style={styles.settingLabel}>About</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
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
              placeholderTextColor="#666"
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
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A1A2E',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
  },
  // Level progress ring
  levelRingLabel: {
    fontSize: 11,
    color: '#B0B0B0',
    fontWeight: '600',
  },
  levelRingValue: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  xpToNextText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginTop: SPACING.xs,
  },
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: SPACING.md - 4,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 20,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  statAccentOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BORDER_RADIUS.md,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: SPACING.sm,
  },
  statLabel: {
    fontSize: 14,
    color: '#B0B0B0',
    marginTop: SPACING.xs,
  },
  // Sections
  section: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
    borderColor: '#2A2A2A',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md - 4,
  },
  settingLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  settingValue: {
    fontSize: 16,
    color: '#B0B0B0',
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
    backgroundColor: '#252525',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  pickerChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pickerChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B0B0',
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
    fontSize: 14,
    fontWeight: '600',
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
    borderColor: '#2A2A2A',
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
    fontSize: 10,
    color: '#B0B0B0',
    marginBottom: SPACING.xs,
    fontWeight: '600',
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
    fontSize: 11,
    color: '#666666',
    marginTop: 6,
    fontWeight: '500',
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
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  goalLineLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.3)',
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  // Achievement badges (horizontal scroll)
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  achievementCounter: {
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  achievementBadgeLocked: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  achievementBadgeRecent: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  achievementBadgeLabel: {
    fontSize: 11,
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontWeight: '500',
  },
  achievementBadgeLabelLocked: {
    color: '#555555',
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
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md - 4,
    fontSize: 16,
    color: COLORS.textPrimary,
    backgroundColor: '#252525',
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
    backgroundColor: '#252525',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B0B0B0',
  },
  modalSave: {
    flex: 1,
    paddingVertical: SPACING.md - 4,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});
