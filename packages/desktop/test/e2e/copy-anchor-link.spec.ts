import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, expectNoRendererErrors } from './helpers'

// ---------------------------------------------------------------------------
// Coverage backfill (checklist item 241). The hover-to-copy heading affordance
// round-trip is missing at the e2e layer:
//   - The store-level copyGithubSlug lookup (slug -> '#'+githubSlug -> clipboard)
//     is unit-covered in
//     packages/desktop/test/unit/specs/editor-store-anchor.spec.ts:99-128.
//   - The engine affordance + `heading-copy-link` emission is covered in
//     packages/muya/src/__tests__/parityHeadingCopyLink.spec.ts.
// Only the live hover -> click -> OS clipboard round-trip in a real window was
// uncovered.
//
// Mechanism under test:
//   1. Each heading renders a `heading-copy-link` attachment as a child DOM node
//      of the heading element: `h2.mu-atx-heading > i.mu-copy-header-link`
//      (packages/muya/src/block/commonMark/{atxHeading,headingCopyLink}). CSS
//      reveals it on heading hover; clicking/Enter/Space activates it.
//   2. Activation emits the engine event `heading-copy-link` with
//      { key: stableSlug(heading) } — the same value getTOC() exposes as the
//      TOC entry's stable `slug`.
//   3. editor.vue subscribes to `heading-copy-link` and calls
//      editorStore.copyGithubSlug(key), which finds the listToc entry whose
//      `slug === key` and writes `'#' + entry.githubSlug` to the OS clipboard
//      via window.electron.clipboard.writeText (IPC `mt::clipboard::write-text`,
//      handled in packages/desktop/src/main/ipc/shell.ts -> Electron clipboard).
//
// We read the clipboard back from the MAIN process (Electron's `clipboard`
// module, exposed to app.evaluate's first arg) because that is where the IPC
// handler writes — it is the authoritative end of the round-trip and avoids the
// async preload `invoke` for read-text.
// ---------------------------------------------------------------------------

const HEADING = '.mu-container > h2'
const COPY_LINK = `${HEADING} > i.mu-copy-header-link`

const DOC = '## My Section\n\nA paragraph under the heading.\n'

// Read the OS clipboard as seen by the main process (the side the
// `mt::clipboard::write-text` handler writes to).
const readClipboard = (app: ElectronApplication): Promise<string> =>
  app.evaluate(({ clipboard }) => clipboard.readText())

const writeClipboard = (app: ElectronApplication, text: string): Promise<void> =>
  app.evaluate(({ clipboard }, value) => {
    clipboard.writeText(value)
  }, text)

test.describe('Heading hover-to-copy anchor affordance (item 241)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(DOC, { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    // The heading + its copy affordance render once the document parses.
    await page.waitForSelector(COPY_LINK, { state: 'attached', timeout: 15000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the heading renders an accessible copy-anchor affordance', async() => {
    const info = await page.evaluate((selector) => {
      const el = document.querySelector(selector) as HTMLElement | null
      if (!el) return null
      return {
        role: el.getAttribute('role'),
        tabindex: el.getAttribute('tabindex'),
        ariaLabel: el.getAttribute('aria-label'),
        hasIcon: !!el.querySelector('img.mu-icon-inner')
      }
    }, COPY_LINK)

    expect(info).not.toBeNull()
    // role/tabindex make it an operable, focusable button (mirrors the engine
    // parity spec); the icon image is the visible affordance.
    expect(info?.role).toBe('button')
    expect(info?.tabindex).toBe('0')
    expect(info?.ariaLabel).toBeTruthy()
    expect(info?.hasIcon).toBe(true)
  })

  test('hovering the heading then clicking the affordance copies "#<githubSlug>"', async() => {
    // Clear the clipboard to a known sentinel so we can prove the write came
    // from this interaction and not a stale value.
    await writeClipboard(app, 'sentinel-before-copy')
    await expect.poll(() => readClipboard(app)).toBe('sentinel-before-copy')

    // Hover the heading first to mirror the real reveal-on-hover affordance,
    // then click the now-visible copy icon.
    await page.hover(HEADING)
    await page.click(COPY_LINK)

    // The write flows renderer -> IPC -> main clipboard, so poll the main-side
    // clipboard until the anchor lands.
    await expect.poll(() => readClipboard(app), { timeout: 8000 }).toBe('#my-section')

    await expectNoRendererErrors(app)
  })

  test('the copied anchor starts with "#" and matches the heading github slug', async() => {
    await writeClipboard(app, '')
    await expect.poll(() => readClipboard(app)).toBe('')

    await page.hover(HEADING)
    await page.click(COPY_LINK)

    await expect.poll(() => readClipboard(app), { timeout: 8000 }).not.toBe('')
    const copied = await readClipboard(app)
    expect(copied.startsWith('#')).toBe(true)

    // The slug must derive from the heading text ("My Section" -> "my-section"),
    // proving the engine key resolved to the matching listToc entry rather than
    // some unrelated heading.
    expect(copied).toBe('#my-section')

    await expectNoRendererErrors(app)
  })

  test('activating the affordance via keyboard (Enter) also copies the anchor', async() => {
    await writeClipboard(app, 'keyboard-sentinel')
    await expect.poll(() => readClipboard(app)).toBe('keyboard-sentinel')

    // Focus the focusable button and press Enter — the engine's keydown handler
    // activates it the same way a click does (Enter / Space).
    await page.focus(COPY_LINK)
    await page.keyboard.press('Enter')

    await expect.poll(() => readClipboard(app), { timeout: 8000 }).toBe('#my-section')

    await expectNoRendererErrors(app)
  })
})
