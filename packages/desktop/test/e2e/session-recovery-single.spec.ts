import { test, expect } from '@playwright/test'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  existsSync,
  readdirSync,
  renameSync,
  mkdirSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ElectronApplication } from 'playwright'
import {
  launchElectron,
  expectNoRendererErrors,
  sendIpcToRenderer,
  enterSourceMode
} from './helpers'
import { fitWindowGeometry } from '../../src/main/applicationState/windowGeometry'

const stop = async(app: ElectronApplication): Promise<void> => {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  await app.close()
}
test('new recovery host retains an untitled draft after force exit and reuses its window identity', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-e2e-'))
  let running: ElectronApplication | null = null
  try {
    const first = await launchElectron([], {
      userDataDir: directory,
      preferences: { language: 'en' },
      env: { MARKTEXT_SESSION_RECOVERY: '1' },
      suppressErrorDialog: true
    })
    running = first.app
    await first.page
      .getByRole('textbox', { name: 'Document', exact: true })
      .fill('Unsaved recovery draft')
    const statePath = join(directory, 'state', 'application-state.json')
    await expect.poll(() => existsSync(statePath)).toBe(true)
    const readState = () => JSON.parse(readFileSync(statePath, 'utf8'))
    await expect
      .poll(() => readState().session.windows[0]?.documents[0]?.content.kind)
      .toBe('recovery')
    const windowId = readState().session.windows[0].id
    await expectNoRendererErrors(first.app)
    await stop(first.app)
    running = null
    const restored = await launchElectron([], {
      userDataDir: directory,
      env: { MARKTEXT_SESSION_RECOVERY: '1' },
      suppressErrorDialog: true
    })
    running = restored.app
    await expect(
      restored.page.getByRole('textbox', { name: 'Document', exact: true })
    ).toContainText('Unsaved recovery draft')
    expect(readState().session.windows).toHaveLength(1)
    expect(readState().session.windows[0].id).toBe(windowId)
    await expectNoRendererErrors(restored.app)
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('a completed save cleans recovery contents and restores an ordinary saved file after close', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-saved-close-'))
  const destination = join(directory, 'saved.md')
  let running: ElectronApplication | null = null
  try {
    const { app, page } = await launchElectron([], {
      userDataDir: directory,
      preferences: { language: 'en' },
      env: { MARKTEXT_SESSION_RECOVERY: '1' },
      suppressErrorDialog: true
    })
    running = app
    await page.getByRole('textbox', { name: 'Document', exact: true }).fill('Saved before closing')
    await app.evaluate(({ dialog }, destination) => {
      dialog.showMessageBox = async() => ({ response: 0, checkboxChecked: false })
      dialog.showSaveDialog = async() => ({ canceled: false, filePath: destination })
    }, destination)
    const closed = page.waitForEvent('close')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
    await closed
    expect(readFileSync(destination, 'utf8').trim()).toBe('Saved before closing')
    const state = JSON.parse(
      readFileSync(join(directory, 'state', 'application-state.json'), 'utf8')
    )
    expect(state.session.lastWindow.documents[0].content.kind).toBe('disk')
    expect(
      readdirSync(join(directory, 'recovery'), { recursive: true }).filter((name) =>
        String(name).endsWith('.json')
      )
    ).toEqual([])
    await stop(app)
    running = null
    const restored = await launchElectron([], {
      userDataDir: directory,
      env: { MARKTEXT_SESSION_RECOVERY: '1' },
      suppressErrorDialog: true
    })
    running = restored.app
    await expect(
      restored.page.getByRole('textbox', { name: 'Document', exact: true })
    ).toContainText('Saved before closing')
    await expectNoRendererErrors(restored.app)
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('renderer reload restores the live document without the legacy blank bootstrap', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-renderer-reload-'))
  const { app, page } = await launchElectron([], {
    userDataDir: directory,
    preferences: { language: 'en' },
    env: { MARKTEXT_SESSION_RECOVERY: '1' },
    suppressErrorDialog: true
  })
  try {
    await page.getByRole('textbox', { name: 'Document', exact: true }).fill('Live renderer text')
    const statePath = join(directory, 'state', 'application-state.json')
    await expect
      .poll(
        () =>
          JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0].documents[0].content.kind
      )
      .toBe('recovery')
    const before = JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0]
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].reload())
    await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toContainText(
      'Live renderer text'
    )
    await expect
      .poll(() =>
        JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0].documents.map(
          (document: { id: string }) => document.id
        )
      )
      .toEqual([before.documents[0].id])
    expect(JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0].id).toBe(before.id)
    await expectNoRendererErrors(app)
  } finally {
    await stop(app)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('damaged metadata and stale legacy snapshots do not block editing or get overwritten', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-damaged-'))
  const legacy = JSON.stringify({
    version: 3,
    tabs: [{ markdown: 'Old legacy body', isSaved: false }],
    layout: {}
  })
  const { app, page } = await launchElectron([], {
    userDataDir: directory,
    preferences: { language: 'en' },
    env: { MARKTEXT_SESSION_RECOVERY: '1' },
    suppressErrorDialog: true,
    userDataFiles: {
      'state/application-state.json': '{damaged',
      'editorStates/stale_editor_buffer_store.json': legacy
    }
  })
  try {
    await page.getByRole('textbox', { name: 'Document', exact: true }).fill('Still editable')
    await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toContainText(
      'Still editable'
    )
    expect(readFileSync(join(directory, 'state', 'application-state.json'), 'utf8')).toBe(
      '{damaged'
    )
    expect(
      readFileSync(join(directory, 'editorStates', 'stale_editor_buffer_store.json'), 'utf8')
    ).toBe(legacy)
    expect(readdirSync(join(directory, 'editorStates'))).toEqual(['stale_editor_buffer_store.json'])
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
    await expectNoRendererErrors(app)
  } finally {
    await stop(app)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('failed metadata replacement keeps the window and its text, then permits a successful retry', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-write-failure-'))
  const { app, page } = await launchElectron([], {
    userDataDir: directory,
    preferences: { language: 'en' },
    env: { MARKTEXT_SESSION_RECOVERY: '1' },
    suppressErrorDialog: true
  })
  try {
    const editor = page.getByRole('textbox', { name: 'Document', exact: true })
    await editor.fill('Before write failure')
    const statePath = join(directory, 'state', 'application-state.json')
    await expect
      .poll(
        () =>
          JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0].documents[0].content.kind
      )
      .toBe('recovery')
    renameSync(statePath, `${statePath}.previous`)
    mkdirSync(statePath)
    writeFileSync(join(statePath, 'block-replacement'), 'keep')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
    await expect(
      page.getByText('Keep this window open and save your documents before quitting.')
    ).toBeVisible()
    expect(page.isClosed()).toBe(false)
    await expect(editor).toContainText('Before write failure')
    rmSync(statePath, { recursive: true })
    renameSync(`${statePath}.previous`, statePath)
    await editor.fill('After retry')
    await expect
      .poll(() => {
        const state = JSON.parse(readFileSync(statePath, 'utf8'))
        const window = state.session.windows[0]
        const document = window.documents[0]
        return JSON.parse(
          readFileSync(join(directory, 'recovery', window.id, `${document.id}.json`), 'utf8')
        ).markdown.trim()
      })
      .toBe('After retry')
    await expectNoRendererErrors(app)
  } finally {
    await stop(app)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Save As writes the captured version while newer typing remains recoverable and unsaved', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-save-'))
  const destination = join(directory, 'saved.md')
  const { app, page } = await launchElectron([], {
    userDataDir: directory,
    preferences: { language: 'en' },
    env: { MARKTEXT_SESSION_RECOVERY: '1' },
    suppressErrorDialog: true
  })
  try {
    const editor = page.getByRole('textbox', { name: 'Document', exact: true })
    await editor.fill('Saved version')
    await app.evaluate(({ dialog }) => {
      const state = globalThis as unknown as {
        saveWaiting: boolean
        finishSave?: (value: Electron.SaveDialogReturnValue) => void
      }
      dialog.showSaveDialog = async() =>
        new Promise((resolve) => {
          state.saveWaiting = true
          state.finishSave = resolve
        })
    })
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect
      .poll(() =>
        app.evaluate(() => (globalThis as unknown as { saveWaiting?: boolean }).saveWaiting)
      )
      .toBe(true)
    await editor.fill('Newer typing')
    await app.evaluate(
      (_electron, destination) =>
        (
          globalThis as unknown as { finishSave: (value: Electron.SaveDialogReturnValue) => void }
        ).finishSave({ canceled: false, filePath: destination }),
      destination
    )
    await expect
      .poll(() => (existsSync(destination) ? readFileSync(destination, 'utf8').trim() : ''))
      .toBe('Saved version')
    const statePath = join(directory, 'state', 'application-state.json')
    await expect
      .poll(
        () =>
          JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0]?.documents[0]?.content.kind
      )
      .toBe('recovery')
    await expect(editor).toContainText('Newer typing')
    const state = JSON.parse(readFileSync(statePath, 'utf8'))
    const window = state.session.windows[0]
    const document = window.documents[0]
    await expect
      .poll(() =>
        JSON.parse(
          readFileSync(join(directory, 'recovery', window.id, `${document.id}.json`), 'utf8')
        ).markdown.trim()
      )
      .toBe('Newer typing')
    expect(document.resource.location.path).toBe(destination)
    await expectNoRendererErrors(app)
  } finally {
    await stop(app)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('cancel keeps an unsaved window and discard commits removal without reviving its text', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-close-'))
  const { app, page } = await launchElectron([], {
    userDataDir: directory,
    preferences: { language: 'en' },
    env: { MARKTEXT_SESSION_RECOVERY: '1' },
    suppressErrorDialog: true
  })
  try {
    await page.getByRole('textbox', { name: 'Document', exact: true }).fill('Discard this draft')
    await app.evaluate(({ dialog }) => {
      const state = globalThis as unknown as { closeChoice: number; closePrompts: number }
      state.closeChoice = 2
      state.closePrompts = 0
      dialog.showMessageBox = async() => {
        state.closePrompts++
        return { response: state.closeChoice, checkboxChecked: false }
      }
    })
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
    await expect
      .poll(() =>
        app.evaluate(() => (globalThis as unknown as { closePrompts: number }).closePrompts)
      )
      .toBe(1)
    expect(page.isClosed()).toBe(false)
    await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toContainText(
      'Discard this draft'
    )
    await app.evaluate(() => {
      ;(globalThis as unknown as { closeChoice: number }).closeChoice = 1
    })
    const closed = page.waitForEvent('close')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
    await closed
    const state = JSON.parse(
      readFileSync(join(directory, 'state', 'application-state.json'), 'utf8')
    )
    expect(state.session.windows).toEqual([])
    expect(state.session.lastWindow.documents).toEqual([])
    const recoveryFiles = readdirSync(join(directory, 'recovery'), { recursive: true }).filter(
      (name) => String(name).endsWith('.json')
    )
    expect(recoveryFiles).toEqual([])
  } finally {
    await stop(app)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('layout, native geometry and source reading selection survive a full restart', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-views-'))
  const pathname = join(directory, 'reading.md')
  writeFileSync(
    pathname,
    Array.from({ length: 120 }, (_, index) => `Line ${index} with reading content`).join('\n')
  )
  let running: ElectronApplication | null = null
  try {
    const first = await launchElectron([pathname], {
      userDataDir: directory,
      preferences: { language: 'en' },
      env: { MARKTEXT_SESSION_RECOVERY: '1' },
      suppressErrorDialog: true
    })
    running = first.app
    await enterSourceMode(first.page, first.app)
    await sendIpcToRenderer(first.app, 'mt::toggle-view-mode-entry', 'focus')
    await sendIpcToRenderer(first.app, 'mt::toggle-view-mode-entry', 'typewriter')
    await first.page.evaluate(() => {
      const root = document.querySelector('#app') as Element & {
        __vue_app__: {
          config: {
            globalProperties: {
              $pinia: {
                _s: Map<
                  string,
                  {
                    SET_LAYOUT(value: unknown): void
                    SET_OUTLINE_WIDTH(value: number): void
                    SET_OPENED_FILES(value: unknown): void
                  }
                >
              }
            }
          }
        }
      }
      const layout = root.__vue_app__.config.globalProperties.$pinia._s.get('layout')!
      layout.SET_LAYOUT({ showSideBar: true, rightColumn: 'search', showTabBar: true })
      layout.SET_OUTLINE_WIDTH(310)
      layout.SET_OPENED_FILES({ expanded: false, preferredHeightPx: 250 })
      const cm = (
        document.querySelector('.source-code .CodeMirror') as Element & {
          CodeMirror: {
            setSelection(a: unknown, b: unknown): void
            scrollTo(x: null, y: number): void
          }
        }
      ).CodeMirror
      cm.setSelection({ line: 50, ch: 5 }, { line: 48, ch: 2 })
      cm.scrollTo(null, 180)
    })
    await first.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setBounds({ x: 50, y: 60, width: 1080, height: 760 })
    )
    const statePath = join(directory, 'state', 'application-state.json')
    await expect
      .poll(
        () =>
          JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0].documents[0].view
            ?.sourceSelection
      )
      .toEqual({ anchor: { line: 50, ch: 5 }, focus: { line: 48, ch: 2 } })
    await expect
      .poll(() => JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0].layout.modes)
      .toEqual({ sourceCode: true, focus: true, typewriter: true })
    const snapshot = JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0]
    const environment = await first.app.evaluate(({ screen }) => ({
      displays: screen
        .getAllDisplays()
        .map((display) => ({ id: String(display.id), workArea: display.workArea })),
      primary: String(screen.getPrimaryDisplay().id)
    }))
    const expectedGeometry = fitWindowGeometry(
      snapshot.geometry,
      environment.displays,
      environment.primary
    )
    await stop(first.app)
    running = null
    const restored = await launchElectron([], {
      userDataDir: directory,
      env: { MARKTEXT_SESSION_RECOVERY: '1' },
      suppressErrorDialog: true
    })
    running = restored.app
    await expect(restored.page.locator('.source-code .CodeMirror')).toBeVisible()
    await expect
      .poll(() =>
        restored.page.evaluate(() => {
          const cm = (
            document.querySelector('.source-code .CodeMirror') as Element & {
              CodeMirror: { getCursor(which: string): { line: number; ch: number } }
            }
          ).CodeMirror
          return { anchor: cm.getCursor('anchor'), focus: cm.getCursor('head') }
        })
      )
      .toEqual({ anchor: { line: 50, ch: 5 }, focus: { line: 48, ch: 2 } })
    const layout = await restored.page.evaluate(() => {
      const root = document.querySelector('#app') as Element & {
        __vue_app__: {
          config: {
            globalProperties: { $pinia: { _s: Map<string, { CAPTURE_WINDOW_LAYOUT(): unknown }> } }
          }
        }
      }
      return root.__vue_app__.config.globalProperties.$pinia._s
        .get('layout')!
        .CAPTURE_WINDOW_LAYOUT()
    })
    expect(layout).toEqual(snapshot.layout)
    expect(
      await restored.app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].getNormalBounds()
      )
    ).toEqual(expectedGeometry.normalBounds)
    await expectNoRendererErrors(restored.app)
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('workspace folds are applied again as folders are rebuilt after restart', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-tree-'))
  const folder = join(directory, 'workspace')
  mkdirSync(join(folder, 'notes'), { recursive: true })
  writeFileSync(join(folder, 'notes', 'child.md'), 'Child')
  let running: ElectronApplication | null = null
  try {
    const first = await launchElectron([folder, join(folder, 'notes', 'child.md')], {
      userDataDir: directory,
      preferences: { language: 'en' },
      env: { MARKTEXT_SESSION_RECOVERY: '1' },
      suppressErrorDialog: true
    })
    running = first.app
    await sendIpcToRenderer(first.app, 'mt::set-view-layout', {
      showSideBar: true,
      rightColumn: 'files'
    })
    const fold = () =>
      first.page.evaluate(() => {
        const root = document.querySelector('#app') as Element & {
          __vue_app__: {
            config: {
              globalProperties: {
                $pinia: {
                  _s: Map<
                    string,
                    {
                      roots: Array<{
                        tree: { folders: Array<{ name: string; isCollapsed: boolean }> }
                      }>
                      SET_FOLDER_COLLAPSED(folder: unknown, collapsed: boolean): void
                    }
                  >
                }
              }
            }
          }
        }
        const project = root.__vue_app__.config.globalProperties.$pinia._s.get('project')!
        const folder = project.roots[0]?.tree.folders.find((folder) => folder.name === 'notes')
        if (!folder) return false
        project.SET_FOLDER_COLLAPSED(folder, true)
        const layout = root.__vue_app__.config.globalProperties.$pinia._s.get(
          'layout'
        ) as unknown as { SET_OPENED_FILES(value: { expanded: boolean }): void }
        layout.SET_OPENED_FILES({ expanded: false })
        return true
      })
    await expect.poll(fold).toBe(true)
    const statePath = join(directory, 'state', 'application-state.json')
    await expect
      .poll(
        () =>
          JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0].projectView.roots[0]
            ?.collapsedPaths
      )
      .toContain('notes')
    await stop(first.app)
    running = null
    const restored = await launchElectron([], {
      userDataDir: directory,
      env: { MARKTEXT_SESSION_RECOVERY: '1' },
      suppressErrorDialog: true
    })
    running = restored.app
    await expect
      .poll(() =>
        restored.page.evaluate(() => {
          const root = document.querySelector('#app') as Element & {
            __vue_app__: {
              config: {
                globalProperties: {
                  $pinia: {
                    _s: Map<
                      string,
                      {
                        roots: Array<{
                          tree: { folders: Array<{ name: string; isCollapsed: boolean }> }
                        }>
                      }
                    >
                  }
                }
              }
            }
          }
          return root.__vue_app__.config.globalProperties.$pinia._s
            .get('project')
            ?.roots[0]?.tree.folders.find((folder) => folder.name === 'notes')?.isCollapsed
        })
      )
      .toBe(true)
    await expect(restored.page.locator('.opened-files-list')).toBeHidden()
    await expectNoRendererErrors(restored.app)
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('renaming a dirty document retains its identity and saves to the authoritative new path', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-rename-'))
  const source = join(directory, 'original.md')
  const destination = join(directory, 'renamed.md')
  writeFileSync(source, 'Original on disk')
  const { app, page } = await launchElectron([source], {
    userDataDir: directory,
    preferences: { language: 'en' },
    env: { MARKTEXT_SESSION_RECOVERY: '1' },
    suppressErrorDialog: true
  })
  try {
    await page.getByRole('textbox', { name: 'Document', exact: true }).fill('Renamed unsaved text')
    const statePath = join(directory, 'state', 'application-state.json')
    const before = JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0]
    const id = before.documents[0].id
    await page.evaluate(
      ({ id, destination }) =>
        window.electron.ipcRenderer.send('mt::rename', {
          id,
          pathname: '/untrusted-old-path.md',
          newPathname: destination
        }),
      { id, destination }
    )
    await expect.poll(() => existsSync(destination)).toBe(true)
    expect(existsSync(source)).toBe(false)
    await expect
      .poll(
        () =>
          JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0].documents[0].resource
            .location.path
      )
      .toBe(destination)
    expect(JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0].documents[0].id).toBe(id)
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect.poll(() => readFileSync(destination, 'utf8').trim()).toBe('Renamed unsaved text')
    await expect
      .poll(
        () =>
          JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0].documents[0].content.kind
      )
      .toBe('disk')
    expect(existsSync(source)).toBe(false)
    await expectNoRendererErrors(app)
  } finally {
    await stop(app)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('a pending Save As cannot write after the document is locked for reading', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-save-lock-'))
  const source = join(directory, 'original.md')
  const destination = join(directory, 'must-not-write.md')
  writeFileSync(source, 'Original on disk')
  const { app, page } = await launchElectron([source], {
    userDataDir: directory,
    preferences: { language: 'en' },
    env: { MARKTEXT_SESSION_RECOVERY: '1' },
    suppressErrorDialog: true
  })
  try {
    await page
      .getByRole('textbox', { name: 'Document', exact: true })
      .fill('Unsaved before reading')
    await app.evaluate(({ dialog }) => {
      const state = globalThis as unknown as {
        saveWaiting: boolean
        finishSave?: (value: Electron.SaveDialogReturnValue) => void
      }
      dialog.showSaveDialog = async() =>
        new Promise((resolve) => {
          state.saveWaiting = true
          state.finishSave = resolve
        })
    })
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save-as')
    await expect
      .poll(() =>
        app.evaluate(() => (globalThis as unknown as { saveWaiting?: boolean }).saveWaiting)
      )
      .toBe(true)
    await page.evaluate(async() => {
      const root = document.querySelector('#app') as Element & {
        __vue_app__: {
          config: {
            globalProperties: {
              $pinia: {
                _s: Map<
                  string,
                  {
                    currentFile: { id: string }
                    SET_READ_ONLY(id: string, value: boolean): Promise<void>
                  }
                >
              }
            }
          }
        }
      }
      const editor = root.__vue_app__.config.globalProperties.$pinia._s.get('editor')!
      await editor.SET_READ_ONLY(editor.currentFile.id, true)
    })
    await app.evaluate(
      (_electron, destination) =>
        (
          globalThis as unknown as { finishSave: (value: Electron.SaveDialogReturnValue) => void }
        ).finishSave({ canceled: false, filePath: destination }),
      destination
    )
    await expect(
      page.getByText('Keep this window open and save your documents before quitting.')
    ).toBeVisible()
    expect(existsSync(destination)).toBe(false)
    expect(readFileSync(source, 'utf8')).toBe('Original on disk')
    await expectNoRendererErrors(app)
  } finally {
    await stop(app)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('external reload stays clean and deleting the disk file retains recoverable text', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-external-'))
  const source = join(directory, 'watched.md')
  writeFileSync(source, 'Original on disk')
  const { app, page } = await launchElectron([source], {
    userDataDir: directory,
    preferences: { language: 'en' },
    env: { MARKTEXT_SESSION_RECOVERY: '1' },
    suppressErrorDialog: true
  })
  try {
    const editor = page.getByRole('textbox', { name: 'Document', exact: true })
    await expect(editor).toContainText('Original on disk')
    writeFileSync(source, 'External on disk')
    await expect(editor).toContainText('External on disk')
    const statePath = join(directory, 'state', 'application-state.json')
    const readWindow = () => JSON.parse(readFileSync(statePath, 'utf8')).session.windows[0]
    await expect.poll(() => readWindow().documents[0].content.kind).toBe('disk')
    rmSync(source)
    await expect.poll(() => readWindow().documents[0].content.kind).toBe('recovery')
    const snapshot = readWindow()
    const record = JSON.parse(
      readFileSync(
        join(directory, 'recovery', snapshot.id, `${snapshot.documents[0].id}.json`),
        'utf8'
      )
    )
    expect(record.markdown.trim()).toBe('External on disk')
    await expect(editor).toContainText('External on disk')
    await expectNoRendererErrors(app)
  } finally {
    await stop(app)
    rmSync(directory, { recursive: true, force: true })
  }
})
