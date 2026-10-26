import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import type CodeMirror from 'codemirror'
import { clickMenuById, enterSourceMode, launchWithMarkdown, sendIpcToRenderer } from './helpers'

const MARKDOWN = Array.from({ length: 12 }, (_, index) =>
  `# Section ${index + 1}\n\n${'Wrapped paragraph text for testing layout changes. '.repeat(30)}\n\n`
).join('')
let app: ElectronApplication
let page: Page

test.beforeEach(async() => {
  ;({ app, page } = await launchWithMarkdown(MARKDOWN, {
    preferences: { language: 'en', sideBarVisibility: true, editorLineWidth: '100%' }
  }))
  const win = await app.browserWindow(page)
  await win.evaluate(window => window.setContentSize(1280, 800))
  await sendIpcToRenderer(app, 'mt::set-view-layout', { sideBarWidth: 280 })
  await expect(page.locator('.document-outline')).toHaveClass(/is-expanded/)
})
test.afterEach(async() => { await app?.close() })

for (const position of ['left', 'right']) {
  test(`${position} outline preserves readable content at the minimum window width`, async() => {
    await page.evaluate(tocPosition => {
      window.electron.ipcRenderer.send('mt::set-user-preference', { tocPosition })
    }, position)
    if (position === 'right') await expect(page.locator('.document-outline')).toHaveClass(/is-right/)
    const win = await app.browserWindow(page)
    await win.evaluate(window => window.setContentSize(550, 800))
    await expect.poll(() => page.locator('.document-body').evaluate(el => el.clientWidth)).toBeGreaterThanOrEqual(320)
    const bounds = await page.evaluate(() => {
      const column = document.querySelector('.mu-container') as HTMLElement
      const style = getComputedStyle(column)
      const workspace = document.querySelector('.editor-with-tabs > .container') as HTMLElement
      return {
        contentWidth: column.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        overflow: workspace.scrollWidth - workspace.clientWidth,
        canScroll: getComputedStyle(workspace).overflowX === 'auto'
      }
    })
    expect(bounds.contentWidth).toBeGreaterThan(100)
    expect(bounds.overflow).toBeGreaterThan(0)
    expect(bounds.canScroll).toBe(true)
    await page.locator('.editor-with-tabs > .container').evaluate(el => { el.scrollLeft = el.scrollWidth })
    await expect.poll(() => page.locator('.editor-with-tabs > .container').evaluate(el => el.scrollLeft)).toBeGreaterThan(0)
    await expect(page.locator('.document-outline')).toHaveClass(/is-expanded/)
    await enterSourceMode(page, app)
    await expect.poll(() => page.locator('.source-code').evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(320)
    await win.evaluate(window => window.setContentSize(1280, 800))
    await expect.poll(() => page.locator('.document-outline').evaluate(el => el.clientWidth)).toBeGreaterThanOrEqual(219)
    await expect.poll(() => page.locator('.editor-with-tabs > .container').evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0)
  })
}

const headingMeasurement = () => page.evaluate(() => {
  const wrapper = document.querySelector('.source-code .CodeMirror') as HTMLElement & { CodeMirror: CodeMirror.Editor }
  const target = Array.from(wrapper.querySelectorAll('.CodeMirror-line')).find(el => el.textContent === '# Section 8')
  if (!target) throw new Error('Missing source heading')
  const expectedLine = wrapper.CodeMirror.getValue().split('\n').indexOf('# Section 8')
  const actualLine = wrapper.CodeMirror.lineAtHeight(target.getBoundingClientRect().top + 1, 'window')
  return { expectedLine, actualLine }
})
const expectAccurateHeading = async(): Promise<void> => {
  await expect.poll(headingMeasurement).toEqual({ expectedLine: 28, actualLine: 28 })
  await page.evaluate(() => {
    const container = document.querySelector('.source-code') as HTMLElement
    const target = Array.from(container.querySelectorAll('.CodeMirror-line')).find(el => el.textContent === '# Section 8')
    if (!target) throw new Error('Missing source heading')
    container.scrollTop += target.getBoundingClientRect().top - container.getBoundingClientRect().top - 30
  })
  await page.locator('.source-code').dispatchEvent('scroll')
  await expect(page.locator('.side-bar-toc .is-current > .el-tree-node__content .el-tree-node__label')).toHaveText('Section 8')
}

test('source heading measurements follow outline dragging without a window resize', async() => {
  await enterSourceMode(page, app)
  await expectAccurateHeading()
  const separator = page.getByRole('separator', { name: 'Resize table of contents' })
  const bounds = await separator.boundingBox()
  if (!bounds) throw new Error('Missing outline divider')
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 300, y, { steps: 10 })
  await page.mouse.up()
  await expectAccurateHeading()
})

test('source heading measurements follow outline toggles without remounting', async() => {
  await enterSourceMode(page, app)
  await expectAccurateHeading()
  await clickMenuById(app, 'tocMenuItem')
  await expectAccurateHeading()
  await clickMenuById(app, 'tocMenuItem')
  await expectAccurateHeading()
})
