import { expect, test } from '@playwright/test'
import { _electron, type ElectronApplication, type Page } from 'playwright'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { enterSourceMode, getElectronPath, launchElectron, setSourceMarkdown, typeIntoEditor, waitForEditor } from './helpers'

interface TabSnapshot {
  pathname: string
  markdown: string
  isSaved: boolean
}

interface CloseDialogs {
  response: number
  savePath: string
  cancelSave: boolean
  buttons: string[][]
  saveCalls: number
}

const original = 'Original on disk.\n'
const changed = 'Unsaved changes for issue 5596'
const apps: ElectronApplication[] = []
const directories: string[] = []

const readTabs = (page: Page): Promise<TabSnapshot[]> => page.evaluate(() => {
  const root = document.querySelector('#app') as Element & {
    __vue_app__: { config: { globalProperties: {
      $pinia: { _s: Map<string, { tabs: TabSnapshot[] }> }
    } } }
  }
  const editor = root.__vue_app__.config.globalProperties.$pinia._s.get('editor')
  if (!editor) throw new Error('Editor store is unavailable')
  return editor.tabs
    .map(({ pathname, markdown, isSaved }) => ({ pathname, markdown, isSaved }))
})

const snapshots = (profile: string): TabSnapshot[] => {
  const pathname = join(profile, 'state', 'application-state.json')
  if (!existsSync(pathname)) return []
  const state = JSON.parse(readFileSync(pathname, 'utf8'))
  return state.session.windows.flatMap((window: { id: string; documents: Array<{ id: string; title: string; resource: { kind: string; location?: { path: string } }; content: { kind: string } }> }) => window.documents.flatMap(document => {
    const record = join(profile, 'recovery', window.id, `${document.id}.json`)
    if (!existsSync(record)) return []
    const value = JSON.parse(readFileSync(record, 'utf8'))
    return value.status === 'dirty' ? [{ pathname: document.resource.location?.path ?? '', markdown: value.markdown, isSaved: false }] : []
  }))
}

const mockDialogs = async(app: ElectronApplication, response: number, savePath: string, cancelSave = false): Promise<void> => {
  await app.evaluate(({ dialog }, options) => {
    const state: CloseDialogs = { ...options, buttons: [], saveCalls: 0 }
    ;(globalThis as unknown as { closeDialogs: CloseDialogs }).closeDialogs = state
    dialog.showMessageBox = async(windowOrOptions: Electron.BaseWindow | Electron.MessageBoxOptions, options?: Electron.MessageBoxOptions) => {
      const message = options ?? windowOrOptions as Electron.MessageBoxOptions
      state.buttons.push(message.buttons ?? [])
      return { response: state.response, checkboxChecked: false }
    }
    dialog.showSaveDialog = async() => {
      state.saveCalls++
      return { canceled: state.cancelSave, filePath: state.cancelSave ? '' : state.savePath }
    }
  }, { response, savePath, cancelSave })
}

const closeWindow = async(app: ElectronApplication): Promise<void> => {
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].close() })
}

const setup = async(draft: boolean) => {
  const directory = mkdtempSync(join(tmpdir(), 'marktext-5596-'))
  directories.push(directory)
  const filePath = join(directory, 'existing.md')
  const savePath = draft ? join(directory, 'saved-draft.md') : filePath
  writeFileSync(filePath, original)
  const { app, page } = await launchElectron(draft ? [] : [filePath], { windowLayout: { showTabBar: true },
    preferences: { language: 'en', autoSave: false, startUpAction: 'restoreAll', defaultOpenMode: 'edit',}
  })
  apps.push(app)
  await waitForEditor(page)
  const profile = await app.evaluate(({ app }) => app.getPath('userData'))
  await typeIntoEditor(page, changed)
  await expect(page.locator('.tabs-container > li.unsaved')).toHaveCount(1)
  const expectedMarkdown = (await readTabs(page))[0].markdown
  return { app, page, filePath, savePath, profile, expectedMarkdown }
}

const restart = async(profile: string): Promise<{ app: ElectronApplication; page: Page }> => {
  const projectRoot = resolve(__dirname, '../..')
  const app = await _electron.launch({
    executablePath: getElectronPath(),
    args: [projectRoot, '--user-data-dir', profile],
    cwd: projectRoot
  })
  apps.push(app)
  const page = await app.firstWindow()
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => {
    const root = document.querySelector('#app') as Element & {
      __vue_app__?: { config: { globalProperties: { $pinia: { _s: Map<string, unknown> } } } }
    }
    return root?.__vue_app__?.config.globalProperties.$pinia._s.has('editor')
  })
  return { app, page }
}

test.afterEach(async() => {
  for (const app of apps.splice(0)) {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close().catch(() => {})
  }
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

for (const draft of [false, true]) {
  for (const response of [0, 1, 2]) {
    const choice = ['save', 'discard', 'cancel'][response]
    test(`restoreAll: ${choice} when closing an ${draft ? 'untitled draft' : 'existing file'}`, async() => {
      const { app, page, filePath, savePath, profile, expectedMarkdown } = await setup(draft)
      await mockDialogs(app, response, savePath)

      if (response === 2) {
        await closeWindow(app)
        await expect.poll(() => app.evaluate(() =>
          (globalThis as unknown as { closeDialogs: CloseDialogs }).closeDialogs.buttons
        )).toEqual([['Save', "Don't Save", 'Cancel']])
        expect(page.isClosed()).toBe(false)
        expect((await readTabs(page))[0]).toMatchObject({ markdown: expectedMarkdown, isSaved: false })
        expect(readFileSync(filePath, 'utf8')).toBe(original)
        expect(snapshots(profile).some(tab => tab.markdown === expectedMarkdown)).toBe(true)
        return
      }

      const closed = page.waitForEvent('close')
      await closeWindow(app)
      await closed
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {})

      if (response === 0) {
        expect(readFileSync(savePath, 'utf8')).toBe(expectedMarkdown)
        const restored = await restart(profile)
        await expect.poll(() => readTabs(restored.page)).toContainEqual(
          expect.objectContaining({ pathname: savePath, markdown: expectedMarkdown, isSaved: true })
        )
      } else {
        expect(readFileSync(filePath, 'utf8')).toBe(original)
        if (draft) expect(existsSync(savePath)).toBe(false)
        expect(snapshots(profile).some(tab => tab.markdown === expectedMarkdown)).toBe(false)
        const restored = await restart(profile)
        expect((await readTabs(restored.page)).some(tab => tab.markdown === expectedMarkdown)).toBe(false)
      }
    })
  }
}

test('canceling Save As keeps an untitled draft open', async() => {
  const { app, page, savePath, expectedMarkdown } = await setup(true)
  await mockDialogs(app, 0, savePath, true)
  await closeWindow(app)

  await expect.poll(() => app.evaluate(() =>
    (globalThis as unknown as { closeDialogs: CloseDialogs }).closeDialogs.saveCalls
  )).toBe(1)
  expect(page.isClosed()).toBe(false)
  expect((await readTabs(page))[0]).toMatchObject({ pathname: '', markdown: expectedMarkdown, isSaved: false })
  expect(existsSync(savePath)).toBe(false)
})

test('a failed save leaves the modified document and window open', async() => {
  const { app, page, filePath, savePath } = await setup(false)
  await setSourceMarkdown(page, app, 'Unrepresentable emoji \u{1f600}\n')
  await page.evaluate(() => {
    const root = document.querySelector('#app') as Element & {
      __vue_app__: { config: { globalProperties: {
        $pinia: { _s: Map<string, { currentFile: { encoding: { encoding: string; isBom: boolean } } }> }
      } } }
    }
    const editor = root.__vue_app__.config.globalProperties.$pinia._s.get('editor')
    if (!editor) throw new Error('Editor store is unavailable')
    editor.currentFile.encoding = {
      encoding: 'ascii', isBom: false
    }
  })
  await mockDialogs(app, 0, savePath)
  await closeWindow(app)

  await expect(page.locator('.editor-notifications')).toContainText(/encod|represent/i)
  expect(page.isClosed()).toBe(false)
  expect(readFileSync(filePath, 'utf8')).toBe(original)
  expect((await readTabs(page))[0]).toMatchObject({ isSaved: false })
  expect((await readTabs(page))[0].markdown).toContain('\u{1f600}')
})

test('quitting from source mode requests confirmation and Cancel preserves the edits', async() => {
  const { app, page, filePath, savePath } = await setup(false)
  await setSourceMarkdown(page, app, 'Source edit before quitting\n')
  await enterSourceMode(page, app)
  await mockDialogs(app, 2, savePath)
  await app.evaluate(({ app }) => { app.quit() })

  await expect.poll(() => app.evaluate(() =>
    (globalThis as unknown as { closeDialogs: CloseDialogs }).closeDialogs.buttons.length
  )).toBe(1)
  expect(page.isClosed()).toBe(false)
  expect((await readTabs(page))[0].markdown).toContain('Source edit before quitting')
  expect(readFileSync(filePath, 'utf8')).toBe(original)
})
