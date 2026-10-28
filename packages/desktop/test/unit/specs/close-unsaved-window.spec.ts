import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.hoisted(() => {
  Object.assign(window, {
    path: { sep: '/', dirname: (pathname: string) => pathname.slice(0, pathname.lastIndexOf('/')) },
    electron: {
      clipboard: { writeText: vi.fn() },
      ipcRenderer: { send: vi.fn(), on: vi.fn() }
    }
  })
})

vi.mock('@/services/notification', () => ({ default: { notify: vi.fn() } }))
vi.mock('@/store/bufferedState', () => ({
  sendBufferedState: vi.fn(),
  debouncedSendBufferedState: vi.fn()
}))

import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { createDocumentState } from '@/store/help'
import { sendBufferedState } from '@/store/bufferedState'
import notice from '@/services/notification'
import bus from '@/bus'

type Listener = (event: unknown, ids?: string[]) => void
const listeners = new Map<string, Listener>()

const listenerFor = (channel: string): Listener => {
  const listener = listeners.get(channel)
  if (!listener) throw new Error(`Missing listener: ${channel}`)
  return listener
}

const deliver = async(channel: string, ids?: string[]): Promise<void> => {
  await listenerFor(channel)({}, ids)
  await vi.waitFor(() => {
    expect(sendBufferedState).toHaveResolved()
  })
}

const seed = (pathname = '/notes/existing.md', readOnly = false) => {
  const store = useEditorStore()
  const tab = createDocumentState({ pathname, markdown: 'unsaved edit', isSaved: false, readOnly })
  store.tabs = [tab]
  store.currentFile = store.tabs[0]
  store.updateTabIdToIndex()
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  listeners.clear()
  vi.mocked(window.electron.ipcRenderer.on).mockImplementation((channel, listener) => {
    listeners.set(channel, listener as Listener)
    return () => { listeners.delete(channel) }
  })
  vi.mocked(sendBufferedState).mockResolvedValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('closing unsaved windows (#5596)', () => {
  for (const startUpAction of ['restoreAll', 'blank', 'openLastFolder', 'folder']) {
    it.each([
      { pathname: '/notes/existing.md', readOnly: false },
      { pathname: '', readOnly: false },
      { pathname: '/notes/locked.md', readOnly: true }
    ])(`requests confirmation with startup action ${startUpAction} ($pathname, readOnly=$readOnly)`, async({ pathname, readOnly }) => {
      usePreferencesStore().startUpAction = startUpAction
      const store = seed(pathname, readOnly)
      store.LISTEN_FOR_CLOSE()

      await deliver('mt::ask-for-close')

      expect(window.electron.ipcRenderer.send).toHaveBeenCalledWith('mt::close-window-confirm', [
        expect.objectContaining({ pathname, readOnly, markdown: 'unsaved edit' })
      ])
      expect(window.electron.ipcRenderer.send).not.toHaveBeenCalledWith('mt::close-window')
      expect(store.tabs[0]).toMatchObject({ isSaved: false, markdown: 'unsaved edit' })
    })
  }

  it('closes clean documents and untouched empty drafts without confirmation', async() => {
    const store = seed()
    store.tabs[0].isSaved = true
    store.tabs.push(createDocumentState())
    store.LISTEN_FOR_CLOSE()

    await deliver('mt::ask-for-close')

    expect(window.electron.ipcRenderer.send).toHaveBeenCalledWith('mt::close-window')
    expect(window.electron.ipcRenderer.send).not.toHaveBeenCalledWith('mt::close-window-confirm', expect.anything())
  })

  it('includes pending editor changes and aggregates only unsaved documents', async() => {
    const store = seed()
    store.tabs[0].isSaved = true
    store.tabs.push(createDocumentState({ pathname: '/notes/clean.md', isSaved: true }))
    store.tabs.push(createDocumentState({ markdown: 'draft content', isSaved: false }))
    const commit = () => {
      store.tabs[0].markdown = 'last pending keystroke'
      store.tabs[0].isSaved = false
    }
    bus.on('flush-active-editor', commit)
    store.LISTEN_FOR_CLOSE()
    try {
      await deliver('mt::ask-for-close')
      expect(window.electron.ipcRenderer.send).toHaveBeenCalledWith('mt::close-window-confirm', [
        expect.objectContaining({ markdown: 'last pending keystroke' }),
        expect.objectContaining({ pathname: '', markdown: 'draft content' })
      ])
    } finally {
      bus.off('flush-active-editor', commit)
    }
  })

  it('keeps the window open and reports a failed recovery snapshot', async() => {
    const store = seed()
    store.LISTEN_FOR_CLOSE()
    const error = new Error('Disk full')
    vi.mocked(sendBufferedState).mockRejectedValue(error)
    vi.spyOn(console, 'error').mockImplementation(() => {})

    listenerFor('mt::ask-for-close')({})
    await vi.waitFor(() => expect(notice.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })))

    expect(window.electron.ipcRenderer.send).not.toHaveBeenCalled()
    expect(store.tabs[0].markdown).toBe('unsaved edit')
  })

  it('removes discarded edits from the recovery snapshot before closing', async() => {
    const store = seed()
    store.tabs.push(createDocumentState({ pathname: '/notes/clean.md', isSaved: true }))
    const discardedId = store.tabs[0].id
    let cachedMarkdown: string[] = []
    vi.mocked(sendBufferedState).mockImplementation(async() => {
      const snapshot = store.CREATE_BUFFERED_STATE()
      if (!snapshot) throw new Error('Missing recovery snapshot')
      cachedMarkdown = snapshot.tabs.map(tab => tab.markdown)
      return true
    })
    store.LISTEN_FOR_SAVE_CLOSE()

    await deliver('mt::discard-and-close-window', [discardedId])

    expect(cachedMarkdown).not.toContain('unsaved edit')
    expect(store.tabs.map(tab => tab.pathname)).toEqual(['/notes/clean.md'])
    expect(window.electron.ipcRenderer.send).toHaveBeenLastCalledWith('mt::close-window')
  })

  it('does not finish closing while a document remains unsaved', async() => {
    const store = seed()
    store.LISTEN_FOR_SAVE_CLOSE()

    await listenerFor('mt::finish-close-window')({})

    expect(sendBufferedState).not.toHaveBeenCalled()
    expect(window.electron.ipcRenderer.send).not.toHaveBeenCalled()
  })

  it('persists the saved state before finishing window close', async() => {
    const store = seed()
    store.tabs[0].isSaved = true
    store.LISTEN_FOR_SAVE_CLOSE()

    await deliver('mt::finish-close-window')

    expect(sendBufferedState).toHaveBeenCalledOnce()
    expect(window.electron.ipcRenderer.send).toHaveBeenCalledWith('mt::close-window')
  })
})
