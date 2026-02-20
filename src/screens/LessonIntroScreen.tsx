/**
 * LessonIntroScreen - Full-screen lesson overview before starting exercises
 * Shows lesson objectives, skills, exercise list, Keysie mascot, and Start button
 * Displayed when a user taps a lesson node on the LevelMapScreen
 */

import { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { CatAvatar } from '../components/Mascot/CatAvatar';
import { MascotBubble } from '../components/Mascot/MascotBubble';
import { FunFactCard } from '../components/FunFact/FunFactCard';
import { getFactForLesson } from '../content/funFactSelector';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getLesson } from '../content/ContentLoader';
import { getLessonTutorial } from '../content/lessonTutorials';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type LessonIntroRouteProp = RouteProp<RootStackParamList, 'LessonIntro'>;

// Skill chip colors - semi-transparent crimson variants
const SKILL_COLORS = [
  { bg: 'rgba(220, 20, 60, 0.15)', text: '#FF6B8A' },
  { bg: 'rgba(106, 27, 154, 0.15)', text: '#CE93D8' },
  { bg: 'rgba(21, 101, 192, 0.15)', text: '#64B5F6' },
  { bg: 'rgba(46, 125, 50, 0.15)', text: '#81C784' },
  { bg: 'rgba(249, 168, 37, 0.15)', text: '#FFD54F' },
];

// Encouraging messages for the mascot based on lesson difficulty
const MASCOT_MESSAGES: Record<number, string[]> = {
  1: [
    "Let's learn something new! This one's going to be fun.",
    "Ready to explore the keyboard? I'll guide you through it!",
    "Every great pianist started right here. Let's go!",
  ],
  2: [
    "You're ready for this! Let's build on what you know.",
    "Time to level up your skills! I'm excited for you.",
  ],
  3: [
    "This is where it gets interesting! You've got this.",
    "Challenge accepted! Let's make some beautiful music.",
  ],
  4: [
    "Big challenge ahead, but I believe in you!",
    "You've come so far. Let's push your skills further!",
  ],
  5: [
    "Expert territory! Show me what you've learned.",
    "The ultimate challenge awaits. Let's do this!",
  ],
};

function getMascotMessage(difficulty: number): string {
  const messages = MASCOT_MESSAGES[difficulty] ?? MASCOT_MESSAGES[1];
  return messages[Math.floor(Math.random() * messages.length)];
}

/**
 * Difficulty indicator using filled/empty bars
 */
function DifficultyBars({ difficulty }: { difficulty: number }): React.ReactElement {
  return (
    <View style={styles.difficultyContainer}>
      <Text style={styles.difficultyLabel}>Difficulty</Text>
      <View style={styles.difficultyBars}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.difficultyBar,
              i < difficulty
                ? styles.difficultyBarFilled
                : styles.difficultyBarEmpty,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Skill badge chip
 */
function SkillChip({ skill, index }: { skill: string; index: number }): React.ReactElement {
  const color = SKILL_COLORS[index % SKILL_COLORS.length];
  const label = skill
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View style={[styles.skillChip, { backgroundColor: color.bg }]}>
      <Text style={[styles.skillChipText, { color: color.text }]}>{label}</Text>
    </View>
  );
}

/**
 * Exercise list item with completion status
 */
function ExerciseListItem({
  index,
  title,
  isCompleted,
  isRequired,
}: {
  index: number;
  title: string;
  isCompleted: boolean;
  isRequired: boolean;
}): React.ReactElement {
  return (
    <View style={styles.exerciseItem}>
      <View style={styles.exerciseItemLeft}>
        <View
          style={[
            styles.exerciseNumber,
            isCompleted && styles.exerciseNumberCompleted,
          ]}
        >
          {isCompleted ? (
            <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
          ) : (
            <Text style={styles.exerciseNumberText}>{index + 1}</Text>
          )}
        </View>
        <Text
          style={[
            styles.exerciseTitle,
            isCompleted && styles.exerciseTitleCompleted,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <View style={styles.exerciseItemRight}>
        {!isRequired && (
          <View style={styles.bonusBadge}>
            <Text style={styles.bonusBadgeText}>BONUS</Text>
          </View>
        )}
        {isCompleted ? (
          <MaterialCommunityIcons
            name="check-circle"
            size={20}
            color="#4CAF50"
          />
        ) : (
          <MaterialCommunityIcons
            name="circle-outline"
            size={20}
            color="#555555"
          />
        )}
      </View>
    </View>
  );
}

/**
 * Tutorial section — step-by-step guide for the lesson
 */
function TutorialSection({
  lessonId,
  onDismiss,
}: {
  lessonId: string;
  onDismiss: () => void;
}): React.ReactElement | null {
  const tutorial = useMemo(() => getLessonTutorial(lessonId), [lessonId]);
  if (!tutorial) return null;

  return (
    <View style={styles.tutorialSection}>
      <View style={styles.tutorialHeader}>
        <MaterialCommunityIcons name="school" size={18} color="#FFD700" />
        <Text style={styles.tutorialTitle}>{tutorial.title}</Text>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="close" size={18} color="#666" />
        </TouchableOpacity>
      </View>
      {tutorial.steps.map((step, index) => (
        <View key={index} style={styles.tutorialStep}>
          <View style={styles.tutorialStepIcon}>
            <MaterialCommunityIcons
              name={step.icon as any}
              size={18}
              color="#DC143C"
            />
          </View>
          <Text style={styles.tutorialStepText}>{step.text}</Text>
        </View>
      ))}
      <View style={styles.tutorialTip}>
        <MaterialCommunityIcons name="lightbulb-on-outline" size={14} color="#FFD700" />
        <Text style={styles.tutorialTipText}>{tutorial.tip}</Text>
      </View>
    </View>
  );
}

/**
 * LessonIntroScreen - Main component
 */
export function LessonIntroScreen(): React.ReactElement {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<LessonIntroRouteProp>();
  const { lessonId } = route.params;

  const lessonProgress = useProgressStore((s) => s.lessonProgress);
  const showTutorials = useSettingsStore((s) => s.showTutorials);
  const setShowTutorials = useSettingsStore((s) => s.setShowTutorials);
  const selectedCatId = useSettingsStore((s) => s.selectedCatId);
  const [tutorialDismissed, setTutorialDismissed] = useState(false);

  const lesson = useMemo(() => getLesson(lessonId), [lessonId]);

  const progress = lessonProgress[lessonId];
  const exerciseScores = progress?.exerciseScores ?? {};

  // Calculate completed count
  const completedCount = useMemo(
    () =>
      Object.values(exerciseScores).filter((s) => s.completedAt != null).length,
    [exerciseScores]
  );

  // Find the lesson number from the ID (e.g., "lesson-03" -> 3)
  const lessonNumber = useMemo(() => {
    const match = lessonId.match(/lesson-(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }, [lessonId]);

  // Find first uncompleted exercise
  const firstUncompletedExerciseId = useMemo(() => {
    if (!lesson) return null;
    const sortedExercises = [...lesson.exercises].sort(
      (a, b) => a.order - b.order
    );
    for (const ex of sortedExercises) {
      const score = exerciseScores[ex.id];
      if (!score || score.completedAt == null) {
        return ex.id;
      }
    }
    // All completed - return first exercise for replay
    return sortedExercises[0]?.id ?? null;
  }, [lesson, exerciseScores]);

  const mascotMessage = useMemo(
    () => getMascotMessage(lesson?.metadata.difficulty ?? 1),
    [lesson]
  );

  const lessonFunFact = useMemo(
    () => getFactForLesson(lessonNumber),
    [lessonNumber]
  );

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleStartLesson = useCallback(() => {
    if (firstUncompletedExerciseId) {
      navigation.navigate('Exercise', {
        exerciseId: firstUncompletedExerciseId,
      });
    }
  }, [navigation, firstUncompletedExerciseId]);

  if (!lesson) {
    return (
      <SafeAreaView style={styles.container} testID="lesson-intro-screen">
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Lesson not found</Text>
          <TouchableOpacity onPress={handleBack} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isAllCompleted = completedCount === lesson.exercises.length;

  return (
    <View style={styles.container} testID="lesson-intro-screen">
      {/* Header gradient */}
      <LinearGradient
        colors={['#1A1A2E', '#1A1A1A', '#0D0D0D']}
        style={styles.header}
      >
        <SafeAreaView>
          <View style={styles.headerContent}>
            {/* Back button */}
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              testID="lesson-intro-back"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* Lesson number and title */}
            <View style={styles.headerTitleArea}>
              <Text style={styles.lessonNumber}>
                LESSON {lessonNumber}
              </Text>
              <Text style={styles.lessonTitle} numberOfLines={2}>
                {lesson.metadata.title}
              </Text>
            </View>

            {/* XP badge */}
            <View style={styles.xpBadge}>
              <MaterialCommunityIcons
                name="star-four-points"
                size={16}
                color="#FFD700"
              />
              <Text style={styles.xpBadgeText}>{lesson.xpReward} XP</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <Text style={styles.description}>{lesson.metadata.description}</Text>

        {/* Info row: difficulty + estimated time */}
        <View style={styles.infoRow}>
          <DifficultyBars difficulty={lesson.metadata.difficulty} />
          <View style={styles.timeContainer}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color="#B0B0B0"
            />
            <Text style={styles.timeText}>
              ~{lesson.metadata.estimatedMinutes ?? lesson.estimatedMinutes} min
            </Text>
          </View>
          <View style={styles.progressContainer}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={16}
              color={isAllCompleted ? '#4CAF50' : '#B0B0B0'}
            />
            <Text
              style={[
                styles.progressText,
                isAllCompleted && styles.progressTextComplete,
              ]}
            >
              {completedCount}/{lesson.exercises.length}
            </Text>
          </View>
        </View>

        {/* Skills */}
        {lesson.metadata.skills.length > 0 && (
          <View style={styles.skillsSection}>
            <Text style={styles.sectionTitle}>Skills You'll Learn</Text>
            <View style={styles.skillChips}>
              {lesson.metadata.skills.map((skill, index) => (
                <SkillChip key={skill} skill={skill} index={index} />
              ))}
            </View>
          </View>
        )}

        {/* Keysie mascot */}
        <View style={styles.mascotSection}>
          <CatAvatar catId={selectedCatId ?? 'mini-meowww'} size="large" showGlow />
          <View style={styles.mascotBubbleWrapper}>
            <MascotBubble
              mood="teaching"
              message={mascotMessage}
              size="medium"
            />
          </View>
        </View>

        {/* Did You Know? fun fact */}
        <View style={styles.funFactSection}>
          <FunFactCard
            fact={lessonFunFact}
            animationDelay={300}
            testID="lesson-intro-fun-fact"
          />
        </View>

        {/* Tutorial section (if enabled and not dismissed for this session) */}
        {showTutorials && !tutorialDismissed && (
          <TutorialSection
            lessonId={lessonId}
            onDismiss={() => setTutorialDismissed(true)}
          />
        )}

        {/* Tutorial toggle */}
        <TouchableOpacity
          style={styles.tutorialToggle}
          onPress={() => setShowTutorials(!showTutorials)}
        >
          <MaterialCommunityIcons
            name={showTutorials ? 'eye' : 'eye-off'}
            size={16}
            color="#888"
          />
          <Text style={styles.tutorialToggleText}>
            {showTutorials ? 'Hide tutorials' : 'Show tutorials'}
          </Text>
        </TouchableOpacity>

        {/* Exercise list */}
        <View style={styles.exerciseSection}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          <View style={styles.exerciseList}>
            {lesson.exercises
              .sort((a, b) => a.order - b.order)
              .map((ex, index) => {
                const score = exerciseScores[ex.id];
                const isCompleted = score?.completedAt != null;
                return (
                  <ExerciseListItem
                    key={ex.id}
                    index={index}
                    title={ex.title}
                    isCompleted={isCompleted}
                    isRequired={ex.required}
                  />
                );
              })}
          </View>
        </View>

        {/* Bottom spacer for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Start Lesson button (fixed at bottom) */}
      <SafeAreaView style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleStartLesson}
          style={styles.startButton}
          activeOpacity={0.8}
          testID="lesson-intro-start"
        >
          <LinearGradient
            colors={['#DC143C', '#A3102E']}
            style={styles.startButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialCommunityIcons
              name={isAllCompleted ? 'replay' : 'play'}
              size={22}
              color="#FFFFFF"
            />
            <Text style={styles.startButtonText}>
              {isAllCompleted ? 'Replay Lesson' : 'Start Lesson'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  // Header
  header: {
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  headerTitleArea: {
    flex: 1,
  },
  lessonNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC143C',
    letterSpacing: 2,
    marginBottom: 4,
  },
  lessonTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 32,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    marginLeft: 8,
    marginTop: 4,
  },
  xpBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFD700',
  },
  // Scroll content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  description: {
    fontSize: 15,
    color: '#B0B0B0',
    lineHeight: 22,
    marginBottom: 16,
  },
  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
  },
  difficultyContainer: {
    alignItems: 'center',
    gap: 4,
  },
  difficultyLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  difficultyBars: {
    flexDirection: 'row',
    gap: 3,
  },
  difficultyBar: {
    width: 14,
    height: 6,
    borderRadius: 3,
  },
  difficultyBarFilled: {
    backgroundColor: '#DC143C',
  },
  difficultyBarEmpty: {
    backgroundColor: '#333333',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 13,
    color: '#B0B0B0',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B0B0B0',
  },
  progressTextComplete: {
    color: '#4CAF50',
  },
  // Skills
  skillsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  skillChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Mascot
  mascotSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    gap: 8,
  },
  mascotBubbleWrapper: {
    flex: 1,
  },
  // Fun fact
  funFactSection: {
    marginBottom: 20,
  },
  // Tutorial
  tutorialSection: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
  },
  tutorialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tutorialTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFD700',
    flex: 1,
  },
  tutorialStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  tutorialStepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(220, 20, 60, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutorialStepText: {
    fontSize: 13,
    color: '#E0E0E0',
    lineHeight: 20,
    flex: 1,
  },
  tutorialTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#252525',
  },
  tutorialTipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFD700',
    fontStyle: 'italic',
    flex: 1,
  },
  tutorialToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 20,
    paddingVertical: 4,
  },
  tutorialToggleText: {
    fontSize: 12,
    color: '#888',
  },
  // Exercise list
  exerciseSection: {
    marginBottom: 16,
  },
  exerciseList: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    overflow: 'hidden',
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#252525',
  },
  exerciseItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  exerciseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNumberCompleted: {
    backgroundColor: '#4CAF50',
  },
  exerciseNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B0B0B0',
  },
  exerciseTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E0E0E0',
    flex: 1,
  },
  exerciseTitleCompleted: {
    color: '#888888',
  },
  exerciseItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bonusBadge: {
    backgroundColor: 'rgba(249, 168, 37, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  bonusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F9A825',
    letterSpacing: 0.5,
  },
  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13, 13, 13, 0.95)',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  startButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#DC143C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Error state
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#B0B0B0',
  },
  errorButton: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default LessonIntroScreen;
