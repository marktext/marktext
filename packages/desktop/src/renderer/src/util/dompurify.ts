import DOMPurify from 'dompurify'

export const PREVIEW_DOMPURIFY_CONFIG = Object.freeze({
  FORBID_ATTR: ['style', 'contenteditable'],
  ALLOW_DATA_ATTR: false,
  USE_PROFILES: {
    html: true,
    svg: true,
    svgFilters: true,
    mathMl: false
  },
  RETURN_TRUSTED_TYPE: false
})

export const EXPORT_DOMPURIFY_CONFIG = Object.freeze({
  FORBID_ATTR: ['contenteditable'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['data-align'],
  USE_PROFILES: {
    html: true,
    svg: true,
    svgFilters: true,
    mathMl: false
  },
  RETURN_TRUSTED_TYPE: false,
  // Allow "file" protocol to export images on Windows (#1997).
  ALLOWED_URI_REGEXP:
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|file):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i // eslint-disable-line no-useless-escape
})

// The legacy `muya/lib/utils/dompurify` default export was simply
// `DOMPurify.sanitize`, so we vendor `dompurify` directly (already a desktop
// dependency) to keep behavior identical: this is the RAW sanitizer that does
// not escape HTML — callers (e.g. pdf.ts) escape/unescape around it as needed.
// Both configs set `RETURN_TRUSTED_TYPE: false`, so the result is always a
// string at runtime; the cast bridges DOMPurify's `string | TrustedHTML`
// overload union (which the loosely-typed options can't statically narrow).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sanitize = (html: string, purifyOptions?: any): string => {
  return DOMPurify.sanitize(html, purifyOptions) as unknown as string
}
