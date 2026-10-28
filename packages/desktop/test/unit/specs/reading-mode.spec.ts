import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

import { useEditorStore, setSessionActions } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { createDocumentState } from '@/store/help'
import { registerDocumentView } from '@/services/documentMode'
import notice from '@/services/notification'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  setSessionActions(null)
  registerDocumentView(null)
  vi.useRealTimers()
})

describe('per-tab reading state', () => {
  it('retains dirty content and cancels a scheduled auto save before locking', async() => {
    const store = useEditorStore()
    const preferences = usePreferencesStore()
    preferences.autoSave = true
    const save = vi.fn(async() => ({ status: 'failed' } as const))
    setSessionActions({ save, checkpoint: vi.fn(), scheduleCheckpoint: vi.fn(), captureView: vi.fn(), create: vi.fn(), close: vi.fn(), saveAll: vi.fn() })
    const tab = createDocumentState({
      pathname: '/notes/a.md',
      markdown: 'retained',
      isSaved: false
    })
    store.tabs = [tab]
    store.currentFile = tab
    store.updateTabIdToIndex()
    store.HANDLE_AUTO_SAVE(tab)
    await store.SET_READ_ONLY(tab.id, true)
    await vi.advanceTimersByTimeAsync(2000)
    expect(tab.readOnly).toBe(true)
    expect(tab.markdown).toBe('retained')
    expect(tab.isSaved).toBe(false)
    store.FILE_SAVE()
    store.FILE_SAVE_AS()
    expect(save).not.toHaveBeenCalled()
    store.LISTEN_FOR_CONTENT_CHANGE({ id: tab.id, markdown: 'late async change' })
    expect(tab.markdown).toBe('retained')
  })

  it('restores the editor and reports failure even when rollback IPC also fails', async() => {
    const store = useEditorStore()
    const tab = createDocumentState({ markdown: 'retained', isSaved: false })
    store.tabs = [tab]
    store.currentFile = tab
    const setReadOnly = vi.fn()
    registerDocumentView(setReadOnly)
    const error = new Error('IPC disconnected')
    const invoke = vi.mocked(window.electron.ipcRenderer.invoke)
    invoke.mockRejectedValueOnce(error).mockRejectedValueOnce(error)
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(store.SET_READ_ONLY(tab.id, true)).resolves.toBeUndefined()
      expect(tab.readOnly).toBe(false)
      expect(tab.modeChanging).toBe(false)
      expect(setReadOnly).toHaveBeenCalledWith(false)
      expect(notice.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    } finally {
      logged.mockRestore()
    }
  })

})
