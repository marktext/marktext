import type { Muya } from '@muyajs/core'
import type { ElectronApplication, Page } from 'playwright'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { clickMenuById, launchElectron, launchWithMarkdown, sendIpcToRenderer, waitForEditor } from './helpers'

interface IContentElement extends HTMLElement {
  __MUYA_BLOCK__: { text: string; muya: Muya }
}
interface IEditorSession {
  app: ElectronApplication
  page: Page
  filePath: string
}

async function withDocument(markdown: string, run: (session: IEditorSession) => Promise<void>, showTabs = false) {
  const session = await launchWithMarkdown(markdown, {
    preferences: { language: 'en', autoSave: false },
    windowLayout: { showTabBar: showTabs }
  })
  try {
    await run(session)
  } finally {
    await session.app.close()
  }
}

async function contentTexts(page: Page) {
  return page.locator('.mu-content').evaluateAll(nodes => nodes.map(node => (node as IContentElement).__MUYA_BLOCK__.text))
}

async function markdown(page: Page) {
  return page.locator('.mu-content').first().evaluate(node => {
    const muya = (node as IContentElement).__MUYA_BLOCK__.muya
    muya.flush()
    return muya.getMarkdown()
  })
}

async function dragPoints(page: Page, source: number, start: number, end: number, target: number, offset = -1) {
  return page.evaluate(({ source, start, end, target, offset }) => {
    const nodes = [...document.querySelectorAll<IContentElement>('.mu-content')]
    const sourceNode = nodes[source]
    const targetNode = nodes[target]
    if (!sourceNode || !targetNode) throw new Error('Missing content block')
    const endpoint = (element: HTMLElement, position: number) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let node = walker.nextNode()
      let remaining = position
      while (node) {
        const length = (node.textContent ?? '').length
        if (remaining <= length) return { node, offset: remaining }
        remaining -= length
        node = walker.nextNode()
      }
      throw new Error(`Offset ${position} has no DOM endpoint`)
    }
    const first = endpoint(sourceNode, start)
    const last = endpoint(sourceNode, end)
    const range = document.createRange()
    range.setStart(first.node, first.offset)
    range.setEnd(last.node, last.offset)
    const selection = document.getSelection()
    if (!selection) throw new Error('Missing browser selection')
    const root = sourceNode.closest<HTMLElement>('.mu-editor')
    root?.focus()
    selection.removeAllRanges()
    selection.addRange(range)
    const bounds = [...range.getClientRects()].find(rect => rect.width > 0 && rect.height > 0)
    const destination = endpoint(targetNode, offset < 0 ? targetNode.__MUYA_BLOCK__.text.length : offset)
    const caret = document.createRange()
    caret.setStart(destination.node, destination.offset)
    caret.collapse(true)
    const targetBounds = caret.getClientRects()[0]
    if (!bounds || !targetBounds) throw new Error('Missing visible drag coordinates')
    return {
      from: { x: bounds.left + Math.min(3, bounds.width / 2), y: bounds.top + bounds.height / 2 },
      to: { x: targetBounds.left, y: targetBounds.top + targetBounds.height / 2 }
    }
  }, { source, start, end, target, offset })
}

async function beginDrag(page: Page, points: Awaited<ReturnType<typeof dragPoints>>) {
  await page.mouse.move(points.from.x, points.from.y)
  await page.mouse.down()
  await page.mouse.move(points.from.x + 10, points.from.y)
  await page.mouse.move(points.to.x, points.to.y, { steps: 8 })

}

async function selectedText(page: Page) {
  return page.locator('.mu-content').first().evaluate(node => (node as IContentElement).__MUYA_BLOCK__.muya.getSelectedText())
}

for (const [offset, expected] of [[0, 'BCADE'], [5, 'ADEBC']] as const) {
  test(`A01 same-block move to ${offset}`, async() => {
    await withDocument('ABCDE\n', async({ app, page }) => {
      await beginDrag(page, await dragPoints(page, 0, 1, 3, 0, offset))
      await page.mouse.up()
      await expect.poll(() => contentTexts(page)).toEqual([expected])
      expect(await selectedText(page)).toBe('BC')
      await clickMenuById(app, 'undoMenuItem')
      await expect.poll(() => contentTexts(page)).toEqual(['ABCDE'])
      await clickMenuById(app, 'redoMenuItem')
      await expect.poll(() => contentTexts(page)).toEqual([expected])
    })
  })
}

for (const [copy, offset, expected] of [
  [false, 1, 'ABCDE'], [false, 2, 'ABCDE'], [false, 3, 'ABCDE'],
  [true, 2, 'ABCDE'], [true, 1, 'ABCBCDE'], [true, 3, 'ABCBCDE']
] as const) {
  test(`A08 ${copy ? 'copy' : 'move'} at source offset ${offset}`, async() => {
    await withDocument('ABCDE\n', async({ page }) => {
      await beginDrag(page, await dragPoints(page, 0, 1, 3, 0, offset))
      const modifier = process.platform === 'darwin' ? 'Alt' : 'Control'
      if (copy) await page.keyboard.down(modifier)
      await page.mouse.up()
      if (copy) await page.keyboard.up(modifier)
      await expect.poll(() => contentTexts(page)).toEqual([expected])
      const undoCount = await page.locator('.mu-content').first().evaluate(node =>
        (node as IContentElement).__MUYA_BLOCK__.muya.editor.history.getHistory().stack.undo.length
      )
      expect(undoCount).toBe(expected === 'ABCDE' ? 0 : 1)
    })
  })
}

const targetCases = [
  { name: 'ATX heading', markdown: '# Target', index: 1, raw: '# TargetBC' },
  { name: 'list item', markdown: '- Target', index: 1, raw: 'TargetBC' },
  { name: 'blockquote', markdown: '> Target', index: 1, raw: 'TargetBC' },
  { name: 'Setext heading', markdown: 'Target\n===', index: 1, raw: 'TargetBC' },
  { name: 'table cell', markdown: '| Target |\n| --- |\n| Value |', index: 1, raw: 'TargetBC' },
  { name: 'code content', markdown: '```text\nTarget\n```', index: 2, raw: 'TargetBC' }
]
for (const scenario of targetCases) {
  test(`A03 move into ${scenario.name}`, async() => {
    await withDocument(`ABCDE\n\n${scenario.markdown}\n`, async({ page }) => {
      await beginDrag(page, await dragPoints(page, 0, 1, 3, scenario.index))
      await page.mouse.up()
      await expect.poll(async() => (await contentTexts(page))[scenario.index]).toBe(scenario.raw)
      expect((await contentTexts(page))[0]).toBe('ADE')
    })
  })
  test(`A03 move from ${scenario.name}`, async() => {
    await withDocument(`ABCDE\n\n${scenario.markdown}\n`, async({ page }) => {
      const start = scenario.name === 'ATX heading' ? 2 : 0
      await beginDrag(page, await dragPoints(page, scenario.index, start, start + 2, 0))
      await page.mouse.up()
      await expect.poll(async() => (await contentTexts(page))[0]).toBe('ABCDETa')
      expect(await selectedText(page)).toBe('Ta')
    })
  })
}

for (const target of ['# Target', '| Target |\n| --- |\n| Value |']) {
  for (const copy of [false, true]) {
    test(`A05 A17 A18 multiline ${copy ? 'copy' : 'move'} into ${target}`, async() => {
      await withDocument(`甲\n乙\n\n${target}\n`, async({ app, page, filePath }) => {
        await beginDrag(page, await dragPoints(page, 0, 0, 3, 1))
        const modifier = process.platform === 'darwin' ? 'Alt' : 'Control'
        if (copy) await page.keyboard.down(modifier)
        await page.mouse.up()
        if (copy) await page.keyboard.up(modifier)
        await expect.poll(() => selectedText(page)).toBe('甲<br>乙')
        expect((await contentTexts(page))[0]).toBe(copy ? '甲\n乙' : '')
        await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
        await expect.poll(() => readFile(filePath, 'utf8')).toContain('Target甲<br>乙')
        await clickMenuById(app, 'undoMenuItem')
        await expect.poll(async() => (await contentTexts(page))[0]).toBe('甲\n乙')
        expect((await contentTexts(page))[1]).toBe(target.startsWith('#') ? '# Target' : 'Target')
        await clickMenuById(app, 'redoMenuItem')
        await expect.poll(() => selectedText(page)).toBe('甲<br>乙')
      })
    })
  }
}

test('A06 A12 multiline moves preserve ordinary line breaks and an empty source', async() => {
  await withDocument('甲\n乙\n\nTarget\n', async({ page }) => {
    await beginDrag(page, await dragPoints(page, 0, 0, 3, 1))
    await page.mouse.up()
    await expect.poll(() => contentTexts(page)).toEqual(['', 'Target甲\n乙'])
  })
})

test('A07 modifier changes during dragging determine the final operation', async() => {
  await withDocument('ABCDE\n\nTarget\n', async({ page }) => {
    await beginDrag(page, await dragPoints(page, 0, 1, 3, 1))
    const modifier = process.platform === 'darwin' ? 'Alt' : 'Control'
    await page.keyboard.down(modifier)
    await expect(page.locator('.mu-text-drag-preview')).toHaveAttribute('data-operation', 'copy')
    await page.keyboard.up(modifier)
    await expect(page.locator('.mu-text-drag-preview')).toHaveAttribute('data-operation', 'move')
    await page.mouse.up()
    await expect.poll(() => contentTexts(page)).toEqual(['ADE', 'TargetBC'])
  })
})

for (const action of ['Escape', 'outside', 'blur', 'read-only', 'replace']) {
  test(`A09 cancels on ${action}`, async() => {
    await withDocument('ABCDE\n\nTarget\n', async({ app, page }) => {
      await beginDrag(page, await dragPoints(page, 0, 1, 3, 1))
      await expect(page.locator('.mu-text-drag-preview')).toBeVisible()
      if (action === 'Escape') await page.keyboard.press('Escape')
      if (action === 'outside') await page.mouse.move(5, 5)
      if (action === 'blur') {
        const window = await app.browserWindow(page)
        await window.evaluate(window => window.blur())
      }
      if (action === 'read-only') {
        await clickMenuById(app, 'readOnlyModeMenuItem')
        await expect(page.locator('.mu-editor')).toHaveAttribute('contenteditable', 'false')
      }
      if (action === 'replace') {
        await page.locator('.mu-content').first().evaluate(node => {
          (node as IContentElement).__MUYA_BLOCK__.muya.setContent('Replacement')
        })
      }
      await page.mouse.up()
      await expect(page.locator('.mu-text-drag-preview')).toHaveCount(0)
      await expect.poll(() => markdown(page)).toBe(action === 'replace' ? 'Replacement\n' : 'ABCDE\n\nTarget\n')
    })
  })
}

for (const [sourceText, start, end, moved] of [
  ['中文😀é结束', 2, 4, '😀'], ['中文😀é结束', 4, 6, 'é'],
  ['**苹果香蕉**', 2, 4, '苹果'], ['[link](https://example.com)', 1, 5, 'link']
] as const) {
  test(`A11 preserves selected source text ${moved}`, async() => {
    await withDocument(`${sourceText}\n\nTarget\n`, async({ page }) => {
      await beginDrag(page, await dragPoints(page, 0, start, end, 1))
      await page.mouse.up()
      await expect.poll(async() => (await contentTexts(page))[1]).toBe(`Target${moved}`)
      expect((await contentTexts(page))[0]).toBe(sourceText.slice(0, start) + sourceText.slice(end))
    })
  })
}

test('A04 cross-content selections cannot start text dragging', async() => {
  await withDocument('ABCDE\n\nTarget\n', async({ page }) => {
    const points = await dragPoints(page, 0, 1, 3, 1)
    await page.locator('.mu-content').first().evaluate(node => {
      const muya = (node as IContentElement).__MUYA_BLOCK__.muya
      muya.selectAll()
      muya.selectAll()
    })
    await beginDrag(page, points)
    await page.mouse.up()
    expect(await markdown(page)).toBe('ABCDE\n\nTarget\n')
    await expect(page.locator('.mu-text-drag-preview')).toHaveCount(0)
  })
})

test('A13 preserves all system clipboard formats during text dragging', async() => {
  await withDocument('ABCDE\n\nTarget\n', async({ app, page }) => {
    const fingerprint = async() => {
      const contents = await app.evaluate(async({ clipboard }) => {
        const items = await clipboard.read()
        return Promise.all(items.map(item => Promise.all([...item.types].sort().map(async(format) => {
          const value = await item.getType(format)
          return { format, data: value instanceof Blob ? [...new Uint8Array(await value.arrayBuffer())] : value }
        }))))
      })
      return createHash('sha256').update(JSON.stringify(contents)).digest('hex')
    }
    const before = await fingerprint()
    await beginDrag(page, await dragPoints(page, 0, 1, 3, 1))
    await page.mouse.up()
    expect(await fingerprint()).toBe(before)
  })
})

test('A14 saved text survives closing and reopening the application', async() => {
  let savedPath = ''
  await withDocument('ABCDE\n\nTarget\n', async({ app, page, filePath }) => {
    savedPath = filePath
    await beginDrag(page, await dragPoints(page, 0, 1, 3, 1))
    await page.mouse.up()
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect.poll(() => readFile(filePath, 'utf8')).toBe('ADE\n\nTargetBC\n')
  })
  const reopened = await launchElectron([savedPath])
  try {
    await waitForEditor(reopened.page)
    await expect.poll(() => contentTexts(reopened.page)).toEqual(['ADE', 'TargetBC'])
  } finally {
    await reopened.app.close()
  }
})

test('A16 a text drag does not auto-scroll near the viewport edge', async() => {
  await withDocument('ABCDE\n\nTarget\n\n' + 'More text\n\n'.repeat(100), async({ page }) => {
    await beginDrag(page, await dragPoints(page, 0, 1, 3, 1))
    const position = () => page.evaluate(() => [...document.querySelectorAll('*')].reduce((sum, node) => sum + node.scrollTop, 0))
    const before = await position()
    await page.mouse.move(450, 700)
    await page.waitForTimeout(350)
    expect(await position()).toBe(before)
    await page.keyboard.press('Escape')
    await page.mouse.up()
  })
})

test('native-style movement without a buttons mask retains the captured drag', async() => {
  await withDocument('ABCDE\n\nTarget\n', async({ page }) => {
    const points = await dragPoints(page, 0, 1, 3, 1)
    await page.mouse.move(points.from.x, points.from.y)
    await page.mouse.down()
    await page.locator('.mu-editor').dispatchEvent('mousemove', {
      clientX: points.to.x, clientY: points.to.y, buttons: 0
    })
    await expect(page.locator('.mu-text-drag-preview')).toBeVisible()
    await page.mouse.move(points.to.x, points.to.y)
    await page.mouse.up()
    await expect.poll(() => contentTexts(page)).toEqual(['ADE', 'TargetBC'])
  })
})

test('A10 dragging is isolated from typing before and after the move', async() => {
  await withDocument('ABCDE\n\nTarget\n', async({ app, page }) => {
    await page.locator('.mu-content').first().click()
    await page.keyboard.press('End')
    await page.keyboard.type('!')
    await expect.poll(async() => (await contentTexts(page))[0]).toBe('ABCDE!')
    await beginDrag(page, await dragPoints(page, 0, 1, 3, 1))
    await page.mouse.up()
    await expect.poll(() => contentTexts(page)).toEqual(['ADE!', 'TargetBC'])
    await page.keyboard.type('?')
    await expect.poll(() => contentTexts(page)).toEqual(['ADE!', 'Target?'])
    await clickMenuById(app, 'undoMenuItem')
    await expect.poll(() => contentTexts(page)).toEqual(['ADE!', 'TargetBC'])
    await clickMenuById(app, 'undoMenuItem')
    await expect.poll(() => contentTexts(page)).toEqual(['ABCDE!', 'Target'])
    await clickMenuById(app, 'undoMenuItem')
    await expect.poll(() => contentTexts(page)).toEqual(['ABCDE', 'Target'])
  })
})

for (const original of ['\r\n甲\r乙\n', '\n甲\n\n乙\n', '甲<br>\n乙']) {
  test(`A17 logical breaks and existing markup ${JSON.stringify(original)}`, async() => {
    await withDocument('Source\n\n# Target\n', async({ page }) => {
      await page.locator('.mu-content').first().evaluate((node, original) => {
        const muya = (node as IContentElement).__MUYA_BLOCK__.muya
        muya.setContent([
          { name: 'paragraph', text: original },
          { name: 'atx-heading', text: '# Target', meta: { level: 1 } }
        ])
      }, original)
      await beginDrag(page, await dragPoints(page, 0, 0, original.length, 1))
      await page.mouse.up()
      const converted = original.replace(/\r\n|[\r\n]/g, '<br>')
      await expect.poll(() => selectedText(page)).toBe(converted)
      expect((await contentTexts(page))[1]).toBe(`# Target${converted}`)
    })
  })
}

test('A15 block handle reordering coexists with text dragging', async() => {
  await withDocument('First paragraph\n\nSecond paragraph\n', async({ page }) => {
    const first = await page.locator('.mu-content').nth(0).boundingBox()
    const second = await page.locator('.mu-content').nth(1).boundingBox()
    if (!first || !second) throw new Error('Missing paragraph bounds')
    await page.mouse.move(first.x + 12, first.y + first.height / 2)
    const handle = page.locator('.mu-front-button')
    await expect(handle).toBeVisible()
    const bounds = await handle.boundingBox()
    if (!bounds) throw new Error('Missing drag handle')
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(400)
    await page.mouse.move(second.x + 15, second.y + second.height * 0.8, { steps: 8 })
    await page.waitForTimeout(150)
    await page.mouse.up()
    await expect.poll(() => contentTexts(page)).toEqual(['Second paragraph', 'First paragraph'])
  })
})

test('A15 table column dragging retains the existing reorder behavior', async() => {
  await withDocument('| col-a | col-b |\n| --- | --- |\n| A | B |\n\nAfter\n', async({ page }) => {
    const table = page.locator('table')
    const cells = table.locator('tr').last().locator('td')
    const first = await cells.nth(0).boundingBox()
    const second = await cells.nth(1).boundingBox()
    if (!first || !second) throw new Error('Missing table cells')
    const x = first.x + first.width / 2
    const y = first.y + first.height + 10
    await page.mouse.move(x, y)
    await page.waitForTimeout(80)
    await page.mouse.move(x, y + 1)
    const bar = page.locator('.mu-table-drag-bar')
    await expect.poll(() => bar.evaluate(node => {
      const wrapper = node.closest<HTMLElement>('.mu-float-wrapper')
      return Number.parseFloat(wrapper?.style.opacity || '0')
    })).toBeGreaterThan(0)
    const bounds = await bar.boundingBox()
    if (!bounds) throw new Error('Missing table drag bar')
    const barX = bounds.x + bounds.width / 2
    const barY = bounds.y + bounds.height / 2
    await page.mouse.move(barX, barY)
    await page.mouse.down()
    await page.waitForTimeout(400)
    await page.mouse.move(second.x + second.width + 10, barY, { steps: 10 })
    await page.mouse.up()
    await expect.poll(() => markdown(page)).toMatch(/\|\s*col-b\s*\|\s*col-a\s*\|/)
    expect(await markdown(page)).toMatch(/\|\s*B\s*\|\s*A\s*\|/)
  })
})

test('A09 switching tabs during a drag preserves both documents', async() => {
  await withDocument('ABCDE\n\nTarget\n', async({ app, page }) => {
    await beginDrag(page, await dragPoints(page, 0, 1, 3, 1))
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'Replacement\n')
    await expect.poll(() => contentTexts(page)).toEqual(['Replacement'])
    await page.mouse.up()
    await expect(page.locator('.mu-text-drag-preview')).toHaveCount(0)
    await page.locator('.editor-tabs li').filter({ hasText: 'note.md' }).click()
    await expect.poll(() => contentTexts(page)).toEqual(['ABCDE', 'Target'])
  }, true)
})

test('A09 closing the window during a drag leaves the original file unchanged', async() => {
  await withDocument('ABCDE\n\nTarget\n', async({ app, page, filePath }) => {
    await beginDrag(page, await dragPoints(page, 0, 1, 3, 1))
    const window = await app.browserWindow(page)
    await window.evaluate(window => window.close())
    await expect.poll(() => page.isClosed()).toBe(true)
    expect(await readFile(filePath, 'utf8')).toBe('ABCDE\n\nTarget\n')
  })
})
