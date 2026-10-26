import { expect, test } from '@playwright/test'
import { _electron, type ElectronApplication, type Page } from 'playwright'
import { clickMenuById, getElectronPath, launchWithMarkdown, waitForEditor } from './helpers'

let app: ElectronApplication
let page: Page
let filePath: string
const outlineWidth = (): Promise<number> => page.locator('.document-outline')
  .evaluate(el => Math.round(el.getBoundingClientRect().width))
const setPreferences = async(preferences: Record<string, unknown>): Promise<void> => {
  await page.evaluate(value => window.electron.ipcRenderer.send('mt::set-user-preference', value), preferences)
}
const dragDivider = async(offset: number): Promise<void> => {
  const bounds = await page.getByRole('separator', { name: 'Resize table of contents' }).boundingBox()
  if (!bounds) throw new Error('Missing outline divider')
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + offset, y, { steps: 10 })
  await page.mouse.up()
}

test.beforeEach(async() => {
  ;({ app, page, filePath } = await launchWithMarkdown('# Document\n\n## Section\n\nBody text.\n', {
    preferences: { language: 'en', sideBarVisibility: true, editorLineWidth: '70%' }
  }))
  const win = await app.browserWindow(page)
  await win.evaluate(window => window.setContentSize(1280, 800))
  await expect(page.locator('.document-outline')).toHaveClass(/is-expanded/)
})
test.afterEach(async() => { await app?.close() })

test('wide text and the file tree coexist with a docked outline on either side', async() => {
  for (const position of ['left', 'right']) {
    await setPreferences({ tocPosition: position, editorLineWidth: '100%' })
    if (position === 'right') await expect(page.locator('.document-outline')).toHaveClass(/is-right/)
    else await expect(page.locator('.document-outline')).not.toHaveClass(/is-right/)
    await expect.poll(() => page.evaluate(() => {
      const outline = document.querySelector('.document-outline')?.getBoundingClientRect()
      const body = document.querySelector('.document-body')?.getBoundingClientRect()
      const sidebar = document.querySelector('.side-bar')?.getBoundingClientRect()
      if (!outline || !body || !sidebar) return false
      return outline.width === 220 && body.width > 500 &&
        sidebar.right <= Math.min(body.left, outline.left) + 1 &&
        (Math.abs(outline.right - body.left) < 1 || Math.abs(body.right - outline.left) < 1)
    })).toBe(true)
    const win = await app.browserWindow(page)
    await win.evaluate(window => window.setContentSize(850, 800))
    await expect(page.locator('.document-outline')).toHaveClass(/is-expanded/)
    await expect(page.locator('.outline-body')).toBeVisible()
    await expect(page.locator('.document-outline')).not.toHaveClass(/is-floating/)
    await win.evaluate(window => window.setContentSize(1280, 800))
  }
})

for (const position of ['left', 'right']) {
  test(`${position} divider resizes toward the editor and restores local width after restart`, async() => {
    await setPreferences({ tocPosition: position })
    if (position === 'right') await expect(page.locator('.document-outline')).toHaveClass(/is-right/)
    await dragDivider(position === 'right' ? -120 : 120)
    await expect.poll(outlineWidth).toBe(340)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('outline-width'))).toBe('340')

    await clickMenuById(app, 'tocMenuItem')
    await page.mouse.move(700, 500)
    await expect(page.locator('.outline-body')).toBeHidden()
    const before = await page.locator('.document-body').boundingBox()
    await page.locator('.outline-toggle').hover()
    await expect(page.locator('.outline-body')).toBeVisible()
    expect(await page.locator('.document-body').boundingBox()).toEqual(before)
    const preview = await page.locator('.outline-body').boundingBox()
    const icon = await page.locator('.outline-toggle').boundingBox()
    const bulk = await page.locator('.outline-bulk-toggle').boundingBox()
    expect(preview && Math.round(preview.width)).toBe(340)
    expect(icon && bulk && (bulk.x + bulk.width <= icon.x || icon.x + icon.width <= bulk.x)).toBe(true)
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById('tocMenuItem')?.checked)).toBe(false)

    await page.locator('.outline-toggle').click()
    await expect(page.locator('.document-outline')).toHaveClass(/is-expanded/)
    await expect.poll(outlineWidth).toBe(340)
    await clickMenuById(app, 'sourceCodeModeMenuItem')
    await expect(page.locator('.source-code .CodeMirror')).toBeVisible()
    await expect.poll(outlineWidth).toBe(340)

    const appPath = await app.evaluate(({ app }) => app.getAppPath())
    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    await app.close()
    app = await _electron.launch({
      executablePath: getElectronPath(),
      args: [appPath, '--user-data-dir', userData, filePath],
      cwd: appPath
    })
    page = await app.firstWindow()
    await waitForEditor(page)
    await expect(page.locator('.document-outline')).toHaveClass(/is-expanded/)
    if (position === 'right') await expect(page.locator('.document-outline')).toHaveClass(/is-right/)
    await expect.poll(outlineWidth).toBe(340)
  })
}

test('resizing is bounded, keyboard accessible and preserves the preferred width on window resize', async() => {
  const divider = page.getByRole('separator', { name: 'Resize table of contents' })
  await divider.focus()
  await divider.press('ArrowRight')
  await expect.poll(outlineWidth).toBe(230)
  await divider.press('Home')
  await expect.poll(outlineWidth).toBe(180)
  await dragDivider(-100)
  await expect.poll(outlineWidth).toBe(180)
  await divider.press('End')
  await expect.poll(outlineWidth).toBe(600)
  await dragDivider(100)
  await expect.poll(outlineWidth).toBe(600)

  const win = await app.browserWindow(page)
  await win.evaluate(window => window.setContentSize(850, 800))
  await expect(page.locator('.document-outline')).toHaveClass(/is-expanded/)
  await expect.poll(outlineWidth).toBeLessThan(600)
  expect(await page.evaluate(() => localStorage.getItem('outline-width'))).toBe('600')
  await win.evaluate(window => window.setContentSize(1280, 800))
  await expect.poll(outlineWidth).toBe(600)
})
