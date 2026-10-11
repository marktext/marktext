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

  it('matches a percent-encoded anchor against the decoded github-slug (#5292)', () => {
    const store = useEditorStore()
    store.listToc = [{ githubSlug: '中文标题', slug: 'uid-1', lvl: 2 }]

    const emitSpy = vi.spyOn(bus, 'emit')

    store.FORMAT_LINK_CLICK({
      data: { href: '#%E4%B8%AD%E6%96%87%E6%A0%87%E9%A2%98' },
      dirname: ''
    })

    expect(emitSpy).toHaveBeenCalledWith('scroll-to-header', 'uid-1')
  })

  it('falls back to the raw anchor when it is not valid percent-encoding', () => {
    const store = useEditorStore()
    store.listToc = [{ githubSlug: '100%', slug: 'uid-1', lvl: 2 }]

    const emitSpy = vi.spyOn(bus, 'emit')

    expect(() => store.FORMAT_LINK_CLICK({ data: { href: '#100%' }, dirname: '' })).not.toThrow()
    expect(emitSpy).toHaveBeenCalledWith('scroll-to-header', 'uid-1')
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

// The TOC only becomes the target document's once editor.vue handles the
// tab-activation events; `seedTocOn` stands in for that.
describe('useEditorStore cross-file anchor links (#5292)', () => {
  const targetToc = [{ githubSlug: 'english-section', slug: 'uid-9', lvl: 2 }]
  const seedTocOn = (event: 'file-changed' | 'file-loaded') => {
    const store = useEditorStore()
    const handler = () => {
      store.listToc = targetToc
    }
    bus.on(event, handler)
    return () => bus.off(event, handler)
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('scrolls to the anchor after switching to the already-open target tab', () => {
    const store = useEditorStore()
    store.tabs = [
      { id: 'tab-2', pathname: '/docs/other.md', markdown: '# Other' }
    ] as unknown as typeof store.tabs
    store.listToc = [{ githubSlug: 'english-section', slug: 'stale', lvl: 2 }]
    const off = seedTocOn('file-changed')
    const emitSpy = vi.spyOn(bus, 'emit')

    store.SWITCH_TAB_BY_FILEPATH('/docs/other.md', { anchor: 'english-section' })
    off()

    expect(emitSpy).toHaveBeenCalledWith('file-changed', expect.objectContaining({ id: 'tab-2' }))
    expect(emitSpy).toHaveBeenLastCalledWith('scroll-to-header', 'uid-9')
  })

  it('does not scroll when the switch carries no anchor', () => {
    const store = useEditorStore()
    store.tabs = [
      { id: 'tab-2', pathname: '/docs/other.md', markdown: '# Other' }
    ] as unknown as typeof store.tabs
    const off = seedTocOn('file-changed')
    const emitSpy = vi.spyOn(bus, 'emit')

    store.SWITCH_TAB_BY_FILEPATH('/docs/other.md')
    off()

    expect(emitSpy).not.toHaveBeenCalledWith('scroll-to-header', expect.anything())
  })

  it('scrolls to the anchor once a newly opened tab has loaded', () => {
    const w = window as unknown as {
      fileUtils?: { isSamePathSync: (a: string, b: string) => boolean }
    }
    w.fileUtils ??= { isSamePathSync: (a, b) => a === b }
    const store = useEditorStore()
    const off = seedTocOn('file-loaded')
    const emitSpy = vi.spyOn(bus, 'emit')

    store.NEW_TAB_WITH_CONTENT({
      markdownDocument: {
        markdown: '# Other',
        filename: 'other.md',
        pathname: '/docs/other.md'
      } as unknown as Parameters<typeof store.NEW_TAB_WITH_CONTENT>[0]['markdownDocument'],
      options: { anchor: 'english-section' },
      selected: true
    })
    off()

    expect(emitSpy).toHaveBeenLastCalledWith('scroll-to-header', 'uid-9')
    expect(store.currentFile).not.toHaveProperty('anchor')
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
