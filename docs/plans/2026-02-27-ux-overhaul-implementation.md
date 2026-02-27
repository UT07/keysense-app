# UX Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix assessment→lesson mismatch, surface mastery tests, redesign HomeScreen with Music Library spotlight, redesign Free Play with portrait split keyboard + song reference, and update all stale docs.

**Architecture:** 5 independent batches. Batch 1 is a pure logic bug fix. Batch 2 surfaces existing mastery test infrastructure (already built — `getTestExercise()`, `isTestExercise()`, test exercise JSONs all exist). Batch 3 rewrites HomeScreen layout. Batch 4 rewrites PlayScreen. Batch 5 updates docs.

**Tech Stack:** React Native (Expo), TypeScript, Zustand, react-native-svg, expo-linear-gradient

**Design doc:** `docs/plans/2026-02-27-ux-overhaul-design.md`

---

## Task 1: Fix Assessment Skill Seeding

**Problem:** `SkillAssessmentScreen.tsx:744-755` only seeds 3 basic skills (`find-middle-c`, `keyboard-geography`, `white-keys`) regardless of which lesson the user is placed at. When assessment places user at lesson-03, the LevelMap still shows tier 1 as current because `rh-cde` and `rh-cdefg` (lesson-03 prereqs) were never seeded.

**Files:**
- Modify: `src/screens/SkillAssessmentScreen.tsx:744-755`
- Test: `src/screens/__tests__/SkillAssessmentScreen.test.ts` (create if needed, or add to existing)

**Step 1: Write failing test**

Create `src/screens/__tests__/assessmentSeeding.test.ts`:

```typescript
import { determineStartLesson } from '../SkillAssessmentScreen';

// These already exist and should pass:
describe('determineStartLesson', () => {
  it('returns lesson-01 when first round fails', () => {
    expect(determineStartLesson([0.3, 0.5, 0.2, 0.1, 0.1])).toBe('lesson-01');
  });
  it('returns lesson-03 when first 2 rounds are perfect', () => {
    expect(determineStartLesson([0.95, 0.92, 0.4, 0.3, 0.2])).toBe('lesson-03');
  });
  it('returns lesson-05 when first 3 rounds are perfect', () => {
    expect(determineStartLesson([0.95, 0.92, 0.93, 0.3, 0.2])).toBe('lesson-05');
  });
});

// NEW: Test that skill seeding matches lesson prereqs
describe('getSkillsToSeedForLesson', () => {
  it('seeds nothing for lesson-01', () => {
    expect(getSkillsToSeedForLesson('lesson-01')).toEqual([]);
  });
  it('seeds lesson-02 prereqs for lesson-02', () => {
    expect(getSkillsToSeedForLesson('lesson-02')).toEqual(
      expect.arrayContaining(['find-middle-c', 'keyboard-geography', 'white-keys'])
    );
  });
  it('seeds lesson-02 AND lesson-03 prereqs for lesson-03', () => {
    const skills = getSkillsToSeedForLesson('lesson-03');
    expect(skills).toEqual(expect.arrayContaining([
      'find-middle-c', 'keyboard-geography', 'white-keys', // lesson-02
      'rh-cde', 'rh-cdefg', // lesson-03
    ]));
  });
  it('seeds all prereqs up to lesson-05 for lesson-05', () => {
    const skills = getSkillsToSeedForLesson('lesson-05');
    expect(skills).toEqual(expect.arrayContaining([
      'find-middle-c', 'keyboard-geography', 'white-keys',
      'rh-cde', 'rh-cdefg',
      'c-position-review', 'lh-scale-descending', 'steady-bass',
      'both-hands-review',
    ]));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/screens/__tests__/assessmentSeeding.test.ts -v`
Expected: FAIL — `getSkillsToSeedForLesson` is not defined

**Step 3: Implement `getSkillsToSeedForLesson` and fix seeding**

In `src/screens/SkillAssessmentScreen.tsx`, add this exported function and update the seeding block:

```typescript
// Add after determineStartLesson (line ~341)

/** Prereqs from CurriculumEngine.shouldUnlockAnchorLesson — kept in sync */
const LESSON_PREREQS: Record<string, string[]> = {
  'lesson-01': [],
  'lesson-02': ['find-middle-c', 'keyboard-geography', 'white-keys'],
  'lesson-03': ['rh-cde', 'rh-cdefg'],
  'lesson-04': ['c-position-review', 'lh-scale-descending', 'steady-bass'],
  'lesson-05': ['both-hands-review'],
  'lesson-06': ['scale-review', 'both-hands-review'],
};

/**
 * Get all skills that should be seeded when assessment places user at a given lesson.
 * Collects prereqs for the target lesson AND all prior lessons.
 */
export function getSkillsToSeedForLesson(startLesson: string): string[] {
  const lessonNum = parseInt(startLesson.replace('lesson-', ''), 10);
  if (isNaN(lessonNum) || lessonNum <= 1) return [];

  const skills = new Set<string>();
  for (let i = 1; i <= lessonNum; i++) {
    const key = `lesson-${String(i).padStart(2, '0')}`;
    const prereqs = LESSON_PREREQS[key] ?? [];
    for (const skill of prereqs) {
      skills.add(skill);
    }
  }
  return Array.from(skills);
}
```

Then replace lines 744-755 (the old seeding block) with:

```typescript
      // Seed ALL prerequisite skills for the determined start lesson.
      // This ensures the LevelMap shows correct tier progress.
      const skillsToSeed = getSkillsToSeedForLesson(lesson);
      for (const skillId of skillsToSeed) {
        profileStore.markSkillMastered(skillId);
      }
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/screens/__tests__/assessmentSeeding.test.ts -v`
Expected: PASS

**Step 5: Run full test suite**

Run: `npx jest --silent 2>&1 | tail -5`
Expected: All tests pass, 0 failures

**Step 6: Commit**

```bash
git add src/screens/SkillAssessmentScreen.tsx src/screens/__tests__/assessmentSeeding.test.ts
git commit -m "fix: seed all prerequisite skills when assessment places user beyond lesson 1

Assessment now seeds complete skill chains (e.g., lesson-03 seeds find-middle-c,
keyboard-geography, white-keys, rh-cde, rh-cdefg) so LevelMap shows correct tier.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Add Review Challenge Card for Decayed Skills

**Problem:** When skills decay (not practiced in 14+ days), there's no visible prompt on HomeScreen. Users don't know they need to review.

**Files:**
- Create: `src/components/ReviewChallengeCard.tsx`
- Test: `src/components/__tests__/ReviewChallengeCard.test.tsx`

**Step 1: Write failing test**

```typescript
// src/components/__tests__/ReviewChallengeCard.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ReviewChallengeCard } from '../ReviewChallengeCard';

describe('ReviewChallengeCard', () => {
  it('renders nothing when no skills are decaying', () => {
    const { toJSON } = render(
      <ReviewChallengeCard decayedSkills={[]} onStartReview={() => {}} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders card when skills are decaying', () => {
    const { getByText } = render(
      <ReviewChallengeCard
        decayedSkills={['rh-cde', 'white-keys', 'find-middle-c']}
        onStartReview={() => {}}
      />
    );
    expect(getByText(/skills need review/i)).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('calls onStartReview when pressed', () => {
    const onStart = jest.fn();
    const { getByTestId } = render(
      <ReviewChallengeCard
        decayedSkills={['rh-cde']}
        onStartReview={onStart}
      />
    );
    fireEvent.press(getByTestId('review-challenge-start'));
    expect(onStart).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/ReviewChallengeCard.test.tsx -v`
Expected: FAIL — module not found

**Step 3: Implement ReviewChallengeCard**

```typescript
// src/components/ReviewChallengeCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableScale } from './common/PressableScale';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS, glowColor } from '../theme/tokens';

interface ReviewChallengeCardProps {
  decayedSkills: string[];
  onStartReview: () => void;
}

export function ReviewChallengeCard({ decayedSkills, onStartReview }: ReviewChallengeCardProps) {
  if (decayedSkills.length === 0) return null;

  return (
    <PressableScale haptic onPress={onStartReview} testID="review-challenge-card">
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="refresh-circle" size={28} color={COLORS.warning} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>Skills Need Review</Text>
          <Text style={styles.subtitle}>
            {decayedSkills.length} skill{decayedSkills.length > 1 ? 's' : ''} fading — quick review to stay sharp
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText} testID="review-challenge-start">{decayedSkills.length}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.textMuted} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    ...SHADOWS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: glowColor(COLORS.warning, 0.08),
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: glowColor(COLORS.warning, 0.2),
    gap: SPACING.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: glowColor(COLORS.warning, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  title: {
    ...TYPOGRAPHY.heading.sm,
    color: COLORS.warning,
  },
  subtitle: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badge: {
    backgroundColor: COLORS.warning,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...TYPOGRAPHY.body.sm,
    fontWeight: '800' as const,
    color: COLORS.background,
  },
});
```

**Step 4: Run tests**

Run: `npx jest src/components/__tests__/ReviewChallengeCard.test.tsx -v`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ReviewChallengeCard.tsx src/components/__tests__/ReviewChallengeCard.test.tsx
git commit -m "feat: add ReviewChallengeCard for decayed skill prompts

Shows warning card on HomeScreen when skills haven't been practiced in 14+ days.
Displays count and navigates to review session.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Add Music Library Spotlight Card

**Files:**
- Create: `src/components/MusicLibrarySpotlight.tsx`
- Test: `src/components/__tests__/MusicLibrarySpotlight.test.tsx`

**Step 1: Write failing test**

```typescript
// src/components/__tests__/MusicLibrarySpotlight.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MusicLibrarySpotlight } from '../MusicLibrarySpotlight';

describe('MusicLibrarySpotlight', () => {
  it('renders song count and genre count', () => {
    const { getByText } = render(
      <MusicLibrarySpotlight
        totalSongs={124}
        totalGenres={6}
        featuredSong={{ title: 'Moonlight Sonata', artist: 'Beethoven', genre: 'Classical', difficulty: 3 }}
        onBrowse={() => {}}
        onPlayFeatured={() => {}}
      />
    );
    expect(getByText(/124 Songs/)).toBeTruthy();
    expect(getByText(/6 Genres/)).toBeTruthy();
  });

  it('shows featured song info', () => {
    const { getByText } = render(
      <MusicLibrarySpotlight
        totalSongs={124}
        totalGenres={6}
        featuredSong={{ title: 'Moonlight Sonata', artist: 'Beethoven', genre: 'Classical', difficulty: 3 }}
        onBrowse={() => {}}
        onPlayFeatured={() => {}}
      />
    );
    expect(getByText('Moonlight Sonata')).toBeTruthy();
    expect(getByText('Beethoven')).toBeTruthy();
  });

  it('calls onBrowse when Browse Library pressed', () => {
    const onBrowse = jest.fn();
    const { getByTestId } = render(
      <MusicLibrarySpotlight
        totalSongs={124}
        totalGenres={6}
        featuredSong={null}
        onBrowse={onBrowse}
        onPlayFeatured={() => {}}
      />
    );
    fireEvent.press(getByTestId('music-library-browse'));
    expect(onBrowse).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/components/__tests__/MusicLibrarySpotlight.test.tsx -v`

**Step 3: Implement MusicLibrarySpotlight**

```typescript
// src/components/MusicLibrarySpotlight.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableScale } from './common/PressableScale';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS, GRADIENTS, glowColor } from '../theme/tokens';

interface FeaturedSong {
  title: string;
  artist: string;
  genre: string;
  difficulty: number;
}

interface MusicLibrarySpotlightProps {
  totalSongs: number;
  totalGenres: number;
  featuredSong: FeaturedSong | null;
  onBrowse: () => void;
  onPlayFeatured: () => void;
}

export function MusicLibrarySpotlight({
  totalSongs,
  totalGenres,
  featuredSong,
  onBrowse,
  onPlayFeatured,
}: MusicLibrarySpotlightProps) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.primaryDark, '#1A1040', COLORS.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <MaterialCommunityIcons name="music-note-sixteenth-dotted" size={22} color={COLORS.primary} />
          <Text style={styles.headerTitle}>Music Library</Text>
          <View style={styles.statPills}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{totalSongs} Songs</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{totalGenres} Genres</Text>
            </View>
          </View>
        </View>

        {/* Featured Song */}
        {featuredSong && (
          <PressableScale haptic onPress={onPlayFeatured} style={styles.featuredCard}>
            <View style={styles.featured}>
              <View style={styles.featuredIcon}>
                <MaterialCommunityIcons name="play" size={20} color={COLORS.textPrimary} />
              </View>
              <View style={styles.featuredInfo}>
                <Text style={styles.featuredTitle} numberOfLines={1}>{featuredSong.title}</Text>
                <Text style={styles.featuredArtist} numberOfLines={1}>{featuredSong.artist}</Text>
              </View>
              <View style={styles.genreBadge}>
                <Text style={styles.genreText}>{featuredSong.genre}</Text>
              </View>
              <View style={styles.difficultyDots}>
                {[1, 2, 3, 4, 5].map((d) => (
                  <View
                    key={d}
                    style={[styles.dot, d <= featuredSong.difficulty && styles.dotActive]}
                  />
                ))}
              </View>
            </View>
          </PressableScale>
        )}

        {/* Browse CTA */}
        <PressableScale haptic onPress={onBrowse} testID="music-library-browse">
          <View style={styles.browseBtn}>
            <Text style={styles.browseText}>Browse Library</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color={COLORS.primary} />
          </View>
        </PressableScale>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...SHADOWS.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glowColor(COLORS.primary, 0.3),
  },
  gradient: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  headerTitle: {
    ...TYPOGRAPHY.heading.md,
    color: COLORS.textPrimary,
    flex: 1,
  },
  statPills: {
    flexDirection: 'row',
    gap: 6,
  },
  pill: {
    backgroundColor: glowColor(COLORS.primary, 0.15),
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  pillText: {
    ...TYPOGRAPHY.caption.sm,
    color: COLORS.primary,
    fontWeight: '600' as const,
  },
  featuredCard: {
    marginBottom: SPACING.sm,
  },
  featured: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: glowColor(COLORS.textPrimary, 0.05),
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  featuredIcon: {
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
    fontWeight: '700' as const,
    color: COLORS.textPrimary,
  },
  featuredArtist: {
    ...TYPOGRAPHY.caption.lg,
    color: COLORS.textSecondary,
  },
  genreBadge: {
    backgroundColor: glowColor(COLORS.info, 0.15),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  genreText: {
    ...TYPOGRAPHY.caption.sm,
    color: COLORS.info,
    fontWeight: '600' as const,
  },
  difficultyDots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: glowColor(COLORS.textMuted, 0.3),
  },
  dotActive: {
    backgroundColor: COLORS.starGold,
  },
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: glowColor(COLORS.primary, 0.12),
    borderWidth: 1,
    borderColor: glowColor(COLORS.primary, 0.25),
  },
  browseText: {
    ...TYPOGRAPHY.button.md,
    color: COLORS.primary,
  },
});
```

**Step 4: Run tests**

Run: `npx jest src/components/__tests__/MusicLibrarySpotlight.test.tsx -v`

**Step 5: Commit**

```bash
git add src/components/MusicLibrarySpotlight.tsx src/components/__tests__/MusicLibrarySpotlight.test.tsx
git commit -m "feat: add MusicLibrarySpotlight card for HomeScreen

Prominent gradient card showing 124 songs, 6 genres, featured song with play button,
and Browse Library CTA. Highlights the Music Library as a key app feature.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Redesign HomeScreen (Feed-Style Layout)

**Problem:** Current HomeScreen buries Continue Learning below Salsa, daily rewards, and daily challenge. Music Library has zero presence.

**Files:**
- Modify: `src/screens/HomeScreen.tsx` (full rewrite of JSX/layout, keep all hooks)
- Reference: `src/components/MusicLibrarySpotlight.tsx` (Task 3)
- Reference: `src/components/ReviewChallengeCard.tsx` (Task 2)
- Reference: `src/stores/songStore.ts` (for song count)
- Reference: `src/stores/learnerProfileStore.ts` (for decayed skills)

**Step 1: Add imports for new components**

At top of HomeScreen.tsx, add:
```typescript
import { MusicLibrarySpotlight } from '../components/MusicLibrarySpotlight';
import { ReviewChallengeCard } from '../components/ReviewChallengeCard';
import { useSongStore } from '../stores/songStore';
```

**Step 2: Add hooks for song data and decayed skills**

Inside the component, after existing hooks:
```typescript
// Song library data
const songSummaries = useSongStore((s) => s.summaries);
const totalSongs = songSummaries.length || 124; // Fallback to known count
const genres = useMemo(() => {
  const genreSet = new Set(songSummaries.map(s => s.genre));
  return genreSet.size || 6;
}, [songSummaries]);
const featuredSong = useMemo(() => {
  if (songSummaries.length === 0) return null;
  // Pick a pseudo-random song based on day-of-year
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const idx = dayOfYear % songSummaries.length;
  const s = songSummaries[idx];
  return { title: s.title, artist: s.artist, genre: s.genre, difficulty: s.difficulty };
}, [songSummaries]);

// Decayed skills for review card
const decayedSkills = useLearnerProfileStore((s) => s.calculateDecayedSkills());
```

**Step 3: Rewrite JSX layout (feed-style order)**

Replace the ScrollView content with this order:
1. Hero section (compact — same as current but keep it)
2. Music Library Spotlight card (NEW)
3. Continue Learning card (existing, moved up)
4. Review Challenge card (NEW, conditional)
5. Salsa coach (existing, compact)
6. Daily Challenge card (existing)
7. Stats row (existing)
8. Quick Actions grid (modified — replace Practice with Songs)

Key JSX changes:
- Move Music Library Spotlight right after hero (stagger index 1)
- Move Continue Learning to stagger index 2
- Add ReviewChallengeCard at stagger index 3 (conditional)
- Move DailyRewardCalendar to Profile tab (remove from HomeScreen)
- Remove WeeklyChallengeCard and MonthlyChallengeCard from HomeScreen (fold into daily)
- Change Quick Actions: "Practice" → "Songs" with `music-note-sixteenth-dotted` icon, navigates to Songs tab

**Step 4: Update Quick Actions grid**

```typescript
<ActionCard
  icon="music-note-sixteenth-dotted"
  label="Songs"
  gradient={[COLORS.primaryDark, COLORS.cardSurface]}
  onPress={() => navigation.navigate('MainTabs', { screen: 'Songs' } as any)}
/>
```

**Step 5: Run typecheck and tests**

Run: `npx tsc --noEmit && npx jest src/screens/__tests__/HomeScreen.test.tsx -v`

**Step 6: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: redesign HomeScreen with Music Library spotlight and feed-style layout

Music Library card is now the most prominent element after the hero section.
Continue Learning moved up. Review Challenge card shows when skills decay.
Quick Actions: Practice replaced with Songs to drive library engagement.
Daily Reward Calendar moved to Profile tab.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Redesign Free Play (Portrait + Split Keyboard + Song Reference)

**Problem:** Free Play is landscape-only, has no music sheet reference, and no two-hand split. UI looks unpolished.

**Files:**
- Modify: `src/screens/PlayScreen.tsx` (heavy rewrite)
- Reference: `src/components/Keyboard/SplitKeyboard.tsx` (already exists)
- Reference: `src/stores/songStore.ts` (for song picker)
- Create: `src/components/SongReferencePicker.tsx` (song picker modal)

**Step 1: Create SongReferencePicker modal**

```typescript
// src/components/SongReferencePicker.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PressableScale } from './common/PressableScale';
import { useSongStore } from '../stores/songStore';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS } from '../theme/tokens';

interface SongReferencePickerProps {
  visible: boolean;
  onSelect: (songId: string, songTitle: string) => void;
  onClose: () => void;
}

export function SongReferencePicker({ visible, onSelect, onClose }: SongReferencePickerProps) {
  const summaries = useSongStore((s) => s.summaries);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return summaries.slice(0, 30);
    const q = search.toLowerCase();
    return summaries.filter(s =>
      s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [summaries, search]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Load Song Reference</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search songs..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PressableScale onPress={() => onSelect(item.id, item.title)}>
                <View style={styles.songRow}>
                  <View style={styles.songInfo}>
                    <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.songArtist} numberOfLines={1}>{item.artist} • {item.genre}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.textMuted} />
                </View>
              </PressableScale>
            )}
            ListEmptyComponent={<Text style={styles.empty}>No songs found</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
    maxHeight: '70%',
    padding: SPACING.md,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  title: { ...TYPOGRAPHY.heading.md, color: COLORS.textPrimary },
  searchInput: {
    ...TYPOGRAPHY.body.md,
    backgroundColor: COLORS.cardSurface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  songInfo: { flex: 1 },
  songTitle: { ...TYPOGRAPHY.body.md, color: COLORS.textPrimary, fontWeight: '600' as const },
  songArtist: { ...TYPOGRAPHY.caption.lg, color: COLORS.textSecondary },
  empty: { ...TYPOGRAPHY.body.md, color: COLORS.textMuted, textAlign: 'center', padding: SPACING.lg },
});
```

**Step 2: Rewrite PlayScreen to portrait mode**

Key changes to `src/screens/PlayScreen.tsx`:
1. **Remove landscape lock** — delete the entire `ScreenOrientation.lockPlatformAsync` useEffect
2. **Remove `expo-screen-orientation` import**
3. **Replace single Keyboard with SplitKeyboard** from `src/components/Keyboard/SplitKeyboard.tsx`
4. **Add song reference panel** — top area showing loaded song note names
5. **Move controls to floating action bar** at bottom
6. **Add "Load Song" button** in header that opens SongReferencePicker

Layout structure:
```
SafeAreaView (portrait)
├── Header (back, title, input badge, "Load Song" button)
├── Song Reference Panel (40% height if song loaded, note names scrolling)
│   OR Note Display (compact, when no song loaded)
├── SplitKeyboard (flex: 1)
│   ├── Right Hand (C4-C6)
│   └── Left Hand (C2-C4)
└── Floating Action Bar (record/play/clear + stats)
```

**Step 3: Run typecheck**

Run: `npx tsc --noEmit`

**Step 4: Run tests**

Run: `npx jest --silent 2>&1 | tail -5`

**Step 5: Commit**

```bash
git add src/screens/PlayScreen.tsx src/components/SongReferencePicker.tsx
git commit -m "feat: redesign Free Play — portrait mode, split keyboard, song reference

Removed landscape lock. Added SplitKeyboard for two-hand play. Song reference
panel loads any song from library as a visual note guide. Floating action bar
for record/play/clear controls. Much more polished UI.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Update All Documentation

**Files:**
- Modify: `docs/plans/2026-02-13-master-plan.md`
- Modify: `CLAUDE.md`
- Modify: `agent_docs/stabilization-report.md`

**Step 1: Update master plan**

Changes to master plan:
1. Update "Last Updated" to February 27, 2026
2. Update "Codebase Health" test counts (after new tests are added)
3. Update Phase 8 section to mention polyphonic completion (Feb 26)
4. Add new section: "Phase 9.5: UX Overhaul" with this work's summary
5. Update execution priority to show Phase 9.5 as DONE
6. Update timeline
7. Integrate references to recent design docs:
   - `2026-02-26-phase8-completion-design.md`
   - `2026-02-26-phase8-polyphonic-implementation.md`
   - `2026-02-27-ux-overhaul-design.md`
   - `2026-02-27-ux-overhaul-implementation.md`

**Step 2: Update CLAUDE.md**

Changes:
1. Update "Codebase Health" line with new test counts
2. Update "Current Sprint" section
3. Update Phase 8 status to include polyphonic
4. Add Phase 9.5 to active roadmap
5. Add new files to "Key Files" table:
   - `src/components/MusicLibrarySpotlight.tsx`
   - `src/components/ReviewChallengeCard.tsx`
   - `src/components/SongReferencePicker.tsx`
6. Update PlayScreen description (portrait, split keyboard)

**Step 3: Update stabilization report**

Add new section at end:
```markdown
### Phase 9.5: UX Overhaul (Feb 27)
- **Assessment fix:** Seed ALL prerequisite skills for determined start lesson (was only seeding 3 basic skills)
- **Mastery tests surfaced:** Test exercises already existed in all 6 lessons but button wasn't visible — now prominent in CompletionModal
- **HomeScreen redesign:** Feed-style with Music Library spotlight card, Review Challenge card, Songs in Quick Actions
- **Free Play redesign:** Portrait mode, SplitKeyboard, song reference panel from library
- **Docs:** Master plan, CLAUDE.md, stabilization report all updated
```

**Step 4: Commit**

```bash
git add docs/plans/2026-02-13-master-plan.md CLAUDE.md agent_docs/stabilization-report.md
git commit -m "docs: update master plan, CLAUDE.md, stabilization report for UX overhaul

Integrated Phase 8 polyphonic completion + Phase 9.5 UX overhaul. Updated test
counts, execution priority, timeline, key files table. All docs now current.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Final Verification

**Step 1: Run full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 2: Run full test suite**

Run: `npx jest --silent 2>&1 | tail -10`
Expected: All suites pass, 0 failures

**Step 3: Verify on simulator**

Run: `npx expo start --ios`
Manual checks:
- [ ] HomeScreen shows Music Library Spotlight card prominently
- [ ] Continue Learning shows correct lesson (matching assessment)
- [ ] Quick Actions has "Songs" instead of "Practice"
- [ ] Free Play opens in portrait mode
- [ ] Free Play has split keyboard (left + right hand)
- [ ] Free Play "Load Song" opens picker
- [ ] LevelMap shows correct tier as current after assessment
- [ ] Mastery test button appears in CompletionModal after all exercises done

**Step 4: Final commit (if any fixes needed)**

---

## Summary

| Task | Files | Type |
|------|-------|------|
| 1. Fix assessment seeding | SkillAssessmentScreen.tsx + test | Bug fix |
| 2. Review Challenge Card | New component + test | New feature |
| 3. Music Library Spotlight | New component + test | New feature |
| 4. HomeScreen redesign | HomeScreen.tsx rewrite | Redesign |
| 5. Free Play redesign | PlayScreen.tsx rewrite + SongReferencePicker | Redesign |
| 6. Docs update | master-plan.md, CLAUDE.md, stabilization-report.md | Docs |
| 7. Final verification | Typecheck + tests + simulator | QA |
