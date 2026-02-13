/**
 * HomeScreen Component
 * Main home screen with daily practice goal, XP/streak display, and quick actions
 */

import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { XPBar } from '../components/Progress/XPBar';
import { StreakDisplay } from '../components/Progress/StreakDisplay';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getLessons, getLessonExercises } from '../content/ContentLoader';
import type { RootStackParamList } from '../navigation/AppNavigator';

type HomeNavProp = NativeStackNavigationProp<RootStackParamList>;

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

interface HomeScreenState {
  currentXP: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  lastPracticeDate?: string;
  dailyGoalMinutes: number;
  minutesPracticedToday: number;
  nextExerciseTitle?: string;
  exerciseProgress?: number; // 0-100, percentage of lesson complete
}

/**
 * HomeScreen - Main dashboard with progress and quick actions
 * Shows daily goal, streak, XP, and navigation to learning content
 */
export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToExercise,
  onNavigateToLesson,
  onNavigateToSongs,
  onNavigateToSettings,
}) => {
  const navigation = useNavigation<HomeNavProp>();

  // Connect to Zustand stores for real data
  const { totalXp, level, streakData, dailyGoalData, lessonProgress } = useProgressStore();
  const { dailyGoalMinutes } = useSettingsStore();

  // Get today's practice data from dailyGoalData
  const today = new Date().toISOString().split('T')[0];
  const todayGoal = dailyGoalData[today];
  const minutesPracticedToday = todayGoal?.minutesPracticed ?? 0;
  const dailyGoalProgress = dailyGoalMinutes > 0 ? minutesPracticedToday / dailyGoalMinutes : 0;

  // Calculate current lesson and exercise progress from real data
  const { nextExerciseTitle, nextExerciseId, currentLessonLabel, exerciseProgress } = useMemo(() => {
    const lessons = getLessons();
    for (const lesson of lessons) {
      const exercises = getLessonExercises(lesson.id);
      if (exercises.length === 0) continue;

      // Count completed exercises in this lesson
      const lp = lessonProgress[lesson.id];
      const completedCount = lp
        ? Object.values(lp.exerciseScores).filter((s) => s.completedAt != null).length
        : 0;
      const progress = Math.round((completedCount / exercises.length) * 100);

      if (completedCount < exercises.length) {
        // This lesson is in progress — find the next uncompleted exercise
        const nextEx = exercises.find((ex) => {
          const score = lp?.exerciseScores[ex.id];
          return !score || score.completedAt == null;
        });
        return {
          nextExerciseTitle: nextEx?.metadata.title ?? exercises[0].metadata.title,
          nextExerciseId: nextEx?.id ?? exercises[0].id,
          currentLessonLabel: lesson.metadata.title,
          exerciseProgress: progress,
        };
      }
    }
    // All lessons complete — show last lesson
    const lastLesson = lessons[lessons.length - 1];
    return {
      nextExerciseTitle: 'All Complete!',
      nextExerciseId: null as string | null,
      currentLessonLabel: lastLesson?.metadata.title ?? 'Lessons',
      exerciseProgress: 100,
    };
  }, [lessonProgress]);

  // Use real store data with safe defaults
  const state: HomeScreenState = {
    currentXP: totalXp ?? 0,
    currentLevel: level ?? 1,
    currentStreak: streakData?.currentStreak ?? 0,
    longestStreak: streakData?.longestStreak ?? 0,
    freezesAvailable: streakData?.freezesAvailable ?? 0,
    lastPracticeDate: streakData?.lastPracticeDate,
    dailyGoalMinutes: dailyGoalMinutes ?? 10,
    minutesPracticedToday,
    nextExerciseTitle,
    exerciseProgress,
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={onNavigateToSettings ?? (() => navigation.navigate('MidiSetup'))}
          >
            <MaterialCommunityIcons name="cog" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* XP Bar */}
        <XPBar
          currentXP={state.currentXP}
          currentLevel={state.currentLevel}
          animatedXPGain={0}
        />

        {/* Streak Display */}
        <StreakDisplay
          currentStreak={state.currentStreak}
          longestStreak={state.longestStreak}
          freezesAvailable={state.freezesAvailable}
          lastPracticeDate={state.lastPracticeDate}
        />

        {/* Daily Goal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Practice</Text>
          <View style={styles.dailyGoalCard}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalLabel}>Practice Goal</Text>
              <Text style={styles.goalTime}>
                {state.minutesPracticedToday} / {state.dailyGoalMinutes} min
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  { width: `${Math.min(100, dailyGoalProgress * 100)}%` },
                ]}
              />
            </View>
            {dailyGoalProgress >= 1 && (
              <View style={styles.goalCompleteContainer}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color="#4CAF50"
                />
                <Text style={styles.goalCompleteText}>Daily goal complete!</Text>
              </View>
            )}
          </View>
        </View>

        {/* Continue Learning */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Continue Learning</Text>
          <TouchableOpacity
            style={styles.continueCard}
            onPress={onNavigateToExercise ?? (() => {
              if (nextExerciseId) {
                navigation.navigate('Exercise', { exerciseId: nextExerciseId });
              } else {
                navigation.navigate('MainTabs', { screen: 'Learn' } as any);
              }
            })}
            activeOpacity={0.7}
          >
            <View style={styles.continueHeader}>
              <MaterialCommunityIcons
                name="play-circle-outline"
                size={24}
                color="#2196F3"
              />
              <View style={styles.continueInfo}>
                <Text style={styles.continueLabel}>{currentLessonLabel}</Text>
                <Text style={styles.continueTitle}>
                  {state.nextExerciseTitle}
                </Text>
              </View>
            </View>
            <View style={styles.continueProgress}>
              <View style={styles.continueProgressBar}>
                <Animated.View
                  style={[
                    styles.continueProgressFill,
                    {
                      width: `${state.exerciseProgress ?? 0}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.continueProgressText}>
                {state.exerciseProgress}% complete
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={onNavigateToLesson ?? (() => navigation.navigate('MainTabs', { screen: 'Learn' } as any))}
            >
              <MaterialCommunityIcons
                name="book-open-outline"
                size={28}
                color="#2196F3"
              />
              <Text style={styles.actionLabel}>Learn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={onNavigateToExercise ?? (() => {
                if (nextExerciseId) {
                  navigation.navigate('Exercise', { exerciseId: nextExerciseId });
                } else {
                  navigation.navigate('MainTabs', { screen: 'Learn' } as any);
                }
              })}
            >
              <MaterialCommunityIcons
                name="music-box-multiple"
                size={28}
                color="#FF9800"
              />
              <Text style={styles.actionLabel}>Practice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={onNavigateToSongs ?? (() => navigation.navigate('MainTabs', { screen: 'Play' } as any))}
            >
              <MaterialCommunityIcons
                name="music"
                size={28}
                color="#4CAF50"
              />
              <Text style={styles.actionLabel}>Songs</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={onNavigateToSettings ?? (() => navigation.navigate('MidiSetup'))}
            >
              <MaterialCommunityIcons
                name="tune"
                size={28}
                color="#9C27B0"
              />
              <Text style={styles.actionLabel}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Motivational tip */}
        <View style={styles.section}>
          <View style={styles.tipContainer}>
            <MaterialCommunityIcons
              name="lightbulb-on-outline"
              size={20}
              color="#FF9800"
            />
            <Text style={styles.tipText}>
              Tip: Practice for just 10 minutes a day to see real progress in 2 weeks!
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

HomeScreen.displayName = 'HomeScreen';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1976D2',
    shadowColor: '#1976D2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  settingsButton: {
    padding: 8,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  dailyGoalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  goalTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#EEEEEE',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  goalCompleteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#E8F5E9',
    borderRadius: 4,
  },
  goalCompleteText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
    color: '#2E7D32',
  },
  continueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBDEFB',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  continueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  continueInfo: {
    marginLeft: 12,
    flex: 1,
  },
  continueLabel: {
    fontSize: 12,
    color: '#999999',
    fontWeight: '500',
  },
  continueTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginTop: 2,
  },
  continueProgress: {
    alignItems: 'flex-start',
  },
  continueProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#EEEEEE',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  continueProgressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 3,
  },
  continueProgressText: {
    fontSize: 11,
    color: '#999999',
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginTop: 8,
  },
  tipContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
    alignItems: 'center',
  },
  tipText: {
    marginLeft: 12,
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#F57F17',
  },
});
