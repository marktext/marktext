import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.hoisted(() => {
  Object.assign(window, {
    path: {
      sep: '/',
      dirname: (p: string) => p.substring(0, p.lastIndexOf('/')),
      basename: (p: string) => p.split('/').pop()
    },
    fileUtils: { isSamePathSync: (a: string, b: string) => a === b },
    electron: {
      clipboard: { writeText: vi.fn() },
      ipcRenderer: { send: vi.fn(), on: vi.fn(), invoke: vi.fn(async() => {}) }
    }
  })
})

vi.mock('@/services/notification', () => ({ default: { notify: vi.fn() } }))

import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'

type EditorStore = ReturnType<typeof useEditorStore>

const documentFor = (name: string) => ({
  pathname: `/notes/${name}.md`,
  filename: `${name}.md`,
  markdown: `# ${name}\n`
})

const beginOpen = (store: EditorStore, pathname: string): number => {
  const requestId = store.BEGIN_SIDEBAR_OPEN(pathname, true)
  if (requestId == null) throw new Error(`Could not begin sidebar open for ${pathname}`)
  return requestId
}

const currentFile = (store: EditorStore) => {
  if (!store.currentFile) throw new Error('Expected a current file')
  return store.currentFile
}

describe('sidebar preview tabs', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    usePreferencesStore().openFilesInPreviewMode = true
  })

  it('replaces the existing preview tab in place', () => {
    const store = useEditorStore()
    const firstRequest = beginOpen(store, '/notes/a.md')
    store.NEW_TAB_WITH_CONTENT({
      markdownDocument: documentFor('a'),
      options: { preview: true, requestId: firstRequest }
    })

    const firstTab = store.tabs[0]
    if (!firstTab) throw new Error('Expected the first preview tab')
    expect(firstTab.isPreview).toBe(true)
    vi.clearAllMocks()

    const secondRequest = beginOpen(store, '/notes/b.md')
    store.NEW_TAB_WITH_CONTENT({
      markdownDocument: documentFor('b'),
      options: { preview: true, requestId: secondRequest }
    })

    expect(store.tabs).toHaveLength(1)
    expect(store.tabs[0]).toMatchObject({
      pathname: '/notes/b.md',
      isPreview: true
    })
    expect(window.electron.ipcRenderer.send).toHaveBeenCalledWith(
      'mt::forget-document',
      firstTab.id
    )
    expect(window.electron.ipcRenderer.send).toHaveBeenCalledWith(
      'mt::window-tab-closed',
      '/notes/a.md'
    )
  })

  it('pins a preview on its first real content change', () => {
    const store = useEditorStore()
    const requestId = beginOpen(store, '/notes/a.md')
    store.NEW_TAB_WITH_CONTENT({
      markdownDocument: documentFor('a'),
      options: { preview: true, requestId }
    })
    const tab = currentFile(store)
    expect(tab.isPreview).toBe(true)

    store.LISTEN_FOR_CONTENT_CHANGE({
      id: tab.id,
      markdown: '# a edited\n'
    })

    expect(tab.isPreview).toBe(false)
    expect(tab.isSaved).toBe(false)
  })

  it('pins an existing preview on double click without moving it', () => {
    const store = useEditorStore()
    const requestId = beginOpen(store, '/notes/a.md')
    store.NEW_TAB_WITH_CONTENT({
      markdownDocument: documentFor('a'),
      options: { preview: true, requestId }
    })
    const tab = currentFile(store)

    store.FOCUS_FILE('/notes/a.md')

    expect(store.tabs).toEqual([tab])
    expect(tab.isPreview).toBe(false)
  })

  it('honours the preference when a preview request is already in flight', () => {
    const store = useEditorStore()
    const preferences = usePreferencesStore()
    const requestId = beginOpen(store, '/notes/a.md')
    preferences.openFilesInPreviewMode = false

    store.NEW_TAB_WITH_CONTENT({
      markdownDocument: documentFor('a'),
      options: { preview: true, requestId }
    })

    expect(store.currentFile?.isPreview).toBe(false)
  })

  it('drops a response that is no longer the latest sidebar request', () => {
    const store = useEditorStore()
    const firstRequest = beginOpen(store, '/notes/a.md')
    const secondRequest = beginOpen(store, '/notes/b.md')

    store.NEW_TAB_WITH_CONTENT({
      markdownDocument: documentFor('a'),
      options: { preview: true, requestId: firstRequest }
    })
    expect(store.tabs).toHaveLength(0)

    store.NEW_TAB_WITH_CONTENT({
      markdownDocument: documentFor('b'),
      options: { preview: true, requestId: secondRequest }
    })
    expect(store.tabs.map((tab) => tab.pathname)).toEqual(['/notes/b.md'])
  })

  it('does not persist preview state in the buffer store', () => {
    const store = useEditorStore()
    const requestId = beginOpen(store, '/notes/a.md')
    store.NEW_TAB_WITH_CONTENT({
      markdownDocument: documentFor('a'),
      options: { preview: true, requestId }
    })

    const snapshot = store.CREATE_BUFFERED_STATE()
    if (!snapshot) throw new Error('Expected buffered editor state')
    expect(snapshot.tabs[0]).not.toHaveProperty('isPreview')
  })

  it('cancels a pending preview through the request channel', () => {
    const store = useEditorStore()
    const requestId = beginOpen(store, '/notes/a.md')

    store.CANCEL_PENDING_SIDEBAR_OPEN()

    expect(window.electron.ipcRenderer.send).toHaveBeenCalledWith(
      'mt::cancel-pending-preview',
      requestId
    )
  })
})
