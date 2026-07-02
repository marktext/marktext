import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, focusEditor, enterSourceMode, exitSourceMode } from './helpers'

// #3531 — Paragraph and Format menu commands act on the hidden WYSIWYG engine,
// so they must be greyed out in source-code mode and re-enabled on return.

const readEnabled = (app: ElectronApplication) =>
  app.evaluate(({ Menu }) => {
    const m = Menu.getApplicationMenu()
    const get = (id: string) => {
      const i = m?.getMenuItemById(id)
      return i ? i.enabled : null
    }
    return {
      table: get('tableMenuItem'),
      heading1: get('heading1MenuItem'),
      strong: get('strongMenuItem'),
      emphasis: get('emphasisMenuItem')
    }
  })

test.describe('paragraph/format menus disabled in source mode (#3531)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Doc\n\nhello world\n', { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('menus are enabled in WYSIWYG, disabled in source mode, restored on exit', async() => {
    await expect.poll(() => readEnabled(app)).toEqual({
      table: true, heading1: true, strong: true, emphasis: true
    })

    await enterSourceMode(page, app)
    await expect.poll(() => readEnabled(app)).toEqual({
      table: false, heading1: false, strong: false, emphasis: false
    })

    await exitSourceMode(page, app)
    await expect.poll(() => readEnabled(app)).toEqual({
      table: true, heading1: true, strong: true, emphasis: true
    })
  })
})
