/**
 * SongPlayerScreen
 *
 * Displays song details with section-based playback. Each section is converted
 * to an Exercise object and delegated to the standard ExercisePlayer.
 * Mastery is tracked per section, with tier upgrades earning gems.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSongStore } from '../stores/songStore';
import { useExerciseStore } from '../stores/exerciseStore';
import { useGemStore } from '../stores/gemStore';
import {
  updateSongMastery,
  gemRewardForTier,
  isBetterTier,
  masteryColor,
  masteryLabel,
} from '../core/songs/songMastery';
import type { Song, SongSection, SongLayer, MasteryTier } from '../core/songs/songTypes';
import type { Exercise, NoteEvent, ExerciseScore } from '../core/exercises/types';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../stores/authStore';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type SongPlayerRouteProp = RouteProp<RootStackParamList, 'SongPlayer'>;

// ---------------------------------------------------------------------------
// Section → Exercise adapter
// ---------------------------------------------------------------------------

export function sectionToExercise(
  song: Song,
  section: SongSection,
  layer: SongLayer,
  loop: boolean,
): Exercise {
  const notes: NoteEvent[] =
    layer === 'melody' ? section.layers.melody : section.layers.full;

  // Defensive defaults for settings that might be missing from Firestore data
  const settings = song.settings ?? {} as Song['settings'];

  return {
    id: `${song.id}-${section.id}-${layer}`,
    version: song.version,
    metadata: {
      title: `${song.metadata.title} — ${section.label}`,
      description: `${layer === 'melody' ? 'Melody' : 'Full arrangement'} of ${section.label}`,
      difficulty: section.difficulty,
      estimatedMinutes: 2,
      skills: ['songs', song.metadata.genre],
      prerequisites: [],
    },
    settings: {
      tempo: settings.tempo ?? 80,
      timeSignature: settings.timeSignature ?? [4, 4],
      keySignature: settings.keySignature ?? 'C',
      countIn: settings.countIn ?? 4,
      metronomeEnabled: settings.metronomeEnabled ?? true,
      loopEnabled: loop,
    },
    notes: notes ?? [],
    scoring: {
      timingToleranceMs: song.scoring?.timingToleranceMs ?? 50,
      timingGracePeriodMs: song.scoring?.timingGracePeriodMs ?? 150,
      passingScore: song.scoring?.passingScore ?? 70,
      starThresholds: song.scoring?.starThresholds ?? [70, 85, 95],
    },
    hints: {
      beforeStart: `Play the ${section.label}`,
      commonMistakes: [],
      successMessage: 'Section complete!',
    },
  };
}

/**
 * Merge all sections into a single full-song exercise.
 * Each section's notes are offset by the section's startBeat so they
 * form one continuous timeline.
 */
export function fullSongToExercise(
  song: Song,
  layer: SongLayer,
  loop: boolean,
): Exercise {
  const settings = song.settings ?? {} as Song['settings'];

  // Collect notes from all sections, offset by section.startBeat
  const allNotes: NoteEvent[] = [];
  for (const section of song.sections) {
    const sectionNotes = layer === 'melody' ? section.layers.melody : section.layers.full;
    if (!sectionNotes) continue;
    for (const note of sectionNotes) {
      allNotes.push({
        ...note,
        startBeat: note.startBeat + section.startBeat,
      });
    }
  }

  // Sort by startBeat for correct playback order
  allNotes.sort((a, b) => a.startBeat - b.startBeat || a.note - b.note);

  const avgDifficulty = Math.round(
    song.sections.reduce((sum, s) => sum + s.difficulty, 0) / song.sections.length,
  ) as 1 | 2 | 3 | 4 | 5;

  return {
    id: `${song.id}-full-${layer}`,
    version: song.version,
    metadata: {
      title: `${song.metadata.title} — Full Song`,
      description: `${layer === 'melody' ? 'Melody' : 'Full arrangement'} of the entire song`,
      difficulty: avgDifficulty,
      estimatedMinutes: Math.ceil(song.metadata.durationSeconds / 60),
      skills: ['songs', song.metadata.genre],
      prerequisites: [],
    },
    settings: {
      tempo: settings.tempo ?? 80,
      timeSignature: settings.timeSignature ?? [4, 4],
      keySignature: settings.keySignature ?? 'C',
      countIn: settings.countIn ?? 4,
      metronomeEnabled: settings.metronomeEnabled ?? true,
      loopEnabled: loop,
    },
    notes: allNotes,
    scoring: {
      timingToleranceMs: song.scoring?.timingToleranceMs ?? 50,
      timingGracePeriodMs: song.scoring?.timingGracePeriodMs ?? 150,
      passingScore: song.scoring?.passingScore ?? 70,
      starThresholds: song.scoring?.starThresholds ?? [70, 85, 95],
    },
    hints: {
      beforeStart: `Play the full song from start to finish!`,
      commonMistakes: [],
      successMessage: 'Amazing! You played the entire song!',
    },
  };
}

/**
 * Compute per-section scores from a full-song ExerciseScore.
 *
 * Maps each scored note back to its source section using startBeat ranges
 * (like F1 sector timing), then computes a weighted score per section using
 * the same weight distribution as the main scoring engine.
 */
export function computePerSectionScores(
  score: ExerciseScore,
  sections: SongSection[],
): Record<string, number> {
  const result: Record<string, number> = {};

  // Only expected notes (not extra notes the player added)
  const expectedNotes = score.details.filter((ns) => !ns.isExtraNote);

  for (const section of sections) {
    // Notes whose offset startBeat falls within this section's beat range
    const sectionNotes = expectedNotes.filter(
      (ns) =>
        ns.expected.startBeat >= section.startBeat &&
        ns.expected.startBeat < section.endBeat,
    );

    if (sectionNotes.length === 0) {
      result[section.id] = 0;
      continue;
    }

    const played = sectionNotes.filter((ns) => !ns.isMissedNote);
    const correct = played.filter((ns) => ns.isCorrectPitch);

    const accuracy = (correct.length / sectionNotes.length) * 100;
    const timing =
      played.length > 0
        ? played.reduce((sum, ns) => sum + ns.timingScore, 0) / played.length
        : 0;
    const completeness = (played.length / sectionNotes.length) * 100;
    const duration =
      played.length > 0
        ? played.reduce((sum, ns) => sum + (ns.durationScore ?? 100), 0) /
          played.length
        : 0;

    // Same weights as ExerciseValidator (0.35/0.30/0.10/0.10/0.15) with
    // extraNotes weight redistributed proportionally to the other four.
    const sectionScore =
      accuracy * 0.39 + timing * 0.33 + completeness * 0.11 + duration * 0.17;

    result[section.id] = Math.round(Math.min(100, Math.max(0, sectionScore)));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionPill({
  section,
  score,
  isSelected,
  onPress,
}: {
  section: SongSection;
  score: number | undefined;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.sectionPill, isSelected && styles.sectionPillSelected]}
      onPress={onPress}
      testID={`section-${section.id}`}
    >
      <Text style={[styles.sectionPillLabel, isSelected && styles.sectionPillLabelSelected]}>
        {section.label}
      </Text>
      {score !== null && score !== undefined && (
        <View style={styles.scoreBadge} testID={`score-badge-${section.id}`}>
          <Text style={styles.scoreBadgeText}>{Math.round(score)}%</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function MasteryProgress({
  tier,
  sectionScores,
  totalSections,
}: {
  tier: MasteryTier;
  sectionScores: Record<string, number>;
  totalSections: number;
}) {
  const completedSections = Object.keys(sectionScores).length;

  return (
    <View style={styles.masteryContainer} testID="mastery-progress">
      <View style={[styles.masteryBadge, { backgroundColor: masteryColor(tier) }]}>
        <Text style={styles.masteryBadgeText}>{masteryLabel(tier)}</Text>
      </View>
      <Text style={styles.masterySubtext}>
        {completedSections}/{totalSections} sections played
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export function SongPlayerScreen() {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<SongPlayerRouteProp>();
  const songId = route.params.songId;

  const { currentSong, isLoadingSong, loadSong, getMastery, updateMastery, addRecentSong } =
    useSongStore();
  const setCurrentExercise = useExerciseStore((s) => s.setCurrentExercise);
  const uid = useAuthStore((s) => s.user?.uid ?? '');

  // null = full song selected, number = section index
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(0);
  const [layer, setLayer] = useState<SongLayer>('melody');
  const [loop, setLoop] = useState(false);

  // Load song on mount
  useEffect(() => {
    loadSong(songId);
    addRecentSong(songId);
  }, [songId]);

  // Capture score when returning from Exercise
  useFocusEffect(
    useCallback(() => {
      if (!currentSong) return;

      const exerciseState = useExerciseStore.getState();
      const lastScore = exerciseState.lastCompletedScore;
      if (!lastScore || lastScore.overall === 0) return;

      // Clear the sticky score so it's not re-processed on next focus
      useExerciseStore.getState().clearLastCompletedScore();

      const existingMastery = getMastery(currentSong.id);
      const oldTier = existingMastery?.tier ?? 'none';

      let newSectionScores: Record<string, number>;

      if (selectedSectionIndex === null) {
        // Full song — compute per-section scores from note-level details
        // (like F1 sector timing: split the full-song score by section boundaries)
        const perSection = lastScore.details?.length
          ? computePerSectionScores(lastScore, currentSong.sections)
          : null;

        newSectionScores = { ...(existingMastery?.sectionScores ?? {}) };
        for (const section of currentSong.sections) {
          const sectionScore = perSection?.[section.id] ?? lastScore.overall;
          newSectionScores[section.id] = Math.max(
            existingMastery?.sectionScores?.[section.id] ?? 0,
            sectionScore,
          );
        }
      } else {
        const section = currentSong.sections[selectedSectionIndex];
        if (!section) return;
        newSectionScores = {
          ...(existingMastery?.sectionScores ?? {}),
          [section.id]: Math.max(
            existingMastery?.sectionScores?.[section.id] ?? 0,
            lastScore.overall,
          ),
        };
      }

      const sectionIds = currentSong.sections.map((s) => s.id);
      const updated = updateSongMastery(
        existingMastery,
        currentSong.id,
        uid,
        newSectionScores,
        sectionIds,
        layer,
      );

      updateMastery(updated);

      // Gem reward on tier upgrade
      if (isBetterTier(updated.tier, oldTier)) {
        const reward = gemRewardForTier(updated.tier);
        if (reward > 0) {
          useGemStore.getState().earnGems(reward, 'song-mastery');
        }
      }
    }, [currentSong, selectedSectionIndex, layer]),
  );

  const song = currentSong;
  const mastery = song ? getMastery(song.id) : null;

  const handlePlay = useCallback(() => {
    if (!song) return;

    let exercise: Exercise;
    if (selectedSectionIndex === null) {
      // Full song mode
      exercise = fullSongToExercise(song, layer, loop);
    } else {
      const section = song.sections[selectedSectionIndex];
      if (!section) return;
      exercise = sectionToExercise(song, section, layer, loop);
    }

    // Guard: don't navigate to an exercise with no notes
    if (!exercise.notes || exercise.notes.length === 0) {
      const label = selectedSectionIndex === null ? 'Full Song' : song.sections[selectedSectionIndex]?.id;
      console.warn('[SongPlayer] No notes:', label, layer);
      Alert.alert('No Notes', 'This selection has no playable notes. Try a different section or layer.');
      return;
    }

    console.log(`[SongPlayer] Playing: ${exercise.id}, notes=${exercise.notes.length}, tempo=${exercise.settings.tempo}, countIn=${exercise.settings.countIn}`);
    setCurrentExercise(exercise);
    navigation.navigate('Exercise', { exerciseId: exercise.id });
  }, [song, selectedSectionIndex, layer, loop, setCurrentExercise, navigation]);

  // BUG-027 fix: Check for 'full' layer, not 'accompaniment' — the toggle sets layer='full'
  // which reads section.layers.full, so the toggle should be enabled when full notes exist
  const hasFullLayer = song?.sections.some((s) => s.layers.full && s.layers.full.length > 0) ?? false;

  // ── Loading state ───────────────────────────────────────────

  if (isLoadingSong || !song) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading song...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ─────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} testID="song-player-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} testID="back-button">
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {song.metadata.title}
          </Text>
          <Text style={styles.songArtist} numberOfLines={1}>
            {song.metadata.artist}
          </Text>
        </View>
        {mastery && (
          <View style={[styles.headerBadge, { backgroundColor: masteryColor(mastery.tier) }]}>
            <Text style={styles.headerBadgeText}>{masteryLabel(mastery.tier)}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Mastery progress */}
        <MasteryProgress
          tier={mastery?.tier ?? 'none'}
          sectionScores={mastery?.sectionScores ?? {}}
          totalSections={song.sections.length}
        />

        {/* Section pills */}
        <Text style={styles.sectionLabel}>Sections</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionCarousel}
        >
          {/* Full Song pill */}
          <TouchableOpacity
            style={[styles.sectionPill, styles.fullSongPill, selectedSectionIndex === null && styles.fullSongPillSelected]}
            onPress={() => setSelectedSectionIndex(null)}
            testID="section-full-song"
          >
            <MaterialCommunityIcons
              name="music-note-whole"
              size={14}
              color={selectedSectionIndex === null ? COLORS.background : COLORS.starGold}
            />
            <Text style={[styles.sectionPillLabel, selectedSectionIndex === null && styles.sectionPillLabelSelected]}>
              Full Song
            </Text>
          </TouchableOpacity>

          {song.sections.map((section, index) => (
            <SectionPill
              key={section.id}
              section={section}
              score={mastery?.sectionScores[section.id]}
              isSelected={selectedSectionIndex === index}
              onPress={() => setSelectedSectionIndex(index)}
            />
          ))}
        </ScrollView>

        {/* Layer toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.layerToggle, layer === 'melody' && styles.layerToggleActive]}
            onPress={() => setLayer('melody')}
            testID="layer-melody"
          >
            <Text
              style={[styles.layerToggleText, layer === 'melody' && styles.layerToggleTextActive]}
            >
              Melody Only
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.layerToggle,
              layer === 'full' && styles.layerToggleActive,
              !hasFullLayer && styles.layerToggleDisabled,
            ]}
            onPress={() => hasFullLayer && setLayer('full')}
            disabled={!hasFullLayer}
            testID="layer-full"
          >
            <Text
              style={[
                styles.layerToggleText,
                layer === 'full' && styles.layerToggleTextActive,
                !hasFullLayer && styles.layerToggleTextDisabled,
              ]}
            >
              Full
            </Text>
          </TouchableOpacity>

          {/* Loop toggle */}
          <TouchableOpacity
            style={[styles.loopToggle, loop && styles.loopToggleActive]}
            onPress={() => setLoop((v) => !v)}
            testID="loop-toggle"
          >
            <MaterialCommunityIcons
              name="repeat"
              size={20}
              color={loop ? COLORS.primary : COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Song info */}
        <View style={[styles.infoCard, SHADOWS.sm as Record<string, unknown>]}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tempo</Text>
            <Text style={styles.infoValue}>{song.settings.tempo} BPM</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Key</Text>
            <Text style={styles.infoValue}>{song.settings.keySignature}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>
              {song.settings.timeSignature[0]}/{song.settings.timeSignature[1]}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Difficulty</Text>
            <View style={styles.difficultyStars}>
              {Array.from({ length: song.metadata.difficulty }, (_, i) => (
                <MaterialCommunityIcons key={i} name="star" size={14} color={COLORS.starGold} />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Play button */}
      <View style={styles.playButtonContainer}>
        <TouchableOpacity style={styles.playButton} onPress={handlePlay} testID="play-button">
          <MaterialCommunityIcons name="play" size={28} color={COLORS.background} />
          <Text style={styles.playButtonText}>
            {selectedSectionIndex === null
              ? 'Play Full Song'
              : `Play ${song.sections[selectedSectionIndex]?.label ?? 'Section'}`}
          </Text>
        </TouchableOpacity>
      </View>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textMuted,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  headerCenter: {
    flex: 1,
  },
  songTitle: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
  },
  songArtist: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.textSecondary,
  },
  headerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  headerBadgeText: {
    ...TYPOGRAPHY.caption.sm,
    color: COLORS.background,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Content
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },

  // Mastery
  masteryContainer: {
    alignItems: 'center',
    marginVertical: SPACING.md,
    gap: SPACING.xs,
  },
  masteryBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  masteryBadgeText: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.background,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  masterySubtext: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.textMuted,
  },

  // Sections
  sectionLabel: {
    ...TYPOGRAPHY.heading.sm,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  sectionCarousel: {
    gap: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  sectionPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    gap: 4,
  },
  sectionPillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  fullSongPill: {
    flexDirection: 'row',
    borderColor: COLORS.starGold,
    borderWidth: 1.5,
    gap: 6,
  },
  fullSongPillSelected: {
    backgroundColor: COLORS.starGold,
    borderColor: COLORS.starGold,
  },
  sectionPillLabel: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.textSecondary,
  },
  sectionPillLabelSelected: {
    color: COLORS.background,
    fontWeight: '600',
  },
  scoreBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.sm,
  },
  scoreBadgeText: {
    ...TYPOGRAPHY.caption.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  // Layer toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  layerToggle: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  layerToggleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  layerToggleDisabled: {
    opacity: 0.4,
  },
  layerToggleText: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.textSecondary,
  },
  layerToggleTextActive: {
    color: COLORS.background,
    fontWeight: '600',
  },
  layerToggleTextDisabled: {
    color: COLORS.textMuted,
  },
  loopToggle: {
    padding: SPACING.xs,
    marginLeft: 'auto',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  loopToggleActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(220, 20, 60, 0.1)',
  },

  // Info card
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: SPACING.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.textMuted,
  },
  infoValue: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  difficultyStars: {
    flexDirection: 'row',
  },

  // Play button
  playButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
    ...(SHADOWS.md as Record<string, unknown>),
  },
  playButtonText: {
    ...TYPOGRAPHY.button.lg,
    color: COLORS.background,
  },
});
