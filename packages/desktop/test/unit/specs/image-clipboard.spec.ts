// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ formats: new Map<string, string>() }))
const electron = vi.hoisted(() => ({
  clipboard: {
    read: async() => [
      {
        types: [...state.formats.keys()],
        getType: async(format: string) => new Blob([state.formats.get(format) ?? ''])
      }
    ],
    write: vi.fn(async(items: Array<{ data: Record<string, Blob | string> }>) => {
      state.formats.clear()
      for (const item of items) {
        for (const [format, payload] of Object.entries(item.data)) {
          state.formats.set(format, typeof payload === 'string' ? payload : await payload.text())
        }
      }
    })
  },
  ClipboardItem: class {
    constructor(public data: Record<string, Blob | string>) {}
  },
  nativeImage: {
    createFromBuffer: (data: Uint8Array) => ({
      isEmpty: () => data.byteLength === 0,
      toPNG: () => Buffer.from('png')
    })
  },
  net: { fetch: vi.fn() },
  ipcMain: { handle: vi.fn() }
}))

vi.mock('electron', () => electron)

const { beginImageCopy, cancelImageCopy, writeClipboardImage, readClipboardImageSource } =
  await import('main_renderer/ipc/clipboardImage')

beforeEach(() => {
  state.formats.clear()
  vi.clearAllMocks()
})

describe('native image clipboard transactions', () => {
  it('keeps the newest ticket when native reads complete asynchronously', async() => {
    let finishRead: (items: Awaited<ReturnType<typeof electron.clipboard.read>>) => void = () => {}
    const delayedRead = new Promise<Awaited<ReturnType<typeof electron.clipboard.read>>>((resolve) => {
      finishRead = resolve
    })
    const read = vi.spyOn(electron.clipboard, 'read').mockReturnValueOnce(delayedRead)
    try {
      const olderRequest = beginImageCopy(1)
      const newerRequest = beginImageCopy(2)
      await Promise.resolve()
      finishRead([])
      const [older, newer] = await Promise.all([olderRequest, newerRequest])
      expect(await writeClipboardImage(1, new Uint8Array([1]), { ticket: older as number })).toBe(false)
      expect(await writeClipboardImage(2, new Uint8Array([1]), { ticket: newer as number })).toBe(true)
    } finally {
      read.mockRestore()
    }
  })

  it('allows later copies after a native write rejects', async() => {
    electron.clipboard.write.mockRejectedValueOnce(new Error('Clipboard unavailable'))
    await expect(writeClipboardImage(1, new Uint8Array([1]))).rejects.toThrow('Clipboard unavailable')
    const ticket = await beginImageCopy(1) as number
    expect(await writeClipboardImage(1, new Uint8Array([1]), { ticket })).toBe(true)
  })

  it('commits text, HTML and bitmap in a single write', async() => {
    const html = '<img data-marktext-copy="copy-1">'
    state.formats.set('text/html', html)
    const ticket = (await beginImageCopy(1, 'copy-1')) as number
    expect(
      await writeClipboardImage(1, new Uint8Array([1]), { ticket, text: '![x](x.png)', html })
    ).toBe(true)
    expect([...state.formats.keys()].sort()).toEqual(['image/png', 'text/html', 'text/plain'])
    expect(electron.clipboard.write).toHaveBeenCalledOnce()
  })

  it('does not overwrite a newer copy from another application', async() => {
    const ticket = (await beginImageCopy(1)) as number
    state.formats.set('text/plain', 'newer external text')
    expect(await writeClipboardImage(1, new Uint8Array([1]), { ticket })).toBe(false)
    expect(state.formats.get('text/plain')).toBe('newer external text')
  })

  it('rejects old, cancelled and different-window requests', async() => {
    const older = (await beginImageCopy(1)) as number
    const newer = (await beginImageCopy(2)) as number
    expect(await writeClipboardImage(1, new Uint8Array([1]), { ticket: older })).toBe(false)
    expect(await writeClipboardImage(1, new Uint8Array([1]), { ticket: newer })).toBe(false)
    await cancelImageCopy(2, newer)
    expect(await writeClipboardImage(2, new Uint8Array([1]), { ticket: newer })).toBe(false)
  })

  it('requires the fallback marker to still belong to this copy', async() => {
    state.formats.set('text/html', '<img data-marktext-copy="newer">')
    expect(await beginImageCopy(1, 'older')).toBeNull()
  })

  it('retains existing clipboard contents if decoding fails', async() => {
    state.formats.set('text/plain', 'original')
    const ticket = (await beginImageCopy(1)) as number
    expect(await writeClipboardImage(1, new Uint8Array(), { ticket })).toBe(false)
    expect(state.formats.get('text/plain')).toBe('original')
  })

  it('rejects unsupported image source schemes without fetching them', async() => {
    expect((await readClipboardImageSource('javascript:alert(1)')).ok).toBe(false)
    expect((await readClipboardImageSource('data:text/html,hello')).ok).toBe(false)
    expect(electron.net.fetch).not.toHaveBeenCalled()
  })

  it.each([undefined, 'application/octet-stream', 'application/octet-stream; charset=binary'])(
    'accepts clipboard image bytes served with content type %s for renderer decoding',
    async(contentType) => {
      const data = new Uint8Array([137, 80, 78, 71])
      electron.net.fetch.mockResolvedValueOnce(
        new Response(data, {
          headers: contentType ? { 'content-type': contentType } : {}
        })
      )
      expect(await readClipboardImageSource('https://example.com/image.png')).toEqual({
        ok: true,
        data,
        mime: 'application/octet-stream'
      })
    }
  )

  it('still rejects an explicitly non-image content type', async() => {
    electron.net.fetch.mockResolvedValueOnce(
      new Response('<html>error</html>', {
        headers: { 'content-type': 'text/html' }
      })
    )
    expect((await readClipboardImageSource('https://example.com/image.png')).ok).toBe(false)
  })
})
