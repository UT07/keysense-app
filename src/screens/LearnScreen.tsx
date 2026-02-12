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
import type { RootStackParamList } from '../navigation/AppNavigator';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Lesson {
  id: string;
  title: string;
  description: string;
  exerciseCount: number;
  estimatedMinutes: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  icon: IconName;
}

// Mock lessons data - would come from content/lessons in production
const LESSONS: Lesson[] = [
  {
    id: 'lesson-01',
    title: 'Getting Started',
    description: 'Learn the basics of the keyboard and find Middle C',
    exerciseCount: 5,
    estimatedMinutes: 10,
    difficulty: 1,
    icon: 'book-open-variant',
  },
  {
    id: 'lesson-02',
    title: 'Right Hand Melodies',
    description: 'Play simple melodies using C-D-E-F-G',
    exerciseCount: 8,
    estimatedMinutes: 15,
    difficulty: 1,
    icon: 'hand-pointing-right',
  },
  {
    id: 'lesson-03',
    title: 'Left Hand Bass Notes',
    description: 'Master the left hand with bass patterns',
    exerciseCount: 6,
    estimatedMinutes: 12,
    difficulty: 2,
    icon: 'hand-pointing-left',
  },
  {
    id: 'lesson-04',
    title: 'Hands Together',
    description: 'Coordinate both hands playing at once',
    exerciseCount: 10,
    estimatedMinutes: 20,
    difficulty: 3,
    icon: 'hands-pray',
  },
];

type LearnNavProp = NativeStackNavigationProp<RootStackParamList>;

export function LearnScreen() {
  const navigation = useNavigation<LearnNavProp>();
  const { lessonProgress } = useProgressStore();

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
          {LESSONS.map((lesson, index) => {
            const progress = lessonProgress[lesson.id];
            const isCompleted = progress?.status === 'completed';
            const isLocked = index > 0 && lessonProgress[LESSONS[index - 1].id]?.status !== 'completed';

            return (
              <TouchableOpacity
                key={lesson.id}
                style={[
                  styles.lessonCard,
                  isLocked && styles.lessonCardLocked,
                ]}
                disabled={isLocked}
                onPress={() => {
                  navigation.navigate('Exercise', { exerciseId: `${lesson.id}-ex-01` });
                }}
              >
                {/* Icon */}
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: getDifficultyColor(lesson.difficulty) + '20' },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={lesson.icon}
                    size={32}
                    color={getDifficultyColor(lesson.difficulty)}
                  />
                </View>

                {/* Content */}
                <View style={styles.lessonContent}>
                  <View style={styles.lessonHeader}>
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
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
                    {lesson.description}
                  </Text>

                  <View style={styles.lessonMeta}>
                    <View style={styles.metaItem}>
                      <MaterialCommunityIcons
                        name="format-list-numbered"
                        size={16}
                        color="#666"
                      />
                      <Text style={styles.metaText}>
                        {lesson.exerciseCount} exercises
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
                        { backgroundColor: getDifficultyColor(lesson.difficulty) },
                      ]}
                    >
                      <Text style={styles.difficultyText}>
                        {getDifficultyLabel(lesson.difficulty)}
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
