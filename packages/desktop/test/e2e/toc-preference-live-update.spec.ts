import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, waitForEditor } from './helpers'

// Follow-up to #3110: toggling a render-affecting preference (superscript /
// subscript here) re-renders the headings inside `setOptions(..., true)`
// without emitting a `json-change`, so the outline used to keep the parse from
// before the toggle. It must refresh live.

const DOC = ['# Outline', '', '## Water is H^2^O and x~i~', '', 'Body.', ''].join('\n')

const setPreference = async(page: Page, prefs: Record<string, unknown>): Promise<void> => {
  await page.evaluate((p) => {
    window.electron.ipcRenderer.send('mt::set-user-preference', p)
  }, prefs)
}

const tocSupContent = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.side-bar-toc .el-tree-node__label sup')).map((el) =>
      (el.textContent || '').trim()
    )
  )

const tocHasLiteralMarkers = (page: Page): Promise<boolean> =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.side-bar-toc .el-tree-node__label')).some((el) =>
      (el.textContent || '').includes('^2^')
    )
  )

test.describe('TOC updates live when a markdown preference changes', () => {
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

  test('toggling superscript/subscript re-renders its outline entry', async() => {
    // The default preference is off, so the outline shows the raw `^2^` markers.
    expect(await tocSupContent(page)).toEqual([])
    expect(await tocHasLiteralMarkers(page)).toBe(true)

    await setPreference(page, { superSubScript: true })
    await expect.poll(() => tocSupContent(page), { timeout: 8000 }).toEqual(['2'])
    await expect.poll(() => tocHasLiteralMarkers(page), { timeout: 8000 }).toBe(false)

    // Turning it back off must refresh too, not just the first toggle.
    await setPreference(page, { superSubScript: false })
    await expect.poll(() => tocSupContent(page), { timeout: 8000 }).toEqual([])
    await expect.poll(() => tocHasLiteralMarkers(page), { timeout: 8000 }).toBe(true)
  })
})
