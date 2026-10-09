import { describe, expect, it } from 'vitest'
import pathe from 'pathe'

// The sandboxed renderer only gets `pathe`, which always uses `/` separators
// (see `src/preload/index.ts`), while the main-process watcher emits
// native-separator paths. These specs feed the tree helpers the Windows shape of
// that mismatch: a `/`-normalized project root plus `\` watcher events (#5683).
const win = globalThis as unknown as { window: Record<string, unknown> }
win.window = win.window ?? {}
win.window.marktext = { env: { windowId: 1 } }
win.window.path = {
  sep: pathe.sep,
  normalize: (p: string) => pathe.normalize(p),
  dirname: (p: string) => pathe.dirname(p),
  basename: (p: string) => pathe.basename(p),
  extname: (p: string) => pathe.extname(p),
  join: (...parts: string[]) => pathe.join(...parts),
  isAbsolute: (p: string) => pathe.isAbsolute(p),
  relative: (from: string, to: string) => pathe.relative(from, to)
}
win.window.fileUtils = {
  hasMarkdownExtension: (name: string) => name.toLowerCase().endsWith('.md'),
  isSamePathSync: (a: string, b: string) => !!a && !!b && pathe.normalize(a) === pathe.normalize(b)
}

const { addDirectory, addFile, unlinkDirectory, unlinkFile } = await import('@/store/treeCtrl')

const NATIVE_ROOT = 'C:\\Users\\test\\proj'
const ROOT = pathe.normalize(NATIVE_ROOT)

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

const markdownFile = (pathname: string): TestFile => ({
  pathname,
  name: pathe.basename(pathname),
  isFile: true,
  isDirectory: false,
  isMarkdown: true
})

describe('sidebar tree with Windows-native watcher events (#5683)', () => {
  it('replaces a renamed folder instead of leaving the old node behind', () => {
    const tree = makeTree()
    addDirectory(tree as never, { pathname: `${NATIVE_ROOT}\\pkg` })
    addFile(tree as never, markdownFile(`${NATIVE_ROOT}\\pkg\\a.md`) as never)
    expect(tree.folders.map((f) => f.name)).toEqual(['pkg'])

    // Rename: chokidar reports the old folder with `\`, the renderer stored it
    // with `/`. The `addDir` for the new name must not leave `pkg` around.
    unlinkDirectory(tree as never, { pathname: `${NATIVE_ROOT}\\pkg` })
    addDirectory(tree as never, { pathname: `${NATIVE_ROOT}\\pkg2` })

    expect(tree.folders.map((f) => f.name)).toEqual(['pkg2'])
  })

  it('removes a folder whose watcher event uses native separators', () => {
    const tree = makeTree()
    addDirectory(tree as never, { pathname: `${NATIVE_ROOT}\\pkg` })

    unlinkDirectory(tree as never, { pathname: `${NATIVE_ROOT}\\pkg` })

    expect(tree.folders).toHaveLength(0)
  })

  it('removes a file whose watcher event uses native separators', () => {
    const tree = makeTree()
    addFile(tree as never, markdownFile(`${NATIVE_ROOT}\\a.md`) as never)

    unlinkFile(tree as never, { pathname: `${NATIVE_ROOT}\\a.md` })

    expect(tree.files).toHaveLength(0)
  })
})
