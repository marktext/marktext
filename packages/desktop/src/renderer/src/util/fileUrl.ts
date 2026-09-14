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

// `window.DIRNAME` is a raw filesystem path, whereas a markdown link or image
// path is already URL-encoded, so only the directory gets its `%`, `?` and `#`
// escaped: raw, they would read as an escape, a query or a fragment (same as the
// muya image fix for #5302).
export function encodeDirnameForUrl(dirname: string): string {
  return dirname.replace(/%/g, '%25').replace(/\?/g, '%3F').replace(/#/g, '%23')
}
