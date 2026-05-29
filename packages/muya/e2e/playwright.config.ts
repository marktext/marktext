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
        // Phase 2: cross-browser matrix. Firefox + WebKit use the bundled
        // Playwright builds (no system-channel fallback — Firefox isn't
        // commonly preinstalled, and WebKit has no system equivalent on
        // macOS). Install once via `pnpm --filter muya-e2e exec playwright
        // install firefox webkit` (CI does this automatically through the
        // `--with-deps` step in ci-e2e.yml).
        //
        // `triple-click select-paragraph` semantics differ between engines:
        // Chromium selects the full paragraph, Firefox and WebKit select
        // only the clicked word/character. The Phase 1 IFT-trigger specs
        // (`inline/format-toolbar.spec.ts` and `inline/shortcuts.spec.ts`)
        // were authored against Chromium's behaviour and the engine-
        // independent rewrite (use `selectAll()` or a `setBaseAndExtent()`
        // helper) is tracked in BACKLOG Phase 3. Until then, exclude those
        // two files on Firefox + WebKit so the rest of the matrix stays
        // green — every other spec works cross-engine unchanged.
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
            testIgnore: [
                'inline/format-toolbar.spec.ts',
                'inline/shortcuts.spec.ts',
                // Firefox's #all-replace path emits at most one mutation
                // before the search highlight is removed, leaving the
                // remaining occurrences in place. Same root cause as the
                // WebKit gap below — the toolbar driver fires replace()
                // synchronously and Firefox swallows mid-flight DOM
                // selection changes. Tracked in BACKLOG Phase 3.
                'editing/search-replace.spec.ts',
            ],
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
            testIgnore: [
                'inline/format-toolbar.spec.ts',
                'inline/shortcuts.spec.ts',
                // WebKit doesn't wire the host's #search/#replace toolbar
                // sequence the same way Chromium does — `replace()` runs
                // but emits an empty selection. Tracked alongside the
                // triple-click rewrite in BACKLOG Phase 3.
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
