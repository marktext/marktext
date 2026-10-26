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

import { useEditorStore } from '@/store/editor'
import bus from '@/bus'

// #3803: the store snapshots `currentFile.markdown` (refreshed only on the
// engine's deferred rAF `json-change`) to send to the main process. A keystroke
// typed in the same frame as Cmd+S was therefore dropped from the saved file.
// The save/move/rename paths now emit `flush-active-editor` first, which the
// editor synchronously commits into `currentFile.markdown` before it is read.
//
// The bug lives at the `const { …, markdown } = this.currentFile` READ, which
// sits between the flush and the send — so an emit-order assertion (flush < send)
// alone would still pass if a regression moved the flush past the read. These
// tests instead wire a real `flush-active-editor` listener that commits the
// pending keystroke (mirroring editor.vue → `editor.flush()` → `json-change` →
// LISTEN_FOR_CONTENT_CHANGE) and assert the SENT PAYLOAD carries it: a flush
// moved after the read would send the stale snapshot and fail here.

const STALE = 'hello' // what the pre-flush snapshot holds
const FLUSHED = 'hello world!' // the last keystroke the editor commits on flush
const MARKDOWN_ARG = 4 // send(channel, id, filename, pathname, markdown, …)

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
  })

  afterEach(() => {
    detach?.()
    detach = undefined
  })

  it('FILE_SAVE sends the flushed markdown, not the stale pre-flush snapshot', () => {
    const store = useEditorStore()
    seedCurrentFile(store)
    detach = onFlushCommit(store)
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.FILE_SAVE()

    const call = sendSpy.mock.calls.find((c) => c[0] === 'mt::response-file-save')
    expect(call).toBeDefined()
    expect(call?.[MARKDOWN_ARG]).toBe(FLUSHED)
  })

  it('SAVE_FILE_FOR_IMAGE flushes before saving and applies the returned path before resolving', async() => {
    const store = useEditorStore()
    seedCurrentFile(store, { pathname: '', isPendingCreation: true })
    if (store.currentFile) store.tabs = [store.currentFile]
    detach = onFlushCommit(store)
    const invoke = vi.spyOn(window.electron.ipcRenderer, 'invoke').mockResolvedValue({
      status: 'saved', pathname: '/notes/final.md', filename: 'final.md', savedMarkdown: FLUSHED
    })
    const result = await store.SAVE_FILE_FOR_IMAGE()
    expect(invoke).toHaveBeenCalledWith('mt::save-file-for-image', 'tab-1', 'note.md', '', FLUSHED,
      expect.any(Object), expect.any(String))
    expect(result.status).toBe('saved')
    expect(store.currentFile).toMatchObject({
      pathname: '/notes/final.md', filename: 'final.md', isPendingCreation: false, isSaved: true
    })
    expect(window.DIRNAME).toBe(window.path.dirname('/notes/final.md'))
  })

  it.each(['canceled', 'failed'] as const)('leaves the document path unchanged when image-triggered saving is %s', async(status) => {
    const store = useEditorStore()
    seedCurrentFile(store, { pathname: '' })
    vi.spyOn(window.electron.ipcRenderer, 'invoke').mockResolvedValue({ status })
    expect(await store.SAVE_FILE_FOR_IMAGE()).toEqual({ status })
    expect(store.currentFile?.pathname).toBe('')
  })

  it.each([
    { delivery: 'event-first', pathname: '' },
    { delivery: 'reply-first', pathname: '' },
    { delivery: 'event-first', pathname: '/notes/final.md' },
    { delivery: 'reply-first', pathname: '/notes/final.md' }
  ])('requests closing an unsaved destination tab once ($delivery, initial path "$pathname")', async({ delivery, pathname }) => {
    const store = useEditorStore()
    seedCurrentFile(store, { pathname, isPendingCreation: !!pathname })
    const file = store.currentFile
    if (!file) throw new Error('Missing current file')
    const destinationTab = {
      ...file, id: 'destination-tab', pathname: '/notes/final.md',
      isPendingCreation: false, markdown: 'Unsaved destination edits'
    }
    store.tabs = [file, destinationTab]
    const result = {
      status: 'saved' as const, pathname: '/notes/final.md',
      filename: 'final.md', savedMarkdown: STALE
    }
    const send = vi.spyOn(window.electron.ipcRenderer, 'send')
    vi.spyOn(window.electron.ipcRenderer, 'invoke').mockImplementationOnce(async() => {
      if (delivery === 'event-first') store.SET_PATHNAME({ id: file.id, ...result })
      return result
    })

    await store.SAVE_FILE_FOR_IMAGE()
    if (delivery === 'reply-first') store.SET_PATHNAME({ id: file.id, ...result })

    const closeRequests = send.mock.calls.filter(([channel]) => channel === 'mt::save-and-close-tabs')
    expect(closeRequests).toHaveLength(1)
    expect(closeRequests[0][1]).toMatchObject([{ id: 'destination-tab', markdown: 'Unsaved destination edits' }])
    expect(store.tabs).toHaveLength(2)
    expect(store.currentFile).toMatchObject({ pathname: '/notes/final.md', isPendingCreation: false })
  })

  it('FILE_SAVE_AS sends the flushed markdown, not the stale pre-flush snapshot', () => {
    const store = useEditorStore()
    seedCurrentFile(store)
    detach = onFlushCommit(store)
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.FILE_SAVE_AS()

    const call = sendSpy.mock.calls.find((c) => c[0] === 'mt::response-file-save-as')
    expect(call).toBeDefined()
    expect(call?.[MARKDOWN_ARG]).toBe(FLUSHED)
  })

  // MOVE_FILE_TO / RESPONSE_FOR_RENAME only transmit `markdown` in their untitled
  // (no-pathname) branch, which reuses `mt::response-file-save` — that is where
  // the flush actually matters, so assert the payload there too.
  it('MOVE_FILE_TO (untitled) sends the flushed markdown', () => {
    const store = useEditorStore()
    seedCurrentFile(store, { pathname: '' })
    detach = onFlushCommit(store)
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.MOVE_FILE_TO()

    const call = sendSpy.mock.calls.find((c) => c[0] === 'mt::response-file-save')
    expect(call).toBeDefined()
    expect(call?.[MARKDOWN_ARG]).toBe(FLUSHED)
  })

  it('RESPONSE_FOR_RENAME (untitled) sends the flushed markdown', () => {
    const store = useEditorStore()
    seedCurrentFile(store, { pathname: '' })
    detach = onFlushCommit(store)
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.RESPONSE_FOR_RENAME()

    const call = sendSpy.mock.calls.find((c) => c[0] === 'mt::response-file-save')
    expect(call).toBeDefined()
    expect(call?.[MARKDOWN_ARG]).toBe(FLUSHED)
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
