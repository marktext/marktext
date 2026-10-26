import { afterEach, describe, expect, it, vi } from 'vitest'
import { clipboardImagePath, copyImageToClipboard } from '@/util/clipboard'

vi.mock('@/util/index', () => ({ isLinux: false }))

afterEach(() => vi.unstubAllGlobals())

describe('renderer image copy lifecycle', () => {
  it('cancels an image that finishes after its preview closes or changes', async() => {
    const clipboard = {
      beginImageCopy: vi.fn().mockResolvedValue(7),
      cancelImageCopy: vi.fn().mockResolvedValue(undefined),
      writeImage: vi.fn()
    }
    vi.stubGlobal('window', { electron: { clipboard } })
    let resolve!: (png: Uint8Array) => void
    let current = true
    const load = vi.fn(() => new Promise<Uint8Array>(done => { resolve = done }))
    const copied = copyImageToClipboard(load, undefined, () => current)
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    current = false
    resolve(new Uint8Array([1]))
    expect(await copied).toBe(false)
    expect(clipboard.writeImage).not.toHaveBeenCalled()
    expect(clipboard.cancelImageCopy).toHaveBeenCalledWith(7)
  })

  it('does not load an image after its fallback copy was superseded', async() => {
    const clipboard = { beginImageCopy: vi.fn().mockResolvedValue(null) }
    vi.stubGlobal('window', { electron: { clipboard } })
    const load = vi.fn()
    expect(await copyImageToClipboard(load)).toBe(false)
    expect(load).not.toHaveBeenCalled()
  })

  it('releases a failed decoding request while retaining the text fallback', async() => {
    const clipboard = {
      beginImageCopy: vi.fn().mockResolvedValue(8),
      cancelImageCopy: vi.fn().mockResolvedValue(undefined),
      writeImage: vi.fn()
    }
    vi.stubGlobal('window', { electron: { clipboard } })
    await expect(copyImageToClipboard(async() => { throw new Error('bad image') })).rejects.toThrow('bad image')
    expect(clipboard.writeImage).not.toHaveBeenCalled()
    expect(clipboard.cancelImageCopy).toHaveBeenCalledWith(8)
  })

  it('decodes local URL paths without resolving them relative to the target document', () => {
    vi.stubGlobal('window', { electron: { process: { platform: 'win32' } } })
    expect(clipboardImagePath('file:///C:/source%20folder/a%23b.png?mucache=1')).toBe('C:/source folder/a#b.png')
    expect(clipboardImagePath('file://server/share/a%20b.png')).toBe('//server/share/a b.png')
    expect(clipboardImagePath('https://example.com/a.png')).toBe('https://example.com/a.png')
  })
})
