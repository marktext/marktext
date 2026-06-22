import { describe, it, expect, beforeEach, vi } from 'vitest'
import { uploadImage } from '@/util/fileSystem'

// uploadImage forwards to the preload contextBridge surface
// (window.uploader.uploadImage). It must hand the IPC layer only a plain
// serializable {currentUploader,cliScript} object — the full Pinia $state is a
// Vue Proxy that Electron's structured-clone cannot serialize.
const uploadImageFn = vi.fn((_payload?: unknown) => Promise.resolve('https://cdn/x.png'))

const win = window as unknown as {
  uploader: { uploadImage: typeof uploadImageFn }
}

beforeEach(() => {
  uploadImageFn.mockClear()
  win.uploader = { uploadImage: uploadImageFn }
})

describe('uploadImage IPC payload shape', () => {
  const docPath = '/tmp/notes/a.md'

  it('forwards a local path string with isPath:true and only the picked prefs', async() => {
    const source = '/Users/someone/pictures/pic.png'
    const result = await uploadImage(docPath, source, {
      currentUploader: 'picgo',
      cliScript: ''
    })

    expect(uploadImageFn).toHaveBeenCalledTimes(1)
    const payload = uploadImageFn.mock.calls[0][0] as Record<string, unknown>
    expect(payload.pathname).toBe(docPath)
    expect(payload.image).toBe(source)
    expect(payload.isPath).toBe(true)
    expect(payload.preferences).toEqual({ currentUploader: 'picgo', cliScript: '' })
    expect(result).toBe('https://cdn/x.png')
  })

  it('forwards a binary File with isPath:false and a Uint8Array + name', async() => {
    const file = new File([new Uint8Array([1, 2, 3])], 'pic.png', { type: 'image/png' })
    await uploadImage(docPath, file, { currentUploader: 'picgo', cliScript: '' })

    expect(uploadImageFn).toHaveBeenCalledTimes(1)
    const payload = uploadImageFn.mock.calls[0][0] as {
      pathname: string
      image: { data: Uint8Array; name: string }
      isPath: boolean
      preferences: unknown
    }
    expect(payload.pathname).toBe(docPath)
    expect(payload.isPath).toBe(false)
    expect(payload.image.name).toBe('pic.png')
    expect(payload.image.data).toBeInstanceOf(Uint8Array)
    expect(Array.from(payload.image.data)).toEqual([1, 2, 3])
    expect(payload.preferences).toEqual({ currentUploader: 'picgo', cliScript: '' })
  })

  it('drops extra prefs keys, keeping only currentUploader and cliScript', async() => {
    // Simulates being handed the full preferences $state — only the two
    // whitelisted keys may cross the IPC boundary (structured-clone safety).
    const fatPrefs = {
      currentUploader: 'picgo',
      cliScript: '/usr/local/bin/upload.sh',
      imageInsertAction: 'folder',
      autoGuessEncoding: true,
      nested: { foo: 'bar' }
    } as unknown as { currentUploader: string; cliScript?: string }

    await uploadImage(docPath, '/x/y.png', fatPrefs)

    const payload = uploadImageFn.mock.calls[0][0] as { preferences: Record<string, unknown> }
    expect(payload.preferences).toEqual({
      currentUploader: 'picgo',
      cliScript: '/usr/local/bin/upload.sh'
    })
    expect(Object.keys(payload.preferences).sort()).toEqual(['cliScript', 'currentUploader'])
  })

  it('defaults cliScript to an empty string when absent', async() => {
    await uploadImage(docPath, '/x/y.png', { currentUploader: 'picgo' })

    const payload = uploadImageFn.mock.calls[0][0] as { preferences: Record<string, unknown> }
    expect(payload.preferences).toEqual({ currentUploader: 'picgo', cliScript: '' })
  })

  it('returns the uploader-provided URL', async() => {
    uploadImageFn.mockResolvedValueOnce('https://cdn/custom.png')
    const result = await uploadImage(docPath, '/x/y.png', { currentUploader: 'github' })
    expect(result).toBe('https://cdn/custom.png')
  })
})
