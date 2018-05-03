import fs from 'fs'
import path from 'path'
import { forceClose } from './createWindow'
import { log } from './utils'

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

    // check UTF-8 BOM (EF BB BF) encoding
    let isUtf8BomEncoded = file.length >= 1 && file.charCodeAt(0) === 0xFEFF
    if (isUtf8BomEncoded) {
      file = file.slice(1)
    }

    // TODO: Detect line ending

    const filename = path.basename(pathname)
    win.webContents.send('AGANI::file-loaded', {
      file,
      filename,
      pathname,
      options: {
        isUtf8BomEncoded,
        lineEnding: 'lf'
      }
    })
  })
}
