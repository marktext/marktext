import fs from 'fs'
import path from 'path'
import { LINE_ENDING_REG, LF_LINE_ENDING_REG, CRLF_LINE_ENDING_REG, isWindows } from '../config'
import appWindow from '../window'
import userPreference from '../preference'
import { log } from './index'

export const getOsLineEndingName = () => {
  const { endOfLine } = userPreference.getAll()
  if (endOfLine === 'lf') {
    return 'lf'
  }
  return endOfLine === 'crlf' || isWindows ? 'crlf' : 'lf'
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

export const writeFile = (pathname, content, extension, callback = null) => {
  if (pathname) {
    pathname = !extension || pathname.endsWith(extension) ? pathname : `${pathname}${extension}`
    fs.writeFile(pathname, content, 'utf-8', err => {
      if (err) log(err)
      if (callback) callback(err, pathname)
    })
  } else {
    log('[ERROR] Cannot save file without path.')
  }
}

export const writeMarkdownFile = (pathname, content, options, win, e, quitAfterSave = false) => {
  const { adjustLineEndingOnSave, isUtf8BomEncoded, lineEnding } = options
  const extension = path.extname(pathname) || '.md'

  if (isUtf8BomEncoded) {
    content = '\uFEFF' + content
  }

  if (adjustLineEndingOnSave) {
    content = convertLineEndings(content, lineEnding)
  }

  writeFile(pathname, content, extension, (err, filePath) => {
    if (!err) e.sender.send('AGANI::file-saved-successfully')
    const filename = path.basename(filePath)
    if (e && filePath) e.sender.send('AGANI::set-pathname', { pathname: filePath, filename })
    if (!err && quitAfterSave) appWindow.forceClose(win)
  })
}

export const loadMarkdownFile = (win, pathname) => {
  fs.readFile(path.resolve(pathname), 'utf-8', (err, file) => {
    if (err) {
      log(err)
      return
    }

    // Check UTF-8 BOM (EF BB BF) encoding
    const isUtf8BomEncoded = file.length >= 1 && file.charCodeAt(0) === 0xFEFF
    if (isUtf8BomEncoded) {
      file = file.slice(1)
    }

    // Detect line ending
    const isLf = LF_LINE_ENDING_REG.test(file)
    const isCrlf = CRLF_LINE_ENDING_REG.test(file)
    const isMixed = isLf && isCrlf
    const isUnknownEnding = !isLf && !isCrlf
    let lineEnding = getOsLineEndingName()
    if (isLf && !isCrlf) {
      lineEnding = 'lf'
    } else if (isCrlf && !isLf) {
      lineEnding = 'crlf'
    }

    let adjustLineEndingOnSave = false
    if (isMixed || isUnknownEnding || lineEnding !== 'lf') {
      adjustLineEndingOnSave = lineEnding !== 'lf'
      // Convert to LF for internal use.
      file = convertLineEndings(file, 'lf')
    }

    const filename = path.basename(pathname)
    win.webContents.send('AGANI::file-loaded', {
      file,
      filename,
      pathname,
      options: {
        isUtf8BomEncoded,
        lineEnding,
        adjustLineEndingOnSave
      }
    })

    // Notify user about mixed endings
    if (isMixed) {
      win.webContents.send('AGANI::show-info-notification', {
        msg: `The document has mixed line endings which are automatically normalized to ${lineEnding.toUpperCase()}.`,
        timeout: 20000
      })
    }
  })
}
