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

  const w = globalThis as unknown as {
    window?: {
      marktext?: { env?: { windowId?: number } }
      path?: {
        sep: string
        normalize: (p: string) => string
        basename: (p: string) => string
        dirname: (p: string) => string
        isAbsolute: (p: string) => boolean
        relative: (from: string, to: string) => string
      }
      fileUtils?: { hasMarkdownExtension: (n: string) => boolean; pathExists: (p: string) => Promise<boolean> }
      electron?: { ipcRenderer: { send: (...a: unknown[]) => void; on: (...a: unknown[]) => void } }
    }
  }
  w.window ??= {}
  w.window.marktext ??= { env: { windowId: 1 } }
  w.window.path ??= {
    sep: '/',
    normalize: (p) => p,
    basename: (p) => p.split('/').pop() ?? p,
    dirname: (p) => p.split('/').slice(0, -1).join('/') || '/',
    isAbsolute: (p) => p.startsWith('/'),
    relative: (from, to) => to.slice(from.length + 1)
  }
  w.window.fileUtils ??= {
    hasMarkdownExtension: (n) => n.endsWith('.md'),
    pathExists: () => Promise.resolve(false)
  }
  w.window.electron ??= { ipcRenderer: { send: () => {}, on: () => {} } }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import { useProjectStore } from '@/store/project'

describe('OPEN_PROJECT resets sidebar state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('drops the previous project selection and input caches', () => {
    const store = useProjectStore()

    store.OPEN_PROJECT('/project-a')
    store.CHANGE_ACTIVE_ITEM({ pathname: '/project-a/notes.md', isFile: true, isDirectory: false })
    store.createCache = { dirname: '/project-a', type: 'file' }
    store.renameCache = '/project-a/notes.md'

    expect(store.activeItem.pathname).toBe('/project-a/notes.md')

    store.OPEN_PROJECT('/project-b')

    expect(store.activeItem).toEqual({})
    expect(store.createCache).toEqual({})
    expect(store.renameCache).toBeNull()
    expect(store.projectTree?.pathname).toBe('/project-b')
  })
})
