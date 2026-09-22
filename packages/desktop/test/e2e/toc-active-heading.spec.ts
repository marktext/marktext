import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, waitForEditor } from './helpers'

// Nested headings, and enough height that the caret has to travel.
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

  test('the highlighted entry is painted with the theme color', async() => {
    await clickHeadingInEditor(page, 'Getting Started')
    await expect
      .poll(() => getHighlightedTocLabel(page), { timeout: 5000 })
      .toBe('Getting Started')

    const { labelColor, themeColor } = await page.evaluate(() => {
      const content = document.querySelector(
        '.side-bar-toc .el-tree-node.is-current > .el-tree-node__content'
      ) as HTMLElement
      const probe = document.createElement('span')
      probe.style.color = 'var(--themeColor)'
      content.appendChild(probe)
      const themed = getComputedStyle(probe).color
      probe.remove()
      const label = content.querySelector('.el-tree-node__label') as HTMLElement
      return { labelColor: getComputedStyle(label).color, themeColor: themed }
    })
    expect(labelColor).toBe(themeColor)
  })

  // Runs last: it grows the document. The heading positions used to be measured
  // once per TOC change, and typing body text changes no TOC entry — so the
  // measurements went stale while the headings below the caret moved down, and
  // the highlight ran ahead into the next section.
  test('the highlight stays on the section being typed into', async() => {
    await page.locator('.mu-container p', { hasText: 'Some intro text here.' }).first().click()
    await expect
      .poll(() => getHighlightedTocLabel(page), { timeout: 5000 })
      .toBe('Introduction')

    // Enough lines to push `## Getting Started` well past where it started.
    await page.keyboard.press('End')
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Enter')
      await page.keyboard.type(`filler line ${i}`)
    }

    await expect
      .poll(() => getHighlightedTocLabel(page), { timeout: 5000 })
      .toBe('Introduction')
  })
})
