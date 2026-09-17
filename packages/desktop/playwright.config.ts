import { defineConfig } from '@playwright/test'

// Must stay at the package root: Playwright only auto-loads a config from the
// directory it is invoked in, and every entry point (`pnpm test:e2e`, a single
// `playwright test <spec>` run, CI) invokes it from packages/desktop. Kept in
// test/e2e/ the settings below were silently ignored and the suite ran on
// Playwright's defaults — notably ~half the cores as workers instead of 1.
export default defineConfig({
  testDir: './test/e2e',
  workers: 1,
  testMatch: '**/*.spec.ts',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 }
  },
  timeout: 30000
})
