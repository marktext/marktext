import path from 'path'
import type { CustomThemeType } from '../../shared/types/theme'

/** A custom theme file must be named `<id>.theme.css`. */
export const THEME_FILE_SUFFIX = '.theme.css'

/**
 * Valid custom theme file id: lowercase, starts with a letter or digit, then
 * letters/digits/hyphen/underscore, up to 64 chars. Keeps ids filesystem-safe
 * and free of path separators or traversal sequences.
 */
export const THEME_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

/** Maximum size (in bytes) of a custom theme file we will read. */
export const MAX_THEME_FILE_BYTES = 512 * 1024

export interface ThemeMetadata {
  fileId: string
  name: string
  type: CustomThemeType
}

/**
 * Derive the canonical file id from a `<id>.theme.css` path or filename.
 *
 * @returns The file id, or `null` when the name is not a valid `*.theme.css`
 *   with an allowed id.
 */
export const fileIdFromFilename = (filename: string): string | null => {
  const base = path.basename(filename)
  if (!base.toLowerCase().endsWith(THEME_FILE_SUFFIX)) return null
  const fileId = base.slice(0, base.length - THEME_FILE_SUFFIX.length)
  return THEME_ID_PATTERN.test(fileId) ? fileId : null
}

/** Title-case a hyphen/underscore id, e.g. `solarized-light` -> `Solarized Light`. */
const titleCase = (id: string): string =>
  id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

/**
 * Parse the optional leading metadata header from a theme's CSS and combine it
 * with the (authoritative) file id.
 *
 * The header is a leading block comment within the first 2KB, for example:
 *
 *     /*!
 *      * @name My Theme
 *      * @type dark
 *      *\/
 *
 * The filename always wins for the id; a mismatched `@id` header is ignored.
 * `@type` defaults to `light` when missing or invalid (colour auto-detection is
 * intentionally avoided as unreliable).
 *
 * @param fileId The canonical id derived from the filename.
 * @param css The raw CSS contents.
 */
export const parseThemeMetadata = (fileId: string, css: string): ThemeMetadata => {
  const head = css.slice(0, 2048)
  const comment = head.match(/\/\*[!*]?([\s\S]*?)\*\//)
  let name = ''
  let type: CustomThemeType = 'light'
  if (comment) {
    const body = comment[1]
    const nameMatch = body.match(/@name\s+(.+)/)
    if (nameMatch) name = nameMatch[1].trim()
    const typeMatch = body.match(/@type\s+(light|dark)\b/i)
    if (typeMatch) type = typeMatch[1].toLowerCase() as CustomThemeType
  }
  return {
    fileId,
    name: name || titleCase(fileId),
    type
  }
}
