import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

let app: ElectronApplication
let page: Page

test.beforeAll(async() => {
  const launched = await launchWithMarkdown('```js\nconst value = 1\n```\n', {
    preferences: { language: 'en' }
  })
  app = launched.app
  page = launched.page
})

test.afterEach(async() => {
  await app.evaluate(({ clipboard }) => {
    const state = globalThis as typeof globalThis & {
      __originalWriteText?: typeof clipboard.writeText
    }
    if (state.__originalWriteText) {
      clipboard.writeText = state.__originalWriteText
      delete state.__originalWriteText
    }
  })
})

test.afterAll(async() => {
  if (app) await app.close()
})

test('the shared clipboard API returns success without a duplicate send listener', async() => {
  expect(await page.evaluate(() => window.electron.clipboard.writeText('shared clipboard API'))).toBe(true)
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe('shared clipboard API')
  expect(await app.evaluate(({ ipcMain }) => ipcMain.listenerCount('mt::clipboard::write-text'))).toBe(0)
})

test('code copying uses the shared API and reports success', async() => {
  await page.locator('.mu-code-block').hover()
  const button = page.locator('button.mu-code-copy')
  await button.click()
  await expect(button).toHaveClass(/\bmu-copy-success\b/)
  await expect(button).toHaveAttribute('aria-label', 'Copied')
  await expect(button).not.toHaveAttribute('data-copy-feedback')
  expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe('const value = 1')
  await expect(button).not.toHaveClass(/\bmu-copy-success\b/)
  await expect(button).toHaveAttribute('aria-label', 'Copy content')
})

test('native clipboard failures return false and show failure feedback', async() => {
  await app.evaluate(({ clipboard }) => {
    const state = globalThis as typeof globalThis & {
      __originalWriteText?: typeof clipboard.writeText
    }
    state.__originalWriteText = clipboard.writeText
    clipboard.writeText = () => { throw new Error('clipboard unavailable') }
  })
  expect(await page.evaluate(() => window.electron.clipboard.writeText('not copied'))).toBe(false)
  await page.locator('.mu-code-block').hover()
  const button = page.locator('button.mu-code-copy')
  await button.click()
  await expect(button).toHaveAttribute('data-copy-feedback', 'Copy failed. Please try again.')
})
