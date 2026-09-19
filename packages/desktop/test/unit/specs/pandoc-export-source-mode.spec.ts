import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
import { usePreferencesStore } from '@/store/preferences'
import bus from '@/bus'

// #5379: `EXPORT_PANDOC` used to be fed by `engine.getMarkdown()` from
// editor.vue. While source-code mode is active, CodeMirror writes to
// `currentFile.markdown` and the Muya engine is only synced when source mode is
// left — so anything typed in source mode was missing from the exported file.
// The store now reads the tab the way `FILE_SAVE` does: flush what the engine
// still has queued, then read `currentFile.markdown`.
//
// These tests assert on the SENT payload, not on the emit order: a flush moved
// after the read would still emit first and pass an order-only assertion while
// shipping the stale document.

const STALE = 'hello' // what the pre-flush snapshot holds
const FLUSHED = 'hello world!' // the last keystroke the engine commits on flush

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

const pandocCall = (sendSpy: { mock: { calls: unknown[][] } }) =>
  sendSpy.mock.calls.find((c: unknown[]) => c[0] === 'mt::response-pandoc-export')

describe('pandoc export payload (#5379)', () => {
  let detach: (() => void) | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    detach?.()
    detach = undefined
  })

  it('sends the tab markdown, including an edit made in source-code mode', () => {
    const store = useEditorStore()
    seedCurrentFile(store)
    detach = onFlushCommit(store)
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.EXPORT_PANDOC('docx')

    const call = pandocCall(sendSpy)
    expect(call).toBeDefined()
    expect((call?.[1] as { markdown: string }).markdown).toBe(FLUSHED)
  })

  it('sends the source pathname so pandoc can resolve relative links', () => {
    const store = useEditorStore()
    seedCurrentFile(store)
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.EXPORT_PANDOC('docx')

    const payload = pandocCall(sendSpy)?.[1] as { pathname: string; target: string }
    expect(payload.pathname).toBe('/tmp/note.md')
    expect(payload.target).toBe('docx')
  })

  // The reader is built in the main process, and only the renderer knows this
  // preference — without it `~x~` is exported as literal text.
  it('reports the superSubScript preference to the main process', () => {
    const store = useEditorStore()
    seedCurrentFile(store)
    const preferencesStore = usePreferencesStore()
    preferencesStore.superSubScript = true
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.EXPORT_PANDOC('docx')

    const payload = pandocCall(sendSpy)?.[1] as { superSubScript: boolean }
    expect(payload.superSubScript).toBe(true)
  })

  it('does nothing when no tab is open', () => {
    const store = useEditorStore()
    store.currentFile = null
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.EXPORT_PANDOC('docx')

    expect(pandocCall(sendSpy)).toBeUndefined()
  })
})
