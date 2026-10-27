import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extname } from 'node:path'
import { clipboard, ClipboardItem, ipcMain, nativeImage, net } from 'electron'
import type { ClipboardImageWriteOptions, PlantumlFetchResult } from '@shared/types/ipc'
import { fetchImage, MAX_BYTES } from './plantumlFetch'

interface ImageCopyRequest {
  ticket: number
  owner: number
  // A ticket becomes usable only after its clipboard baseline has been captured.
  fingerprint: string | null
}

let nextTicket = 0
let activeImageCopy: ImageCopyRequest | null = null
let imageWriteFinished = Promise.resolve()

// Native writes cannot be cancelled once issued; newer copies must finish after them.
const commitImageCopy = (
  request: ImageCopyRequest,
  item: Electron.ClipboardItem
): Promise<boolean> => {
  const result = imageWriteFinished.then(async() => {
    if (activeImageCopy !== request) return false
    try {
      await clipboard.write([item])
      return true
    } finally {
      if (activeImageCopy === request) activeImageCopy = null
    }
  })
  // Preserve the rejection for this caller without blocking later writes.
  imageWriteFinished = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

// A newer bitmap-only copy need not change the clipboard's plain text.
const clipboardFingerprint = async(items: Electron.ClipboardItem[]): Promise<string> => {
  const hash = createHash('sha256')
  for (const item of items) {
    for (const format of [...item.types].sort()) {
      hash.update(format)
      const data = await item.getType(format)
      hash.update(
        data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : JSON.stringify(data)
      )
    }
  }
  return hash.digest('hex')
}

export const beginImageCopy = async(owner: number, marker?: string): Promise<number | null> => {
  const request: ImageCopyRequest = { ticket: ++nextTicket, owner, fingerprint: null }
  activeImageCopy = request
  try {
    // A write already in flight must settle before capturing the next clipboard baseline.
    await imageWriteFinished
    if (activeImageCopy !== request) return null
    const items = await clipboard.read()
    if (activeImageCopy !== request) return null
    if (marker) {
      const item = items.find((entry) => entry.types.includes('text/html'))
      const html = item ? await (await item.getType('text/html')).text() : ''
      if (activeImageCopy !== request || !html.includes(`data-marktext-copy="${marker}"`))
        return null
    }
    const fingerprint = await clipboardFingerprint(items)
    if (activeImageCopy !== request) return null
    request.fingerprint = fingerprint
    return request.ticket
  } finally {
    if (activeImageCopy === request && request.fingerprint === null) activeImageCopy = null
  }
}

export const cancelImageCopy = (owner: number, ticket: number): void => {
  if (activeImageCopy?.ticket === ticket && activeImageCopy.owner === owner) activeImageCopy = null
}

export const writeClipboardImage = async(
  owner: number,
  png: Uint8Array,
  options?: ClipboardImageWriteOptions
): Promise<boolean> => {
  const image = nativeImage.createFromBuffer(Buffer.from(png))
  if (image.isEmpty()) return false

  let request = activeImageCopy
  if (options?.ticket !== undefined) {
    if (
      !request ||
      request.ticket !== options.ticket ||
      request.owner !== owner ||
      request.fingerprint === null
    )
      return false
    await imageWriteFinished
    if (activeImageCopy !== request) return false
    const fingerprint = await clipboardFingerprint(await clipboard.read())
    if (activeImageCopy !== request || request.fingerprint !== fingerprint) return false
  } else {
    request = { ticket: ++nextTicket, owner, fingerprint: null }
    activeImageCopy = request
  }

  const data: Record<string, Blob | string> = {
    'image/png': new Blob([new Uint8Array(image.toPNG())], { type: 'image/png' })
  }
  if (options?.text !== undefined) data['text/plain'] = options.text
  if (options?.html !== undefined) data['text/html'] = options.html
  return commitImageCopy(request, new ClipboardItem(data))
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
