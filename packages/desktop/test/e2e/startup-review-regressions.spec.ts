import { expect, test } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import type CodeMirror from 'codemirror'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ApplicationState } from '../../src/shared/types/applicationState'
import { enterSourceMode, exitSourceMode, launchElectron, sendIpcToRenderer } from './helpers'

let directory: string
let profile: string
const running = new Set<ElectronApplication>()

test.beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'mt-review-regression-'))
  profile = join(directory, 'profile')
})
test.afterEach(async() => {
  for (const app of running) await app.close()
  running.clear()
  rmSync(directory, { recursive: true, force: true })
})

const readState = (): ApplicationState =>
  JSON.parse(readFileSync(join(profile, 'state', 'application-state.json'), 'utf8'))

const launch = async(markdown: string, preferences: Record<string, unknown> = {}) => {
  const pathname = join(directory, 'original.md')
  writeFileSync(pathname, markdown)
  const result = await launchElectron([pathname], {
    userDataDir: profile,
    preferences: { language: 'en', autoSave: false, ...preferences },
    suppressErrorDialog: true
  })
  running.add(result.app)
  return { ...result, pathname }
}

const restart = async(app: ElectronApplication) => {
  await app.close()
  running.delete(app)
  const result = await launchElectron([], { userDataDir: profile, suppressErrorDialog: true })
  running.add(result.app)
  return result
}

test('Save As releases the original path so a second-instance request can reopen it', async() => {
  const { app, pathname } = await launch('Original disk text', { openFilesInNewWindow: false })
  const destination = join(directory, 'renamed.md')
  await app.evaluate(({ dialog }, destination) => {
    dialog.showSaveDialog = async() => ({ canceled: false, filePath: destination })
  }, destination)
  await sendIpcToRenderer(app, 'mt::editor-ask-file-save-as')
  await expect
    .poll(() => readState().session.windows[0].documents[0].resource)
    .toMatchObject({
      kind: 'file',
      location: { path: destination }
    })

  const other = join(directory, 'other.md')
  writeFileSync(other, 'Another editor window')
  const opened = app.waitForEvent('window')
  await app.evaluate(({ app }, pathname) => {
    const argv = ['marktext', '--new-window', pathname]
    app.emit('second-instance', {}, argv, '/', { argv })
  }, other)
  const second = await opened
  await expect(second.getByRole('textbox', { name: 'Document', exact: true })).toContainText(
    'Another editor window'
  )
  await app.evaluate(({ app }, pathname) => {
    const argv = ['marktext', pathname]
    app.emit('second-instance', {}, argv, '/', { argv })
  }, pathname)
  await expect
    .poll(() =>
      readState().session.windows.flatMap((window) =>
        window.documents.flatMap((document) =>
          document.resource.kind === 'file' ? [document.resource.location.path] : []
        )
      )
    )
    .toContain(pathname)
})

test('editing without a final newline still captures the current rendered view', async() => {
  const { page } = await launch('Original text', { trimTrailingNewline: 0 })
  const changed = 'Changed without a final newline'
  await page.getByRole('textbox', { name: 'Document', exact: true }).fill(changed)
  await expect.poll(() => readState().session.windows[0].documents[0].content.kind).toBe('recovery')
  const digest = createHash('sha256').update(changed).digest('hex')
  await expect
    .poll(() => readState().session.windows[0].documents[0].view?.contentSha256)
    .toBe(digest)
  expect(readState().session.windows[0].documents[0].view?.muyaSelection).not.toBeNull()
})

test('source scrolling is checkpointed and restored from the visible outer container', async() => {
  const markdown = Array.from(
    { length: 200 },
    (_, index) => `Line ${index} for source scrolling`
  ).join('\n')
  const { app, page } = await launch(markdown)
  await enterSourceMode(page, app)
  const outer = page.locator('.source-code')
  await outer.evaluate((element) => {
    element.scrollTop = 480
  })
  await outer.dispatchEvent('scroll')
  await expect.poll(() => outer.evaluate((element) => element.scrollTop)).toBe(480)
  await expect
    .poll(() => readState().session.windows[0].documents[0].view?.sourceScrollTopPx)
    .toBe(480)
  const restored = await restart(app)
  await expect(restored.page.locator('.source-code')).toBeVisible()
  await expect
    .poll(() => restored.page.locator('.source-code').evaluate((element) => element.scrollTop))
    .toBe(480)
})

test('an explicit TOC position preference moves the live outline and survives restart', async() => {
  const { app, page } = await launch('# Outline position\n', { tocPosition: 'left' })
  await expect(page.locator('.document-outline')).not.toHaveClass(/is-right/)
  const opened = app.waitForEvent('window')
  await page.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window'))
  const settings = await opened
  const select = settings.locator('.pref-select-item').filter({
    has: settings.getByRole('combobox', { name: 'Default table of contents position', exact: true })
  })
  await select.locator('.el-select__wrapper').click()
  await settings.getByRole('option', { name: 'Right', exact: true }).click()
  await expect(page.locator('.document-outline')).toHaveClass(/is-right/)
  await expect.poll(() => readState().session.windows[0].layout.outline.position).toBe('right')
  const restored = await restart(app)
  await expect(restored.page.locator('.document-outline')).toHaveClass(/is-right/)
})


test('switching editing modes retains each mode reading position across restart', async() => {
  const markdown = Array.from({ length: 150 }, (_, index) => `Paragraph ${index} for reading state.\n`).join('\n')
  const { app, page } = await launch(markdown)
  const rendered = page.getByRole('textbox', { name: 'Document', exact: true })
  await rendered.click()
  await page.keyboard.press('Meta+ArrowDown')
  await page.keyboard.press('Shift+ArrowUp')
  await rendered.evaluate((element) => { element.scrollTop = 1200 })
  await rendered.dispatchEvent('scroll')
  await expect.poll(() => readState().session.windows[0].documents[0].view?.renderedScrollTopPx).toBe(1200)
  await enterSourceMode(page, app)
  await page.locator('.source-code .CodeMirror').evaluate((element) => {
    const cm = (element as unknown as Element & { CodeMirror: CodeMirror.Editor }).CodeMirror
    cm.setSelection({ line: 50, ch: 1 }, { line: 52, ch: 3 }, { scroll: false })
  })
  await page.locator('.source-code').evaluate((element) => { element.scrollTop = 480 })
  await page.locator('.source-code').dispatchEvent('scroll')
  await expect.poll(() => readState().session.windows[0].documents[0].view?.sourceScrollTopPx).toBe(480)
  await exitSourceMode(page, app)
  await expect.poll(() => rendered.evaluate((element) => element.scrollTop)).toBe(1200)
  await enterSourceMode(page, app)
  await expect.poll(() => page.locator('.source-code').evaluate((element) => element.scrollTop)).toBe(480)
  const restored = await restart(app)
  await expect.poll(() => restored.page.locator('.source-code').evaluate((element) => element.scrollTop)).toBe(480)
  await exitSourceMode(restored.page, restored.app)
  await expect.poll(() => restored.page.getByRole('textbox', { name: 'Document', exact: true }).evaluate((element) => element.scrollTop)).toBe(1200)
})
