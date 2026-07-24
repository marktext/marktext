import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, waitForEditor } from './helpers'

// Document with nested headings — enough depth to test context-aware
// expand/collapse, and enough height to require scrolling.
const DOC = [
  '# Introduction',
  '',
  'Some intro text here.',
  '',
  '## Getting Started',
  '',
  'Getting started content paragraph one.',
  '',
  'Getting started content paragraph two.',
  '',
  '### Prerequisites',
  '',
  'You need Node.js installed.',
  '',
  '## Advanced Usage',
  '',
  'Advanced content paragraph one.',
  '',
  'Advanced content paragraph two.',
  '',
  '### Configuration',
  '',
  'Configuration details here.',
  '',
  '### Plugins',
  '',
  'Plugins details here.',
  '',
  '## Conclusion',
  '',
  'Wrapping up.',
  ''
].join('\n')

// Returns the text of the TOC node that has the `.is-current` highlight class.
const getHighlightedTocLabel = (page: Page): Promise<string | null> =>
  page.evaluate(() => {
    const current = document.querySelector(
      '.side-bar-toc .el-tree-node.is-current > .el-tree-node__content .el-tree-node__label'
    ) as HTMLElement | null
    return current ? current.textContent!.trim() : null
  })

// Click inside a heading's content in the editor by matching the ATX heading
// text. The rendered heading includes the `# ` markers as separate spans, so
// we target the `.mu-atxheading-content` child that carries the visible text.
const clickHeadingInEditor = async(page: Page, text: string): Promise<void> => {
  // First try the muya atx heading content span
  let el = page.locator('.mu-atxheading-content').filter({ hasText: text }).first()
  if (await el.count() === 0) {
    // Fallback: click the heading element directly
    el = page.locator('.mu-container h1, .mu-container h2, .mu-container h3')
      .filter({ hasText: text }).first()
  }
  await el.click()
}

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

test.describe('TOC active heading highlight', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(DOC)
    app = launched.app
    page = launched.page
    await waitForEditor(page)
    await showSidebar(app, page)
    await clickMenuById(app, 'tocMenuItem')
    await page.waitForSelector('.side-bar-toc .el-tree', { state: 'visible', timeout: 10000 })
    // Wait for TOC to populate with all headings.
    await page.waitForFunction(
      () => document.querySelectorAll('.side-bar-toc .el-tree-node__label').length >= 6,
      null,
      { timeout: 10000 }
    )
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('clicking a heading in the editor highlights the corresponding TOC entry', async() => {
    await clickHeadingInEditor(page, 'Getting Started')
    await expect
      .poll(() => getHighlightedTocLabel(page), { timeout: 5000 })
      .toBe('Getting Started')
  })

  test('moving to a different heading updates the highlight', async() => {
    await clickHeadingInEditor(page, 'Advanced Usage')
    await expect
      .poll(() => getHighlightedTocLabel(page), { timeout: 5000 })
      .toBe('Advanced Usage')
  })

  test('clicking inside a nested heading highlights the nested entry', async() => {
    await clickHeadingInEditor(page, 'Configuration')
    await expect
      .poll(() => getHighlightedTocLabel(page), { timeout: 5000 })
      .toBe('Configuration')
  })

  test('expand/collapse buttons have accessible labels', async() => {
    const expandBtn = page.locator('.toc-toolbar-btn').first()
    const collapseBtn = page.locator('.toc-toolbar-btn').last()
    await expect(expandBtn).toHaveAttribute('aria-label', /expand|Expand/i)
    await expect(collapseBtn).toHaveAttribute('aria-label', /collapse|Collapse/i)
  })

  test('collapse-all hides nested TOC children', async() => {
    // Click the collapse button.
    const collapseBtn = page.locator('.toc-toolbar-btn').last()
    await collapseBtn.click()

    // After collapsing, nested headings should be hidden — only top-level visible.
    await expect.poll(async() => {
      return page.evaluate(() => {
        const nodes = Array.from(
          document.querySelectorAll('.side-bar-toc .el-tree .el-tree-node')
        ) as HTMLElement[]
        return nodes
          .filter((n) => n.offsetParent !== null)
          .map((n) => {
            const l = n.querySelector(':scope > .el-tree-node__content .el-tree-node__label')
            return (l?.textContent || '').trim()
          })
      })
    }, { timeout: 5000 }).toEqual(['Introduction', 'Getting Started', 'Advanced Usage', 'Conclusion'])
  })

  test('expand-all reveals nested TOC children again', async() => {
    const expandBtn = page.locator('.toc-toolbar-btn').first()
    await expandBtn.click()

    // All headings should be visible again.
    await expect.poll(async() => {
      return page.evaluate(() => {
        const nodes = Array.from(
          document.querySelectorAll('.side-bar-toc .el-tree .el-tree-node')
        ) as HTMLElement[]
        return nodes
          .filter((n) => n.offsetParent !== null)
          .map((n) => {
            const l = n.querySelector(':scope > .el-tree-node__content .el-tree-node__label')
            return (l?.textContent || '').trim()
          })
      })
    }, { timeout: 5000 }).toContain('Prerequisites')
  })
})
