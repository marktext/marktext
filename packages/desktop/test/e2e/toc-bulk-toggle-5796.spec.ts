import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { clickMenuById, launchWithMarkdown, makeRoomForOutline, sendIpcToRenderer, toggleReadingMode } from './helpers'

const MARKDOWN = '## A\n\n#### B\n\n##### B1\n\n## C\n\n### C1\n\n# D\n\n## D1\n'
const ALL_LABELS = ['A', 'B', 'B1', 'C', 'C1', 'D', 'D1']
const ROOT_LABELS = ['A', 'C', 'D']
const visibleLabels = (page: Page): Promise<string[]> =>
  page.locator('.side-bar-toc .el-tree-node__label:visible').allTextContents()
const command = (app: ElectronApplication, action: 'collapse' | 'expand'): Promise<void> =>
  sendIpcToRenderer(app, 'mt::execute-command-by-id', `view.outline-${action}-all`)
const toggleNode = async(page: Page, label: string): Promise<void> => {
  await page.locator('.side-bar-toc .el-tree-node__content').filter({
    has: page.locator('.el-tree-node__label', { hasText: new RegExp(`^${label}$`) })
  }).locator(':scope > .el-tree-node__expand-icon').click()
}
const clickBulkToggle = async(page: Page): Promise<void> => {
  await page.locator('.outline-toggle').hover()
  await page.locator('.outline-bulk-toggle').click()
}

let app: ElectronApplication
let page: Page

test.beforeEach(async() => {
  ;({ app, page } = await launchWithMarkdown(MARKDOWN, { preferences: { language: 'en' } }))
  await makeRoomForOutline(app, page)
  await expect.poll(() => visibleLabels(page)).toEqual(ALL_LABELS)
})
test.afterEach(async() => { await app?.close() })

test('one button recursively folds all branches and expands hidden descendants', async() => {
  const button = page.locator('.outline-bulk-toggle')
  await expect(button).toHaveCount(1)
  await expect(button).toHaveAccessibleName('Collapse all')
  await toggleNode(page, 'B')
  await expect(button).toHaveAccessibleName('Collapse all')
  await clickBulkToggle(page)
  await expect.poll(() => visibleLabels(page)).toEqual(ROOT_LABELS)
  await expect(button).toHaveAccessibleName('Expand all')

  await toggleNode(page, 'A')
  await expect.poll(() => visibleLabels(page)).toEqual(['A', 'B', 'C', 'D'])
  await expect(button).toHaveAccessibleName('Collapse all')
  await command(app, 'expand')
  await expect.poll(() => visibleLabels(page)).toEqual(ALL_LABELS)
  await clickBulkToggle(page)
  await clickBulkToggle(page)
  await expect.poll(() => visibleLabels(page)).toEqual(ALL_LABELS)
})

test('bulk folds survive tab switches, content edits and source mode', async() => {
  await command(app, 'collapse')
  await expect.poll(() => visibleLabels(page)).toEqual(ROOT_LABELS)
  await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, MARKDOWN)
  await expect.poll(() => visibleLabels(page)).toEqual(ALL_LABELS)
  await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 0)
  await expect.poll(() => visibleLabels(page)).toEqual(ROOT_LABELS)
  await clickMenuById(app, 'sourceCodeModeMenuItem')
  await expect(page.locator('.source-code .CodeMirror')).toBeVisible()
  await page.evaluate(() => {
    const cm = document.querySelector('.CodeMirror') as Element & {
      CodeMirror: { replaceRange(text: string, pos: { line: number; ch: number }): void }
    }
    cm.CodeMirror.replaceRange('Body\n\n', { line: 2, ch: 0 })
  })
  await expect.poll(() => visibleLabels(page)).toEqual(ROOT_LABELS)
  await command(app, 'expand')
  await expect.poll(() => visibleLabels(page)).toEqual(ALL_LABELS)
  await command(app, 'collapse')
  await expect.poll(() => visibleLabels(page)).toEqual(ROOT_LABELS)
  await clickMenuById(app, 'sourceCodeModeMenuItem')
  await expect.poll(() => visibleLabels(page)).toEqual(ROOT_LABELS)
})

test('commands reveal a hidden outline without modifying or scrolling the document', async() => {
  const editor = page.locator('.mu-editor')
  await editor.click()
  const before = await editor.evaluate(el => ({ html: el.innerHTML, scroll: el.scrollTop }))
  await clickMenuById(app, 'tocMenuItem')
  await page.mouse.move(1200, 500)
  await expect(page.locator('.outline-body')).toBeHidden()
  for (let i = 0; i < 2; i++) await command(app, 'collapse')
  await expect.poll(() => visibleLabels(page)).toEqual(ROOT_LABELS)
  expect(await editor.evaluate(el => ({ html: el.innerHTML, scroll: el.scrollTop }))).toEqual(before)
  await expect(page.locator('.tabs-container > li.active')).not.toHaveClass(/unsaved/)
  await toggleReadingMode(page)
  await command(app, 'expand')
  await expect.poll(() => visibleLabels(page)).toEqual(ALL_LABELS)
})

test('command palette exposes both actions without default shortcuts', async() => {
  await sendIpcToRenderer(app, 'mt::show-command-palette')
  const collapse = page.locator('.commands > li').filter({ hasText: 'Outline: Collapse All' })
  const expand = page.locator('.commands > li').filter({ hasText: 'Outline: Expand All' })
  await expect(collapse).toBeVisible()
  await expect(expand).toBeVisible()
  await expect(collapse.locator('kbd')).toHaveCount(0)
  await expect(expand.locator('kbd')).toHaveCount(0)
  await collapse.click()
  await expect.poll(() => visibleLabels(page)).toEqual(ROOT_LABELS)
})

test('floating toolbar stays inside the card and supports keyboard activation', async() => {
  const win = await app.browserWindow(page)
  await win.evaluate(window => window.setContentSize(850, 800))
  await page.mouse.move(800, 500)
  const outline = page.locator('.document-outline')
  await expect(outline).toHaveClass(/is-floating/)
  await expect(page.locator('.outline-body')).toBeHidden()
  await page.locator('.outline-toggle').focus()
  const button = page.locator('.outline-bulk-toggle')
  await expect(button).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(button).toBeFocused()
  const card = await page.locator('.outline-body').boundingBox()
  const bounds = await button.boundingBox()
  expect(card && bounds && bounds.x >= card.x && bounds.x + bounds.width <= card.x + card.width).toBe(true)
  await page.keyboard.press('Enter')
  await expect.poll(() => visibleLabels(page)).toEqual(ROOT_LABELS)
  await expect(outline).toHaveClass(/is-visible/)
  await page.keyboard.press('Space')
  await expect.poll(() => visibleLabels(page)).toEqual(ALL_LABELS)
})

test('flat outlines disable the button and heading-free documents hide it', async() => {
  await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '# One\n\n# Two\n')
  await expect.poll(() => visibleLabels(page)).toEqual(['One', 'Two'])
  await expect(page.locator('.outline-bulk-toggle')).toBeDisabled()
  await command(app, 'collapse')
  await expect.poll(() => visibleLabels(page)).toEqual(['One', 'Two'])
  await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'Plain paragraph')
  await expect(page.locator('.document-outline')).toBeHidden()
  await command(app, 'expand')
  await expect(page.locator('.document-outline')).toBeHidden()
})
