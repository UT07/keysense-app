/**
 * Onboarding Screen
 * First-time user experience with 4-step flow
 * 1. Welcome
 * 2. Experience Level
 * 3. Equipment Check
 * 4. Goal Setting
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { Button, Card } from '../components/common';
import { useSettingsStore } from '../stores/settingsStore';

interface OnboardingState {
  experienceLevel?: 'beginner' | 'intermediate' | 'returning';
  hasMidi?: boolean;
  goal?: 'songs' | 'technique' | 'exploration';
  completedAt?: Date;
}


/**
 * Step 1: Welcome Screen
 */
function WelcomeStep({ onNext }: { onNext: () => void }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    translateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.stepContainer, animatedStyle]}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🎹</Text>
      </View>
      <Text style={styles.stepTitle}>Welcome to Purrrfect Keys</Text>
      <Text style={styles.stepSubtitle}>
        Learn piano in 5 minutes a day with AI-powered feedback
      </Text>
      <View style={styles.featureList}>
        <FeatureItem icon="⚡" text="Real-time feedback on your playing" />
        <FeatureItem icon="🎯" text="Personalized learning path" />
        <FeatureItem icon="🔥" text="Build daily practice habits" />
      </View>
      <Button title="Get Started" onPress={onNext} size="large" style={styles.button} />
    </Animated.View>
  );
}

/**
 * Step 2: Experience Level
 */
function ExperienceLevelStep({
  onNext,
  value,
  onValueChange,
}: {
  onNext: () => void;
  value?: string;
  onValueChange: (level: 'beginner' | 'intermediate' | 'returning') => void;
}) {
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.stepContainer, animatedStyle]}>
      <Text style={styles.stepTitle}>What's Your Experience Level?</Text>
      <Text style={styles.stepDescription}>
        This helps us personalize your learning experience
      </Text>

      <View style={styles.optionsList}>
        <OptionCard
          icon="🌱"
          title="Complete Beginner"
          description="Never touched a piano before"
          selected={value === 'beginner'}
          onPress={() => onValueChange('beginner')}
        />
        <OptionCard
          icon="📚"
          title="I Know Some Basics"
          description="Can play simple melodies"
          selected={value === 'intermediate'}
          onPress={() => onValueChange('intermediate')}
        />
        <OptionCard
          icon="🎼"
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
    </Animated.View>
  );
}

/**
 * Step 3: Equipment Check
 */
function EquipmentCheckStep({
  onNext,
  value,
  onValueChange,
}: {
  onNext: () => void;
  value?: boolean;
  onValueChange: (hasMidi: boolean) => void;
}) {
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.stepContainer, animatedStyle]}>
      <Text style={styles.stepTitle}>Do You Have a MIDI Keyboard?</Text>
      <Text style={styles.stepDescription}>
        MIDI keyboards provide the best learning experience, but you can also use the on-screen keyboard
      </Text>

      <View style={styles.midiOptions}>
        <OptionCard
          icon="⌨️"
          title="Yes, I Have a MIDI Keyboard"
          description="USB or Bluetooth connected device"
          selected={value === true}
          onPress={() => onValueChange(true)}
        />
        <OptionCard
          icon="📱"
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
    </Animated.View>
  );
}

/**
 * Step 4: Goal Setting
 */
function GoalSettingStep({
  onNext,
  value,
  onValueChange,
}: {
  onNext: () => void;
  value?: string;
  onValueChange: (goal: 'songs' | 'technique' | 'exploration') => void;
}) {
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.stepContainer, animatedStyle]}>
      <Text style={styles.stepTitle}>What's Your Goal?</Text>
      <Text style={styles.stepDescription}>
        Choose what motivates you most
      </Text>

      <View style={styles.optionsList}>
        <OptionCard
          icon="🎵"
          title="Play My Favorite Songs"
          description="Learn recognizable melodies quickly"
          selected={value === 'songs'}
          onPress={() => onValueChange('songs')}
        />
        <OptionCard
          icon="🎯"
          title="Learn Proper Technique"
          description="Build solid fundamentals for long-term growth"
          selected={value === 'technique'}
          onPress={() => onValueChange('technique')}
        />
        <OptionCard
          icon="🚀"
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
    </Animated.View>
  );
}

/**
 * Feature Item Component
 */
function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

/**
 * Option Card Component
 */
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
}) {
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
          {selected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </View>
    </Card>
  );
}

/**
 * Main Onboarding Screen
 */
export function OnboardingScreen(): React.ReactElement {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>({});

  const navigation = useNavigation();
  const setHasCompletedOnboarding = useSettingsStore((s) => s.setHasCompletedOnboarding);
  const setExperienceLevel = useSettingsStore((s) => s.setExperienceLevel);
  const setLearningGoal = useSettingsStore((s) => s.setLearningGoal);

  const handleNext = () => {
    if (step === 2 && state.experienceLevel) {
      setExperienceLevel(state.experienceLevel);
    }
    if (step === 4) {
      // MUST set onboarding flag FIRST — other setters use debouncedSave which
      // captures get() state. If hasCompletedOnboarding is still false when they
      // snapshot, the debounced write overwrites the immediate save 500ms later.
      setHasCompletedOnboarding(true);
      if (state.goal) {
        setLearningGoal(state.goal);
      }
      // Dismiss the onboarding modal and return to MainTabs
      navigation.goBack();
    } else {
      setStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return <WelcomeStep onNext={handleNext} />;
      case 2:
        return (
          <ExperienceLevelStep
            value={state.experienceLevel}
            onValueChange={(level) =>
              setState((prev) => ({ ...prev, experienceLevel: level }))
            }
            onNext={handleNext}
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
        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View
              key={`progress-${i}`}
              style={[
                styles.progressDot,
                i + 1 <= step && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#444444',
  },
  progressDotActive: {
    backgroundColor: '#DC143C',
  },
  stepContainer: {
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 64,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#B0B0B0',
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepDescription: {
    fontSize: 14,
    color: '#B0B0B0',
    marginBottom: 24,
    textAlign: 'center',
  },
  featureList: {
    marginBottom: 32,
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    fontSize: 20,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: '#B0B0B0',
    lineHeight: 20,
  },
  optionsList: {
    marginBottom: 24,
    gap: 12,
  },
  midiOptions: {
    marginBottom: 24,
    gap: 12,
  },
  optionCard: {
    marginBottom: 0,
    borderWidth: 2,
    borderColor: '#333333',
  },
  optionCardSelected: {
    borderColor: '#DC143C',
    backgroundColor: 'rgba(220, 20, 60, 0.1)',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    color: '#FFFFFF',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    color: '#B0B0B0',
    lineHeight: 16,
  },
  optionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#444444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckboxSelected: {
    backgroundColor: '#DC143C',
    borderColor: '#DC143C',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  button: {
    marginTop: 16,
  },
  backButtonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    flexDirection: 'row',
    gap: 12,
  },
});

export default OnboardingScreen;
