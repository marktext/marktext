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

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((finish) => {
    resolve = finish
  })
  return { promise, resolve }
}

describe('native image clipboard transactions', () => {
  it('lets a newer copy finish while an older clipboard read is still pending', async() => {
    const readStarted = deferred<void>()
    const oldRead = deferred<Awaited<ReturnType<typeof electron.clipboard.read>>>()
    const read = vi.spyOn(electron.clipboard, 'read').mockImplementationOnce(() => {
      readStarted.resolve()
      return oldRead.promise
    })
    try {
      const olderRequest = beginImageCopy(1)
      await readStarted.promise
      const newer = (await beginImageCopy(2)) as number
      oldRead.resolve([])
      expect(await olderRequest).toBeNull()
      expect(await writeClipboardImage(2, new Uint8Array([1]), { ticket: newer })).toBe(true)
    } finally {
      oldRead.resolve([])
      read.mockRestore()
    }
  })

  it('cancels a copy while its clipboard fingerprint is being read', async() => {
    state.formats.set('image/png', 'original image')
    const ticket = (await beginImageCopy(1)) as number
    const readStarted = deferred<void>()
    const imageData = deferred<Blob>()
    const read = vi.spyOn(electron.clipboard, 'read').mockResolvedValueOnce([
      {
        types: ['image/png'],
        getType: () => {
          readStarted.resolve()
          return imageData.promise
        }
      }
    ])
    try {
      const write = writeClipboardImage(1, new Uint8Array([1]), { ticket })
      await readStarted.promise
      cancelImageCopy(1, ticket)
      imageData.resolve(new Blob(['original image']))
      expect(await write).toBe(false)
      expect(electron.clipboard.write).not.toHaveBeenCalled()
      expect(state.formats.get('image/png')).toBe('original image')
    } finally {
      imageData.resolve(new Blob(['original image']))
      read.mockRestore()
    }
  })

  it('rejects a write superseded while its fingerprint is being read', async() => {
    const ticket = (await beginImageCopy(1)) as number
    const readStarted = deferred<void>()
    const oldRead = deferred<Awaited<ReturnType<typeof electron.clipboard.read>>>()
    const read = vi.spyOn(electron.clipboard, 'read').mockImplementationOnce(() => {
      readStarted.resolve()
      return oldRead.promise
    })
    try {
      const olderWrite = writeClipboardImage(1, new Uint8Array([1]), { ticket })
      await readStarted.promise
      const newer = (await beginImageCopy(2)) as number
      oldRead.resolve([])
      expect(await olderWrite).toBe(false)
      expect(await writeClipboardImage(2, new Uint8Array([1]), { ticket: newer })).toBe(true)
      expect(electron.clipboard.write).toHaveBeenCalledOnce()
    } finally {
      oldRead.resolve([])
      read.mockRestore()
    }
  })

  it('captures the next clipboard baseline after an issued native write finishes', async() => {
    const writeStarted = deferred<void>()
    const writeFinished = deferred<void>()
    electron.clipboard.write.mockImplementationOnce(async() => {
      writeStarted.resolve()
      await writeFinished.promise
      state.formats.set('text/plain', 'previous copy')
    })
    try {
      const firstWrite = writeClipboardImage(1, new Uint8Array([1]))
      await writeStarted.promise
      const nextRequest = beginImageCopy(2)
      writeFinished.resolve()
      expect(await firstWrite).toBe(true)
      const ticket = (await nextRequest) as number
      expect(
        await writeClipboardImage(2, new Uint8Array([1]), { ticket, text: 'newer copy' })
      ).toBe(true)
      expect(state.formats.get('text/plain')).toBe('newer copy')
    } finally {
      writeFinished.resolve()
    }
  })

  it('allows later copies after a native write rejects', async() => {
    electron.clipboard.write.mockRejectedValueOnce(new Error('Clipboard unavailable'))
    await expect(writeClipboardImage(1, new Uint8Array([1]))).rejects.toThrow(
      'Clipboard unavailable'
    )
    const ticket = (await beginImageCopy(1)) as number
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
