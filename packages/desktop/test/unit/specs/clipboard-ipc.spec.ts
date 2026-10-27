// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, clipboard } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  clipboard: {
    read: vi.fn(),
    readText: vi.fn(),
    writeText: vi.fn()
  }
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) =>
      handlers.set(channel, handler),
    on: vi.fn()
  },
  clipboard,
  ClipboardItem: vi.fn(),
  nativeImage: {}
}))
vi.mock('main_renderer/ipc/clipboardImage', () => ({ writeClipboardImage: vi.fn() }))
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))

import { registerShellHandlers } from 'main_renderer/ipc/shell'

const invoke = (channel: string, ...args: unknown[]) => {
  const handler = handlers.get(`mt::clipboard::${channel}`)
  if (!handler) throw new Error(`Missing clipboard handler: ${channel}`)
  return handler(undefined, ...args)
}

beforeEach(() => {
  vi.resetAllMocks()
  handlers.clear()
  registerShellHandlers()
})

describe('asynchronous clipboard IPC', () => {
  it('reports text write failures instead of acknowledging a rejected write', async() => {
    clipboard.writeText.mockRejectedValue(new Error('Clipboard unavailable'))
    expect(await invoke('write-text', 'text')).toBe(false)
  })

  it('acknowledges a text write only after it completes', async() => {
    let finish: (() => void) | undefined
    clipboard.writeText.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      })
    )
    const completed = vi.fn()
    const result = invoke('write-text', 'text').then(completed)
    await Promise.resolve()
    expect(completed).not.toHaveBeenCalled()
    finish?.()
    await result
    expect(completed).toHaveBeenCalledWith(true)
  })

  it('returns empty text when an asynchronous read fails', async() => {
    clipboard.readText.mockRejectedValue(new Error('Clipboard unavailable'))
    expect(await invoke('read-text')).toBe('')
  })

  it('ignores comments and non-file entries in a copied URI list', async() => {
    clipboard.read.mockResolvedValue([
      {
        types: ['text/uri-list'],
        getType: async() => new Blob(['# file list\r\nhttps://example.com/image.png\r\n'])
      }
    ])
    expect(await invoke('guess-file-path')).toBe('')
  })

  it('handles clipboard read failures without rejecting the IPC call', async() => {
    clipboard.read.mockRejectedValue(new Error('Clipboard unavailable'))
    expect(await invoke('guess-file-path')).toBe('')
  })
})
