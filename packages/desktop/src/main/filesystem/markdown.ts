import fsPromises from 'fs/promises'
import { lstatSync, statSync } from 'fs'
import path from 'path'
import log from 'electron-log'
import iconv from 'iconv-lite'
import { LINE_ENDING_REG, LF_LINE_ENDING_REG, CRLF_LINE_ENDING_REG } from '../config'
import { isDirectory2 } from 'common/filesystem'
import { hasMarkdownExtension, isMarkdownFile } from 'common/filesystem/paths'
import { normalizeAndResolvePath, writeFile } from '../filesystem'
import { guessEncoding } from './encoding'
import type { Encoding } from 'common/encoding'
import type { LineEnding } from '@shared/types/files'

interface MarkdownDocumentOptions {
  adjustLineEndingOnSave: boolean
  lineEnding: LineEnding
  encoding: Encoding
}

interface MarkdownDocumentRaw {
  isPendingCreation?: boolean
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

export const normalizeCliMarkdownPath = (pathname: string) => {
  try {
    lstatSync(pathname)
    return normalizeMarkdownPath(pathname)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error(err)
      return null
    }
    if (!hasMarkdownExtension(pathname)) return null
    try {
      if (!statSync(path.dirname(path.resolve(pathname))).isDirectory()) return null
    } catch (parentError) {
      log.error(parentError)
      return null
    }
    return { isDir: false, path: path.resolve(pathname), allowMissing: true }
  }
}

export const loadCliMarkdownFile = async(
  pathname: string,
  defaultEncoding: string,
  ...args: Parameters<typeof loadMarkdownFile> extends [string, ...infer Rest] ? Rest : never
): Promise<MarkdownDocumentRaw> => {
  try {
    return await loadMarkdownFile(pathname, ...args)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    await fsPromises.stat(path.dirname(pathname))
    return {
      pathname,
      filename: path.basename(pathname),
      markdown: '',
      isPendingCreation: true,
      encoding: { encoding: defaultEncoding, isBom: false },
      lineEnding: args[0],
      adjustLineEndingOnSave: args[0] !== 'lf',
      trimTrailingNewline: args[2] ?? 2,
      isMixedLineEndings: false
    }
  }
}

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

  const buffer = iconv.encode(content, encoding, { addBOM: isBom })

  return writeFile(pathname, buffer, extension, undefined)
}

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
