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
import type { Exercise, NoteEvent } from '../core/exercises/types';
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
      ...song.settings,
      loopEnabled: loop,
    },
    notes,
    scoring: song.scoring,
    hints: {
      beforeStart: `Play the ${section.label}`,
      commonMistakes: [],
      successMessage: 'Section complete!',
    },
  };
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

  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [layer, setLayer] = useState<SongLayer>('melody');
  const [loop, setLoop] = useState(true);

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
      const lastScore = exerciseState.score;
      if (!lastScore || lastScore.overall === 0) return;

      const section = currentSong.sections[selectedSectionIndex];
      if (!section) return;

      // Build new section scores
      const existingMastery = getMastery(currentSong.id);
      const oldTier = existingMastery?.tier ?? 'none';

      const newSectionScores: Record<string, number> = {
        ...(existingMastery?.sectionScores ?? {}),
        [section.id]: Math.max(
          existingMastery?.sectionScores?.[section.id] ?? 0,
          lastScore.overall,
        ),
      };

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
    const section = song.sections[selectedSectionIndex];
    if (!section) return;

    const exercise = sectionToExercise(song, section, layer, loop);
    setCurrentExercise(exercise);
    navigation.navigate('Exercise', { exerciseId: exercise.id });
  }, [song, selectedSectionIndex, layer, loop, setCurrentExercise, navigation]);

  const hasAccompaniment = song?.sections.some((s) => s.layers.accompaniment !== undefined) ?? false;

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
              !hasAccompaniment && styles.layerToggleDisabled,
            ]}
            onPress={() => hasAccompaniment && setLayer('full')}
            disabled={!hasAccompaniment}
            testID="layer-full"
          >
            <Text
              style={[
                styles.layerToggleText,
                layer === 'full' && styles.layerToggleTextActive,
                !hasAccompaniment && styles.layerToggleTextDisabled,
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
            Play {song.sections[selectedSectionIndex]?.label ?? 'Section'}
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
