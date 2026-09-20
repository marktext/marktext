import { encodeDirnameForUrl, localPathToFileUrl } from './fileUrl'

// Resolve an <a>'s href for export / static print (#1688): a relative local
// path is resolved to an absolute `file://` URL against the current document
// directory so a link to a local file still works after the exported HTML / PDF
// is moved out of the source folder. In-page fragments, any URL scheme, and
// already-absolute paths are left untouched.
export function resolveLocalLinkHref(href: string): string {
  if (!href) return href
  // In-page fragment anchor (#heading) — never a filesystem path.
  if (href.startsWith('#')) return href
  // Absolute local path (Windows drive, UNC, or POSIX) → file://. Checked
  // before the scheme test, since `C:` otherwise reads as a URL scheme.
  // Delegates to localPathToFileUrl so Windows drive paths get the mandatory
  // extra slash (file:///C:/…) and UNC paths get their backslashes normalised
  // (file://server/…) — matching the behaviour of resolveLocalImageSrc.
  if (/^(?:\/|\\\\|[a-zA-Z]:[\\/])/.test(href)) return localPathToFileUrl(href)
  // Any URL scheme (http:, https:, file:, mailto:, tel:, data:…) — leave as-is.
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return href
  // Relative local path — resolve against the document directory. `join`, not
  // `resolve`: pathe's `resolve` turns a UNC `//host/share` root into `/host/share`.
  if (window.DIRNAME) {
    return localPathToFileUrl(window.path.join(encodeDirnameForUrl(window.DIRNAME), href))
  }
  return href
}
