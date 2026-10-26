import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extname } from 'node:path'
import { clipboard, ipcMain, nativeImage, net } from 'electron'
import type { ClipboardImageWriteOptions, PlantumlFetchResult } from '@shared/types/ipc'
import { fetchImage, MAX_BYTES } from './plantumlFetch'

let requestId = 0
let pending: { id: number; owner: number; fingerprint: string } | null = null

// A newer bitmap-only copy need not change the clipboard's plain text.
const clipboardFingerprint = (): string => {
  const hash = createHash('sha256')
  for (const format of clipboard.availableFormats().sort()) {
    hash.update(format)
    hash.update(clipboard.readBuffer(format))
  }
  return hash.digest('hex')
}

export const beginImageCopy = (owner: number, marker?: string): number | null => {
  if (marker && !clipboard.readHTML().includes(`data-marktext-copy="${marker}"`)) return null
  const id = ++requestId
  pending = { id, owner, fingerprint: clipboardFingerprint() }
  return id
}

export const cancelImageCopy = (owner: number, ticket: number): void => {
  if (pending?.id === ticket && pending.owner === owner) pending = null
}

export const writeClipboardImage = (
  owner: number,
  png: Uint8Array,
  options?: ClipboardImageWriteOptions
): boolean => {
  if (options?.ticket !== undefined) {
    if (
      pending?.id !== options.ticket ||
      pending.owner !== owner ||
      pending.fingerprint !== clipboardFingerprint()
    )
      return false
  }
  const image = nativeImage.createFromBuffer(Buffer.from(png))
  if (image.isEmpty()) return false
  pending = null
  if (options?.text !== undefined || options?.html !== undefined) {
    clipboard.write({ image, text: options.text, html: options.html })
  } else {
    clipboard.writeImage(image)
  }
  return true
}

export const readClipboardImageSource = async(src: string): Promise<PlantumlFetchResult> => {
  try {
    const url = new URL(src)
    if (url.protocol === 'file:') {
      url.search = ''
      url.hash = ''
      const pathname = fileURLToPath(url)
      if ((await stat(pathname)).size > MAX_BYTES) return { ok: false, error: 'Image too large' }
      const data = await readFile(pathname)
      if (data.byteLength > MAX_BYTES) return { ok: false, error: 'Image too large' }
      return {
        ok: true,
        data,
        mime:
          extname(pathname).toLowerCase() === '.svg' ? 'image/svg+xml' : 'application/octet-stream'
      }
    }
    if (
      !['http:', 'https:', 'data:'].includes(url.protocol) ||
      (url.protocol === 'data:' && (!src.startsWith('data:image/') || src.length > MAX_BYTES * 1.5))
    ) {
      return { ok: false, error: 'Unsupported image source' }
    }
    // The renderer decodes these bytes; image hosts need not label bitmap responses as image/*.
    return await fetchImage(src, net.fetch, 'follow', true)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const registerImageClipboardHandlers = (): void => {
  ipcMain.handle('mt::clipboard::begin-image-copy', (event, marker?: string) =>
    beginImageCopy(event.sender.id, marker)
  )
  ipcMain.handle('mt::clipboard::cancel-image-copy', (event, ticket: number) =>
    cancelImageCopy(event.sender.id, ticket)
  )
  ipcMain.handle('mt::clipboard::read-image-source', (_event, src: string) =>
    readClipboardImageSource(src)
  )
}
