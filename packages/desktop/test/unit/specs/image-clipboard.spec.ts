import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ formats: new Map<string, string>() }))
const electron = vi.hoisted(() => ({
  clipboard: {
    availableFormats: () => [...state.formats.keys()],
    readBuffer: (format: string) => Buffer.from(state.formats.get(format) ?? ''),
    readHTML: () => state.formats.get('text/html') ?? '',
    write: vi.fn((data: { text?: string; html?: string; image?: unknown }) => {
      state.formats.clear()
      if (data.text !== undefined) state.formats.set('text/plain', data.text)
      if (data.html !== undefined) state.formats.set('text/html', data.html)
      if (data.image) state.formats.set('image/png', 'png')
    }),
    writeImage: vi.fn(() => { state.formats.clear(); state.formats.set('image/png', 'png') })
  },
  nativeImage: { createFromBuffer: (data: Uint8Array) => ({ isEmpty: () => data.byteLength === 0 }) },
  net: { fetch: vi.fn() },
  ipcMain: { handle: vi.fn() }
}))

vi.mock('electron', () => electron)

const { beginImageCopy, cancelImageCopy, writeClipboardImage, readClipboardImageSource } = await import('main_renderer/ipc/clipboardImage')

beforeEach(() => {
  state.formats.clear()
  vi.clearAllMocks()
})

describe('native image clipboard transactions', () => {
  it('commits text, HTML and bitmap in a single write', () => {
    const html = '<img data-marktext-copy="copy-1">'
    state.formats.set('text/html', html)
    const ticket = beginImageCopy(1, 'copy-1') as number
    expect(writeClipboardImage(1, new Uint8Array([1]), { ticket, text: '![x](x.png)', html })).toBe(true)
    expect([...state.formats.keys()]).toEqual(['text/plain', 'text/html', 'image/png'])
    expect(electron.clipboard.write).toHaveBeenCalledOnce()
  })

  it('does not overwrite a newer copy from another application', () => {
    const ticket = beginImageCopy(1) as number
    state.formats.set('text/plain', 'newer external text')
    expect(writeClipboardImage(1, new Uint8Array([1]), { ticket })).toBe(false)
    expect(state.formats.get('text/plain')).toBe('newer external text')
  })

  it('rejects old, cancelled and different-window requests', () => {
    const older = beginImageCopy(1) as number
    const newer = beginImageCopy(2) as number
    expect(writeClipboardImage(1, new Uint8Array([1]), { ticket: older })).toBe(false)
    expect(writeClipboardImage(1, new Uint8Array([1]), { ticket: newer })).toBe(false)
    cancelImageCopy(2, newer)
    expect(writeClipboardImage(2, new Uint8Array([1]), { ticket: newer })).toBe(false)
  })

  it('requires the fallback marker to still belong to this copy', () => {
    state.formats.set('text/html', '<img data-marktext-copy="newer">')
    expect(beginImageCopy(1, 'older')).toBeNull()
  })

  it('retains existing clipboard contents if decoding fails', () => {
    state.formats.set('text/plain', 'original')
    const ticket = beginImageCopy(1) as number
    expect(writeClipboardImage(1, new Uint8Array(), { ticket })).toBe(false)
    expect(state.formats.get('text/plain')).toBe('original')
  })

  it('rejects unsupported image source schemes without fetching them', async() => {
    expect((await readClipboardImageSource('javascript:alert(1)')).ok).toBe(false)
    expect((await readClipboardImageSource('data:text/html,hello')).ok).toBe(false)
    expect(electron.net.fetch).not.toHaveBeenCalled()
  })

  it.each([undefined, 'application/octet-stream', 'application/octet-stream; charset=binary'])(
    'accepts clipboard image bytes served with content type %s for renderer decoding', async(contentType) => {
      const data = new Uint8Array([137, 80, 78, 71])
      electron.net.fetch.mockResolvedValueOnce(new Response(data, {
        headers: contentType ? { 'content-type': contentType } : {}
      }))
      expect(await readClipboardImageSource('https://example.com/image.png')).toEqual({
        ok: true, data, mime: 'application/octet-stream'
      })
    }
  )

  it('still rejects an explicitly non-image content type', async() => {
    electron.net.fetch.mockResolvedValueOnce(new Response('<html>error</html>', {
      headers: { 'content-type': 'text/html' }
    }))
    expect((await readClipboardImageSource('https://example.com/image.png')).ok).toBe(false)
  })
})
