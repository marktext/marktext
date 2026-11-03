import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Accessor from 'main_renderer/app/accessor'

vi.mock('electron', async() => {
  const { EventEmitter } = await import('node:events')
  class BrowserWindow extends EventEmitter {
    id = 7
    webContents = Object.assign(new EventEmitter(), {
      send: vi.fn(),
      setIgnoreMenuShortcuts: vi.fn(),
      toggleDevTools: vi.fn()
    })

    loadURL = vi.fn()
    setSheetOffset = vi.fn()
    destroy = (): void => { this.emit('closed') }
  }
  return { BrowserWindow, ipcMain: { emit: vi.fn() } }
})
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))
vi.mock('common/localShortcut', () => ({ electronLocalshortcut: { register: vi.fn() } }))
vi.mock('main_renderer/config', () => ({
  TITLE_BAR_HEIGHT: 24,
  editorWinOptions: {},
  preferencesWinOptions: { width: 800, height: 600 },
  isLinux: false,
  isOsx: false
}))
vi.mock('main_renderer/windows/utils', () => ({
  centerWindowOptions: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn()
}))
vi.mock('main_renderer/contextMenu/editor', () => ({ showEditorContextMenu: vi.fn() }))
vi.mock('main_renderer/spellchecker', () => ({ switchLanguage: vi.fn() }))

import { ipcMain } from 'electron'
import EditorWindow from 'main_renderer/windows/editor'
import SettingWindow from 'main_renderer/windows/setting'

const makeAccessor = () => ({
  env: { debug: false, paths: { userDataPath: '/tmp/marktext-test' } },
  preferences: {
    getAll: () => ({}),
    getPreferredEol: () => 'lf'
  },
  keybindings: { getAccelerator: () => null },
  menu: {
    addEditorMenu: vi.fn(),
    addSettingMenu: vi.fn(),
    updateLineEndingMenu: vi.fn()
  },
  sessionHost: {
    registerEditor: vi.fn(),
    prepareNewWindow: vi.fn(async() => ({ snapshot: { id: 'prepared' } })),
    bindEditor: vi.fn(),
    isRendererInitialized: () => false,
    report: vi.fn()
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173')
})
afterEach(() => vi.unstubAllEnvs())

describe('editor window file bookkeeping', () => {
  it('keeps additions unique and reconciles renamed and removed files', () => {
    const editor = new EditorWindow(makeAccessor() as unknown as Accessor)
    editor.addToOpenedFiles('/project/old.md')
    editor.addToOpenedFiles('/project/old.md')
    editor.changeOpenedFilePath('/project/new.md', '/project/old.md')

    expect(editor.getCandidateScores(['/project/old.md', '/project/new.md']))
      .toEqual([{ id: null, score: 1 }, { id: null, score: -1 }])

    editor.removeFromOpenedFiles('/project/new.md')
    expect(editor.getCandidateScores(['/project/old.md', '/project/new.md']))
      .toEqual([{ id: null, score: 0 }, { id: null, score: 0 }])
  })

  it('scores files in a folder whose name starts with two dots', () => {
    const editor = new EditorWindow(makeAccessor() as unknown as Accessor)
    editor.addToOpenedFiles('/project/note.md')

    expect(editor.getCandidateScores(['/project/..drafts/todo.md', '/other/todo.md']))
      .toEqual([{ id: null, score: 1 }, { id: null, score: 0 }])
  })

  it('clears file ownership on destruction', () => {
    const editor = new EditorWindow(makeAccessor() as unknown as Accessor)
    editor.addToOpenedFiles('/project/note.md')

    editor.destroy()

    expect(editor.getCandidateScores(['/project/note.md'])).toEqual([{ id: null, score: 0 }])
  })

  it('uses the created native window for menu initialization', async() => {
    const accessor = makeAccessor()
    const editor = new EditorWindow(accessor as unknown as Accessor)
    const native = editor.createWindow()
    await editor.sessionReady

    native.webContents.emit('did-finish-load')

    expect(accessor.menu.updateLineEndingMenu).toHaveBeenCalledExactlyOnceWith(native.id, 'lf')
    editor.destroy()
  })
})

describe('settings window lifetime', () => {
  it('routes active status and close requests through its native window', () => {
    const settings = new SettingWindow(makeAccessor() as unknown as Accessor)
    const native = settings.createWindow()
    const preventDefault = vi.fn()

    native.emit('focus')
    native.emit('blur')
    native.emit('close', { preventDefault })

    expect(native.webContents.send).toHaveBeenNthCalledWith(1, 'mt::window-active-status', { status: true })
    expect(native.webContents.send).toHaveBeenNthCalledWith(2, 'mt::window-active-status', { status: false })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(ipcMain.emit).toHaveBeenCalledWith('window-close-by-id', native.id)
    settings.destroy()
  })

  it('releases the window and ignores late focus events after closing', () => {
    const settings = new SettingWindow(makeAccessor() as unknown as Accessor)
    const native = settings.createWindow()

    native.emit('closed')
    native.emit('focus')
    native.emit('blur')

    expect(settings.browserWindow).toBeNull()
    expect(native.webContents.send).not.toHaveBeenCalled()
  })
})
