import type { Muya } from '@muyajs/core'
import { expect, test } from '@playwright/test'
import { launchWithMarkdown } from './helpers'

type ContentElement = HTMLElement & { __MUYA_BLOCK__: { muya: Muya } }

test('keeps toolbar coordinates near the selection when its old DOM range is replaced', async() => {
  const { app, page } = await launchWithMarkdown(
    Array.from({ length: 8 }, (_, index) => `Paragraph ${index}: selected text for toolbar positioning.`).join('\n\n')
  )
  try {
    await page.locator('.editor-component .mu-paragraph-content').nth(5).click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Shift+End')
    await expect(page.locator('.mu-format-picker-container')).toHaveCSS('opacity', '1')
    const observed = await page.evaluate(() => {
      const content = document.querySelector('.editor-component .mu-content') as ContentElement
      const muya = content.__MUYA_BLOCK__.muya
      const toolbar = [...muya.ui.shownFloat].find((tool) => tool.name === 'mu-format-picker')
      const selection = muya.getSelection()
      const native = document.getSelection()
      if (!toolbar || !selection || !native?.rangeCount) throw new Error('Expected visible selection toolbar')
      const references: Array<Parameters<typeof toolbar.show>[0]> = []
      const show = toolbar.show
      toolbar.show = (reference, callback) => {
        references.push(reference)
        show.call(toolbar, reference, callback)
      }
      try {
        muya.eventCenter.emit('selection-change', { selection, docChanged: false })
      } finally {
        toolbar.show = show
      }
      const reference = references.at(-1)
      if (!reference) throw new Error('Expected toolbar position reference')
      const before = reference.getBoundingClientRect()
      const range = native.getRangeAt(0)
      const node = range.startContainer
      if (!node.parentNode || node.nodeType !== Node.TEXT_NODE) throw new Error('Expected selected text node')
      node.parentNode.replaceChild(node.cloneNode(true), node)
      const empty = range.getBoundingClientRect()
      const after = reference.getBoundingClientRect()
      return {
        before: { top: before.top, left: before.left },
        empty: { width: empty.width, height: empty.height },
        after: { top: after.top, left: after.left }
      }
    })
    expect(observed.before.top).toBeGreaterThan(100)
    expect(observed.empty).toEqual({ width: 0, height: 0 })
    expect(observed.after).toEqual(observed.before)
  } finally {
    await app.close()
  }
})
