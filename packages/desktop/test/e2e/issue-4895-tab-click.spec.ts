import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, sendIpcToRenderer } from './helpers'

const tabSelector = '.tabs-container > li'

const activeTabId = (page: Page): Promise<string | null> =>
  page.evaluate(
    () => document.querySelector('.tabs-container > li.active')?.getAttribute('data-id') ?? null
  )

const readTabIds = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.tabs-container > li')).map(
      (li) => li.getAttribute('data-id') ?? ''
    )
  )

const centerOf = async(page: Page, tabId: string): Promise<{ x: number; y: number }> => {
  const box = await page.locator(`${tabSelector}[data-id="${tabId}"]`).boundingBox()
  expect(box).not.toBeNull()
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
}

// #4895 — a tab click that drifts a few pixels between press and release used to
// be hijacked by dragula (its slideFactor defaults to 0, so one pixel starts a
// drag) and the resulting drag swallowed the `click` event outright, leaving the
// tab inactive. Real mouse and trackpad clicks drift, so switching tabs by mouse
// was close to impossible; a synthetic pixel-perfect click never showed it.
test.describe('Issue #4895 — clicking an inactive tab activates it', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Tab A\n')
    app = launched.app
    page = launched.page
    await sendIpcToRenderer(app, 'mt::set-view-layout', { showTabBar: true })
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'body B\n')
    await page.waitForFunction(
      (selector) => document.querySelectorAll(selector).length >= 2,
      tabSelector,
      { timeout: 5000 }
    )
    await page.waitForSelector(tabSelector, { state: 'visible', timeout: 5000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('a click with a few pixels of pointer drift activates the tab', async() => {
    const ids = await readTabIds(page)
    const active = await activeTabId(page)
    const targetId = ids.find((id) => id !== active)!

    const { x, y } = await centerOf(page, targetId)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 3, y)
    await page.mouse.up()

    await expect.poll(() => activeTabId(page), { timeout: 3000 }).toBe(targetId)
  })

  test('a pixel-perfect click activates the tab', async() => {
    const ids = await readTabIds(page)
    const active = await activeTabId(page)
    const targetId = ids.find((id) => id !== active)!

    await page.locator(`${tabSelector}[data-id="${targetId}"]`).click()

    await expect.poll(() => activeTabId(page), { timeout: 3000 }).toBe(targetId)
  })

  // The threshold must not cost us drag-to-reorder: a deliberate drag past it
  // still has to move the tab.
  test('a deliberate drag past the threshold still reorders the tabs', async() => {
    const before = await readTabIds(page)
    expect(before.length).toBeGreaterThanOrEqual(2)

    const from = await centerOf(page, before[0])
    const to = await centerOf(page, before[1])

    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x + 10, to.y, { steps: 10 })
    await page.mouse.up()

    await expect
      .poll(async() => (await readTabIds(page)).slice(0, 2).join(','), { timeout: 3000 })
      .toBe([before[1], before[0]].join(','))
  })
})
