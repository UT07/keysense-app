/**
 * Upload Song JSON to Firestore
 *
 * Reads a merged songs JSON file and uploads each song as a document
 * in the `songs` collection. Uses Firebase client SDK (no Admin SDK needed).
 *
 * Usage:
 *   export $(grep -v '^#' .env.local | xargs)
 *   npx tsx scripts/upload-songs-to-firestore.ts --input /tmp/all-songs.json [--dry-run]
 *
 * Prerequisites:
 *   - EXPO_PUBLIC_FIREBASE_API_KEY and EXPO_PUBLIC_FIREBASE_PROJECT_ID env vars
 *   - Firestore rules that allow writes (or use emulator)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { readFileSync } from 'fs';

// ---------------------------------------------------------------------------
// Firebase init (standalone — no React Native deps)
// ---------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'upload-script',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
};

interface Song {
  id: string;
  metadata: { title: string; genre: string; difficulty: number };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const BATCH_SIZE = 20; // Firestore batch limit is 500, but keep small for progress

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  const dryRun = args.includes('--dry-run');

  if (inputIdx < 0 || !args[inputIdx + 1]) {
    console.error('Usage: npx tsx scripts/upload-songs-to-firestore.ts --input <songs.json> [--dry-run]');
    process.exit(1);
  }

  const inputFile = args[inputIdx + 1];

  if (!process.env.EXPO_PUBLIC_FIREBASE_API_KEY || !process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) {
    console.error('Error: Firebase env vars not set. Run:');
    console.error('  export $(grep -v "^#" .env.local | xargs)');
    process.exit(1);
  }

  // Load songs
  const songs: Song[] = JSON.parse(readFileSync(inputFile, 'utf-8'));
  console.log(`Loaded ${songs.length} songs from ${inputFile}`);
  console.log(`Project: ${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}`);
  console.log(`Dry run: ${dryRun}\n`);

  if (dryRun) {
    for (const song of songs) {
      console.log(`  songs/${song.id} — ${song.metadata.title} (${song.metadata.genre}, diff ${song.metadata.difficulty})`);
    }
    console.log(`\nWould upload ${songs.length} documents to songs/ collection`);
    return;
  }

  // Initialize Firebase
  const app = initializeApp(firebaseConfig, 'upload-script');
  const db = getFirestore(app);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < songs.length; i += BATCH_SIZE) {
    const batchSongs = songs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const song of batchSongs) {
      const ref = doc(db, 'songs', song.id);

      // Check if already exists
      try {
        const existing = await getDoc(ref);
        if (existing.exists()) {
          console.log(`  Skip (exists): ${song.id}`);
          skipped++;
          continue;
        }
      } catch {
        // If we can't read, try to write anyway
      }

      batch.set(ref, song);
      console.log(`  Queue: ${song.id} — ${song.metadata.title}`);
      uploaded++;
    }

    // Commit batch
    try {
      await batch.commit();
      console.log(`  ✓ Batch committed (${Math.min(i + BATCH_SIZE, songs.length)}/${songs.length})`);
    } catch (err) {
      console.error(`  ✗ Batch failed: ${err instanceof Error ? err.message : String(err)}`);
      failed += batchSongs.length;
      uploaded -= batchSongs.length;
    }
  }

  console.log(`\nDone! Uploaded: ${uploaded}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
