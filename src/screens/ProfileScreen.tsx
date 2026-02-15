/**
 * ProfileScreen - User profile, stats, and settings
 * Features cat character avatar system with backstories and unlock levels
 */

import React, { useState, useMemo, useCallback } from 'react';
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
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAchievementStore } from '../stores/achievementStore';
import { ACHIEVEMENTS } from '../core/achievements/achievements';
import type { Achievement } from '../core/achievements/achievements';
import { CatAvatar } from '../components/Mascot/CatAvatar';
import { CAT_CHARACTERS, getCatById, isCatUnlocked } from '../components/Mascot/catCharacters';
import type { CatCharacter } from '../components/Mascot/catCharacters';
import type { RootStackParamList } from '../navigation/AppNavigator';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface StatItem {
  icon: IconName;
  label: string;
  value: number;
}

type ProfileNavProp = NativeStackNavigationProp<RootStackParamList>;

const DAILY_GOAL_OPTIONS = [5, 10, 15, 20];
const VOLUME_OPTIONS = [
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '75%', value: 0.75 },
  { label: '100%', value: 1.0 },
];

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

/** Individual cat card in the picker grid */
function CatPickerCard({
  cat,
  isSelected,
  isUnlocked,
  onSelect,
  onShowBackstory,
}: {
  cat: CatCharacter;
  isSelected: boolean;
  isUnlocked: boolean;
  onSelect: (id: string) => void;
  onShowBackstory: (id: string) => void;
}): React.ReactElement {
  return (
    <TouchableOpacity
      style={[
        catPickerStyles.card,
        isSelected && { borderColor: '#DC143C', borderWidth: 2 },
        !isUnlocked && catPickerStyles.cardLocked,
      ]}
      onPress={() => {
        if (isUnlocked) {
          onSelect(cat.id);
        }
      }}
      onLongPress={() => onShowBackstory(cat.id)}
      activeOpacity={isUnlocked ? 0.7 : 1.0}
    >
      {/* Lock overlay for locked cats */}
      {!isUnlocked && (
        <View style={catPickerStyles.lockOverlay}>
          <MaterialCommunityIcons name="lock" size={20} color="#888" />
          <Text style={catPickerStyles.lockLevel}>Level {cat.unlockLevel}</Text>
        </View>
      )}

      {/* Cat emoji */}
      <View
        style={[
          catPickerStyles.emojiContainer,
          { backgroundColor: isUnlocked ? cat.color + '22' : '#1A1A1A' },
        ]}
      >
        <Text
          style={[
            catPickerStyles.emojiText,
            !isUnlocked && { opacity: 0.3 },
          ]}
        >
          {cat.emoji}
        </Text>
      </View>

      {/* Cat info */}
      <Text
        style={[
          catPickerStyles.catName,
          !isUnlocked && { color: '#555' },
        ]}
      >
        {cat.name}
      </Text>
      <Text
        style={[
          catPickerStyles.catSkill,
          !isUnlocked && { color: '#444' },
        ]}
      >
        {cat.musicSkill}
      </Text>

      {/* Personality badge */}
      {isUnlocked && (
        <View style={[catPickerStyles.personalityBadge, { backgroundColor: cat.color + '33' }]}>
          <Text style={[catPickerStyles.personalityText, { color: cat.color }]}>
            {cat.personality}
          </Text>
        </View>
      )}

      {/* Selected check */}
      {isSelected && (
        <View style={catPickerStyles.selectedCheck}>
          <MaterialCommunityIcons name="check-circle" size={20} color="#DC143C" />
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Achievements section with unlocked/locked badges */
function AchievementsSection(): React.ReactElement {
  const { unlockedIds } = useAchievementStore();
  const unlockedSet = useMemo(() => new Set(Object.keys(unlockedIds)), [unlockedIds]);
  const unlockedCount = unlockedSet.size;
  const totalCount = ACHIEVEMENTS.length;

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

  return (
    <View style={styles.section}>
      <View style={styles.achievementHeader}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <Text style={styles.achievementCounter}>
          {unlockedCount}/{totalCount}
        </Text>
      </View>
      {sortedAchievements.map((achievement) => {
        const isUnlocked = unlockedSet.has(achievement.id);
        return (
          <View
            key={achievement.id}
            style={[
              styles.achievementCard,
              !isUnlocked && styles.achievementCardLocked,
            ]}
          >
            <View
              style={[
                styles.achievementIconContainer,
                isUnlocked
                  ? styles.achievementIconUnlocked
                  : styles.achievementIconLocked,
              ]}
            >
              <MaterialCommunityIcons
                name={achievement.icon as IconName}
                size={28}
                color={isUnlocked ? '#FFD700' : '#555555'}
              />
            </View>
            <View style={styles.achievementContent}>
              <Text
                style={[
                  styles.achievementTitle,
                  !isUnlocked && styles.achievementTitleLocked,
                ]}
              >
                {achievement.title}
              </Text>
              <Text
                style={[
                  styles.achievementDescription,
                  !isUnlocked && styles.achievementDescriptionLocked,
                ]}
              >
                {achievement.description}
              </Text>
            </View>
            {isUnlocked && (
              <View style={styles.achievementXpBadge}>
                <Text style={styles.achievementXpText}>+{achievement.xpReward}</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function ProfileScreen(): React.ReactElement {
  const navigation = useNavigation<ProfileNavProp>();
  const { totalXp, level, streakData, lessonProgress } = useProgressStore();
  const {
    dailyGoalMinutes, masterVolume, displayName, selectedCatId,
    setDailyGoalMinutes, setMasterVolume, setDisplayName, setSelectedCatId,
  } = useSettingsStore();
  const weeklyPractice = useWeeklyPractice();
  const totalWeekMinutes = weeklyPractice.reduce((sum, d) => sum + d.minutes, 0);
  const maxDayMinutes = Math.max(...weeklyPractice.map(d => d.minutes), 1);

  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showVolumePicker, setShowVolumePicker] = useState(false);
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(displayName);

  const selectedCat = getCatById(selectedCatId) ?? CAT_CHARACTERS[0];

  // Calculate total lessons completed
  const completedLessons = Object.values(lessonProgress).filter(
    (lesson) => lesson.status === 'completed'
  ).length;

  const stats: StatItem[] = [
    { icon: 'trophy', label: 'Level', value: level },
    { icon: 'star', label: 'Total XP', value: totalXp },
    { icon: 'fire', label: 'Day Streak', value: streakData.currentStreak },
    { icon: 'book-open', label: 'Lessons Done', value: completedLessons },
  ];

  const handleSaveName = useCallback(() => {
    const trimmed = editingName.trim();
    if (trimmed.length > 0) {
      setDisplayName(trimmed);
    }
    setShowNameEditor(false);
  }, [editingName, setDisplayName]);

  const handleSelectCat = useCallback((catId: string) => {
    setSelectedCatId(catId);
    const cat = getCatById(catId);
    if (cat) {
      // Also update the avatarEmoji to the cat's emoji for backwards compatibility
      useSettingsStore.getState().setAvatarEmoji(cat.emoji);
    }
  }, [setSelectedCatId]);

  const handleToggleBackstory = useCallback((catId: string) => {
    setExpandedCatId((prev) => (prev === catId ? null : catId));
  }, []);

  const renderCatItem = useCallback(({ item }: { item: CatCharacter }) => {
    const unlocked = isCatUnlocked(item.id, level);
    return (
      <CatPickerCard
        cat={item}
        isSelected={selectedCatId === item.id}
        isUnlocked={unlocked}
        onSelect={handleSelectCat}
        onShowBackstory={handleToggleBackstory}
      />
    );
  }, [level, selectedCatId, handleSelectCat, handleToggleBackstory]);

  const catKeyExtractor = useCallback((item: CatCharacter) => item.id, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Gradient Header with cat avatar */}
        <LinearGradient
          colors={['#1A1A2E', '#1A1A1A', '#0D0D0D']}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => navigation.navigate('CatSwitch')}
            activeOpacity={0.7}
          >
            <CatAvatar catId={selectedCatId} size="large" showTooltipOnTap={false} />
            <View style={styles.editBadge}>
              <MaterialCommunityIcons name="pencil" size={12} color="#FFF" />
            </View>
          </TouchableOpacity>

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

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <MaterialCommunityIcons name={stat.icon} size={32} color="#DC143C" />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Weekly Practice Chart */}
        <View style={styles.section}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <Text style={styles.chartTotal}>{totalWeekMinutes} min total</Text>
          </View>
          <View style={styles.chartContainer}>
            {weeklyPractice.map((day, index) => {
              const barHeight = day.minutes > 0
                ? Math.max(8, (day.minutes / maxDayMinutes) * 80)
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
                          backgroundColor: day.minutes > 0
                            ? (isToday ? '#DC143C' : '#DC143C99')
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

          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('MidiSetup')}>
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="piano" size={24} color="#B0B0B0" />
              <Text style={styles.settingLabel}>MIDI Setup</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Account')}>
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

        {/* Achievements */}
        <AchievementsSection />
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

      {/* Cat Character Picker Modal */}
      <Modal visible={showCatPicker} transparent animationType="slide">
        <View style={catPickerStyles.overlay}>
          <View style={catPickerStyles.container}>
            {/* Header */}
            <View style={catPickerStyles.header}>
              <Text style={catPickerStyles.title}>Choose Your Cat</Text>
              <TouchableOpacity onPress={() => setShowCatPicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <Text style={catPickerStyles.subtitle}>
              Tap to select, long-press for backstory
            </Text>

            {/* Cat grid */}
            <FlatList
              data={CAT_CHARACTERS}
              renderItem={renderCatItem}
              keyExtractor={catKeyExtractor}
              numColumns={2}
              columnWrapperStyle={catPickerStyles.row}
              contentContainerStyle={catPickerStyles.listContent}
              showsVerticalScrollIndicator={false}
            />

            {/* Expanded backstory panel */}
            {expandedCatId && (() => {
              const expandedCat = getCatById(expandedCatId);
              if (!expandedCat) return null;
              return (
                <View style={[catPickerStyles.backstoryPanel, { borderColor: expandedCat.color + '66' }]}>
                  <View style={catPickerStyles.backstoryHeader}>
                    <Text style={catPickerStyles.backstoryEmoji}>{expandedCat.emoji}</Text>
                    <View style={catPickerStyles.backstoryInfo}>
                      <Text style={catPickerStyles.backstoryName}>{expandedCat.name}</Text>
                      <Text style={[catPickerStyles.backstorySkill, { color: expandedCat.color }]}>
                        {expandedCat.musicSkill}
                      </Text>
                    </View>
                  </View>
                  <Text style={catPickerStyles.backstoryText}>{expandedCat.backstory}</Text>
                  <TouchableOpacity
                    style={catPickerStyles.backstoryClose}
                    onPress={() => setExpandedCatId(null)}
                  >
                    <Text style={catPickerStyles.backstoryCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Done button */}
            <TouchableOpacity
              style={catPickerStyles.doneButton}
              onPress={() => setShowCatPicker(false)}
            >
              <Text style={catPickerStyles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const catPickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0D0D0D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    position: 'relative',
    minHeight: 150,
  },
  cardLocked: {
    opacity: 0.5,
  },
  lockOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    alignItems: 'center',
    zIndex: 2,
  },
  lockLevel: {
    fontSize: 10,
    color: '#888',
    fontWeight: '600',
    marginTop: 2,
  },
  emojiContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emojiText: {
    fontSize: 28,
  },
  catName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  catSkill: {
    fontSize: 11,
    color: '#B0B0B0',
    textAlign: 'center',
    marginBottom: 6,
  },
  personalityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  personalityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  selectedCheck: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  backstoryPanel: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  backstoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  backstoryEmoji: {
    fontSize: 36,
  },
  backstoryInfo: {
    flex: 1,
  },
  backstoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  backstorySkill: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  backstoryText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  backstoryClose: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  backstoryCloseText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingBottom: 28,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DC143C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#B0B0B0',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#B0B0B0',
    marginTop: 4,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1A1A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  settingValue: {
    fontSize: 16,
    color: '#B0B0B0',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  pickerChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#252525',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  pickerChipActive: {
    backgroundColor: '#DC143C',
    borderColor: '#DC143C',
  },
  pickerChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B0B0',
  },
  pickerChipTextActive: {
    color: '#FFFFFF',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  chartTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC143C',
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    height: 140,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartMinutes: {
    fontSize: 10,
    color: '#B0B0B0',
    marginBottom: 4,
    fontWeight: '600',
  },
  chartBarTrack: {
    width: 20,
    height: 80,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartBar: {
    width: 16,
    borderRadius: 4,
    minHeight: 4,
  },
  chartDay: {
    fontSize: 11,
    color: '#666666',
    marginTop: 6,
    fontWeight: '500',
  },
  chartDayActive: {
    color: '#DC143C',
    fontWeight: '700',
  },
  achievementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  achievementCounter: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC143C',
    marginBottom: 16,
  },
  achievementCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 8,
  },
  achievementCardLocked: {
    opacity: 0.5,
  },
  achievementIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementIconUnlocked: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  achievementIconLocked: {
    backgroundColor: '#252525',
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  achievementTitleLocked: {
    color: '#888888',
  },
  achievementDescription: {
    fontSize: 13,
    color: '#B0B0B0',
  },
  achievementDescriptionLocked: {
    color: '#555555',
  },
  achievementXpBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  achievementXpText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD700',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: '#252525',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
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
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#DC143C',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
