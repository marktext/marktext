import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, sendIpcToRenderer, setSourceMarkdown } from './helpers'

const inputSelector = '.search-bar .search input'
const markdown = 'first apple apple\n\nmiddle apple apple\n\nlast apple apple\n'

async function placeSelection(page: Page, paragraph: number, start: number, end = start): Promise<void> {
  await page.locator('.mu-paragraph').nth(paragraph).evaluate((element, offsets) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const points: { node: Node; offset: number }[] = []
    for (const target of offsets) {
      walker.currentNode = element
      let remaining = target
      while (walker.nextNode()) {
        const length = walker.currentNode.textContent?.length ?? 0
        if (remaining <= length) {
          points.push({ node: walker.currentNode, offset: remaining })
          break
        }
        remaining -= length
      }
    }
    if (points.length !== 2) throw new Error('Could not resolve editor selection')
    const editable = element.closest<HTMLElement>('[contenteditable="true"]')
    editable?.focus()
    window.getSelection()?.setBaseAndExtent(points[0].node, points[0].offset, points[1].node, points[1].offset)
  }, [start, end])
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  }))
}

async function openFind(app: ElectronApplication, page: Page): Promise<void> {
  await sendIpcToRenderer(app, 'mt::editor-edit-action', 'find')
  await expect(page.locator(inputSelector)).toBeFocused()
}

async function activeParagraph(page: Page): Promise<string> {
  return page.locator('.mu-highlight').evaluate(element => element.closest('.mu-paragraph')?.textContent ?? '')
}

test.describe('Find session (#5960)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown(markdown)
    app = launched.app
    page = launched.page
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('keeps the search start while typing, toggling options and reopening Find', async() => {
    await placeSelection(page, 1, 0)
    await openFind(app, page)
    const input = page.locator(inputSelector)
    await input.fill('ap')
    await expect.poll(() => activeParagraph(page)).toBe('middle apple apple')
    await input.fill('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('3 / 6')
    await expect(page.locator('.mu-format-picker-container')).toHaveCSS('opacity', '0')
    await page.locator('.search-bar .is-case-sensitive').click()
    await expect(page.locator('.search-bar .search-result')).toContainText('3 / 6')
    await expect(page.locator('.mu-format-picker-container')).toHaveCSS('opacity', '0')
    await openFind(app, page)
    await expect(page.locator('.search-bar .search-result')).toContainText('3 / 6')
    await expect(input).toHaveValue('apple')
    await expect.poll(() => input.evaluate(element => {
      if (!(element instanceof HTMLInputElement)) throw new Error('Expected find input')
      return { start: element.selectionStart, end: element.selectionEnd }
    }))
      .toEqual({ start: 0, end: 5 })
  })

  test('keeps Find open after clicking the editor and navigates from the new caret', async() => {
    await placeSelection(page, 0, 0)
    await openFind(app, page)
    await page.locator(inputSelector).fill('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 6')
    await page.locator('.mu-paragraph').nth(1).click()
    await expect(page.locator('.search-bar')).toBeVisible()
    await expect(page.locator(inputSelector)).toHaveValue('apple')
    await placeSelection(page, 1, 0, 6)
    await expect(page.locator('.mu-format-picker-container')).toHaveCSS('opacity', '1')
    await placeSelection(page, 1, 0)
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findNext')
    await expect.poll(() => activeParagraph(page)).toBe('middle apple apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('3 / 6')
    await expect(page.locator('.mu-format-picker-container')).toHaveCSS('opacity', '0')
  })

  test('preserves both inputs and continues finding after Escape', async() => {
    await placeSelection(page, 1, 0)
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    await page.locator(inputSelector).fill('apple')
    await page.locator('.search-bar .replace input').fill('pear')
    await expect(page.locator('.search-bar .search-result')).toContainText('3 / 6')
    await page.keyboard.press('Escape')
    await expect(page.locator('.search-bar')).toBeHidden()
    await expect(page.locator('.mu-highlight, .mu-selection')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('apple')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findNext')
    await expect(page.locator('.search-bar')).toBeVisible()
    await expect(page.locator('.search-bar .replace')).toHaveCount(0)
    await expect(page.locator('.mu-editor')).toBeFocused()
    await expect(page.locator('.mu-format-picker-container')).toHaveCSS('opacity', '0')
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('apple')
    await openFind(app, page)
    await expect(page.locator(inputSelector)).toHaveValue('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('4 / 6')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    await expect(page.locator('.search-bar .replace input')).toHaveValue('pear')
  })

  test('keeps the regex for navigation and seeds explicit Find from the editor selection', async() => {
    await setSourceMarkdown(page, app, 'cat1 cat2 cat10')
    await placeSelection(page, 0, 0)
    await openFind(app, page)
    await page.locator('.search-bar .is-regex').click()
    const input = page.locator(inputSelector)
    await input.fill('cat([0-9]+)')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 3')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    await expect(input).toHaveValue('cat([0-9]+)')
    await page.keyboard.press('Escape')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findNext')
    await expect(page.locator('.search-bar')).toBeVisible()
    await expect(input).toHaveValue('cat([0-9]+)')
    await expect(page.locator('.search-bar .search-result')).toContainText('2 / 3')
    await expect(page.locator('.mu-editor')).toBeFocused()
    await openFind(app, page)
    await expect(input).toHaveValue('cat2')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 1')
  })

  test('dispatches each native find shortcut once from the input and editor', async() => {
    await placeSelection(page, 0, 0)
    await openFind(app, page)
    await page.locator(inputSelector).fill('apple')
    const counter = page.locator('.search-bar .search-result')
    await expect(counter).toContainText('1 / 6')
    await page.evaluate(() => {
      const root = document.querySelector('#app') as Element & {
        __vue_app__?: {
          config: { globalProperties: { $pinia: { _s: Map<string, { LISTEN_FOR_EDIT(): void }> } } }
        }
      }
      const store = root.__vue_app__?.config.globalProperties.$pinia._s.get('listenForMain')
      if (!store) throw new Error('Missing edit command store')
      store.LISTEN_FOR_EDIT()
      store.LISTEN_FOR_EDIT()
    })
    const window = await app.browserWindow(page)
    const press = async(previous = false) => {
      await window.evaluate((window, chord) => {
        window.webContents.sendInputEvent({ type: 'keyDown', ...chord })
        window.webContents.sendInputEvent({ type: 'keyUp', ...chord })
      }, {
        keyCode: process.platform === 'darwin' ? 'G' : 'F3',
        modifiers: [...(process.platform === 'darwin' ? ['meta'] : []), ...(previous ? ['shift'] : [])]
      })
    }
    await press()
    await expect(counter).toContainText('2 / 6')
    await press()
    await expect(counter).toContainText('3 / 6')
    await press(true)
    await expect(counter).toContainText('2 / 6')
    await page.keyboard.press('Escape')
    await press()
    await openFind(app, page)
    await expect(counter).toContainText('3 / 6')
  })

  test('uses Shift+Enter for previous and Enter for next', async() => {
    await placeSelection(page, 1, 0)
    await openFind(app, page)
    await page.locator(inputSelector).fill('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('3 / 6')
    await page.locator(inputSelector).press('Shift+Enter')
    await expect(page.locator('.search-bar .search-result')).toContainText('2 / 6')
    await page.locator(inputSelector).press('Enter')
    await expect(page.locator('.search-bar .search-result')).toContainText('3 / 6')
  })

  test('close button preserves the session and returns focus to the editor', async() => {
    await placeSelection(page, 1, 0)
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    await page.locator(inputSelector).fill('apple')
    await page.locator('.search-bar .replace input').fill('pear')
    await page.locator('.search-bar .is-case-sensitive').click()
    await expect(page.locator('.search-bar .search-result')).toContainText('3 / 6')

    const close = page.locator('.search-bar .close-search')
    await expect(close).toHaveAttribute('aria-keyshortcuts', 'Escape')
    await expect(close).toHaveAccessibleName(/Close|关闭/)
    await close.click()
    await expect(page.locator('.search-bar')).toBeHidden()
    await expect(page.locator('.mu-editor')).toBeFocused()
    await expect(page.locator('.mu-highlight, .mu-selection')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('apple')

    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findNext')
    await openFind(app, page)
    await expect(page.locator(inputSelector)).toHaveValue('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('4 / 6')
    await expect(page.locator('.search-bar .is-case-sensitive')).toHaveAttribute('aria-pressed', 'true')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    await expect(page.locator('.search-bar .replace input')).toHaveValue('pear')
  })

  for (const [label, text, offset] of [
    ['English', 'first apple apple', 8],
    ['Chinese', '这是一段没有空格的中文正文。', 4]
  ] as const) {
    test(`does not prefill from a collapsed ${label} caret`, async() => {
      await setSourceMarkdown(page, app, text)
      await placeSelection(page, 0, offset)
      await openFind(app, page)
      const input = page.locator(inputSelector)
      await expect(input).toHaveValue('')
      for (const action of ['findNext', 'findPrev'] as const) {
        await page.keyboard.press('Escape')
        await sendIpcToRenderer(app, 'mt::editor-edit-action', action)
        await expect(page.locator('.search-bar')).toBeVisible()
        await expect(input).toHaveValue('')
        await expect(input).toBeFocused()
        await expect(page.locator('.search-bar .search-result')).toContainText('0 / 0')
        await expect(page.locator('.mu-format-picker-container')).toHaveCSS('opacity', '0')
      }
    })
  }

  test('keeps the retained query when reopening at a Chinese caret without a selection', async() => {
    await setSourceMarkdown(page, app, 'apple\n\n这是一段没有空格的中文正文。')
    await placeSelection(page, 0, 0)
    await openFind(app, page)
    const input = page.locator(inputSelector)
    await input.fill('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 1')
    await page.keyboard.press('Escape')
    await placeSelection(page, 1, 4)
    await openFind(app, page)
    await expect(input).toHaveValue('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 1')
  })

  test('keeps an explicitly cleared query empty during navigation', async() => {
    await placeSelection(page, 0, 6, 11)
    await openFind(app, page)
    const input = page.locator(inputSelector)
    await input.fill('')
    await input.press('Enter')
    await expect(input).toHaveValue('')
    await expect(page.locator('.search-bar .search-result')).toContainText('0 / 0')
    await page.keyboard.press('Escape')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findNext')
    await expect(input).toHaveValue('')
    await expect(input).toBeFocused()
  })

  test('escapes an explicit literal selection in regex mode', async() => {
    await setSourceMarkdown(page, app, 'a.b aXb apple')
    await placeSelection(page, 0, 10)
    await openFind(app, page)
    await expect(page.locator(inputSelector)).toHaveValue('')
    await page.locator('.search-bar .is-regex').click()
    await placeSelection(page, 0, 0, 3)
    await openFind(app, page)
    await expect(page.locator(inputSelector)).toHaveValue('a\\.b')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 1')
  })

  test('preserves expanded Replace on Find and follows the input focus cycle', async() => {
    await placeSelection(page, 0, 0)
    await openFind(app, page)
    const input = page.locator(inputSelector)
    await input.fill('apple')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    const replacement = page.locator('.search-bar .replace input')
    await expect(replacement).toBeFocused()
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    await expect(replacement).toBeFocused()
    await replacement.fill('pear')
    await openFind(app, page)
    await expect(replacement).toBeVisible()
    await input.press('Tab')
    await expect(replacement).toBeFocused()
    await replacement.press('Shift+Tab')
    await expect(input).toBeFocused()
    await input.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+ArrowDown')
    await expect(page.locator('.mu-editor')).toBeFocused()
    await expect(page.locator('.search-bar')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe('apple')
  })

  test('Enter in Replace replaces one result, keeps focus and wraps after the last', async() => {
    await setSourceMarkdown(page, app, 'apple apple')
    await placeSelection(page, 0, 6)
    await openFind(app, page)
    const input = page.locator(inputSelector)
    await input.fill('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('2 / 2')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    const replacement = page.locator('.search-bar .replace input')
    await replacement.fill('pear')
    await replacement.press('Enter')
    await expect(page.locator('.mu-paragraph')).toHaveText('apple pear')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 1')
    await expect(replacement).toBeFocused()
    await replacement.press('Enter')
    await expect(page.locator('.mu-paragraph')).toHaveText('pear pear')
    await expect(page.locator('.search-bar .search-result')).toContainText('0 / 0')
    await expect(replacement).toBeFocused()
  })

  test('a replacement command selects from a moved caret before modifying text', async() => {
    await placeSelection(page, 0, 0)
    await openFind(app, page)
    await page.locator(inputSelector).fill('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 6')
    await placeSelection(page, 1, 0)
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    await expect(page.locator(inputSelector)).toBeFocused()
    const replacement = page.locator('.search-bar .replace input')
    await replacement.fill('pear')
    await replacement.press('Enter')
    await expect(page.locator('.mu-paragraph').nth(1)).toHaveText('middle apple apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('3 / 6')
    await replacement.press('Enter')
    await expect(page.locator('.mu-paragraph').nth(1)).toHaveText('middle pear apple')
  })

  test('button replacement advances past newly inserted matches in a longer replacement', async() => {
    await setSourceMarkdown(page, app, 'apple\n\napple')
    await placeSelection(page, 0, 0)
    await openFind(app, page)
    await page.locator(inputSelector).fill('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 2')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    await page.locator('.search-bar .replace input').fill('xxxxxxxx apple')
    const button = page.locator('.search-bar .replace .button-group button').last()
    await button.focus()
    await button.click()
    await expect(page.locator('.mu-paragraph').first()).toHaveText('xxxxxxxx apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('2 / 2')
    await expect.poll(() => activeParagraph(page)).toBe('apple')
    await expect(button).toBeFocused()
  })

  test('editing after closing Find preserves folded sections until Find is reopened', async() => {
    await setSourceMarkdown(page, app, '# Folded\n\napple\n\n# Outside\n\nordinary text')
    await placeSelection(page, 1, 0)
    await openFind(app, page)
    await page.locator(inputSelector).fill('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 1')
    await page.keyboard.press('Escape')
    const toggle = page.locator('.mu-fold-toggle').first()
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await placeSelection(page, 1, 0)
    await page.keyboard.type('new ')
    await expect(page.locator('.mu-paragraph').last()).toHaveText('new ordinary text')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('.mu-paragraph').first()).toBeHidden()
    await expect(page.locator('.mu-highlight, .mu-selection')).toHaveCount(0)
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findNext')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('.mu-paragraph').first()).toBeVisible()
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 1')
  })

  test('replacement shortcuts flush the query and invalid patterns disable operations', async() => {
    await placeSelection(page, 0, 0)
    await openFind(app, page)
    await page.locator(inputSelector).fill('apple')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    const replacement = page.locator('.search-bar .replace input')
    await replacement.fill('pear')
    await replacement.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Alt+Enter')
    await expect(page.locator('.mu-paragraph').first()).toHaveText('first pear pear')
    await expect(page.locator('.mu-paragraph').last()).toHaveText('last pear pear')
    await page.locator('.search-bar .is-regex').click()
    await page.locator(inputSelector).fill('[')
    await expect(page.locator('.search-bar .error-msg')).toBeVisible()
    await expect(page.locator('.search-bar .button-group button:disabled')).toHaveCount(4)
    await replacement.press('Enter')
    await expect(page.locator('.mu-paragraph').first()).toHaveText('first pear pear')
  })

  test('rapid Enter navigation reveals the current filler match in a long document', async() => {
    const window = await app.browserWindow(page)
    await window.evaluate(window => window.setContentSize(1000, 700))
    const longDocument = Array.from({ length: 50 }, (_, i) => `Paragraph ${i + 1}: ordinary filler text for scrolling.`).join('\n\n')
    await setSourceMarkdown(page, app, longDocument)
    await placeSelection(page, 0, 0)
    await openFind(app, page)
    const input = page.locator(inputSelector)
    await input.fill('filler')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 50')
    for (let i = 0; i < 32; i++) {
      await input.press('Enter')
      const visible = await page.locator('.mu-highlight').evaluate(element => {
        const match = element.getBoundingClientRect()
        const container = element.closest('.editor-component')?.getBoundingClientRect()
        if (!container) throw new Error('Missing editor scroll container')
        const bar = document.querySelector('.search-bar')?.getBoundingClientRect()
        if (!bar) throw new Error('Missing find widget')
        return match.top >= Math.max(container.top, bar.bottom) && match.bottom <= container.bottom
      })
      expect(visible, `result ${i + 2} should be visible immediately after Enter`).toBe(true)
    }
    await expect(page.locator('.search-bar .search-result')).toContainText('33 / 50')
    await expect.poll(() => activeParagraph(page)).toBe('Paragraph 33: ordinary filler text for scrolling.')
    await expect(page.locator('.mu-highlight')).toBeInViewport()
    await expect(input).toBeFocused()
    const scrollPositions = await page.locator('.editor-component').evaluate(container => new Promise<number[]>(resolve => {
      const positions: number[] = []
      const start = performance.now()
      const sample = () => {
        positions.push(container.scrollTop)
        if (performance.now() - start >= 400) resolve(positions)
        else requestAnimationFrame(sample)
      }
      sample()
    }))
    expect(Math.max(...scrollPositions) - Math.min(...scrollPositions)).toBeLessThanOrEqual(1)
    for (let i = 0; i < 18; i++) await input.press('Shift+Enter')
    await expect(page.locator('.search-bar .search-result')).toContainText('15 / 50')
    await expect(page.locator('.mu-highlight')).toBeInViewport()
  })

  test('reveals the next result after closing Find without moving on reopen', async() => {
    const longDocument = ['first apple', ...Array.from({ length: 60 }, (_, i) => `paragraph ${i}`), 'last apple'].join('\n\n')
    await setSourceMarkdown(page, app, longDocument)
    await placeSelection(page, 0, 0)
    await openFind(app, page)
    await page.locator(inputSelector).fill('apple')
    await expect(page.locator('.search-bar .search-result')).toContainText('1 / 2')
    await page.keyboard.press('Escape')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'findNext')
    const last = page.locator('.mu-paragraph').last()
    await expect(last).toBeInViewport()
    const selected = () => page.evaluate(() => window.getSelection()?.toString())
    await expect.poll(selected).toBe('apple')
    await openFind(app, page)
    await expect(page.locator('.search-bar .search-result')).toContainText('2 / 2')
    await expect(last).toBeInViewport()
    await expect.poll(selected).toBe('apple')
  })
})
