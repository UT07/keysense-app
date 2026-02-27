/* eslint-disable no-undef */

const { device, element, by, waitFor } = require('detox');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const {
  sleep,
  isVisibleById,
  isVisibleByText,
  signInWithSkipAndReachHome,
  goToLearnTab,
  openCurrentLessonIntro,
} = require('./helpers/appFlows');

jest.setTimeout(60 * 60 * 1000);

async function maybeOpenExpoDevServer() {
  const localhostEntry = element(by.text('http://localhost:8081'));
  try {
    await waitFor(localhostEntry).toBeVisible().withTimeout(4000);
    await localhostEntry.tap();
    await waitFor(localhostEntry).toBeNotVisible().withTimeout(30000);
  } catch {
    // App is already loaded, or not in Expo Dev Launcher.
  }
}

async function maybeDismissExpoDevMenuNux() {
  const continueButton = element(by.text('Continue'));
  try {
    await waitFor(continueButton).toBeVisible().withTimeout(3000);
    await continueButton.tap();
    await waitFor(continueButton).toBeNotVisible().withTimeout(3000);
  } catch {
    // NUX prompt not present.
  }
}

async function maybeCloseExpoDevMenuPanel() {
  const goHome = element(by.text('Go home'));
  try {
    await waitFor(goHome).toBeVisible().withTimeout(1000);
    await goHome.tap();
    await waitFor(goHome).toBeNotVisible().withTimeout(3000);
  } catch {
    // Panel not present.
  }
}

async function launchAppForAutoplayTest() {
  await device.launchApp({
    newInstance: true,
    permissions: { notifications: 'YES' },
    launchArgs: {
      EXDevMenuDisableAutoLaunch: 'YES',
      EXDevMenuIsOnboardingFinished: 'YES',
      EXDevMenuShowsAtLaunch: 'NO',
    },
  });
  await sleep(5000);
  await device.disableSynchronization();
  await maybeOpenExpoDevServer();
  await maybeCloseExpoDevMenuPanel();
  await maybeDismissExpoDevMenuNux();
}

const APP_BUNDLE_ID = 'com.purrrfectkeys.app';
const ASYNC_KEYS = {
  EXERCISE: 'keysense_exercise_state',
  LEARNER_PROFILE: 'keysense_learner_profile',
};
const TARGET_SKILL_COUNT = Number(process.env.E2E_TARGET_SKILLS || 100);
const MAX_EXERCISES = Number(process.env.E2E_MAX_EXERCISES || 220);
const PLAY_START_OFFSET_MS = Number(process.env.E2E_PLAY_START_OFFSET_MS || -700);
const HOLD_FACTOR = Number(process.env.E2E_HOLD_FACTOR || 0.82);
const HOLD_RELEASE_GAP_MS = Number(process.env.E2E_HOLD_RELEASE_GAP_MS || 120);

let cachedDataContainer = null;
let cachedDeviceUdid = null;
let adaptivePlayStartOffsetMs = PLAY_START_OFFSET_MS;

function getDetoxSimulatorUdid() {
  if (cachedDeviceUdid) return cachedDeviceUdid;

  const candidateIds = [
    device?.id,
    device?._device?._deviceId,
    device?._deviceId,
  ].filter(Boolean);

  for (const id of candidateIds) {
    if (typeof id === 'string' && /^[0-9A-F-]{20,}$/i.test(id)) {
      cachedDeviceUdid = id;
      return cachedDeviceUdid;
    }
  }

  throw new Error(`Unable to resolve Detox simulator UDID from device object (candidates=${candidateIds.join(',') || 'none'})`);
}

function getAppDataContainer() {
  if (cachedDataContainer && fs.existsSync(cachedDataContainer)) {
    return cachedDataContainer;
  }
  const udid = getDetoxSimulatorUdid();
  cachedDataContainer = execSync(`xcrun simctl get_app_container ${udid} ${APP_BUNDLE_ID} data`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  console.log(`[autoplay] using simulator ${udid}`);
  console.log(`[autoplay] app data container ${cachedDataContainer}`);
  return cachedDataContainer;
}

function getAsyncStorageManifestPath() {
  return path.join(
    getAppDataContainer(),
    'Library',
    'Application Support',
    APP_BUNDLE_ID,
    'RCTAsyncLocalStorage_V1',
    'manifest.json',
  );
}

function getAsyncStorageDir() {
  return path.dirname(getAsyncStorageManifestPath());
}

function readManifest() {
  const manifestPath = getAsyncStorageManifestPath();
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw);
}

function readAsyncJson(key) {
  const manifest = readManifest();
  const value = manifest[key];
  if (value == null) {
    const hashedFilename = crypto.createHash('md5').update(key).digest('hex');
    const sidecarPath = path.join(getAsyncStorageDir(), hashedFilename);
    if (!fs.existsSync(sidecarPath)) return null;
    const sidecarValue = fs.readFileSync(sidecarPath, 'utf8');
    return JSON.parse(sidecarValue);
  }
  if (typeof value !== 'string') return value;
  return JSON.parse(value);
}

function readExerciseState() {
  return readAsyncJson(ASYNC_KEYS.EXERCISE) || {};
}

function readLearnerProfile() {
  return readAsyncJson(ASYNC_KEYS.LEARNER_PROFILE) || {};
}

async function waitForPersistedExercise({ previousExerciseId = null, allowSameId = false, timeoutMs = 20000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  let lastDebugLogAt = 0;

  while (Date.now() < deadline) {
    try {
      const state = readExerciseState();
      const currentExercise = state.currentExercise;
      if (
        currentExercise
        && currentExercise.id
        && Array.isArray(currentExercise.notes)
        && currentExercise.notes.length > 0
        && (allowSameId || !previousExerciseId || currentExercise.id !== previousExerciseId)
      ) {
        return currentExercise;
      }

      if (Date.now() - lastDebugLogAt > 2000) {
        lastDebugLogAt = Date.now();
        console.log('[autoplay] waiting for persisted exercise', {
          currentExerciseId: state?.currentExerciseId ?? null,
          hasCurrentExercise: !!currentExercise,
          noteCount: Array.isArray(currentExercise?.notes) ? currentExercise.notes.length : 0,
          isPlaying: state?.isPlaying ?? null,
          previousExerciseId,
        });
      }
    } catch (err) {
      lastError = err;
    }
    await sleep(250);
  }

  throw new Error(`Timed out waiting for persisted exercise${lastError ? ` (${lastError.message})` : ''}`);
}

async function waitForPersistedScore(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const state = readExerciseState();
      if (state && state.score && typeof state.score.overall === 'number') {
        return state.score;
      }
    } catch (err) {
      lastError = err;
    }
    await sleep(250);
  }

  throw new Error(`Timed out waiting for persisted score${lastError ? ` (${lastError.message})` : ''}`);
}

function groupNotesByTime(notes, msPerBeat) {
  const sorted = [...notes].sort((a, b) => a.startBeat - b.startBeat || a.note - b.note);
  const groups = [];
  for (const note of sorted) {
    const timeMs = note.startBeat * msPerBeat;
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.timeMs - timeMs) < 8) {
      last.notes.push(note);
    } else {
      groups.push({ timeMs, notes: [note] });
    }
  }
  return groups;
}

function computeAverageTimingOffsetMs(score) {
  const details = Array.isArray(score?.details) ? score.details : [];
  const matched = details.filter((d) => d && d.isCorrectPitch && !d.isExtraNote && !d.isMissedNote && Number.isFinite(d.timingOffsetMs));
  if (matched.length === 0) return null;
  const avg = matched.reduce((sum, d) => sum + d.timingOffsetMs, 0) / matched.length;
  return Math.round(avg);
}

function maybeCalibrateTimingOffset(score) {
  const avgOffsetMs = computeAverageTimingOffsetMs(score);
  if (avgOffsetMs == null) return;

  if (Math.abs(avgOffsetMs) < 120) return;

  const nextOffset = Math.max(-2000, Math.min(2000, adaptivePlayStartOffsetMs - avgOffsetMs));
  if (nextOffset !== adaptivePlayStartOffsetMs) {
    console.log(
      `[autoplay] calibrating start offset: ${adaptivePlayStartOffsetMs}ms -> ${nextOffset}ms (avg note offset ${avgOffsetMs}ms)`,
    );
    adaptivePlayStartOffsetMs = nextOffset;
  }
}

async function startExerciseAndLoadPersistedPayload(previousExerciseId) {
  await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(30000);

  // Wait out AI loading if present, then dismiss intro overlay.
  if (await isVisibleById('exercise-intro-ready', 20000)) {
    await element(by.id('exercise-intro-ready')).tap();
  }

  // Playback controls should appear quickly once intro is dismissed.
  const hasPause = await isVisibleById('control-pause', 7000);
  if (!hasPause && (await isVisibleById('control-play', 1000))) {
    await element(by.id('control-play')).tap();
  }

  const exercise = await waitForPersistedExercise({ previousExerciseId });
  return exercise;
}

async function playExerciseNotes(exercise) {
  const { tempo, countIn } = exercise.settings;
  const msPerBeat = 60000 / tempo;
  const groups = groupNotesByTime(exercise.notes, msPerBeat);
  const offsetMs = adaptivePlayStartOffsetMs;

  const countInTimeoutMs = Math.round(Math.max(4000, countIn * msPerBeat + 6000));
  if (await isVisibleById('exercise-count-in', 800)) {
    await waitFor(element(by.id('exercise-count-in')))
      .toBeNotVisible()
      .withTimeout(countInTimeoutMs);
    if (offsetMs > 0) {
      await sleep(offsetMs);
    }
    console.log(`[autoplay] count-in overlay cleared (tempo=${tempo}, countIn=${countIn}, offsetMs=${offsetMs})`);
  } else {
    const preRollMs = Math.max(0, Math.round(countIn * msPerBeat + offsetMs));
    console.log(`[autoplay] countIn overlay absent; fallback preRollMs=${preRollMs} offsetMs=${offsetMs}`);
    await sleep(preRollMs);
  }

  const startTime = Date.now();
  for (let idx = 0; idx < groups.length; idx++) {
    const group = groups[idx];
    const elapsed = Date.now() - startTime;
    const waitMs = Math.round(group.timeMs + Math.min(0, offsetMs) - elapsed);
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    const isSingleNote = group.notes.length === 1;
    const nextGroup = groups[idx + 1];

    if (isSingleNote) {
      const [note] = group.notes;
      const expectedDurationMs = Math.round((note.durationBeats || 1) * msPerBeat);
      const gapToNextMs = nextGroup ? Math.max(0, Math.round(nextGroup.timeMs - group.timeMs)) : null;
      const maxHoldForGapMs = gapToNextMs == null ? expectedDurationMs : Math.max(80, gapToNextMs - HOLD_RELEASE_GAP_MS);
      const holdMs = Math.max(120, Math.min(maxHoldForGapMs, Math.round(expectedDurationMs * HOLD_FACTOR)));

      try {
        await element(by.id(`key-${note.note}`)).longPress(holdMs);
      } catch (err) {
        console.warn(`[autoplay] key longPress failed for ${note.note} (${holdMs}ms): ${err.message}`);
        try {
          await element(by.id(`key-${note.note}`)).tap();
        } catch (tapErr) {
          console.warn(`[autoplay] key tap fallback failed for ${note.note}: ${tapErr.message}`);
        }
      }
      continue;
    }

    for (const note of group.notes) {
      try {
        await element(by.id(`key-${note.note}`)).tap();
      } catch (err) {
        console.warn(`[autoplay] chord key tap failed for ${note.note}: ${err.message}`);
      }
    }
  }
}

async function waitForCompletionModal(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isVisibleById('completion-modal', 1000)) return true;
    if (!(await isVisibleById('exercise-player', 800))) return false;
    await sleep(500);
  }
  return false;
}

async function tapCompletionContinue() {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await isVisibleById('completion-continue', 800)) {
      try {
        await element(by.id('completion-continue')).tap();
        return;
      } catch (err) {
        console.warn(`[autoplay] completion-continue tap failed: ${err.message}`);
      }
    }

    if (await isVisibleByText('Back to Lessons', 600)) {
      try {
        await element(by.text('Back to Lessons')).tap();
        return;
      } catch (err) {
        console.warn(`[autoplay] "Back to Lessons" tap failed: ${err.message}`);
      }
    }

    if (await isVisibleByText('Continue', 600)) {
      try {
        await element(by.text('Continue')).tap();
        return;
      } catch (err) {
        console.warn(`[autoplay] "Continue" tap failed: ${err.message}`);
      }
    }

    if (await isVisibleById('completion-modal-scroll', 600)) {
      try {
        await element(by.id('completion-modal-scroll')).scroll(260, 'down');
      } catch {
        // Ignore boundary failures and retry matchers.
      }
      await sleep(300);
      continue;
    }
  }

  throw new Error('Could not tap completion continue/back button');
}

async function completeOneTierExercise({ previousExerciseId, maxRetries = 2 }) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    await waitFor(element(by.id('tier-intro-start'))).toBeVisible().withTimeout(15000);
    await element(by.id('tier-intro-start')).tap();

    const exercise = await startExerciseAndLoadPersistedPayload(previousExerciseId);
    console.log(`[autoplay] exercise ${exercise.id} notes=${exercise.notes.length} tempo=${exercise.settings.tempo}`);

    await playExerciseNotes(exercise);

    const gotCompletion = await waitForCompletionModal();
    if (!gotCompletion) {
      throw new Error('Exercise ended without visible completion modal');
    }

    const score = await waitForPersistedScore();
    console.log(
      `[autoplay] completion score=${score.overall}% passed=${score.isPassed} `
      + `breakdown=${JSON.stringify(score.breakdown || {})}`,
    );

    maybeCalibrateTimingOffset(score);

    if (score.isPassed) {
      // In tier mode, return to the map after each pass so the next start targets
      // the next unmastered skill in the tier (instead of generic Next AI Exercise).
      await tapCompletionContinue();
      return { passed: true, exerciseId: exercise.id, score };
    }

    attempt += 1;
    if (attempt > maxRetries) {
      return { passed: false, exerciseId: exercise.id, score };
    }

    // Retry from the map instead of tapping completion-retry (which can be
    // intermittently unhittable under heavy animations/timers in Detox).
    await tapCompletionContinue();
    await waitForMapRecovered();
    await openCurrentLessonIntro();
  }

  return { passed: false, exerciseId: previousExerciseId, score: null };
}

async function waitForMapRecovered() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await isVisibleById('level-map-screen', 1000)) return;

    if (await isVisibleByText('Continue', 500)) {
      try {
        await element(by.text('Continue')).tap();
        await sleep(700);
        continue;
      } catch {
        // Multiple matches can happen; try helper navigation next.
      }
    }

    try {
      await goToLearnTab();
      if (await isVisibleById('level-map-screen', 1000)) return;
    } catch {
      // Keep polling until timeout.
    }

    await sleep(500);
  }

  throw new Error('Timed out returning to level map after exercise completion');
}

function getMasteredSkillCount() {
  try {
    const profile = readLearnerProfile();
    return Array.isArray(profile.masteredSkills) ? profile.masteredSkills.length : 0;
  } catch {
    return 0;
  }
}

describe('AI Tier Autoplay - Clear Map', () => {
  it('autoplays AI exercises to clear all tier levels', async () => {
    await launchAppForAutoplayTest();
    await signInWithSkipAndReachHome();
    await goToLearnTab();

    let exercisesPlayed = 0;
    let previousExerciseId = null;
    let mastered = getMasteredSkillCount();

    console.log(`[autoplay] starting masteredSkills=${mastered}/${TARGET_SKILL_COUNT}`);

    while (mastered < TARGET_SKILL_COUNT && exercisesPlayed < MAX_EXERCISES) {
      await openCurrentLessonIntro();

      if (!(await isVisibleById('tier-intro-screen', 5000))) {
        throw new Error('Expected tier intro screen (current map is tier-based)');
      }

      const result = await completeOneTierExercise({ previousExerciseId });
      exercisesPlayed += 1;
      previousExerciseId = result.exerciseId;

      expect(result.passed).toBe(true);

      await waitForMapRecovered();
      mastered = getMasteredSkillCount();
      console.log(`[autoplay] progress masteredSkills=${mastered}/${TARGET_SKILL_COUNT}, exercises=${exercisesPlayed}`);
    }

    expect(mastered).toBe(TARGET_SKILL_COUNT);
    console.log(`[autoplay] complete in ${exercisesPlayed} exercises`);
    await device.enableSynchronization();
  }, 60 * 60 * 1000);
});
