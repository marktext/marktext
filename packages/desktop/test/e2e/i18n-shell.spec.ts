import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, sendIpcToRenderer, waitForMenuReady } from './helpers'

// Checklist item 278 — switching the UI language must re-translate the Vue
// shell (menu bar / command palette / preferences tabs), not just the engine
// hints covered by parity-cursor-lang.spec.ts (G8).
//
// We drive the command palette: its search input placeholder is rendered by
// Vue via `t('commandPalette.placeholder')`. Reading it in English, switching
// to zh-CN the way the main process does (`language-changed` BEFORE
// `mt::user-preference`), then reopening the palette must surface the Chinese
// string — and never the raw dotted i18n key.

const SEARCH_INPUT = '.search-wrapper input.search, input.search'

// Open the command palette and wait for its search input to be visible.
const openPalette = async(app: ElectronApplication, page: Page): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::show-command-palette')
  await expect(page.locator(SEARCH_INPUT).first()).toBeVisible({ timeout: 5000 })
}

// Close the palette (Escape) and wait until no visible search input remains.
const closePalette = async(page: Page): Promise<void> => {
  await page.keyboard.press('Escape')
  await page.waitForFunction(
    () => {
      const inputs = document.querySelectorAll('input.search')
      for (const i of inputs) {
        const r = i.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return false
      }
      return true
    },
    null,
    { timeout: 5000 }
  )
}

const readPlaceholder = (page: Page): Promise<string | null> =>
  page.evaluate((sel) => {
    const input = document.querySelector(sel) as HTMLInputElement | null
    return input ? input.getAttribute('placeholder') : null
  }, SEARCH_INPUT)

test.describe('i18n shell — language switch re-translates the Vue shell', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# x\n')
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('command palette placeholder re-translates en -> zh-CN', async() => {
    // 1) Read the English shell label.
    await openPalette(app, page)
    const enPlaceholder = await readPlaceholder(page)
    expect(enPlaceholder).toBeTruthy()
    // The English string from static/locales/en.json.
    expect(enPlaceholder).toBe('Type a command to execute')
    // Never the raw i18n key leaking through.
    expect(enPlaceholder).not.toMatch(/commandPalette\./)
    await closePalette(page)

    // 2) Drive a language switch the way the main process does: the
    // `language-changed` broadcast reaches the renderer BEFORE the
    // `mt::user-preference` that syncs the preferences store.
    await sendIpcToRenderer(app, 'language-changed', 'zh-CN')
    await sendIpcToRenderer(app, 'mt::user-preference', { language: 'zh-CN' })

    // The renderer loads the zh-CN locale asynchronously via
    // window.i18nUtils.loadTranslations -> `mt::i18n::load` IPC, so poll the
    // freshly-reopened palette until the placeholder reflects the new locale.
    await expect
      .poll(
        async() => {
          await openPalette(app, page)
          const value = await readPlaceholder(page)
          await closePalette(page)
          return value
        },
        { timeout: 8000, intervals: [300, 500, 800] }
      )
      .toBe('输入要执行的命令')

    // 3) Re-read once more and assert the post-switch invariants.
    await openPalette(app, page)
    const zhPlaceholder = await readPlaceholder(page)
    await closePalette(page)
    expect(zhPlaceholder).toBeTruthy()
    expect(zhPlaceholder).not.toBe(enPlaceholder)
    // The Chinese label must not be the raw dotted key either.
    expect(zhPlaceholder).not.toMatch(/commandPalette\./)
  })
})
