/* eslint-disable no-undef */

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

async function completeOnboardingBeginnerFlow() {
  const deadline = Date.now() + 120000;

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
      await tapIfVisibleById('onboarding-midi-no', 600);
      if (await tapIfVisibleById('onboarding-midi-next', 600)) {
        await sleep(450);
      }
      continue;
    }

    if (await isVisibleById('onboarding-step-4', 800)) {
      await tapIfVisibleById('onboarding-goal-songs', 600);
      if (await tapIfVisibleById('onboarding-finish', 600)) {
        await sleep(1000);
      }
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

    await sleep(300);
  }

  throw new Error('Timed out while navigating onboarding intermediate flow to Skill Check');
}

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
      if (await isVisibleByText('Go home', 500)) {
        await element(by.text('Go home')).tap();
        await sleep(800);
        continue;
      }
      if (await isVisibleById('home-screen', 700)) {
        // Ensure bottom tabs are mounted before considering navigation stable.
        if (await isVisibleById('tab-home', 700)) {
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

    if (await isVisibleByText('Go home', 600)) {
      await element(by.text('Go home')).tap();
      await sleep(900);
      continue;
    }

    await sleep(500);
  }

  throw new Error('Timed out while trying to reach home screen from current app state');
}

async function signInWithSkipAndReachHome() {
  return signInAndReachHome({ preferSkip: true });
}

async function goToLearnTab() {
  await waitFor(element(by.id('tab-learn'))).toBeVisible().withTimeout(15000);
  await element(by.id('tab-learn')).tap();
  await waitFor(element(by.id('level-map-screen'))).toBeVisible().withTimeout(20000);
}

async function goToPlayTab() {
  const deadline = Date.now() + 45000;

  while (Date.now() < deadline) {
    if (await isVisibleById('play-screen', 1200)) {
      return;
    }

    if (await tapIfVisibleById('tab-play', 1200)) {
      await sleep(700);
      if (await isVisibleById('play-screen', 2000)) {
        return;
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

    if (await tapIfVisibleById('tab-home', 500)) {
      await sleep(500);
    } else {
      await sleep(500);
    }
  }

  throw new Error('Timed out navigating to play tab');
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

async function openCurrentLessonIntro() {
  await goToLearnTab();

  for (let attempt = 0; attempt < 4; attempt++) {
    await waitFor(element(by.id('lesson-node-current'))).toBeVisible().withTimeout(25000);

    if (await isVisibleById('lesson-node-start-chip', 800)) {
      await element(by.id('lesson-node-start-chip')).tap();
    } else {
      await element(by.id('lesson-node-current')).tap();
    }

    if (await isVisibleById('lesson-intro-screen', 7000)) {
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
  await waitFor(element(by.id('lesson-intro-start'))).toBeVisible().withTimeout(10000);
  await element(by.id('lesson-intro-start')).tap();

  await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(30000);
  await ensureExercisePlaying();
}

module.exports = {
  sleep,
  isVisibleById,
  isVisibleByText,
  tapIfVisibleById,
  openEmailAuthAndReturn,
  signInAndReachHome,
  signInWithSkipAndReachHome,
  completeOnboardingBeginnerFlow,
  completeOnboardingIntermediateToSkillCheck,
  goToLearnTab,
  goToPlayTab,
  goToProfileTab,
  openCurrentLessonIntro,
  ensureExercisePlaying,
  startCurrentLessonExercise,
};
