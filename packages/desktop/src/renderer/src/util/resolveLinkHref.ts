// `window.DIRNAME` is a raw filesystem path, whereas a markdown link path is
// already URL-encoded, so only the directory gets its `%`, `?` and `#` escaped:
// raw, they would read as an escape, a query or a fragment (same as the muya
// image fix for #5212).
function encodeDirnameForUrl(dirname: string): string {
  return dirname.replace(/%/g, '%25').replace(/\?/g, '%3F').replace(/#/g, '%23')
}

// Resolve an <a>'s href for export / static print (#1688): a relative local
// path is resolved to an absolute `file://` URL against the current document
// directory so a link to a local file still works after the exported HTML / PDF
// is moved out of the source folder. In-page fragments, any URL scheme, and
// already-absolute paths are left untouched.
export function resolveLocalLinkHref(href: string): string {
  if (!href) return href
  // In-page fragment anchor (#heading) — never a filesystem path.
  if (href.startsWith('#')) return href
  // Windows drive-absolute path (C:\… / C:/…) → file://. Checked before the
  // scheme test, since `C:` otherwise reads as a URL scheme.
  if (/^[a-z]:[\\/]/i.test(href)) return `file://${href}`
  // POSIX / UNC absolute path → file://.
  if (/^(?:\/|\\\\)/.test(href)) return `file://${href}`
  // Any URL scheme (http:, https:, file:, mailto:, tel:, data:…) — leave as-is.
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return href
  // Relative local path — resolve against the document directory.
  if (window.DIRNAME) {
    return `file://${window.path.resolve(encodeDirnameForUrl(window.DIRNAME), href)}`
  }
  return href
}
