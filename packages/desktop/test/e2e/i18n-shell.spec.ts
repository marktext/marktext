import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getSupportedLanguages } from '../../src/common/i18n'
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

for (const language of getSupportedLanguages()) {
  test(`reading mode uses ${language} in the native menu, popover and tab lock`, async() => {
    const locale = JSON.parse(readFileSync(join(__dirname, '../../static/locales', `${language}.json`), 'utf8'))
    const { app, page } = await launchWithMarkdown('```js\nconst value = 1\n```\n', {
      preferences: { language, defaultOpenMode: 'read' }
    })
    try {
      await expect(page.locator('.mu-read-only')).toBeVisible()
      await expect.poll(() => app.evaluate(({ Menu }) =>
        Menu.getApplicationMenu()?.getMenuItemById('readOnlyModeMenuItem')?.label
      )).toBe(locale.readingMode.title)
      await expect(page.locator('.tabs-container .reading-lock')).toHaveAttribute('aria-label', locale.readingMode.title)
      await page.locator('.document-statistics-trigger').hover()
      const panel = page.locator('.document-statistics-popover')
      await expect(panel).toBeVisible()
      await expect(panel.locator('.document-statistics__reading-mode')).toContainText(locale.readingMode.title)
      await expect(panel.getByRole('switch', { name: locale.readingMode.title, exact: true })).toBeChecked()
      expect(await panel.locator('.document-statistics__reading-mode').evaluate(el =>
        el.scrollWidth <= el.clientWidth + 1
      )).toBe(true)
      await expect(panel.locator('.document-statistics__file-info .document-statistics__file-row')).toHaveCount(2)
      for (const row of await panel.locator('.document-statistics__file-info .document-statistics__file-row').all()) {
        const layout = await row.evaluate(el => {
          const label = el.querySelector('.document-statistics__file-label')
          const value = el.querySelector('.document-statistics__file-value')
          if (!label || !value) return null
          const labelRect = label.getBoundingClientRect()
          const valueRect = value.getBoundingClientRect()
          return {
            stacked: valueRect.top >= labelRect.bottom,
            labelFits: label.scrollWidth <= label.clientWidth + 1,
            valueFits: value.scrollWidth <= value.clientWidth + 1
          }
        })
        expect(layout).toEqual({
          stacked: true,
          labelFits: true,
          valueFits: true
        })
      }
      await page.keyboard.press('Escape')
    } finally {
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    }
  })
}

const openPalette = async(app: ElectronApplication, page: Page): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::show-command-palette')
  await expect(page.locator(SEARCH_INPUT).first()).toBeVisible({ timeout: 5000 })
}

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
    const launched = await launchWithMarkdown('# x\n', { preferences: { language: 'en' } })
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('command palette placeholder re-translates en -> zh-CN', async() => {
    await openPalette(app, page)
    const enPlaceholder = await readPlaceholder(page)
    expect(enPlaceholder).toBeTruthy()
    expect(enPlaceholder).toBe('Type a command to execute')
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

    await openPalette(app, page)
    const zhPlaceholder = await readPlaceholder(page)
    await closePalette(page)
    expect(zhPlaceholder).toBeTruthy()
    expect(zhPlaceholder).not.toBe(enPlaceholder)
    expect(zhPlaceholder).not.toMatch(/commandPalette\./)
  })
})
