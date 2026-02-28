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

/** Educational concept cards — actual music theory explanations per tier */
const TIER_CONCEPTS: Record<number, { title: string; icon: string; body: string }[]> = {
  1: [
    { title: 'The Musical Alphabet', icon: 'alphabetical-variant', body: 'Music uses 7 letters: A B C D E F G, then repeats. These are the white keys on the piano. Middle C is your home base — find the two black keys grouped together, and C is just to the left.' },
    { title: 'Why Finger Numbers?', icon: 'hand-back-right', body: 'Each finger has a number: thumb = 1, pinky = 5. Using the right fingers builds muscle memory so you can play faster and more accurately as music gets harder.' },
  ],
  2: [
    { title: 'What Is a Scale?', icon: 'stairs', body: 'A scale is a set of notes played in order, like climbing stairs. C major uses all white keys: C D E F G A B C. Scales are the building blocks of melodies — almost every song is built from them.' },
    { title: 'Reading Rhythm', icon: 'metronome', body: 'Each beat is one tick of the metronome. A quarter note lasts 1 beat, a half note lasts 2, and a whole note lasts 4. Count "1-2-3-4" with the clicks to stay in time.' },
  ],
  3: [
    { title: 'Bass Clef Basics', icon: 'music-clef-bass', body: 'The left hand usually plays lower notes in the bass clef. These notes provide the foundation of the music — the bass line and harmony that supports the melody above.' },
    { title: 'Hand Independence', icon: 'hand-clap', body: 'Playing with two hands separately first, then combining them, is how every pianist learns. Your brain needs time to automate each hand before coordinating both.' },
  ],
  4: [
    { title: 'Hands Together', icon: 'merge', body: 'When both hands play together, start very slowly — much slower than you think! Each hand has its own pattern. Practice each hand alone until it feels automatic, then combine at half speed.' },
    { title: 'Posture Matters', icon: 'human', body: 'Sit at the edge of the bench, feet flat on the floor. Keep your wrists level with the keys — not drooping or raised. Curved fingers, relaxed shoulders. Good posture prevents injury and helps you play better.' },
  ],
  5: [
    { title: 'Thumb Under Technique', icon: 'swap-horizontal', body: 'To play more than 5 notes in a row, your thumb crosses under your hand to reach the next key. This lets you play scales and melodies smoothly without running out of fingers.' },
    { title: 'Why Practice Slowly?', icon: 'tortoise', body: 'Playing slowly trains your brain to make the right movements. Speed comes from accuracy, not force. If you practice slowly and correctly 10 times, you\'ll play faster than if you rush 50 times with mistakes.' },
  ],
  6: [
    { title: 'Sharps and Flats', icon: 'music-accidental-sharp', body: 'Black keys are sharps (#) or flats (b). F# is the black key to the right of F. Bb is the black key to the left of B. Same key, two names — it depends on the musical context.' },
    { title: 'The Chromatic Scale', icon: 'dots-horizontal', body: 'Playing every key in order (black and white) gives you the chromatic scale — 12 notes total. All of Western music is built from these 12 notes combined in different ways.' },
  ],
  7: [
    { title: 'What Is a Key Signature?', icon: 'key-variant', body: 'A key signature tells you which notes are sharp or flat throughout a piece. G major has one sharp (F#). F major has one flat (Bb). The key signature saves you from writing # or b on every note.' },
    { title: 'Transposing', icon: 'transfer', body: 'Once you learn a melody in C major, you can play it in G major by starting on G and using the G major scale. Same pattern of steps, different starting note — this is called transposing.' },
  ],
  8: [
    { title: 'Major vs. Minor', icon: 'compare', body: 'Major keys sound bright and happy. Minor keys sound dark and emotional. The difference? In a minor scale, the 3rd note is lowered by a half step. C major: C D E... C minor: C D Eb... That one note changes everything.' },
    { title: 'Harmonic Minor', icon: 'wave', body: 'The harmonic minor scale raises the 7th note back up, creating a distinctive, slightly exotic sound. Many classical and movie themes use harmonic minor for its dramatic quality.' },
  ],
  9: [
    { title: 'What Is a Chord?', icon: 'cards', body: 'A chord is 3 or more notes played together. The most basic chord is a triad: root + 3rd + 5th. C major chord = C E G. Chords create harmony — they\'re the color and emotion behind the melody.' },
    { title: 'The I-IV-V Progression', icon: 'repeat', body: 'In C major: I = C major, IV = F major, V = G major. This three-chord pattern powers thousands of songs from "Twist and Shout" to "Let It Be." Learn these three chords and you can accompany almost anything.' },
    { title: 'Inversions', icon: 'swap-vertical', body: 'C E G, E G C, and G C E are all C major chord — just rearranged. These are called inversions. Using inversions keeps your hand close to the same position instead of jumping around the keyboard.' },
  ],
  10: [
    { title: 'Song Structure', icon: 'format-list-bulleted', body: 'Most songs follow a pattern: Verse - Chorus - Verse - Chorus - Bridge - Chorus. Recognizing the structure helps you learn faster — you only need to memorize a few unique sections.' },
    { title: 'Playing by Ear', icon: 'ear-hearing', body: 'Listen to a melody, then try to find the notes on the keyboard. Start with simple songs you know well. This trains your ear-to-hand connection, one of the most valuable skills a musician can develop.' },
  ],
  11: [
    { title: 'Syncopation', icon: 'music-note-off', body: 'Syncopation means accenting notes between the main beats instead of on them. It creates a sense of surprise and groove. Jazz, funk, and Latin music all rely heavily on syncopation.' },
    { title: 'Time Signatures', icon: 'clock-outline', body: '4/4 means 4 beats per measure (most common). 3/4 is waltz time (1-2-3, 1-2-3). 6/8 has a rolling, compound feel. The time signature is the rhythmic skeleton of the music.' },
  ],
  12: [
    { title: 'What Are Arpeggios?', icon: 'wave', body: 'An arpeggio is a chord played one note at a time: C, E, G, C instead of all together. They create flowing, harp-like patterns. Many beautiful piano passages are built from arpeggios.' },
  ],
  13: [
    { title: 'Dynamics', icon: 'volume-high', body: 'Piano (p) means soft, forte (f) means loud. Crescendo means getting louder, diminuendo means getting softer. Dynamics turn flat, robotic playing into expressive music that tells a story.' },
    { title: 'Articulation', icon: 'gesture-tap', body: 'Legato means smooth and connected. Staccato means short and detached. How you press and release the keys changes the character of the music just as much as which keys you press.' },
  ],
  14: [
    { title: 'Sight Reading Tips', icon: 'eye', body: 'Look ahead, not at your hands. Read in patterns (chords, scales) not individual notes. Start at half the written tempo. Sight reading is a skill that improves dramatically with daily practice — even 5 minutes a day.' },
  ],
  15: [
    { title: 'Performance Mindset', icon: 'trophy', body: 'Performing is different from practicing. Choose pieces you can play at 90% effort, not 100%. Small mistakes are normal and audiences rarely notice them. The most important thing is musical expression and confidence.' },
  ],
};

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

function ConceptCard({ title, icon, body }: { title: string; icon: string; body: string }) {
  return (
    <View style={styles.conceptCard}>
      <View style={styles.conceptHeader}>
        <View style={styles.conceptIconBadge}>
          <MaterialCommunityIcons name={icon as any} size={18} color={COLORS.primary} />
        </View>
        <Text style={styles.conceptTitle}>{title}</Text>
      </View>
      <Text style={styles.conceptBody}>{body}</Text>
    </View>
  );
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

        {/* Theory concept cards */}
        {TIER_CONCEPTS[tier]?.length > 0 && (
          <View style={styles.conceptsSection}>
            <Text style={styles.sectionTitle}>What You'll Learn</Text>
            {TIER_CONCEPTS[tier].map((concept, i) => (
              <ConceptCard key={i} title={concept.title} icon={concept.icon} body={concept.body} />
            ))}
          </View>
        )}

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
  // Concept cards
  conceptsSection: { marginBottom: SPACING.lg },
  conceptCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  conceptHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  conceptIconBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(220, 20, 60, 0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  conceptTitle: {
    ...TYPOGRAPHY.body.lg, fontWeight: '700',
    color: COLORS.textPrimary, flex: 1,
  },
  conceptBody: {
    ...TYPOGRAPHY.body.md, fontSize: 14,
    color: COLORS.textSecondary, lineHeight: 21,
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
