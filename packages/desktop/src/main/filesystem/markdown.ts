import fsPromises from 'fs/promises'
import path from 'path'
import log from 'electron-log'
import iconv from 'iconv-lite'
import { LINE_ENDING_REG, LF_LINE_ENDING_REG, CRLF_LINE_ENDING_REG } from '../config'
import { isDirectory2 } from 'common/filesystem'
import { isMarkdownFile } from 'common/filesystem/paths'
import { normalizeAndResolvePath, writeFile } from '../filesystem'
import { guessEncoding } from './encoding'
import type { Encoding } from 'common/encoding'
import { getEncodingName } from 'common/encoding'
import type { LineEnding } from '@shared/types/files'

interface MarkdownDocumentOptions {
  adjustLineEndingOnSave: boolean
  lineEnding: LineEnding
  encoding: Encoding
}

interface MarkdownDocumentRaw {
  markdown: string
  filename: string
  pathname: string
  encoding: Encoding
  lineEnding: LineEnding
  adjustLineEndingOnSave: boolean
  trimTrailingNewline: number
  isMixedLineEndings: boolean
}

const getLineEnding = (lineEnding: LineEnding): string => {
  if (lineEnding === 'lf') {
    return '\n'
  } else if (lineEnding === 'crlf') {
    return '\r\n'
  }

  // This should not happen but use fallback value.
  log.error(`Invalid end of line character: expected "lf" or "crlf" but got "${lineEnding}".`)
  return '\n'
}

const convertLineEndings = (text: string, lineEnding: LineEnding): string => {
  return text.replace(LINE_ENDING_REG, getLineEnding(lineEnding))
}

/**
 * Special function to normalize directory and markdown file paths.
 * Returns the normalized path and a directory hint, or null if it's not a
 * directory or markdown file.
 */
export const normalizeMarkdownPath = (
  pathname: string
): { isDir: boolean; path: string } | null => {
  const isDir = isDirectory2(pathname)
  if (isDir || isMarkdownFile(pathname)) {
    const resolved = normalizeAndResolvePath(pathname)
    if (resolved) {
      return { isDir, path: resolved }
    } else {
      console.error(`[ERROR] Cannot resolve "${pathname}".`)
    }
  }
  return null
}

/**
 * Maximum number of distinct unrepresentable characters collected for the
 * error message. Keeps the failure notice readable (#5614).
 */
export const MAX_UNREPRESENTABLE_SAMPLE = 8

/**
 * Returns up to `MAX_UNREPRESENTABLE_SAMPLE` distinct characters from
 * `content` that do not round-trip through `encoding` — i.e. characters
 * that `iconv.encode` would silently replace with `?` (or U+FFFD for UTF-8)
 * on save, destroying user data (#5614). Empty result means the document
 * round-trips losslessly.
 *
 * The lockstep walk compares the in-memory content against a decode of its
 * own encoding. A spot check (every Nth char) keeps the cost bounded for
 * large documents while still catching mixed scripts reliably; any hit
 * flips to a full scan because correctness on save is on the line.
 */
export const findUnrepresentableChars = (
  content: string,
  encoding: string
): string[] => {
  if (!content || !iconv.encodingExists(encoding)) {
    return []
  }

  // Walk code points, not code units, so surrogate pairs (emoji, CJK, etc.)
  // are each detected as a single character instead of being mis-flagged at
  // the lone-surrogate step: iconv-lite encodes a lone surrogate to U+FFFD
  // and the round-trip comparison would otherwise falsely report it lost.
  const chars = Array.from(content)
  if (chars.length === 0) {
    return []
  }

  const probe = (char: string): boolean => {
    const encoded = iconv.encode(char, encoding)
    const roundTripped = iconv.decode(encoded, encoding)
    return stripBom(roundTripped) !== stripBom(char)
  }

  // Cheap pass over the front and back so any loss is detected without
  // scanning a very long document. If a probe hits a loss we fall through to
  // the full scan below, which names up to MAX_UNREPRESENTABLE_SAMPLE
  // distinct characters instead of whatever the stride happened to land on.
  const stride = Math.max(1, Math.floor(chars.length / 256))
  for (let i = 0; i < chars.length; i += stride) {
    if (probe(chars[i])) {
      return scan(chars, encoding)
    }
  }
  for (let i = chars.length - 1; i >= 0; i -= stride) {
    if (probe(chars[i])) {
      return scan(chars, encoding)
    }
  }
  return []
}

// iconv-lite strips a leading BOM on decode, so a literal U+FEFF in the
// content would round-trip to "" in utf8/utf16 and be falsely reported as
// unrepresentable. Strip it from both sides so the comparisons below only
// flag real loss (e.g. "?" substitution in cp1252/shiftjis/gbk).
const stripBom = (s: string): string => s.replace(/^\uFEFF/, '')

// Full scan that returns up to MAX_UNREPRESENTABLE_SAMPLE distinct
// characters that cannot be represented losslessly in `encoding`.
const scan = (chars: string[], encoding: string): string[] => {
  const lost = new Set<string>()
  for (const char of chars) {
    if (lost.size >= MAX_UNREPRESENTABLE_SAMPLE) {
      break
    }
    if (lost.has(char)) {
      continue
    }
    const encoded = iconv.encode(char, encoding)
    const roundTripped = iconv.decode(encoded, encoding)
    if (stripBom(roundTripped) !== stripBom(char)) {
      lost.add(char)
    }
  }
  return [...lost]
}

/**
 * Write the content into a file.
 *
 * Throws an `EncodingLossError` (matched by `err.name`) when the document
 * contains characters the target encoding cannot represent, so the caller
 * surfaces a failure notice instead of silently writing `?` (#5614).
 */
export const writeMarkdownFile = (
  pathname: string,
  content: string,
  options: MarkdownDocumentOptions
): Promise<void> => {
  const { adjustLineEndingOnSave, lineEnding } = options
  const { encoding, isBom } = options.encoding
  const extension = path.extname(pathname) || '.md'

  if (adjustLineEndingOnSave) {
    content = convertLineEndings(content, lineEnding)
  }

  const lost = findUnrepresentableChars(content, encoding)
  if (lost.length > 0) {
    const sample = lost.map((c) => JSON.stringify(c)).join(', ')
    const name = getEncodingName(options.encoding)
    const err = new Error(
      `Cannot save: ${lost.length === 1 ? 'a character' : 'some characters'} ` +
      `(${sample}) cannot be represented in ${name}. ` +
      'Save as UTF-8 instead to keep every character.'
    )
    err.name = 'EncodingLossError'
    return Promise.reject(err)
  }

  const buffer = iconv.encode(content, encoding, { addBOM: isBom })

  return writeFile(pathname, buffer, extension, undefined)
}

/**
 * Reads the contents of a markdown file.
 */
export const loadMarkdownFile = async(
  pathname: string,
  preferredEol: LineEnding,
  autoGuessEncoding: boolean = true,
  trimTrailingNewline: number = 2,
  autoNormalizeLineEndings: boolean = false
): Promise<MarkdownDocumentRaw> => {
  // TODO: Use streams to not buffer the file multiple times and only guess
  //       encoding on the first 256/512 bytes.

  const buffer = await fsPromises.readFile(path.resolve(pathname))

  const encoding = guessEncoding(buffer, autoGuessEncoding)
  const supported = iconv.encodingExists(encoding.encoding)
  if (!supported) {
    throw new Error(`"${encoding.encoding}" encoding is not supported.`)
  }

  let markdown = iconv.decode(buffer, encoding.encoding)

  // Detect line ending
  const isLf = LF_LINE_ENDING_REG.test(markdown)
  const isCrlf = CRLF_LINE_ENDING_REG.test(markdown)
  const isMixedLineEndings = isLf && isCrlf
  const isUnknownEnding = !isLf && !isCrlf
  let lineEnding: LineEnding = preferredEol
  if (isLf && !isCrlf) {
    lineEnding = 'lf'
  } else if (isCrlf && !isLf) {
    lineEnding = 'crlf'
  }

  let adjustLineEndingOnSave = false

  if (isMixedLineEndings || isUnknownEnding || lineEnding !== 'lf') {
    markdown = convertLineEndings(markdown, 'lf')
    // MarkText always uses LF internally. If the user did not request LF line
    // endings, we need to adjust on save.
    adjustLineEndingOnSave = !autoNormalizeLineEndings && lineEnding !== 'lf'
  }

  // Detect final newline
  if (trimTrailingNewline === 2) {
    if (!markdown) {
      trimTrailingNewline = 3
    } else {
      const lastIndex = markdown.length - 1
      if (lastIndex >= 1 && markdown[lastIndex] === '\n' && markdown[lastIndex - 1] === '\n') {
        trimTrailingNewline = 2
      } else if (markdown[lastIndex] === '\n') {
        trimTrailingNewline = 1
      } else {
        trimTrailingNewline = 0
      }
    }
  }

  const filename = path.basename(pathname)

  return {
    markdown,
    filename,
    pathname,
    encoding,
    lineEnding,
    adjustLineEndingOnSave,
    trimTrailingNewline,
    isMixedLineEndings
  }
}
