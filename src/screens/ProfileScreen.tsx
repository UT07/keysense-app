/**
 * ProfileScreen - User profile, stats, and settings
 * Editable display name and avatar emoji
 */

import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
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

const AVATAR_EMOJIS = [
  '\uD83C\uDFB9', '\uD83C\uDFB5', '\uD83C\uDFB6', '\uD83C\uDFBC',
  '\uD83E\uDDD1\u200D\uD83C\uDFA8', '\uD83D\uDE0E', '\uD83E\uDD29', '\uD83D\uDE0A',
  '\uD83C\uDF1F', '\uD83D\uDD25', '\uD83D\uDCAA', '\uD83C\uDFC6',
  '\uD83E\uDD8B', '\uD83C\uDF3A', '\uD83C\uDF08', '\u2B50',
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

export function ProfileScreen() {
  const navigation = useNavigation<ProfileNavProp>();
  const { totalXp, level, streakData, lessonProgress } = useProgressStore();
  const {
    dailyGoalMinutes, masterVolume, displayName, avatarEmoji,
    setDailyGoalMinutes, setMasterVolume, setDisplayName, setAvatarEmoji,
  } = useSettingsStore();
  const weeklyPractice = useWeeklyPractice();
  const totalWeekMinutes = weeklyPractice.reduce((sum, d) => sum + d.minutes, 0);
  const maxDayMinutes = Math.max(...weeklyPractice.map(d => d.minutes), 1);

  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showVolumePicker, setShowVolumePicker] = useState(false);
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editingName, setEditingName] = useState(displayName);

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

  const handleSaveName = () => {
    const trimmed = editingName.trim();
    if (trimmed.length > 0) {
      setDisplayName(trimmed);
    }
    setShowNameEditor(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Gradient Header with editable profile */}
        <LinearGradient
          colors={['#1A1A2E', '#1A1A1A', '#0D0D0D']}
          style={styles.header}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => setShowAvatarPicker(true)}
            activeOpacity={0.7}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{avatarEmoji}</Text>
            </View>
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
          <Text style={styles.subtitle}>Level {level} Pianist</Text>
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
            onPress={() => Alert.alert('About KeySense', 'KeySense v1.0.0\nAI-Powered Piano Learning\n\nLearn piano with real-time feedback, MIDI support, and AI coaching.')}
          >
            <View style={styles.settingLeft}>
              <MaterialCommunityIcons name="information" size={24} color="#B0B0B0" />
              <Text style={styles.settingLabel}>About</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Achievements Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Achievements</Text>
          <View style={styles.achievementCard}>
            <MaterialCommunityIcons name="medal" size={48} color="#FFD700" />
            <View style={styles.achievementContent}>
              <Text style={styles.achievementTitle}>First Steps</Text>
              <Text style={styles.achievementDescription}>
                Completed your first lesson
              </Text>
            </View>
          </View>
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

      {/* Avatar Emoji Picker Modal */}
      <Modal visible={showAvatarPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Avatar</Text>
            <View style={styles.emojiGrid}>
              {AVATAR_EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.emojiCell, avatarEmoji === emoji && styles.emojiCellActive]}
                  onPress={() => { setAvatarEmoji(emoji); setShowAvatarPicker(false); }}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAvatarPicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(220, 20, 60, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(220, 20, 60, 0.4)',
  },
  avatarText: {
    fontSize: 44,
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
  achievementCard: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    color: '#B0B0B0',
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
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    justifyContent: 'center',
  },
  emojiCell: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#252525',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiCellActive: {
    backgroundColor: 'rgba(220, 20, 60, 0.2)',
    borderWidth: 2,
    borderColor: '#DC143C',
  },
  emojiText: {
    fontSize: 28,
  },
});
