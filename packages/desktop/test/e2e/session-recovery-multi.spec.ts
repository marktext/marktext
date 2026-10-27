import { test, expect } from '@playwright/test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchElectron,
  getMarkdownContent,
  expectNoRendererErrors,
  sendIpcToRenderer
} from './helpers'

const stop = async(app: ElectronApplication): Promise<void> => {
  await app.close()
}
const state = (directory: string) =>
  JSON.parse(readFileSync(join(directory, 'state', 'application-state.json'), 'utf8'))
const createWindow = async(app: ElectronApplication): Promise<Page> => {
  const next = app.waitForEvent('window')
  await app.evaluate(({ ipcMain }) => ipcMain.emit('app-create-editor-window'))
  const page = await next
  await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toBeVisible()
  return page
}

test('restoreAll restores exactly the live manifest windows with independent drafts', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-multi-'))
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
      .fill('First independent draft')
    const second = await createWindow(first.app)
    await second
      .getByRole('textbox', { name: 'Document', exact: true })
      .fill('Second independent draft')
    await expect
      .poll(
        () =>
          state(directory).session.windows.filter(
            (window: { documents: Array<{ content: { kind: string } }> }) =>
              window.documents.some((document) => document.content.kind === 'recovery')
          ).length
      )
      .toBe(2)
    const before = state(directory)
      .session.windows.map((window: { id: string }) => window.id)
      .sort()
    await stop(first.app)
    running = null
    const restored = await launchElectron([], {
      userDataDir: directory,
      env: { MARKTEXT_SESSION_RECOVERY: '1' },
      suppressErrorDialog: true
    })
    running = restored.app
    await expect.poll(() => restored.app.windows().length).toBe(2)
    const text = await Promise.all(
      restored.app
        .windows()
        .map((page) => page.getByRole('textbox', { name: 'Document', exact: true }).innerText())
    )
    expect(text.map((value) => value.trim()).sort()).toEqual([
      'First independent draft',
      'Second independent draft'
    ])
    expect(
      state(directory)
        .session.windows.map((window: { id: string }) => window.id)
        .sort()
    ).toEqual(before)
    await expectNoRendererErrors(restored.app)
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('a canceled application quit keeps every window and does not discard earlier decisions', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-quit-cancel-'))
  const first = await launchElectron([], {
    userDataDir: directory,
    preferences: { language: 'en' },
    env: { MARKTEXT_SESSION_RECOVERY: '1' },
    suppressErrorDialog: true
  })
  try {
    await first.page.getByRole('textbox', { name: 'Document', exact: true }).fill('Keep first')
    const second = await createWindow(first.app)
    await second.getByRole('textbox', { name: 'Document', exact: true }).fill('Keep second')
    await first.app.evaluate(({ dialog, app }) => {
      const global = globalThis as unknown as { choices: number }
      global.choices = 0
      dialog.showMessageBox = async() => ({
        response: ++global.choices === 1 ? 1 : 2,
        checkboxChecked: false
      })
      app.quit()
    })
    await expect
      .poll(() => first.app.evaluate(() => (globalThis as unknown as { choices: number }).choices))
      .toBe(2)
    expect(first.app.windows()).toHaveLength(2)
    expect(
      state(directory).session.windows.every(
        (window: { documents: Array<{ content: { kind: string } }> }) =>
          window.documents.some((document) => document.content.kind === 'recovery')
      )
    ).toBe(true)
    await expect(first.page.getByRole('textbox', { name: 'Document', exact: true })).toContainText(
      'Keep first'
    )
    await expect(second.getByRole('textbox', { name: 'Document', exact: true })).toContainText(
      'Keep second'
    )
    await expectNoRendererErrors(first.app)
  } finally {
    await stop(first.app)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('reopening a recent workspace uses fresh identities and never copies its unsaved draft', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-workspace-'))
  const folder = join(directory, 'workspace')
  mkdirSync(folder)
  const file = join(folder, 'saved.md')
  writeFileSync(file, 'Disk content')
  let running: ElectronApplication | null = null
  try {
    const first = await launchElectron([folder, file], {
      userDataDir: directory,
      preferences: { language: 'en' },
      env: { MARKTEXT_SESSION_RECOVERY: '1' },
      suppressErrorDialog: true
    })
    running = first.app
    await first.page
      .getByRole('textbox', { name: 'Document', exact: true })
      .fill('Unsaved workspace edits')
    await expect.poll(() => state(directory).recentWorkspaces.length).toBe(1)
    await expect
      .poll(() => state(directory).session.windows[0].documents[0].content.kind)
      .toBe('recovery')
    const before = state(directory).session.windows[0]
    await first.page.evaluate(async() => {
      await window.electron.ipcRenderer.invoke('mt::preferences::update', {
        startUpAction: 'openLastFolder'
      })
    })
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
    ).toContainText('Disk content')
    const after = state(directory).session.windows[0]
    expect(after.id).not.toBe(before.id)
    expect(after.documents[0].id).not.toBe(before.documents[0].id)
    expect(after.workspace.id).toBe(before.workspace.id)
    expect(
      readFileSync(join(directory, 'recovery', before.id, `${before.documents[0].id}.json`), 'utf8')
    ).toContain('Unsaved workspace edits')
    await expectNoRendererErrors(restored.app)
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('a successful application quit saves all windows and restores their membership', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-quit-all-'))
  let running: ElectronApplication | null = null
  try {
    const first = await launchElectron([], {
      userDataDir: directory,
      preferences: { language: 'en' },
      suppressErrorDialog: true
    })
    running = first.app
    await first.page
      .getByRole('textbox', { name: 'Document', exact: true })
      .fill('First saved on quit')
    const second = await createWindow(first.app)
    await second
      .getByRole('textbox', { name: 'Document', exact: true })
      .fill('Second saved on quit')
    await first.app.evaluate(({ dialog }, directory) => {
      let saves = 0
      dialog.showMessageBox = async() => ({ response: 0, checkboxChecked: false })
      dialog.showSaveDialog = async() => ({
        canceled: false,
        filePath: `${directory}/saved-${++saves}.md`
      })
    }, directory)
    const closed = first.app.waitForEvent('close')
    await first.app.evaluate(({ app }) => app.quit())
    await closed
    running = null
    const before = state(directory)
    expect(before.session.lifecycle).toBe('closed')
    expect(before.session.windows).toHaveLength(2)
    expect(readFileSync(join(directory, 'saved-1.md'), 'utf8').trim()).toBe('First saved on quit')
    expect(readFileSync(join(directory, 'saved-2.md'), 'utf8').trim()).toBe('Second saved on quit')
    const restored = await launchElectron([], { userDataDir: directory, suppressErrorDialog: true })
    running = restored.app
    await expect.poll(() => restored.app.windows().length).toBe(2)
    expect(
      state(directory)
        .session.windows.map((window: { id: string }) => window.id)
        .sort()
    ).toEqual(before.session.windows.map((window: { id: string }) => window.id).sort())
    await expectNoRendererErrors(restored.app)
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('closing one window removes it from restoreAll without reviving discarded content', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-close-one-'))
  let running: ElectronApplication | null = null
  try {
    const first = await launchElectron([], {
      userDataDir: directory,
      preferences: { language: 'en' },
      suppressErrorDialog: true
    })
    running = first.app
    await first.page.getByRole('textbox', { name: 'Document', exact: true }).fill('Discard first')
    const second = await createWindow(first.app)
    await second.getByRole('textbox', { name: 'Document', exact: true }).fill('Retain second')
    await first.app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async() => ({ response: 1, checkboxChecked: false })
    })
    const closed = first.page.waitForEvent('close')
    const native = await first.app.browserWindow(first.page)
    await native.evaluate((window) => window.close())
    await closed
    await expect.poll(() => state(directory).session.windows.length).toBe(1)
    await expect
      .poll(() => state(directory).session.windows[0].documents[0].content.kind)
      .toBe('recovery')
    await stop(first.app)
    running = null
    const restored = await launchElectron([], { userDataDir: directory, suppressErrorDialog: true })
    running = restored.app
    await expect(
      restored.page.getByRole('textbox', { name: 'Document', exact: true })
    ).toContainText('Retain second')
    expect(restored.app.windows()).toHaveLength(1)
    await expectNoRendererErrors(restored.app)
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('stale ordinary-file windows collapse to one blank fallback and an explicit file wins over recovery', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-stale-'))
  const firstPath = join(directory, 'first.md')
  const secondPath = join(directory, 'second.md')
  const explicitPath = join(directory, 'explicit.md')
  writeFileSync(firstPath, 'First disk file')
  writeFileSync(secondPath, 'Second disk file')
  writeFileSync(explicitPath, 'Explicit requested file')
  let running: ElectronApplication | null = null
  try {
    const first = await launchElectron([firstPath], {
      userDataDir: directory,
      preferences: { language: 'en' },
      suppressErrorDialog: true
    })
    running = first.app
    const next = first.app.waitForEvent('window')
    await first.app.evaluate(({ app }, pathname) => {
      const argv = ['marktext', '--new-window', pathname]
      app.emit('second-instance', {}, argv, '/', { argv })
    }, secondPath)
    const second = await next
    await expect(second.getByRole('textbox', { name: 'Document', exact: true })).toContainText(
      'Second disk file'
    )
    await stop(first.app)
    running = null
    rmSync(firstPath)
    rmSync(secondPath)
    const blank = await launchElectron([], { userDataDir: directory, suppressErrorDialog: true })
    running = blank.app
    expect(blank.app.windows()).toHaveLength(1)
    expect((await getMarkdownContent(blank.page, blank.app)).trim()).toBe('')
    await blank.page
      .getByRole('textbox', { name: 'Document', exact: true })
      .fill('Retained recovery draft')
    await expect
      .poll(() => state(directory).session.windows[0].documents[0].content.kind)
      .toBe('recovery')
    const previous = state(directory).session.windows[0]
    await stop(blank.app)
    running = null
    const explicit = await launchElectron([explicitPath], {
      userDataDir: directory,
      suppressErrorDialog: true
    })
    running = explicit.app
    await expect(
      explicit.page.getByRole('textbox', { name: 'Document', exact: true })
    ).toContainText('Explicit requested file')
    expect(explicit.app.windows()).toHaveLength(1)
    expect(state(directory).session.windows[0].documents).toHaveLength(1)
    expect(
      readFileSync(
        join(directory, 'recovery', previous.id, `${previous.documents[0].id}.json`),
        'utf8'
      )
    ).toContain('Retained recovery draft')
    await expectNoRendererErrors(explicit.app)
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})

for (const policy of ['restoreLastWindow', 'blank'] as const) {
  test(`${policy} respects its window selection and retains unselected recovery records`, async() => {
    const directory = mkdtempSync(join(tmpdir(), 'mt-session-policy-'))
    let running: ElectronApplication | null = null
    try {
      const first = await launchElectron([], {
        userDataDir: directory,
        preferences: { language: 'en' },
        suppressErrorDialog: true
      })
      running = first.app
      await first.page
        .getByRole('textbox', { name: 'Document', exact: true })
        .fill('First retained draft')
      const second = await createWindow(first.app)
      await second.getByRole('textbox', { name: 'Document', exact: true }).fill('Most recent draft')
      const native = await first.app.browserWindow(second)
      await native.evaluate((window) => window.focus())
      await expect
        .poll(
          () =>
            state(directory).session.windows.filter(
              (window: { documents: Array<{ content: { kind: string } }> }) =>
                window.documents.some((document) => document.content.kind === 'recovery')
            ).length
        )
        .toBe(2)
      const before = state(directory)
      await second.evaluate(async(policy) => {
        await window.electron.ipcRenderer.invoke('mt::preferences::update', {
          startUpAction: policy
        })
      }, policy)
      await stop(first.app)
      running = null
      const restored = await launchElectron([], {
        userDataDir: directory,
        suppressErrorDialog: true
      })
      running = restored.app
      expect(restored.app.windows()).toHaveLength(1)
      if (policy === 'restoreLastWindow') {
        await expect(
          restored.page.getByRole('textbox', { name: 'Document', exact: true })
        ).toContainText('Most recent draft')
        expect(state(directory).session.windows[0].id).toBe(before.session.activeWindowId)
      } else expect((await getMarkdownContent(restored.page, restored.app)).trim()).toBe('')
      for (const window of before.session.windows) {
        expect(
          readFileSync(
            join(directory, 'recovery', window.id, `${window.documents[0].id}.json`),
            'utf8'
          )
        ).toContain('draft')
      }
      await expectNoRendererErrors(restored.app)
    } finally {
      if (running) await stop(running)
      rmSync(directory, { recursive: true, force: true })
    }
  })
}

test('disabling editor and layout restoration skips ordinary tabs but keeps unsaved content', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-options-'))
  const firstPath = join(directory, 'first.md')
  const secondPath = join(directory, 'second.md')
  writeFileSync(firstPath, 'First disk')
  writeFileSync(secondPath, 'Second disk')
  let running: ElectronApplication | null = null
  try {
    const first = await launchElectron([firstPath, secondPath], {
      userDataDir: directory,
      preferences: { language: 'en' },
      suppressErrorDialog: true
    })
    running = first.app
    await first.page
      .getByRole('textbox', { name: 'Document', exact: true })
      .fill('Unsaved content survives options')
    await sendIpcToRenderer(first.app, 'mt::set-view-layout', {
      showSideBar: true,
      showTabBar: true
    })
    await expect
      .poll(() => state(directory).session.windows[0].documents[0].content.kind)
      .toBe('recovery')
    await first.page.evaluate(async() => {
      await window.electron.ipcRenderer.invoke('mt::preferences::update', {
        restoreEditors: false,
        restoreLayoutState: false,
        restoreViewState: false
      })
    })
    await stop(first.app)
    running = null
    const restored = await launchElectron([], { userDataDir: directory, suppressErrorDialog: true })
    running = restored.app
    await expect(
      restored.page.getByRole('textbox', { name: 'Document', exact: true })
    ).toContainText('Unsaved content survives options')
    expect(state(directory).session.windows[0].documents).toHaveLength(1)
    await expect(restored.page.locator('.side-bar')).toBeHidden()
    await expect(restored.page.locator('.editor-tabs')).toBeHidden()
    await expectNoRendererErrors(restored.app)
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('moving a sidebar folder keeps dirty document identity and saves to its new path', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-folder-move-'))
  const root = join(directory, 'workspace')
  const source = join(root, 'old')
  const destination = join(root, 'new')
  mkdirSync(source, { recursive: true })
  writeFileSync(join(source, 'note.md'), 'Original file')
  const { app, page } = await launchElectron([root, join(source, 'note.md')], {
    userDataDir: directory,
    preferences: { language: 'en' },
    suppressErrorDialog: true
  })
  try {
    await page
      .getByRole('textbox', { name: 'Document', exact: true })
      .fill('Edited before moving folder')
    await expect
      .poll(() => state(directory).session.windows[0].documents[0].content.kind)
      .toBe('recovery')
    const id = state(directory).session.windows[0].documents[0].id
    await page.evaluate(
      async({ source, destination }) => {
        await window.fileUtils.move(source, destination)
      },
      { source, destination }
    )
    expect(state(directory).session.windows[0].documents[0].id).toBe(id)
    expect(state(directory).session.windows[0].documents[0].resource.location.path).toBe(
      join(destination, 'note.md')
    )
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect
      .poll(() => readFileSync(join(destination, 'note.md'), 'utf8').trim())
      .toBe('Edited before moving folder')
    await expectNoRendererErrors(app)
  } finally {
    await stop(app)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('an unavailable configured startup folder explains the fallback and opens a blank document', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-unavailable-folder-'))
  const { app, page } = await launchElectron([], {
    userDataDir: directory,
    preferences: {
      language: 'en',
      startUpAction: 'folder',
      defaultDirectoryToOpen: join(directory, 'missing')
    },
    suppressErrorDialog: true
  })
  try {
    await expect(
      page.getByText(`Folder unavailable: ${join(directory, 'missing')}`, { exact: true })
    ).toBeVisible()
    expect(state(directory).session.windows).toHaveLength(1)
    expect(state(directory).session.windows[0].workspace).toBeNull()
    expect((await getMarkdownContent(page, app)).trim()).toBe('')
    await expectNoRendererErrors(app)
  } finally {
    await stop(app)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('two windows on the same workspace restore their own draft, document identity and layout', async() => {
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-shared-workspace-'))
  const root = join(directory, 'workspace')
  mkdirSync(root)
  const file = join(root, 'shared.md')
  writeFileSync(file, 'Original shared disk text')
  let running: ElectronApplication | null = null
  try {
    const first = await launchElectron([root, file], {
      userDataDir: directory,
      preferences: { language: 'en' },
      suppressErrorDialog: true
    })
    running = first.app
    await first.page
      .getByRole('textbox', { name: 'Document', exact: true })
      .fill('Window A private draft')
    await sendIpcToRenderer(first.app, 'mt::set-view-layout', {
      showSideBar: true,
      sideBarWidth: 340
    })
    await expect
      .poll(() => state(directory).session.windows[0].documents[0].content.kind)
      .toBe('recovery')
    const next = first.app.waitForEvent('window')
    await first.app.evaluate(({ app }, root) => {
      const argv = ['marktext', '--new-window', root]
      app.emit('second-instance', {}, argv, '/', { argv })
    }, root)
    const second = await next
    await expect(second.getByRole('textbox', { name: 'Document', exact: true })).toContainText(
      'Original shared disk text'
    )
    await second
      .getByRole('textbox', { name: 'Document', exact: true })
      .fill('Window B private draft')
    await second.evaluate(() => {
      const root = document.querySelector('#app') as Element & {
        __vue_app__: {
          config: {
            globalProperties: { $pinia: { _s: Map<string, { SET_LAYOUT(value: unknown): void }> } }
          }
        }
      }
      root.__vue_app__.config.globalProperties.$pinia._s
        .get('layout')!
        .SET_LAYOUT({ showSideBar: false, sideBarWidth: 280 })
    })
    await expect
      .poll(
        () =>
          state(directory).session.windows.filter(
            (window: { documents: Array<{ content: { kind: string } }> }) =>
              window.documents.some((document) => document.content.kind === 'recovery')
          ).length
      )
      .toBe(2)
    const before = state(directory).session.windows
    expect(before[0].workspace.id).toBe(before[1].workspace.id)
    expect(before[0].documents[0].id).not.toBe(before[1].documents[0].id)
    await stop(first.app)
    running = null
    const restored = await launchElectron([], { userDataDir: directory, suppressErrorDialog: true })
    running = restored.app
    await expect.poll(() => restored.app.windows().length).toBe(2)
    const text = await Promise.all(
      restored.app
        .windows()
        .map((page) => page.getByRole('textbox', { name: 'Document', exact: true }).innerText())
    )
    expect(text.map((value) => value.trim()).sort()).toEqual([
      'Window A private draft',
      'Window B private draft'
    ])
    const after = state(directory).session.windows
    for (const window of before) {
      const current = after.find((item: { id: string }) => item.id === window.id)
      expect(current.documents.map((document: { id: string }) => document.id)).toEqual(
        window.documents.map((document: { id: string }) => document.id)
      )
      expect(current.layout).toEqual(window.layout)
    }
    await expectNoRendererErrors(restored.app)
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('ten normal startup, edit, save or discard and quit cycles do not accumulate recovery bodies', async() => {
  test.setTimeout(90000)
  const directory = mkdtempSync(join(tmpdir(), 'mt-session-ten-cycles-'))
  let running: ElectronApplication | null = null
  try {
    for (let cycle = 0; cycle < 10; cycle++) {
      const launched = await launchElectron([], {
        userDataDir: directory,
        preferences: cycle === 0 ? { language: 'en', startUpAction: 'blank' } : undefined,
        suppressErrorDialog: true
      })
      running = launched.app
      await launched.page
        .getByRole('textbox', { name: 'Document', exact: true })
        .fill(`Cycle ${cycle} edited body`)
      await launched.app.evaluate(
        ({ dialog }, { cycle, directory }) => {
          dialog.showMessageBox = async() => ({
            response: cycle % 2 === 0 ? 0 : 1,
            checkboxChecked: false
          })
          dialog.showSaveDialog = async() => ({
            canceled: false,
            filePath: `${directory}/saved-${cycle}.md`
          })
        },
        { cycle, directory }
      )
      const closed = launched.app.waitForEvent('close')
      await launched.app.evaluate(({ app }) => app.quit())
      await closed
      running = null
      expect(state(directory).session.lifecycle).toBe('closed')
      expect(state(directory).session.windows).toHaveLength(1)
      expect(
        readdirSync(join(directory, 'recovery'), { recursive: true }).filter((file) =>
          String(file).endsWith('.json')
        )
      ).toEqual([])
      expect(readdirSync(join(directory, 'state'))).toEqual(['application-state.json'])
      if (cycle % 2 === 0)
        expect(readFileSync(join(directory, `saved-${cycle}.md`), 'utf8').trim()).toBe(
          `Cycle ${cycle} edited body`
        )
    }
  } finally {
    if (running) await stop(running)
    rmSync(directory, { recursive: true, force: true })
  }
})
