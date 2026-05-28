import { defineConfig } from '@playwright/test'

export default defineConfig({
  workers: 1,
  testMatch: '**/*.spec.ts',
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 }
  },
  timeout: 30000
})
