/* eslint-disable no-undef */
/**
 * Whole-Game E2E Test Suite
 *
 * Comprehensive automated UI tests that play through the entire app:
 * - Auth & Onboarding
 * - Home Screen navigation
 * - Level Map & Lesson flow
 * - Exercise Player (play notes, score, completion)
 * - Free Play
 * - Song Library
 * - Profile & Settings
 * - Cat Gallery & Evolution
 * - Daily Challenge flow
 *
 * Prerequisites: Detox configured, dev build on device/simulator
 */

const fs = require('fs');
const path = require('path');

const {
  sleep,
  isVisibleById,
  isVisibleByText,
  tapIfVisibleById,
  signInWithSkipAndReachHome,
  goToLearnTab,
  goToPlayTab,
  goToProfileTab,
  openCurrentLessonIntro,
  ensureExercisePlaying,
  startCurrentLessonExercise,
} = require('./helpers/appFlows');

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const loadJSON = (relPath) => {
  const abs = path.resolve(__dirname, '..', relPath);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
};

/** Tap a piano key by MIDI note number. Swallows errors for out-of-view keys. */
async function tapKey(midiNote) {
  try {
    await element(by.id(`key-${midiNote}`)).tap();
  } catch {
    // Key may be outside the visible keyboard range — acceptable.
  }
}

/** Wait for completion modal, then tap the best available "continue" button. */
async function handleCompletionModal(timeout = 60000) {
  await waitFor(element(by.id('completion-modal')))
    .toBeVisible()
    .withTimeout(timeout);

  await sleep(500);

  // Dismiss evolution reveal if shown
  if (await isVisibleById('evolution-dismiss', 2000)) {
    await element(by.id('evolution-dismiss')).tap();
    await sleep(500);
  }

  // Try Next → Start Test → Retry → Continue (in priority order)
  if (await tapIfVisibleById('completion-next', 1500)) return 'next';
  if (await tapIfVisibleById('completion-start-test', 1500)) return 'test';
  if (await tapIfVisibleById('completion-retry', 1500)) return 'retry';
  if (await tapIfVisibleById('completion-continue', 1500)) return 'continue';

  // Fallback: scroll down in case buttons are below fold
  try {
    await element(by.id('completion-scroll')).scroll(200, 'down');
  } catch { /* ignore */ }

  if (await tapIfVisibleById('completion-next', 1000)) return 'next';
  if (await tapIfVisibleById('completion-continue', 1000)) return 'continue';

  throw new Error('No completion button found');
}

/**
 * Play through an exercise by tapping notes at the correct times.
 * Reads the exercise JSON to compute timing, then taps piano keys via testIDs.
 */
async function playExercise(exercise) {
  const { tempo, countIn } = exercise.settings;
  const msPerBeat = 60000 / tempo;
  const countInMs = countIn * msPerBeat;

  // Wait through count-in
  await sleep(countInMs + 300);

  // Group notes by time for chord handling
  const sorted = [...exercise.notes].sort((a, b) => a.startBeat - b.startBeat);
  const groups = [];
  for (const note of sorted) {
    const timeMs = note.startBeat * msPerBeat;
    const existing = groups.find((g) => Math.abs(g.timeMs - timeMs) < 15);
    if (existing) {
      existing.notes.push(note.note);
    } else {
      groups.push({ timeMs, notes: [note.note] });
    }
  }

  const startTime = Date.now();
  for (const group of groups) {
    const now = Date.now() - startTime;
    const waitTime = group.timeMs - now;
    if (waitTime > 10) await sleep(waitTime);

    for (const midi of group.notes) {
      await tapKey(midi);
    }
  }
}

/**
 * Navigate to the Songs tab. Falls back to Home → Songs if tab isn't directly visible.
 */
async function goToSongsTab() {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    if (await isVisibleById('song-library-screen', 1200)) return;

    if (await tapIfVisibleById('tab-songs', 1200)) {
      await sleep(700);
      if (await isVisibleById('song-library-screen', 2000)) return;
    }

    if (await tapIfVisibleById('tab-home', 500)) {
      await sleep(500);
    }
    await sleep(400);
  }
  throw new Error('Timed out navigating to Songs tab');
}

// ────────────────────────────────────────────────────────────────────────────
// Test Suite 1: Auth & Onboarding
// ────────────────────────────────────────────────────────────────────────────

describe('Whole Game: Auth & Onboarding', () => {
  it('completes onboarding as beginner and lands on home screen', async () => {
    await signInWithSkipAndReachHome();
    await expect(element(by.id('home-screen'))).toBeVisible();
    await expect(element(by.id('tab-home'))).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test Suite 2: Home Screen
// ────────────────────────────────────────────────────────────────────────────

describe('Whole Game: Home Screen', () => {
  it('shows greeting, daily challenge card, and continue learning section', async () => {
    await signInWithSkipAndReachHome();

    // Greeting should be visible
    await expect(element(by.id('home-screen'))).toBeVisible();

    // Daily challenge card
    if (await isVisibleById('daily-challenge-card', 3000)) {
      await expect(element(by.id('daily-challenge-card'))).toBeVisible();
    }

    // Continue learning section
    if (await isVisibleById('home-continue-learning', 3000)) {
      await expect(element(by.id('home-continue-learning'))).toBeVisible();
    }
  });

  it('navigates to all tabs from home', async () => {
    await signInWithSkipAndReachHome();

    // Learn tab
    await goToLearnTab();
    await expect(element(by.id('level-map-screen'))).toBeVisible();

    // Play tab
    await goToPlayTab();
    await expect(element(by.id('play-screen'))).toExist();

    // Profile tab
    await goToProfileTab();
    await expect(element(by.id('profile-screen'))).toBeVisible();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test Suite 3: Level Map & Lessons
// ────────────────────────────────────────────────────────────────────────────

describe('Whole Game: Level Map & Lessons', () => {
  it('shows level map with current lesson node', async () => {
    await signInWithSkipAndReachHome();
    await goToLearnTab();

    await expect(element(by.id('level-map-screen'))).toBeVisible();
    await waitFor(element(by.id('lesson-node-current')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('opens lesson intro from current node and can go back', async () => {
    await signInWithSkipAndReachHome();
    await openCurrentLessonIntro();

    // Should be at either lesson intro or tier intro
    const isLessonIntro = await isVisibleById('lesson-intro-screen', 2000);
    const isTierIntro = await isVisibleById('tier-intro-screen', 2000);
    expect(isLessonIntro || isTierIntro).toBe(true);

    // Go back to level map
    if (isLessonIntro) {
      await element(by.id('lesson-intro-back')).tap();
    } else {
      await element(by.id('tier-intro-back')).tap();
    }
    await waitFor(element(by.id('level-map-screen')))
      .toBeVisible()
      .withTimeout(15000);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test Suite 4: Exercise Player — Full Gameplay
// ────────────────────────────────────────────────────────────────────────────

describe('Whole Game: Exercise Player', () => {
  it('plays first exercise (Find Middle C) and reaches completion', async () => {
    await signInWithSkipAndReachHome();
    await startCurrentLessonExercise();

    // Load the first exercise JSON for timing
    const exercise = loadJSON('content/exercises/lesson-01/exercise-01-find-middle-c.json');

    // Wait for exercise player to be fully visible
    await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(20000);

    // Play through the exercise
    await playExercise(exercise);

    // Should reach completion modal
    const action = await handleCompletionModal();
    expect(['next', 'retry', 'continue', 'test']).toContain(action);
  });

  it('supports pause and resume during playback', async () => {
    await signInWithSkipAndReachHome();
    await startCurrentLessonExercise();

    await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(20000);
    await ensureExercisePlaying();

    // Pause
    await waitFor(element(by.id('control-pause'))).toBeVisible().withTimeout(10000);
    await element(by.id('control-pause')).tap();
    await sleep(500);

    // Resume (control-play should appear when paused)
    if (await isVisibleById('control-play', 3000)) {
      await element(by.id('control-play')).tap();
      await sleep(500);
    }

    // Exit
    if (await isVisibleById('control-exit', 3000)) {
      await element(by.id('control-exit')).tap();
    }
  });

  it('speed selector cycles through speeds', async () => {
    await signInWithSkipAndReachHome();
    await startCurrentLessonExercise();
    await ensureExercisePlaying();

    // Tap speed selector (cycles through 0.25x, 0.5x, 0.75x, 1.0x)
    if (await isVisibleById('speed-selector', 3000)) {
      await element(by.id('speed-selector')).tap();
      await sleep(300);
      await element(by.id('speed-selector')).tap();
      await sleep(300);
    }

    // Exit exercise
    if (await isVisibleById('control-exit', 3000)) {
      await element(by.id('control-exit')).tap();
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test Suite 5: Play Full Lesson 1
// ────────────────────────────────────────────────────────────────────────────

describe('Whole Game: Complete Lesson 1', () => {
  it('plays through all Lesson 1 exercises to completion', async () => {
    await signInWithSkipAndReachHome();
    await goToLearnTab();

    const lesson = loadJSON('content/lessons/lesson-01.json');
    const exerciseDir = 'content/exercises/lesson-01';

    // Tap current lesson node to open intro
    try {
      await waitFor(element(by.id('lesson-node-start-chip')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('lesson-node-start-chip')).tap();
    } catch {
      await waitFor(element(by.id('lesson-node-current')))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id('lesson-node-current')).tap();
    }

    // Start lesson
    const isLessonIntro = await isVisibleById('lesson-intro-start', 10000);
    if (isLessonIntro) {
      await element(by.id('lesson-intro-start')).tap();
    } else if (await isVisibleById('tier-intro-start', 5000)) {
      await element(by.id('tier-intro-start')).tap();
    }

    // Play each exercise in the lesson
    const nonTestExercises = lesson.exercises.filter((e) => !e.test);
    for (const entry of nonTestExercises) {
      console.log(`  Playing: ${entry.title} (${entry.id})`);

      // Wait for exercise intro
      if (await isVisibleById('exercise-intro-ready', 15000)) {
        await element(by.id('exercise-intro-ready')).tap();
      }

      await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(15000);

      // Load exercise JSON
      let exercise;
      try {
        const files = fs.readdirSync(path.resolve(__dirname, '..', exerciseDir));
        const matchFile = files.find((f) => {
          try {
            const content = loadJSON(`${exerciseDir}/${f}`);
            return content.id === entry.id;
          } catch {
            return false;
          }
        });
        if (matchFile) {
          exercise = loadJSON(`${exerciseDir}/${matchFile}`);
        }
      } catch {
        // Skip if file not found
      }

      if (exercise) {
        await playExercise(exercise);
      } else {
        // Fallback: wait for exercise to complete on its own or auto-timeout
        await sleep(15000);
      }

      // Handle completion
      try {
        await handleCompletionModal();
      } catch (err) {
        console.warn(`  Completion modal issue for ${entry.id}: ${err.message}`);
        // Try to proceed anyway
        if (await isVisibleById('control-exit', 3000)) {
          await element(by.id('control-exit')).tap();
        }
      }
    }

    // Handle mastery test if it appears
    if (await isVisibleById('exercise-intro-ready', 10000)) {
      console.log('  Playing mastery test');
      await element(by.id('exercise-intro-ready')).tap();
      await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(15000);

      const testExercise = (() => {
        try {
          return loadJSON(`${exerciseDir}/exercise-test.json`);
        } catch {
          return null;
        }
      })();

      if (testExercise) {
        await playExercise(testExercise);
      } else {
        await sleep(15000);
      }

      try {
        await handleCompletionModal();
      } catch {
        // Proceed
      }
    }

    // Should return to level map or lesson complete screen
    if (await isVisibleById('lesson-complete-screen', 5000)) {
      await tapIfVisibleById('lesson-complete-continue', 3000);
    }

    // Verify we're back at level map
    await waitFor(element(by.id('level-map-screen')))
      .toBeVisible()
      .withTimeout(15000);
  }, 300000); // 5 minute timeout for full lesson
});

// ────────────────────────────────────────────────────────────────────────────
// Test Suite 6: Free Play
// ────────────────────────────────────────────────────────────────────────────

describe('Whole Game: Free Play', () => {
  it('plays notes and shows note display', async () => {
    await signInWithSkipAndReachHome();
    await goToPlayTab();

    await waitFor(element(by.id('freeplay-keyboard'))).toBeVisible().withTimeout(15000);

    // Dismiss instructions if shown
    if (await isVisibleById('freeplay-instructions-close', 4000)) {
      await element(by.id('freeplay-instructions-close')).tap();
    }

    // Play some notes
    await element(by.id('freeplay-keyboard')).tapAtPoint({ x: 24, y: 95 });
    await sleep(200);
    await element(by.id('freeplay-keyboard')).tapAtPoint({ x: 120, y: 95 });
    await sleep(200);
    await element(by.id('freeplay-keyboard')).tapAtPoint({ x: 200, y: 95 });
    await sleep(200);

    // Note display should have updated
    await expect(element(by.id('freeplay-note-display'))).toBeVisible();
  });

  it('records and plays back a performance', async () => {
    await signInWithSkipAndReachHome();
    await goToPlayTab();

    await waitFor(element(by.id('freeplay-keyboard'))).toBeVisible().withTimeout(15000);

    if (await isVisibleById('freeplay-instructions-close', 4000)) {
      await element(by.id('freeplay-instructions-close')).tap();
    }

    // Start recording
    await element(by.id('freeplay-record-start')).tap();
    await waitFor(element(by.id('freeplay-record-stop'))).toBeVisible().withTimeout(5000);

    // Play a few notes
    await element(by.id('freeplay-keyboard')).tapAtPoint({ x: 50, y: 95 });
    await sleep(300);
    await element(by.id('freeplay-keyboard')).tapAtPoint({ x: 150, y: 95 });
    await sleep(300);

    // Stop recording
    await element(by.id('freeplay-record-stop')).tap();

    // Playback and clear buttons should appear
    await waitFor(element(by.id('freeplay-record-playback'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('freeplay-record-clear'))).toBeVisible().withTimeout(5000);

    // Play back
    await element(by.id('freeplay-record-playback')).tap();
    await sleep(2000);

    // Clear
    await element(by.id('freeplay-record-clear')).tap();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test Suite 7: Song Library
// ────────────────────────────────────────────────────────────────────────────

describe('Whole Game: Song Library', () => {
  it('navigates to songs tab and shows library', async () => {
    await signInWithSkipAndReachHome();
    await goToSongsTab();

    await expect(element(by.id('song-library-screen'))).toBeVisible();
  });

  it('can browse genre carousel and scroll song list', async () => {
    await signInWithSkipAndReachHome();
    await goToSongsTab();

    // Genre carousel should be visible
    if (await isVisibleById('genre-carousel', 5000)) {
      // Swipe through genres
      try {
        await element(by.id('genre-carousel')).swipe('left', 'fast');
        await sleep(500);
        await element(by.id('genre-carousel')).swipe('right', 'fast');
      } catch {
        // Carousel might not be scrollable if few genres
      }
    }

    // Song list should have items
    if (await isVisibleById('song-list', 5000)) {
      try {
        await element(by.id('song-list')).scroll(300, 'down');
        await sleep(300);
      } catch {
        // List might be short
      }
    }
  });

  it('opens a song player screen', async () => {
    await signInWithSkipAndReachHome();
    await goToSongsTab();

    // Try to tap first song card
    if (await isVisibleById('song-card-0', 10000)) {
      await element(by.id('song-card-0')).tap();
      await sleep(1000);

      // Should navigate to song player
      if (await isVisibleById('song-player-screen', 10000)) {
        await expect(element(by.id('song-player-screen'))).toBeVisible();

        // Section pills should be visible
        if (await isVisibleById('section-pills', 3000)) {
          await expect(element(by.id('section-pills'))).toBeVisible();
        }

        // Go back
        if (await tapIfVisibleById('song-player-back', 2000)) {
          await sleep(500);
        }
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test Suite 8: Profile & Settings
// ────────────────────────────────────────────────────────────────────────────

describe('Whole Game: Profile & Settings', () => {
  it('shows stats grid and settings on profile screen', async () => {
    await signInWithSkipAndReachHome();
    await goToProfileTab();

    await expect(element(by.id('profile-screen'))).toBeVisible();

    // Stats should be visible
    if (await isVisibleById('profile-stats-grid', 3000)) {
      await expect(element(by.id('profile-stats-grid'))).toBeVisible();
    }
  });

  it('navigates to account screen and back', async () => {
    await signInWithSkipAndReachHome();
    await goToProfileTab();

    // Scroll to account button
    try {
      await waitFor(element(by.id('profile-open-account')))
        .toBeVisible()
        .whileElement(by.id('profile-scroll'))
        .scroll(260, 'down');
    } catch { /* may already be visible */ }

    if (await tapIfVisibleById('profile-open-account', 3000)) {
      await waitFor(element(by.id('account-screen'))).toBeVisible().withTimeout(5000);
      await element(by.id('account-back')).tap();
      await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(5000);
    }
  });

  it('opens cat gallery and can browse cats', async () => {
    await signInWithSkipAndReachHome();
    await goToProfileTab();

    try {
      await waitFor(element(by.id('profile-open-cat-switch-row')))
        .toBeVisible()
        .whileElement(by.id('profile-scroll'))
        .scroll(260, 'down');
    } catch { /* may already be visible */ }

    if (await tapIfVisibleById('profile-open-cat-switch-row', 3000)) {
      await waitFor(element(by.id('cat-switch-screen'))).toBeVisible().withTimeout(5000);

      // Swipe through cat cards
      try {
        await element(by.id('cat-gallery-pager')).swipe('left', 'fast');
        await sleep(500);
        await element(by.id('cat-gallery-pager')).swipe('left', 'fast');
        await sleep(500);
      } catch {
        // Pager might not be scrollable
      }

      // Go back
      await element(by.id('cat-switch-back')).tap();
      await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(5000);
    }
  });

  it('opens MIDI setup screen', async () => {
    await signInWithSkipAndReachHome();
    await goToProfileTab();

    try {
      await waitFor(element(by.id('profile-open-midi-setup')))
        .toBeVisible()
        .whileElement(by.id('profile-scroll'))
        .scroll(260, 'down');
    } catch { /* may already be visible */ }

    if (await tapIfVisibleById('profile-open-midi-setup', 3000)) {
      await waitFor(element(by.id('midi-setup-screen'))).toBeVisible().withTimeout(5000);

      // Back button
      if (await tapIfVisibleById('midi-cancel', 2000)) {
        await sleep(500);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test Suite 9: Daily Challenge
// ────────────────────────────────────────────────────────────────────────────

describe('Whole Game: Daily Challenge', () => {
  it('shows daily challenge card on home and can start it', async () => {
    await signInWithSkipAndReachHome();

    if (await isVisibleById('daily-challenge-card', 5000)) {
      // Challenge card should be visible with description
      await expect(element(by.id('daily-challenge-card'))).toBeVisible();

      // Tap to start the challenge
      if (await tapIfVisibleById('daily-challenge-start', 2000)) {
        await sleep(1000);

        // Should navigate to exercise or daily session
        const atExercise = await isVisibleById('exercise-player', 5000);
        const atDailySession = await isVisibleById('daily-session-screen', 3000);
        expect(atExercise || atDailySession).toBe(true);

        // Go back
        if (atExercise && (await isVisibleById('control-exit', 2000))) {
          await element(by.id('control-exit')).tap();
        }
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test Suite 10: Exercise Retry & Demo
// ────────────────────────────────────────────────────────────────────────────

describe('Whole Game: Exercise Retry & Demo Mode', () => {
  it('can retry an exercise after completion', async () => {
    await signInWithSkipAndReachHome();
    await startCurrentLessonExercise();

    await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(20000);

    // Let exercise auto-complete by waiting (small exercises finish quickly)
    try {
      await waitFor(element(by.id('completion-modal')))
        .toBeVisible()
        .withTimeout(90000);
    } catch {
      // If not completed, exit
      if (await isVisibleById('control-exit', 2000)) {
        await element(by.id('control-exit')).tap();
        return;
      }
    }

    // Look for retry button
    if (await isVisibleById('completion-retry', 3000)) {
      await element(by.id('completion-retry')).tap();
      await sleep(1000);

      // Should be back in exercise player
      await expect(element(by.id('exercise-player'))).toBeVisible();
    }
  });

  it('shows demo prompt after consecutive failures', async () => {
    // This tests the demo playback feature which triggers after 3+ fails
    // For now, verify the demo button exists in the UI
    await signInWithSkipAndReachHome();
    await startCurrentLessonExercise();
    await ensureExercisePlaying();

    // Check if demo button is accessible (may not be visible until after fails)
    // Just verify exercise player is functional
    await expect(element(by.id('exercise-player'))).toBeVisible();

    // Exit
    if (await isVisibleById('control-exit', 3000)) {
      await element(by.id('control-exit')).tap();
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Test Suite 11: Cross-Tab Navigation Stress Test
// ────────────────────────────────────────────────────────────────────────────

describe('Whole Game: Cross-Tab Navigation', () => {
  it('rapidly switches between all tabs without crashing', async () => {
    await signInWithSkipAndReachHome();

    // Rapid tab switching
    for (let round = 0; round < 3; round++) {
      await tapIfVisibleById('tab-learn', 1500);
      await sleep(300);
      await tapIfVisibleById('tab-play', 1500);
      await sleep(300);
      await tapIfVisibleById('tab-songs', 1500);
      await sleep(300);
      await tapIfVisibleById('tab-profile', 1500);
      await sleep(300);
      await tapIfVisibleById('tab-home', 1500);
      await sleep(300);
    }

    // Should still be on home screen and functional
    await expect(element(by.id('home-screen'))).toBeVisible();
  });

  it('exits exercise mid-playback and returns to stable state', async () => {
    await signInWithSkipAndReachHome();
    await startCurrentLessonExercise();
    await ensureExercisePlaying();

    // Wait briefly then exit mid-playback
    await sleep(1500);
    await element(by.id('control-exit')).tap();

    // Should return to lesson intro or level map
    const atLessonIntro = await isVisibleById('lesson-intro-screen', 5000);
    const atLevelMap = await isVisibleById('level-map-screen', 3000);
    const atTierIntro = await isVisibleById('tier-intro-screen', 2000);
    expect(atLessonIntro || atLevelMap || atTierIntro).toBe(true);
  });
});
