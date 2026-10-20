import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const { writeText, invoke } = vi.hoisted(() => ({ writeText: vi.fn(), invoke: vi.fn() }))

// `@/store/layout` reads localStorage at module load. Node 25 exposes a global
// localStorage stub whose methods are missing, so install a working one before
// the store modules import.
vi.hoisted(() => {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear()
    }
  })

  const w = globalThis as unknown as { window?: Record<string, unknown> }
  w.window ??= {}
  w.window.marktext = { env: { windowId: 1 } }
  w.window.path = {
    sep: '/',
    normalize: (p: string) => p,
    basename: (p: string) => p.split('/').pop() ?? p,
    dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/'
  }
  w.window.electron = {
    ipcRenderer: { send: () => {}, on: () => {}, invoke },
    clipboard: { writeText }
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import bus from '@/bus'
import { useProjectStore } from '@/store/project'

describe('sidebar context menu listeners', () => {
  beforeEach(() => {
    // Drop listeners left by the previous test's store so each click is handled once.
    bus.off('SIDEBAR::copy-path')
    bus.off('SIDEBAR::remove')
    invoke.mockReset()
    invoke.mockResolvedValue(false)
    writeText.mockClear()
    setActivePinia(createPinia())
    useProjectStore().LISTEN_FOR_SIDEBAR_CONTEXT_MENU()
  })

  it('does not duplicate trash listeners when the editor registers again', () => {
    const store = useProjectStore()
    store.LISTEN_FOR_SIDEBAR_CONTEXT_MENU()
    store.CHANGE_ACTIVE_ITEM({ pathname: '/project/note.md', isFile: true, isDirectory: false })

    bus.emit('SIDEBAR::remove')

    expect(invoke).toHaveBeenCalledExactlyOnceWith('mt::fs-trash-item', '/project/note.md')
  })

  it('unsubscribes on unmount and registers once on the next mount', () => {
    const store = useProjectStore()
    const stop = store.LISTEN_FOR_SIDEBAR_CONTEXT_MENU()
    store.CHANGE_ACTIVE_ITEM({ pathname: '/project/note.md', isFile: true, isDirectory: false })
    stop()
    bus.emit('SIDEBAR::remove')
    expect(invoke).not.toHaveBeenCalled()

    store.LISTEN_FOR_SIDEBAR_CONTEXT_MENU()
    bus.emit('SIDEBAR::remove')
    expect(invoke).toHaveBeenCalledExactlyOnceWith('mt::fs-trash-item', '/project/note.md')
  })

  it('unsubscribes when the project store is disposed', () => {
    const store = useProjectStore()
    store.CHANGE_ACTIVE_ITEM({ pathname: '/project/note.md', isFile: true, isDirectory: false })
    store.$dispose()

    bus.emit('SIDEBAR::remove')

    expect(invoke).not.toHaveBeenCalled()
  })

  it('copies the absolute path of the right-clicked file', () => {
    const store = useProjectStore()
    store.CHANGE_ACTIVE_ITEM({
      pathname: '/project/docs/notes.md',
      isFile: true,
      isDirectory: false
    })

    bus.emit('SIDEBAR::copy-path')

    expect(writeText).toHaveBeenCalledExactlyOnceWith('/project/docs/notes.md')
  })

  it('copies the absolute path of the right-clicked folder', () => {
    const store = useProjectStore()
    store.CHANGE_ACTIVE_ITEM({ pathname: '/project/docs', isFile: false, isDirectory: true })

    bus.emit('SIDEBAR::copy-path')

    expect(writeText).toHaveBeenCalledExactlyOnceWith('/project/docs')
  })

  it('leaves the clipboard alone when nothing is selected', () => {
    bus.emit('SIDEBAR::copy-path')

    expect(writeText).not.toHaveBeenCalled()
  })
})
