import fse from 'fs-extra'
import path from 'path'
import { LINE_ENDING_REG, LF_LINE_ENDING_REG, CRLF_LINE_ENDING_REG, isWindows } from '../config'
import userPreference from '../preference'

export const getOsLineEndingName = () => {
  const { endOfLine } = userPreference.getAll()
  if (endOfLine === 'lf') {
    return 'lf'
  }
  return endOfLine === 'crlf' || isWindows ? 'crlf' : 'lf'
}

export const getDefaultTextDirection = () => {
  const { textDirection } = userPreference.getAll()
  return textDirection
}

const getLineEnding = lineEnding => {
  if (lineEnding === 'lf') {
    return '\n'
  } else if (lineEnding === 'crlf') {
    return '\r\n'
  }
  return getOsLineEndingName() === 'crlf' ? '\r\n' : '\n'
}

const convertLineEndings = (text, lineEnding) => {
  return text.replace(LINE_ENDING_REG, getLineEnding(lineEnding))
}

export const writeFile = (pathname, content, extension) => {
  if (!pathname) {
    return Promise.reject('[ERROR] Cannot save file without path.')
  }
  pathname = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`

  return fse.outputFile(pathname, content, 'utf-8')
}

export const writeMarkdownFile = (pathname, content, options, win) => {
  const { adjustLineEndingOnSave, isUtf8BomEncoded, lineEnding } = options
  const extension = path.extname(pathname) || '.md'

  if (isUtf8BomEncoded) {
    content = '\uFEFF' + content
  }

  if (adjustLineEndingOnSave) {
    content = convertLineEndings(content, lineEnding)
  }

  return writeFile(pathname, content, extension)
}

/**
 * Reads the contents of a markdown file.
 *
 * @param {String} The path to the markdown file.
 * @returns {IMarkdownDocumentRaw} Returns a raw markdown document.
 */
export const loadMarkdownFile = async pathname => {
  let markdown = await fse.readFile(path.resolve(pathname), 'utf-8')
  // Check UTF-8 BOM (EF BB BF) encoding
  const isUtf8BomEncoded = markdown.length >= 1 && markdown.charCodeAt(0) === 0xFEFF
  if (isUtf8BomEncoded) {
    markdown = markdown.slice(1)
  }

  // Detect line ending
  const isLf = LF_LINE_ENDING_REG.test(markdown)
  const isCrlf = CRLF_LINE_ENDING_REG.test(markdown)
  const isMixedLineEndings = isLf && isCrlf
  const isUnknownEnding = !isLf && !isCrlf
  let lineEnding = getOsLineEndingName()
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

  // TODO(refactor:renderer/editor): Remove this entry! This should be loaded separately if needed.
  const textDirection = getDefaultTextDirection()

  return {
    // document information
    markdown,
    filename,
    pathname,

    // options
    isUtf8BomEncoded,
    lineEnding,
    adjustLineEndingOnSave,

    // raw file information
    isMixedLineEndings,

    // TODO(refactor:renderer/editor): see above
    textDirection
  }
}
