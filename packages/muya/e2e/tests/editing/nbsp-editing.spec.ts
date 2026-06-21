import { expect, test } from '../fixtures/muya'
import { getMarkdown } from '../helpers/api'
import { metaKey } from '../helpers/keyboard'

// #3840 follow-up: the html-escape literal is wrapped in an inner
// `.mu-html-escape-marker` span that is taken out of flow (position:absolute)
// when the caret is outside the entity, to fix width without breaking the
// line. This must not regress the editing core: copy / cut / cursor / selection
// all run off muya's text-offset + state model, which is immune to CSS
// positioning — these tests prove it end-to-end.

test('round-trips a &nbsp; entity through state unchanged', async ({ page }) => {
  await page.evaluate(() => window.muya!.setContent('Jul&nbsp;21'))
  expect(await getMarkdown(page)).toContain('Jul&nbsp;21')
})

test('placing the caret inside &nbsp; brings the literal back into flow (editable)', async ({ page }) => {
  await page.evaluate(() => window.muya!.setContent('a&nbsp;b'))

  // caret outside: the literal marker is out of flow (absolute)
  expect(
    await page.evaluate(() => {
      const m = document.querySelector('.mu-html-escape-marker') as HTMLElement
      return getComputedStyle(m).position
    })
  ).toBe('absolute')

  // caret inside the entity (offset 4 is within the 6-char "&nbsp;" run)
  await page.evaluate(() => {
    const w = window as unknown as { muya: { editor: any } }
    const block = w.muya.editor.scrollPage.firstContentInDescendant()
    w.muya.editor.activeContentBlock = block
    block.setCursor(4, 4, true)
  })
  await page.waitForTimeout(50)

  // caret inside: the literal is back in normal flow → visible + editable
  expect(
    await page.evaluate(() => {
      const m = document.querySelector('.mu-html-escape-marker') as HTMLElement
      return getComputedStyle(m).position
    })
  ).toBe('static')
})

test('the &nbsp; literal is editable when the caret is inside it', async ({ page }) => {
  await page.evaluate(() => window.muya!.setContent('a&nbsp;b'))
  const before = await getMarkdown(page)

  await page.evaluate(() => {
    const w = window as unknown as { muya: { editor: any, domNode: HTMLElement } }
    const block = w.muya.editor.scrollPage.firstContentInDescendant()
    w.muya.editor.activeContentBlock = block
    block.setCursor(4, 4, true) // inside "&nbsp;"
    w.muya.domNode.focus()
  })
  await page.keyboard.press('Backspace')
  await page.waitForTimeout(50)

  const after = await getMarkdown(page)
  expect(after).not.toBe(before)
  expect(after.replace(/\n+$/, '').length).toBeLessThan(before.replace(/\n+$/, '').length)
})

test('typing right after a &nbsp; lands at the correct offset', async ({ page }) => {
  await page.evaluate(() => window.muya!.setContent('a&nbsp;b'))
  await page.evaluate(() => {
    const w = window as unknown as { muya: { editor: any, domNode: HTMLElement } }
    const block = w.muya.editor.scrollPage.firstContentInDescendant()
    w.muya.editor.activeContentBlock = block
    block.setCursor(8, 8, true) // end, right after "b"
    w.muya.domNode.focus()
  })
  await page.keyboard.type('Z')
  await page.waitForTimeout(50)
  expect(await getMarkdown(page)).toContain('a&nbsp;bZ')
})

test('copying a selection across &nbsp; preserves the entity', async ({ browserName, context, page }) => {
  test.skip(browserName !== 'chromium', 'clipboard read/write unreliable on Firefox/WebKit headless — BACKLOG Phase 3.')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate(() => window.muya!.setContent('x&nbsp;y'))
  await page.evaluate(() => {
    window.muya!.focus()
    window.muya!.domNode.focus()
  })
  await page.keyboard.press(`${metaKey()}+a`)
  await page.keyboard.press(`${metaKey()}+c`)
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('&nbsp;')
})

test('cutting a selection across &nbsp; removes it and keeps the entity on the clipboard', async ({ browserName, context, page }) => {
  test.skip(browserName !== 'chromium', 'clipboard read/write unreliable on Firefox/WebKit headless — BACKLOG Phase 3.')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.evaluate(() => window.muya!.setContent('x&nbsp;y'))
  await page.evaluate(() => {
    window.muya!.focus()
    window.muya!.domNode.focus()
  })
  await page.keyboard.press(`${metaKey()}+a`)
  await page.keyboard.press(`${metaKey()}+x`)
  await page.waitForTimeout(50)
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toContain('&nbsp;')
  expect((await getMarkdown(page)).replace(/\n+$/, '')).toBe('')
})
