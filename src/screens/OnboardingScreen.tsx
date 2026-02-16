/**
 * Onboarding Screen
 * First-time user experience with 4-step flow
 * 1. Welcome
 * 2. Experience Level
 * 3. Equipment Check
 * 4. Goal Setting
 *
 * Features animated progress bar with walking cat avatar,
 * per-step cat characters, and slide transitions.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { Button, Card } from '../components/common';
import { useSettingsStore } from '../stores/settingsStore';
import { COLORS, SPACING, BORDER_RADIUS } from '../theme/tokens';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get('window').width;
const PROGRESS_BAR_HORIZONTAL_PADDING = SPACING.lg;
const PROGRESS_BAR_WIDTH = SCREEN_WIDTH - PROGRESS_BAR_HORIZONTAL_PADDING * 2;
const PROGRESS_BAR_HEIGHT = 6;
const CAT_SIZE = 28;
const SLIDE_DURATION = 300;
const SLIDE_OFFSET = 50;

interface OnboardingState {
  experienceLevel?: 'beginner' | 'intermediate' | 'returning';
  hasMidi?: boolean;
  goal?: 'songs' | 'technique' | 'exploration';
  completedAt?: Date;
}

type SlideDirection = 'forward' | 'back';

// ---------------------------------------------------------------------------
// Per-step cat data
// ---------------------------------------------------------------------------

interface StepCatInfo {
  emoji: string;
  subtitle: string;
}

const STEP_CATS: Record<number, StepCatInfo> = {
  1: { emoji: '\uD83D\uDC31', subtitle: 'Mini Meowww welcomes you!' },
  2: { emoji: '\uD83C\uDFB9', subtitle: 'Jazzy wants to know your level' },
  3: { emoji: '\uD83C\uDFB8', subtitle: 'Rocky checks your setup' },
  4: { emoji: '\u2B50', subtitle: 'Professor Whiskers helps you set goals' },
};

// ---------------------------------------------------------------------------
// Animated Step Wrapper (slide transitions)
// ---------------------------------------------------------------------------

function AnimatedStepWrapper({
  direction,
  children,
}: {
  direction: SlideDirection;
  children: React.ReactNode;
}): React.ReactElement {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(
    direction === 'forward' ? SLIDE_OFFSET : -SLIDE_OFFSET,
  );

  React.useEffect(() => {
    // Reset to entry position when direction changes (new step)
    const entryX = direction === 'forward' ? SLIDE_OFFSET : -SLIDE_OFFSET;
    opacity.value = 0;
    translateX.value = entryX;

    opacity.value = withTiming(1, {
      duration: SLIDE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    translateX.value = withTiming(0, {
      duration: SLIDE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [direction, opacity, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[styles.stepContainer, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Welcome Screen
// ---------------------------------------------------------------------------

function WelcomeStep({
  onNext,
  direction,
}: {
  onNext: () => void;
  direction: SlideDirection;
}): React.ReactElement {
  const catInfo = STEP_CATS[1];

  return (
    <AnimatedStepWrapper direction={direction}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconLarge}>{catInfo.emoji}</Text>
      </View>
      <Text style={styles.stepTitle}>Welcome to Purrrfect Keys</Text>
      <Text style={styles.catIntro}>{catInfo.subtitle}</Text>
      <Text style={styles.stepSubtitle}>
        Learn piano in 5 minutes a day with AI-powered feedback
      </Text>
      <View style={styles.featureList}>
        <FeatureItem icon="\u26A1" text="Real-time feedback on your playing" />
        <FeatureItem icon="\uD83C\uDFAF" text="Personalized learning path" />
        <FeatureItem icon="\uD83D\uDD25" text="Build daily practice habits" />
      </View>
      <Button title="Get Started" onPress={onNext} size="large" style={styles.button} />
    </AnimatedStepWrapper>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Experience Level
// ---------------------------------------------------------------------------

function ExperienceLevelStep({
  onNext,
  value,
  onValueChange,
  direction,
}: {
  onNext: () => void;
  value?: string;
  onValueChange: (level: 'beginner' | 'intermediate' | 'returning') => void;
  direction: SlideDirection;
}): React.ReactElement {
  const catInfo = STEP_CATS[2];

  return (
    <AnimatedStepWrapper direction={direction}>
      <Text style={styles.stepTitle}>What's Your Experience Level?</Text>
      <Text style={styles.catIntro}>{catInfo.subtitle}</Text>
      <Text style={styles.stepDescription}>
        This helps us personalize your learning experience
      </Text>

      <View style={styles.optionsList}>
        <OptionCard
          icon="\uD83C\uDF31"
          title="Complete Beginner"
          description="Never touched a piano before"
          selected={value === 'beginner'}
          onPress={() => onValueChange('beginner')}
        />
        <OptionCard
          icon="\uD83D\uDCDA"
          title="I Know Some Basics"
          description="Can play simple melodies"
          selected={value === 'intermediate'}
          onPress={() => onValueChange('intermediate')}
        />
        <OptionCard
          icon="\uD83C\uDFBC"
          title="Returning Player"
          description="Played before, want to restart"
          selected={value === 'returning'}
          onPress={() => onValueChange('returning')}
        />
      </View>

      <Button
        title="Next"
        onPress={onNext}
        disabled={!value}
        size="large"
        style={styles.button}
      />
    </AnimatedStepWrapper>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Equipment Check
// ---------------------------------------------------------------------------

function EquipmentCheckStep({
  onNext,
  value,
  onValueChange,
  direction,
}: {
  onNext: () => void;
  value?: boolean;
  onValueChange: (hasMidi: boolean) => void;
  direction: SlideDirection;
}): React.ReactElement {
  const catInfo = STEP_CATS[3];

  return (
    <AnimatedStepWrapper direction={direction}>
      <Text style={styles.stepTitle}>Do You Have a MIDI Keyboard?</Text>
      <Text style={styles.catIntro}>{catInfo.subtitle}</Text>
      <Text style={styles.stepDescription}>
        MIDI keyboards provide the best learning experience, but you can also use the on-screen keyboard
      </Text>

      <View style={styles.midiOptions}>
        <OptionCard
          icon="\u2328\uFE0F"
          title="Yes, I Have a MIDI Keyboard"
          description="USB or Bluetooth connected device"
          selected={value === true}
          onPress={() => onValueChange(true)}
        />
        <OptionCard
          icon="\uD83D\uDCF1"
          title="No, I'll Use Screen Keyboard"
          description="Great! You can start learning right away"
          selected={value === false}
          onPress={() => onValueChange(false)}
        />
      </View>

      <Button
        title="Next"
        onPress={onNext}
        disabled={value === undefined}
        size="large"
        style={styles.button}
      />
    </AnimatedStepWrapper>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Goal Setting
// ---------------------------------------------------------------------------

function GoalSettingStep({
  onNext,
  value,
  onValueChange,
  direction,
}: {
  onNext: () => void;
  value?: string;
  onValueChange: (goal: 'songs' | 'technique' | 'exploration') => void;
  direction: SlideDirection;
}): React.ReactElement {
  const catInfo = STEP_CATS[4];

  return (
    <AnimatedStepWrapper direction={direction}>
      <Text style={styles.stepTitle}>What's Your Goal?</Text>
      <Text style={styles.catIntro}>{catInfo.subtitle}</Text>
      <Text style={styles.stepDescription}>
        Choose what motivates you most
      </Text>

      <View style={styles.optionsList}>
        <OptionCard
          icon="\uD83C\uDFB5"
          title="Play My Favorite Songs"
          description="Learn recognizable melodies quickly"
          selected={value === 'songs'}
          onPress={() => onValueChange('songs')}
        />
        <OptionCard
          icon="\uD83C\uDFAF"
          title="Learn Proper Technique"
          description="Build solid fundamentals for long-term growth"
          selected={value === 'technique'}
          onPress={() => onValueChange('technique')}
        />
        <OptionCard
          icon="\uD83D\uDE80"
          title="Just Explore & Have Fun"
          description="No pressure, let's experiment!"
          selected={value === 'exploration'}
          onPress={() => onValueChange('exploration')}
        />
      </View>

      <Button
        title="Let's Get Started!"
        onPress={onNext}
        disabled={!value}
        size="large"
        style={styles.button}
      />
    </AnimatedStepWrapper>
  );
}

// ---------------------------------------------------------------------------
// Feature Item Component
// ---------------------------------------------------------------------------

function FeatureItem({ icon, text }: { icon: string; text: string }): React.ReactElement {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Option Card Component
// ---------------------------------------------------------------------------

function OptionCard({
  icon,
  title,
  description,
  selected,
  onPress,
}: {
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <Card
      onPress={onPress}
      style={[styles.optionCard, selected && styles.optionCardSelected]}
      elevated
      padding="medium"
    >
      <View style={styles.optionContent}>
        <Text style={styles.optionIcon}>{icon}</Text>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={styles.optionDescription}>{description}</Text>
        </View>
        <View
          style={[
            styles.optionCheckbox,
            selected && styles.optionCheckboxSelected,
          ]}
        >
          {selected && <Text style={styles.checkmark}>{'\u2713'}</Text>}
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Progress Bar with Cat Avatar
// ---------------------------------------------------------------------------

function ProgressBar({ step }: { step: number }): React.ReactElement {
  const fillFraction = useSharedValue(step / 4);
  const catInfo = STEP_CATS[step] ?? STEP_CATS[1];

  React.useEffect(() => {
    fillFraction.value = withTiming(step / 4, {
      duration: SLIDE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [step, fillFraction]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fillFraction.value * 100}%` as `${number}%`,
  }));

  const catStyle = useAnimatedStyle(() => {
    // Keep the cat within bounds: offset by half cat size so it sits at the leading edge
    const maxTranslate = PROGRESS_BAR_WIDTH - CAT_SIZE;
    const rawTranslate = fillFraction.value * PROGRESS_BAR_WIDTH - CAT_SIZE / 2;
    const clampedTranslate = Math.max(0, Math.min(rawTranslate, maxTranslate));
    return {
      transform: [{ translateX: clampedTranslate }],
    };
  });

  return (
    <View style={styles.progressBarContainer}>
      {/* Cat avatar walking along the bar */}
      <Animated.View style={[styles.catAvatarContainer, catStyle]}>
        <Text style={styles.catAvatar}>{catInfo.emoji}</Text>
      </Animated.View>

      {/* Track */}
      <View style={styles.progressTrack}>
        {/* Fill */}
        <Animated.View style={[styles.progressFillWrapper, fillStyle]}>
          <LinearGradient
            colors={['#DC143C', '#FF6B6B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressFillGradient}
          />
        </Animated.View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Onboarding Screen
// ---------------------------------------------------------------------------

export function OnboardingScreen(): React.ReactElement {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>({});
  const [direction, setDirection] = useState<SlideDirection>('forward');
  const pendingAssessmentReturnRef = useRef(false);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const setHasCompletedOnboarding = useSettingsStore((s) => s.setHasCompletedOnboarding);
  const setExperienceLevel = useSettingsStore((s) => s.setExperienceLevel);
  const setLearningGoal = useSettingsStore((s) => s.setLearningGoal);

  // When returning from SkillAssessment, advance to step 3
  useFocusEffect(
    useCallback(() => {
      if (pendingAssessmentReturnRef.current) {
        pendingAssessmentReturnRef.current = false;
        setDirection('forward');
        setStep(3);
      }
    }, []),
  );

  const handleNext = useCallback(() => {
    if (step === 2 && state.experienceLevel) {
      setExperienceLevel(state.experienceLevel);

      // Navigate to skill assessment for intermediate/returning users
      if (state.experienceLevel === 'intermediate' || state.experienceLevel === 'returning') {
        pendingAssessmentReturnRef.current = true;
        navigation.navigate('SkillAssessment');
        return;
      }
    }
    if (step === 4) {
      // MUST set onboarding flag FIRST -- other setters use debouncedSave which
      // captures get() state. If hasCompletedOnboarding is still false when they
      // snapshot, the debounced write overwrites the immediate save 500ms later.
      setHasCompletedOnboarding(true);
      if (state.goal) {
        setLearningGoal(state.goal);
      }
      // Dismiss the onboarding modal and return to MainTabs
      navigation.goBack();
    } else {
      setDirection('forward');
      setStep((prev) => prev + 1);
    }
  }, [
    step,
    state.experienceLevel,
    state.goal,
    setExperienceLevel,
    setHasCompletedOnboarding,
    setLearningGoal,
    navigation,
  ]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setDirection('back');
      setStep((prev) => prev - 1);
    }
  }, [step]);

  const renderStep = (): React.ReactNode => {
    switch (step) {
      case 1:
        return <WelcomeStep onNext={handleNext} direction={direction} />;
      case 2:
        return (
          <ExperienceLevelStep
            value={state.experienceLevel}
            onValueChange={(level) =>
              setState((prev) => ({ ...prev, experienceLevel: level }))
            }
            onNext={handleNext}
            direction={direction}
          />
        );
      case 3:
        return (
          <EquipmentCheckStep
            value={state.hasMidi}
            onValueChange={(hasMidi) =>
              setState((prev) => ({ ...prev, hasMidi }))
            }
            onNext={handleNext}
            direction={direction}
          />
        );
      case 4:
        return (
          <GoalSettingStep
            value={state.goal}
            onValueChange={(goal) =>
              setState((prev) => ({ ...prev, goal }))
            }
            onNext={handleNext}
            direction={direction}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress bar with walking cat */}
        <ProgressBar step={step} />

        {/* Step content */}
        {renderStep()}
      </ScrollView>

      {/* Back button for steps 2-4 */}
      {step > 1 && (
        <View style={styles.backButtonContainer}>
          <Button
            title="Back"
            onPress={handleBack}
            variant="outline"
            size="medium"
            style={{ flex: 1 }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 4,
  },

  // Progress bar
  progressBarContainer: {
    marginBottom: SPACING.xl,
    paddingTop: CAT_SIZE + SPACING.xs,
  },
  progressTrack: {
    width: '100%',
    height: PROGRESS_BAR_HEIGHT,
    borderRadius: PROGRESS_BAR_HEIGHT / 2,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  progressFillWrapper: {
    height: '100%',
    borderRadius: PROGRESS_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  progressFillGradient: {
    flex: 1,
  },
  catAvatarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CAT_SIZE,
    height: CAT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  catAvatar: {
    fontSize: CAT_SIZE - 4,
  },

  // Steps
  stepContainer: {
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  iconLarge: {
    fontSize: 80,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  catIntro: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  stepSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg + 4,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },

  // Feature list
  featureList: {
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm + 4,
  },
  featureIcon: {
    fontSize: 20,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },

  // Option cards
  optionsList: {
    marginBottom: SPACING.lg,
    gap: SPACING.sm + 4,
  },
  midiOptions: {
    marginBottom: SPACING.lg,
    gap: SPACING.sm + 4,
  },
  optionCard: {
    marginBottom: 0,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
  },
  optionCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(220, 20, 60, 0.1)',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 4,
  },
  optionIcon: {
    fontSize: 32,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  optionDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  optionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.starEmpty,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },

  // Buttons
  button: {
    marginTop: SPACING.md,
  },
  backButtonContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm + 4,
  },
});

export default OnboardingScreen;
