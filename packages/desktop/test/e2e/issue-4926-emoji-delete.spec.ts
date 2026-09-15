import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  clearRendererErrors,
  expectNoRendererErrors,
  launchWithMarkdown,
  placeCaretInEditor,
  waitForRendererError
} from './helpers'

const FIRST_EMOJI = '\u{1F642}'
const TRAILING_EMOJI_TEXT = `abc${FIRST_EMOJI}`
// A ZWJ sequence: five code points and eight UTF-16 code units, but a single
// character to the user, so one Backspace has to take all of it.
const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'

test.describe('Emoji deletion (#4926)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('\n', { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await placeCaretInEditor(page)
    await clearRendererErrors(app)
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  const pasteText = async(text: string) => {
    await app.evaluate(({ clipboard }, value) => clipboard.writeText(value), text)
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V')
    const paragraph = page.locator('.editor-component span.mu-paragraph-content').first()
    await expect(paragraph).toHaveText(text)
    return paragraph
  }

  const expectRendererToRemainHealthy = async() => {
    await page.evaluate(async() => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
    })
    expect(await waitForRendererError(app, () => true)).toBeNull()
    await expectNoRendererErrors(app)
  }

  test('Backspace removes a trailing pasted emoji as one code point', async() => {
    const paragraph = await pasteText(TRAILING_EMOJI_TEXT)

    await page.keyboard.press('Backspace')
    await expect(paragraph).toHaveText('abc')
    await page.keyboard.type('x')
    await expect(paragraph).toHaveText('abcx')
    await expectRendererToRemainHealthy()
  })

  test('Backspace removes a trailing pasted ZWJ sequence as one character', async() => {
    const paragraph = await pasteText(`abc${FAMILY}`)

    await page.keyboard.press('Backspace')
    await expect(paragraph).toHaveText('abc')
    await page.keyboard.type('x')
    await expect(paragraph).toHaveText('abcx')
    await expectRendererToRemainHealthy()
  })
})
