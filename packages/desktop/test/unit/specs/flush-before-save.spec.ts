import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// `@/store/editor` reads `window.path` at module load and `window.electron`
// at runtime; stub those surfaces before the hoisted imports run.
vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string; dirname: (p: string) => string }
      electron?: {
        clipboard: { writeText: (s: string) => void }
        ipcRenderer: { send: (...a: unknown[]) => void; on: (...a: unknown[]) => void }
      }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p }
  w.window.electron ??= {
    clipboard: { writeText: () => {} },
    ipcRenderer: { send: () => {}, on: () => {} }
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import { useEditorStore } from '@/store/editor'
import bus from '@/bus'

// #3803: the store snapshots `currentFile.markdown` (refreshed only on the
// engine's deferred rAF `json-change`) to send to the main process. A keystroke
// typed in the same frame as Cmd+S was therefore dropped from the saved file.
// FILE_SAVE / FILE_SAVE_AS now emit `flush-active-editor` first, which the
// editor synchronously flushes into `currentFile.markdown` before it is read.

function seedCurrentFile(store: ReturnType<typeof useEditorStore>) {
  store.currentFile = {
    id: 'tab-1',
    filename: 'note.md',
    pathname: '/tmp/note.md',
    markdown: 'hello',
    isSaved: false,
    encoding: { encoding: 'utf8', isBom: false },
    lineEnding: 'lf',
    adjustLineEndingOnSave: false,
    trimTrailingNewline: 2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('editor store — flush pending edits before saving (#3803)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('FILE_SAVE emits flush-active-editor before sending the save IPC', () => {
    const store = useEditorStore()
    seedCurrentFile(store)

    const emitSpy = vi.spyOn(bus, 'emit')
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.FILE_SAVE()

    expect(emitSpy).toHaveBeenCalledWith('flush-active-editor')
    const saveCall = sendSpy.mock.calls.find((c) => c[0] === 'mt::response-file-save')
    expect(saveCall).toBeTruthy()
    // The flush must happen before the save payload is sent.
    expect(emitSpy.mock.invocationCallOrder[0]).toBeLessThan(sendSpy.mock.invocationCallOrder[0])
  })

  it('FILE_SAVE_AS emits flush-active-editor before sending the save-as IPC', () => {
    const store = useEditorStore()
    seedCurrentFile(store)

    const emitSpy = vi.spyOn(bus, 'emit')
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.FILE_SAVE_AS()

    expect(emitSpy).toHaveBeenCalledWith('flush-active-editor')
    const saveAsCall = sendSpy.mock.calls.find((c) => c[0] === 'mt::response-file-save-as')
    expect(saveAsCall).toBeTruthy()
    expect(emitSpy.mock.invocationCallOrder[0]).toBeLessThan(sendSpy.mock.invocationCallOrder[0])
  })

  // The same "read currentFile.markdown then persist" pattern also lives in
  // MOVE_FILE_TO / RESPONSE_FOR_RENAME, which now flush through the shared
  // helper too so those paths don't drop the last keystroke either (#3803).
  it('MOVE_FILE_TO flushes the active editor before sending its IPC', () => {
    const store = useEditorStore()
    seedCurrentFile(store)

    const emitSpy = vi.spyOn(bus, 'emit')
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.MOVE_FILE_TO()

    expect(emitSpy).toHaveBeenCalledWith('flush-active-editor')
    expect(sendSpy).toHaveBeenCalled()
    expect(emitSpy.mock.invocationCallOrder[0]).toBeLessThan(sendSpy.mock.invocationCallOrder[0])
  })
})
