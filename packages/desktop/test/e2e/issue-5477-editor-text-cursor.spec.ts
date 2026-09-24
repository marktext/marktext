import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// #5477: only headings showed the I-beam. #2850 split the affordance in two —
// `cursor: default` on the scrolling mount (`.editor-component`) and
// `cursor: text` on the text column (legacy `#ag-editor-id`) — but the muya
// rewrite dropped the second half, so the inherited `default` reached every
// block and h1-h6's own `cursor: text` was the lone survivor.

const DOC = [
  '# Heading',
  '',
  'Plain paragraph with a [link](https://example.com).',
  '',
  '```js',
  'const a = 1',
  '```',
  '',
  '> quoted text',
  '',
  '- [ ] task item',
  '',
  '| a | b |',
  '| - | - |',
  '| 1 | 2 |',
  ''
].join('\n')

let app: ElectronApplication
let page: Page

test.beforeAll(async() => {
  const launched = await launchWithMarkdown(DOC)
  app = launched.app
  page = launched.page
  await page.waitForSelector('.mu-container table td')
})

test.afterAll(async() => {
  if (app) await app.close()
})

const cursorOf = (selector: string): Promise<string> =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`no element for ${sel}`)
    return getComputedStyle(el).cursor
  }, selector)

// What the pointer actually resolves to: the cursor of the topmost element
// under the middle of `selector`, which is the inner content span rather than
// the block itself.
const cursorUnderPointer = (selector: string): Promise<string> =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (!el) throw new Error(`no element for ${sel}`)
    const { left, top, width, height } = el.getBoundingClientRect()
    const hit = document.elementFromPoint(left + width / 2, top + height / 2)
    if (!hit) throw new Error(`nothing under the middle of ${sel}`)
    return getComputedStyle(hit).cursor
  }, selector)

test('every editable block shows the text cursor, not just headings', async() => {
  for (const selector of [
    '.mu-container h1',
    '.mu-container p',
    '.mu-container pre',
    '.mu-container pre code',
    '.mu-container blockquote',
    '.mu-container li',
    '.mu-container table td'
  ]) {
    expect(await cursorOf(selector), selector).toBe('text')
    expect(await cursorUnderPointer(selector), `pointer over ${selector}`).toBe('text')
  }
})

test('the scroll area outside the text column keeps the arrow', async() => {
  expect(await cursorOf('.editor-component')).toBe('default')
})

test('clickable content keeps the hand cursor', async() => {
  for (const selector of [
    '.mu-container a',
    '.mu-container input[type=checkbox]'
  ]) {
    expect(await cursorOf(selector), selector).toBe('pointer')
  }
})
