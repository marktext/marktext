import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import pathe from 'pathe'

// `@/store/layout` reads localStorage at module load; install a working stub
// before the store modules import.
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

// The renderer's `window.path` is `pathe` (`/` only), while watcher events carry
// OS-native separators — the Windows shape of #5683. Set this up before the
// project store module is imported.
const ipcListeners = new Map<string, (...args: unknown[]) => void>()
const win = globalThis as unknown as { window: Record<string, unknown> }
win.window = win.window ?? {}
win.window.marktext = { env: { windowId: 1 } }
win.window.DIRNAME = ''
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
win.window.electron = {
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

const { useProjectStore } = await import('@/store/project')

const NATIVE_ROOT = 'C:\\Users\\test\\proj'
const ROOT = pathe.normalize(NATIVE_ROOT)

// #5683 — creating a file built `newFileNameCache` from `window.path` (`/`) but
// the watcher reported the `add` with native separators, so the freshly created
// file was never loaded into the editor.
describe('sidebar new-file cache with Windows-native watcher events (#5683)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    ipcListeners.clear()
  })

  it('clears the pending-name cache when the watcher add uses native separators', () => {
    const store = useProjectStore()
    store.LISTEN_FOR_UPDATE_PROJECT()
    store.projectTree = {
      pathname: ROOT,
      name: 'proj',
      isDirectory: true,
      isFile: false,
      isMarkdown: false,
      folders: [],
      files: []
    }
    store.newFileNameCache = `${ROOT}/note.md`

    const handler = ipcListeners.get('mt::update-object-tree')
    expect(handler).toBeTruthy()
    handler!({}, {
      type: 'add',
      change: {
        pathname: `${NATIVE_ROOT}\\note.md`,
        isMarkdown: true,
        data: { markdown: '# note' }
      }
    })

    expect(store.newFileNameCache).toBe('')
  })
})
