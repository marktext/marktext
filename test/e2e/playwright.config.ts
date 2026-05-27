import { defineConfig } from '@playwright/test'

export default defineConfig({
  workers: 1,
  testMatch: '**/*.spec.ts',
  // Retry flaky E2E tests once on CI, zero times locally
  retries: process.env.CI ? 2 : 0,
  // Per-test timeout (launch + interaction); set higher for slower CI runners
  timeout: 60000,
  // Overall suite guard so a hung test can't stall CI indefinitely
  globalTimeout: process.env.CI ? 20 * 60 * 1000 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    // Capture trace on first retry to aid post-mortem debugging
    trace: 'on-first-retry',
    // Screenshot on failure so CI artifacts show what went wrong
    screenshot: 'only-on-failure',
    // Record video on retry so we can watch what happened
    video: 'on-first-retry'
  }
})
