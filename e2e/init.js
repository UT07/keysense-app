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
  // Keep startup stabilization lightweight to avoid long beforeEach stalls.
  await maybeOpenExpoDevServer();
  await maybeCloseExpoDevMenuPanel();
  await maybeDismissExpoDevMenuNux();
}

if (process.env.E2E_SKIP_GLOBAL_INIT !== '1') {
  beforeEach(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
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
    await device.disableSynchronization();
  }, 120000);
}
