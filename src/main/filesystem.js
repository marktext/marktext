import fs from 'fs'
import path from 'path'
import { LINE_ENDING_REG, LF_LINE_ENDING_REG, CRLF_LINE_ENDING_REG } from './config'
import { forceClose } from './createWindow'
import { log } from './utils'

const isWin = process.platform === 'win32'

const convertLineEndings = (text, lineEnding) => {
  return text.replace(LINE_ENDING_REG, getLineEnding(lineEnding))
}

const getOsLineEndingName = () => {
  // TODO: check settings option
  return isWin ? 'crlf' : 'lf'
}

const getLineEnding = lineEnding => {
  if (lineEnding === 'lf') {
    return '\n'
  } else if (lineEnding === 'crlf') {
    return '\r\n'
  }
  return isWin ? '\r\n' : '\n'
}

export const writeFile = (pathname, content, extension, e, callback = null) => {
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

export const writeMarkdownFile = (pathname, content, extension, options, win, e, quitAfterSave = false) => {
  if (options.isUtf8BomEncoded) {
    content = '\uFEFF' + content
  }

  if (options.adjustLineEndingOnSave) {
    content = convertLineEndings(content, options.lineEnding)
  }

  writeFile(pathname, content, extension, e, (err, filePath) => {
    if (!err) e.sender.send('AGANI::file-saved-successfully')
    const filename = path.basename(filePath)
    if (e && filePath) e.sender.send('AGANI::set-pathname', { pathname: filePath, filename })
    if (!err && quitAfterSave) forceClose(win)
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
    let lineEnding = getOsLineEndingName()
    if (isLf && !isCrlf) {
      lineEnding = 'lf'
    } else if (isCrlf && !isLf) {
      lineEnding = 'crlf'
    }

    let adjustLineEndingOnSave = false
    if (isMixed || lineEnding !== 'lf') {
      adjustLineEndingOnSave = lineEnding !== 'lf'
      // Convert CRLF to LF for internal use.
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

    if (isMixed) {
      // TODO: Notify user about mixed endings
    }
  })
}
