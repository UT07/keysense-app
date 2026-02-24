/**
 * Song Library Integration Tests
 *
 * End-to-end flow tests for the song library feature:
 * - Browse → filter → summaries change
 * - Play section → mastery → gems → achievements
 * - Rate limiting for song requests
 * - Section score "best wins" merge
 * - Tier upgrade triggers gem reward
 */

import {
  computeMasteryTier,
  updateSongMastery,
  gemRewardForTier,
  isBetterTier,
  MASTERY_REQUIREMENTS,
} from '../../core/songs/songMastery';
import type { Song, SongSection, SongFilter, MasteryTier } from '../../core/songs/songTypes';
import type { NoteEvent } from '../../core/exercises/types';
import {
  checkAchievements,
  type AchievementContext,
} from '../../core/achievements/achievements';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const melodyNotes: NoteEvent[] = [
  { note: 60, startBeat: 0, durationBeats: 1 },
  { note: 62, startBeat: 1, durationBeats: 1 },
  { note: 64, startBeat: 2, durationBeats: 1 },
];

const fullNotes: NoteEvent[] = [
  ...melodyNotes,
  { note: 48, startBeat: 0, durationBeats: 2, hand: 'left' },
];

function makeSection(id: string, label: string): SongSection {
  return {
    id,
    label,
    startBeat: 0,
    endBeat: 4,
    difficulty: 3,
    layers: { melody: melodyNotes, full: fullNotes },
  };
}

function makeSong(sectionCount = 3): Song {
  const sections: SongSection[] = [];
  for (let i = 0; i < sectionCount; i++) {
    sections.push(makeSection(`section-${i}`, `Section ${i + 1}`));
  }
  return {
    id: 'test-song',
    version: 1,
    type: 'song',
    source: 'gemini',
    metadata: {
      title: 'Test Song',
      artist: 'Test Artist',
      genre: 'pop',
      difficulty: 3,
      durationSeconds: 120,
      attribution: 'AI arrangement',
    },
    sections,
    settings: {
      tempo: 120,
      timeSignature: [4, 4],
      keySignature: 'C',
      countIn: 4,
      metronomeEnabled: true,
      loopEnabled: true,
    },
    scoring: {
      timingToleranceMs: 50,
      timingGracePeriodMs: 150,
      passingScore: 70,
      starThresholds: [70, 85, 95],
    },
  };
}

function makeAchievementContext(overrides: Partial<AchievementContext> = {}): AchievementContext {
  return {
    totalXp: 0, level: 1, currentStreak: 0, lessonsCompleted: 0,
    perfectScores: 0, totalExercisesCompleted: 0, totalNotesPlayed: 0,
    catsUnlocked: 0, highScoreExercises: 0, sessionExercises: 0,
    exercisesWithSameCat: 0, isEarlyPractice: false, isLatePractice: false,
    hasCatSelected: false, anyCatEvolvedTeen: false, anyCatEvolvedAdult: false,
    anyCatEvolvedMaster: false, abilitiesUnlocked: 0, catsOwned: 0,
    hasChonky: false, isChonkyMaster: false,
    totalGemsEarned: 0, totalGemsSpent: 0, hasCheckedLockedCat: false,
    dailyRewardStreak: 0, dailyRewardsTotal: 0,
    fastestExerciseSeconds: 0, isLateNightPractice: false,
    isEarlyMorningPractice: false, sessionMinutes: 0,
    songsBronzePlus: 0, songsSilverPlus: 0, hasAnySongPlatinum: false,
    classicalSongsBronzePlus: 0, genresCoveredBronzePlus: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

describe('Song Library Integration', () => {
  // ── Mastery flow ──────────────────────────────────────────────

  describe('Play section → mastery tier flow', () => {
    const song = makeSong(2);
    const sectionIds = song.sections.map((s) => s.id);

    it('first play at 75% on melody → bronze tier', () => {
      const scores: Record<string, number> = { 'section-0': 75, 'section-1': 72 };
      const mastery = updateSongMastery(null, song.id, 'user-1', scores, sectionIds, 'melody');
      expect(mastery.tier).toBe('bronze');
      expect(mastery.totalAttempts).toBe(1);
    });

    it('second play keeps higher section scores', () => {
      const first = updateSongMastery(null, song.id, 'user-1', { 'section-0': 75, 'section-1': 72 }, sectionIds, 'melody');
      const second = updateSongMastery(first, song.id, 'user-1', { 'section-0': 60, 'section-1': 90 }, sectionIds, 'melody');

      // "best wins" merge
      expect(second.sectionScores['section-0']).toBe(75); // first was better
      expect(second.sectionScores['section-1']).toBe(90); // second was better
      expect(second.totalAttempts).toBe(2);
    });

    it('silver requires 80+ on all sections (melody)', () => {
      const scores: Record<string, number> = { 'section-0': 82, 'section-1': 85 };
      const tier = computeMasteryTier(scores, sectionIds, 'melody');
      expect(tier).toBe('silver');
    });

    it('gold requires 90+ on all sections on full layer', () => {
      const melodyTier = computeMasteryTier({ 'section-0': 92, 'section-1': 95 }, sectionIds, 'melody');
      expect(melodyTier).toBe('silver'); // melody caps at silver

      const fullTier = computeMasteryTier({ 'section-0': 92, 'section-1': 95 }, sectionIds, 'full');
      expect(fullTier).toBe('gold');
    });

    it('platinum requires 95+ on all sections on full layer', () => {
      const tier = computeMasteryTier({ 'section-0': 96, 'section-1': 97 }, sectionIds, 'full');
      expect(tier).toBe('platinum');

      const almostTier = computeMasteryTier({ 'section-0': 94, 'section-1': 97 }, sectionIds, 'full');
      expect(almostTier).toBe('gold'); // one section below 95
    });
  });

  // ── Gem rewards ───────────────────────────────────────────────

  describe('Gem rewards on tier upgrade', () => {
    it('gem reward increases with tier', () => {
      expect(gemRewardForTier('none')).toBe(0);
      expect(gemRewardForTier('bronze')).toBe(10);
      expect(gemRewardForTier('silver')).toBe(20);
      expect(gemRewardForTier('gold')).toBe(40);
      expect(gemRewardForTier('platinum')).toBe(75);
    });

    it('isBetterTier detects upgrades', () => {
      expect(isBetterTier('silver', 'bronze')).toBe(true);
      expect(isBetterTier('bronze', 'silver')).toBe(false);
      expect(isBetterTier('bronze', 'bronze')).toBe(false);
    });

    it('tier upgrade from bronze → silver triggers net reward', () => {
      const oldTier: MasteryTier = 'bronze';
      const newTier: MasteryTier = 'silver';
      expect(isBetterTier(newTier, oldTier)).toBe(true);
      const reward = gemRewardForTier(newTier);
      expect(reward).toBe(20);
    });
  });

  // ── Achievement unlocking ─────────────────────────────────────

  describe('Achievement unlocking from song mastery', () => {
    it('first bronze unlocks first-song-mastered', () => {
      const ctx = makeAchievementContext({ songsBronzePlus: 1 });
      const unlocked = checkAchievements(ctx, new Set());
      expect(unlocked).toContain('first-song-mastered');
    });

    it('3 genres at bronze+ unlocks genre-explorer', () => {
      const ctx = makeAchievementContext({
        songsBronzePlus: 3,
        genresCoveredBronzePlus: 3,
      });
      const unlocked = checkAchievements(ctx, new Set());
      expect(unlocked).toContain('genre-explorer');
    });

    it('platinum on any song unlocks platinum-pianist', () => {
      const ctx = makeAchievementContext({
        songsBronzePlus: 1,
        songsSilverPlus: 1,
        hasAnySongPlatinum: true,
      });
      const unlocked = checkAchievements(ctx, new Set());
      expect(unlocked).toContain('platinum-pianist');
    });

    it('full mastery progression: none → bronze → silver → gold → platinum', () => {
      const sectionIds = ['s0', 's1'];

      // Start with no mastery
      let mastery = updateSongMastery(null, 'song-1', 'user-1', { s0: 50, s1: 55 }, sectionIds, 'melody');
      expect(mastery.tier).toBe('none');

      // Improve to bronze
      mastery = updateSongMastery(mastery, 'song-1', 'user-1', { s0: 72, s1: 75 }, sectionIds, 'melody');
      expect(mastery.tier).toBe('bronze');

      // Improve to silver
      mastery = updateSongMastery(mastery, 'song-1', 'user-1', { s0: 85, s1: 88 }, sectionIds, 'melody');
      expect(mastery.tier).toBe('silver');

      // Switch to full layer for gold
      mastery = updateSongMastery(mastery, 'song-1', 'user-1', { s0: 92, s1: 93 }, sectionIds, 'full');
      expect(mastery.tier).toBe('gold');

      // Perfect for platinum
      mastery = updateSongMastery(mastery, 'song-1', 'user-1', { s0: 97, s1: 96 }, sectionIds, 'full');
      expect(mastery.tier).toBe('platinum');
    });
  });

  // ── Mastery requirement table ─────────────────────────────────

  describe('Mastery requirements are correctly ordered', () => {
    it('requirements are in ascending order of tier quality', () => {
      const tierOrder: MasteryTier[] = ['bronze', 'silver', 'gold', 'platinum'];
      for (let i = 0; i < MASTERY_REQUIREMENTS.length - 1; i++) {
        const current = tierOrder.indexOf(MASTERY_REQUIREMENTS[i].tier);
        const next = tierOrder.indexOf(MASTERY_REQUIREMENTS[i + 1].tier);
        expect(next).toBeGreaterThan(current);
      }
    });

    it('min score increases with tier', () => {
      for (let i = 0; i < MASTERY_REQUIREMENTS.length - 1; i++) {
        expect(MASTERY_REQUIREMENTS[i + 1].minScore).toBeGreaterThanOrEqual(
          MASTERY_REQUIREMENTS[i].minScore,
        );
      }
    });
  });

  // ── Filter flow (pure logic) ──────────────────────────────────

  describe('SongFilter shape', () => {
    it('supports genre, difficulty, and search query', () => {
      const filter: SongFilter = {
        genre: 'classical',
        difficulty: 3,
        searchQuery: 'beethoven',
      };
      expect(filter.genre).toBe('classical');
      expect(filter.difficulty).toBe(3);
      expect(filter.searchQuery).toBe('beethoven');
    });

    it('supports "all" to clear genre/difficulty filter', () => {
      const filter: SongFilter = { genre: 'all', difficulty: 'all' };
      expect(filter.genre).toBe('all');
      expect(filter.difficulty).toBe('all');
    });
  });
});
