const { device, element, by, waitFor } = require('detox');

describe('Sanity Check', () => {
    beforeAll(async () => {
        await device.launchApp({ delete: true });
    });

    it('should launch successfully and show onboarding, auth, or home', async () => {
        // Wait for *anything* recognizable
        let found = false;

        try {
            await waitFor(element(by.id('onboarding-screen')))
                .toBeVisible()
                .withTimeout(15000);
            console.log('Sanity: Onboarding Visible');
            found = true;
        } catch (_e) {
            // Not onboarding — try next
        }

        if (!found) {
            try {
                await waitFor(element(by.id('auth-screen')))
                    .toBeVisible()
                    .withTimeout(10000);
                console.log('Sanity: Auth Visible');
                found = true;
            } catch (_e) {
                // Not auth — try next
            }
        }

        if (!found) {
            await waitFor(element(by.id('home-screen')))
                .toBeVisible()
                .withTimeout(30000);
            console.log('Sanity: Home Visible');
        }
    });
});
