import { describe, it, expect, beforeEach, vi } from 'vitest'
import path from 'path'
import { moveImageToFolder } from '@/util/fileSystem'

// moveImageToFolder relies on the preload contextBridge surface (window.path,
// window.fileUtils). Stub them with the real node `path` and in-memory fakes so
// the relative-path persistence logic can be exercised (real window.crypto is
// used for the content hash).
const copy = vi.fn((_src: string, _dest: string) => Promise.resolve())
const writeFile = vi.fn(() => Promise.resolve())

const win = window as unknown as {
  path: typeof path
  fileUtils: Record<string, unknown>
}

beforeEach(() => {
  copy.mockClear()
  writeFile.mockClear()
  win.path = path
  win.fileUtils = {
    ensureDir: vi.fn(() => Promise.resolve()),
    isImageFile: vi.fn(() => Promise.resolve(true)),
    copy,
    writeFile
  }
})

describe('moveImageToFolder relative-directory persistence', () => {
  const docPath = '/tmp/notes/a.md'
  const assetsDir = '/tmp/notes/assets'

  it('returns a relative path for a binary File when isRelative is set', async() => {
    const file = new File([new Uint8Array([1, 2, 3])], 'pic.png', { type: 'image/png' })
    const result = await moveImageToFolder(docPath, file, assetsDir, true, docPath)
    expect(result.startsWith('assets/')).toBe(true)
    expect(path.isAbsolute(result)).toBe(false)
  })

  it('returns a relative path for a local path string when isRelative is set', async() => {
    const source = '/Users/someone/pictures/pic.png'
    const result = await moveImageToFolder(docPath, source, assetsDir, true, docPath)
    // The image must be copied into the assets dir...
    expect(copy).toHaveBeenCalledTimes(1)
    expect(copy.mock.calls[0][1].startsWith(assetsDir)).toBe(true)
    // ...and the inserted reference must be the portable relative path.
    expect(path.isAbsolute(result)).toBe(false)
    expect(result.startsWith('assets/')).toBe(true)
  })

  it('returns the absolute hashed path for a local path string when isRelative is false', async() => {
    const source = '/Users/someone/pictures/pic.png'
    const result = await moveImageToFolder(docPath, source, assetsDir, false, docPath)
    // copy still lands inside the assets dir...
    expect(copy).toHaveBeenCalledTimes(1)
    expect(copy.mock.calls[0][1].startsWith(assetsDir)).toBe(true)
    // ...and with isRelative=false the returned reference is the absolute
    // hashed destination path (the second arg passed to copy).
    expect(path.isAbsolute(result)).toBe(true)
    expect(result).toBe(copy.mock.calls[0][1])
    expect(result.startsWith(`${assetsDir}${path.sep}`)).toBe(true)
  })

  it('short-circuits without copying when the image already lives in outputDir', async() => {
    // The resolved imagePath equals path.join(outputDir, basename) so
    // noHashPath === imagePath and the copy step is skipped.
    const inPlace = path.join(assetsDir, 'already.png')
    const result = await moveImageToFolder(docPath, inPlace, assetsDir, false, docPath)
    expect(copy).not.toHaveBeenCalled()
    // The original absolute path is returned unchanged (isRelative=false).
    expect(result).toBe(inPlace)
  })

  it('short-circuits to a relative reference when isRelative is set and the image is in outputDir', async() => {
    const inPlace = path.join(assetsDir, 'already.png')
    const result = await moveImageToFolder(docPath, inPlace, assetsDir, true, docPath)
    expect(copy).not.toHaveBeenCalled()
    expect(path.isAbsolute(result)).toBe(false)
    expect(result.startsWith('assets/')).toBe(true)
  })
})
