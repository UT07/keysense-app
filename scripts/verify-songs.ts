#!/usr/bin/env npx tsx
/**
 * Song Content Verification Script
 *
 * Downloads all songs from Firestore and runs comprehensive validation:
 * 1. Structural integrity (note ranges, durations, beat alignment, sections)
 * 2. Musical plausibility (impossible intervals, empty phrases, duration outliers)
 * 3. Reference melody verification (for well-known songs)
 * 4. Source-specific checks (AI-generated, TheSession, PDMX)
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   npx tsx scripts/verify-songs.ts [--source gemini|thesession|pdmx] [--verbose]
 *
 * Prerequisites:
 *   - EXPO_PUBLIC_FIREBASE_API_KEY and EXPO_PUBLIC_FIREBASE_PROJECT_ID env vars
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'verify-script',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
};

// ---------------------------------------------------------------------------
// Types (duplicated to avoid RN module resolution issues)
// ---------------------------------------------------------------------------

interface NoteEvent {
  note: number;
  startBeat: number;
  durationBeats: number;
  hand?: 'left' | 'right';
}

interface SongSection {
  id: string;
  label: string;
  startBeat: number;
  endBeat: number;
  difficulty: number;
  layers: {
    melody: NoteEvent[];
    accompaniment?: NoteEvent[];
    full: NoteEvent[];
  };
}

interface Song {
  id: string;
  version: number;
  type: string;
  source: string;
  metadata: {
    title: string;
    artist: string;
    genre: string;
    difficulty: number;
    durationSeconds: number;
    attribution: string;
  };
  sections: SongSection[];
  settings: {
    tempo: number;
    timeSignature: [number, number];
    keySignature: string;
    countIn?: number;
    metronomeEnabled?: boolean;
    loopEnabled?: boolean;
  };
  scoring: {
    timingToleranceMs: number;
    timingGracePeriodMs: number;
    velocitySensitive: boolean;
    passingScore: number;
    starThresholds: [number, number, number];
  };
}

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

type Severity = 'error' | 'warning' | 'info';

interface Issue {
  songId: string;
  songTitle: string;
  source: string;
  section?: string;
  severity: Severity;
  category: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Known reference melodies (first 8-16 notes, MIDI numbers)
// Used to verify AI-generated songs match the expected melody.
// ---------------------------------------------------------------------------

const REFERENCE_MELODIES: Record<string, number[]> = {
  // Nursery / folk (C major)
  'twinkle twinkle little star': [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60],
  'mary had a little lamb': [64, 62, 60, 62, 64, 64, 64, 62, 62, 62, 64, 67, 67],
  'happy birthday': [60, 60, 62, 60, 65, 64, 60, 60, 62, 60, 67, 65],
  'london bridge': [67, 69, 67, 65, 64, 65, 67, 62, 64, 65, 64, 65, 67],
  'row row row your boat': [60, 60, 60, 62, 64, 64, 62, 64, 65, 67],
  'ode to joy': [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62],
  'amazing grace': [60, 65, 67, 69, 67, 69, 67, 65, 60],
  'jingle bells': [64, 64, 64, 64, 64, 64, 64, 67, 60, 62, 64],
  'silent night': [67, 69, 67, 64, 67, 69, 67, 64],
  'auld lang syne': [60, 65, 65, 65, 69, 67, 67, 65, 67, 69, 65, 65],
  'greensleeves': [69, 72, 74, 76, 74, 72, 69, 65, 67, 69, 67, 65],
  'when the saints go marching in': [60, 64, 65, 67, 60, 64, 65, 67],
  // Classical
  'fur elise': [76, 75, 76, 75, 76, 71, 74, 72, 69],
  'the entertainer': [62, 63, 64, 69, 67, 69, 64],
  'minuet in g': [74, 67, 69, 71, 72, 74, 67, 67],
  'prelude in c major': [60, 64, 67, 72, 76, 67, 72, 76],
};

// ---------------------------------------------------------------------------
// Piano note helpers
// ---------------------------------------------------------------------------

const PIANO_MIN = 21;  // A0
const PIANO_MAX = 108; // C8
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

// ---------------------------------------------------------------------------
// Validation functions
// ---------------------------------------------------------------------------

const issues: Issue[] = [];

function addIssue(
  song: Song,
  severity: Severity,
  category: string,
  message: string,
  section?: string,
): void {
  issues.push({
    songId: song.id,
    songTitle: song.metadata.title,
    source: song.source,
    section,
    severity,
    category,
    message,
  });
}

/** 1. Structural validation */
function validateStructure(song: Song): void {
  // Empty sections
  if (!song.sections || song.sections.length === 0) {
    addIssue(song, 'error', 'structure', 'Song has no sections');
    return;
  }

  for (const section of song.sections) {
    // Empty melody
    if (!section.layers.melody || section.layers.melody.length === 0) {
      addIssue(song, 'error', 'structure', `Melody layer is empty`, section.label);
    }

    // Empty full layer
    if (!section.layers.full || section.layers.full.length === 0) {
      addIssue(song, 'error', 'structure', `Full layer is empty`, section.label);
    }

    // Beat range
    if (section.startBeat >= section.endBeat) {
      addIssue(song, 'error', 'structure', `startBeat (${section.startBeat}) >= endBeat (${section.endBeat})`, section.label);
    }

    // Validate notes in each layer
    for (const [layerName, notes] of Object.entries(section.layers)) {
      if (!notes || !Array.isArray(notes)) continue;
      validateNotes(song, notes, section.label, layerName);
    }
  }

  // Section continuity — sections should not have large gaps
  const sorted = [...song.sections].sort((a, b) => a.startBeat - b.startBeat);
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].startBeat - sorted[i - 1].endBeat;
    if (gap > 8) {
      addIssue(song, 'warning', 'structure', `Gap of ${gap} beats between "${sorted[i - 1].label}" and "${sorted[i].label}"`);
    }
    if (gap < 0) {
      addIssue(song, 'warning', 'structure', `Sections "${sorted[i - 1].label}" and "${sorted[i].label}" overlap by ${-gap} beats`);
    }
  }

  // Settings validation
  if (song.settings.tempo < 30 || song.settings.tempo > 240) {
    addIssue(song, 'error', 'structure', `Tempo ${song.settings.tempo} outside valid range 30-240`);
  }

  // Scoring validation
  if (song.scoring.passingScore > song.scoring.starThresholds[0]) {
    addIssue(song, 'error', 'structure', `Passing score (${song.scoring.passingScore}) > first star threshold (${song.scoring.starThresholds[0]})`);
  }
}

/** 2. Note-level validation */
function validateNotes(song: Song, notes: NoteEvent[], sectionLabel: string, layerName: string): void {
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const ctx = `${sectionLabel}/${layerName}[${i}]`;

    // MIDI range
    if (note.note < PIANO_MIN || note.note > PIANO_MAX) {
      addIssue(song, 'error', 'notes', `Note ${midiToName(note.note)} (${note.note}) outside piano range`, ctx);
    }

    // Practical range for piano learning (C2-C7)
    if (note.note < 36 || note.note > 96) {
      addIssue(song, 'warning', 'notes', `Note ${midiToName(note.note)} outside practical learning range (C2-C7)`, ctx);
    }

    // Duration
    if (note.durationBeats <= 0) {
      addIssue(song, 'error', 'notes', `Duration ${note.durationBeats} is not positive`, ctx);
    }

    // Very long notes (likely wrong)
    if (note.durationBeats > 16) {
      addIssue(song, 'warning', 'notes', `Duration ${note.durationBeats} beats is unusually long`, ctx);
    }

    // Negative start beat
    if (note.startBeat < 0) {
      addIssue(song, 'error', 'notes', `startBeat ${note.startBeat} is negative`, ctx);
    }
  }
}

/** 3. Musical plausibility */
function validateMusicalContent(song: Song): void {
  for (const section of song.sections) {
    const melody = section.layers.melody;
    if (!melody || melody.length < 2) continue;

    // Sort by startBeat
    const sorted = [...melody].sort((a, b) => a.startBeat - b.startBeat);

    // Check for impossible interval jumps (> 2 octaves in sequential notes)
    for (let i = 1; i < sorted.length; i++) {
      const interval = Math.abs(sorted[i].note - sorted[i - 1].note);
      if (interval > 24) { // > 2 octaves
        addIssue(
          song, 'warning', 'musical',
          `Jump of ${interval} semitones (${midiToName(sorted[i - 1].note)} → ${midiToName(sorted[i].note)}) — likely error`,
          section.label,
        );
      }
    }

    // Check note range span (for a single section, melody shouldn't span > 3 octaves)
    const midiValues = sorted.map(n => n.note);
    const range = Math.max(...midiValues) - Math.min(...midiValues);
    if (range > 36) {
      addIssue(
        song, 'warning', 'musical',
        `Melody spans ${range} semitones (${Math.ceil(range / 12)} octaves) — may be too wide for beginners`,
        section.label,
      );
    }

    // Check for repeated notes pattern (stuck on one note = likely parsing issue)
    let maxRepeat = 0;
    let currentRepeat = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].note === sorted[i - 1].note) {
        currentRepeat++;
        maxRepeat = Math.max(maxRepeat, currentRepeat);
      } else {
        currentRepeat = 1;
      }
    }
    if (maxRepeat >= 8 && sorted.length > 10) {
      addIssue(
        song, 'warning', 'musical',
        `${maxRepeat} consecutive repeated notes — possible parsing error`,
        section.label,
      );
    }

    // Very few unique pitches (< 3 for a section with 10+ notes = likely wrong)
    const uniquePitches = new Set(sorted.map(n => n.note));
    if (uniquePitches.size < 3 && sorted.length >= 10) {
      addIssue(
        song, 'warning', 'musical',
        `Only ${uniquePitches.size} unique pitches in ${sorted.length} notes — melody may be malformed`,
        section.label,
      );
    }

    // Check difficulty vs actual note complexity
    const hasBlackKeys = sorted.some(n => [1, 3, 6, 8, 10].includes(n.note % 12));
    if (song.metadata.difficulty === 1 && hasBlackKeys) {
      addIssue(
        song, 'info', 'musical',
        'Difficulty 1 but contains black keys (sharps/flats)',
        section.label,
      );
    }
  }
}

/** 4. Reference melody verification */
function validateReferenceMelody(song: Song): void {
  const titleLower = song.metadata.title.toLowerCase()
    .replace(/\(simplified\)/g, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  const reference = REFERENCE_MELODIES[titleLower];
  if (!reference) return; // No reference melody available

  // Get first section's melody notes
  const firstSection = song.sections[0];
  if (!firstSection || !firstSection.layers.melody || firstSection.layers.melody.length === 0) return;

  const melodyNotes = [...firstSection.layers.melody]
    .sort((a, b) => a.startBeat - b.startBeat)
    .map(n => n.note);

  // Normalize to same octave as reference (transpose so first note matches)
  const refFirst = reference[0];
  const actualFirst = melodyNotes[0];
  const transpose = refFirst - actualFirst;

  // Compare intervals (relative pattern) instead of absolute pitches
  // This is more robust to transposition differences
  const refIntervals = [];
  for (let i = 1; i < reference.length && i < 12; i++) {
    refIntervals.push(reference[i] - reference[i - 1]);
  }

  const actualIntervals = [];
  for (let i = 1; i < melodyNotes.length && i < 12; i++) {
    actualIntervals.push(melodyNotes[i] - melodyNotes[i - 1]);
  }

  // Score: how many intervals match?
  const compareLen = Math.min(refIntervals.length, actualIntervals.length);
  if (compareLen < 4) return; // Too few notes to compare

  let matches = 0;
  for (let i = 0; i < compareLen; i++) {
    if (refIntervals[i] === actualIntervals[i]) matches++;
  }

  const matchRate = matches / compareLen;

  if (matchRate < 0.3) {
    addIssue(
      song, 'error', 'reference',
      `Melody does NOT match known reference. Interval match: ${Math.round(matchRate * 100)}% (${matches}/${compareLen}). ` +
      `Expected intervals: [${refIntervals.slice(0, 8).join(',')}], ` +
      `Got: [${actualIntervals.slice(0, 8).join(',')}]`,
    );
  } else if (matchRate < 0.6) {
    addIssue(
      song, 'warning', 'reference',
      `Melody partially matches reference. Interval match: ${Math.round(matchRate * 100)}% (${matches}/${compareLen}). May be simplified or in a different arrangement.`,
    );
  } else {
    addIssue(
      song, 'info', 'reference',
      `Melody matches reference: ${Math.round(matchRate * 100)}% interval match`,
    );
  }
}

/** 5. Source-specific checks */
function validateSourceSpecific(song: Song): void {
  if (song.source === 'gemini') {
    // AI songs should have attribution
    if (!song.metadata.attribution || !song.metadata.attribution.toLowerCase().includes('ai')) {
      addIssue(song, 'warning', 'source', 'AI-generated song missing "AI" in attribution');
    }
  }

  if (song.source === 'thesession') {
    // TheSession songs should be folk genre
    if (song.metadata.genre !== 'folk') {
      addIssue(song, 'info', 'source', `TheSession song has genre "${song.metadata.genre}" (expected "folk")`);
    }
  }

  if (song.source === 'pdmx') {
    // PDMX songs should be classical
    if (song.metadata.genre !== 'classical') {
      addIssue(song, 'info', 'source', `PDMX song has genre "${song.metadata.genre}" (expected "classical")`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const sourceFilter = args.indexOf('--source') >= 0 ? args[args.indexOf('--source') + 1] : null;
  const verbose = args.includes('--verbose');

  console.log('\n=== Purrrfect Keys Song Verification ===\n');

  // Initialize Firebase
  if (!process.env.EXPO_PUBLIC_FIREBASE_API_KEY) {
    console.error('Missing EXPO_PUBLIC_FIREBASE_API_KEY. Run:');
    console.error('  export $(grep -v "^#" .env.local | xargs)');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // Fetch all songs
  console.log('Fetching songs from Firestore...');
  const songsSnap = await getDocs(collection(db, 'songs'));
  const songs: Song[] = [];

  songsSnap.forEach((docSnap) => {
    const data = docSnap.data() as Song;
    if (!data.id) data.id = docSnap.id;
    songs.push(data);
  });

  console.log(`Fetched ${songs.length} songs\n`);

  if (songs.length === 0) {
    console.log('No songs found in Firestore. Nothing to verify.');
    process.exit(0);
  }

  // Filter by source if requested
  const filtered = sourceFilter
    ? songs.filter(s => s.source === sourceFilter)
    : songs;

  console.log(`Verifying ${filtered.length} songs${sourceFilter ? ` (source: ${sourceFilter})` : ''}...\n`);

  // Run validations
  for (const song of filtered) {
    validateStructure(song);
    validateMusicalContent(song);
    validateReferenceMelody(song);
    validateSourceSpecific(song);
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  // Summary stats
  const bySource: Record<string, number> = {};
  const byGenre: Record<string, number> = {};
  for (const s of filtered) {
    bySource[s.source] = (bySource[s.source] || 0) + 1;
    byGenre[s.metadata.genre] = (byGenre[s.metadata.genre] || 0) + 1;
  }

  console.log('--- Song Catalogue ---');
  console.log(`Total songs: ${filtered.length}`);
  console.log(`By source: ${Object.entries(bySource).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`By genre: ${Object.entries(byGenre).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log();

  console.log('--- Verification Results ---');
  console.log(`Errors:   ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Info:     ${infos.length}`);
  console.log();

  // Print errors
  if (errors.length > 0) {
    console.log('=== ERRORS ===');
    for (const issue of errors) {
      const section = issue.section ? ` [${issue.section}]` : '';
      console.log(`  ✗ ${issue.songTitle} (${issue.source})${section}`);
      console.log(`    ${issue.category}: ${issue.message}`);
    }
    console.log();
  }

  // Print warnings
  if (warnings.length > 0) {
    console.log('=== WARNINGS ===');
    for (const issue of warnings) {
      const section = issue.section ? ` [${issue.section}]` : '';
      console.log(`  ⚠ ${issue.songTitle} (${issue.source})${section}`);
      console.log(`    ${issue.category}: ${issue.message}`);
    }
    console.log();
  }

  // Print info (verbose only)
  if (verbose && infos.length > 0) {
    console.log('=== INFO ===');
    for (const issue of infos) {
      const section = issue.section ? ` [${issue.section}]` : '';
      console.log(`  ℹ ${issue.songTitle} (${issue.source})${section}`);
      console.log(`    ${issue.category}: ${issue.message}`);
    }
    console.log();
  }

  // Per-song summary
  const songIssueCount = new Map<string, { errors: number; warnings: number }>();
  for (const issue of [...errors, ...warnings]) {
    const counts = songIssueCount.get(issue.songId) || { errors: 0, warnings: 0 };
    if (issue.severity === 'error') counts.errors++;
    else counts.warnings++;
    songIssueCount.set(issue.songId, counts);
  }

  const cleanSongs = filtered.length - songIssueCount.size;
  console.log(`--- Summary ---`);
  console.log(`Clean songs (no errors/warnings): ${cleanSongs}/${filtered.length} (${Math.round(cleanSongs / filtered.length * 100)}%)`);

  if (songIssueCount.size > 0) {
    console.log(`\nSongs with issues:`);
    const sorted = [...songIssueCount.entries()].sort((a, b) => b[1].errors - a[1].errors);
    for (const [songId, counts] of sorted) {
      const song = filtered.find(s => s.id === songId);
      const title = song?.metadata.title || songId;
      const parts = [];
      if (counts.errors > 0) parts.push(`${counts.errors} error(s)`);
      if (counts.warnings > 0) parts.push(`${counts.warnings} warning(s)`);
      console.log(`  ${counts.errors > 0 ? '✗' : '⚠'} ${title}: ${parts.join(', ')}`);
    }
  }

  console.log();
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(2);
});
