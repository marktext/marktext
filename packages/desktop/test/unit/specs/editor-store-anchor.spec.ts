import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// `@/store/editor` transitively imports `@/config`, which reads
// `window.path.sep` at module load (normally injected by the preload bridge).
// It also reaches `window.electron.clipboard` / `window.electron.ipcRenderer`
// at runtime. Stub the surfaces before the hoisted imports run.
vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string; dirname: (p: string) => string }
      electron?: {
        clipboard: { writeText: (s: string) => void }
        ipcRenderer: { send: (...a: unknown[]) => void; on: (...a: unknown[]) => void }
      }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p }
  w.window.electron ??= {
    clipboard: { writeText: () => {} },
    ipcRenderer: { send: () => {}, on: () => {} }
  }
})

// The notification service touches the DOM / template HTML; stub it so we can
// observe `notify` without rendering a toast.
vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import { useEditorStore } from '@/store/editor'
import bus from '@/bus'
import notice from '@/services/notification'

describe('useEditorStore FORMAT_LINK_CLICK (anchor links)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('emits scroll-to-header with the matching block slug for an in-doc anchor', () => {
    const store = useEditorStore()
    store.listToc = [{ githubSlug: 'installation', slug: 'uid-1', lvl: 2 }]

    const emitSpy = vi.spyOn(bus, 'emit')
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.FORMAT_LINK_CLICK({ data: { href: '#installation' }, dirname: '' })

    expect(emitSpy).toHaveBeenCalledWith('scroll-to-header', 'uid-1')
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('does nothing for an anchor that matches no TOC github-slug and no DOM id', () => {
    const store = useEditorStore()
    store.listToc = [{ githubSlug: 'installation', slug: 'uid-1', lvl: 2 }]

    const emitSpy = vi.spyOn(bus, 'emit')
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')
    const getByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue(null)

    store.FORMAT_LINK_CLICK({ data: { href: '#nope' }, dirname: '' })

    expect(emitSpy).not.toHaveBeenCalled()
    expect(sendSpy).not.toHaveBeenCalled()
    getByIdSpy.mockRestore()
  })

  // marktext #3609: `[text](#id)` where `#id` is a custom `<a id="id">` (not a
  // heading) was silently swallowed — it isn't in the TOC. Fall back to the DOM.
  it('emits scroll-to-anchor-element for a non-heading anchor id found in the DOM', () => {
    const store = useEditorStore()
    store.listToc = [{ githubSlug: 'installation', slug: 'uid-1', lvl: 2 }]

    const fakeEl = document.createElement('a')
    const getByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue(fakeEl)
    const emitSpy = vi.spyOn(bus, 'emit')
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.FORMAT_LINK_CLICK({ data: { href: '#jump' }, dirname: '' })

    expect(getByIdSpy).toHaveBeenCalledWith('jump')
    expect(emitSpy).toHaveBeenCalledWith('scroll-to-anchor-element', fakeEl)
    expect(sendSpy).not.toHaveBeenCalled()
    getByIdSpy.mockRestore()
  })

  it('ignores a bare "#" (empty anchor slug) without emit or IPC', () => {
    const store = useEditorStore()
    store.listToc = [{ githubSlug: 'installation', slug: 'uid-1', lvl: 2 }]

    const emitSpy = vi.spyOn(bus, 'emit')
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.FORMAT_LINK_CLICK({ data: { href: '#' }, dirname: '' })

    expect(emitSpy).not.toHaveBeenCalled()
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('forwards a non-anchor link to the main process over IPC', () => {
    const store = useEditorStore()
    store.listToc = [{ githubSlug: 'installation', slug: 'uid-1', lvl: 2 }]

    const emitSpy = vi.spyOn(bus, 'emit')
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    const payload = { data: { href: 'http://x' }, dirname: '/docs' }
    store.FORMAT_LINK_CLICK(payload)

    expect(emitSpy).not.toHaveBeenCalledWith('scroll-to-header', expect.anything())
    expect(sendSpy).toHaveBeenCalledWith('mt::format-link-click', {
      data: { href: 'http://x' },
      dirname: '/docs'
    })
  })
})

describe('useEditorStore copyGithubSlug', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('copies "#<githubSlug>" of the matched block id to the clipboard and notifies', () => {
    const store = useEditorStore()
    store.listToc = [{ slug: 'uid-1', githubSlug: 'getting-started', lvl: 2 }]

    const writeSpy = vi.spyOn(window.electron.clipboard, 'writeText')

    store.copyGithubSlug('uid-1')

    expect(writeSpy).toHaveBeenCalledWith('#getting-started')
    expect(notice.notify).toHaveBeenCalledTimes(1)
  })

  it('does nothing (no clipboard write, no notify) when the id is not in the TOC', () => {
    const store = useEditorStore()
    store.listToc = [{ slug: 'uid-1', githubSlug: 'getting-started', lvl: 2 }]

    const writeSpy = vi.spyOn(window.electron.clipboard, 'writeText')

    store.copyGithubSlug('missing')

    expect(writeSpy).not.toHaveBeenCalled()
    expect(notice.notify).not.toHaveBeenCalled()
  })
})

describe('useEditorStore EXPORT (title derivation from listToc)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // currentFile is IFileState; EXPORT only reads { filename, pathname }.
  const setCurrentFile = (store: ReturnType<typeof useEditorStore>) => {
    store.currentFile = {
      filename: 'notes.md',
      pathname: '/x/notes.md'
    } as unknown as typeof store.currentFile
  }

  it('picks the shallowest heading and breaks early when a lvl-1 is reached', () => {
    const store = useEditorStore()
    setCurrentFile(store)
    store.listToc = [
      { lvl: 2, content: 'Sub' },
      { lvl: 1, content: 'Top' }
    ]

    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.EXPORT({ type: 'pdf', pageOptions: {} })

    expect(sendSpy).toHaveBeenCalledTimes(1)
    const [channel, payload] = sendSpy.mock.calls[0]
    expect(channel).toBe('mt::response-export')
    expect(payload).toMatchObject({
      type: 'pdf',
      title: 'Top',
      content: '',
      filename: 'notes.md',
      pathname: '/x/notes.md',
      pageOptions: {}
    })
  })

  it('keeps the first lvl-1 heading and ignores later shallower entries (loop break)', () => {
    const store = useEditorStore()
    setCurrentFile(store)
    // headerRef starts lvl-1 -> loop breaks on first iteration, later lvl-0 ignored.
    store.listToc = [
      { lvl: 1, content: 'First' },
      { lvl: 0, content: 'Shallower-but-skipped' }
    ]

    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.EXPORT({ type: 'pdf', pageOptions: {} })

    expect(sendSpy.mock.calls[0][1]).toMatchObject({ title: 'First' })
  })

  it('sends an empty title when listToc is empty', () => {
    const store = useEditorStore()
    setCurrentFile(store)
    store.listToc = []

    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.EXPORT({ type: 'pdf', pageOptions: {} })

    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy.mock.calls[0][1]).toMatchObject({ title: '' })
  })

  it('sends no IPC when currentFile is null (guard)', () => {
    const store = useEditorStore()
    store.currentFile = null
    store.listToc = [{ lvl: 1, content: 'Top' }]

    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.EXPORT({ type: 'pdf', pageOptions: {} })

    expect(sendSpy).not.toHaveBeenCalled()
  })
})
