import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string; dirname: (p: string) => string }
      fileUtils?: { isSamePathSync: (a: string, b: string) => boolean }
      electron?: { ipcRenderer: { send: (...a: unknown[]) => void; on: Mock } }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p }
  w.window.fileUtils ??= { isSamePathSync: (a, b) => a === b }
  w.window.electron ??= { ipcRenderer: { send: () => {}, on: vi.fn() } }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))
vi.mock('@/store/bufferedState', () => ({ debouncedSendBufferedState: vi.fn() }))

import { useEditorStore } from '@/store/editor'

// #1861: a watcher 'change' event fires even when only the file's mtime changed
// (e.g. a git checkout that left the content byte-identical). The handler then
// marked the tab unsaved and showed a "file changed on disk" prompt for a
// no-op change. Skip the handling when the new on-disk content equals the
// tab's current content.
describe('useEditorStore LISTEN_FOR_FILE_CHANGE — content-identical change (#1861)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(window.electron.ipcRenderer.on as Mock).mockReset()
  })

  const makeSavedTab = (store: ReturnType<typeof useEditorStore>) => {
    const tab = { id: 'tab-1', filename: 'a.md', pathname: '/x/a.md', markdown: 'hello', isSaved: true }
    store.tabs = [tab] as unknown as typeof store.tabs
    store.tabIdToIndex = { 'tab-1': 0 }
    return tab
  }

  const captureHandler = () => {
    const onMock = window.electron.ipcRenderer.on as Mock
    const call = onMock.mock.calls.find((c) => c[0] === 'mt::update-file')!
    return call[1] as (e: unknown, payload: unknown) => void
  }

  const fire = (handler: ReturnType<typeof captureHandler>, markdown: string) =>
    handler(null, { type: 'change', change: { pathname: '/x/a.md', data: { markdown } } })

  it('ignores a change whose content matches the tab (mtime-only change)', () => {
    const store = useEditorStore()
    const tab = makeSavedTab(store)
    const notifySpy = vi.spyOn(store, 'pushTabNotification').mockImplementation(() => {})
    store.LISTEN_FOR_FILE_CHANGE()

    fire(captureHandler(), 'hello')

    expect(notifySpy).not.toHaveBeenCalled()
    expect(tab.isSaved).toBe(true)
  })

  it('still warns when the on-disk content actually changed', () => {
    const store = useEditorStore()
    const tab = makeSavedTab(store)
    const notifySpy = vi.spyOn(store, 'pushTabNotification').mockImplementation(() => {})
    store.LISTEN_FOR_FILE_CHANGE()

    fire(captureHandler(), 'hello world')

    expect(notifySpy).toHaveBeenCalledTimes(1)
    expect(tab.isSaved).toBe(false)
  })
})
