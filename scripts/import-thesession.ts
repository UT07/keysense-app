/**
 * TheSession.org Song Importer
 *
 * Fetches traditional tunes (reels, jigs, waltzes) from TheSession.org API,
 * converts ABC notation to Song objects via abcParser, and saves to Firestore.
 *
 * Usage: npx ts-node scripts/import-thesession.ts [--limit 50] [--type reel|jig|waltz]
 *
 * Prerequisites:
 * - Firebase Admin SDK credentials in GOOGLE_APPLICATION_CREDENTIALS env var
 * - Network access to thesession.org
 */

import { parseABC } from '../src/core/songs/abcParser';
import type { Song, SongSection } from '../src/core/songs/songTypes';

const API_BASE = 'https://thesession.org';
const DEFAULT_LIMIT = 50;
const DELAY_MS = 500; // Be polite to the API

interface SessionTune {
  id: number;
  name: string;
  type: string;
  abc: string;
  url: string;
  date: string;
}

interface SessionResponse {
  tunes: SessionTune[];
  total: number;
  pages: number;
}

async function fetchTunes(type: string, page: number, perPage: number): Promise<SessionResponse> {
  const url = `${API_BASE}/tunes/search?type=${type}&format=json&page=${page}&perpage=${perPage}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<SessionResponse>;
}

function tuneTypeToTimeSignature(type: string): [number, number] {
  switch (type) {
    case 'waltz': return [3, 4];
    case 'jig': return [6, 8];
    case 'slip jig': return [9, 8];
    default: return [4, 4]; // reel, hornpipe, polka
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

function tuneToDuration(notes: { startBeat: number; durationBeats: number }[], tempo: number): number {
  if (notes.length === 0) return 60;
  const lastNote = notes[notes.length - 1];
  const totalBeats = lastNote.startBeat + lastNote.durationBeats;
  return Math.round((totalBeats / tempo) * 60);
}

function convertTuneToSong(tune: SessionTune): Song | null {
  const parsed = parseABC(tune.abc);
  if ('error' in parsed) {
    console.warn(`  Skipping "${tune.name}": ${parsed.error}`);
    return null;
  }

  if (parsed.notes.length < 4) {
    console.warn(`  Skipping "${tune.name}": too few notes (${parsed.notes.length})`);
    return null;
  }

  const songId = `thesession-${tune.id}`;
  const tempo = parsed.tempo || 120;
  const ts = parsed.timeSignature || tuneTypeToTimeSignature(tune.type);

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
        difficulty: tuneTypeToDifficulty(tune.type),
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
      difficulty: tuneTypeToDifficulty(tune.type),
      layers: {
        melody: sectionNotes,
        full: sectionNotes,
      },
    });
  }

  if (sections.length === 0) return null;

  return {
    id: songId,
    version: 1,
    type: 'song',
    source: 'thesession',
    metadata: {
      title: tune.name,
      artist: 'Traditional',
      genre: 'folk',
      difficulty: tuneTypeToDifficulty(tune.type),
      durationSeconds: tuneToDuration(parsed.notes, tempo),
      attribution: `Traditional tune from TheSession.org (tune #${tune.id})`,
    },
    sections,
    settings: {
      tempo,
      timeSignature: ts,
      keySignature: parsed.keySignature || 'C',
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const typeIdx = args.indexOf('--type');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : DEFAULT_LIMIT;
  const tuneType = typeIdx >= 0 ? args[typeIdx + 1] : 'reel';

  console.log(`Fetching up to ${limit} "${tuneType}" tunes from TheSession.org...`);

  const response = await fetchTunes(tuneType, 1, Math.min(limit, 50));
  console.log(`Received ${response.tunes.length} tunes (${response.total} total available)`);

  const songs: Song[] = [];
  for (const tune of response.tunes) {
    console.log(`Processing: ${tune.name} (#${tune.id})`);
    const song = convertTuneToSong(tune);
    if (song) {
      songs.push(song);
      console.log(`  ✓ ${song.sections.length} sections, ${song.metadata.durationSeconds}s`);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`\nConverted ${songs.length}/${response.tunes.length} tunes successfully.`);
  console.log('Song JSON output written to stdout (pipe to file or Firestore uploader).');

  // Output as JSON array for piping to Firestore
  console.log(JSON.stringify(songs, null, 2));
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
