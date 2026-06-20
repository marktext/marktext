import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  waitForMenuReady,
  getMarkdownContent,
  setSourceMarkdown,
  sendIpcToRenderer,
  expectNoRendererErrors
} from './helpers'

// Checklist item 32 — task list + autoCheck cascade, driven by clicking a REAL
// nested checkbox in the built Electron app.
//
// The cascade itself is unit-covered in
// packages/muya/src/block/gfm/taskListCheckbox/__tests__/parityAutoCheck.spec.ts
// (it drives `update(checked, 'user')` directly). The slice NOT covered there is
// the end-to-end path of a real DOM click on the rendered `input[type=checkbox]`:
// the engine renders task checkboxes as `input.mu-task-list-checkbox` in
// Electron's Chromium (not a span — that branch is Firefox-only). Clicking the
// native input toggles its `.checked`, then the engine's click handler reads
// `event.target.checked` and runs `update(checked, 'user')`.
//
// `autoCheck` is a renderer editor option seeded from preferences (default
// false). The renderer's preferences store listens on `mt::user-preference`
// (store/preferences.ts) and the editor watches `autoCheck`
// (editor.vue → editor.setOptions({ autoCheck })). So we flip it by sending
// `mt::user-preference` to the renderer, which threads it into the live engine.

// A parent task item with two nested children, all unchecked. Matches the
// proven nesting fixture from the unit parity spec.
const NESTED_TASKS = '- [ ] parent\n\n  - [ ] child1\n  - [ ] child2\n'

const setAutoCheck = async(app: ElectronApplication, value: boolean): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::user-preference', { autoCheck: value })
}

// Read the `.checked` flag of the nth rendered task checkbox input.
const checkboxChecked = async(page: Page, index: number): Promise<boolean> => {
  return await page.evaluate((i) => {
    const inputs = document.querySelectorAll<HTMLInputElement>(
      '.editor-component input[type=checkbox]'
    )
    const input = inputs[i]
    return !!input && input.checked
  }, index)
}

const checkboxCount = async(page: Page): Promise<number> => {
  return await page.evaluate(
    () => document.querySelectorAll('.editor-component input[type=checkbox]').length
  )
}

// Reset the document back to the all-unchecked nested fixture via source mode,
// then wait for the three rendered checkboxes to re-attach unchecked.
const reloadFixture = async(page: Page, app: ElectronApplication): Promise<void> => {
  await setSourceMarkdown(page, app, NESTED_TASKS)
  await expect.poll(() => checkboxCount(page)).toBe(3)
  await expect.poll(() => checkboxChecked(page, 0)).toBe(false)
  await expect.poll(() => checkboxChecked(page, 1)).toBe(false)
  await expect.poll(() => checkboxChecked(page, 2)).toBe(false)
}

test.describe('Checklist 32 — task list autoCheck cascade via a real checkbox click', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(NESTED_TASKS, { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
    // Three task items render three native checkboxes.
    await expect.poll(() => checkboxCount(page)).toBe(3)
  })

  test.afterAll(async() => {
    await app.close()
  })

  test('with autoCheck ON, clicking the parent flips both descendants + saves "- [x]" x3', async() => {
    await setAutoCheck(app, true)
    await page.waitForTimeout(200)

    // Baseline: every checkbox is unchecked.
    expect(await checkboxChecked(page, 0)).toBe(false)
    expect(await checkboxChecked(page, 1)).toBe(false)
    expect(await checkboxChecked(page, 2)).toBe(false)

    // Click the REAL parent checkbox input.
    await page.click('.editor-component input[type=checkbox] >> nth=0')

    // The cascade flips both children checked.
    await expect.poll(() => checkboxChecked(page, 0)).toBe(true)
    await expect.poll(() => checkboxChecked(page, 1)).toBe(true)
    await expect.poll(() => checkboxChecked(page, 2)).toBe(true)

    // Saved markdown shows the checked marker for all three task items.
    const md = await getMarkdownContent(page, app)
    const checked = (md.match(/- \[x\]/g) || []).length
    expect(checked).toBe(3)

    await expectNoRendererErrors(app)
  })

  test('with autoCheck OFF, clicking the parent changes only the parent (no cascade)', async() => {
    // Turn the cascade off and reset to a clean all-unchecked nested list.
    // (The previous test left all three checked.)
    await setAutoCheck(app, false)
    await page.waitForTimeout(200)
    await reloadFixture(page, app)

    // Click the REAL parent checkbox input — the exact same gesture as the ON
    // test, so the only difference is the autoCheck option.
    await page.click('.editor-component input[type=checkbox] >> nth=0')

    await expect.poll(() => checkboxChecked(page, 0)).toBe(true)
    // No cascade: both children stay unchecked.
    expect(await checkboxChecked(page, 1)).toBe(false)
    expect(await checkboxChecked(page, 2)).toBe(false)

    // Saved markdown shows exactly one checked marker (the parent).
    const md = await getMarkdownContent(page, app)
    const checked = (md.match(/- \[x\]/g) || []).length
    expect(checked).toBe(1)
    expect(md).toContain('- [x] parent')

    await expectNoRendererErrors(app)
  })
})
