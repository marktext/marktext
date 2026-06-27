import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// #2156 — Save/Save As should default the dialog to the directory of the file
// the user is editing, not the OS Documents folder, when no project folder is
// open in the sidebar. The save dialog's `defaultPath` is derived in the
// renderer and sent to the main process; it previously only ever resolved to
// the opened project folder (or '' → Documents in main).
//
// `@/store/editor` transitively imports `@/config`, which reads
// `window.path.sep` at module load, and reaches `window.electron.ipcRenderer`
// at runtime. Stub those surfaces before the hoisted imports run.
vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string; dirname: (p: string) => string }
      electron?: { clipboard: { writeText: (s: string) => void }; ipcRenderer: { send: (...a: unknown[]) => void; on: (...a: unknown[]) => void } }
      DIRNAME?: string
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p.replace(/\/[^/]*$/, '') }
  w.window.electron ??= {
    clipboard: { writeText: () => {} },
    ipcRenderer: { send: () => {}, on: () => {} }
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import { useEditorStore } from '@/store/editor'
import { defaultFileState } from '@/store/help'
import type { IFileState } from '@shared/types/files'

describe('#2156 — save dialog default path falls back to the active file directory', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.electron.ipcRenderer.send = vi.fn()
  })

  function lastSaveAsDefaultPath(): unknown {
    const calls = (window.electron.ipcRenderer.send as ReturnType<typeof vi.fn>).mock.calls
    const call = calls.find((c) => c[0] === 'mt::response-file-save-as')
    expect(call).toBeTruthy()
    if (!call) return undefined
    return call[call.length - 1]
  }

  it('uses window.DIRNAME (the active file dir) when no project folder is open', () => {
    window.DIRNAME = '/home/me/notes'
    const store = useEditorStore()
    store.currentFile = { ...defaultFileState, id: 'tab-1', pathname: '' } as IFileState

    store.FILE_SAVE_AS()

    expect(lastSaveAsDefaultPath()).toBe('/home/me/notes')
  })

  it('still resolves to an empty default when neither a project folder nor an active dir exist', () => {
    window.DIRNAME = ''
    const store = useEditorStore()
    store.currentFile = { ...defaultFileState, id: 'tab-2', pathname: '' } as IFileState

    store.FILE_SAVE_AS()

    expect(lastSaveAsDefaultPath()).toBe('')
  })
})
