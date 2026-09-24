import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// `@/store/editor` reads `window.path` and `window.electron` at module load.
vi.hoisted(() => {
  type StubWindow = {
    path?: { sep: string; dirname: (p: string) => string }
    electron?: Record<string, unknown>
  }
  const w = globalThis as unknown as { window?: StubWindow }
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
import { usePreferencesStore } from '@/store/preferences'
import bus from '@/bus'

// #5379: `EXPORT_PANDOC` used to read `engine.getMarkdown()`, which misses source-code mode,
// so it now flushes and reads the tab the way `FILE_SAVE` does. The assertions are on the
// payload, not the emit order: a late flush would still emit first, shipping a stale document.

const STALE = 'hello' // what the pre-flush snapshot holds
const FLUSHED = 'hello world!' // the last keystroke the engine commits on flush

// `EXPORT_PANDOC` reads only these two, and `flushActiveEditor` just emits a bus event.
function seedCurrentFile(store: ReturnType<typeof useEditorStore>) {
  store.currentFile = {
    pathname: '/tmp/note.md',
    markdown: STALE
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// Commits the pending keystroke on flush; the detach fn keeps the shared bus from leaking.
function onFlushCommit(store: ReturnType<typeof useEditorStore>) {
  const handler = () => {
    if (store.currentFile) store.currentFile.markdown = FLUSHED
  }
  bus.on('flush-active-editor', handler)
  return () => bus.off('flush-active-editor', handler)
}

const sentPayload = (sendSpy: { mock: { calls: unknown[][] } }) =>
  sendSpy.mock.calls.find((c) => c[0] === 'mt::response-pandoc-export')?.[1] as {
    markdown: string; pathname: string; target: string; superSubScript: boolean; footnote: boolean
  }

describe('pandoc export payload (#5379)', () => {
  let detach: (() => void) | undefined
  let store: ReturnType<typeof useEditorStore>
  let sendSpy: MockInstance

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    store = useEditorStore()
    seedCurrentFile(store)
    sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')
  })

  afterEach(() => {
    detach?.()
    detach = undefined
  })

  it('sends the tab markdown, the source pathname and the target', () => {
    detach = onFlushCommit(store)
    store.EXPORT_PANDOC('docx')

    expect(sentPayload(sendSpy)).toBeDefined()
    expect(sentPayload(sendSpy)).toMatchObject({
      markdown: FLUSHED,
      pathname: '/tmp/note.md',
      target: 'docx'
    })
  })

  // Only the renderer knows these: `gfm` enables footnotes itself, so it must be told to stop.
  it('reports the reader preferences to the main process', () => {
    usePreferencesStore().superSubScript = true
    usePreferencesStore().footnote = false

    store.EXPORT_PANDOC('docx')

    expect(sentPayload(sendSpy)).toMatchObject({ superSubScript: true, footnote: false })
  })

  it('does nothing when no tab is open', () => {
    store.currentFile = null
    store.EXPORT_PANDOC('docx')

    expect(sentPayload(sendSpy)).toBeUndefined()
  })
})
