import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, waitForEditor } from './helpers'

// #3110 — the outline panel renders each heading's inline markdown (emphasis,
// code, emoji) instead of showing marker text, while links and images flatten
// to their label / alt so an outline row stays a plain click-to-scroll control.
//
// Flow under test: engine `getTOC()` -> `contentHtml` (tokensToInlineHtml) ->
// LISTEN_FOR_CONTENT_CHANGE -> listToTree labelHtml -> toc.vue scoped slot.

const DOC = [
  '# **Bold** and *italic*',
  '',
  'Intro.',
  '',
  '## Inline `code` and :ok: end',
  '',
  '## a [link](https://example.com) and ![alt](https://example.com/i.png)',
  '',
  'Body.',
  ''
].join('\n')

test.describe('TOC renders inline markdown', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(DOC)
    app = launched.app
    page = launched.page
    await waitForEditor(page)

    const sidebarVisible = await page.evaluate(() => {
      const el = document.querySelector('.side-bar') as HTMLElement | null
      return !!(el && el.offsetParent !== null)
    })
    if (!sidebarVisible) await clickMenuById(app, 'sideBarMenuItem')
    await clickMenuById(app, 'tocMenuItem')
    await page.waitForSelector('.side-bar-toc .el-tree', { state: 'visible', timeout: 15000 })
    await page.waitForFunction(
      () => document.querySelectorAll('.side-bar-toc .el-tree-node__label').length >= 3,
      null,
      { timeout: 15000 }
    )
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('renders emphasis / code / emoji and flattens links + images', async() => {
    const rendered = await page.evaluate(() => {
      const labels = Array.from(
        document.querySelectorAll('.side-bar-toc .el-tree-node__label')
      ) as HTMLElement[]
      const textOf = (selector: string) =>
        Array.from(document.querySelectorAll(selector)).map((el) => (el.textContent || '').trim())
      const emojiLabel = labels.find((l) => (l.textContent || '').includes('🆗'))
      const markdownLabel = labels.find((l) => (l.textContent || '').includes('link'))

      return {
        strong: textOf('.side-bar-toc .el-tree-node__label strong'),
        em: textOf('.side-bar-toc .el-tree-node__label em'),
        code: textOf('.side-bar-toc .el-tree-node__label code'),
        emojiHtml: emojiLabel?.innerHTML ?? '',
        flattened: markdownLabel?.textContent ?? '',
        anchors: document.querySelectorAll('.side-bar-toc .el-tree-node__label a').length,
        images: document.querySelectorAll('.side-bar-toc .el-tree-node__label img').length
      }
    })

    expect(rendered.strong).toEqual(['Bold'])
    expect(rendered.em).toEqual(['italic'])
    expect(rendered.code).toEqual(['code'])
    // Emoji shortcodes render as their glyph, not the raw `:ok:`.
    expect(rendered.emojiHtml).toContain('🆗')
    // Links and images flatten to text — no interactive / image nodes leak in.
    expect(rendered.flattened).toBe('a link and alt')
    expect(rendered.anchors).toBe(0)
    expect(rendered.images).toBe(0)
  })
})
