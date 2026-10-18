import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const writeText = vi.hoisted(() => vi.fn())

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
    ipcRenderer: { send: () => {}, on: () => {} },
    clipboard: { writeText }
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import bus from '@/bus'
import { useProjectStore } from '@/store/project'

describe('sidebar "Copy Path" context menu action', () => {
  beforeEach(() => {
    // Drop listeners left by the previous test's store so each click is handled once.
    bus.off('SIDEBAR::copy-path')
    writeText.mockClear()
    setActivePinia(createPinia())
    useProjectStore().LISTEN_FOR_SIDEBAR_CONTEXT_MENU()
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
