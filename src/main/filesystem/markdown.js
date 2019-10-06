import fs from 'fs-extra'
import path from 'path'
import log from 'electron-log'
import iconv from 'iconv-lite'
import { LINE_ENDING_REG, LF_LINE_ENDING_REG, CRLF_LINE_ENDING_REG } from '../config'
import { isDirectory } from 'common/filesystem'
import { isMarkdownFileOrLink } from 'common/filesystem/paths'
import { normalizeAndResolvePath, writeFile } from '../filesystem'
import { guessEncoding } from './encoding'

const getLineEnding = lineEnding => {
  if (lineEnding === 'lf') {
    return '\n'
  } else if (lineEnding === 'crlf') {
    return '\r\n'
  }

  // This should not happend but use fallback value.
  log.error(`Invalid end of line character: expected "lf" or "crlf" but got "${lineEnding}".`)
  return '\n'
}

const convertLineEndings = (text, lineEnding) => {
  return text.replace(LINE_ENDING_REG, getLineEnding(lineEnding))
}

/**
 * Special function to normalize directory and markdown file paths.
 *
 * @param {string} pathname The path to the file or directory.
 * @returns {{isDir: boolean, path: string}?} Returns the normalize path and a
 * directory hint or null if it's not a directory or markdown file.
 */
export const normalizeMarkdownPath = pathname => {
  const isDir = isDirectory(pathname)
  if (isDir || isMarkdownFileOrLink(pathname)) {
    // Normalize and resolve the path or link target.
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
 * Write the content into a file.
 *
 * @param {string} pathname The path to the file.
 * @param {string} content The buffer to save.
 * @param {IMarkdownDocumentOptions} options The markdown document options
 */
export const writeMarkdownFile = (pathname, content, options) => {
  const { adjustLineEndingOnSave, lineEnding } = options
  const { encoding, isBom } = options.encoding
  const extension = path.extname(pathname) || '.md'

  if (adjustLineEndingOnSave) {
    content = convertLineEndings(content, lineEnding)
  }

  const buffer = iconv.encode(content, encoding, { addBOM: isBom })

  // TODO(@fxha): "safeSaveDocuments" using temporary file and rename syscall.
  return writeFile(pathname, buffer, extension, undefined)
}

/**
 * Reads the contents of a markdown file.
 *
 * @param {string} pathname The path to the markdown file.
 * @param {string} preferedEol The prefered EOL.
 * @returns {IMarkdownDocumentRaw} Returns a raw markdown document.
 */
export const loadMarkdownFile = async (pathname, preferedEol, autoGuessEncoding = true) => {
  // TODO: Use streams to not buffer the file multiple times and only guess
  //       encoding on the first 256/512 bytes.

  let buffer = await fs.readFile(path.resolve(pathname))

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
  let lineEnding = preferedEol
  if (isLf && !isCrlf) {
    lineEnding = 'lf'
  } else if (isCrlf && !isLf) {
    lineEnding = 'crlf'
  }

  let adjustLineEndingOnSave = false
  if (isMixedLineEndings || isUnknownEnding || lineEnding !== 'lf') {
    adjustLineEndingOnSave = lineEnding !== 'lf'
    // Convert to LF for internal use.
    markdown = convertLineEndings(markdown, 'lf')
  }

  const filename = path.basename(pathname)
  return {
    // document information
    markdown,
    filename,
    pathname,

    // options
    encoding,
    lineEnding,
    adjustLineEndingOnSave,

    // raw file information
    isMixedLineEndings
  }
}
