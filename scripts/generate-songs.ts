/**
 * Batch Song Generator (Gemini)
 *
 * Generates simplified piano arrangements for well-known songs using
 * Gemini 2.0 Flash. Calls the Gemini API directly (no Firebase needed)
 * and outputs Song JSON to a file.
 *
 * Usage: npx tsx scripts/generate-songs.ts [--dry-run] [--start 0] [--count 10] [--output songs.json]
 *
 * Prerequisites:
 * - EXPO_PUBLIC_GEMINI_API_KEY env var (source from .env.local)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  buildSongPrompt,
  validateGeneratedSong,
  assembleSong,
} from '../src/core/songs/songAssembler';
import type { SongRequestParams, Song } from '../src/core/songs/songTypes';
import { writeFileSync, existsSync, readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Curated song list — songs likely in public domain or AI-arrangeable
// ---------------------------------------------------------------------------

const SONG_LIST: SongRequestParams[] = [
  // Classical (difficulty 2-4)
  { title: 'Fur Elise', artist: 'Beethoven', difficulty: 3 },
  { title: 'Moonlight Sonata (simplified)', artist: 'Beethoven', difficulty: 4 },
  { title: 'Canon in D (simplified)', artist: 'Pachelbel', difficulty: 3 },
  { title: 'Clair de Lune (simplified)', artist: 'Debussy', difficulty: 4 },
  { title: 'Prelude in C Major', artist: 'J.S. Bach', difficulty: 3 },
  { title: 'Minuet in G', artist: 'J.S. Bach', difficulty: 2 },
  { title: 'Turkish March', artist: 'Mozart', difficulty: 4 },
  { title: 'Ode to Joy', artist: 'Beethoven', difficulty: 1 },
  { title: 'The Entertainer', artist: 'Scott Joplin', difficulty: 3 },
  { title: 'Gymnopédie No. 1', artist: 'Erik Satie', difficulty: 2 },

  // Pop (difficulty 1-2)
  { title: 'Happy Birthday', difficulty: 1 },
  { title: 'Twinkle Twinkle Little Star', difficulty: 1 },
  { title: 'Mary Had a Little Lamb', difficulty: 1 },
  { title: 'London Bridge', difficulty: 1 },
  { title: 'Row Row Row Your Boat', difficulty: 1 },
  { title: 'Amazing Grace', difficulty: 2 },
  { title: 'Greensleeves', difficulty: 2 },
  { title: 'Auld Lang Syne', difficulty: 2 },
  { title: 'When the Saints Go Marching In', difficulty: 2 },
  { title: 'Scarborough Fair', difficulty: 2 },

  // Film (difficulty 2-4)
  { title: 'Hedwig\'s Theme (simplified)', artist: 'John Williams', difficulty: 3 },
  { title: 'The Imperial March (simplified)', artist: 'John Williams', difficulty: 3 },
  { title: 'My Heart Will Go On (simplified)', artist: 'James Horner', difficulty: 3 },
  { title: 'Somewhere Over the Rainbow', difficulty: 2 },
  { title: 'Moon River', artist: 'Henry Mancini', difficulty: 2 },
  { title: 'The Pink Panther Theme', artist: 'Henry Mancini', difficulty: 3 },
  { title: 'Concerning Hobbits (simplified)', artist: 'Howard Shore', difficulty: 2 },
  { title: 'Mia & Sebastian\'s Theme (simplified)', artist: 'Justin Hurwitz', difficulty: 3 },
  { title: 'City of Stars (simplified)', artist: 'Justin Hurwitz', difficulty: 3 },
  { title: 'Raiders March (simplified)', artist: 'John Williams', difficulty: 3 },

  // Game (difficulty 2-4)
  { title: 'Tetris Theme (Korobeiniki)', difficulty: 2 },
  { title: 'Super Mario Bros Theme (simplified)', artist: 'Koji Kondo', difficulty: 3 },
  { title: 'Zelda Main Theme (simplified)', artist: 'Koji Kondo', difficulty: 3 },
  { title: 'Minecraft - Sweden (simplified)', artist: 'C418', difficulty: 2 },
  { title: 'Undertale - Megalovania (simplified)', artist: 'Toby Fox', difficulty: 4 },
  { title: 'Pokemon Center Theme (simplified)', difficulty: 3 },
  { title: 'Animal Crossing Main Theme (simplified)', difficulty: 2 },
  { title: 'Wii Sports Theme (simplified)', difficulty: 2 },
  { title: 'Final Fantasy Prelude (simplified)', artist: 'Nobuo Uematsu', difficulty: 3 },
  { title: 'Chrono Trigger Main Theme (simplified)', artist: 'Yasunori Mitsuda', difficulty: 3 },

  // Holiday (difficulty 1-3)
  { title: 'Jingle Bells', difficulty: 1 },
  { title: 'Silent Night', difficulty: 1 },
  { title: 'We Wish You a Merry Christmas', difficulty: 1 },
  { title: 'Deck the Halls', difficulty: 2 },
  { title: 'O Christmas Tree', difficulty: 2 },
  { title: 'Joy to the World', difficulty: 2 },
  { title: 'Frosty the Snowman', difficulty: 2 },
  { title: 'Rudolph the Red-Nosed Reindeer', difficulty: 2 },
  { title: 'Winter Wonderland', difficulty: 3 },
  { title: 'Let It Snow', difficulty: 3 },
];

// ---------------------------------------------------------------------------
// Gemini generation (standalone — no Firebase)
// ---------------------------------------------------------------------------

interface GenerativeModel {
  generateContent(prompt: string): Promise<{
    response: { text(): string };
  }>;
}

async function generateSong(
  model: GenerativeModel,
  params: SongRequestParams,
): Promise<Song | null> {
  const prompt = buildSongPrompt(params);

  // First attempt
  let song = await attemptGeneration(model, prompt);
  if (!song) {
    // Retry with guidance
    const retryPrompt =
      prompt +
      '\n\nPrevious attempt failed. Ensure each section has valid ABC notation with all required headers (X:, T:, M:, L:, K:).';
    song = await attemptGeneration(model, retryPrompt);
  }

  return song;
}

async function attemptGeneration(
  model: GenerativeModel,
  prompt: string,
): Promise<Song | null> {
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed: unknown = JSON.parse(text);

  if (!validateGeneratedSong(parsed)) {
    return null;
  }

  return assembleSong(parsed, 'gemini');
}

// ---------------------------------------------------------------------------
// Resume support
// ---------------------------------------------------------------------------

function loadExistingSongs(outputPath: string): Song[] {
  if (existsSync(outputPath)) {
    try {
      return JSON.parse(readFileSync(outputPath, 'utf-8')) as Song[];
    } catch {
      return [];
    }
  }
  return [];
}

function songAlreadyGenerated(existing: Song[], title: string): boolean {
  const normalised = title.toLowerCase().replace(/[^a-z0-9]/g, '');
  return existing.some((s) => {
    const existingNorm = s.metadata.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    return existingNorm === normalised || existingNorm.includes(normalised) || normalised.includes(existingNorm);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const DELAY_BETWEEN_SONGS_MS = 2000;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const startIdx = args.indexOf('--start');
  const countIdx = args.indexOf('--count');
  const outputIdx = args.indexOf('--output');
  const start = startIdx >= 0 ? parseInt(args[startIdx + 1], 10) : 0;
  const count = countIdx >= 0 ? parseInt(args[countIdx + 1], 10) : SONG_LIST.length;
  const outputFile = outputIdx >= 0 ? args[outputIdx + 1] : '/tmp/gemini-songs.json';

  const songs = SONG_LIST.slice(start, start + count);

  console.log(`Song Generation Script`);
  console.log(`======================`);
  console.log(`Total songs in list: ${SONG_LIST.length}`);
  console.log(`Processing range: ${start} to ${start + songs.length - 1}`);
  console.log(`Output: ${outputFile}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('');

  if (dryRun) {
    console.log('Dry run — listing songs that would be generated:\n');
    for (let i = 0; i < songs.length; i++) {
      const s = songs[i];
      console.log(
        `  ${start + i + 1}. ${s.title}${s.artist ? ` — ${s.artist}` : ''} (difficulty ${s.difficulty})`,
      );
    }
    console.log(`\nTotal: ${songs.length} songs`);
    return;
  }

  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: EXPO_PUBLIC_GEMINI_API_KEY is not set.');
    console.error('Run: source .env.local && npx tsx scripts/generate-songs.ts');
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.8,
    },
  });

  // Load existing songs for resume support
  const existingSongs = loadExistingSongs(outputFile);
  if (existingSongs.length > 0) {
    console.log(`Resuming — ${existingSongs.length} songs already in ${outputFile}\n`);
  }

  const allSongs = [...existingSongs];
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < songs.length; i++) {
    const params = songs[i];
    const idx = start + i + 1;

    if (songAlreadyGenerated(allSongs, params.title)) {
      console.log(`[${idx}/${start + songs.length}] Skipping (already done): ${params.title}`);
      skippedCount++;
      continue;
    }

    console.log(`[${idx}/${start + songs.length}] Generating: ${params.title}...`);

    try {
      const song = await generateSong(model, params);
      if (song) {
        console.log(`  ✓ ${song.id} — ${song.sections.length} sections, ${song.metadata.durationSeconds}s`);
        allSongs.push(song);
        successCount++;
        // Save after each success for resume support
        writeFileSync(outputFile, JSON.stringify(allSongs, null, 2));
      } else {
        console.log(`  ✗ Generation returned null (validation or ABC parse failed)`);
        failCount++;
      }
    } catch (err) {
      console.error(`  ✗ Error: ${err instanceof Error ? err.message : String(err)}`);
      failCount++;
    }

    if (i < songs.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_SONGS_MS));
    }
  }

  console.log(`\nDone! Generated: ${successCount}, Failed: ${failCount}, Skipped: ${skippedCount}`);
  console.log(`Total songs in output: ${allSongs.length}`);
  console.log(`Written to: ${outputFile}`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
