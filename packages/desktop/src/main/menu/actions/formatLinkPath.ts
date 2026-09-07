import path from 'path'

export const normalizeFormatLinkPath = (urlCandidate: string, dirname?: string): string => {
  let pathname = urlCandidate
  if (dirname && !path.isAbsolute(urlCandidate)) {
    pathname = path.join(dirname, urlCandidate)
  }

  // Keep CommonMark percent-decoding for filenames such as `bad%20name.md`.
  try {
    pathname = decodeURIComponent(pathname)
  } catch (err) {
    if (!(err instanceof URIError)) {
      throw err
    }
    // '%' is valid in filenames, so keep malformed escapes as literal path text.
  }

  return path.normalize(pathname)
}
