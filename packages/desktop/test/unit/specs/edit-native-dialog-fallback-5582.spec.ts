import { beforeEach, describe, expect, it, vi } from 'vitest'

// #5582 follow-up: the same "native dialog owns focus" problem applies to the
// standard Edit actions that MarkText cannot simply turn into native roles.
//
// `Undo`, `Redo` and `Select All` are custom because the WYSIWYG editor keeps
// its own history/selection model (and Select All has to coordinate the
// source-code editor and plain inputs). Their accelerators are still menu key
// equivalents, so while a native Open/Save panel is focused there is no
// `BrowserWindow` and the shortcut used to be swallowed. Forward the native
// selector (`undo:` / `redo:` / `selectAll:`) to the panel's first responder
// instead — the same fallback pattern used upstream (stablyai/orca#12645).

const { sendActionToFirstResponder, send } = vi.hoisted(() => ({
  sendActionToFirstResponder: vi.fn(),
  send: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { on: vi.fn() },
  Menu: { sendActionToFirstResponder }
}))
vi.mock('electron-log', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('main_renderer/utils/imagePathAutoComplement', () => ({ searchFilesAndDir: vi.fn() }))
vi.mock('main_renderer/commands', () => ({
  COMMANDS: new Proxy({}, { get: (_target, prop: string | symbol) => String(prop) })
}))

async function importEditActions(isOsx: boolean) {
  vi.resetModules()
  vi.doMock('main_renderer/config', () => ({ isOsx }))
  return await import('main_renderer/menu/actions/edit')
}

type EditActions = Awaited<ReturnType<typeof importEditActions>>

const fakeWindow = () => ({ webContents: { send } })

const cases: Array<{
  name: string
  selector: string
  ipcAction: string
  call: (actions: EditActions, win: unknown) => void
}> = [
  {
    name: 'editorUndo',
    selector: 'undo:',
    ipcAction: 'undo',
    call: (a, w) => a.editorUndo(w as never)
  },
  {
    name: 'editorRedo',
    selector: 'redo:',
    ipcAction: 'redo',
    call: (a, w) => a.editorRedo(w as never)
  },
  {
    name: 'editorSelectAll',
    selector: 'selectAll:',
    ipcAction: 'selectAll',
    call: (a, w) => a.editorSelectAll(w as never)
  }
]

describe('Edit actions reach macOS native dialogs (#5582)', () => {
  beforeEach(() => {
    sendActionToFirstResponder.mockClear()
    send.mockClear()
  })

  for (const { name, selector, ipcAction, call } of cases) {
    it(`${name} forwards ${selector} to the first responder when no window is focused on macOS`, async() => {
      const actions = await importEditActions(true)

      call(actions, null)

      expect(sendActionToFirstResponder).toHaveBeenCalledTimes(1)
      expect(sendActionToFirstResponder).toHaveBeenCalledWith(selector)
      expect(send).not.toHaveBeenCalled()
    })

    it(`${name} still routes to the editor when a window is focused`, async() => {
      const actions = await importEditActions(true)

      call(actions, fakeWindow())

      expect(sendActionToFirstResponder).not.toHaveBeenCalled()
      expect(send).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith('mt::editor-edit-action', ipcAction)
    })

    it(`${name} does not use the native responder on Windows/Linux`, async() => {
      const actions = await importEditActions(false)

      call(actions, null)

      expect(sendActionToFirstResponder).not.toHaveBeenCalled()
      expect(send).not.toHaveBeenCalled()
    })
  }
})
