/**
 * Song Mastery Calculation Tests
 */

import {
  computeMasteryTier,
  updateSongMastery,
  isBetterTier,
  gemRewardForTier,
  masteryLabel,
  masteryColor,
} from '../songMastery';
import type { SongMastery } from '../songTypes';

const SECTIONS = ['verse-1', 'chorus', 'verse-2'];

describe('computeMasteryTier', () => {
  it('returns none when no sections played', () => {
    expect(computeMasteryTier({}, SECTIONS, 'melody')).toBe('none');
  });

  it('returns none when not all sections played', () => {
    expect(
      computeMasteryTier({ 'verse-1': 90, chorus: 85 }, SECTIONS, 'melody'),
    ).toBe('none');
  });

  it('returns bronze when all sections >= 70 on melody', () => {
    expect(
      computeMasteryTier(
        { 'verse-1': 75, chorus: 70, 'verse-2': 80 },
        SECTIONS,
        'melody',
      ),
    ).toBe('bronze');
  });

  it('returns none when any section below 70', () => {
    expect(
      computeMasteryTier(
        { 'verse-1': 90, chorus: 65, 'verse-2': 95 },
        SECTIONS,
        'melody',
      ),
    ).toBe('none');
  });

  it('returns silver when all sections >= 80 on melody', () => {
    expect(
      computeMasteryTier(
        { 'verse-1': 85, chorus: 80, 'verse-2': 90 },
        SECTIONS,
        'melody',
      ),
    ).toBe('silver');
  });

  it('returns silver (not gold) when all >= 90 but on melody layer', () => {
    // Gold requires full layer
    expect(
      computeMasteryTier(
        { 'verse-1': 95, chorus: 92, 'verse-2': 90 },
        SECTIONS,
        'melody',
      ),
    ).toBe('silver');
  });

  it('returns gold when all sections >= 90 on full layer', () => {
    expect(
      computeMasteryTier(
        { 'verse-1': 92, chorus: 90, 'verse-2': 94 },
        SECTIONS,
        'full',
      ),
    ).toBe('gold');
  });

  it('returns platinum only when all sections >= 95 on full layer', () => {
    expect(
      computeMasteryTier(
        { 'verse-1': 98, chorus: 95, 'verse-2': 97 },
        SECTIONS,
        'full',
      ),
    ).toBe('platinum');
  });

  it('returns gold when one section is 94 (below platinum threshold)', () => {
    expect(
      computeMasteryTier(
        { 'verse-1': 98, chorus: 94, 'verse-2': 97 },
        SECTIONS,
        'full',
      ),
    ).toBe('gold');
  });

  it('returns none for empty sectionIds', () => {
    expect(computeMasteryTier({ a: 100 }, [], 'full')).toBe('none');
  });
});

describe('updateSongMastery', () => {
  it('creates new mastery from null', () => {
    const result = updateSongMastery(
      null,
      'song-1',
      'user-1',
      { 'verse-1': 75, chorus: 72, 'verse-2': 80 },
      SECTIONS,
      'melody',
    );

    expect(result.songId).toBe('song-1');
    expect(result.userId).toBe('user-1');
    expect(result.tier).toBe('bronze');
    expect(result.totalAttempts).toBe(1);
    expect(result.sectionScores['verse-1']).toBe(75);
  });

  it('keeps higher per-section scores across calls', () => {
    const first: SongMastery = {
      songId: 'song-1',
      userId: 'user-1',
      tier: 'bronze',
      sectionScores: { 'verse-1': 75, chorus: 80, 'verse-2': 70 },
      lastPlayed: 1000,
      totalAttempts: 1,
    };

    const result = updateSongMastery(
      first,
      'song-1',
      'user-1',
      { 'verse-1': 60, chorus: 90, 'verse-2': 85 }, // verse-1 worse, others better
      SECTIONS,
      'melody',
    );

    expect(result.sectionScores['verse-1']).toBe(75); // kept higher
    expect(result.sectionScores['chorus']).toBe(90); // improved
    expect(result.sectionScores['verse-2']).toBe(85); // improved
    expect(result.totalAttempts).toBe(2);
  });

  it('recalculates tier after merge', () => {
    const first: SongMastery = {
      songId: 'song-1',
      userId: 'user-1',
      tier: 'none',
      sectionScores: { 'verse-1': 90, chorus: 60 },
      lastPlayed: 1000,
      totalAttempts: 1,
    };

    // Improve chorus to unlock bronze
    const result = updateSongMastery(
      first,
      'song-1',
      'user-1',
      { chorus: 75, 'verse-2': 80 },
      SECTIONS,
      'melody',
    );

    expect(result.tier).toBe('bronze'); // now all >= 70
  });
});

describe('isBetterTier', () => {
  it('platinum > gold > silver > bronze > none', () => {
    expect(isBetterTier('platinum', 'gold')).toBe(true);
    expect(isBetterTier('gold', 'silver')).toBe(true);
    expect(isBetterTier('silver', 'bronze')).toBe(true);
    expect(isBetterTier('bronze', 'none')).toBe(true);
  });

  it('returns false for same tier', () => {
    expect(isBetterTier('gold', 'gold')).toBe(false);
  });

  it('returns false for worse tier', () => {
    expect(isBetterTier('bronze', 'silver')).toBe(false);
  });
});

describe('gemRewardForTier', () => {
  it('returns correct amounts', () => {
    expect(gemRewardForTier('none')).toBe(0);
    expect(gemRewardForTier('bronze')).toBe(10);
    expect(gemRewardForTier('silver')).toBe(20);
    expect(gemRewardForTier('gold')).toBe(40);
    expect(gemRewardForTier('platinum')).toBe(75);
  });
});

describe('masteryLabel', () => {
  it('returns human-readable strings', () => {
    expect(masteryLabel('none')).toBe('Unmastered');
    expect(masteryLabel('bronze')).toBe('Bronze');
    expect(masteryLabel('platinum')).toBe('Platinum');
  });
});

describe('masteryColor', () => {
  it('returns distinct colors for each tier', () => {
    const colors = new Set([
      masteryColor('none'),
      masteryColor('bronze'),
      masteryColor('silver'),
      masteryColor('gold'),
      masteryColor('platinum'),
    ]);
    expect(colors.size).toBe(5);
  });
});
