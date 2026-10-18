import { expect, test } from '@playwright/test'
import type { Page } from 'playwright'
import { launchWithMarkdown, clickMenuById } from './helpers'

const caretPosition = (page: Page) => page.evaluate(() => {
  const root = document.querySelector('.editor-component')
  const selection = window.getSelection()
  if (!root || !selection?.rangeCount) throw new Error('Editor caret is missing')
  const rects = Array.from(selection.getRangeAt(0).getClientRects())
  const rect = rects.at(-1)
  if (!rect) throw new Error('Editor caret has no layout')
  return { scroll: root.scrollTop, x: rect.x, y: rect.y, offset: selection.focusOffset }
})

test('typewriter keeps a wrapped line stationary when moving to its beginning', async() => {
  const md = Array.from({ length: 20 }, (_, i) => `Paragraph ${i} ${'words for a wrapped paragraph with several visual lines. '.repeat(15)}`).join('\n\n')
  const { app, page } = await launchWithMarkdown(md)
  try {
    await clickMenuById(app, 'typewriterModeMenuItem')
    await page.evaluate(() => {
      const root = document.querySelector('.editor-component') as HTMLElement
      const spans = root.querySelectorAll('.mu-paragraph-content')
      const target = spans[10]
      root.focus()
      const range = document.createRange()
      range.selectNodeContents(target)
      range.collapse(true)
      const selection = window.getSelection()
      if (!selection) throw new Error('Selection is unavailable')
      selection.removeAllRanges()
      selection.addRange(range)
      selection.modify('move', 'forward', 'line')
      selection.modify('move', 'forward', 'line')
      root.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }))
    })
    await page.waitForTimeout(700)
    for (let attempt = 0; attempt < 3; attempt++) {
      for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(400)
      const before = await caretPosition(page)
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowLeft' : 'Home')
      await page.waitForTimeout(400)
      const after = await caretPosition(page)
      expect(after.offset).toBeGreaterThan(0)
      expect(after.offset).toBeLessThan(before.offset)
      expect(after.x).toBeLessThan(before.x)
      expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(2)
      expect(Math.abs(after.scroll - before.scroll)).toBeLessThanOrEqual(2)
      await page.keyboard.press('ArrowDown')
      await page.waitForTimeout(400)
      const nextLine = await caretPosition(page)
      expect(nextLine.scroll).toBeGreaterThan(after.scroll + 10)
      expect(Math.abs(nextLine.y - after.y)).toBeLessThanOrEqual(2)
    }
  } finally {
    await app.close()
  }
})
