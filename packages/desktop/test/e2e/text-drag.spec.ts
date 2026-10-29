import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { clickMenuById, launchWithMarkdown, sendIpcToRenderer } from './helpers'

test('moves a text selection in the desktop editor and saves the same result', async() => {
  const { app, page, filePath } = await launchWithMarkdown('ABCDE\n\nTarget\n')
  try {
    const points = await page.evaluate(() => {
      const contents = document.querySelectorAll('.mu-content')
      const source = contents[0]
      const target = contents[1]
      if (!source || !target) throw new Error('Missing editor paragraphs')
      const sourceNode = document.createTreeWalker(source, NodeFilter.SHOW_TEXT).nextNode()
      const targetNode = document.createTreeWalker(target, NodeFilter.SHOW_TEXT).nextNode()
      if (!sourceNode || !targetNode) throw new Error('Missing paragraph text')
      const range = document.createRange()
      range.setStart(sourceNode, 1)
      range.setEnd(sourceNode, 3)
      const root = document.querySelector<HTMLElement>('.mu-editor')
      if (!root) throw new Error('Missing editor root')
      root.focus()
      const selection = document.getSelection()
      if (!selection) throw new Error('Missing browser selection')
      selection.removeAllRanges()
      selection.addRange(range)
      const rect = range.getClientRects()[0]
      if (!rect) throw new Error('Missing selection bounds')
      const caret = document.createRange()
      caret.setStart(targetNode, (targetNode.textContent ?? '').length)
      caret.collapse(true)
      const end = caret.getClientRects()[0]
      if (!end) throw new Error('Missing drop target bounds')
      return {
        from: { x: rect.left + 5, y: rect.top + rect.height / 2 },
        to: { x: end.left - 1, y: end.top + end.height / 2 }
      }
    })
    await page.mouse.move(points.from.x, points.from.y)
    await page.mouse.down()
    await page.mouse.move(points.to.x, points.to.y, { steps: 8 })
    await expect(page.locator('.mu-text-drop-caret')).toBeVisible()
    await page.mouse.up()
    await expect(page.locator('.mu-content').nth(0)).toHaveText('ADE')
    await expect(page.locator('.mu-content').nth(1)).toHaveText('TargetBC')
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect.poll(() => readFile(filePath, 'utf8')).toBe('ADE\n\nTargetBC\n')
    await clickMenuById(app, 'undoMenuItem')
    await expect(page.locator('.mu-content').nth(0)).toHaveText('ABCDE')
    await expect(page.locator('.mu-content').nth(1)).toHaveText('Target')
  } finally {
    await app.close()
  }
})
