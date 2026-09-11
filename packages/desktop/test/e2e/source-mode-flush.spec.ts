import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  waitForMenuReady,
  getMarkdownContent,
  expectNoRendererErrors
} from './helpers'

// Entering source mode must flush the engine's queued rAF-batch ops into the
// tab first. An edit made in the same frame as the mode switch (here: a task
// checkbox click) was missing from the CodeMirror snapshot, and switching back
// out of source mode cancelled the scheduled flush — silently reverting the
// edit. Same unflushed-edit class as saving (#3803) and tab switch (#2938).

const NESTED_TASKS = '- [ ] parent\n\n  - [ ] child1\n  - [ ] child2\n'

const checkboxCount = async(page: Page): Promise<number> => {
  return await page.evaluate(
    () => document.querySelectorAll('.editor-component input[type=checkbox]').length
  )
}

test.describe('source mode entry flushes same-frame edits', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(NESTED_TASKS, { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
    await expect.poll(() => checkboxCount(page)).toBe(3)
  })

  test.afterAll(async() => {
    await app.close()
  })

  test('a checkbox click immediately followed by source mode is not lost', async() => {
    await page.click('.editor-component input[type=checkbox] >> nth=0')

    // No settle wait: the very next thing the source view shows must already
    // contain the toggle.
    const md = await getMarkdownContent(page, app)
    expect(md).toContain('- [x] parent')

    // And the toggle survives the roundtrip back to WYSIWYG.
    await page.waitForTimeout(300)
    const after = await getMarkdownContent(page, app)
    expect(after).toContain('- [x] parent')

    await expectNoRendererErrors(app)
  })
})
