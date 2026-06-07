import { test, expect } from '@playwright/test'
import type { Page } from 'playwright'
import { launchWithMarkdown, sendIpcToRenderer } from './helpers'

// Regression: toggling Observation Mode off must restore editing WITHOUT a tab
// switch (previously the tab froze — no typing/clicking — until switching tabs).
// The caret, scroll position and undo history must be preserved.

const editorText = (page: Page) =>
  page.evaluate(() =>
    (document.querySelector('.editor-component')?.textContent ?? '').replace(/\s+/g, ' ')
  )

const longDoc =
  '# Title\n\n' +
  Array.from({ length: 60 }, (_, i) => `Line ${i + 1} lorem ipsum`).join('\n\n') +
  '\n'

test('Observation Mode toggle off restores editing without a tab switch', async() => {
  test.setTimeout(120_000)
  const { app, page } = await launchWithMarkdown(longDoc)
  await page.waitForTimeout(700)

  await page.click('.editor-component')
  await page.keyboard.press('Control+End')
  await page.keyboard.type(' AAA', { delay: 15 })
  await page.waitForTimeout(300)
  expect((await editorText(page)).includes('AAA')).toBe(true)

  const scrollBefore = await page.evaluate(
    () => (document.querySelector('.editor-component') as HTMLElement)?.scrollTop ?? 0
  )

  // Toggle on: read-only, but the editor must stay interactive (scrollable /
  // selectable) — observed mode must NOT disable pointer-events.
  await sendIpcToRenderer(app, 'mt::toggle-observation-mode')
  await page.waitForTimeout(400)
  const observedState = await page.evaluate(() => {
    const el = document.querySelector('.editor-component') as HTMLElement
    return { ce: el.getAttribute('contenteditable'), pe: getComputedStyle(el).pointerEvents }
  })
  expect(observedState.ce).toBe('false')
  expect(observedState.pe).not.toBe('none')

  // Toggle off via IPC (== menu / keyboard shortcut), no clicking.
  await sendIpcToRenderer(app, 'mt::toggle-observation-mode')
  await page.waitForTimeout(500)

  // Type WITHOUT clicking first — this froze before the fix.
  await page.keyboard.type(' BBB', { delay: 15 })
  await page.waitForTimeout(300)
  const text = await editorText(page)

  // Editable again, and the caret stayed at the end (BBB appended after AAA
  // rather than jumping to the top of the document).
  expect(text.includes('AAA BBB')).toBe(true)

  // Undo still works (history survived the re-render).
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(300)
  expect((await editorText(page)).includes('BBB')).toBe(false)

  // Scroll position preserved across the toggle.
  const scrollAfter = await page.evaluate(
    () => (document.querySelector('.editor-component') as HTMLElement)?.scrollTop ?? 0
  )
  expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(40)

  await app.close()
})
