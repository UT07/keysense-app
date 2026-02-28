/* eslint-disable no-undef */

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function isVisibleById(id, timeout = 3000) {
  try {
    await waitFor(element(by.id(id))).toBeVisible().withTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

async function isVisibleByText(text, timeout = 1200) {
  try {
    await waitFor(element(by.text(text))).toBeVisible().withTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

async function tapIfVisibleById(id, timeout = 1200) {
  if (await isVisibleById(id, timeout)) {
    await element(by.id(id)).tap();
    return true;
  }
  return false;
}

async function dismissTransientAlerts() {
  if (await isVisibleByText('OK', 350)) {
    await element(by.text('OK')).tap();
    await sleep(350);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Onboarding flows
// ---------------------------------------------------------------------------

async function completeOnboardingBeginnerFlow() {
  const deadline = Date.now() + 120000;
  const starterCatChooseIds = [
    'onboarding-choose-mini-meowww',
    'onboarding-choose-jazzy',
    'onboarding-choose-luna',
  ];

  while (Date.now() < deadline) {
    if (!(await isVisibleById('onboarding-screen', 1200))) {
      return;
    }

    if (await tapIfVisibleById('onboarding-get-started', 800)) {
      await sleep(450);
      continue;
    }

    if (await isVisibleById('onboarding-step-2', 800)) {
      await tapIfVisibleById('onboarding-experience-beginner', 600);
      if (await tapIfVisibleById('onboarding-experience-next', 600)) {
        await sleep(450);
      }
      continue;
    }

    if (await isVisibleById('onboarding-step-3', 800)) {
      // Current onboarding uses "input" IDs; keep legacy MIDI IDs as fallback.
      await tapIfVisibleById('onboarding-input-touch', 600) || await tapIfVisibleById('onboarding-midi-no', 600);
      if ((await tapIfVisibleById('onboarding-input-next', 600))
        || (await tapIfVisibleById('onboarding-midi-next', 600))) {
        await sleep(450);
      }
      continue;
    }

    if (await isVisibleById('onboarding-step-4', 800)) {
      await tapIfVisibleById('onboarding-goal-songs', 600);
      if ((await tapIfVisibleById('onboarding-goal-next', 600))
        || (await tapIfVisibleById('onboarding-finish', 600))) {
        await sleep(700);
      }
      continue;
    }

    if (await isVisibleById('onboarding-step-5', 800)) {
      for (const chooseId of starterCatChooseIds) {
        if (await tapIfVisibleById(chooseId, 350)) {
          break;
        }
      }

      if (!(await isVisibleById('onboarding-finish', 500)) && (await isVisibleById('onboarding-scroll', 500))) {
        try {
          await waitFor(element(by.id('onboarding-finish')))
            .toBeVisible()
            .whileElement(by.id('onboarding-scroll'))
            .scroll(220, 'down');
        } catch {
          // Ignore if already near the bottom or transient animation blocks scrolling.
        }
      }

      if (await tapIfVisibleById('onboarding-finish', 800)) {
        await sleep(1200);
      } else {
        await sleep(350);
      }
      continue;
    }

    if (await isVisibleById('onboarding-scroll', 500)) {
      try {
        await element(by.id('onboarding-scroll')).scroll(140, 'down');
      } catch {
        // Keep the loop alive and let step-specific handlers retry.
      }
      await sleep(250);
      continue;
    }

    await sleep(350);
  }

  throw new Error('Timed out while completing onboarding beginner flow');
}

async function completeOnboardingIntermediateToSkillCheck() {
  const deadline = Date.now() + 120000;

  while (Date.now() < deadline) {
    if (await isVisibleById('skill-assessment-screen', 1200)) {
      return;
    }

    if (!(await isVisibleById('onboarding-screen', 1200))) {
      await sleep(300);
      continue;
    }

    if (await tapIfVisibleById('onboarding-get-started', 700)) {
      await sleep(450);
      continue;
    }

    if (await isVisibleById('onboarding-step-2', 700)) {
      await tapIfVisibleById('onboarding-experience-intermediate', 500);
      if (await tapIfVisibleById('onboarding-experience-next', 600)) {
        await sleep(900);
      }
      continue;
    }

    if (await isVisibleById('onboarding-step-3', 700)) {
      await tapIfVisibleById('onboarding-input-touch', 500) || await tapIfVisibleById('onboarding-midi-no', 500);
      if ((await tapIfVisibleById('onboarding-input-next', 600))
        || (await tapIfVisibleById('onboarding-midi-next', 600))) {
        await sleep(1200);
      }
      continue;
    }

    await sleep(300);
  }

  throw new Error('Timed out while navigating onboarding intermediate flow to Skill Check');
}

// ---------------------------------------------------------------------------
// Auth flows
// ---------------------------------------------------------------------------

async function openEmailAuthAndReturn() {
  if (!(await isVisibleById('auth-screen', 12000))) return;

  await waitFor(element(by.id('email-signin'))).toBeVisible().withTimeout(30000);
  await element(by.id('email-signin')).tap();
  await waitFor(element(by.id('email-input'))).toBeVisible().withTimeout(15000);
  await element(by.id('email-auth-back')).tap();
  await waitFor(element(by.id('auth-screen'))).toBeVisible().withTimeout(15000);
}

async function signInAndReachHome(options = {}) {
  const { preferSkip = false } = options;
  const deadline = Date.now() + 180000;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  let emailAttempted = false;

  while (Date.now() < deadline) {
    if (await isVisibleById('home-screen', 1200)) {
      await sleep(900);
      if (await isVisibleById('onboarding-screen', 700)) {
        await completeOnboardingBeginnerFlow();
        await sleep(800);
        continue;
      }
      if (await isVisibleById('home-screen', 700)) {
        // Tab bar may take several seconds to mount after the onboarding
        // modal dismisses, or after the navigation stack switches from
        // auth to authenticated. Wait up to 10s for tabs to appear.
        if (await isVisibleById('tab-home', 8000)) {
          return;
        }
        // Even without tabs visible, if home-screen persists it may be
        // a layout/animation delay — accept it after 2 extra seconds.
        await sleep(2000);
        if (await isVisibleById('home-screen', 1000)) {
          return;
        }
      }
    }

    if (await dismissTransientAlerts()) {
      continue;
    }

    if (await isVisibleById('onboarding-screen', 1000)) {
      await completeOnboardingBeginnerFlow();
      await sleep(800);
      continue;
    }

    if ((await isVisibleById('auth-screen', 1000)) && (await isVisibleById('skip-signin', 1200))) {
      if (!preferSkip && !emailAttempted && email && password) {
        emailAttempted = true;
        await element(by.id('email-signin')).tap();
        await waitFor(element(by.id('email-input'))).toBeVisible().withTimeout(15000);
        await element(by.id('email-input')).clearText();
        await element(by.id('email-input')).typeText(email);
        await element(by.id('password-input')).clearText();
        await element(by.id('password-input')).typeText(password);
        await element(by.id('submit-button')).tap();
        await sleep(1200);
        continue;
      }

      await sleep(350);
      try {
        await element(by.id('skip-signin')).tap();
      } catch {
        await sleep(500);
      }
      await sleep(700);
      continue;
    }

    if (await tapIfVisibleById('email-auth-back', 600)) {
      await sleep(500);
      continue;
    }

    if (await tapIfVisibleById('tab-home', 600)) {
      await sleep(700);
      continue;
    }

    await sleep(500);
  }

  throw new Error('Timed out while trying to reach home screen from current app state');
}

async function signInWithSkipAndReachHome() {
  return signInAndReachHome({ preferSkip: true });
}

// ---------------------------------------------------------------------------
// Tab navigation
// Current tabs: Home | Learn | Songs | Social | Profile
// ---------------------------------------------------------------------------

async function goToLearnTab() {
  const deadline = Date.now() + 60000;

  while (Date.now() < deadline) {
    if (await isVisibleById('level-map-screen', 1200)) {
      return;
    }

    if (await isVisibleById('daily-session-screen', 1200)) {
      if (!(await isVisibleById('daily-session-browse-lessons', 600))) {
        try {
          await waitFor(element(by.id('daily-session-browse-lessons')))
            .toBeVisible()
            .whileElement(by.id('daily-session-scroll'))
            .scroll(400, 'down');
        } catch {
          // If scroll fails (boundary or transient), keep retry loop alive.
        }
      }

      if (await tapIfVisibleById('daily-session-browse-lessons', 1200)) {
        await sleep(800);
        continue;
      }
    }

    if (await isVisibleByText('Continue', 600)) {
      try {
        await element(by.text('Continue')).tap();
        await sleep(700);
        continue;
      } catch {
        // Multiple "Continue" labels may exist; keep trying other routes.
      }
    }

    if (await tapIfVisibleById('tab-learn', 1200)) {
      await sleep(700);
      continue;
    }

    if (await isVisibleById('tier-intro-screen', 500) && (await tapIfVisibleById('tier-intro-back', 700))) {
      await sleep(600);
      continue;
    }

    if (await isVisibleById('lesson-intro-screen', 500) && (await tapIfVisibleById('lesson-intro-back', 700))) {
      await sleep(600);
      continue;
    }

    if (await isVisibleById('exercise-player', 500) && (await tapIfVisibleById('control-exit', 700))) {
      await sleep(800);
      continue;
    }

    await sleep(500);
  }

  throw new Error('Timed out navigating to level map from Learn tab');
}

async function goToSongsTab() {
  const deadline = Date.now() + 45000;

  while (Date.now() < deadline) {
    if (await isVisibleById('song-library-screen', 1200)) {
      return;
    }

    if (await tapIfVisibleById('tab-songs', 1200)) {
      await sleep(700);
      if (await isVisibleById('song-library-screen', 2000)) {
        return;
      }
    }

    // Dismiss any blocking overlays
    if (await tapIfVisibleById('lesson-intro-back', 500)) {
      await sleep(500);
      continue;
    }

    if (await isVisibleById('exercise-player', 500) && (await tapIfVisibleById('control-exit', 500))) {
      await sleep(800);
      continue;
    }

    if (await tapIfVisibleById('tab-home', 500)) {
      await sleep(500);
    } else {
      await sleep(500);
    }
  }

  throw new Error('Timed out navigating to Songs tab');
}

async function goToSocialTab() {
  const deadline = Date.now() + 45000;

  while (Date.now() < deadline) {
    if (await isVisibleById('social-screen', 1200)) {
      return;
    }

    if (await tapIfVisibleById('tab-social', 1200)) {
      await sleep(700);
      if (await isVisibleById('social-screen', 2000)) {
        return;
      }
    }

    // Dismiss blocking stack screens
    if (await isVisibleById('leaderboard-screen', 500) && (await tapIfVisibleById('leaderboard-back', 700))) {
      await sleep(600);
      continue;
    }

    if (await isVisibleById('friends-screen', 500) && (await tapIfVisibleById('friends-back', 700))) {
      await sleep(600);
      continue;
    }

    if (await isVisibleById('add-friend-screen', 500) && (await tapIfVisibleById('add-friend-back', 700))) {
      await sleep(600);
      continue;
    }

    if (await tapIfVisibleById('lesson-intro-back', 500)) {
      await sleep(500);
      continue;
    }

    if (await isVisibleById('exercise-player', 500) && (await tapIfVisibleById('control-exit', 500))) {
      await sleep(800);
      continue;
    }

    if (await tapIfVisibleById('tab-home', 500)) {
      await sleep(500);
    } else {
      await sleep(500);
    }
  }

  throw new Error('Timed out navigating to Social tab');
}

/**
 * Navigate to Free Play screen.
 * Free Play moved from tab to HomeScreen card in Phase 10.5.
 * Route: HomeScreen → tap free-play-card → FreePlay (PlayScreen)
 */
async function goToFreePlay() {
  const deadline = Date.now() + 45000;

  while (Date.now() < deadline) {
    if (await isVisibleById('play-screen', 1200)) {
      return;
    }

    // If we're on home, tap the free play card
    if (await isVisibleById('home-screen', 800)) {
      if (await tapIfVisibleById('free-play-card', 1200)) {
        await sleep(700);
        if (await isVisibleById('play-screen', 3000)) {
          return;
        }
      }
    }

    // Navigate to home first
    if (await tapIfVisibleById('tab-home', 1200)) {
      await sleep(700);
      continue;
    }

    // Dismiss blocking overlays
    if (await tapIfVisibleById('lesson-intro-back', 500)) {
      await sleep(500);
      continue;
    }

    if (await isVisibleById('exercise-player', 500) && (await tapIfVisibleById('control-exit', 500))) {
      await sleep(800);
      continue;
    }

    if (await tapIfVisibleById('freeplay-back', 500)) {
      await sleep(500);
      continue;
    }

    await sleep(500);
  }

  throw new Error('Timed out navigating to Free Play screen');
}

async function goToProfileTab() {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    if (await isVisibleById('profile-screen', 1200)) {
      return;
    }

    // Dismiss blocking stack/modals first. Tab bar is hidden while these are active.
    if (await isVisibleById('account-screen', 700)) {
      if (await tapIfVisibleById('account-back', 900)) {
        await sleep(700);
        continue;
      }
    }

    if (await isVisibleById('cat-switch-screen', 700)) {
      if (await tapIfVisibleById('cat-switch-back', 900)) {
        await sleep(700);
        continue;
      }
    }

    if (await isVisibleById('midi-setup-screen', 700)) {
      if (await tapIfVisibleById('midi-cancel', 900)) {
        await sleep(700);
        continue;
      }
    }

    if (await tapIfVisibleById('tab-profile', 1200)) {
      await sleep(700);
      if (await isVisibleById('profile-screen', 2000)) {
        return;
      }
    }

    if (await isVisibleByText('Profile', 800)) {
      try {
        await element(by.text('Profile')).tap();
        await sleep(700);
        if (await isVisibleById('profile-screen', 2000)) {
          return;
        }
      } catch {
        // If multiple matching labels exist, continue with other fallbacks.
      }
    }

    if (await tapIfVisibleById('lesson-intro-back', 500)) {
      await sleep(500);
      continue;
    }

    if (await isVisibleById('exercise-player', 500) && (await tapIfVisibleById('control-exit', 500))) {
      await sleep(800);
      continue;
    }

    if (await tapIfVisibleById('email-auth-back', 500)) {
      await sleep(500);
      continue;
    }

    if (await isVisibleById('auth-screen', 700)) {
      await signInAndReachHome({ preferSkip: true });
      continue;
    }

    if (await isVisibleById('onboarding-screen', 700)) {
      await completeOnboardingBeginnerFlow();
      await sleep(700);
      continue;
    }

    if (await tapIfVisibleById('tab-home', 500)) {
      await sleep(500);
      continue;
    }

    await sleep(500);
  }

  throw new Error('Timed out navigating to profile tab');
}

// ---------------------------------------------------------------------------
// Exercise flows
// ---------------------------------------------------------------------------

async function openCurrentLessonIntro() {
  await goToLearnTab();

  for (let attempt = 0; attempt < 4; attempt++) {
    await waitFor(element(by.id('lesson-node-current'))).toBeVisible().withTimeout(25000);

    if (await isVisibleById('lesson-node-start-chip', 800)) {
      await element(by.id('lesson-node-start-chip')).tap();
    } else {
      await element(by.id('lesson-node-current')).tap();
    }

    if ((await isVisibleById('lesson-intro-screen', 7000))
      || (await isVisibleById('tier-intro-screen', 1000))) {
      return;
    }

    if (await isVisibleById('level-map-scroll', 500)) {
      try {
        await element(by.id('level-map-scroll')).scroll(140, 'down');
      } catch {
        // Ignore boundary scroll failures.
      }
      await sleep(350);
    }
  }

  throw new Error('Timed out opening current lesson intro from level map');
}

async function ensureExercisePlaying() {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    if (await isVisibleById('control-pause', 800)) {
      return;
    }

    // Handle new "Watch First" + "Ready" intro overlay
    if (await isVisibleById('intro-ready', 1000)) {
      await element(by.id('intro-ready')).tap();
      await sleep(700);
      continue;
    }

    if (await isVisibleById('exercise-intro-ready', 1000)) {
      await element(by.id('exercise-intro-ready')).tap();
      await sleep(700);
      continue;
    }

    if (await isVisibleById('control-play', 800)) {
      await element(by.id('control-play')).tap();
      await sleep(700);
      continue;
    }

    await sleep(500);
  }

  throw new Error('Timed out waiting for exercise to enter playing state');
}

async function startCurrentLessonExercise() {
  await openCurrentLessonIntro();
  if (await isVisibleById('lesson-intro-screen', 1200)) {
    await waitFor(element(by.id('lesson-intro-start'))).toBeVisible().withTimeout(10000);
    await element(by.id('lesson-intro-start')).tap();
  } else {
    await waitFor(element(by.id('tier-intro-start'))).toBeVisible().withTimeout(10000);
    await element(by.id('tier-intro-start')).tap();
  }

  await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(30000);
  await ensureExercisePlaying();
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  sleep,
  isVisibleById,
  isVisibleByText,
  tapIfVisibleById,
  dismissTransientAlerts,
  openEmailAuthAndReturn,
  signInAndReachHome,
  signInWithSkipAndReachHome,
  completeOnboardingBeginnerFlow,
  completeOnboardingIntermediateToSkillCheck,
  goToLearnTab,
  goToSongsTab,
  goToSocialTab,
  goToFreePlay,
  goToProfileTab,
  openCurrentLessonIntro,
  ensureExercisePlaying,
  startCurrentLessonExercise,
  // Legacy alias — some old tests may reference this
  goToPlayTab: goToFreePlay,
};
