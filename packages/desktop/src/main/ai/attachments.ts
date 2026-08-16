import path from 'path'
import fsPromises from 'fs/promises'
import type {
  AiImageAttachment,
  AiImageData,
  AiImageMimeType,
  AiImageUpload
} from '@shared/types/ai'
import {
  AI_IMAGE_MIME_TYPES,
  AI_MAX_IMAGE_BYTES,
  AI_MAX_IMAGE_COUNT,
  AI_MAX_IMAGE_TOTAL_BYTES
} from '@shared/types/ai'

const ATTACHMENT_DIRECTORY = 'ai-attachments'
const ATTACHMENT_ID_REGEXP = /^[A-Za-z0-9_-]{16,80}$/
const MAX_NAME_LENGTH = 160

const EXTENSIONS: Record<AiImageMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const toBytes = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) return new Uint8Array(value)
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0))
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
  }
  throw new Error('Image data is not a byte array.')
}

const hasBytes = (bytes: Uint8Array, expected: number[], offset = 0): boolean =>
  expected.every((value, index) => bytes[offset + index] === value)

const hasImageSignature = (mimeType: AiImageMimeType, bytes: Uint8Array): boolean => {
  if (mimeType === 'image/png') return bytes.length >= 8 && hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && hasBytes(bytes, [0xff, 0xd8, 0xff])
  if (mimeType === 'image/webp') return bytes.length >= 12 && hasBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && hasBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  return bytes.length >= 6 && (hasBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || hasBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))
}

const sanitizeName = (value: unknown): string => {
  const name = typeof value === 'string' ? value : ''
  const safe = name.replace(/[\\/\0]/g, '_').trim().slice(0, MAX_NAME_LENGTH)
  return safe || 'image'
}

export const isSafeAttachmentId = (value: string): boolean => ATTACHMENT_ID_REGEXP.test(value)

export const normalizeImageAttachment = (value: unknown): AiImageAttachment => {
  if (!isRecord(value)) throw new Error('Invalid image attachment.')
  const id = typeof value.id === 'string' ? value.id : ''
  if (!isSafeAttachmentId(id)) throw new Error('Invalid image attachment ID.')
  const mimeType = value.mimeType
  if (typeof mimeType !== 'string' || !AI_IMAGE_MIME_TYPES.includes(mimeType as AiImageMimeType)) {
    throw new Error('Unsupported image format. Use PNG, JPEG, WebP, or GIF.')
  }
  const byteSize = value.byteSize
  if (typeof byteSize !== 'number' || !Number.isInteger(byteSize) || byteSize <= 0 || byteSize > AI_MAX_IMAGE_BYTES) {
    throw new Error('Invalid image attachment size.')
  }
  return {
    id,
    name: sanitizeName(value.name),
    mimeType: mimeType as AiImageMimeType,
    byteSize
  }
}

export const normalizeImageUpload = (value: unknown): AiImageUpload => {
  if (!isRecord(value)) throw new Error('Invalid image attachment.')
  const id = typeof value.id === 'string' ? value.id : ''
  if (!isSafeAttachmentId(id)) throw new Error('Invalid image attachment ID.')
  const mimeType = value.mimeType
  const metadata = normalizeImageAttachment({
    id,
    name: value.name,
    mimeType,
    byteSize: 1
  })
  const data = toBytes(value.data)
  if (!data.byteLength || data.byteLength > AI_MAX_IMAGE_BYTES) {
    throw new Error(`Each image must be smaller than ${AI_MAX_IMAGE_BYTES / (1024 * 1024)} MB.`)
  }
  if (!hasImageSignature(mimeType as AiImageMimeType, data)) {
    throw new Error('The image data does not match its declared format.')
  }
  return {
    ...metadata,
    byteSize: data.byteLength,
    data
  }
}

export const normalizeImageUploads = (value: unknown): AiImageUpload[] => {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('Invalid image attachments.')
  if (value.length > AI_MAX_IMAGE_COUNT) throw new Error(`You can attach up to ${AI_MAX_IMAGE_COUNT} images.`)
  const uploads = value.map(normalizeImageUpload)
  const ids = new Set<string>()
  for (const upload of uploads) {
    if (ids.has(upload.id)) throw new Error('Duplicate image attachment ID.')
    ids.add(upload.id)
  }
  const totalBytes = uploads.reduce((total, upload) => total + upload.byteSize, 0)
  if (totalBytes > AI_MAX_IMAGE_TOTAL_BYTES) {
    throw new Error(`Images in one request must total less than ${AI_MAX_IMAGE_TOTAL_BYTES / (1024 * 1024)} MB.`)
  }
  return uploads
}

const toMetadata = ({ id, name, mimeType, byteSize }: AiImageUpload): AiImageAttachment => ({
  id,
  name,
  mimeType,
  byteSize
})

export interface OrderedAttachmentLocation {
  index: number
  attachment: AiImageAttachment
  required: boolean
}

export const orderAttachmentLocations = (
  messages: ReadonlyArray<{ attachments?: AiImageAttachment[] }>,
  priorityIds: ReadonlySet<string>
): { locations: OrderedAttachmentLocation[]; missing: string[] } => {
  const byId = new Map<string, { index: number; attachment: AiImageAttachment }>()
  messages.forEach((message, index) => {
    for (const attachment of message.attachments ?? []) byId.set(attachment.id, { index, attachment })
  })
  const selected = new Set<string>()
  const locations: OrderedAttachmentLocation[] = []
  const missing: string[] = []
  for (const id of priorityIds) {
    const location = byId.get(id)
    if (!location) {
      missing.push(id)
      continue
    }
    selected.add(id)
    locations.push({ ...location, required: true })
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    for (const attachment of messages[index].attachments ?? []) {
      if (selected.has(attachment.id)) continue
      selected.add(attachment.id)
      locations.push({ index, attachment, required: false })
    }
  }
  return { locations, missing }
}

export class AiAttachmentStore {
  private readonly directory: string

  constructor(userDataPath: string) {
    this.directory = path.join(userDataPath, ATTACHMENT_DIRECTORY)
  }

  private filePath(id: string, mimeType: AiImageMimeType): string {
    return path.join(this.directory, `${id}.${EXTENSIONS[mimeType]}`)
  }

  async save(uploads: AiImageUpload[]): Promise<AiImageAttachment[]> {
    const normalized = normalizeImageUploads(uploads)
    if (!normalized.length) return []
    await fsPromises.mkdir(this.directory, { recursive: true, mode: 0o700 })
    try {
      await fsPromises.chmod(this.directory, 0o700)
    } catch {
      // chmod is best effort on filesystems that do not expose POSIX modes.
    }
    const written: string[] = []
    try {
      for (const upload of normalized) {
        const filePath = this.filePath(upload.id, upload.mimeType)
        await fsPromises.writeFile(filePath, upload.data, { flag: 'wx', mode: 0o600 })
        written.push(filePath)
      }
    } catch (error) {
      await Promise.all(written.map(filePath => fsPromises.unlink(filePath).catch(() => undefined)))
      throw error
    }
    return normalized.map(toMetadata)
  }

  async read(id: string, mimeType: AiImageMimeType): Promise<AiImageData> {
    if (!isSafeAttachmentId(id) || !AI_IMAGE_MIME_TYPES.includes(mimeType)) {
      throw new Error('Invalid image attachment.')
    }
    let data: Uint8Array
    try {
      data = new Uint8Array(await fsPromises.readFile(this.filePath(id, mimeType)))
    } catch {
      throw new Error('The stored image attachment is unavailable.')
    }
    if (!data.byteLength || data.byteLength > AI_MAX_IMAGE_BYTES || !hasImageSignature(mimeType, data)) {
      throw new Error('The stored image attachment is invalid.')
    }
    return { mimeType, data }
  }

  async prune(referencedIds: ReadonlySet<string>, graceMs: number): Promise<void> {
    let entries: { name: string; isFile(): boolean }[]
    try {
      entries = await fsPromises.readdir(this.directory, { withFileTypes: true })
    } catch {
      return
    }
    const now = Date.now()
    await Promise.all(entries.filter(entry => entry.isFile()).map(async(entry) => {
      const match = entry.name.match(/^([A-Za-z0-9_-]{16,80})\.(png|jpg|webp|gif)$/)
      if (!match || referencedIds.has(match[1])) return
      const filePath = path.join(this.directory, entry.name)
      try {
        const stat = await fsPromises.stat(filePath)
        if (now - stat.mtimeMs < graceMs) return
        await fsPromises.unlink(filePath)
      } catch {
        // A concurrent cleanup or an already removed orphan is harmless.
      }
    }))
  }
}
