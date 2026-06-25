import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// Post-migration (muyajs -> @muyajs/core) coverage backfill for the
// "Wrap Code Blocks" and "Code Block Line Numbers" editor preferences.
//
// The wrap preference is implemented via muya.setOptions({ wrapCodeBlocks }),
// which toggles a .mu-code-wrap class on the editor root. Muya's stylesheet
// then applies `white-space: pre-wrap` to .mu-code-wrap .mu-code-block .mu-code.
// These tests prove the round-trip (renderer -> main store -> broadcast ->
// Pinia watcher -> muya.setOptions) takes effect live.
//
// The actual visual wrapping / horizontal scroll behaviour is not asserted here
// (that remains manual); we assert the load-bearing computed style + class.

const CODE_DOC =
  '# wrap smoke\n\n```js\nconst aVeryLongUnbrokenStringWithNoSpacesAtAllToForceHorizontalOverflow = 1\nconst b = 2\n```\n'

const CODE_SELECTOR = '.mu-code-block .mu-code'

const setPreference = async(
  app: ElectronApplication,
  page: Page,
  prefs: Record<string, unknown>
): Promise<void> => {
  await page.evaluate((payload) => {
    window.electron.ipcRenderer.send('mt::set-user-preference', payload)
  }, prefs)
}

const readWhiteSpace = async(page: Page): Promise<string> => {
  return await page.evaluate((selector) => {
    const el = document.querySelector(selector)
    return el ? getComputedStyle(el).whiteSpace : ''
  }, CODE_SELECTOR)
}

test.describe('Code block wrap + line-numbers preferences', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(CODE_DOC)
    app = launched.app
    page = launched.page
    // The fenced code block renders into pre.mu-code-block > code.mu-code.
    await page.waitForSelector(CODE_SELECTOR, { state: 'attached', timeout: 15000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  // Item 99: wrap preference toggles white-space on .mu-code-block .mu-code.
  test('wrapCodeBlocks toggles computed white-space on .mu-code-block .mu-code', async() => {
    // Default preference is wrapCodeBlocks: false, so the editor root has no
    // .mu-code-wrap class and white-space is pre. Establish the baseline first.
    await expect.poll(() => readWhiteSpace(page), { timeout: 10000 }).toBe('pre')

    // Enable wrapping -> selector should resolve to `pre-wrap`.
    await setPreference(app, page, { wrapCodeBlocks: true })
    await expect.poll(() => readWhiteSpace(page), { timeout: 10000 }).toBe('pre-wrap')

    // Disable wrapping again -> back to `pre`. This proves the toggle is live
    // and the #ag-code-wrap selector still matches the rendered code DOM.
    await setPreference(app, page, { wrapCodeBlocks: false })
    await expect.poll(() => readWhiteSpace(page), { timeout: 10000 }).toBe('pre')
  })

  // Item 44: line-numbers preference toggles the `mu-line-numbers` class on the
  // .mu-code-block pre, applied live via muya.setOptions(..., forceRender=true).
  test('codeBlockLineNumbers toggles the mu-line-numbers class on the code block', async() => {
    const hasLineNumbers = async(): Promise<boolean> => {
      return await page.evaluate(() => {
        const pre = document.querySelector('.mu-code-block')
        return !!pre && pre.classList.contains('mu-line-numbers')
      })
    }

    // Default is codeBlockLineNumbers: false.
    await expect.poll(hasLineNumbers, { timeout: 10000 }).toBe(false)

    // Enabling forces a re-render that re-creates the code block with the
    // `mu-line-numbers` class on the pre.
    await setPreference(app, page, { codeBlockLineNumbers: true })
    await expect.poll(hasLineNumbers, { timeout: 10000 }).toBe(true)

    // And toggling back off removes it.
    await setPreference(app, page, { codeBlockLineNumbers: false })
    await expect.poll(hasLineNumbers, { timeout: 10000 }).toBe(false)
  })

  // Item 44 (continued): both preferences take effect together and live — assert
  // the wrap CSS still resolves after a line-numbers forceRender re-creates the
  // code DOM (regression guard: a re-render must not orphan the injected style).
  test('wrap CSS still matches the code DOM after a line-numbers re-render', async() => {
    await setPreference(app, page, { wrapCodeBlocks: true })
    await expect.poll(() => readWhiteSpace(page), { timeout: 10000 }).toBe('pre-wrap')

    // Force a full re-render of the code block via the line-numbers option.
    await setPreference(app, page, { codeBlockLineNumbers: true })
    await page.waitForFunction(
      () => {
        const pre = document.querySelector('.mu-code-block')
        return !!pre && pre.classList.contains('mu-line-numbers')
      },
      null,
      { timeout: 10000 }
    )

    // The newly-rendered .mu-code must still pick up the muya wrap CSS.
    await expect.poll(() => readWhiteSpace(page), { timeout: 10000 }).toBe('pre-wrap')

    // Restore defaults so the suite leaves no global preference state behind.
    await setPreference(app, page, { codeBlockLineNumbers: false, wrapCodeBlocks: false })
    await expect.poll(() => readWhiteSpace(page), { timeout: 10000 }).toBe('pre')
  })
})
