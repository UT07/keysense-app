/**
 * TheSession.org Song Importer
 *
 * Fetches traditional tunes (reels, jigs, waltzes) from TheSession.org API,
 * converts ABC notation to Song objects via abcParser, and outputs JSON.
 *
 * The search endpoint returns tune IDs; individual tune endpoints provide
 * ABC notation in the `settings` array. We construct full ABC strings with
 * X:/T:/M:/L:/K: headers before passing to abcParser.
 *
 * Usage: npx tsx scripts/import-thesession.ts [--limit 50] [--type reel|jig|waltz] [--output songs.json]
 *
 * Prerequisites:
 * - Network access to thesession.org
 */

import { parseABC } from '../src/core/songs/abcParser';
import type { Song, SongSection } from '../src/core/songs/songTypes';
import { writeFileSync } from 'fs';

const API_BASE = 'https://thesession.org';
const DEFAULT_LIMIT = 50;
const DELAY_MS = 500; // Be polite to the API

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface SessionSearchResult {
  id: number;
  name: string;
  type: string;
  url: string;
  date: string;
  tunebooks: number;
}

interface SessionSearchResponse {
  tunes: SessionSearchResult[];
  total: number;
  pages: number;
}

interface SessionTuneSetting {
  id: number;
  url: string;
  key: string; // e.g. "Dmajor", "Aminor", "Gdorian"
  abc: string; // bare ABC notation (no headers)
}

interface SessionTuneDetail {
  id: number;
  name: string;
  type: string;
  url: string;
  composer?: string;
  settings: SessionTuneSetting[];
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function searchTunes(type: string, page: number, perPage: number): Promise<SessionSearchResponse> {
  const url = `${API_BASE}/tunes/search?type=${type}&format=json&page=${page}&perpage=${perPage}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<SessionSearchResponse>;
}

async function fetchTuneDetail(tuneId: number): Promise<SessionTuneDetail> {
  const url = `${API_BASE}/tunes/${tuneId}?format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tune API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<SessionTuneDetail>;
}

// ---------------------------------------------------------------------------
// Key and time signature helpers
// ---------------------------------------------------------------------------

function parseSessionKey(keyStr: string): string {
  // Convert "Dmajor" → "D", "Aminor" → "Am", "Gdorian" → "GDor"
  const match = keyStr.match(/^([A-G][b#]?)(major|minor|dorian|mixolydian)?$/i);
  if (!match) return 'C';
  const note = match[1];
  const mode = (match[2] || 'major').toLowerCase();
  if (mode === 'major') return note;
  if (mode === 'minor') return `${note}m`;
  if (mode === 'dorian') return `${note}Dor`;
  if (mode === 'mixolydian') return `${note}Mix`;
  return note;
}

function tuneTypeToMeter(type: string): string {
  switch (type) {
    case 'waltz': return '3/4';
    case 'jig': return '6/8';
    case 'slip jig': return '9/8';
    default: return '4/4'; // reel, hornpipe, polka
  }
}

function tuneTypeToDefaultLength(type: string): string {
  switch (type) {
    case 'jig':
    case 'slip jig': return '1/8';
    default: return '1/8';
  }
}

function tuneTypeToTimeSignature(type: string): [number, number] {
  switch (type) {
    case 'waltz': return [3, 4];
    case 'jig': return [6, 8];
    case 'slip jig': return [9, 8];
    default: return [4, 4];
  }
}

function tuneTypeToDifficulty(type: string): 1 | 2 | 3 | 4 | 5 {
  switch (type) {
    case 'waltz': return 2;
    case 'jig': return 3;
    case 'reel': return 3;
    case 'hornpipe': return 4;
    default: return 3;
  }
}

function tuneTypeToTempo(type: string): number {
  switch (type) {
    case 'waltz': return 100;
    case 'jig': return 120;
    case 'reel': return 110;
    case 'hornpipe': return 90;
    default: return 110;
  }
}

// ---------------------------------------------------------------------------
// Build full ABC string from TheSession's bare notation
// ---------------------------------------------------------------------------

function buildABCString(name: string, type: string, setting: SessionTuneSetting): string {
  const key = parseSessionKey(setting.key);
  const meter = tuneTypeToMeter(type);
  const noteLength = tuneTypeToDefaultLength(type);
  const tempo = tuneTypeToTempo(type);

  return [
    `X:1`,
    `T:${name}`,
    `M:${meter}`,
    `L:${noteLength}`,
    `Q:1/4=${tempo}`,
    `K:${key}`,
    setting.abc,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Convert tune detail → Song
// ---------------------------------------------------------------------------

function tuneToDuration(notes: { startBeat: number; durationBeats: number }[], tempo: number): number {
  if (notes.length === 0) return 60;
  const lastNote = notes[notes.length - 1];
  const totalBeats = lastNote.startBeat + lastNote.durationBeats;
  return Math.round((totalBeats / tempo) * 60);
}

function convertTuneToSong(detail: SessionTuneDetail): Song | null {
  if (detail.settings.length === 0) {
    console.warn(`  Skipping "${detail.name}": no settings/ABC`);
    return null;
  }

  // Use the first (most popular) setting
  const setting = detail.settings[0];
  if (!setting.abc || setting.abc.trim().length === 0) {
    console.warn(`  Skipping "${detail.name}": empty ABC`);
    return null;
  }

  const abcString = buildABCString(detail.name, detail.type, setting);
  const parsed = parseABC(abcString);

  if ('error' in parsed) {
    console.warn(`  Skipping "${detail.name}": ${parsed.error}`);
    return null;
  }

  if (parsed.notes.length < 4) {
    console.warn(`  Skipping "${detail.name}": too few notes (${parsed.notes.length})`);
    return null;
  }

  const songId = `thesession-${detail.id}`;
  const tempo = parsed.tempo || tuneTypeToTempo(detail.type);
  const ts = parsed.timeSignature || tuneTypeToTimeSignature(detail.type);

  // Split notes into sections of ~16 bars each
  const beatsPerBar = ts[0];
  const barsPerSection = 16;
  const beatsPerSection = beatsPerBar * barsPerSection;
  const sections: SongSection[] = [];

  let sectionNotes: typeof parsed.notes = [];
  let sectionStart = 0;
  let sectionIndex = 0;

  for (const note of parsed.notes) {
    if (note.startBeat >= sectionStart + beatsPerSection && sectionNotes.length > 0) {
      sections.push({
        id: `section-${sectionIndex}`,
        label: sectionIndex === 0 ? 'Part A' : `Part ${String.fromCharCode(65 + sectionIndex)}`,
        startBeat: sectionStart,
        endBeat: sectionStart + beatsPerSection,
        difficulty: tuneTypeToDifficulty(detail.type),
        layers: {
          melody: sectionNotes,
          full: sectionNotes,
        },
      });
      sectionStart += beatsPerSection;
      sectionNotes = [];
      sectionIndex++;
    }
    sectionNotes.push(note);
  }

  // Push remaining notes as final section
  if (sectionNotes.length > 0) {
    const lastNote = sectionNotes[sectionNotes.length - 1];
    sections.push({
      id: `section-${sectionIndex}`,
      label: sectionIndex === 0 ? 'Part A' : `Part ${String.fromCharCode(65 + sectionIndex)}`,
      startBeat: sectionStart,
      endBeat: lastNote.startBeat + lastNote.durationBeats,
      difficulty: tuneTypeToDifficulty(detail.type),
      layers: {
        melody: sectionNotes,
        full: sectionNotes,
      },
    });
  }

  if (sections.length === 0) return null;

  const artist = detail.composer || 'Traditional';

  return {
    id: songId,
    version: 1,
    type: 'song',
    source: 'thesession',
    metadata: {
      title: detail.name,
      artist,
      genre: 'folk',
      difficulty: tuneTypeToDifficulty(detail.type),
      durationSeconds: tuneToDuration(parsed.notes, tempo),
      attribution: `Traditional tune from TheSession.org (tune #${detail.id})`,
    },
    sections,
    settings: {
      tempo,
      timeSignature: ts,
      keySignature: parsed.keySignature || parseSessionKey(setting.key),
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const typeIdx = args.indexOf('--type');
  const outputIdx = args.indexOf('--output');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : DEFAULT_LIMIT;
  const tuneType = typeIdx >= 0 ? args[typeIdx + 1] : 'reel';
  const outputFile = outputIdx >= 0 ? args[outputIdx + 1] : null;

  console.log(`Searching for up to ${limit} "${tuneType}" tunes on TheSession.org...`);

  // Fetch search results (IDs only)
  const searchResponse = await searchTunes(tuneType, 1, Math.min(limit, 50));
  console.log(`Found ${searchResponse.tunes.length} tunes (${searchResponse.total} total available)`);

  const songs: Song[] = [];

  for (const result of searchResponse.tunes) {
    console.log(`Fetching: ${result.name} (#${result.id})...`);

    try {
      const detail = await fetchTuneDetail(result.id);
      const song = convertTuneToSong(detail);

      if (song) {
        songs.push(song);
        console.log(`  ✓ ${song.sections.length} section(s), ${song.metadata.durationSeconds}s, key=${song.settings.keySignature}`);
      }
    } catch (err) {
      console.warn(`  ✗ Error fetching tune #${result.id}: ${err instanceof Error ? err.message : String(err)}`);
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`\nConverted ${songs.length}/${searchResponse.tunes.length} tunes successfully.`);

  if (outputFile) {
    writeFileSync(outputFile, JSON.stringify(songs, null, 2));
    console.log(`Written to ${outputFile}`);
  } else {
    console.log('JSON output:');
    console.log(JSON.stringify(songs, null, 2));
  }
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
