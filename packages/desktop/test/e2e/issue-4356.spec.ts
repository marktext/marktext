// Regression guard for issue #4356: TypeError: Cannot read properties of
// null (reading 'length') in FORMAT_LINK_CLICK.
//
// A markdown link with a custom protocol (e.g. sambesi://) gets its href
// stripped by muya's sanitizeHyperlink (DOMPurify protocol allowlist), so
// getLinkInfo returns href: null. Clicking the linkTools popover's "jump"
// button then forwarded { href: null } to the editor store, which crashed on
// data.href.length (packages/desktop/src/renderer/src/store/editor.ts).
//
// The fix is two-layered: muya's linkTools no longer offers "jump" when
// there is no href, and FORMAT_LINK_CLICK guards null hrefs defensively.
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  clearRendererErrors,
  expectNoRendererErrors
} from './helpers'

const CUSTOM_PROTOCOL_DOC =
  '# Repro\n\n[sambesi://localhost/node/11164](sambesi://localhost/node/11164)\n'

const ANCHOR_LINK_DOC = '# Top\n\nsome text\n\n[go to top](#top)\n'

test.describe('Issue #4356: link popover with an unsupported protocol href', () => {
  let app: ElectronApplication
  let page: Page

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('popover offers only unlink and the renderer does not crash', async() => {
    const launched = await launchWithMarkdown(CUSTOM_PROTOCOL_DOC, {
      suppressErrorDialog: true
    })
    app = launched.app
    page = launched.page
    await clearRendererErrors(app)

    const link = page.locator('span.mu-link').first()
    await link.waitFor({ state: 'visible', timeout: 10000 })
    await link.hover()

    const popover = page.locator('.mu-link-tools-container')
    await popover.locator('li.item.unlink').waitFor({ state: 'visible', timeout: 5000 })
    await expect(popover.locator('li.item.jump')).toHaveCount(0)

    await page.waitForTimeout(500)
    await expectNoRendererErrors(app)
  })

  test('anchor links still offer jump and clicking it does not crash', async() => {
    const launched = await launchWithMarkdown(ANCHOR_LINK_DOC, {
      suppressErrorDialog: true
    })
    app = launched.app
    page = launched.page
    await clearRendererErrors(app)

    const link = page.locator('span.mu-link').first()
    await link.waitFor({ state: 'visible', timeout: 10000 })
    await link.hover()

    const jumpButton = page.locator('.mu-link-tools-container li.item.jump')
    await jumpButton.waitFor({ state: 'visible', timeout: 5000 })
    await jumpButton.click()

    // Give a (potential) error time to propagate over IPC.
    await page.waitForTimeout(500)
    await expectNoRendererErrors(app)
  })
})
