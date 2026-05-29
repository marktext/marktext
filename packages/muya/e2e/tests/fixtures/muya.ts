import { test as base, expect } from '@playwright/test';

/**
 * Auto-fixture: every spec gets a page that has already loaded the host,
 * waited for `muya.init()` to finish, and confirmed window.muya is ready.
 */
export const test = base.extend<{ muyaReady: void }>({
    muyaReady: [async ({ page }, use) => {
        await page.goto('/');
        await page.waitForFunction(
            () => window.muya?.editor?.scrollPage != null,
            undefined,
            { timeout: 15_000 },
        );
        await use();
    }, { auto: true }],
});

export { expect };
