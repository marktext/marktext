import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

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
  const win = w.window as Record<string, unknown>
  win.marktext ??= { env: { windowId: 1 } }
  win.path ??= {
    sep: '/',
    normalize: (p: string) => p,
    basename: (p: string) => p.split('/').pop() ?? p,
    dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/',
    isAbsolute: (p: string) => p.startsWith('/'),
    relative: (from: string, to: string) => to.slice(from.length + 1)
  }
  win.fileUtils ??= {
    hasMarkdownExtension: (n: string) => n.endsWith('.md'),
    pathExists: () => Promise.resolve(false)
  }
  win.electron ??= {
    ipcRenderer: { send: () => {}, on: () => {}, invoke: () => Promise.resolve(false) },
    shell: { showItemInFolder: () => {} }
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import bus from '@/bus'
import { useProjectStore } from '@/store/project'

const renderer = globalThis as unknown as {
  window: { electron: { ipcRenderer: { invoke: (channel: string, pathname: string) => Promise<boolean> } } }
}

describe('SIDEBAR::remove selection lifetime', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps the selection when the confirmation is cancelled, so the key can retry', async() => {
    const invoke = vi.fn().mockResolvedValue(false)
    renderer.window.electron.ipcRenderer.invoke = invoke
    const store = useProjectStore()
    store.LISTEN_FOR_SIDEBAR_CONTEXT_MENU()
    store.CHANGE_ACTIVE_ITEM({ pathname: '/project-a/notes.md', isFile: true })

    bus.emit('SIDEBAR::remove')
    await vi.waitFor(() => expect(invoke).toHaveBeenCalled())

    expect(invoke).toHaveBeenCalledWith('mt::fs-trash-item', '/project-a/notes.md')
    expect(store.activeItem.pathname).toBe('/project-a/notes.md')
  })

  it('drops the selection once the item reaches the trash', async() => {
    const invoke = vi.fn().mockResolvedValue(true)
    renderer.window.electron.ipcRenderer.invoke = invoke
    const store = useProjectStore()
    store.LISTEN_FOR_SIDEBAR_CONTEXT_MENU()
    store.CHANGE_ACTIVE_ITEM({ pathname: '/project-a/notes.md', isFile: true })

    bus.emit('SIDEBAR::remove')

    await vi.waitFor(() => expect(store.activeItem).toEqual({}))
  })
})
