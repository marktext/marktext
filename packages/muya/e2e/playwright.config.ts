import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    use: {
        baseURL: 'http://localhost:5174',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // CI downloads bundled Chromium via `playwright install chromium`.
                // Local dev falls back to the system Chrome install to avoid
                // the ~170 MB Chromium-for-Testing download which is flaky on
                // some networks. Set PLAYWRIGHT_USE_BUNDLED_CHROMIUM=1 locally
                // if you actually want the bundled binary.
                channel: process.env.CI || process.env.PLAYWRIGHT_USE_BUNDLED_CHROMIUM
                    ? undefined
                    : 'chrome',
            },
        },
        // Toolbar selection and replace drivers depend on Chromium behavior.
        // Keep these exclusions until their drivers work across browsers.
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
            testIgnore: [
                'inline/format-toolbar.spec.ts',
                'inline/shortcuts.spec.ts',
                'editing/search-replace.spec.ts',
            ],
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
            testIgnore: [
                'inline/format-toolbar.spec.ts',
                'inline/shortcuts.spec.ts',
                'editing/search-replace.spec.ts',
            ],
        },
    ],
    webServer: {
        command: 'pnpm exec vite --port 5174 --strictPort',
        url: 'http://localhost:5174',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
        stderr: 'pipe',
    },
});
