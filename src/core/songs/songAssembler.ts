/**
 * Song Assembler — Pure functions for song generation
 *
 * Contains prompt building, validation, and assembly logic without
 * any Firebase/service dependencies. Used by:
 * - songGenerationService.ts (runtime Gemini + Firebase save)
 * - scripts/generate-songs.ts (batch generation to JSON)
 *
 * Pure TypeScript — no React or Firebase imports.
 */

import { parseABC } from '@/core/songs/abcParser';
import type { Song, SongSection, SongRequestParams, SongSource } from '@/core/songs/songTypes';
import type { NoteEvent } from '@/core/exercises/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratedSongABC {
  title: string;
  artist: string;
  genre: string;
  difficulty: number;
  attribution: string;
  sections: Array<{
    label: string;
    melodyABC: string;
    accompanimentABC?: string;
  }>;
  tempo: number;
  key: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateGeneratedSong(raw: unknown): raw is GeneratedSongABC {
  if (raw === null || raw === undefined || typeof raw !== 'object') return false;

  const obj = raw as Record<string, unknown>;

  if (typeof obj.title !== 'string' || obj.title.length === 0) return false;
  if (typeof obj.artist !== 'string') return false;
  if (typeof obj.genre !== 'string') return false;
  if (typeof obj.difficulty !== 'number' || obj.difficulty < 1 || obj.difficulty > 5) return false;
  if (typeof obj.attribution !== 'string') return false;
  if (typeof obj.tempo !== 'number' || obj.tempo < 30 || obj.tempo > 240) return false;
  if (typeof obj.key !== 'string') return false;

  if (!Array.isArray(obj.sections) || obj.sections.length === 0) return false;

  for (const section of obj.sections) {
    if (typeof section !== 'object' || section === null || section === undefined) return false;
    const s = section as Record<string, unknown>;
    if (typeof s.label !== 'string' || s.label.length === 0) return false;
    if (typeof s.melodyABC !== 'string' || s.melodyABC.length === 0) return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildSongPrompt(params: SongRequestParams): string {
  const artistHint = params.artist ? ` by ${params.artist}` : '';

  return `Generate a simplified beginner piano arrangement of "${params.title}"${artistHint}.

Return JSON with this exact structure:
{
  "title": "Song Title",
  "artist": "Original Artist",
  "genre": "pop|classical|folk|film|game|holiday",
  "difficulty": ${params.difficulty},
  "attribution": "AI arrangement — simplified for learning",
  "tempo": <BPM 60-160>,
  "key": "<key signature letter, e.g. C, G, F, Am>",
  "sections": [
    {
      "label": "Verse 1",
      "melodyABC": "X:1\\nT:Verse 1\\nM:4/4\\nL:1/8\\nK:C\\n<ABC notes here>|",
      "accompanimentABC": "X:1\\nT:Verse 1 LH\\nM:4/4\\nL:1/4\\nK:C\\n<optional LH notes>|"
    }
  ]
}

RULES:
- Each section's melodyABC must be complete, valid ABC notation with X:, T:, M:, L:, K: headers
- Keep MIDI range 48-84 (C3 to C6)
- Melody should be right hand, mostly stepwise motion
- Accompaniment (optional) should be left hand, simple chords or bass notes
- Split into 2-4 sections (verse, chorus, bridge, etc.)
- Each section should be 4-16 bars
- Difficulty ${params.difficulty}/5: ${difficultyGuide(params.difficulty)}
- Use common time signatures (4/4 or 3/4)
- For well-known songs, preserve the recognizable melody
- Attribution must always say "AI arrangement"`;
}

function difficultyGuide(d: number): string {
  switch (d) {
    case 1: return 'whole/half notes only, C major, very slow';
    case 2: return 'quarter notes, C/G major, simple rhythms';
    case 3: return 'eighth notes OK, any major key, moderate tempo';
    case 4: return 'sixteenth notes, minor keys OK, faster tempo';
    case 5: return 'complex rhythms, any key, performance tempo';
    default: return 'moderate difficulty';
  }
}

// ---------------------------------------------------------------------------
// Assembly: GeneratedSongABC → Song
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function assembleSong(
  raw: GeneratedSongABC,
  source: SongSource,
): Song | null {
  const sections: SongSection[] = [];
  let totalBeats = 0;

  for (let i = 0; i < raw.sections.length; i++) {
    const rawSection = raw.sections[i];

    // Parse melody (required)
    const melodyResult = parseABC(rawSection.melodyABC);
    if ('error' in melodyResult) {
      console.warn(`[SongGen] Failed to parse melody for section "${rawSection.label}":`, melodyResult.error);
      return null;
    }

    // Parse accompaniment (optional)
    let accompNotes: NoteEvent[] | undefined;
    if (rawSection.accompanimentABC) {
      const accompResult = parseABC(rawSection.accompanimentABC);
      if (!('error' in accompResult)) {
        accompNotes = accompResult.notes;
      }
    }

    // Build full layer = melody + accompaniment
    const fullNotes: NoteEvent[] = [
      ...melodyResult.notes.map((n) => ({ ...n, hand: 'right' as const })),
      ...(accompNotes ?? []).map((n) => ({ ...n, hand: 'left' as const })),
    ];

    const sectionBeats = melodyResult.notes.length > 0
      ? Math.max(...melodyResult.notes.map((n) => n.startBeat + n.durationBeats))
      : 0;

    const section: SongSection = {
      id: `section-${i}`,
      label: rawSection.label,
      startBeat: totalBeats,
      endBeat: totalBeats + sectionBeats,
      difficulty: Math.min(5, Math.max(1, raw.difficulty)) as 1 | 2 | 3 | 4 | 5,
      layers: {
        melody: melodyResult.notes,
        accompaniment: accompNotes,
        full: fullNotes,
      },
    };

    sections.push(section);
    totalBeats += sectionBeats;
  }

  if (sections.length === 0) return null;

  const durationSeconds = Math.round((totalBeats / (raw.tempo / 60)));

  const song: Song = {
    id: `${source}-${slugify(raw.title)}-${Date.now().toString(36)}`,
    version: 1,
    type: 'song',
    source,
    metadata: {
      title: raw.title,
      artist: raw.artist,
      genre: normalizeGenre(raw.genre),
      difficulty: Math.min(5, Math.max(1, raw.difficulty)) as 1 | 2 | 3 | 4 | 5,
      durationSeconds,
      attribution: raw.attribution || 'AI arrangement',
    },
    sections,
    settings: {
      tempo: raw.tempo,
      timeSignature: [4, 4],
      keySignature: raw.key || 'C',
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

  return song;
}

function normalizeGenre(genre: string): Song['metadata']['genre'] {
  const g = genre.toLowerCase();
  if (g.includes('classic')) return 'classical';
  if (g.includes('folk')) return 'folk';
  if (g.includes('film') || g.includes('movie') || g.includes('soundtrack')) return 'film';
  if (g.includes('game') || g.includes('video')) return 'game';
  if (g.includes('holiday') || g.includes('christmas')) return 'holiday';
  return 'pop';
}
