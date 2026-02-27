/**
 * SongReferencePicker
 *
 * Bottom-sheet modal that lets the user search and select a song from the
 * Music Library to use as a visual note reference in Free Play mode.
 *
 * - Slides up from the bottom (70% screen height)
 * - 300ms debounced search filtering
 * - FlatList of SongSummary items (title, artist, genre badge)
 * - onSelect returns songId + songTitle
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSongStore } from '../stores/songStore';
import type { SongSummary } from '../core/songs/songTypes';
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
} from '../theme/tokens';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SongReferencePickerProps {
  visible: boolean;
  onSelect: (songId: string, songTitle: string) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.7;
const DEBOUNCE_MS = 300;

// Genre display helpers
const GENRE_COLORS: Record<string, string> = {
  classical: '#9C27B0',
  pop: '#E91E63',
  film: '#FF9800',
  folk: '#4CAF50',
  game: '#2196F3',
  holiday: '#F44336',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SongReferencePicker({
  visible,
  onSelect,
  onClose,
}: SongReferencePickerProps): React.JSX.Element {
  const summaries = useSongStore((s) => s.summaries);
  const isLoading = useSongStore((s) => s.isLoadingSummaries);
  const loadSummaries = useSongStore((s) => s.loadSummaries);

  const [searchText, setSearchText] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load summaries when modal opens (if not already loaded)
  useEffect(() => {
    if (visible && summaries.length === 0) {
      loadSummaries(true);
    }
  }, [visible, summaries.length, loadSummaries]);

  // Debounce search input
  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(text.toLowerCase().trim());
    }, DEBOUNCE_MS);
  }, []);

  // Filter summaries by debounced query
  const filtered = useMemo(() => {
    if (!debouncedQuery) return summaries;
    return summaries.filter(
      (s) =>
        s.metadata.title.toLowerCase().includes(debouncedQuery) ||
        s.metadata.artist.toLowerCase().includes(debouncedQuery) ||
        s.metadata.genre.toLowerCase().includes(debouncedQuery),
    );
  }, [summaries, debouncedQuery]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Reset search when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchText('');
      setDebouncedQuery('');
    }
  }, [visible]);

  const handleSelect = useCallback(
    (item: SongSummary) => {
      onSelect(item.id, item.metadata.title);
    },
    [onSelect],
  );

  const renderItem = useCallback(
    ({ item }: { item: SongSummary }) => {
      const genreColor = GENRE_COLORS[item.metadata.genre] ?? COLORS.textMuted;
      return (
        <TouchableOpacity
          style={styles.songRow}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
          testID={`song-pick-${item.id}`}
        >
          <View style={styles.songInfo}>
            <Text style={styles.songTitle} numberOfLines={1}>
              {item.metadata.title}
            </Text>
            <Text style={styles.songArtist} numberOfLines={1}>
              {item.metadata.artist}
            </Text>
          </View>
          <View style={[styles.genreBadge, { backgroundColor: genreColor + '22' }]}>
            <Text style={[styles.genreText, { color: genreColor }]}>
              {item.metadata.genre}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>
      );
    },
    [handleSelect],
  );

  const keyExtractor = useCallback((item: SongSummary) => item.id, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="song-reference-picker-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        {/* Dismiss tap area */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Modal sheet */}
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Choose a Song</Text>
            <TouchableOpacity onPress={onClose} testID="song-picker-close">
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={COLORS.textMuted}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search songs..."
              placeholderTextColor={COLORS.textMuted}
              value={searchText}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              testID="song-picker-search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() => handleSearchChange('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Song list */}
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name={isLoading ? 'loading' : 'music-note-off'}
                  size={40}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyText}>
                  {isLoading
                    ? 'Loading songs...'
                    : debouncedQuery
                      ? 'No songs match your search'
                      : 'No songs available'}
                </Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    height: MODAL_HEIGHT,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    ...SHADOWS.lg,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerTitle: {
    ...TYPOGRAPHY.heading.lg,
    color: COLORS.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.body.md,
    color: COLORS.textPrimary,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: SPACING.sm,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  songArtist: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  genreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  genreText: {
    ...TYPOGRAPHY.caption.sm,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.textMuted,
  },
});
