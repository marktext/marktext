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
      fileUtils?: {
        hasMarkdownExtension: (n: string) => boolean
        pathExists: (p: string) => Promise<boolean>
        isSamePathSync: (a: string, b: string) => boolean
      }
      electron?: { ipcRenderer: { send: (...a: unknown[]) => void; on: (...a: unknown[]) => void } }
    }
  }
  const dirname = (p: string): string => p.split('/').slice(0, -1).join('/') || '/'
  w.window ??= {}
  w.window.marktext ??= { env: { windowId: 1 } }
  w.window.path ??= {
    sep: '/',
    normalize: (p) => p,
    basename: (p) => p.split('/').pop() ?? p,
    dirname,
    isAbsolute: (p) => p.startsWith('/'),
    relative: (from, to) => to.slice(from.length + 1)
  }
  w.window.fileUtils ??= {
    hasMarkdownExtension: (n) => n.endsWith('.md'),
    pathExists: () => Promise.resolve(false),
    isSamePathSync: (a, b) => a === b
  }
  w.window.electron ??= { ipcRenderer: { send: () => {}, on: () => {} } }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import { expandAncestors } from '@/store/treeCtrl'
import { useProjectStore } from '@/store/project'

interface FileFixture {
  pathname: string
  name: string
  isDirectory: false
  isFile: true
  isMarkdown: boolean
}

interface FolderFixture {
  pathname: string
  name: string
  isCollapsed?: boolean
  isDirectory: true
  isFile: false
  isMarkdown: false
  folders: FolderFixture[]
  files: FileFixture[]
}

const file = (pathname: string): FileFixture => ({
  pathname,
  name: pathname.split('/').pop() ?? pathname,
  isDirectory: false,
  isFile: true,
  isMarkdown: pathname.endsWith('.md')
})

const folder = (pathname: string, folders: FolderFixture[] = [], files: FileFixture[] = []): FolderFixture => ({
  pathname,
  name: pathname.split('/').pop() ?? pathname,
  isCollapsed: true,
  isDirectory: true,
  isFile: false,
  isMarkdown: false,
  folders,
  files
})

const folderNamed = (folders: FolderFixture[], pathname: string): FolderFixture => {
  const match = folders.find((child) => child.pathname === pathname)
  if (!match) throw new Error(`fixture folder not found: ${pathname}`)
  return match
}

const createTree = (): FolderFixture =>
  folder('/project', [
    folder('/project/a', [folder('/project/a/b', [], [file('/project/a/b/deep.md')])]),
    folder('/project/c', [], [file('/project/c/other.md')])
  ], [file('/project/root.md')])

describe('expandAncestors', () => {
  it('expands exactly the folders leading to the file', () => {
    const tree = createTree()

    const chain = expandAncestors(tree, '/project/a/b/deep.md')

    expect(chain?.map((f) => f.pathname)).toEqual(['/project/a', '/project/a/b'])
    expect(folderNamed(tree.folders, '/project/a').isCollapsed).toBe(false)
    expect(folderNamed(folderNamed(tree.folders, '/project/a').folders, '/project/a/b').isCollapsed).toBe(false)
    expect(folderNamed(tree.folders, '/project/c').isCollapsed).toBe(true)
  })

  it('returns an empty chain for a file next to the project root', () => {
    expect(expandAncestors(createTree(), '/project/root.md')).toEqual([])
  })

  it('is idempotent', () => {
    const tree = createTree()

    expect(expandAncestors(tree, '/project/a/b/deep.md')).toHaveLength(2)
    expect(expandAncestors(tree, '/project/a/b/deep.md')).toHaveLength(2)
    expect(folderNamed(tree.folders, '/project/a').folders).toHaveLength(1)
  })

  it('returns null for untracked paths', () => {
    expect(expandAncestors(createTree(), '/elsewhere/file.md')).toBe(null)
    expect(expandAncestors(createTree(), '/project/a/missing/file.md')).toBe(null)
    expect(expandAncestors(createTree(), '/project/a/b/other.md')).toBe(null)
  })

  it('leaves the folders alone when the file is not tracked', () => {
    const tree = createTree()

    expandAncestors(tree, '/project/a/b/other.md')

    expect(folderNamed(tree.folders, '/project/a').isCollapsed).toBe(true)
    expect(
      folderNamed(folderNamed(tree.folders, '/project/a').folders, '/project/a/b').isCollapsed
    ).toBe(true)
  })

  it('returns null for relative and empty paths', () => {
    expect(expandAncestors(createTree(), 'deep.md')).toBe(null)
    expect(expandAncestors(createTree(), '')).toBe(null)
  })
})

describe('project store REVEAL_PATH', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('expands the ancestors of a tracked file', () => {
    const store = useProjectStore()
    store.projectTree = createTree()

    expect(store.REVEAL_PATH('/project/a/b/deep.md')).toBe(true)
    expect(folderNamed(store.projectTree?.folders ?? [], '/project/a').isCollapsed).toBe(false)
  })

  it('reports untracked files without touching the tree', () => {
    const store = useProjectStore()
    store.projectTree = createTree()

    expect(store.REVEAL_PATH('/elsewhere/file.md')).toBe(false)
    expect(folderNamed(store.projectTree?.folders ?? [], '/project/a').isCollapsed).toBe(true)
    expect(store.REVEAL_PATH(null)).toBe(false)
  })
})
