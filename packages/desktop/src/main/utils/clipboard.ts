import { fileURLToPath } from 'url'
import { clipboard, nativeImage } from 'electron'
import type { NativeImage } from 'electron'
import log from 'electron-log'

// Electron 44 replaced the synchronous clipboard accessors (`readImage`,
// `readBuffer(format)`, sync `has`/`read`) with a W3C-style async API. These
// helpers surface that API through the small set of operations the main
// process needs.

/** MIME types Electron maps to the OS "copied files" clipboard format. */
const URI_LIST_MIME_TYPE = 'text/uri-list'

/** PNG first: a screenshot round-trip only keeps exact pixels losslessly in PNG. */
const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'] as const

/** Read the clipboard bitmap as a `NativeImage`, or `null` when there is none. */
export const readClipboardImage = async(): Promise<NativeImage | null> => {
  try {
    const items = await clipboard.read()
    for (const mimeType of IMAGE_MIME_TYPES) {
      const item = items.find(({ types }) => types.includes(mimeType))
      if (!item) continue
      const payload = await item.getType(mimeType)
      if (!(payload instanceof Blob)) continue
      const image = nativeImage.createFromBuffer(Buffer.from(await payload.arrayBuffer()))
      if (!image.isEmpty()) return image
    }
  } catch (err) {
    log.error('clipboard.read (image) failed:', err)
  }
  return null
}

/**
 * Resolve the first local file on the clipboard, or `null`.
 *
 * `text/uri-list` is Electron's mapping of the native "copied files" format —
 * `CF_HDROP` on Windows, `NSFilenamesPboardType` on macOS — so this replaces
 * the per-platform raw-format parsing the pre-Electron-44 code needed.
 */
export const readClipboardFilePath = async(): Promise<string | null> => {
  try {
    const items = await clipboard.read()
    const item = items.find(({ types }) => types.includes(URI_LIST_MIME_TYPE))
    if (!item) return null
    const payload = await item.getType(URI_LIST_MIME_TYPE)
    if (!(payload instanceof Blob)) return null
    for (const line of (await payload.text()).split(/\r?\n/)) {
      const uri = line.trim()
      if (!uri.startsWith('file:')) continue
      try {
        return fileURLToPath(uri)
      } catch {
        // Ignore malformed entries and keep looking for a usable path.
      }
    }
  } catch (err) {
    log.error('clipboard.read (file path) failed:', err)
  }
  return null
}
