import { beforeEach, describe, expect, it, vi } from 'vitest'

import { IMAGE_EXTENSIONS } from 'common/filesystem/paths'

// `DataCenter` (main process) registers `mt::ask-for-image-path` via
// `ipcMain.handle`. The handler opens a native file dialog and maps the
// result to `filePaths[0]` or `''`. We mock the Electron surface, capture
// the registered handler, and drive it directly — the dialog itself is
// manual-only but the return-mapping + filter are a pure unit slice.

const { handlers, showOpenDialog, fromWebContents } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  showOpenDialog: vi.fn(),
  fromWebContents: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: (...args: unknown[]) => unknown) => {
      handlers.set(channel, listener)
    },
    on: () => {}
  },
  dialog: { showOpenDialog },
  BrowserWindow: { fromWebContents }
}))

vi.mock('keytar', () => ({ default: { getPassword: vi.fn(), setPassword: vi.fn() } }))
vi.mock('electron-log', () => ({ default: { error: vi.fn(), info: vi.fn() } }))
vi.mock('common/filesystem', () => ({ ensureDirSync: vi.fn() }))

vi.mock('electron-store', () => ({
  default: class {
    private data: Record<string, unknown> = {}
    get(key: string) {
      return this.data[key]
    }

    set(key: string | Record<string, unknown>, value?: unknown) {
      if (typeof key === 'string') this.data[key] = value
      else Object.assign(this.data, key)
    }

    get store() {
      return this.data
    }
  }
}))

const { default: DataCenter } = await import('main_renderer/dataCenter')

const FAKE_WIN = { id: 1 }
const fakeEvent = { sender: {} } as never

function getHandler() {
  // Instantiating DataCenter registers the ipcMain handler (the side effect is the point).
  // eslint-disable-next-line no-new
  new DataCenter({ dataCenterPath: '/tmp/mt-dc', userDataPath: '/tmp/mt-ud' })
  const handler = handlers.get('mt::ask-for-image-path')
  if (!handler) throw new Error('mt::ask-for-image-path handler was not registered')
  return handler
}

describe('mt::ask-for-image-path handler', () => {
  beforeEach(() => {
    handlers.clear()
    showOpenDialog.mockReset()
    fromWebContents.mockReset()
    fromWebContents.mockReturnValue(FAKE_WIN)
  })

  it('returns filePaths[0] when the user picks a file', async() => {
    const handler = getHandler()
    showOpenDialog.mockResolvedValue({ filePaths: ['/abs/x.png'], canceled: false })

    const result = await handler(fakeEvent)

    expect(result).toBe('/abs/x.png')
  })

  it("returns '' when the dialog is canceled (empty filePaths)", async() => {
    const handler = getHandler()
    showOpenDialog.mockResolvedValue({ filePaths: [], canceled: true })

    const result = await handler(fakeEvent)

    expect(result).toBe('')
  })

  it("returns '' when there is no owning BrowserWindow", async() => {
    const handler = getHandler()
    fromWebContents.mockReturnValue(null)

    const result = await handler(fakeEvent)

    expect(result).toBe('')
    expect(showOpenDialog).not.toHaveBeenCalled()
  })

  it('opens the dialog with an openFile property and the image-extension filter', async() => {
    const handler = getHandler()
    showOpenDialog.mockResolvedValue({ filePaths: ['/abs/y.jpg'], canceled: false })

    await handler(fakeEvent)

    expect(showOpenDialog).toHaveBeenCalledWith(
      FAKE_WIN,
      expect.objectContaining({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: [...IMAGE_EXTENSIONS] }]
      })
    )
  })
})
