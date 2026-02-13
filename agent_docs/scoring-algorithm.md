# Scoring Algorithm Documentation

## Overview

The scoring system evaluates user performance across four dimensions:
1. **Accuracy** (40%) - Did you play the right notes?
2. **Timing** (35%) - Did you play them at the right time?
3. **Completeness** (15%) - Did you play all the notes?
4. **Precision** (10%) - Penalty for extra notes

## Core Types

```typescript
interface NoteScore {
  expected: NoteEvent;
  played: PlayedNote | null;
  isCorrectPitch: boolean;
  timingOffsetMs: number;
  timingScore: number;
  status: 'perfect' | 'good' | 'ok' | 'early' | 'late' | 'missed' | 'wrong';
}

interface ExerciseScore {
  overall: number;
  stars: 0 | 1 | 2 | 3;
  breakdown: {
    accuracy: number;
    timing: number;
    completeness: number;
    precision: number;
  };
  details: NoteScore[];
  perfectNotes: number;
  goodNotes: number;
  missedNotes: number;
  extraNotes: number;
  xpEarned: number;
  isNewHighScore: boolean;
  isPassed: boolean;
}
```

## Timing Score Curve

```
Score
100 |████████
    |        ████
 70 |            ████████
    |                    ████
 40 |                        ████████
    |                                ████
  0 |____________________________________████████
    0   25   75       150           300        ms
        ↑    ↑         ↑             ↑
     perfect good      ok         missed
```

## Timing Score Calculation

```typescript
export function calculateTimingScore(offsetMs: number): { score: number; status: string } {
  const absOffset = Math.abs(offsetMs);
  
  if (absOffset <= 25) return { score: 100, status: 'perfect' };
  if (absOffset <= 75) return { score: 100 - ((absOffset - 25) / 50) * 30, status: 'good' };
  if (absOffset <= 150) return { score: 70 - ((absOffset - 75) / 75) * 30, status: 'ok' };
  if (absOffset <= 300) return { score: 40 * Math.exp(-(absOffset - 150) / 75), status: offsetMs < 0 ? 'early' : 'late' };
  return { score: 0, status: 'missed' };
}
```

## Final Score Aggregation

```typescript
const WEIGHTS = { accuracy: 0.40, timing: 0.35, completeness: 0.15, precision: 0.10 };

overall = accuracy * 0.40 + timing * 0.35 + completeness * 0.15 + precision * 0.10
```

## Star Thresholds

| Stars | Default Threshold |
|-------|------------------|
| ⭐ | 70% |
| ⭐⭐ | 85% |
| ⭐⭐⭐ | 95% |

## XP Rewards

| Achievement | XP |
|-------------|-----|
| Pass exercise | 10 |
| Per star | 10 |
| First completion | 25 |
| Perfect (95%+) | 20 |

## Difficulty Adjustments

| Difficulty | Perfect (ms) | Good (ms) | Pass Score |
|------------|--------------|-----------|------------|
| 1 Beginner | 75 | 200 | 60 |
| 2 Easy | 50 | 150 | 65 |
| 3 Medium | 40 | 125 | 70 |
| 4 Hard | 30 | 100 | 75 |
| 5 Expert | 20 | 75 | 80 |

## Note Matching

### Scoring Engine (`ExerciseValidator.matchNotes`)
- Match window: ±1.5 beats (tempo-relative) — wide enough to always find the nearest note
- Played note timestamps must be **relative to beat 0** (ms since exercise start, NOT epoch)
- `useExercisePlayback.handleCompletion` converts epoch timestamps before scoring:
  `adjustedTimestamp = Date.now() - startTimeRef - countInMs`

### Visual Feedback (`ExercisePlayer.handleKeyDown`)
- Uses **nearest-note matching** (not window-based)
- Search radius: ±1.5 beats
- Tracks consumed note indices to prevent double-counting
- Independent from the scoring engine — provides real-time feedback during playback
