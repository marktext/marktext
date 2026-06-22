import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, expectNoRendererErrors } from './helpers'

// ---------------------------------------------------------------------------
// Coverage backfill (checklist item 236). The store-level
// githubSlug -> stableSlug lookup is unit-covered in
// packages/desktop/test/unit/specs/editor-store-anchor.spec.ts
// (FORMAT_LINK_CLICK), but nothing proves the real click -> scroll round-trip
// in a live editor window.
//
// Mechanism under test:
//   1. The engine renders `[go](#my-section)` as `span.mu-inline-rule.mu-link`
//      with the href on the DOM `props.href` (no attribute) — see
//      packages/muya/src/inlineRenderer/renderer/link.ts.
//   2. A Cmd/Ctrl-click on that wrapper makes
//      packages/muya/src/editor/linkMouseEvents.ts emit `format-click`
//      ({ formatType: 'link', data: { href } }).
//   3. editor.vue's `format-click` handler (gated on the same modifier) calls
//      editorStore.FORMAT_LINK_CLICK, which strips the leading '#', finds the
//      listToc entry whose githubSlug === 'my-section', and emits the bus event
//      `scroll-to-header` with that entry's stable slug.
//   4. editor.vue scrollToHeader resolves the heading by document-order index
//      (resolveTocHeadingElement) and animatedScrollTo's the `.editor-component`
//      scroll container to it.
//
// The slugs are NOT stamped onto the heading DOM, so this is the only path that
// proves the index-based resolution works end-to-end in a real window.
// ---------------------------------------------------------------------------

const LINK_WRAPPER = 'span.mu-link'

// Many filler paragraphs so the document overflows the viewport and the target
// heading starts well below the fold. The link sits at the very top, so a
// successful jump scrolls DOWN (scrollTop 0 -> large positive).
const filler = Array.from({ length: 60 }, (_, i) => `Filler paragraph number ${i + 1}.`).join(
  '\n\n'
)

const DOC = `[go](#my-section)\n\n${filler}\n\n## My Section\n\nThe destination paragraph under My Section.\n`

// Read the live scroll container's scrollTop. getScrollContainer() in editor.vue
// returns muya's root domNode, which is the same element as `.editor-component`
// (muya copies the mount node's attributes onto its replacement div, so it
// carries both `.editor-component` and `.mu-editor`).
const scrollTop = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const el = document.querySelector('.editor-component') as HTMLElement | null
    return el ? el.scrollTop : -1
  })

// Dispatch a real bubbling Cmd/Ctrl-click on the rendered anchor wrapper so the
// engine's domNode click listener runs the full format-click pipeline. Both
// modifier flags are set so the same event satisfies the macOS (metaKey) and
// non-macOS (ctrlKey) branches of editor.vue's `ctrlOrMeta` check.
const modifierClickLink = async(page: Page): Promise<boolean> =>
  page.evaluate((selector) => {
    const el = document.querySelector(selector) as HTMLElement | null
    if (!el) return false
    const evt = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      metaKey: true,
      ctrlKey: true
    })
    el.dispatchEvent(evt)
    return true
  }, LINK_WRAPPER)

test.describe('In-document anchor link click scrolls the editor (item 236)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(DOC, { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    // The markdown link renders to its preview `span.mu-link` wrapper once the
    // document is parsed; wait for it before interacting.
    await page.waitForSelector(LINK_WRAPPER, { state: 'attached', timeout: 15000 })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the rendered link resolves its href to the in-doc anchor and the heading is present', async() => {
    // The link carries the bare anchor href via the snabbdom DOM property, and
    // the destination heading (`## My Section`) is a top-level `.mu-container`
    // child — exactly the set resolveTocHeadingElement enumerates by index.
    const wiring = await page.evaluate((selector) => {
      const link = document.querySelector(selector) as HTMLElement | null
      const heading = document.querySelector('.mu-container > h2')
      return {
        // getLinkInfo (packages/muya/src/utils/getLinkInfo.ts) reads the real
        // `href` attribute first; for this markdown link the engine renders it
        // as an attribute on the wrapper.
        hrefAttr: link ? link.getAttribute('href') : null,
        // The `data-raw` payload is what FORMAT_LINK_CLICK's caller forwards;
        // its presence confirms this is the rendered link wrapper.
        raw: link ? link.dataset.raw ?? null : null,
        headingText: heading ? heading.textContent : null
      }
    }, LINK_WRAPPER)

    expect(wiring.hrefAttr).toBe('#my-section')
    expect(wiring.raw).toBe('[go](#my-section)')
    expect(wiring.headingText).toContain('My Section')
  })

  test('Cmd/Ctrl-clicking the link scrolls the editor down to the heading', async() => {
    // Start at the top of the document.
    await page.evaluate(() => {
      const el = document.querySelector('.editor-component') as HTMLElement | null
      if (el) el.scrollTop = 0
    })
    await expect.poll(() => scrollTop(page)).toBe(0)

    const clicked = await modifierClickLink(page)
    expect(clicked).toBe(true)

    // animatedScrollTo runs over ~300ms; poll until the container has scrolled a
    // meaningful distance toward the off-screen heading.
    await expect.poll(() => scrollTop(page), { timeout: 8000 }).toBeGreaterThan(100)

    // Settle to the final position, then assert the heading is parked near the
    // top of the viewport (STANDAR_Y = 320 offset), proving the jump landed on
    // the right element and not at some arbitrary scroll offset.
    await page.waitForTimeout(500)
    const headingTop = await page.evaluate(() => {
      const heading = document.querySelector('.mu-container > h2')
      return heading ? heading.getBoundingClientRect().top : null
    })
    expect(headingTop).not.toBeNull()
    expect(headingTop as number).toBeLessThan(500)
    expect(headingTop as number).toBeGreaterThan(-200)

    await expectNoRendererErrors(app)
  })

  test('a plain (no-modifier) click on the link does NOT scroll', async() => {
    // Reset to the top.
    await page.evaluate(() => {
      const el = document.querySelector('.editor-component') as HTMLElement | null
      if (el) el.scrollTop = 0
    })
    await expect.poll(() => scrollTop(page)).toBe(0)

    // A plain click only places the caret (linkMouseEvents.ts gates the
    // format-click emission on the modifier), so no scroll-to-header fires.
    const clicked = await page.evaluate((selector) => {
      const el = document.querySelector(selector) as HTMLElement | null
      if (!el) return false
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      return true
    }, LINK_WRAPPER)
    expect(clicked).toBe(true)

    // Give any (incorrect) scroll animation time to start; it must not.
    await page.waitForTimeout(600)
    expect(await scrollTop(page)).toBe(0)

    await expectNoRendererErrors(app)
  })
})
