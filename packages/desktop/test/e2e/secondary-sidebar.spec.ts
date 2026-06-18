import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById } from './helpers'

// The secondary (right) sidebar reuses the sideBar component (app.vue mounts a
// second `<side-bar side="right" />`). It is hidden by default, has no icon
// strip, and is driven entirely from the View menu. These specs exercise the
// show / content-switch / toggle-off path through the menu items. The tests
// share one app instance and run in order, each building on the previous
// state — same pattern as layout-toggles.spec.ts.
test.describe('Secondary (right) sidebar', () => {
  let app: ElectronApplication
  let page: Page

  const rightSideBar = () => page.locator('.side-bar.side-right')

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Doc\n\n## Section A\n\n## Section B\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('is hidden by default', async() => {
    await expect(rightSideBar()).toBeHidden()
  })

  test('ToC menu reveals the right sidebar with the ToC panel', async() => {
    await clickMenuById(app, 'secondaryContentTocMenuItem')
    await expect(rightSideBar()).toBeVisible()
    await expect(rightSideBar().locator('.side-bar-toc')).toBeVisible()
  })

  test('switching content swaps the panel and unmounts the previous view', async() => {
    await clickMenuById(app, 'secondaryContentSearchMenuItem')
    await expect(rightSideBar()).toBeVisible()
    await expect(rightSideBar().locator('.side-bar-search')).toBeVisible()
    // Content views use v-if, so the ToC is fully unmounted once search is active.
    await expect(rightSideBar().locator('.side-bar-toc')).toHaveCount(0)
  })

  test('re-selecting the active content toggles the sidebar off', async() => {
    // Search is the active, visible content from the previous step; selecting
    // it again hides the whole panel (LISTEN_FOR_LAYOUT toggle semantics).
    await clickMenuById(app, 'secondaryContentSearchMenuItem')
    await expect(rightSideBar()).toBeHidden()
  })
})
