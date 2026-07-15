import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  clearRendererErrors,
  expectNoRendererErrors,
  launchWithMarkdown,
  placeCaretInEditor,
  waitForRendererError
} from './helpers'

const PASTED_TEXT = '\u{1F642}(\u5FAE\u7B11)\u{1F600}(\u5927\u7B11)'
const FIRST_EMOJI = '\u{1F642}'
const TEXT_AFTER_FIRST_EMOJI = PASTED_TEXT.slice(FIRST_EMOJI.length)
const TRAILING_EMOJI_TEXT = `abc${FIRST_EMOJI}`
const DELETE_KEYS = ['Backspace', 'Delete'] as const

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

  for (const key of DELETE_KEYS) {
    test(`handles ${key} inside a pasted emoji`, async() => {
      const paragraph = await pasteText(PASTED_TEXT)

      const caretPlaced = await page.evaluate((emoji) => {
        const root = document.querySelector('.editor-component') as HTMLElement | null
        const target = root?.querySelector('span.mu-paragraph-content') ?? null
        if (!root || !target) return false

        const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
        let textNode = walker.nextNode()
        while (textNode instanceof Text && !textNode.data.includes(emoji)) {
          textNode = walker.nextNode()
        }
        if (!(textNode instanceof Text)) return false

        // Offset 1 is between this emoji's two UTF-16 code units.
        const offset = textNode.data.indexOf(emoji) + 1
        if (offset < 1) return false

        root.focus()
        const range = document.createRange()
        range.setStart(textNode, offset)
        range.collapse(true)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
        document.dispatchEvent(new Event('selectionchange'))
        root.dispatchEvent(
          new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, cancelable: true })
        )
        return true
      }, FIRST_EMOJI)
      expect(caretPlaced).toBe(true)

      await page.keyboard.press(key)
      await expect(paragraph).toHaveText(TEXT_AFTER_FIRST_EMOJI)
      await page.keyboard.type('x')
      await expect(paragraph).toHaveText(`x${TEXT_AFTER_FIRST_EMOJI}`)
      await expectRendererToRemainHealthy()
    })
  }

  test('Backspace removes a trailing pasted emoji as one code point', async() => {
    const paragraph = await pasteText(TRAILING_EMOJI_TEXT)

    await page.keyboard.press('Backspace')
    await expect(paragraph).toHaveText('abc')
    await page.keyboard.type('x')
    await expect(paragraph).toHaveText('abcx')
    await expectRendererToRemainHealthy()
  })
})
