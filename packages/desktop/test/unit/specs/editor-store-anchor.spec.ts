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

  it('does nothing for an anchor that matches no TOC github-slug', () => {
    const store = useEditorStore()
    store.listToc = [{ githubSlug: 'installation', slug: 'uid-1', lvl: 2 }]

    const emitSpy = vi.spyOn(bus, 'emit')
    const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')

    store.FORMAT_LINK_CLICK({ data: { href: '#nope' }, dirname: '' })

    expect(emitSpy).not.toHaveBeenCalled()
    expect(sendSpy).not.toHaveBeenCalled()
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
