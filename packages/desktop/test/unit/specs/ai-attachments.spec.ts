import { mkdtemp, readFile, readdir, rm, utimes } from 'fs/promises'
import os from 'os'
import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  AiAttachmentStore,
  normalizeImageAttachment,
  normalizeImageUpload,
  normalizeImageUploads,
  orderAttachmentLocations
} from 'main_renderer/ai/attachments'

const png = (size = 8): Uint8Array => {
  const data = new Uint8Array(Math.max(size, 8))
  data.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return data
}

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values)

const upload = (id = 'attachment-test-0001'): Record<string, unknown> => ({
  id,
  name: 'table/screenshot.png',
  mimeType: 'image/png',
  byteSize: png().byteLength,
  data: png()
})

describe('AI image attachment validation and storage', () => {
  it('prioritizes current images and fills history newest-first', () => {
    const history = (id: string): { id: string; name: string; mimeType: 'image/png'; byteSize: number } => ({
      id,
      name: id,
      mimeType: 'image/png',
      byteSize: 8
    })
    const messages = [
      { attachments: [history('attachment-history-old1')] },
      { attachments: [history('attachment-history-new1'), history('attachment-history-new2')] },
      { attachments: [history('attachment-current')] }
    ]
    const result = orderAttachmentLocations(messages, new Set(['attachment-current']))
    expect(result.missing).toEqual([])
    expect(result.locations.map(item => item.attachment.id)).toEqual([
      'attachment-current',
      'attachment-history-new1',
      'attachment-history-new2',
      'attachment-history-old1'
    ])
    expect(result.locations[0].required).toBe(true)
    expect(result.locations[1].required).toBe(false)
  })

  it('normalizes metadata without allowing path traversal', () => {
    expect(normalizeImageAttachment({ ...upload(), name: '..\\secret.png' })).toEqual({
      id: 'attachment-test-0001',
      name: '.._secret.png',
      mimeType: 'image/png',
      byteSize: 8
    })
    expect(() => normalizeImageAttachment({ ...upload(), id: '../escape' })).toThrow()
    expect(() => normalizeImageAttachment({ ...upload(), id: 'short' })).toThrow()
  })

  it('rejects unsupported signatures, duplicate IDs, and request limits', () => {
    expect(normalizeImageUpload({ ...upload(), mimeType: 'image/jpeg', data: bytes(0xff, 0xd8, 0xff) }).mimeType).toBe('image/jpeg')
    expect(normalizeImageUpload({ ...upload(), mimeType: 'image/webp', data: bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50) }).mimeType).toBe('image/webp')
    expect(normalizeImageUpload({ ...upload(), mimeType: 'image/gif', data: bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61) }).mimeType).toBe('image/gif')
    expect(() => normalizeImageUpload({ ...upload(), data: new Uint8Array([1, 2, 3]) })).toThrow(/does not match/i)
    expect(() => normalizeImageUploads([upload(), upload()])).toThrow(/Duplicate/i)
    expect(() => normalizeImageUploads(new Array(11).fill(null).map((_, index) => upload(`attachment-test-${String(index).padStart(4, '0')}`)))).toThrow(/10 images/i)
  })

  it('stores, reads, and prunes only validated orphan files', async() => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'marktext-ai-attachments-'))
    try {
      const store = new AiAttachmentStore(directory)
      const saved = await store.save([normalizeImageUpload(upload())])
      expect(saved[0]).toMatchObject({ id: 'attachment-test-0001', mimeType: 'image/png' })
      const storedPath = path.join(directory, 'ai-attachments', 'attachment-test-0001.png')
      expect(new Uint8Array(await readFile(storedPath))).toEqual(png())
      expect(await store.read('attachment-test-0001', 'image/png')).toEqual({ mimeType: 'image/png', data: png() })
      await store.prune(new Set(), 0)
      await expect(readFile(storedPath)).rejects.toThrow()

      await store.save([normalizeImageUpload(upload())])
      await utimes(storedPath, new Date(0), new Date(0))
      await store.prune(new Set(['attachment-test-0001']), 0)
      expect((await readdir(path.dirname(storedPath))).length).toBe(1)
      await store.prune(new Set(), 0)
      await expect(readFile(storedPath)).rejects.toThrow()
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
