/**
 * LearnScreen - Browse and select lessons
 */

import React from 'react';
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
import { useProgressStore } from '../stores/progressStore';
import { getLessons } from '../content/ContentLoader';
import type { LessonManifest } from '../content/ContentLoader';
import type { RootStackParamList } from '../navigation/AppNavigator';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

// Map lesson difficulty to icons
const LESSON_ICONS: Record<number, IconName> = {
  1: 'book-open-variant',
  2: 'music-note',
  3: 'hands-pray',
  4: 'lightning-bolt',
  5: 'star',
};

type LearnNavProp = NativeStackNavigationProp<RootStackParamList>;

export function LearnScreen() {
  const navigation = useNavigation<LearnNavProp>();
  const { lessonProgress } = useProgressStore();

  // Load lessons from content JSON files
  const lessons: LessonManifest[] = getLessons();

  const getDifficultyColor = (difficulty: number) => {
    const colors = ['#4CAF50', '#8BC34A', '#FFC107', '#FF9800', '#F44336'];
    return colors[difficulty - 1];
  };

  const getDifficultyLabel = (difficulty: number) => {
    const labels = ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
    return labels[difficulty - 1];
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Learn Piano</Text>
          <Text style={styles.subtitle}>
            Choose a lesson to start learning
          </Text>
        </View>

        {/* Lessons List */}
        <View style={styles.lessonsContainer}>
          {lessons.map((lesson, index) => {
            const progress = lessonProgress[lesson.id];
            const isCompleted = progress?.status === 'completed';
            const prevLessonId = index > 0 ? lessons[index - 1].id : null;
            const isLocked = index > 0 && lessonProgress[prevLessonId!]?.status !== 'completed';
            const difficulty = lesson.metadata.difficulty;
            const icon: IconName = LESSON_ICONS[difficulty] ?? 'book-open-variant';
            const firstExerciseId = lesson.exercises[0]?.id;

            return (
              <TouchableOpacity
                key={lesson.id}
                style={[
                  styles.lessonCard,
                  isLocked && styles.lessonCardLocked,
                ]}
                disabled={isLocked}
                onPress={() => {
                  if (firstExerciseId) {
                    navigation.navigate('Exercise', { exerciseId: firstExerciseId });
                  }
                }}
              >
                {/* Icon */}
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: getDifficultyColor(difficulty) + '20' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={icon}
                    size={32}
                    color={getDifficultyColor(difficulty)}
                  />
                </View>

                {/* Content */}
                <View style={styles.lessonContent}>
                  <View style={styles.lessonHeader}>
                    <Text style={styles.lessonTitle}>{lesson.metadata.title}</Text>
                    {isCompleted && (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={24}
                        color="#4CAF50"
                      />
                    )}
                    {isLocked && (
                      <MaterialCommunityIcons
                        name="lock"
                        size={24}
                        color="#999"
                      />
                    )}
                  </View>

                  <Text style={styles.lessonDescription}>
                    {lesson.metadata.description}
                  </Text>

                  <View style={styles.lessonMeta}>
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons
                        name="format-list-numbered"
                        size={16}
                        color="#666"
                      />
                      <Text style={styles.metaText}>
                        {lesson.exercises.length} exercises
                      </Text>
                    </View>

                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={16}
                        color="#666"
                      />
                      <Text style={styles.metaText}>
                        {lesson.estimatedMinutes} min
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.difficultyBadge,
                        { backgroundColor: getDifficultyColor(difficulty) },
                      ]}
                    >
                      <Text style={styles.difficultyText}>
                        {getDifficultyLabel(difficulty)}
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  {progress && !isCompleted && (
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${progress.bestScore || 0}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {progress.bestScore || 0}%
                      </Text>
                    </View>
                  )}
                </View>

                {/* Chevron */}
                {!isLocked && (
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color="#999"
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  lessonsContainer: {
    padding: 16,
    gap: 16,
  },
  lessonCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lessonCardLocked: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonContent: {
    flex: 1,
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  lessonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  lessonDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#666',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1976D2',
  },
  progressText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1976D2',
    width: 40,
    textAlign: 'right',
  },
});
