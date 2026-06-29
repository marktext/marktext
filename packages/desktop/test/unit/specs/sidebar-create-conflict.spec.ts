import type * as FileSystemModule from '@/util/fileSystem'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// `@/store/project` reaches window.path (via @/config) and window.fileUtils at
// runtime. Stub the surfaces before the hoisted imports run.
vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string; normalize: (p: string) => string; basename: (p: string) => string; dirname: (p: string) => string }
      fileUtils?: { hasMarkdownExtension: (n: string) => boolean; pathExists: (p: string) => Promise<boolean> }
      electron?: { ipcRenderer: { send: (...a: unknown[]) => void; on: (...a: unknown[]) => void } }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', normalize: (p) => p, basename: (p) => p, dirname: (p) => p }
  w.window.fileUtils ??= {
    hasMarkdownExtension: (n: string) => n.endsWith('.md'),
    pathExists: () => Promise.resolve(false)
  }
  w.window.electron ??= { ipcRenderer: { send: () => {}, on: () => {} } }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

// Spy on the actual filesystem create so we can assert it never runs on a conflict.
vi.mock('@/util/fileSystem', async(orig) => {
  const actual = await orig<typeof FileSystemModule>()
  return { ...actual, create: vi.fn(() => Promise.resolve()) }
})

import { useProjectStore } from '@/store/project'
import { create } from '@/util/fileSystem'
import notice from '@/services/notification'

describe('CREATE_FILE_DIRECTORY — name conflict guard (#1946)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('does not create (overwrite) when a file with the same name exists; notifies instead', async() => {
    window.fileUtils.pathExists = vi.fn(() => Promise.resolve(true))
    const store = useProjectStore()
    store.createCache = { dirname: '/docs', type: 'file' }

    await store.CREATE_FILE_DIRECTORY('notes')

    expect(create).not.toHaveBeenCalled()
    expect(notice.notify).toHaveBeenCalledTimes(1)
  })

  it('creates the file when there is no conflict', async() => {
    window.fileUtils.pathExists = vi.fn(() => Promise.resolve(false))
    const store = useProjectStore()
    store.createCache = { dirname: '/docs', type: 'file' }

    await store.CREATE_FILE_DIRECTORY('fresh')

    expect(create).toHaveBeenCalledWith('/docs/fresh.md', 'file')
    expect(notice.notify).not.toHaveBeenCalled()
  })
})
