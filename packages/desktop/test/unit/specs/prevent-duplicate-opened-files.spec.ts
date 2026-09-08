import path from 'path'
import { readFileSync } from 'fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    quit: vi.fn()
  },
  BrowserWindow: vi.fn(),
  ipcMain: {
    on: vi.fn(),
    emit: vi.fn()
  }
}))

describe('preventDuplicateOpenedFiles feature', () => {
  it('has default true in static preference.json and schema.json', () => {
    const preferenceJsonPath = path.resolve(__dirname, '../../../static/preference.json')
    const schemaJsonPath = path.resolve(__dirname, '../../../src/main/preferences/schema.json')

    const preferenceJson = JSON.parse(readFileSync(preferenceJsonPath, 'utf8'))
    const schemaJson = JSON.parse(readFileSync(schemaJsonPath, 'utf8'))

    expect(preferenceJson.preventDuplicateOpenedFiles).toBe(true)
    expect(schemaJson.preventDuplicateOpenedFiles).toBeDefined()
    expect(schemaJson.preventDuplicateOpenedFiles.default).toBe(true)
    expect(schemaJson.preventDuplicateOpenedFiles.type).toBe('boolean')
  })

  it('EditorWindow.prototype.hasOpenFile correctly identifies matching opened files', async() => {
    const { default: EditorWindow } = await import('../../../src/main/windows/editor')

    const fakeEditor = Object.create(EditorWindow.prototype)
    fakeEditor._openedFiles = [
      path.resolve('/notes/todo.md'),
      path.resolve('/notes/ideas.md')
    ]

    expect(fakeEditor.hasOpenFile(path.resolve('/notes/todo.md'))).toBe(true)
    expect(fakeEditor.hasOpenFile(path.resolve('/notes/ideas.md'))).toBe(true)
    expect(fakeEditor.hasOpenFile(path.resolve('/notes/other.md'))).toBe(false)
  })

  it('EditorWindow.prototype.focusAndSwitchToTab brings window to front and sends switch event', async() => {
    const { default: EditorWindow } = await import('../../../src/main/windows/editor')

    const fakeEditor = Object.create(EditorWindow.prototype)
    const filePath = path.resolve('/notes/todo.md')
    fakeEditor._openedFiles = [filePath]

    const sendMock = vi.fn()
    fakeEditor.bringToFront = vi.fn()
    fakeEditor.browserWindow = {
      isDestroyed: () => false,
      webContents: {
        send: sendMock
      }
    }

    fakeEditor.focusAndSwitchToTab(filePath)

    expect(fakeEditor.bringToFront).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith('mt::switch-tab-by-file_path', filePath)
  })

  it('WindowManager.prototype.findWindowWithFile returns matching editor window', async() => {
    const { default: WindowManager } = await import('../../../src/main/app/windowManager')
    const { WindowType } = await import('../../../src/main/windows/base')

    const filePath = path.resolve('/docs/readme.md')
    const fakeEditor1 = {
      type: WindowType.EDITOR,
      hasOpenFile: (p: string) => p === filePath
    }
    const fakeEditor2 = {
      type: WindowType.EDITOR,
      hasOpenFile: () => false
    }

    const fakeWindowManager = Object.create(WindowManager.prototype)
    fakeWindowManager._windows = new Map([
      [1, fakeEditor2],
      [2, fakeEditor1]
    ])

    const found = fakeWindowManager.findWindowWithFile(filePath)
    expect(found).toBe(fakeEditor1)

    const notFound = fakeWindowManager.findWindowWithFile(path.resolve('/docs/other.md'))
    expect(notFound).toBeUndefined()
  })
})
