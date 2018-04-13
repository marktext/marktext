'use strict'

import fs from 'fs'
// import chokidar from 'chokidar'
import path from 'path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import createWindow, { windows } from '../createWindow'
import { EXTENSION_HASN, EXTENSIONS } from '../config'
import { clearRecentlyUsedDocuments } from '../menu'
import { getPath, isMarkdownFile, log, isFile } from '../utils'
import userPreference from '../preference'

const watchAndReload = (pathname, win) => { // when i build, and failed.
  // const watcher = chokidar.watch(pathname, {
  //   persistent: true
  // })
  // const filename = path.basename(pathname)
  // watcher.on('change', path => {
  //   fs.readFile(pathname, 'utf-8', (err, file) => {
  //     if (err) return console.log(err)
  //     win.webContents.send('AGANI::file-change', {
  //       file,
  //       filename,
  //       pathname
  //     })
  //   })
  // })
}

const writeFile = (pathname, content, extension, e, callback = null) => {
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

const writeMarkdownFile = (pathname, content, extension, isUtf8BomEncoded, win, e, quitAfterSave = false) => {
  if (isUtf8BomEncoded) {
    // js is call-by-value, so we can insert BOM
    content = '\uFEFF' + content
  }

  writeFile(pathname, content, extension, e, (err, filePath) => {
    if (!err) e.sender.send('AGANI::file-saved-successfully')
    const filename = path.basename(filePath)
    if (e && filePath) e.sender.send('AGANI::set-pathname', { pathname: filePath, filename })
    if (!err && quitAfterSave) forceClose(win)
  })
}

const forceClose = win => {
  if (!win) return
  if (windows.has(win.id)) {
    windows.delete(win.id)
  }
  win.destroy() // if use win.close(), it will cause a endless loop.
  if (windows.size === 0) {
    app.quit()
  }
}

// handle the response from render process.
const handleResponseForExport = (e, { type, content, filename, pathname }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const extension = EXTENSION_HASN[type]
  const dirname = pathname ? path.dirname(pathname) : getPath('documents')
  const nakedFilename = pathname ? path.basename(pathname, '.md') : 'untitled'
  const defaultPath = `${dirname}/${nakedFilename}${extension}`
  const filePath = dialog.showSaveDialog(win, {
    defaultPath
  })

  if (!content && type === 'pdf') {
    win.webContents.printToPDF({ printBackground: true }, (err, data) => {
      if (err) log(err)
      writeFile(filePath, data, extension, e)
    })
  } else {
    writeFile(filePath, content, extension, e)
  }
}

const handleResponseForSave = (e, { markdown, pathname, isUtf8BomEncoded, quitAfterSave = false }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (pathname) {
    writeMarkdownFile(pathname, markdown, '', isUtf8BomEncoded, win, e, quitAfterSave)
  } else {
    const filePath = dialog.showSaveDialog(win, {
      defaultPath: getPath('documents') + '/Untitled.md'
    })
    writeMarkdownFile(filePath, markdown, '.md', isUtf8BomEncoded, win, e, quitAfterSave)
  }
}

ipcMain.on('AGANI::response-file-save-as', (e, { markdown, pathname, isUtf8BomEncoded }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  let filePath = dialog.showSaveDialog(win, {
    defaultPath: pathname || getPath('documents') + '/Untitled.md'
  })
  writeMarkdownFile(filePath, markdown, '.md', isUtf8BomEncoded, win, e)
})

ipcMain.on('AGANI::response-close-confirm', (e, { filename, pathname, markdown, isUtf8BomEncoded }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['Save', 'Cancel', 'Delete'],
    defaultId: 0,
    message: `Do you want to save the changes you made to ${filename}?`,
    detail: `Your changes will be lost if you don't save them.`,
    cancelId: 1,
    noLink: true
  }, index => {
    switch (index) {
      case 2:
        forceClose(win)
        break
      case 0:
        setTimeout(() => {
          handleResponseForSave(e, { pathname, markdown, isUtf8BomEncoded, quitAfterSave: true })
        })
        break
    }
  })
})

ipcMain.on('AGANI::response-file-save', handleResponseForSave)

ipcMain.on('AGANI::response-export', handleResponseForExport)

ipcMain.on('AGANI::close-window', e => {
  const win = BrowserWindow.fromWebContents(e.sender)
  forceClose(win)
})

ipcMain.on('AGANI::window::drop', (e, fileList) => {
  for (const file of fileList) {
    if (isMarkdownFile(file)) {
      createWindow(file)
      break
    }
  }
})

ipcMain.on('AGANI::rename', (e, {
  pathname,
  newPathname
}) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!isFile(newPathname)) {
    fs.renameSync(pathname, newPathname)
    e.sender.send('AGANI::set-pathname', {
      pathname: newPathname,
      filename: path.basename(newPathname)
    })
  } else {
    dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Replace', 'Cancel'],
      defaultId: 1,
      message: `The file ${path.basename(newPathname)} is already exists. Do you want to replace it?`,
      cancelId: 1,
      noLink: true
    }, index => {
      if (index === 0) {
        fs.renameSync(pathname, newPathname)
        e.sender.send('AGANI::set-pathname', {
          pathname: newPathname,
          filename: path.basename(newPathname)
        })
      }
    })
  }
})

ipcMain.on('AGANI::response-file-move-to', (e, { pathname }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  let newPath = dialog.showSaveDialog(win, {
    buttonLabel: 'Move to',
    nameFieldLabel: 'Filename:',
    defaultPath: pathname
  })
  if (newPath === undefined) return
  fs.renameSync(pathname, newPath)
  e.sender.send('AGANI::set-pathname', { pathname: newPath, filename: path.basename(newPath) })
})

export const exportFile = (win, type) => {
  win.webContents.send('AGANI::export', { type })
}

export const print = win => {
  win.webContents.print({ silent: false, printBackground: true, deviceName: '' })
}

export const openDocument = filePath => {
  if (isFile(filePath)) {
    const newWindow = createWindow(filePath)
    watchAndReload(filePath, newWindow)
  }
}

export const open = win => {
  const filename = dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{
      name: 'text',
      extensions: EXTENSIONS
    }]
  })
  if (filename && filename[0]) {
    openDocument(filename[0])
  }
}

export const newFile = () => {
  createWindow()
}

export const save = win => {
  win.webContents.send('AGANI::ask-file-save')
}

export const saveAs = win => {
  win.webContents.send('AGANI::ask-file-save-as')
}

export const autoSave = (menuItem, browserWindow) => {
  const { checked } = menuItem
  userPreference.setItem('autoSave', checked)
    .then(() => {
      for (const win of windows.values()) {
        win.webContents.send('AGANI::user-preference', { autoSave: checked })
      }
    })
    .catch(log)
}

export const moveTo = win => {
  win.webContents.send('AGANI::ask-file-move-to')
}

export const rename = win => {
  win.webContents.send('AGANI::ask-file-rename')
}

export const clearRecentlyUsed = () => {
  clearRecentlyUsedDocuments()
}
