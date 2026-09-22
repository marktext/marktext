import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, waitForEditor } from './helpers'

const LONG_HEADING =
  '## A heading long enough that it cannot possibly fit on one line of the outline panel'

const DOC = ['# Outline', '', 'Intro.', '', LONG_HEADING, '', 'Body.', ''].join('\n')

const setWordWrap = async(page: Page, wordWrapInToc: boolean): Promise<void> => {
  await page.evaluate((prefs) => {
    window.electron.ipcRenderer.send('mt::set-user-preference', prefs)
  }, { wordWrapInToc })
  await page.waitForFunction(
    (wrap) => !!document.querySelector(wrap ? '.side-bar-toc-wordwrap' : '.side-bar-toc-overflow'),
    wordWrapInToc,
    { timeout: 5000 }
  )
}

// The long heading's label, and how tall one line of it is.
const measureLongLabel = (page: Page) =>
  page.evaluate(() => {
    const labels = Array.from(
      document.querySelectorAll('.side-bar-toc .el-tree-node__label')
    ) as HTMLElement[]
    const short = labels.find((l) => (l.textContent ?? '').trim() === 'Outline')
    const long = labels.find((l) => (l.textContent ?? '').trim().startsWith('A heading long'))
    if (!short || !long) throw new Error('the outline is missing one of the two entries')
    return {
      whiteSpace: getComputedStyle(long).whiteSpace,
      lineHeight: short.getBoundingClientRect().height,
      height: long.getBoundingClientRect().height
    }
  })

test.describe('TOC word wrap preference', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(DOC)
    app = launched.app
    page = launched.page
    await waitForEditor(page)
    const sidebarVisible = await page.evaluate(() => {
      const el = document.querySelector('.side-bar') as HTMLElement | null
      return !!(el && el.offsetParent !== null)
    })
    if (!sidebarVisible) await clickMenuById(app, 'sideBarMenuItem')
    await clickMenuById(app, 'tocMenuItem')
    await page.waitForSelector('.side-bar-toc .el-tree', { state: 'visible', timeout: 15000 })
    await page.waitForFunction(
      () => document.querySelectorAll('.side-bar-toc .el-tree-node__label').length >= 2,
      null,
      { timeout: 15000 }
    )
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  // Element Plus renders every label as `<el-text truncated>`, which declares
  // `white-space: nowrap` on the label itself — an inherited `normal` from the
  // row cannot beat that, so the preference did nothing (same shape as #5094).
  test('wraps a long entry onto several lines when the preference is on', async() => {
    await setWordWrap(page, true)
    const wrapped = await measureLongLabel(page)
    expect(wrapped.whiteSpace).toBe('normal')
    expect(wrapped.height).toBeGreaterThan(wrapped.lineHeight * 1.5)
  })

  test('keeps it on one line when the preference is off', async() => {
    await setWordWrap(page, false)
    const truncated = await measureLongLabel(page)
    expect(truncated.whiteSpace).toBe('nowrap')
    expect(truncated.height).toBeLessThan(truncated.lineHeight * 1.5)
  })
})
