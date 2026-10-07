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
        join: (...parts: string[]) => string
        normalize: (p: string) => string
        basename: (p: string) => string
        dirname: (p: string) => string
        isAbsolute: (p: string) => boolean
        relative: (from: string, to: string) => string
      }
      fileUtils?: {
        hasMarkdownExtension: (n: string) => boolean
        pathExists: (p: string) => Promise<boolean>
        move: (src: string, dest: string) => Promise<void>
        outputFile: (p: string, data: string) => Promise<void>
        ensureDir: (p: string) => Promise<void>
      }
      electron?: {
        ipcRenderer: {
          send: (...a: unknown[]) => void
          on: (...a: unknown[]) => void
          invoke: (...a: unknown[]) => Promise<unknown>
        }
      }
    }
  }
  const dirname = (p: string): string => p.split('/').slice(0, -1).join('/') || '/'
  w.window ??= {}
  w.window.marktext ??= { env: { windowId: 1 } }
  w.window.path ??= {
    sep: '/',
    join: (...parts) => parts.join('/'),
    normalize: (p) => p,
    basename: (p) => p.split('/').pop() ?? p,
    dirname,
    isAbsolute: (p) => p.startsWith('/'),
    relative: (from, to) => to.slice(from.length + 1)
  }
  w.window.fileUtils ??= {
    hasMarkdownExtension: (n) => n.endsWith('.md'),
    pathExists: () => Promise.resolve(false),
    move: () => Promise.resolve(),
    outputFile: () => Promise.resolve(),
    ensureDir: () => Promise.resolve()
  }
  w.window.electron ??= {
    ipcRenderer: { send: () => {}, on: () => {}, invoke: () => Promise.resolve(false) }
  }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import { useProjectStore } from '@/store/project'

// #3207 / #3385 — clicking or blurring away from the inline rename/create input
// accepts the edit (like Finder / Windows Explorer) instead of discarding it.
describe('sidebar name input commit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    window.fileUtils.move = vi.fn().mockResolvedValue(undefined)
    window.fileUtils.outputFile = vi.fn().mockResolvedValue(undefined)
    window.fileUtils.ensureDir = vi.fn().mockResolvedValue(undefined)
    window.fileUtils.pathExists = vi.fn().mockResolvedValue(false)
  })

  it('commits an open rename with the typed name', async() => {
    const store = useProjectStore()
    store.renameCache = '/docs/notes.md'
    store.nameInputValue = 'renamed.md'

    store.COMMIT_NAME_INPUT()

    await vi.waitFor(() => expect(window.fileUtils.move).toHaveBeenCalledTimes(1))
    expect(window.fileUtils.move).toHaveBeenCalledWith('/docs/notes.md', '/docs/renamed.md')
    await vi.waitFor(() => expect(store.renameCache).toBeNull())
  })

  it('commits an open file create with the typed name', async() => {
    const store = useProjectStore()
    store.createCache = { dirname: '/docs', type: 'file' }
    store.nameInputValue = 'note'

    store.COMMIT_NAME_INPUT()

    await vi.waitFor(() => expect(window.fileUtils.outputFile).toHaveBeenCalledTimes(1))
    expect(window.fileUtils.outputFile).toHaveBeenCalledWith('/docs/note.md', '')
  })

  it('drops an empty create without touching the filesystem', () => {
    const store = useProjectStore()
    store.createCache = { dirname: '/docs', type: 'file' }
    store.nameInputValue = ''

    store.COMMIT_NAME_INPUT()

    expect(window.fileUtils.outputFile).not.toHaveBeenCalled()
    expect(window.fileUtils.ensureDir).not.toHaveBeenCalled()
    expect(store.createCache).toEqual({})
  })

  it('is a no-op when no name input is open', () => {
    const store = useProjectStore()
    store.nameInputValue = 'stale'

    store.COMMIT_NAME_INPUT()

    expect(window.fileUtils.move).not.toHaveBeenCalled()
    expect(window.fileUtils.outputFile).not.toHaveBeenCalled()
  })
})
