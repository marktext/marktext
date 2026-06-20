import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, waitForEditor } from './helpers'

// Build a long document with many top-level headings so the editor content
// overflows its scroll container. Each heading title is unique so the sidebar
// TOC (an el-tree) renders an unambiguous label we can click. Filler paragraphs
// between headings push later headings far down the scroll, so revealing a deep
// heading requires a real (non-zero) scroll.
const HEADING_COUNT = 20
const buildLongDoc = (): string => {
  const parts: string[] = []
  for (let i = 1; i <= HEADING_COUNT; i++) {
    parts.push(`# Heading Number ${i}`)
    // Several filler paragraphs so each section is taller than the viewport.
    for (let p = 0; p < 6; p++) {
      parts.push(`Filler paragraph ${p} under heading ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`)
    }
  }
  return parts.join('\n\n') + '\n'
}

// Read the live editor scroll container's scrollTop. The scroll container is
// muya's root element (`.mu-editor`, which also carries `.editor-component`),
// NOT `.mu-container` (the inner scrollPage that holds the headings).
const getScrollTop = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const el = document.querySelector('.editor-component') as HTMLElement | null
    return el ? el.scrollTop : -1
  })

// Returns the index (in document order, among `.mu-container > hN`) of the
// top-level heading whose text matches `text`, or -1. The live ATX heading
// renders its `# ` syntax marker as part of `textContent`, so we strip leading
// `#`/whitespace before comparing against the clean TOC label text.
const headingIndexByText = (page: Page, text: string): Promise<number> =>
  page.evaluate((needle) => {
    const sel = '.mu-container > h1, .mu-container > h2, .mu-container > h3, .mu-container > h4, .mu-container > h5, .mu-container > h6'
    const headings = Array.from(document.querySelectorAll(sel))
    const normalize = (s: string) => s.replace(/^[#\s]+/, '').trim()
    return headings.findIndex((h) => normalize(h.textContent || '') === needle)
  }, text)

// Is the heading at `index` (in the top-level heading list) within the
// scroll container's visible viewport? Compares the heading rect against the
// container rect rather than the window, so it stays correct regardless of
// sidebar/tab-bar chrome height.
const isHeadingInViewport = (page: Page, index: number): Promise<boolean> =>
  page.evaluate((idx) => {
    const container = document.querySelector('.editor-component') as HTMLElement | null
    if (!container) return false
    const sel = '.mu-container > h1, .mu-container > h2, .mu-container > h3, .mu-container > h4, .mu-container > h5, .mu-container > h6'
    const headings = Array.from(document.querySelectorAll(sel))
    const target = headings[idx] as HTMLElement | undefined
    if (!target) return false
    const cRect = container.getBoundingClientRect()
    const hRect = target.getBoundingClientRect()
    return hRect.top >= cRect.top - 1 && hRect.top <= cRect.bottom
  }, index)

// Locate a TOC tree node label by its EXACT text. Exact matching avoids the
// substring trap where "Heading Number 1" also matches "Heading Number 18".
const tocLabel = (page: Page, text: string) =>
  page.locator('.side-bar-toc').getByText(text, { exact: true })

const showSidebar = async(app: ElectronApplication, page: Page): Promise<void> => {
  const visible = await page.evaluate(() => {
    const el = document.querySelector('.side-bar') as HTMLElement | null
    return !!(el && el.offsetParent !== null)
  })
  if (!visible) {
    await clickMenuById(app, 'sideBarMenuItem')
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.side-bar') as HTMLElement | null
        return !!(el && el.offsetParent !== null)
      },
      null,
      { timeout: 5000 }
    )
  }
}

test.describe('TOC sidebar click scrolls the live editor', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(buildLongDoc())
    app = launched.app
    page = launched.page
    await waitForEditor(page)
    // Open the sidebar and switch its right column to the ToC (el-tree).
    await showSidebar(app, page)
    await clickMenuById(app, 'tocMenuItem')
    await page.waitForSelector('.side-bar-toc .el-tree', { state: 'visible', timeout: 10000 })
    // The TOC is seeded from `editor.getTOC()` on mount / json-change. Wait
    // until every heading has rendered a tree node before clicking.
    await page.waitForFunction(
      (count) => document.querySelectorAll('.side-bar-toc .el-tree-node__label').length >= count,
      HEADING_COUNT,
      { timeout: 10000 }
    )
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('clicking a deep outline entry scrolls the editor to that heading', async() => {
    const targetText = 'Heading Number 18'
    const targetIndex = await headingIndexByText(page, targetText)
    expect(targetIndex).toBeGreaterThanOrEqual(0)

    // Start near the top so the click must scroll DOWN to reveal heading 18.
    await page.evaluate(() => {
      const el = document.querySelector('.editor-component') as HTMLElement | null
      if (el) el.scrollTop = 0
    })
    await expect.poll(() => getScrollTop(page)).toBe(0)
    expect(await isHeadingInViewport(page, targetIndex)).toBe(false)

    // Click the matching el-tree node label (the real user path: this fires the
    // `scroll-to-header` bus event with the heading's slug).
    const label = tocLabel(page, targetText)
    await label.click()

    // The scroll is animated (~300ms). Poll until it settles above 0.
    await expect.poll(() => getScrollTop(page), { timeout: 8000 }).toBeGreaterThan(0)
    // And the target heading must be in the viewport.
    await expect
      .poll(() => isHeadingInViewport(page, targetIndex), { timeout: 8000 })
      .toBe(true)
  })

  test('clicking an earlier heading scrolls back up toward it', async() => {
    // After the previous test the editor is scrolled down near heading 18.
    const fromTop = await getScrollTop(page)
    expect(fromTop).toBeGreaterThan(0)

    const targetText = 'Heading Number 3'
    const targetIndex = await headingIndexByText(page, targetText)
    expect(targetIndex).toBeGreaterThanOrEqual(0)

    const label = tocLabel(page, targetText)
    await label.click()

    // Scrolling up to heading 3 must reduce scrollTop substantially.
    await expect
      .poll(() => getScrollTop(page), { timeout: 8000 })
      .toBeLessThan(fromTop)
    await expect
      .poll(() => isHeadingInViewport(page, targetIndex), { timeout: 8000 })
      .toBe(true)
  })

  test('clicking the same heading twice is idempotent (stays at that heading)', async() => {
    const targetText = 'Heading Number 12'
    const targetIndex = await headingIndexByText(page, targetText)
    expect(targetIndex).toBeGreaterThanOrEqual(0)

    const label = tocLabel(page, targetText)
    await label.click()
    await expect
      .poll(() => isHeadingInViewport(page, targetIndex), { timeout: 8000 })
      .toBe(true)
    const firstScroll = await getScrollTop(page)

    // Click again — should land on (essentially) the same scroll position.
    await label.click()
    await page.waitForTimeout(500)
    await expect
      .poll(() => isHeadingInViewport(page, targetIndex), { timeout: 8000 })
      .toBe(true)
    const secondScroll = await getScrollTop(page)
    expect(Math.abs(secondScroll - firstScroll)).toBeLessThanOrEqual(5)
  })
})
