import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { clickMenuById, launchWithMarkdown, makeRoomForOutline, sendIpcToRenderer } from './helpers'

const MARKDOWN = '# A\n\n## B\n\n### B1\n\n#### B2\n\n## C\n\n### C1\n'
const ALL_LABELS = ['A', 'B', 'B1', 'B2', 'C', 'C1']

const visibleLabels = (page: Page): Promise<string[]> =>
  page.locator('.side-bar-toc .el-tree-node__label:visible').allTextContents()

const toggleNode = async(page: Page, label: string): Promise<void> => {
  const content = page.locator('.side-bar-toc .el-tree-node__content').filter({
    has: page.locator('.el-tree-node__label', { hasText: new RegExp(`^${label}$`) })
  })
  await content.locator(':scope > .el-tree-node__expand-icon').click()
}

const switchTab = async(app: ElectronApplication, page: Page, index: number): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::switch-tab-by-index', index)
  await expect(page.locator('.tabs-container > li').nth(index)).toHaveClass(/active/)
}

test.describe('TOC state belongs to each open tab (#4914)', () => {
  let app: ElectronApplication
  let page: Page
  let filePath: string

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown(MARKDOWN)
    app = launched.app
    page = launched.page
    filePath = launched.filePath
    await makeRoomForOutline(app, page)
    await expect.poll(() => visibleLabels(page)).toEqual(ALL_LABELS)
  })

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('restores opposite nested states for tabs with identical headings', async() => {
    await toggleNode(page, 'B')
    await expect.poll(() => visibleLabels(page)).toEqual(['A', 'B', 'C', 'C1'])

    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, MARKDOWN)
    await expect.poll(() => visibleLabels(page)).toEqual(ALL_LABELS)
    await toggleNode(page, 'B1')
    await toggleNode(page, 'C')
    await expect.poll(() => visibleLabels(page)).toEqual(['A', 'B', 'B1', 'C'])

    for (let i = 0; i < 3; i++) {
      await switchTab(app, page, 0)
      await expect.poll(() => visibleLabels(page)).toEqual(['A', 'B', 'C', 'C1'])
      await switchTab(app, page, 1)
      await expect.poll(() => visibleLabels(page)).toEqual(['A', 'B', 'B1', 'C'])
    }

    await toggleNode(page, 'A')
    await expect.poll(() => visibleLabels(page)).toEqual(['A'])
    await switchTab(app, page, 0)
    await switchTab(app, page, 1)
    await expect.poll(() => visibleLabels(page)).toEqual(['A'])
    await toggleNode(page, 'A')
    await expect.poll(() => visibleLabels(page)).toEqual(['A', 'B', 'B1', 'C'])
  })

  test('keeps folds separate from document contents without dirtying the document', async() => {
    await toggleNode(page, 'B')
    const state = await page.evaluate(() => {
      const root = document.querySelector('#app') as Element & {
        __vue_app__: { config: { globalProperties: { $pinia: {
          _s: Map<string, {
            currentFile: { tocCollapsedKeys?: string[]; isSaved: boolean; markdown: string }
          }>
        } } } }
      }
      const store = root.__vue_app__.config.globalProperties.$pinia._s.get('editor')
      if (!store) throw new Error('Editor store is unavailable')
      return {
        collapsed: store.currentFile.tocCollapsedKeys,
        saved: store.currentFile.isSaved,
        markdown: store.currentFile.markdown
      }
    })
    expect(state.collapsed).toHaveLength(1)
    expect(state.saved).toBe(true)
    expect(state.markdown.trim()).toBe(MARKDOWN.trim())

    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, MARKDOWN)
    await expect.poll(() => visibleLabels(page)).toEqual(ALL_LABELS)
  })

  test('keeps folds through outline visibility and editor mode changes', async() => {
    await toggleNode(page, 'B')
    const folded = ['A', 'B', 'C', 'C1']
    await clickMenuById(app, 'tocMenuItem')
    await page.mouse.move(1200, 500)
    await expect(page.locator('.outline-body')).toBeHidden()
    await clickMenuById(app, 'tocMenuItem')
    await expect.poll(() => visibleLabels(page)).toEqual(folded)

    await clickMenuById(app, 'sourceCodeModeMenuItem')
    await expect(page.locator('.source-code .CodeMirror')).toBeVisible()
    await expect.poll(() => visibleLabels(page)).toEqual(folded)
    await clickMenuById(app, 'sourceCodeModeMenuItem')
    await expect(page.locator('.source-code .CodeMirror')).toHaveCount(0)
    await expect.poll(() => visibleLabels(page)).toEqual(folded)
  })

  test('starts expanded when a closed file is reopened', async() => {
    await toggleNode(page, 'B')
    const originalId = await page.locator('.tabs-container > li.active').getAttribute('data-id')
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, '# Another document\n')
    await expect.poll(() => visibleLabels(page)).toEqual(['Another document'])
    await switchTab(app, page, 0)
    await expect.poll(() => visibleLabels(page)).toEqual(['A', 'B', 'C', 'C1'])
    await sendIpcToRenderer(app, 'mt::editor-close-tab')
    await expect(page.locator('.tabs-container > li')).toHaveCount(1)

    await page.evaluate(pathname => {
      window.electron.ipcRenderer.send('mt::open-file', pathname, {})
    }, filePath)
    await expect.poll(() => visibleLabels(page)).toEqual(ALL_LABELS)
    await expect(page.locator('.tabs-container > li.active')).not.toHaveAttribute('data-id', originalId ?? '')
  })
})
