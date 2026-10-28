import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// `@/store/editor` reads `window.path` at module load and `window.electron`
// at runtime; stub those surfaces before the hoisted imports run.
vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string; dirname: (p: string) => string }
      fileUtils?: { isSamePathSync: (left: string, right: string) => boolean }
      electron?: {
        clipboard: { writeText: (s: string) => void }
        ipcRenderer: {
          send: (...a: unknown[]) => void
          on: (...a: unknown[]) => void
          invoke: (...a: unknown[]) => Promise<unknown>
        }
      }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p }
  w.window.fileUtils ??= { isSamePathSync: (left, right) => left === right }
  w.window.electron ??= {
    clipboard: { writeText: () => {} },
    ipcRenderer: { send: () => {}, on: () => {}, invoke: async() => undefined }
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import { useEditorStore, setSessionActions, type SessionActions } from '@/store/editor'
import bus from '@/bus'

// A save command must flush before the session service captures the document (#3803).
const STALE = 'hello' // what the pre-flush snapshot holds
const FLUSHED = 'hello world!' // the last keystroke the editor commits on flush

function seedCurrentFile(
  store: ReturnType<typeof useEditorStore>,
  overrides: Record<string, unknown> = {}
) {
  store.currentFile = {
    id: 'tab-1',
    filename: 'note.md',
    pathname: '/tmp/note.md',
    markdown: STALE,
    isSaved: false,
    encoding: { encoding: 'utf8', isBom: false },
    lineEnding: 'lf',
    adjustLineEndingOnSave: false,
    trimTrailingNewline: 2,
    ...overrides
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// Mirror editor.vue's listener: commit the pending keystroke into the store on
// flush. Returns a detach fn (the bus is a module singleton — listeners leak
// across tests otherwise).
function onFlushCommit(store: ReturnType<typeof useEditorStore>) {
  const handler = () => {
    if (store.currentFile) store.currentFile.markdown = FLUSHED
  }
  bus.on('flush-active-editor', handler)
  return () => bus.off('flush-active-editor', handler)
}

// Global invocation order of a given emitted event, located by event name (not
// array position) so an unrelated earlier emit can't mask a moved flush.
function emitOrderOf(emitSpy: ReturnType<typeof vi.spyOn>, event: string): number | undefined {
  const i = emitSpy.mock.calls.findIndex((c: unknown[]) => c[0] === event)
  return i === -1 ? undefined : emitSpy.mock.invocationCallOrder[i]
}

describe('editor store — flush pending edits before saving (#3803)', () => {
  let detach: (() => void) | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    setSessionActions(null)
  })

  afterEach(() => {
    detach?.()
    detach = undefined
    setSessionActions(null)
  })

  const installSave = (save: SessionActions['save']): void => {
    setSessionActions({
      save,
      checkpoint: vi.fn(), scheduleCheckpoint: vi.fn(),
      captureView: vi.fn(),
      create: vi.fn(),
      close: vi.fn(),
      saveAll: vi.fn()
    })
  }

  it.each([false, true])('flushes the latest text before session save (Save As: %s)', (saveAs) => {
    const store = useEditorStore()
    seedCurrentFile(store)
    detach = onFlushCommit(store)
    const save = vi.fn(async() => {
      expect(store.currentFile?.markdown).toBe(FLUSHED)
      return { status: 'failed' } as const
    })
    installSave(save)
    if (saveAs) store.FILE_SAVE_AS()
    else store.FILE_SAVE()
    expect(save).toHaveBeenCalledWith('tab-1', ...(saveAs ? [true] : []))
  })

  it('returns the session save result without applying an unacknowledged document identity', async() => {
    const store = useEditorStore()
    seedCurrentFile(store)
    const saved = { status: 'saved', pathname: '/new/file.md', filename: 'file.md', savedMarkdown: FLUSHED } as const
    installSave(vi.fn(async() => saved))
    expect(await store.FILE_SAVE({ waitForResult: true })).toEqual(saved)
    expect(store.currentFile?.pathname).toBe('/tmp/note.md')
  })

  it.each(['canceled', 'failed'] as const)('retains the document when saving is %s', async(status) => {
    const store = useEditorStore()
    seedCurrentFile(store)
    installSave(vi.fn(async() => ({ status })))
    expect(await store.FILE_SAVE({ waitForResult: true })).toEqual({ status })
    expect(store.currentFile?.pathname).toBe('/tmp/note.md')
  })

  it('does not fall back to the retired save protocol before a session is ready', () => {
    const store = useEditorStore()
    seedCurrentFile(store)
    vi.spyOn(window.electron.ipcRenderer, 'send')
    store.FILE_SAVE()
    store.FILE_SAVE_AS()
    store.ASK_FOR_SAVE_ALL(true)
    expect(window.electron.ipcRenderer.send).not.toHaveBeenCalled()
  })

  it.each(['MOVE_FILE_TO', 'RESPONSE_FOR_RENAME'] as const)('%s saves untitled content through the session', (action) => {
    const store = useEditorStore()
    seedCurrentFile(store, { pathname: '' })
    detach = onFlushCommit(store)
    const save = vi.fn(async() => {
      expect(store.currentFile?.markdown).toBe(FLUSHED)
      return { status: 'failed' } as const
    })
    installSave(save)
    store[action]()
    expect(save).toHaveBeenCalledWith('tab-1')
  })

  // The existing-file rename branch emits 'rename' (no markdown payload); guard
  // that the flush still precedes it so it can't be silently dropped later.
  it('RESPONSE_FOR_RENAME (existing file) flushes before emitting rename', () => {
    const store = useEditorStore()
    seedCurrentFile(store, { pathname: '/tmp/note.md' })
    const emitSpy = vi.spyOn(bus, 'emit')

    store.RESPONSE_FOR_RENAME()

    const flushOrder = emitOrderOf(emitSpy, 'flush-active-editor')
    const renameOrder = emitOrderOf(emitSpy, 'rename')
    expect(flushOrder).toBeDefined()
    expect(renameOrder).toBeDefined()
    expect(flushOrder as number).toBeLessThan(renameOrder as number)
  })
})
