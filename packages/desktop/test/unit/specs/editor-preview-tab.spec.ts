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
import { createDocumentState } from '@/store/help'
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

  it('pins a preview on its first real content change', () => {
    const store = useEditorStore()
    const requestId = beginOpen(store, '/notes/a.md')
    const file = createDocumentState(documentFor('a'))
    file.isPreview = true
    store.tabs = [file]
    store.currentFile = file
    store.updateTabIdToIndex()
    store.SETTLE_SIDEBAR_OPEN(requestId, file.pathname)
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
    const file = createDocumentState(documentFor('a'))
    file.isPreview = true
    store.tabs = [file]
    store.currentFile = file
    store.updateTabIdToIndex()
    store.SETTLE_SIDEBAR_OPEN(requestId, file.pathname)
    const tab = currentFile(store)

    store.FOCUS_FILE('/notes/a.md')

    expect(store.tabs).toEqual([tab])
    expect(tab.isPreview).toBe(false)
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
