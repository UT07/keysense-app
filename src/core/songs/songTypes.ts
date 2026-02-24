/**
 * Song type definitions for the Music Library
 * Pure TypeScript — no React imports
 */

import type { NoteEvent, ExerciseSettings, ExerciseScoringConfig } from '@/core/exercises/types';

// ---------------------------------------------------------------------------
// Enums / Literals
// ---------------------------------------------------------------------------

export type SongGenre = 'classical' | 'pop' | 'film' | 'folk' | 'game' | 'holiday';
export type SongSource = 'pdmx' | 'thesession' | 'gemini';
export type MasteryTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';
export type SongLayer = 'melody' | 'full';

// ---------------------------------------------------------------------------
// Core Song Types
// ---------------------------------------------------------------------------

export interface SongMetadata {
  title: string;
  artist: string;
  genre: SongGenre;
  difficulty: 1 | 2 | 3 | 4 | 5;
  durationSeconds: number;
  attribution: string;
}

export interface SongSection {
  id: string; // e.g. "verse-1", "chorus"
  label: string;
  startBeat: number;
  endBeat: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  layers: {
    melody: NoteEvent[];
    accompaniment?: NoteEvent[];
    full: NoteEvent[];
  };
}

export interface Song {
  id: string;
  version: number;
  type: 'song';
  source: SongSource;
  metadata: SongMetadata;
  sections: SongSection[];
  settings: ExerciseSettings;
  scoring: ExerciseScoringConfig;
}

// ---------------------------------------------------------------------------
// Mastery
// ---------------------------------------------------------------------------

export interface SongMastery {
  songId: string;
  userId: string;
  tier: MasteryTier;
  sectionScores: Record<string, number>; // sectionId → best score (0-100)
  lastPlayed: number; // epoch ms
  totalAttempts: number;
}

// ---------------------------------------------------------------------------
// List / Browse helpers
// ---------------------------------------------------------------------------

/** Lightweight entry for list display (no sections array). */
export interface SongSummary {
  id: string;
  metadata: SongMetadata;
  settings: Pick<ExerciseSettings, 'tempo' | 'timeSignature' | 'keySignature'>;
  sectionCount: number;
}

export interface SongFilter {
  genre?: SongGenre | 'all';
  difficulty?: number | 'all';
  hand?: SongLayer | 'all';
  searchQuery?: string;
}

// ---------------------------------------------------------------------------
// Song Request (user-initiated generation)
// ---------------------------------------------------------------------------

export interface SongRequestParams {
  title: string;
  artist?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
}
