import { expect, test } from '@playwright/test'
import type { ElectronApplication, Locator, Page } from 'playwright'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ApplicationState } from '../../src/shared/types/applicationState'
import {
  expectNoRendererErrors,
  launchElectron,
  launchWithMarkdown,
  sendIpcToRenderer,
  waitForEditor
} from './helpers'

const rows = '.side-bar .opened-files-list > .opened-file:not(.gu-mirror)'
const tabs = '.tabs-container > li'
const ids = (page: Page, selector: string): Promise<string[]> =>
  page.locator(selector).evaluateAll(elements => elements.map(el => el.getAttribute('data-id') ?? ''))

const drag = async(page: Page, from: Locator, to: Locator, axis: 'x' | 'y', after = true): Promise<void> => {
  const start = await from.boundingBox()
  const end = await to.boundingBox()
  if (!start || !end) throw new Error('Drag target is not visible')
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    end.x + end.width * (axis === 'x' ? (after ? 0.8 : 0.2) : 0.5),
    end.y + end.height * (axis === 'y' ? (after ? 0.8 : 0.2) : 0.5),
    { steps: 12 }
  )
  await page.mouse.up()
}

type PopupItem = { id?: string; enabled?: boolean }

// Resolve native popups through their IPC replies so the tests need no OS menu automation.
const openMenu = async(app: ElectronApplication, row: Locator, action?: string): Promise<PopupItem[]> => {
  await app.evaluate(({ ipcMain }, wanted) => {
    const audit = globalThis as unknown as { popupItems: PopupItem[] | null }
    audit.popupItems = null
    ipcMain.removeAllListeners('mt::menu::popup')
    ipcMain.on('mt::menu::popup', (event, template: PopupItem[]) => {
      audit.popupItems = template.map(item => ({
        id: item.id?.replace(/(?:^|-)(mi-\d+)$/, ''),
        enabled: item.enabled
      }))
      const item = template.find(item => item.id?.startsWith(`${wanted}-mi-`))
      if (item?.enabled) event.sender.send('mt::menu::click', { id: item.id })
      event.sender.send('mt::menu::closed')
    })
  }, action)
  await row.click({ button: 'right' })
  await expect.poll(() => app.evaluate(() =>
    (globalThis as unknown as { popupItems: PopupItem[] | null }).popupItems
  )).not.toBeNull()
  return app.evaluate(() => (globalThis as unknown as { popupItems: PopupItem[] }).popupItems)
}

test.describe('#5686 opened files actions', () => {
  let app: ElectronApplication
  let page: Page
  let filePath: string

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# Saved document\n', {
      windowLayout: { showSideBar: true, showTabBar: false },
      preferences: { openedFilesInSidebar: true, restoreLayoutState: true },
      suppressErrorDialog: true
    })
    app = launched.app
    page = launched.page
    filePath = launched.filePath
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async() => ({ response: 1, checkboxChecked: false })
    })
    for (let i = 0; i < 2; i++) {
      await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, `Draft ${i}\n`)
      await expect(page.locator(rows)).toHaveCount(i + 2)
    }
    await expect(page.locator(rows).first()).toBeVisible()
  })

  test.afterEach(async() => {
    if (app) {
      try {
        await expectNoRendererErrors(app)
      } finally {
        await app.close()
      }
    }
  })

  test('rows reuse the tab menu without selecting an inactive file', async() => {
    const beforeActive = await page.locator(`${rows}.active`).getAttribute('data-id')
    const savedMenu = await openMenu(app, page.locator(rows).first())
    expect(savedMenu).toEqual(expect.arrayContaining([
      { id: 'closeThisTab', enabled: true },
      { id: 'closeOtherTabs', enabled: true },
      { id: 'renameFile', enabled: true },
      { id: 'copyPath', enabled: true },
      { id: 'showInFolder', enabled: true }
    ]))
    await expect(page.locator(`${rows}.active`)).toHaveAttribute('data-id', beforeActive ?? '')
    await sendIpcToRenderer(app, 'mt::set-view-layout', { showTabBar: true })
    expect(await openMenu(app, page.locator(tabs).first())).toEqual(savedMenu)

    const untitledMenu = await openMenu(app, page.locator(rows).last())
    for (const id of ['renameFile', 'copyPath', 'showInFolder', 'showInSideBar']) {
      expect(untitledMenu).toContainEqual({ id, enabled: false })
    }
  })

  test('copy path and rename target the clicked file with the tab bar hidden', async() => {
    await openMenu(app, page.locator(rows).first(), 'copyPath')
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe(filePath)
    await openMenu(app, page.locator(rows).first(), 'renameFile')
    await expect(page.locator('.rename input.search')).toBeVisible()
    await expect(page.locator('.rename input.search')).toHaveValue(basename(filePath))
    await expect(page.locator(`${rows}.active`)).toHaveAttribute('title', filePath)
  })

  test('close others preserves the clicked inactive file', async() => {
    await openMenu(app, page.locator(rows).first(), 'closeOtherTabs')
    await expect(page.locator(rows)).toHaveCount(1)
    await expect(page.locator(rows)).toHaveAttribute('title', filePath)
    await expect(page.locator(tabs)).toHaveCount(1)
  })

  test('middle click closes an inactive file and respects cancel for a dirty file', async() => {
    const active = await page.locator(`${rows}.active`).getAttribute('data-id')
    await page.locator(rows).first().click({ button: 'middle' })
    await expect(page.locator(rows)).toHaveCount(2)
    await expect(page.locator(`${rows}.active`)).toHaveAttribute('data-id', active ?? '')

    await app.evaluate(({ dialog }) => {
      const audit = globalThis as unknown as { closePromptCount: number }
      audit.closePromptCount = 0
      dialog.showMessageBox = async() => {
        audit.closePromptCount++
        return { response: 2, checkboxChecked: false }
      }
    })
    await page.locator(`${rows}.active`).click({ button: 'middle' })
    await expect.poll(() => app.evaluate(() =>
      (globalThis as unknown as { closePromptCount: number }).closePromptCount
    )).toBe(1)
    await expect(page.locator(rows)).toHaveCount(2)
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async() => ({ response: 1, checkboxChecked: false })
    })
    await page.locator(`${rows}.active`).click({ button: 'middle' })
    await expect(page.locator(rows)).toHaveCount(1)
  })

  test('pointer drift still selects a row and dropping outside cancels a reorder', async() => {
    const before = await ids(page, rows)
    const row = page.locator(rows).first()
    const box = await row.boundingBox()
    if (!box) throw new Error('Row is not visible')
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x, y + 3)
    await page.mouse.up()
    await expect(row).toHaveClass(/active/)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + box.width + 100, y + 60, { steps: 12 })
    await page.mouse.up()
    await expect.poll(() => ids(page, rows)).toEqual(before)
    await expect.poll(() => ids(page, tabs)).toEqual(before)
    await expect(page.locator('.gu-mirror')).toHaveCount(0)
  })

  test('a floating preview follows the pointer without adding scrollbars', async() => {
    const list = page.locator('.side-bar .opened-files-list')
    const dimensions = () => list.evaluate(element => ({
      width: element.clientWidth,
      height: element.clientHeight,
      scrollWidth: element.scrollWidth,
      scrollHeight: element.scrollHeight
    }))
    const beforeDimensions = await dimensions()
    expect(beforeDimensions.scrollWidth).toBe(beforeDimensions.width)
    expect(beforeDimensions.scrollHeight).toBe(beforeDimensions.height)
    const beforeOrder = await ids(page, rows)
    const start = await page.locator(rows).first().boundingBox()
    const end = await page.locator(rows).last().boundingBox()
    if (!start || !end) throw new Error('Rows are not visible')
    const x = start.x + start.width / 2
    const y = end.y + end.height * 0.8
    await page.mouse.move(x, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(x, y, { steps: 12 })
    const preview = page.locator('.gu-mirror')
    await expect(preview).toHaveCSS('position', 'fixed')
    await expect(preview).toHaveCSS('pointer-events', 'none')
    await expect.poll(dimensions).toEqual(beforeDimensions)
    await expect.poll(() => ids(page, rows)).toEqual([...beforeOrder.slice(1), beforeOrder[0]])
    const firstPosition = await preview.boundingBox()
    await page.mouse.move(x + 12, y + 8)
    const secondPosition = await preview.boundingBox()
    if (!firstPosition || !secondPosition) throw new Error('Drag preview is not visible')
    expect(secondPosition.x - firstPosition.x).toBeCloseTo(12, 0)
    expect(secondPosition.y - firstPosition.y).toBeCloseTo(8, 0)
    await page.mouse.up()
    await expect(preview).toHaveCount(0)
  })

  test('reorders both views in either direction and restores the order after restart', async() => {
    const before = await ids(page, rows)
    await drag(page, page.locator(rows).first(), page.locator(rows).last(), 'y')
    const reordered = [before[1], before[2], before[0]]
    await expect.poll(() => ids(page, rows)).toEqual(reordered)
    await expect.poll(() => ids(page, tabs)).toEqual(reordered)

    await drag(page, page.locator(rows).last(), page.locator(rows).first(), 'y', false)
    await expect.poll(() => ids(page, rows)).toEqual(before)
    await expect.poll(() => ids(page, tabs)).toEqual(before)

    await sendIpcToRenderer(app, 'mt::set-view-layout', { showTabBar: true })
    await drag(page, page.locator(tabs).first(), page.locator(tabs).last(), 'x')
    const finalOrder = reordered
    await expect.poll(() => ids(page, rows)).toEqual(finalOrder)
    await expect.poll(() => ids(page, tabs)).toEqual(finalOrder)

    const profile = await app.evaluate(({ app }) => app.getPath('userData'))
    await expect.poll(() => {
      const state = JSON.parse(readFileSync(join(profile, 'state', 'application-state.json'), 'utf8')) as ApplicationState
      return state.session.windows[0].documents.map(document => document.id)
    }).toEqual(finalOrder)
    await expectNoRendererErrors(app)
    await app.close()
    const launched = await launchElectron([], { userDataDir: profile, suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await waitForEditor(page)
    await expect.poll(() => ids(page, rows)).toEqual(finalOrder)
    await expect.poll(() => ids(page, tabs)).toEqual(finalOrder)
  })

  test('drag handlers recover after the list is disabled and remounted', async() => {
    await sendIpcToRenderer(app, 'mt::user-preference', { openedFilesInSidebar: false })
    await expect(page.locator(rows)).toHaveCount(0)
    await sendIpcToRenderer(app, 'mt::user-preference', { openedFilesInSidebar: true })
    await expect(page.locator(rows)).toHaveCount(3)
    await page.locator('.side-bar .search-button').click()
    await expect(page.locator(rows)).toHaveCount(0)
    await page.locator('.side-bar .back-button').click()
    await expect(page.locator(rows)).toHaveCount(3)
    const before = await ids(page, rows)
    await drag(page, page.locator(rows).first(), page.locator(rows).last(), 'y')
    await expect.poll(() => ids(page, tabs)).toEqual([before[1], before[2], before[0]])
    await expect.poll(() => ids(page, rows)).toEqual([before[1], before[2], before[0]])
  })

  test('dragging near the bottom scrolls an overflowing list to the drop target', async() => {
    for (let count = 4; count <= 10; count++) {
      await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, `Draft ${count}\n`)
      await expect(page.locator(rows)).toHaveCount(count)
    }
    const before = await ids(page, rows)
    const list = page.locator('.side-bar .opened-files-list')
    await list.evaluate(element => { element.scrollTop = 0 })
    const start = await page.locator(rows).first().boundingBox()
    const box = await list.boundingBox()
    if (!start || !box) throw new Error('Opened files are not visible')
    const x = box.x + box.width / 2
    await page.mouse.move(x, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(x, box.y + box.height - 2, { steps: 12 })
    await expect.poll(() => list.evaluate(element =>
      element.scrollTop > 0 && element.scrollTop + element.clientHeight >= element.scrollHeight - 1
    )).toBe(true)
    await page.mouse.move(x + 1, box.y + box.height - 1)
    await page.mouse.up()
    const reordered = [...before.slice(1), before[0]]
    await expect.poll(() => ids(page, rows)).toEqual(reordered)
    await expect.poll(() => ids(page, tabs)).toEqual(reordered)
  })
})
