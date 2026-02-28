async function maybeOpenExpoDevServer() {
  const localhostEntry = element(by.text('http://localhost:8081'));

  try {
    await waitFor(localhostEntry).toBeVisible().withTimeout(4000);
    await localhostEntry.tap();
    await waitFor(localhostEntry).toBeNotVisible().withTimeout(30000);
  } catch {
    // Not running inside Expo Dev Launcher, or app was already loaded.
  }
}

async function maybeDismissExpoDevMenuNux() {
  const continueButton = element(by.text('Continue'));

  try {
    await waitFor(continueButton).toBeVisible().withTimeout(3000);
    await continueButton.tap();
    await waitFor(continueButton).toBeNotVisible().withTimeout(3000);
  } catch {
    // Expo dev menu first-run prompt not present.
  }
}

async function maybeCloseExpoDevMenuPanel() {
  const goHome = element(by.text('Go home'));
  try {
    await waitFor(goHome).toBeVisible().withTimeout(800);
    await goHome.tap();
    await waitFor(goHome).toBeNotVisible().withTimeout(3000);
  } catch {
    // Dev menu panel not present.
  }
}

async function stabilizeExpoRuntime() {
  // Expo Dev Client has recurring timers that block Detox synchronization.
  // Disable sync first so we can interact with the dev client UI.
  await device.disableSynchronization();
  await maybeOpenExpoDevServer();
  await maybeCloseExpoDevMenuPanel();
  await maybeDismissExpoDevMenuNux();
}

if (process.env.E2E_SKIP_GLOBAL_INIT !== '1') {
  // Launch the app ONCE per test file. Expo Dev Client creates recurring
  // native timers that prevent Detox from receiving the isReady signal on
  // subsequent launches with newInstance:true. Using beforeAll avoids the
  // Metro-reconnection deadlock; tests within a file share the app instance.
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: {
        notifications: 'YES',
      },
      launchArgs: {
        EXDevMenuDisableAutoLaunch: 'YES',
        EXDevMenuIsOnboardingFinished: 'YES',
        EXDevMenuShowsAtLaunch: 'NO',
      },
    });
    await stabilizeExpoRuntime();
  }, 120000);
}
