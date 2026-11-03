import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.hoisted(() => {
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

import { expandAncestors, findTreeNode } from '@/store/treeCtrl'
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

describe('findTreeNode path identity', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(['/PROJECT', '/project/A', '/project/a/b/DEEP.md'])('matches %s on a case-insensitive filesystem', pathname => {
    vi.spyOn(window.fileUtils, 'isSamePathSync').mockImplementation((a, b) => a.toLowerCase() === b.toLowerCase())
    const tree = createTree()
    const node = findTreeNode(tree, pathname)
    expect(node?.pathname).toBe(pathname.toLowerCase())
  })

  it('keeps differently cased paths distinct on a case-sensitive filesystem', () => {
    vi.spyOn(window.fileUtils, 'isSamePathSync').mockImplementation((a, b) => a === b)
    const tree = createTree()
    tree.files.push(file('/project/ROOT.md'))
    expect(findTreeNode(tree, '/project/root.md')).toBe(tree.files[0])
    expect(findTreeNode(tree, '/project/ROOT.md')).toBe(tree.files[1])
    expect(findTreeNode(tree, '/project/Root.md')).toBeUndefined()
  })

  it('finds a differently cased file before revealing its ancestors', () => {
    vi.spyOn(window.fileUtils, 'isSamePathSync').mockImplementation((a, b) => a.toLowerCase() === b.toLowerCase())
    setActivePinia(createPinia())
    const store = useProjectStore()
    const tree = createTree()
    store.APPLY_ROOTS({ revision: 1, roots: [{ key: tree.pathname, pathname: tree.pathname, watchToken: 'root', status: 'ready' }], reason: 'restore' })
    store.roots[0].tree = tree

    expect(store.FIND_TREE_NODE('/project/a/b/DEEP.md')?.pathname).toBe('/project/a/b/deep.md')
    expect(store.REVEAL_PATH('/project/a/b/DEEP.md')).toBe(true)
    expect(store.roots[0].tree.folders[0].folders[0].isCollapsed).toBe(false)
    expect(store.roots[0].tree.folders[1].isCollapsed).toBe(true)
  })
})

describe('expandAncestors', () => {
  it('reveals a folder without expanding that folder or unrelated branches', () => {
    const tree = createTree()
    const chain = expandAncestors(tree, '/project/a/b')
    expect(chain?.map(folder => folder.pathname)).toEqual(['/project/a'])
    expect(tree.folders[0].isCollapsed).toBe(false)
    expect(tree.folders[0].folders[0].isCollapsed).toBe(true)
    expect(tree.folders[1].isCollapsed).toBe(true)
  })
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
    const restoredTree = createTree()
    store.APPLY_ROOTS({ revision: 1, roots: [{ key: restoredTree.pathname, pathname: restoredTree.pathname, watchToken: 'root', status: 'ready' }], reason: 'restore' })
    store.roots[0].tree = restoredTree

    expect(store.REVEAL_PATH('/project/a/b/deep.md')).toBe(true)
    expect(folderNamed(store.projectTree?.folders ?? [], '/project/a').isCollapsed).toBe(false)
  })

  it('reports untracked files without touching the tree', () => {
    const store = useProjectStore()
    const restoredTree = createTree()
    store.APPLY_ROOTS({ revision: 1, roots: [{ key: restoredTree.pathname, pathname: restoredTree.pathname, watchToken: 'root', status: 'ready' }], reason: 'restore' })
    store.roots[0].tree = restoredTree

    expect(store.REVEAL_PATH('/elsewhere/file.md')).toBe(false)
    expect(folderNamed(store.projectTree?.folders ?? [], '/project/a').isCollapsed).toBe(true)
    expect(store.REVEAL_PATH(null)).toBe(false)
  })
})
