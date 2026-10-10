import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import * as win32 from '@jsr/std__path/windows'
import { createPlatformPath } from 'common/filesystem/platformPath'

// Path-consistency gate for the "native window.path" follow-up (#5683): drive
// the real stores with a Windows path module so every path the renderer builds
// is byte-identical to the native paths the watcher/main send. If this holds,
// the separator-normalization patches (`isSamePath` at these sites,
// `toNativePath`, `isPathWithinRoot` folding) are redundant and can be dropped.

// `@/store/layout` reads localStorage at module load; stub before the stores
// are imported below.
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
})

const ipcListeners = new Map<string, (...args: unknown[]) => void>()
const win = globalThis as unknown as { window: Record<string, unknown> }
win.window = win.window ?? {}
win.window.marktext = { env: { windowId: 1 } }
win.window.DIRNAME = ''
win.window.path = {
  sep: win32.SEPARATOR,
  delimiter: win32.DELIMITER,
  normalize: (p: string) => win32.normalize(p),
  dirname: (p: string) => win32.dirname(p),
  basename: (p: string, ext?: string) => win32.basename(p, ext),
  extname: (p: string) => win32.extname(p),
  join: (...parts: string[]) => win32.join(...parts),
  resolve: (...parts: string[]) => win32.resolve(...parts),
  isAbsolute: (p: string) => win32.isAbsolute(p),
  relative: (from: string, to: string) => win32.relative(from, to)
}
win.window.fileUtils = {
  MARKDOWN_INCLUSIONS: ['*.md'],
  hasMarkdownExtension: (name: string) => name.toLowerCase().endsWith('.md'),
  isSamePathSync: (a: string, b: string) =>
    !!a && !!b && win32.normalize(a).toLowerCase() === win32.normalize(b).toLowerCase(),
  pathExists: () => Promise.resolve(false),
  move: () => Promise.resolve(),
  outputFile: () => Promise.resolve(),
  ensureDir: () => Promise.resolve()
}
win.window.electron = {
  process: { platform: 'win32', env: {} },
  clipboard: { writeText: () => {} },
  ipcRenderer: {
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      ipcListeners.set(channel, callback)
    },
    send: () => {},
    invoke: () => Promise.resolve(false)
  }
}

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

const treeCtrl = await import('@/store/treeCtrl')
const { useProjectStore } = await import('@/store/project')
const { useEditorStore } = await import('@/store/editor')
const { isPathWithinRoot, shouldTrashSelection } = await import('@/components/sideBar/trashKey')

const NATIVE_ROOT = 'C:\\Users\\test\\proj'
const ROOT = win32.normalize(NATIVE_ROOT)

interface TestFolder {
  pathname: string
  name: string
  isDirectory: true
  isFile: false
  isMarkdown: false
  folders: TestFolder[]
  files: TestFile[]
}
interface TestFile {
  pathname: string
  name: string
  isFile: true
  isDirectory: false
  isMarkdown: boolean
}

const makeTree = (): TestFolder => ({
  pathname: ROOT,
  name: 'proj',
  isDirectory: true,
  isFile: false,
  isMarkdown: false,
  folders: [],
  files: []
})

const markdownFile = (pathname: string, mtimeMs = 0): TestFile & { mtimeMs: number } => ({
  pathname,
  name: win32.basename(pathname),
  isFile: true,
  isDirectory: false,
  isMarkdown: true,
  mtimeMs
})

describe('path consistency with a native win32 window.path (#5683)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ipcListeners.clear()
  })

  it('builds folder/file node paths byte-identical to the watcher paths', () => {
    const tree = makeTree()
    treeCtrl.addDirectory(tree as never, { pathname: `${NATIVE_ROOT}\\pkg` })
    treeCtrl.addFile(tree as never, markdownFile(`${NATIVE_ROOT}\\pkg\\a.md`) as never)

    // Raw `===` matches: no separator folding required.
    expect(tree.folders[0].pathname).toBe(`${NATIVE_ROOT}\\pkg`)
    expect((tree.folders[0].files[0] as TestFile).pathname).toBe(`${NATIVE_ROOT}\\pkg\\a.md`)
  })

  it('renames and removes folders/files with plain path equality', () => {
    const tree = makeTree()
    treeCtrl.addDirectory(tree as never, { pathname: `${NATIVE_ROOT}\\pkg` })
    treeCtrl.addFile(tree as never, markdownFile(`${NATIVE_ROOT}\\pkg\\a.md`) as never)

    treeCtrl.unlinkDirectory(tree as never, { pathname: `${NATIVE_ROOT}\\pkg` })
    treeCtrl.addDirectory(tree as never, { pathname: `${NATIVE_ROOT}\\pkg2` })
    treeCtrl.addFile(tree as never, markdownFile(`${NATIVE_ROOT}\\a.md`) as never)
    treeCtrl.unlinkFile(tree as never, { pathname: `${NATIVE_ROOT}\\a.md` })

    expect(tree.folders.map((f) => f.name)).toEqual(['pkg2'])
    expect(tree.files).toHaveLength(0)
  })

  it('finds a file for an mtime update by its native path', () => {
    const tree = makeTree()
    const file = markdownFile(`${NATIVE_ROOT}\\a.md`, 1)
    treeCtrl.addFile(tree as never, file as never)

    treeCtrl.updateFileMtime(tree as never, { pathname: `${NATIVE_ROOT}\\a.md`, mtimeMs: 42 }, 'modified', 'asc')

    expect((tree.files[0] as TestFile & { mtimeMs: number }).mtimeMs).toBe(42)
  })

  it('creates a file with the native separator and matches the watcher add', async() => {
    const store = useProjectStore()
    store.LISTEN_FOR_UPDATE_PROJECT()
    store.projectTree = makeTree() as never
    store.createCache = { dirname: ROOT, type: 'file' }

    await store.CREATE_FILE_DIRECTORY('note')

    const nativeNew = `${NATIVE_ROOT}\\note.md`
    expect(store.newFileNameCache).toBe(nativeNew)

    const handler = ipcListeners.get('mt::update-object-tree')
    expect(handler).toBeTruthy()
    handler!({}, {
      type: 'add',
      change: { pathname: nativeNew, isMarkdown: true, data: { markdown: '# note' } }
    })
    expect(store.newFileNameCache).toBe('')
  })

  it('renames tabs and tracks save status by native path', () => {
    const store = useEditorStore()
    const oldPath = `${NATIVE_ROOT}\\a.md`
    const newPath = `${NATIVE_ROOT}\\renamed.md`
    store.tabs = [{ id: 't1', pathname: oldPath, filename: 'a.md', isSaved: true }] as never

    store.RENAME_IF_NEEDED({ src: oldPath, dest: newPath })
    expect(store.tabs[0].pathname).toBe(newPath)

    store.SET_SAVE_STATUS_WHEN_REMOVE({ pathname: newPath })
    expect(store.tabs[0].isSaved).toBe(false)
  })

  it('stops a second rename of the same file from re-matching', () => {
    const store = useEditorStore()
    const path1 = `${NATIVE_ROOT}\\a.md`
    const path2 = `${NATIVE_ROOT}\\b.md`
    store.tabs = [{ id: 't1', pathname: path1, filename: 'a.md', isSaved: true }] as never

    store.RENAME_IF_NEEDED({ src: path1, dest: path2 })
    store.RENAME_IF_NEEDED({ src: path2, dest: `${NATIVE_ROOT}\\c.md` })

    expect(store.tabs[0].pathname).toBe(`${NATIVE_ROOT}\\c.md`)
  })

  it('keeps the Delete/F2 root guard working with native paths', () => {
    expect(isPathWithinRoot(`${NATIVE_ROOT}\\a.md`, ROOT, win32.SEPARATOR)).toBe(true)
    expect(isPathWithinRoot(`${NATIVE_ROOT}\\sub\\a.md`, ROOT, win32.SEPARATOR)).toBe(true)
    expect(isPathWithinRoot('C:\\Users\\other\\a.md', ROOT, win32.SEPARATOR)).toBe(false)
    expect(
      shouldTrashSelection({
        key: 'Delete',
        metaKey: false,
        isMac: false,
        selection: { pathname: `${NATIVE_ROOT}\\a.md`, isFile: true },
        projectRootPath: ROOT,
        pathSeparator: win32.SEPARATOR,
        isEditingName: false,
        editableTarget: false
      })
    ).toBe(true)
  })
})

// `common/*` helpers such as `common/envPaths` import the bare `path` specifier,
// which the renderer build aliases to a module backed by `createPlatformPath`.
// Both branches must produce the matching platform representation.
describe('createPlatformPath', () => {
  it('picks a native win32 implementation on Windows', () => {
    const path = createPlatformPath(true)
    expect(path.sep).toBe('\\')
    expect(path.delimiter).toBe(';')
    expect(path.join('C:/Users/test/proj', 'pkg')).toBe('C:\\Users\\test\\proj\\pkg')
    expect(path.normalize('C:/Users/test/proj')).toBe('C:\\Users\\test\\proj')
    expect(path.relative('C:\\a\\b', 'C:\\a\\b\\c')).toBe('c')
    expect(path.basename('C:\\a\\b\\c.md')).toBe('c.md')
  })

  it('keeps POSIX behavior elsewhere', () => {
    const path = createPlatformPath(false)
    expect(path.sep).toBe('/')
    expect(path.delimiter).toBe(':')
    expect(path.join('/a/b', 'c')).toBe('/a/b/c')
  })
})
