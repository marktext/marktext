import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { delaySessionStateWrites, expectNoRendererErrors, launchElectron, openProjectFolder, sendIpcToRenderer } from './helpers'
import type { IFileState } from '../../src/shared/types/files'
import type { ApplicationState } from '../../src/shared/types/applicationState'
import type * as ExtraFs from 'fs-extra'
import type { MoveOptions } from 'fs-extra'

let directory: string
let app: ElectronApplication
let page: Page
const row = (pathname: string) => page.locator(`[data-tree-path=${JSON.stringify(pathname)}]`)
const editorState = () => page.evaluate(() => {
  const root = document.querySelector('#app') as Element & {
    __vue_app__: { config: { globalProperties: { $pinia: { _s: Map<string, { tabs: IFileState[]; currentFile: IFileState }> } } } }
  }
  const editor = root.__vue_app__.config.globalProperties.$pinia._s.get('editor')
  if (!editor) throw new Error('Editor store unavailable')
  return { pathname: editor.currentFile.pathname, saved: editor.currentFile.isSaved, markdown: editor.currentFile.markdown,
    missing: editor.tabs.filter(tab => tab.diskMissing).map(tab => tab.pathname),
    fileChangeNotifications: editor.tabs.filter(tab => tab.notifications.some(item => item.exclusiveType === 'file_changed')).map(tab => tab.pathname),
    tabs: editor.tabs.map(tab => ({ pathname: tab.pathname, saved: tab.isSaved })) }
})
const confirmMove = async(response: number) => {
  await app.evaluate(({ dialog }, response) => {
    dialog.showMessageBox = async() => ({ response, checkboxChecked: false })
  }, response)
}

test.beforeEach(async() => {
  directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mt-drag-move-')))
  fs.mkdirSync(path.join(directory, 'notes'))
  fs.mkdirSync(path.join(directory, 'chapter'))
  fs.writeFileSync(path.join(directory, 'draft.md'), 'Original text\n')
  fs.writeFileSync(path.join(directory, 'chapter', 'child.md'), 'Child text\n')
  fs.writeFileSync(path.join(directory, 'chapter', 'other.md'), 'Other text\n')
  fs.writeFileSync(path.join(directory, 'chapter', '.hidden'), 'Hidden resource')
  const launched = await launchElectron([directory], {
    windowLayout: { showSideBar: true }, suppressErrorDialog: true,
    preferences: { language: 'en', autoSave: false, openFilesInPreviewMode: false, autoRevealInSidebar: false }
  })
  app = launched.app
  page = launched.page
  await expect(row(path.join(directory, 'draft.md'))).toBeVisible()
  await expect(page.locator('.root-status')).toHaveCount(0)
  await confirmMove(0)
})
test.afterEach(async() => {
  if (app) await app.close()
  fs.rmSync(directory, { recursive: true, force: true })
})

test('native file drags preserve saved state and dirty edits and can return to the root', async() => {
  const source = path.join(directory, 'draft.md')
  const target = path.join(directory, 'notes')
  const destination = path.join(target, 'draft.md')
  await row(source).click()
  await expect.poll(editorState).toMatchObject({ pathname: source, saved: true })
  await row(source).dragTo(row(target))
  await expect.poll(() => fs.existsSync(destination)).toBe(true)
  await expect.poll(editorState).toMatchObject({ pathname: destination, saved: true })
  await expect(row(destination)).toHaveClass(/active/)
  expect(fs.existsSync(source)).toBe(false)
  await row(destination).dragTo(row(directory))
  await expect.poll(() => fs.existsSync(source)).toBe(true)
  await expect.poll(editorState).toMatchObject({ pathname: source, saved: true })

  const document = page.getByRole('textbox', { name: 'Document', exact: true })
  await document.click()
  await page.keyboard.press('ControlOrMeta+End')
  await page.keyboard.type(' Unsaved changes')
  await expect.poll(editorState).toMatchObject({ saved: false })
  await row(source).dragTo(row(target))
  await expect.poll(editorState).toMatchObject({ pathname: destination, saved: false })
  await expect(document).toContainText('Unsaved changes')
  await expect(page.locator('.tree-wrapper')).toHaveAttribute('aria-busy', 'false')
  await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
  await expect.poll(() => fs.readFileSync(destination, 'utf8')).toContain('Unsaved changes')
  expect(fs.existsSync(source)).toBe(false)
  const recent = await page.evaluate(() => window.electron.ipcRenderer.invoke('mt::get-recently-used-documents'))
  expect(recent.some(item => item.pathname === destination)).toBe(true)
  expect(recent.some(item => item.pathname === source)).toBe(false)
  await expectNoRendererErrors(app)
})

for (const name of ['draft.md', 'notes']) {
  test(`native ${name === 'notes' ? 'folder' : 'file'} drag onto a file moves into its parent folder`, async() => {
    const source = path.join(directory, name)
    const folder = path.join(directory, 'chapter')
    const anchor = path.join(folder, 'child.md')
    await row(folder).click()
    await expect(row(anchor)).toBeVisible()
    await row(source).dragTo(row(anchor))
    const destination = path.join(folder, name)
    await expect.poll(() => fs.existsSync(destination)).toBe(true)
    await expect(row(destination)).toHaveClass(/active/)
    expect(fs.existsSync(source)).toBe(false)

    const rootFile = path.join(directory, 'return.md')
    fs.writeFileSync(rootFile, 'Root drop target\n')
    await expect(row(rootFile)).toBeVisible()
    await row(destination).dragTo(row(rootFile))
    await expect.poll(() => fs.existsSync(source)).toBe(true)
    await expect(row(source)).toHaveClass(/active/)
    expect(fs.existsSync(destination)).toBe(false)
    expect(fs.readFileSync(anchor, 'utf8')).toBe('Child text\n')
    expect(fs.readFileSync(rootFile, 'utf8')).toBe('Root drop target\n')
    await expectNoRendererErrors(app)
  })
}

test('moves a folder with clean and dirty open descendants and hidden resources', async() => {
  const source = path.join(directory, 'chapter')
  const target = path.join(directory, 'notes')
  const child = path.join(source, 'child.md')
  await row(source).click()
  await row(child).click()
  await expect.poll(editorState).toMatchObject({ pathname: child })
  await row(path.join(source, 'other.md')).click()
  await expect.poll(editorState).toMatchObject({ pathname: path.join(source, 'other.md') })
  await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toContainText('Other text')
  await page.getByRole('textbox', { name: 'Document', exact: true }).fill('Dirty folder content')
  await expect.poll(editorState).toMatchObject({ saved: false })
  await row(source).dragTo(row(target))
  const destination = path.join(target, 'chapter')
  await expect.poll(() => fs.existsSync(path.join(destination, '.hidden'))).toBe(true)
  await expect.poll(editorState).toMatchObject({ pathname: path.join(destination, 'other.md'), saved: false,
    tabs: expect.arrayContaining([
      { pathname: path.join(destination, 'child.md'), saved: true },
      { pathname: path.join(destination, 'other.md'), saved: false }
    ]) })
  expect(fs.existsSync(source)).toBe(false)
  expect(fs.readFileSync(path.join(destination, '.hidden'), 'utf8')).toBe('Hidden resource')
  await expect(row(destination)).toHaveClass(/active/)
  await expect(page.locator('.tree-wrapper')).toHaveAttribute('aria-busy', 'false')
  await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
  await expect.poll(() => fs.readFileSync(path.join(destination, 'other.md'), 'utf8')).toContain('Dirty folder content')
  expect(fs.existsSync(source)).toBe(false)
  await expectNoRendererErrors(app)
})

test('blocks a folder move while another window has an open descendant', async() => {
  const child = path.join(directory, 'chapter', 'child.md')
  const opened = app.waitForEvent('window')
  await app.evaluate(({ app }, pathname) => {
    const argv = ['marktext', '--new-window', pathname]
    app.emit('second-instance', {}, argv, '/', { argv })
  }, child)
  const second = await opened
  await expect(second.getByRole('textbox', { name: 'Document', exact: true })).toContainText('Child text')
  await page.bringToFront()
  await row(path.join(directory, 'chapter')).dragTo(row(path.join(directory, 'notes')))
  await expect(page.getByText('Close this file and any documents inside this folder in other MarkText windows before moving it.')).toBeVisible()
  expect(fs.existsSync(child)).toBe(true)
  expect(fs.existsSync(path.join(directory, 'notes', 'chapter'))).toBe(false)
  await expectNoRendererErrors(app)
})

test('moving two clean open descendants preserves saved state during slow session persistence', async() => {
  const source = path.join(directory, 'chapter')
  const target = path.join(directory, 'notes')
  await row(source).click()
  await row(path.join(source, 'child.md')).click()
  await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toContainText('Child text')
  await row(path.join(source, 'other.md')).click()
  await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toContainText('Other text')
  await expect.poll(editorState).toMatchObject({ tabs: [
    { pathname: path.join(source, 'child.md'), saved: true },
    { pathname: path.join(source, 'other.md'), saved: true }
  ] })
  await delaySessionStateWrites(app, 700)
  await row(source).dragTo(row(target))
  await expect(page.locator('.tree-wrapper')).toHaveAttribute('aria-busy', 'false', { timeout: 20000 })
  const destination = path.join(target, 'chapter')
  await expect.poll(editorState).toMatchObject({ tabs: [
    { pathname: path.join(destination, 'child.md'), saved: true },
    { pathname: path.join(destination, 'other.md'), saved: true }
  ], missing: [], fileChangeNotifications: [] })
  expect(fs.existsSync(source)).toBe(false)
  const removed = path.join(destination, 'child.md')
  fs.unlinkSync(removed)
  await expect.poll(editorState).toMatchObject({ tabs: [
    { pathname: removed, saved: false },
    { pathname: path.join(destination, 'other.md'), saved: true }
  ], missing: [removed], fileChangeNotifications: [removed] })
  await expectNoRendererErrors(app)
})

test('a document can be dragged back to a symlink workspace root', async() => {
  const alias = `${directory}-alias`
  fs.symlinkSync(directory, alias, 'junction')
  try {
    fs.writeFileSync(path.join(directory, 'anchor.md'), 'Workspace marker\n')
    await openProjectFolder(app, page, alias, path.join(alias, 'anchor.md'))
    const linkedRow = (name: string) => page.locator(`[data-tree-path=${JSON.stringify(path.join(alias, name))}]`)
    await linkedRow('draft.md').click()
    await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toContainText('Original text')
    await linkedRow('draft.md').dragTo(linkedRow('notes'))
    await expect(linkedRow('notes/draft.md')).toHaveClass(/active/)
    await linkedRow('notes/draft.md').dragTo(linkedRow(''))
    await expect.poll(() => fs.existsSync(path.join(directory, 'draft.md'))).toBe(true)
    const recent = await page.evaluate(() => window.electron.ipcRenderer.invoke('mt::get-recently-used-documents'))
    expect(recent.some(item => item.pathname === path.join(directory, 'draft.md'))).toBe(true)
    await expect(linkedRow('draft.md')).toHaveClass(/active/)
    await expect.poll(editorState).toMatchObject({ saved: true, missing: [], fileChangeNotifications: [] })
    expect(fs.existsSync(path.join(directory, 'notes', 'draft.md'))).toBe(false)
    await expectNoRendererErrors(app)
  } finally {
    fs.unlinkSync(alias)
  }
})

test('explicit moved-folder reveal wins over automatic active-file reveal', async() => {
  const source = path.join(directory, 'chapter')
  for (let index = 0; index < 60; index++) {
    fs.writeFileSync(path.join(source, `z-${index.toString().padStart(2, '0')}.md`), `Document ${index}\n`)
  }
  await page.evaluate(() => window.electron.ipcRenderer.invoke('mt::preferences::update', {
    autoRevealInSidebar: true, fileSortBy: 'title', fileSortOrder: 'asc'
  }))
  await row(source).click()
  await row(path.join(source, 'z-59.md')).click()
  await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toContainText('Document 59')
  await page.locator('.tree-wrapper').evaluate(element => { element.scrollTop = 0 })
  await row(source).click()
  await row(source).dragTo(row(path.join(directory, 'notes')))
  const destination = path.join(directory, 'notes', 'chapter')
  await expect(row(destination)).toHaveClass(/active/)
  await expect(page.locator('.tree-wrapper')).toHaveAttribute('aria-busy', 'false')
  fs.writeFileSync(path.join(directory, 'zz-late.md'), 'Late tree update\n')
  await expect(row(path.join(directory, 'zz-late.md'))).toBeAttached()
  await expect.poll(async() => {
    const folder = await row(destination).boundingBox()
    const viewport = await page.locator('.tree-wrapper').boundingBox()
    return !!folder && !!viewport && folder.y >= viewport.y && folder.y + folder.height <= viewport.y + viewport.height
  }).toBe(true)
  await expectNoRendererErrors(app)
})

test('a failed move reconciles a source deleted while watcher events are suppressed', async() => {
  const source = path.join(directory, 'draft.md')
  await row(source).click()
  await expect.poll(editorState).toMatchObject({ pathname: source, saved: true, missing: [] })
  await app.evaluate(({ app }, source) => {
    const modules = process.getBuiltinModule('module')
    const filesystem = process.getBuiltinModule('fs') as typeof fs
    const require = modules.createRequire(`${app.getAppPath()}/package.json`)
    const extra = require('fs-extra') as typeof ExtraFs
    const move = extra.move
    extra.move = (async(src: string, dest: string, options: MoveOptions) => {
      if (src === source) {
        filesystem.unlinkSync(src)
        await new Promise(resolve => setTimeout(resolve, 700))
        throw new Error('Injected move failure after source deletion')
      }
      return move(src, dest, options)
    }) as typeof extra.move
  }, source)
  await row(source).dragTo(row(path.join(directory, 'notes')))
  await expect(page.locator('.tree-wrapper')).toHaveAttribute('aria-busy', 'false')
  await expect.poll(editorState).toMatchObject({ saved: false, missing: [source], fileChangeNotifications: [source] })
  expect(fs.existsSync(source)).toBe(false)
  expect(fs.existsSync(path.join(directory, 'notes', 'draft.md'))).toBe(false)
  await expect.poll(() => app.evaluate(({ app }, source) => {
    const filesystem = process.getBuiltinModule('fs') as typeof fs
    const paths = process.getBuiltinModule('path') as typeof path
    const state = JSON.parse(filesystem.readFileSync(paths.join(app.getPath('userData'), 'state', 'application-state.json'), 'utf8')) as ApplicationState
    return state.session.windows.flatMap(window => window.documents).find(document =>
      document.resource.kind === 'file' && document.resource.location.path === source)?.content.kind
  }, source)).toBe('recovery')
  await expectNoRendererErrors(app)
})

test('autosave after a move writes the new path without recreating the old one', async() => {
  const source = path.join(directory, 'draft.md')
  const destination = path.join(directory, 'notes', 'draft.md')
  await page.evaluate(async() => {
    await window.electron.ipcRenderer.invoke('mt::preferences::update', { autoSave: true, autoSaveDelay: 1000 })
  })
  await row(source).click()
  const document = page.getByRole('textbox', { name: 'Document', exact: true })
  await expect(document).toContainText('Original text')
  await document.fill('Pending autosave follows the move')
  await expect.poll(editorState).toMatchObject({ saved: false })
  await row(source).dragTo(row(path.join(directory, 'notes')))
  await expect.poll(editorState).toMatchObject({ pathname: destination })
  await expect(page.locator('.tree-wrapper')).toHaveAttribute('aria-busy', 'false')
  await expect.poll(() => fs.readFileSync(destination, 'utf8')).toContain('Pending autosave follows the move')
  expect(fs.existsSync(source)).toBe(false)
  await document.fill('Autosaved at the new path')
  await expect.poll(() => fs.readFileSync(destination, 'utf8')).toContain('Autosaved at the new path')
  expect(fs.existsSync(source)).toBe(false)
  await expectNoRendererErrors(app)
})

test('cancel and name conflicts preserve the original files', async() => {
  const source = path.join(directory, 'draft.md')
  const target = path.join(directory, 'notes')
  await confirmMove(1)
  await row(source).dragTo(row(target))
  await expect(page.locator('.tree-wrapper')).toHaveAttribute('aria-busy', 'false')
  expect(fs.existsSync(source)).toBe(true)
  expect(fs.existsSync(path.join(target, 'draft.md'))).toBe(false)
  await confirmMove(0)
  fs.writeFileSync(path.join(target, 'draft.md'), 'Existing file')
  await row(source).dragTo(row(target))
  await expect(page.getByText('The destination already contains an item with this name. Rename it before trying again.')).toBeVisible()
  expect(fs.readFileSync(source, 'utf8')).toBe('Original text\n')
  expect(fs.readFileSync(path.join(target, 'draft.md'), 'utf8')).toBe('Existing file')
  await expectNoRendererErrors(app)
})
