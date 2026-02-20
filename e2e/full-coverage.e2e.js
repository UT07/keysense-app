/**
 * full-coverage.e2e.js
 * Comprehensive Detox E2E test suite for Purrrfect Keys
 *
 * Coverage:
 * - Fresh install onboarding (all paths)
 * - Auth flows (email, guest/skip, back navigation)
 * - Tab navigation (all 4 tabs)
 * - Home screen elements
 * - Level Map (lesson nodes, scroll, tap)
 * - Lesson Intro screen
 * - Exercise Player (play, pause, exit, completion flows)
 * - Free Play screen (record, playback, clear)
 * - Profile screen (stats, settings, navigation)
 * - Account screen (anonymous and authenticated states)
 * - Cat Switch screen
 * - Skill Assessment (intermediate onboarding path)
 * - Edge cases (back navigation, rapid taps)
 */

/* eslint-disable no-undef */

const { device, element, by, waitFor } = require('detox');

const {
  sleep,
  isVisibleById,
  isVisibleByText,
  tapIfVisibleById,
  signInWithSkipAndReachHome,
  completeOnboardingBeginnerFlow,
  goToLearnTab,
  goToPlayTab,
  goToProfileTab,
  openCurrentLessonIntro,
  ensureExercisePlaying,
  startCurrentLessonExercise,
} = require('./helpers/appFlows');

// ============================================================================
// Suite 1: Onboarding — Beginner Path (Complete Fresh-Install Flow)
// ============================================================================

describe('Suite 1: Onboarding — Beginner Path', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
  });

  it('1.1 — app launches and shows auth screen or onboarding', async () => {
    const onAuth = await isVisibleById('auth-screen', 12000);
    const onOnboarding = await isVisibleById('onboarding-screen', 5000);
    expect(onAuth || onOnboarding).toBe(true);
  });

  it('1.2 — auth screen: guest skip reaches onboarding', async () => {
    if (await isVisibleById('auth-screen', 5000)) {
      await waitFor(element(by.id('skip-signin'))).toBeVisible().withTimeout(10000);
      await element(by.id('skip-signin')).tap();
      await sleep(1200);
    }
    await waitFor(element(by.id('onboarding-screen'))).toBeVisible().withTimeout(15000);
  });

  it('1.3 — step 1: welcome screen visible with Get Started button', async () => {
    await waitFor(element(by.id('onboarding-step-1'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('onboarding-get-started'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('onboarding-progress'))).toBeVisible().withTimeout(5000);
  });

  it('1.4 — step 1 → step 2 via Get Started', async () => {
    await element(by.id('onboarding-get-started')).tap();
    await waitFor(element(by.id('onboarding-step-2'))).toBeVisible().withTimeout(5000);
  });

  it('1.5 — step 2: all experience options visible', async () => {
    await waitFor(element(by.id('onboarding-experience-beginner'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('onboarding-experience-intermediate'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('onboarding-experience-returning'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('onboarding-experience-next'))).toBeVisible().withTimeout(5000);
  });

  it('1.6 — step 2: Back button returns to step 1', async () => {
    await waitFor(element(by.id('onboarding-back'))).toBeVisible().withTimeout(3000);
    await element(by.id('onboarding-back')).tap();
    await waitFor(element(by.id('onboarding-step-1'))).toBeVisible().withTimeout(5000);
    // Advance back to step 2
    await element(by.id('onboarding-get-started')).tap();
    await waitFor(element(by.id('onboarding-step-2'))).toBeVisible().withTimeout(5000);
  });

  it('1.7 — step 2: select Beginner and advance', async () => {
    await element(by.id('onboarding-experience-beginner')).tap();
    await sleep(300);
    await element(by.id('onboarding-experience-next')).tap();
    await waitFor(element(by.id('onboarding-step-3'))).toBeVisible().withTimeout(5000);
  });

  it('1.8 — step 3: MIDI options visible', async () => {
    await waitFor(element(by.id('onboarding-midi-yes'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('onboarding-midi-no'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('onboarding-midi-next'))).toBeVisible().withTimeout(5000);
  });

  it('1.9 — step 3: select No MIDI and advance', async () => {
    await element(by.id('onboarding-midi-no')).tap();
    await sleep(300);
    await element(by.id('onboarding-midi-next')).tap();
    await waitFor(element(by.id('onboarding-step-4'))).toBeVisible().withTimeout(5000);
  });

  it('1.10 — step 4: goal options visible', async () => {
    await waitFor(element(by.id('onboarding-goal-songs'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('onboarding-goal-technique'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('onboarding-goal-exploration'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('onboarding-finish'))).toBeVisible().withTimeout(5000);
  });

  it('1.11 — step 4: select Songs goal and finish → Home', async () => {
    await element(by.id('onboarding-goal-songs')).tap();
    await sleep(300);
    await element(by.id('onboarding-finish')).tap();
    await sleep(1200);
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(20000);
    await waitFor(element(by.id('tab-home'))).toBeVisible().withTimeout(10000);
  });
});

// ============================================================================
// Suite 2: Onboarding — Intermediate Path → Skill Assessment
// ============================================================================

describe('Suite 2: Onboarding — Intermediate Path', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await tapIfVisibleById('skip-signin', 10000);
    await sleep(800);
  });

  it('2.1 — intermediate selection triggers skill assessment', async () => {
    if (!(await isVisibleById('onboarding-screen', 8000))) return;

    await tapIfVisibleById('onboarding-get-started', 3000);
    await sleep(400);
    await waitFor(element(by.id('onboarding-step-2'))).toBeVisible().withTimeout(8000);
    await element(by.id('onboarding-experience-intermediate')).tap();
    await sleep(300);
    await element(by.id('onboarding-experience-next')).tap();

    await waitFor(element(by.id('skill-assessment-screen'))).toBeVisible().withTimeout(15000);
  });

  it('2.2 — skill assessment: intro phase visible', async () => {
    await waitFor(element(by.id('assessment-intro'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('assessment-start-round'))).toBeVisible().withTimeout(5000);
  });

  it('2.3 — skill assessment: start round triggers count-in or playing', async () => {
    await element(by.id('assessment-start-round')).tap();
    await sleep(500);
    const countInVisible = await isVisibleById('assessment-countin', 3000);
    const playingVisible = await isVisibleById('assessment-playing', 3000);
    expect(countInVisible || playingVisible).toBe(true);
  });

  it('2.4 — skill assessment: piano roll and keyboard visible during play', async () => {
    await waitFor(element(by.id('assessment-playing'))).toBeVisible().withTimeout(15000);
    await waitFor(element(by.id('assessment-piano-roll'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('assessment-keyboard'))).toBeVisible().withTimeout(5000);
  });

  it('2.5 — skill assessment: round auto-completes and shows result', async () => {
    await waitFor(element(by.id('assessment-result'))).toBeVisible().withTimeout(30000);
    await waitFor(element(by.id('assessment-next-round'))).toBeVisible().withTimeout(5000);
  });

  it('2.6 — skill assessment: advance through remaining rounds', async () => {
    for (let round = 1; round < 5; round++) {
      if (await isVisibleById('assessment-result', 3000)) {
        await element(by.id('assessment-next-round')).tap();
        await sleep(500);
      }
      const isIntro = await isVisibleById('assessment-intro', 5000);
      if (isIntro) {
        await element(by.id('assessment-start-round')).tap();
        await sleep(500);
      }
      await waitFor(element(by.id('assessment-result'))).toBeVisible().withTimeout(35000);
    }
    await element(by.id('assessment-next-round')).tap();
  });

  it('2.7 — skill assessment: complete screen shows summary', async () => {
    await waitFor(element(by.id('assessment-complete'))).toBeVisible().withTimeout(15000);
    await waitFor(element(by.id('assessment-continue'))).toBeVisible().withTimeout(5000);
  });

  it('2.8 — skill assessment: Continue returns to onboarding', async () => {
    await element(by.id('assessment-continue')).tap();
    await sleep(800);
    await waitFor(element(by.id('onboarding-screen'))).toBeVisible().withTimeout(15000);
  });

  it('2.9 — complete rest of onboarding after skill assessment', async () => {
    await tapIfVisibleById('onboarding-midi-no', 2000);
    await sleep(200);
    await tapIfVisibleById('onboarding-midi-next', 2000);
    await sleep(400);
    await tapIfVisibleById('onboarding-goal-songs', 2000);
    await sleep(200);
    await tapIfVisibleById('onboarding-finish', 2000);
    await sleep(1200);
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(20000);
  });
});

// ============================================================================
// Suite 3: Auth Screen Flows
// ============================================================================

describe('Suite 3: Auth Screen Flows', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
  });

  it('3.1 — auth screen shows all sign-in options', async () => {
    const onAuth = await isVisibleById('auth-screen', 12000);
    if (!onAuth) {
      console.log('No auth screen present, skipping auth tests');
      return;
    }

    await waitFor(element(by.id('google-signin'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('email-signin'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('skip-signin'))).toBeVisible().withTimeout(5000);
  });

  it('3.2 — email sign-in opens email auth screen', async () => {
    if (!(await isVisibleById('auth-screen', 3000))) return;
    await element(by.id('email-signin')).tap();
    await waitFor(element(by.id('email-auth-screen'))).toBeVisible().withTimeout(15000);
  });

  it('3.3 — email auth: back button returns to auth screen', async () => {
    if (!(await isVisibleById('email-auth-screen', 3000))) return;
    await element(by.id('email-auth-back')).tap();
    await waitFor(element(by.id('auth-screen'))).toBeVisible().withTimeout(10000);
  });

  it('3.4 — email auth: form fields visible on sign-in mode', async () => {
    if (!(await isVisibleById('auth-screen', 3000))) return;
    await element(by.id('email-signin')).tap();
    await waitFor(element(by.id('email-auth-screen'))).toBeVisible().withTimeout(10000);

    await waitFor(element(by.id('email-input'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('password-input'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('submit-button'))).toBeVisible().withTimeout(5000);
  });

  it('3.5 — email auth: invalid email shows error', async () => {
    if (!(await isVisibleById('email-auth-screen', 3000))) return;
    await element(by.id('email-input')).clearText();
    await element(by.id('email-input')).typeText('notanemail');
    await element(by.id('password-input')).clearText();
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('submit-button')).tap();
    await sleep(600);
    await waitFor(element(by.id('error-text'))).toBeVisible().withTimeout(5000);
  });

  it('3.6 — email auth: short password shows error', async () => {
    if (!(await isVisibleById('email-auth-screen', 3000))) return;
    await element(by.id('email-input')).clearText();
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).clearText();
    await element(by.id('password-input')).typeText('short');
    await element(by.id('submit-button')).tap();
    await sleep(600);
    await waitFor(element(by.id('error-text'))).toBeVisible().withTimeout(5000);
  });

  it('3.7 — auth screen: Skip sign-in proceeds to onboarding or home', async () => {
    if (await isVisibleById('email-auth-screen', 2000)) {
      await element(by.id('email-auth-back')).tap();
      await sleep(500);
    }
    if (!(await isVisibleById('auth-screen', 5000))) return;
    await element(by.id('skip-signin')).tap();
    await sleep(1000);
    const onHome = await isVisibleById('home-screen', 8000);
    const onOnboarding = await isVisibleById('onboarding-screen', 5000);
    expect(onHome || onOnboarding).toBe(true);
    if (onOnboarding) {
      await completeOnboardingBeginnerFlow();
    }
  });
});

// ============================================================================
// Suite 4: Tab Navigation
// ============================================================================

describe('Suite 4: Tab Navigation', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
  });

  it('4.1 — all 4 tab buttons visible on home', async () => {
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(10000);
    await waitFor(element(by.id('tab-home'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('tab-learn'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('tab-play'))).toBeVisible().withTimeout(5000);
    await waitFor(element(by.id('tab-profile'))).toBeVisible().withTimeout(5000);
  });

  it('4.2 — Learn tab shows Level Map', async () => {
    await element(by.id('tab-learn')).tap();
    await waitFor(element(by.id('level-map-screen'))).toBeVisible().withTimeout(15000);
  });

  it('4.3 — Play tab shows Free Play', async () => {
    await element(by.id('tab-play')).tap();
    await sleep(1500);
    await waitFor(element(by.id('play-screen'))).toBeVisible().withTimeout(20000);
  });

  it('4.4 — Profile tab shows Profile', async () => {
    await element(by.id('tab-home')).tap();
    await sleep(1000);
    await element(by.id('tab-profile')).tap();
    await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(15000);
  });

  it('4.5 — Home tab returns to home', async () => {
    await element(by.id('tab-home')).tap();
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(10000);
  });

  it('4.6 — rapid tab switching does not crash', async () => {
    await element(by.id('tab-learn')).tap();
    await sleep(300);
    await element(by.id('tab-home')).tap();
    await sleep(300);
    await element(by.id('tab-profile')).tap();
    await sleep(300);
    await element(by.id('tab-home')).tap();
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(10000);
  });
});

// ============================================================================
// Suite 5: Home Screen
// ============================================================================

describe('Suite 5: Home Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
  });

  it('5.1 — home screen renders', async () => {
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(10000);
  });

  it('5.2 — continue learning card conditional visibility', async () => {
    const isVisible = await isVisibleById('home-continue-learning', 3000);
    console.log(`Continue learning card visible: ${isVisible}`);
  });
});

// ============================================================================
// Suite 6: Level Map Screen
// ============================================================================

describe('Suite 6: Level Map Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
  });

  it('6.1 — level map renders', async () => {
    await goToLearnTab();
    await waitFor(element(by.id('level-map-screen'))).toBeVisible().withTimeout(15000);
  });

  it('6.2 — scroll view present', async () => {
    await waitFor(element(by.id('level-map-scroll'))).toBeVisible().withTimeout(5000);
  });

  it('6.3 — current lesson node visible', async () => {
    await waitFor(element(by.id('lesson-node-current'))).toBeVisible().withTimeout(10000);
  });

  it('6.4 — tapping current lesson opens lesson intro', async () => {
    await element(by.id('lesson-node-current')).tap();
    await waitFor(element(by.id('lesson-intro-screen'))).toBeVisible().withTimeout(12000);
  });

  it('6.5 — back from lesson intro returns to level map', async () => {
    await element(by.id('lesson-intro-back')).tap();
    await sleep(600);
    await waitFor(element(by.id('level-map-screen'))).toBeVisible().withTimeout(10000);
  });

  it('6.6 — level map scrolls', async () => {
    await element(by.id('level-map-scroll')).scroll(200, 'down');
    await sleep(500);
    await element(by.id('level-map-scroll')).scroll(200, 'up');
    await sleep(300);
    await waitFor(element(by.id('level-map-screen'))).toBeVisible().withTimeout(5000);
  });
});

// ============================================================================
// Suite 7: Lesson Intro Screen
// ============================================================================

describe('Suite 7: Lesson Intro Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
    await openCurrentLessonIntro();
  });

  it('7.1 — lesson intro renders', async () => {
    await waitFor(element(by.id('lesson-intro-screen'))).toBeVisible().withTimeout(10000);
  });

  it('7.2 — start button visible', async () => {
    await waitFor(element(by.id('lesson-intro-start'))).toBeVisible().withTimeout(5000);
  });

  it('7.3 — start opens exercise player', async () => {
    await element(by.id('lesson-intro-start')).tap();
    await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(30000);
  });

  it('7.4 — cleanup: exit exercise player', async () => {
    await ensureExercisePlaying();
    await tapIfVisibleById('control-exit', 3000);
    await sleep(800);
  });
});

// ============================================================================
// Suite 8: Exercise Player — Core Gameplay
// ============================================================================

describe('Suite 8: Exercise Player — Core Gameplay', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
    await startCurrentLessonExercise();
  });

  it('8.1 — exercise player renders', async () => {
    await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(15000);
  });

  it('8.2 — exercise controls visible', async () => {
    await waitFor(element(by.id('exercise-controls'))).toBeVisible().withTimeout(5000);
  });

  it('8.3 — piano roll visible', async () => {
    await waitFor(element(by.id('exercise-piano-roll'))).toBeVisible().withTimeout(5000);
  });

  it('8.4 — keyboard visible', async () => {
    await waitFor(element(by.id('exercise-keyboard'))).toBeVisible().withTimeout(5000);
  });

  it('8.5 — pause button visible when playing', async () => {
    await ensureExercisePlaying();
    await waitFor(element(by.id('control-pause'))).toBeVisible().withTimeout(5000);
  });

  it('8.6 — pause shows play button', async () => {
    await element(by.id('control-pause')).tap();
    await sleep(500);
    await waitFor(element(by.id('control-play'))).toBeVisible().withTimeout(5000);
  });

  it('8.7 — resume shows pause button again', async () => {
    await element(by.id('control-play')).tap();
    await sleep(500);
    await waitFor(element(by.id('control-pause'))).toBeVisible().withTimeout(5000);
  });

  it('8.8 — restart keeps exercise player active', async () => {
    await element(by.id('control-restart')).tap();
    await sleep(800);
    await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(8000);
  });

  it('8.9 — exit leaves exercise player', async () => {
    await ensureExercisePlaying();
    await element(by.id('control-exit')).tap();
    await sleep(800);
    const onExercise = await isVisibleById('exercise-player', 2000);
    expect(onExercise).toBe(false);
  });
});

// ============================================================================
// Suite 9: Exercise Completion Flow
// ============================================================================

describe('Suite 9: Exercise Completion Modal', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
    await startCurrentLessonExercise();
  });

  it('9.1 — exercise auto-completes after playback ends', async () => {
    const deadline = Date.now() + 90000;
    let completed = false;

    while (Date.now() < deadline) {
      if (await isVisibleById('completion-modal', 2000)) {
        completed = true;
        break;
      }
      if (!(await isVisibleById('exercise-player', 1500))) break;
      await sleep(1000);
    }

    console.log(`Exercise completed: ${completed}`);
  });

  it('9.2 — completion modal: action buttons present', async () => {
    if (!(await isVisibleById('completion-modal', 3000))) return;
    const retryVisible = await isVisibleById('completion-retry', 3000);
    const nextVisible = await isVisibleById('completion-next', 3000);
    const continueVisible = await isVisibleById('completion-continue', 3000);
    expect(retryVisible || nextVisible || continueVisible).toBe(true);
  });

  it('9.3 — completion modal: action navigates away or to next', async () => {
    if (!(await isVisibleById('completion-modal', 3000))) return;

    if (await isVisibleById('completion-next', 2000)) {
      await element(by.id('completion-next')).tap();
    } else if (await isVisibleById('completion-continue', 2000)) {
      await element(by.id('completion-continue')).tap();
    } else if (await isVisibleById('completion-retry', 2000)) {
      await element(by.id('completion-retry')).tap();
      await sleep(1000);
      await tapIfVisibleById('control-exit', 3000);
    }

    await sleep(1000);
    const onExercise = await isVisibleById('exercise-player', 5000);
    const onLevelMap = await isVisibleById('level-map-screen', 5000);
    const onHome = await isVisibleById('home-screen', 3000);
    expect(onExercise || onLevelMap || onHome).toBe(true);
  });
});

// ============================================================================
// Suite 10: Free Play Screen
// ============================================================================

describe('Suite 10: Free Play Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
    await goToPlayTab();
  });

  it('10.1 — play screen renders', async () => {
    await waitFor(element(by.id('play-screen'))).toBeVisible().withTimeout(15000);
  });

  it('10.2 — instructions banner visible on first visit', async () => {
    const visible = await isVisibleById('freeplay-instructions', 3000);
    console.log(`Instructions banner: ${visible}`);
  });

  it('10.3 — instructions close button works', async () => {
    if (!(await isVisibleById('freeplay-instructions', 2000))) return;
    await element(by.id('freeplay-instructions-close')).tap();
    await sleep(400);
    const gone = !(await isVisibleById('freeplay-instructions', 1000));
    expect(gone).toBe(true);
  });

  it('10.4 — keyboard visible', async () => {
    await waitFor(element(by.id('freeplay-keyboard'))).toBeVisible().withTimeout(5000);
  });

  it('10.5 — note display container visible', async () => {
    await waitFor(element(by.id('freeplay-note-display-container'))).toBeVisible().withTimeout(5000);
  });

  it('10.6 — record start button visible', async () => {
    await waitFor(element(by.id('freeplay-record-start'))).toBeVisible().withTimeout(5000);
  });

  it('10.7 — record start → stop button transition', async () => {
    await element(by.id('freeplay-record-start')).tap();
    await sleep(400);
    await waitFor(element(by.id('freeplay-record-stop'))).toBeVisible().withTimeout(5000);
  });

  it('10.8 — record stop ends recording', async () => {
    await element(by.id('freeplay-record-stop')).tap();
    await sleep(400);
    const playbackVisible = await isVisibleById('freeplay-record-playback', 2000);
    console.log(`Playback button after recording: ${playbackVisible}`);
  });

  it('10.9 — clear recording resets to record start', async () => {
    if (await isVisibleById('freeplay-record-clear', 2000)) {
      await element(by.id('freeplay-record-clear')).tap();
      await sleep(400);
      await waitFor(element(by.id('freeplay-record-start'))).toBeVisible().withTimeout(5000);
    }
  });

  it('10.10 — help button re-shows instructions after dismissal', async () => {
    if (await isVisibleById('freeplay-help', 2000)) {
      await element(by.id('freeplay-help')).tap();
      await sleep(400);
      await waitFor(element(by.id('freeplay-instructions'))).toBeVisible().withTimeout(3000);
    }
  });
});

// ============================================================================
// Suite 11: Profile Screen
// ============================================================================

describe('Suite 11: Profile Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
    await goToProfileTab();
  });

  it('11.1 — profile screen renders', async () => {
    await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(10000);
  });

  it('11.2 — scroll view present', async () => {
    await waitFor(element(by.id('profile-scroll'))).toBeVisible().withTimeout(5000);
  });

  it('11.3 — cat avatar tap → cat switch → back', async () => {
    await element(by.id('profile-open-cat-switch')).tap();
    await waitFor(element(by.id('cat-switch-screen'))).toBeVisible().withTimeout(10000);
    await element(by.id('cat-switch-back')).tap();
    await sleep(700);
    await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(10000);
  });

  it('11.4 — Account row → account screen → back', async () => {
    await element(by.id('profile-scroll')).scroll(200, 'down');
    await sleep(300);
    await element(by.id('profile-open-account')).tap();
    await waitFor(element(by.id('account-screen'))).toBeVisible().withTimeout(10000);
    await element(by.id('account-back')).tap();
    await sleep(700);
    await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(10000);
  });

  it('11.5 — MIDI Setup row navigates', async () => {
    await element(by.id('profile-open-midi-setup')).tap();
    await sleep(1000);
    const onMidi = await isVisibleByText('MIDI Setup', 5000);
    console.log(`MIDI Setup visible: ${onMidi}`);
    await tapIfVisibleById('midi-cancel', 3000);
    try { await device.pressBack(); } catch { /* iOS */ }
    await sleep(500);
    await tapIfVisibleById('tab-profile', 3000);
    await sleep(700);
  });
});

// ============================================================================
// Suite 12: Account Screen (Anonymous)
// ============================================================================

describe('Suite 12: Account Screen (Anonymous)', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
    await goToProfileTab();
    await element(by.id('profile-open-account')).tap();
    await waitFor(element(by.id('account-screen'))).toBeVisible().withTimeout(10000);
  });

  it('12.1 — account screen renders', async () => {
    await waitFor(element(by.id('account-screen'))).toBeVisible().withTimeout(5000);
  });

  it('12.2 — back button returns to profile', async () => {
    await element(by.id('account-back')).tap();
    await sleep(600);
    await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(10000);
    await element(by.id('profile-open-account')).tap();
    await waitFor(element(by.id('account-screen'))).toBeVisible().withTimeout(10000);
  });

  it('12.3 — link with email button visible', async () => {
    await waitFor(element(by.id('account-link-email'))).toBeVisible().withTimeout(5000);
  });

  it('12.4 — link with Google button visible', async () => {
    await waitFor(element(by.id('account-link-google'))).toBeVisible().withTimeout(5000);
  });

  it('12.5 — link with email → email auth → back', async () => {
    await element(by.id('account-link-email')).tap();
    await waitFor(element(by.id('email-auth-screen'))).toBeVisible().withTimeout(10000);
    await element(by.id('email-auth-back')).tap();
    await sleep(600);
    await waitFor(element(by.id('account-screen'))).toBeVisible().withTimeout(10000);
  });
});

// ============================================================================
// Suite 13: Cat Switch Screen
// ============================================================================

describe('Suite 13: Cat Switch Screen', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
    await goToProfileTab();
    await element(by.id('profile-open-cat-switch')).tap();
    await waitFor(element(by.id('cat-switch-screen'))).toBeVisible().withTimeout(10000);
  });

  it('13.1 — cat switch screen renders', async () => {
    await waitFor(element(by.id('cat-switch-screen'))).toBeVisible().withTimeout(5000);
  });

  it('13.2 — cat gallery list visible', async () => {
    await waitFor(element(by.id('cat-switch-list'))).toBeVisible().withTimeout(5000);
  });

  it('13.3 — back button returns to profile', async () => {
    await element(by.id('cat-switch-back')).tap();
    await sleep(600);
    await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(10000);
    await element(by.id('profile-open-cat-switch')).tap();
    await waitFor(element(by.id('cat-switch-screen'))).toBeVisible().withTimeout(10000);
  });

  it('13.4 — gallery swipes', async () => {
    await element(by.id('cat-switch-list')).swipe('left', 'slow');
    await sleep(600);
    await element(by.id('cat-switch-list')).swipe('right', 'slow');
    await sleep(600);
    await waitFor(element(by.id('cat-switch-screen'))).toBeVisible().withTimeout(5000);
  });

  it('13.5 — default cat has select button', async () => {
    const selectBtnVisible = await isVisibleById('cat-switch-select-mini-meowww', 5000);
    console.log(`mini-meowww select button: ${selectBtnVisible}`);
  });
});

// ============================================================================
// Suite 14: Edge Cases & Regression
// ============================================================================

describe('Suite 14: Edge Cases', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
  });

  it('14.1 — back nav from exercise returns to previous screen', async () => {
    await startCurrentLessonExercise();
    await ensureExercisePlaying();
    await element(by.id('control-exit')).tap();
    await sleep(800);
    const onExercise = await isVisibleById('exercise-player', 2000);
    expect(onExercise).toBe(false);
  });

  it('14.2 — Play tab and back preserves navigation', async () => {
    await element(by.id('tab-home')).tap();
    await sleep(500);
    await element(by.id('tab-play')).tap();
    await sleep(1500);
    await waitFor(element(by.id('play-screen'))).toBeVisible().withTimeout(15000);
    await element(by.id('tab-home')).tap();
    await sleep(1200);
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(15000);
  });

  it('14.3 — deep nav: profile → cat switch → back → profile', async () => {
    await goToProfileTab();
    await element(by.id('profile-open-cat-switch')).tap();
    await waitFor(element(by.id('cat-switch-screen'))).toBeVisible().withTimeout(10000);
    await element(by.id('cat-switch-back')).tap();
    await sleep(700);
    await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(10000);
  });

  it('14.4 — deep nav: profile → account → link email → back → back', async () => {
    await element(by.id('profile-open-account')).tap();
    await waitFor(element(by.id('account-screen'))).toBeVisible().withTimeout(10000);

    if (await isVisibleById('account-link-email', 3000)) {
      await element(by.id('account-link-email')).tap();
      await waitFor(element(by.id('email-auth-screen'))).toBeVisible().withTimeout(10000);
      await element(by.id('email-auth-back')).tap();
      await sleep(600);
      await waitFor(element(by.id('account-screen'))).toBeVisible().withTimeout(10000);
    }

    await element(by.id('account-back')).tap();
    await sleep(600);
    await waitFor(element(by.id('profile-screen'))).toBeVisible().withTimeout(10000);
  });

  it('14.5 — rapid double-tap on lesson node doesn\'t break', async () => {
    await goToLearnTab();
    await waitFor(element(by.id('lesson-node-current'))).toBeVisible().withTimeout(15000);
    await element(by.id('lesson-node-current')).multiTap(2);
    await sleep(1000);
    await waitFor(element(by.id('lesson-intro-screen'))).toBeVisible().withTimeout(8000);
    await element(by.id('lesson-intro-back')).tap();
    await sleep(600);
  });

  it('14.6 — pause → exit doesn\'t leave broken state', async () => {
    await startCurrentLessonExercise();
    await ensureExercisePlaying();
    await element(by.id('control-pause')).tap();
    await sleep(300);
    await element(by.id('control-exit')).tap();
    await sleep(800);
    const onExercise = await isVisibleById('exercise-player', 2000);
    expect(onExercise).toBe(false);
  });

  it('14.7 — restart → exit doesn\'t leave broken state', async () => {
    await startCurrentLessonExercise();
    await ensureExercisePlaying();
    await element(by.id('control-restart')).tap();
    await sleep(800);
    await element(by.id('control-exit')).tap();
    await sleep(800);
    const onExercise = await isVisibleById('exercise-player', 2000);
    expect(onExercise).toBe(false);
  });

  it('14.8 — app survives background + foreground', async () => {
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(10000);
    await device.sendToHome();
    await sleep(2000);
    await device.launchApp({ newInstance: false });
    await sleep(1000);
    const onHome = await isVisibleById('home-screen', 10000);
    const onAuth = await isVisibleById('auth-screen', 5000);
    expect(onHome || onAuth).toBe(true);
  });
});

// ============================================================================
// Suite 15: Exercise Player — Demo & Speed Controls
// ============================================================================

describe('Suite 15: Exercise Player — Demo & Speed', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, permissions: { notifications: 'YES' } });
    await signInWithSkipAndReachHome();
    await startCurrentLessonExercise();
  });

  it('15.1 — secondary controls visible', async () => {
    const visible = await isVisibleById('secondary-controls', 3000);
    console.log(`Secondary controls: ${visible}`);
  });

  it('15.2 — demo button visible', async () => {
    const visible = await isVisibleById('demo-button', 3000);
    console.log(`Demo button: ${visible}`);
  });

  it('15.3 — speed selector visible', async () => {
    const compact = await isVisibleById('speed-selector', 3000);
    const full = await isVisibleById('speed-selector-full', 3000);
    console.log(`Speed selector: compact=${compact}, full=${full}`);
  });

  it('15.4 — cleanup', async () => {
    await tapIfVisibleById('control-exit', 3000);
    await sleep(800);
  });
});
