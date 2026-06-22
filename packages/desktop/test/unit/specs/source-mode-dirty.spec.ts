import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

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

// #4455: editing in Source Code mode and closing without switching back to
// WYSIWYG silently dropped the save prompt. Source-mode content changes reach
// LISTEN_FOR_CONTENT_CHANGE WITHOUT an editor `history`, and the history-based
// dirty check never flips `isSaved` (it can even reset it to true), so the
// close path saw nothing unsaved. Decide dirty state from the content instead.
describe('useEditorStore LISTEN_FOR_CONTENT_CHANGE — source-mode dirty tracking (#4455)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const makeSavedTab = (store: ReturnType<typeof useEditorStore>) => {
    const tab = {
      id: 'tab-1',
      filename: 'a.md',
      pathname: '/x/a.md',
      markdown: 'hello',
      trimTrailingNewline: 0,
      isSaved: true,
      lastSavedHistoryId: 7,
      history: { stack: [{ id: 7 }], lastEditIndex: 0, lastInitIndex: -1 }
    }
    store.tabs = [tab] as unknown as typeof store.tabs
    store.tabIdToIndex = { 'tab-1': 0 }
    return tab
  }

  it('marks the tab unsaved when source-mode content changes (no history in payload)', () => {
    const store = useEditorStore()
    const tab = makeSavedTab(store)

    store.LISTEN_FOR_CONTENT_CHANGE({ id: 'tab-1', markdown: 'hello world' })

    expect(tab.isSaved).toBe(false)
  })

  it('keeps the tab saved when source-mode fires with unchanged content (caret move)', () => {
    const store = useEditorStore()
    const tab = makeSavedTab(store)

    store.LISTEN_FOR_CONTENT_CHANGE({ id: 'tab-1', markdown: 'hello' })

    expect(tab.isSaved).toBe(true)
  })

  it('leaves the WYSIWYG history-based path unchanged (history present, edit matches saved id)', () => {
    const store = useEditorStore()
    const tab = makeSavedTab(store)

    store.LISTEN_FOR_CONTENT_CHANGE({
      id: 'tab-1',
      markdown: 'hello world',
      history: { stack: [{ id: 7 }], lastEditIndex: 0, lastInitIndex: -1 } as never
    })

    expect(tab.isSaved).toBe(true)
  })
})
