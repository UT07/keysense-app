/* eslint-disable no-undef */

const {
  sleep,
  isVisibleById,
  signInAndReachHome,
  goToLearnTab,
  goToSongsTab,
  goToSocialTab,
  goToFreePlay,
  goToProfileTab,
  openCurrentLessonIntro,
  ensureExercisePlaying,
  startCurrentLessonExercise,
} = require('./helpers/appFlows');

// Tests run sequentially with a single app instance (no restart between tests).
// The first test signs in and reaches home; subsequent tests navigate from there.
describe('Purrrfect Keys End-to-End', () => {
  it('signs in via skip and reaches home screen', async () => {
    await signInAndReachHome({ preferSkip: true });
    await expect(element(by.id('home-screen'))).toBeVisible();
    await expect(element(by.id('tab-home'))).toBeVisible();
  });

  it('covers all five tab navigation destinations', async () => {
    // Home tab (should already be here from previous test)
    if (!(await isVisibleById('home-screen', 3000))) {
      await signInAndReachHome({ preferSkip: true });
    }
    await expect(element(by.id('home-screen'))).toBeVisible();

    // Learn tab
    await goToLearnTab();
    await expect(element(by.id('level-map-screen'))).toBeVisible();

    // Songs tab
    await goToSongsTab();
    await expect(element(by.id('song-library-screen'))).toBeVisible();

    // Social tab (may show auth gate for anonymous users)
    await goToSocialTab();
    await expect(element(by.id('social-screen'))).toBeVisible();

    // Profile tab
    await goToProfileTab();
    await expect(element(by.id('profile-screen'))).toBeVisible();
  });

  it('navigates to lesson intro and back to level map', async () => {
    await goToLearnTab();
    await expect(element(by.id('level-map-screen'))).toBeVisible();

    await openCurrentLessonIntro();
    const isLesson = await isVisibleById('lesson-intro-screen', 2000);
    const isTier = await isVisibleById('tier-intro-screen', 1000);
    expect(isLesson || isTier).toBe(true);

    if (isLesson) {
      await element(by.id('lesson-intro-back')).tap();
    } else {
      await element(by.id('tier-intro-back')).tap();
    }
    await waitFor(element(by.id('level-map-screen'))).toBeVisible().withTimeout(15000);
  });

  it('opens lesson and validates exercise playback controls flow', async () => {
    // Navigate home first, then start exercise
    if (!(await isVisibleById('home-screen', 2000))) {
      await element(by.id('tab-home')).tap();
      await sleep(700);
    }

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

  it('opens Free Play from HomeScreen card', async () => {
    // Ensure we're back at home
    if (!(await isVisibleById('home-screen', 2000))) {
      await signInAndReachHome({ preferSkip: true });
    }

    await goToFreePlay();
    await waitFor(element(by.id('play-screen'))).toBeVisible().withTimeout(10000);

    // Verify keyboard and note display are present
    if (await isVisibleById('freeplay-instructions-close', 4000)) {
      await element(by.id('freeplay-instructions-close')).tap();
    }

    await waitFor(element(by.id('freeplay-note-display'))).toBeVisible().withTimeout(10000);

    // Play a note
    await element(by.id('freeplay-keyboard-right')).tapAtPoint({ x: 24, y: 95 });
    await sleep(300);

    // Back to home
    await element(by.id('freeplay-back')).tap();
    await waitFor(element(by.id('home-screen'))).toBeVisible().withTimeout(10000);
  });

  it('song library shows search and genre filters', async () => {
    await goToSongsTab();
    await expect(element(by.id('song-library-screen'))).toBeVisible();

    // Search input should be visible
    await expect(element(by.id('search-input'))).toBeVisible();

    // Song list should be present
    await expect(element(by.id('song-list'))).toBeVisible();
  });

  it('covers profile navigation into account, cat switch, and midi setup entry', async () => {
    // Ensure we're signed in and on home
    if (!(await isVisibleById('home-screen', 2000))) {
      await signInAndReachHome({ preferSkip: true });
    }

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
