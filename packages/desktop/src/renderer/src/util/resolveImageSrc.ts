// Resolve an <img>'s src for export / static print (GH#678): a relative local
// path is resolved to an absolute `file://` URL against the current document
// directory; URLs, `data:` URIs, and already-absolute / `file://` srcs are left
// untouched. Ported from the legacy muyajs `getImageInfo(src)` so a saved
// styled-HTML / PDF document keeps rendering its images after it is moved out of
// the source folder.
const IMAGE_EXT_REG = /\.(?:jpeg|jpg|png|gif|svg|webp)(?=\?|$)/i

export function localPathToFileUrl(src: string): string {
  const normalized = src.replace(/\\/g, '/')

  if (/^\/\/[^/]+\/[^/]+/.test(normalized)) {
    return `file://${normalized.slice(2)}`
  }

  if (/^[a-z]:\//i.test(normalized)) {
    return `file:///${normalized}`
  }

  return `file://${normalized}`
}

export function resolveLocalImageSrc(src: string): string {
  if (!src) return src
  // Already a URL or data: URI — leave as-is (avoids `file://file://…`).
  if (/^(?:https?:|file:|data:)/i.test(src)) return src
  // Only rewrite recognised local image paths (mirrors muyajs's IMAGE_EXT_REG
  // gate) — leave anything else untouched, e.g. an extensionless absolute
  // server path `/api/image?id=…` must not become `file:///api/image…`.
  if (!IMAGE_EXT_REG.test(src)) return src
  // Absolute local image path (POSIX / UNC / Windows drive) → file://.
  if (/^(?:\/|\\\\|[a-zA-Z]:[\\/])/.test(src)) return localPathToFileUrl(src)
  // Relative local image path — resolve against the document directory.
  if (window.DIRNAME) return localPathToFileUrl(window.path.join(window.DIRNAME, src))
  return src
}
