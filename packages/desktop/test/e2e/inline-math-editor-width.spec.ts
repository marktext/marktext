import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// The "Editor--Max width" preference (Preferences > Editor > Text Editor >
// Max Width) accepts a percentage, e.g. "100%". `theme.ts#setEditorWidth`
// then injects `--editor-area-width: calc(100px + 100%)`. The inline-math
// popup (`.mu-math > .mu-math-render`) used to re-read that variable in its
// own `calc()`, whose `%` resolved against `.mu-math`'s own tiny,
// shrink-to-fit box (its absolute-positioning containing block) instead of
// the editor column, squeezing the popup down to a sliver. `.mu-container`
// is now a `cqw` query container so the popup sizes off the real column
// width regardless of the preference's unit (see packages/muya/src/assets/
// styles/{blockSyntax,inlineSyntax}.css).

const MATH_DOC = '# math width smoke\n\ntext $x^2+y^2=z^2$ end\n'

const setPreference = async(
  app: ElectronApplication,
  page: Page,
  prefs: Record<string, unknown>
): Promise<void> => {
  await page.evaluate((payload) => {
    window.electron.ipcRenderer.send('mt::set-user-preference', payload)
  }, prefs)
}

const readWidths = async(page: Page): Promise<{ containerWidth: number; renderMaxWidth: number }> => {
  return await page.evaluate(() => {
    const container = document.querySelector('.mu-container') as HTMLElement
    const render = document.querySelector('.mu-math > .mu-math-render') as HTMLElement
    return {
      containerWidth: container.getBoundingClientRect().width,
      renderMaxWidth: Number.parseFloat(getComputedStyle(render).maxWidth)
    }
  })
}

test.describe('Inline-math popup width with a percentage editor-width preference', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(MATH_DOC)
    app = launched.app
    page = launched.page
    await page.waitForSelector('.mu-math > .mu-math-render', { state: 'attached', timeout: 15000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('popup max-width tracks the editor column, not a sliver of the inline formula', async() => {
    await setPreference(app, page, { editorLineWidth: '100%' })
    await expect.poll(async() => {
      const { renderMaxWidth } = await readWidths(page)
      return renderMaxWidth
    }, { timeout: 10000 }).toBeGreaterThan(200)

    const { containerWidth, renderMaxWidth } = await readWidths(page)
    expect(Math.abs(renderMaxWidth - (containerWidth - 100))).toBeLessThanOrEqual(2)

    await setPreference(app, page, { editorLineWidth: '' })
  })
})
