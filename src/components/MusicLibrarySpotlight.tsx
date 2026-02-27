/**
 * MusicLibrarySpotlight Component
 *
 * A prominent gradient card for the HomeScreen that highlights the Music Library.
 * Displays total songs/genres, a featured song card with play button, and a
 * Browse Library CTA. Designed to draw attention to the app's 124-song catalogue.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableScale } from './common/PressableScale';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  glowColor,
} from '../theme/tokens';

export interface FeaturedSong {
  title: string;
  artist: string;
  genre: string;
  difficulty: number;
}

export interface MusicLibrarySpotlightProps {
  totalSongs: number;
  totalGenres: number;
  featuredSong: FeaturedSong | null;
  onBrowse: () => void;
  onPlayFeatured: () => void;
}

function DifficultyDots({ difficulty }: { difficulty: number }): React.JSX.Element {
  return (
    <View style={styles.difficultyRow}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View
          key={i}
          testID={`difficulty-dot-${i}`}
          style={[
            styles.difficultyDot,
            {
              backgroundColor:
                i < difficulty
                  ? COLORS.starGold
                  : glowColor(COLORS.textMuted, 0.3),
            },
          ]}
        />
      ))}
    </View>
  );
}

export function MusicLibrarySpotlight({
  totalSongs,
  totalGenres,
  featuredSong,
  onBrowse,
  onPlayFeatured,
}: MusicLibrarySpotlightProps): React.JSX.Element {
  return (
    <View style={[styles.outerContainer, SHADOWS.sm]}>
      <LinearGradient
        colors={[COLORS.cardHighlight, COLORS.cardSurface]}
        style={styles.gradient}
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons
              name="music-note-sixteenth-dotted"
              size={22}
              color={COLORS.primary}
            />
            <Text style={styles.title}>Music Library</Text>
          </View>
          <View style={styles.statPills}>
            <View style={styles.statPill}>
              <Text style={styles.statText}>{totalSongs} Songs</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statText}>{totalGenres} Genres</Text>
            </View>
          </View>
        </View>

        {/* Featured song card */}
        {featuredSong !== null && (
          <PressableScale
            testID="music-library-play-featured"
            onPress={onPlayFeatured}
            style={styles.featuredCard}
          >
            <View style={styles.playIconCircle}>
              <MaterialCommunityIcons
                name="play"
                size={20}
                color={COLORS.textPrimary}
              />
            </View>
            <View style={styles.featuredInfo}>
              <Text style={styles.featuredTitle} numberOfLines={1}>
                {featuredSong.title}
              </Text>
              <Text style={styles.featuredArtist} numberOfLines={1}>
                {featuredSong.artist}
              </Text>
            </View>
            <View style={styles.featuredRight}>
              <View style={styles.genreBadge}>
                <Text style={styles.genreText}>{featuredSong.genre}</Text>
              </View>
              <DifficultyDots difficulty={featuredSong.difficulty} />
            </View>
          </PressableScale>
        )}

        {/* Browse Library CTA */}
        <PressableScale
          testID="music-library-browse"
          onPress={onBrowse}
          style={styles.browseButton}
        >
          <MaterialCommunityIcons
            name="music-box"
            size={18}
            color={COLORS.primary}
          />
          <Text style={styles.browseText}>Browse Library</Text>
        </PressableScale>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  gradient: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.heading.md,
    color: COLORS.textPrimary,
  },
  statPills: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  statPill: {
    backgroundColor: glowColor(COLORS.primary, 0.15),
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statText: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  // Featured song card
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: glowColor(COLORS.textPrimary, 0.05),
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  playIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredInfo: {
    flex: 1,
  },
  featuredTitle: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  featuredArtist: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
  },
  featuredRight: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  genreBadge: {
    backgroundColor: glowColor(COLORS.info, 0.15),
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  genreText: {
    ...TYPOGRAPHY.caption.md,
    color: COLORS.info,
    fontWeight: '600',
  },
  // Difficulty dots
  difficultyRow: {
    flexDirection: 'row',
    gap: 3,
  },
  difficultyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Browse button
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glowColor(COLORS.primary, 0.12),
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: glowColor(COLORS.primary, 0.3),
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  browseText: {
    ...TYPOGRAPHY.button.md,
    color: COLORS.primary,
  },
});
