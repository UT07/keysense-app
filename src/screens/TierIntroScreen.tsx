/**
 * TierIntroScreen — Unified AI-first tier overview
 *
 * Shows skills for the selected tier, mastery progress, cat companion,
 * and a START button that launches AI-generated exercises.
 * Replaces all static lesson routing — every tier uses this screen.
 */

import { useMemo, useCallback } from 'react';
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

import { MascotBubble } from '../components/Mascot/MascotBubble';
import { SKILL_TREE, getGenerationHints } from '../core/curriculum/SkillTree';
import type { SkillNode } from '../core/curriculum/SkillTree';
import { getTierMasteryTestSkillId, hasTierMasteryTestPassed } from '../core/curriculum/tierMasteryTest';
import { useLearnerProfileStore } from '../stores/learnerProfileStore';
import { useProgressStore } from '../stores/progressStore';
import { useSettingsStore } from '../stores/settingsStore';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS, GRADIENTS } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type TierIntroRouteProp = RouteProp<RootStackParamList, 'TierIntro'>;

/** Metadata for each tier */
const TIER_META: Record<number, { title: string; icon: string; description: string }> = {
  1:  { title: 'Note Finding',         icon: 'music-note',              description: 'Learn to locate notes on the keyboard, starting with Middle C.' },
  2:  { title: 'Right Hand Melodies',  icon: 'hand-pointing-right',     description: 'Build right-hand fluency with simple melodies and five-finger patterns.' },
  3:  { title: 'Left Hand Basics',     icon: 'hand-pointing-left',      description: 'Develop left-hand control with bass patterns and descending scales.' },
  4:  { title: 'Both Hands',           icon: 'hand-clap',               description: 'Bring both hands together for coordinated playing.' },
  5:  { title: 'Scales & Technique',   icon: 'stairs',                  description: 'Master proper scale technique with thumb-under and parallel motion.' },
  6:  { title: 'Black Keys',           icon: 'piano',                   description: 'Explore sharps, flats, and the chromatic scale.' },
  7:  { title: 'G & F Major',          icon: 'key-variant',             description: 'Learn new key signatures with G and F major scales and melodies.' },
  8:  { title: 'Minor Keys',           icon: 'music-accidental-flat',   description: 'Discover the expressive world of minor keys and harmonic minor.' },
  9:  { title: 'Chord Progressions',   icon: 'cards',                   description: 'Play major and minor chords, inversions, and common progressions.' },
  10: { title: 'Popular Songs',        icon: 'music',                   description: 'Apply your skills to well-known songs and arrangements.' },
  11: { title: 'Advanced Rhythm',      icon: 'metronome',               description: 'Master syncopation, triplets, compound meter, and swing feel.' },
  12: { title: 'Arpeggios',            icon: 'wave',                    description: 'Play broken chord patterns across multiple octaves.' },
  13: { title: 'Expression',           icon: 'volume-high',             description: 'Add dynamics, articulation, and pedal to your playing.' },
  14: { title: 'Sight Reading',        icon: 'eye',                     description: 'Build fluency reading new music in multiple keys.' },
  15: { title: 'Performance',          icon: 'trophy',                  description: 'Put it all together with complete pieces and repertoire.' },
};

const SKILL_COLORS = [
  { bg: 'rgba(220, 20, 60, 0.15)', text: '#FF6B8A' },
  { bg: 'rgba(255, 107, 53, 0.15)', text: '#FF8A65' },
  { bg: 'rgba(21, 101, 192, 0.15)', text: '#64B5F6' },
  { bg: 'rgba(46, 125, 50, 0.15)', text: '#81C784' },
  { bg: 'rgba(249, 168, 37, 0.15)', text: '#FFD54F' },
];

const MASCOT_MESSAGES: Record<number, string[]> = {
  1: [
    "Let's start from the very beginning! I'll guide you through it.",
    "Every great pianist started right here. Ready to find Middle C?",
  ],
  2: [
    "Time to make some melodies! Your right hand is about to shine.",
    "Simple patterns first, then beautiful music. Let's go!",
  ],
  3: [
    "Now your left hand gets a turn! Bass notes sound so cool.",
    "Building left hand skills opens up a whole new world!",
  ],
  4: [
    "Both hands together — this is where the magic happens!",
    "Coordination takes practice, but you're ready for it!",
  ],
  5: [
    "Scales are the foundation of everything. Let's build technique!",
    "Proper technique now means beautiful music later!",
  ],
  6: [
    "Black keys add so much color to music. Let's explore!",
    "Sharps and flats might seem tricky, but you'll love the sound!",
  ],
  7: [
    "New key signatures open up new musical possibilities!",
    "G major and F major — two of the most useful keys!",
  ],
  8: [
    "Minor keys have such beautiful, emotional sounds.",
    "Ready to add some drama and expression to your playing?",
  ],
  9: [
    "Chords are the backbone of all music. Let's build them!",
    "I-IV-V-I... the magic formula that powers thousands of songs!",
  ],
  10: [
    "Time to play songs you know! This is the fun part.",
    "All that practice pays off — let's make real music!",
  ],
  11: [
    "Rhythm is what makes music come alive. Feel the beat!",
    "Syncopation and swing — now you're really grooving!",
  ],
  12: [
    "Arpeggios make everything sound so elegant!",
    "Broken chords flowing up and down — pure beauty!",
  ],
  13: [
    "Expression turns notes into music. Feel every phrase!",
    "Soft, loud, smooth, bouncy — let's add emotion!",
  ],
  14: [
    "Sight reading is a superpower. Let's sharpen those eyes!",
    "The faster you read, the more music you can play!",
  ],
  15: [
    "Performance time! Show the world what you've learned!",
    "You've come so far. Time to put it all together!",
  ],
};

function getMascotMessage(tier: number): string {
  const messages = MASCOT_MESSAGES[tier] ?? MASCOT_MESSAGES[1];
  return messages[Math.floor(Math.random() * messages.length)];
}

/** Difficulty range for a tier (min-max from generation hints) */
function getTierDifficulty(skills: SkillNode[]): number {
  if (skills.length === 0) return 1;
  const hints = skills.map((s) => getGenerationHints(s.id)).filter(Boolean);
  if (hints.length === 0) return 1;
  const maxDiffs = hints.map((h) => h!.maxDifficulty ?? 1);
  return Math.max(...maxDiffs);
}

/** Estimated minutes per tier */
function getTierEstimatedMinutes(skills: SkillNode[]): number {
  return Math.max(5, skills.length * 3);
}

function DifficultyBars({ difficulty }: { difficulty: number }) {
  return (
    <View style={styles.difficultyContainer}>
      <Text style={styles.difficultyLabel}>Difficulty</Text>
      <View style={styles.difficultyBars}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.difficultyBar,
              i < difficulty ? styles.difficultyBarFilled : styles.difficultyBarEmpty,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function SkillRow({
  skill,
  index,
  isMastered,
}: {
  skill: SkillNode;
  index: number;
  isMastered: boolean;
}) {
  const color = SKILL_COLORS[index % SKILL_COLORS.length];
  const hints = getGenerationHints(skill.id);
  const handLabel = hints?.hand === 'left' ? 'LH' : hints?.hand === 'right' ? 'RH' : hints?.hand === 'both' ? 'Both' : null;

  return (
    <View style={styles.skillRow}>
      <View style={styles.skillRowLeft}>
        <View style={[
          styles.skillIndicator,
          isMastered ? styles.skillIndicatorMastered : styles.skillIndicatorPending,
        ]}>
          {isMastered ? (
            <MaterialCommunityIcons name="check" size={14} color={COLORS.textPrimary} />
          ) : (
            <Text style={styles.skillIndicatorText}>{index + 1}</Text>
          )}
        </View>
        <View style={styles.skillInfo}>
          <Text style={[styles.skillName, isMastered && styles.skillNameMastered]} numberOfLines={1}>
            {skill.name}
          </Text>
          <Text style={styles.skillDescription} numberOfLines={1}>
            {skill.description}
          </Text>
        </View>
      </View>
      <View style={styles.skillRowRight}>
        {handLabel && (
          <View style={[styles.handBadge, { backgroundColor: color.bg }]}>
            <Text style={[styles.handBadgeText, { color: color.text }]}>{handLabel}</Text>
          </View>
        )}
        {isMastered ? (
          <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.success} />
        ) : (
          <MaterialCommunityIcons name="circle-outline" size={20} color={COLORS.textMuted} />
        )}
      </View>
    </View>
  );
}

export function TierIntroScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<TierIntroRouteProp>();
  const { tier, locked = false } = route.params;

  const masteredSkills = useLearnerProfileStore((s) => s.masteredSkills);
  const tierTestResults = useProgressStore((s) => s.tierTestResults);
  const selectedCatId = useSettingsStore((s) => s.selectedCatId);

  const meta = TIER_META[tier] ?? { title: `Tier ${tier}`, icon: 'star', description: '' };

  const tierSkills = useMemo(
    () => SKILL_TREE.filter((s) => s.tier === tier),
    [tier]
  );

  const masteredSet = useMemo(() => new Set(masteredSkills), [masteredSkills]);

  const masteredCount = useMemo(
    () => tierSkills.filter((s) => masteredSet.has(s.id)).length,
    [tierSkills, masteredSet]
  );

  const isAllMastered = masteredCount === tierSkills.length && tierSkills.length > 0;

  const testPassed = useMemo(
    () => hasTierMasteryTestPassed(tier, tierTestResults),
    [tier, tierTestResults]
  );

  const showMasteryTest = isAllMastered && !testPassed;

  const firstUnmasteredSkillId = useMemo(() => {
    for (const skill of tierSkills) {
      if (!masteredSet.has(skill.id)) return skill.id;
    }
    return tierSkills[0]?.id ?? null;
  }, [tierSkills, masteredSet]);

  const difficulty = useMemo(() => getTierDifficulty(tierSkills), [tierSkills]);
  const estimatedMinutes = useMemo(() => getTierEstimatedMinutes(tierSkills), [tierSkills]);
  const mascotMessage = useMemo(() => getMascotMessage(tier), [tier]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleStart = useCallback(() => {
    if (!firstUnmasteredSkillId || locked) return;
    navigation.navigate('Exercise', {
      exerciseId: 'ai-mode',
      aiMode: true,
      skillId: firstUnmasteredSkillId,
    });
  }, [navigation, firstUnmasteredSkillId, locked]);

  const handleStartMasteryTest = useCallback(() => {
    if (locked) return;
    const testSkillId = getTierMasteryTestSkillId(tier);
    if (!testSkillId) return;
    navigation.navigate('Exercise', {
      exerciseId: 'ai-mode',
      aiMode: true,
      testMode: true,
      skillId: testSkillId,
    });
  }, [navigation, tier, locked]);

  return (
    <View style={styles.container} testID="tier-intro-screen">
      <LinearGradient colors={GRADIENTS.heroGlow} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              testID="tier-intro-back"
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>

            <View style={styles.headerTitleArea}>
              <Text style={styles.tierLabel}>TIER {tier}</Text>
              <Text style={styles.tierTitle} numberOfLines={2}>{meta.title}</Text>
            </View>

            <View style={styles.tierIconBadge}>
              <MaterialCommunityIcons name={meta.icon as any} size={24} color={COLORS.primary} />
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.description}>{meta.description}</Text>

        {/* Info row */}
        <View style={styles.infoRow}>
          <DifficultyBars difficulty={difficulty} />
          <View style={styles.timeContainer}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={COLORS.textSecondary} />
            <Text style={styles.timeText}>~{estimatedMinutes} min</Text>
          </View>
          <View style={styles.progressContainer}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={16}
              color={isAllMastered ? COLORS.success : COLORS.textSecondary}
            />
            <Text style={[styles.progressLabel, isAllMastered && styles.progressLabelComplete]}>
              {masteredCount}/{tierSkills.length}
            </Text>
          </View>
          {testPassed && (
            <View style={styles.testPassedBadge}>
              <MaterialCommunityIcons name="trophy" size={14} color={COLORS.starGold} />
              <Text style={styles.testPassedText}>Test Passed</Text>
            </View>
          )}
        </View>

        {/* Cat mascot */}
        <View style={styles.mascotSection}>
          <MascotBubble
            mood="encouraging"
            message={mascotMessage}
            size="large"
            catId={selectedCatId ?? 'mini-meowww'}
          />
        </View>

        {/* Skills list */}
        <View style={styles.skillsSection}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <View style={styles.skillsList}>
            {tierSkills.map((skill, index) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                index={index}
                isMastered={masteredSet.has(skill.id)}
              />
            ))}
          </View>
        </View>

        {/* AI badge */}
        <View style={styles.aiBadge}>
          <MaterialCommunityIcons name="creation" size={16} color={COLORS.primaryLight} />
          <Text style={styles.aiBadgeText}>
            Exercises are AI-generated and adapt to your skill level
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Start / Mastery Test button */}
      <SafeAreaView style={styles.bottomBar}>
        {showMasteryTest ? (
          <TouchableOpacity
            onPress={handleStartMasteryTest}
            style={styles.startButton}
            activeOpacity={0.8}
            testID="tier-intro-mastery-test"
          >
            <LinearGradient
              colors={GRADIENTS.gold}
              style={styles.startButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="trophy-outline" size={22} color={COLORS.textPrimary} />
              <Text style={styles.startButtonText}>Take Mastery Test</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={locked ? undefined : handleStart}
            style={[styles.startButton, locked && styles.startButtonLocked]}
            activeOpacity={locked ? 1 : 0.8}
            testID="tier-intro-start"
            disabled={locked}
          >
            <LinearGradient
              colors={locked ? ['#3A3A3A', '#2A2A2A'] : GRADIENTS.crimson}
              style={styles.startButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons
                name={locked ? 'lock' : isAllMastered && testPassed ? 'replay' : isAllMastered ? 'replay' : 'play'}
                size={22}
                color={locked ? COLORS.textMuted : COLORS.textPrimary}
              />
              <Text style={[styles.startButtonText, locked && { color: COLORS.textMuted }]}>
                {locked ? 'Complete Previous Tier' : isAllMastered && testPassed ? 'Practice Again' : isAllMastered ? 'Practice Again' : 'Start Exercises'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingBottom: SPACING.lg },
  headerContent: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm, marginTop: 2,
  },
  headerTitleArea: { flex: 1 },
  tierLabel: {
    ...TYPOGRAPHY.caption.lg, fontWeight: '700',
    color: COLORS.primary, letterSpacing: 2, marginBottom: 4,
  },
  tierTitle: { ...TYPOGRAPHY.display.md, fontSize: 26, color: COLORS.textPrimary },
  tierIconBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(220, 20, 60, 0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: SPACING.sm, marginTop: 4,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },
  description: {
    ...TYPOGRAPHY.body.lg, fontSize: 15,
    color: COLORS.textSecondary, marginBottom: SPACING.md,
  },
  // Info row
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.lg,
    marginBottom: SPACING.xl, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md,
  },
  difficultyContainer: { alignItems: 'center', gap: 4 },
  difficultyLabel: {
    ...TYPOGRAPHY.caption.sm, fontWeight: '600', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  difficultyBars: { flexDirection: 'row', gap: 3 },
  difficultyBar: { width: 14, height: 6, borderRadius: 3 },
  difficultyBarFilled: { backgroundColor: COLORS.primary },
  difficultyBarEmpty: { backgroundColor: COLORS.cardBorder },
  timeContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { ...TYPOGRAPHY.body.sm, color: COLORS.textSecondary },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  progressLabel: { ...TYPOGRAPHY.body.sm, fontWeight: '600', color: COLORS.textSecondary },
  progressLabelComplete: { color: COLORS.success },
  testPassedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: BORDER_RADIUS.full,
  },
  testPassedText: { ...TYPOGRAPHY.caption.sm, fontWeight: '700', color: COLORS.starGold },
  // Mascot
  mascotSection: {
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xs,
  },
  // Skills list
  skillsSection: { marginBottom: SPACING.lg },
  sectionTitle: {
    ...TYPOGRAPHY.heading.sm, fontWeight: '700',
    color: COLORS.textPrimary, marginBottom: SPACING.sm,
  },
  skillsList: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md, overflow: 'hidden',
  },
  skillRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  skillRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: SPACING.sm },
  skillIndicator: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  skillIndicatorMastered: { backgroundColor: COLORS.success },
  skillIndicatorPending: { backgroundColor: COLORS.cardBorder },
  skillIndicatorText: {
    ...TYPOGRAPHY.caption.lg, fontWeight: '700', color: COLORS.textSecondary,
  },
  skillInfo: { flex: 1 },
  skillName: { ...TYPOGRAPHY.body.md, fontWeight: '500', color: COLORS.textPrimary },
  skillNameMastered: { color: COLORS.textMuted },
  skillDescription: { ...TYPOGRAPHY.caption.md, color: COLORS.textMuted, marginTop: 1 },
  skillRowRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  handBadge: {
    paddingHorizontal: SPACING.xs, paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  handBadgeText: { ...TYPOGRAPHY.caption.sm, fontWeight: '700', letterSpacing: 0.5 },
  // AI badge
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: 'rgba(220, 20, 60, 0.06)',
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  aiBadgeText: { ...TYPOGRAPHY.caption.lg, color: COLORS.textMuted, flex: 1 },
  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.background + 'F2',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.sm,
    borderTopWidth: 1, borderTopColor: COLORS.surface,
  },
  startButton: {
    borderRadius: BORDER_RADIUS.lg, overflow: 'hidden',
    ...SHADOWS.md, shadowColor: COLORS.primary,
  },
  startButtonLocked: { opacity: 0.7, shadowColor: 'transparent' },
  startButtonGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.md, gap: SPACING.sm,
  },
  startButtonText: {
    ...TYPOGRAPHY.button.lg, fontSize: 17, fontWeight: '700', color: COLORS.textPrimary,
  },
});

export default TierIntroScreen;
