import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// `@/store/editor` transitively imports `@/config`, which reads
// `window.path.sep` at module load (normally injected by the preload bridge).
// It also reaches `window.electron.clipboard` at runtime. Stub the surfaces
// before the hoisted imports run.
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
// observe `notify` without rendering a toast. SHOW_IMAGE_DELETION_URL chains a
// `.then()` off `notify(...)`, so the stub must resolve a Promise.
vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(() => Promise.resolve()), name: 'notify' }
}))

import { useEditorStore } from '@/store/editor'
import notice from '@/services/notification'

describe('useEditorStore SHOW_IMAGE_DELETION_URL', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(notice.notify as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  })

  it('notifies with a confirm toast pinned for 20s carrying the deletion URL', () => {
    const store = useEditorStore()
    const url = 'https://imgur.example/delete/abc123'

    store.SHOW_IMAGE_DELETION_URL(url)

    expect(notice.notify).toHaveBeenCalledTimes(1)
    expect(notice.notify).toHaveBeenCalledWith(
      expect.objectContaining({ showConfirm: true, time: 20000 })
    )
    const opts = (notice.notify as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(typeof opts.title).toBe('string')
    expect(opts.title.length).toBeGreaterThan(0)
    expect(opts.message).toContain(url)
  })

  it('copies the deletion URL to the clipboard when the confirm resolves', async() => {
    const store = useEditorStore()
    const url = 'https://imgur.example/delete/xyz789'
    const writeSpy = vi.spyOn(window.electron.clipboard, 'writeText')

    store.SHOW_IMAGE_DELETION_URL(url)

    // Clipboard write is chained off the notify Promise — flush microtasks.
    expect(writeSpy).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(writeSpy).toHaveBeenCalledWith(url)
  })
})
