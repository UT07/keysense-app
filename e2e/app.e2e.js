/* eslint-disable no-undef */

const {
  sleep,
  isVisibleById,
  openEmailAuthAndReturn,
  signInAndReachHome,
  signInWithSkipAndReachHome,
  completeOnboardingIntermediateToSkillCheck,
  goToLearnTab,
  goToPlayTab,
  goToProfileTab,
  openCurrentLessonIntro,
  ensureExercisePlaying,
  startCurrentLessonExercise,
} = require('./helpers/appFlows');

describe('Purrrfect Keys End-to-End', () => {
  it('covers auth + onboarding via email entry and skip fallback', async () => {
    await waitFor(element(by.id('auth-screen'))).toBeVisible().withTimeout(30000);

    await openEmailAuthAndReturn();
    await signInAndReachHome();

    await expect(element(by.id('home-screen'))).toBeVisible();
    await expect(element(by.id('tab-home'))).toBeVisible();
  });

  it('supports skip-signin path to authenticated home', async () => {
    await signInWithSkipAndReachHome();

    await expect(element(by.id('home-screen'))).toBeVisible();
  });

  it('routes intermediate onboarding to skill check with countdown and two-line guides', async () => {
    await waitFor(element(by.id('auth-screen'))).toBeVisible().withTimeout(30000);
    await element(by.id('skip-signin')).tap();

    await completeOnboardingIntermediateToSkillCheck();
    await expect(element(by.id('skill-assessment-screen'))).toBeVisible();
    await expect(element(by.id('assessment-intro'))).toBeVisible();

    await element(by.id('assessment-start-round')).tap();
    await waitFor(element(by.id('assessment-countin'))).toBeVisible().withTimeout(8000);

    await expect(element(by.id('press-line'))).toBeVisible();
    if (await isVisibleById('release-line', 1500)) {
      await expect(element(by.id('release-line'))).toBeVisible();
    }

    // During countdown, taps should be allowed without crashing scoring lifecycle.
    await element(by.id('assessment-keyboard')).tapAtPoint({ x: 120, y: 95 });
    await sleep(500);
    await expect(element(by.id('assessment-countin'))).toBeVisible();
  });

  it('opens lesson and validates exercise playback controls flow', async () => {
    await signInAndReachHome();

    await startCurrentLessonExercise();
    await waitFor(element(by.id('exercise-player'))).toBeVisible().withTimeout(20000);
    await ensureExercisePlaying();

    await waitFor(element(by.id('control-pause'))).toBeVisible().withTimeout(20000);
    await element(by.id('speed-selector')).tap();
    await element(by.id('control-pause')).tap();

    if (await isVisibleById('control-restart', 3000)) {
      await element(by.id('control-restart')).tap();
    }

    if (await isVisibleById('control-exit', 5000)) {
      await element(by.id('control-exit')).tap();
      await waitFor(element(by.id('lesson-intro-screen'))).toBeVisible().withTimeout(20000);
    } else if (await isVisibleById('completion-continue', 5000)) {
      await element(by.id('completion-continue')).tap();
    }
  });

  it('covers tab navigation and lesson intro return path', async () => {
    await signInAndReachHome();

    await goToLearnTab();
    await expect(element(by.id('level-map-screen'))).toBeVisible();

    await openCurrentLessonIntro();
    await expect(element(by.id('lesson-intro-screen'))).toBeVisible();
    await element(by.id('lesson-intro-back')).tap();
    await waitFor(element(by.id('level-map-screen'))).toBeVisible().withTimeout(15000);

    await goToPlayTab();
    await expect(element(by.id('play-screen'))).toExist();
  });

  it('registers distinct free-play taps and recording controls', async () => {
    await signInAndReachHome();

    await goToPlayTab();
    await waitFor(element(by.id('freeplay-keyboard'))).toBeVisible().withTimeout(15000);

    if (await isVisibleById('freeplay-instructions-close', 4000)) {
      await element(by.id('freeplay-instructions-close')).tap();
    }

    await waitFor(element(by.id('freeplay-note-display'))).toBeVisible().withTimeout(10000);

    await element(by.id('freeplay-keyboard')).tapAtPoint({ x: 24, y: 95 });
    await expect(element(by.id('freeplay-note-display'))).toHaveText('C3');

    await element(by.id('freeplay-keyboard')).tapAtPoint({ x: 300, y: 95 });
    await expect(element(by.id('freeplay-note-display'))).toHaveText('F3');

    await element(by.id('freeplay-record-start')).tap();
    await waitFor(element(by.id('freeplay-record-stop'))).toBeVisible().withTimeout(10000);
    await element(by.id('freeplay-keyboard')).tapAtPoint({ x: 120, y: 95 });
    await element(by.id('freeplay-record-stop')).tap();

    await waitFor(element(by.id('freeplay-record-playback'))).toBeVisible().withTimeout(10000);
    await waitFor(element(by.id('freeplay-record-clear'))).toBeVisible().withTimeout(10000);
  });

  it('covers profile navigation into account, cat switch, and midi setup entry', async () => {
    await signInAndReachHome();

    const openProfileDestination = async ({
      triggerId,
      destinationId,
      scrollDirection,
    }) => {
      await waitFor(element(by.id(triggerId)))
        .toBeVisible()
        .whileElement(by.id('profile-scroll'))
        .scroll(260, scrollDirection);

      for (let attempt = 0; attempt < 3; attempt++) {
        await sleep(250);
        await element(by.id(triggerId)).tap();
        if (await isVisibleById(destinationId, 5000)) {
          return;
        }

        try {
          await element(by.id('profile-scroll')).scroll(120, scrollDirection);
        } catch {
          // Ignore boundary scroll failures during retry nudge.
        }
      }

      throw new Error(`Timed out opening destination ${destinationId} from ${triggerId}`);
    };

    await goToPlayTab();
    await goToProfileTab();

    await openProfileDestination({
      triggerId: 'profile-open-account',
      destinationId: 'account-screen',
      scrollDirection: 'down',
    });
    await element(by.id('account-back')).tap();
    await goToProfileTab();

    await openProfileDestination({
      triggerId: 'profile-open-cat-switch-row',
      destinationId: 'cat-switch-screen',
      scrollDirection: 'down',
    });
    await element(by.id('cat-switch-back')).tap();
    await goToProfileTab();

    await openProfileDestination({
      triggerId: 'profile-open-midi-setup',
      destinationId: 'midi-setup-screen',
      scrollDirection: 'down',
    });
  });
});
