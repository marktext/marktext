import fs from 'fs-extra'
import path from 'path'
import log from 'electron-log'
import { LINE_ENDING_REG, LF_LINE_ENDING_REG, CRLF_LINE_ENDING_REG } from '../config'
import { isDirectory } from 'common/filesystem'
import { isMarkdownFileOrLink } from 'common/filesystem/paths'
import { normalizeAndResolvePath, writeFile } from '../filesystem'

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
  const { adjustLineEndingOnSave, encoding, lineEnding } = options
  const extension = path.extname(pathname) || '.md'

  if (encoding === 'utf8bom') {
    content = '\uFEFF' + content
  }

  if (adjustLineEndingOnSave) {
    content = convertLineEndings(content, lineEnding)
  }

  // TODO(@fxha): "safeSaveDocuments" using temporary file and rename syscall.
  return writeFile(pathname, content, extension)
}

/**
 * Reads the contents of a markdown file.
 *
 * @param {string} pathname The path to the markdown file.
 * @param {string} preferedEOL The prefered EOL.
 * @returns {IMarkdownDocumentRaw} Returns a raw markdown document.
 */
export const loadMarkdownFile = async (pathname, preferedEOL) => {
  let markdown = await fs.readFile(path.resolve(pathname), 'utf-8')

  // Check UTF-8 BOM (EF BB BF) encoding
  const isUtf8BomEncoded = markdown.length >= 1 && markdown.charCodeAt(0) === 0xFEFF
  if (isUtf8BomEncoded) {
    markdown.splice(0, 1)
  }

  // TODO(@fxha): Check for more file encodings and whether the file is binary but for now expect UTF-8.
  const encoding = isUtf8BomEncoded ? 'utf8bom' : 'utf8'

  // Detect line ending
  const isLf = LF_LINE_ENDING_REG.test(markdown)
  const isCrlf = CRLF_LINE_ENDING_REG.test(markdown)
  const isMixedLineEndings = isLf && isCrlf
  const isUnknownEnding = !isLf && !isCrlf
  let lineEnding = preferedEOL
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
