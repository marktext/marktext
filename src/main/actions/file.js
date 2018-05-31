'use strict'

import fs from 'fs'
// import chokidar from 'chokidar'
import path from 'path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import appWindow from '../window'
import { EXTENSION_HASN, EXTENSIONS } from '../config'
import { writeFile, writeMarkdownFile } from '../utils/filesystem'
import appMenu from '../menu'
import { getPath, isMarkdownFile, log, isFile } from '../utils'
import userPreference from '../preference'

// TODO(fxha): Do we still need this?
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
      writeFile(filePath, data, extension)
    })
  } else {
    writeFile(filePath, content, extension)
  }
}

const handleResponseForSave = (e, { markdown, pathname, options, quitAfterSave = false }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (pathname) {
    writeMarkdownFile(pathname, markdown, options, win, e, quitAfterSave)
  } else {
    const filePath = dialog.showSaveDialog(win, {
      defaultPath: getPath('documents') + '/Untitled.md'
    })
    writeMarkdownFile(filePath, markdown, options, win, e, quitAfterSave)
  }
}

ipcMain.on('AGANI::response-file-save-as', (e, { markdown, pathname, options }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const filePath = dialog.showSaveDialog(win, {
    defaultPath: pathname || getPath('documents') + '/Untitled.md'
  })
  writeMarkdownFile(filePath, markdown, options, win, e)
})

ipcMain.on('AGANI::response-close-confirm', (e, { filename, pathname, markdown, options }) => {
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
        appWindow.forceClose(win)
        break
      case 0:
        setTimeout(() => {
          handleResponseForSave(e, { pathname, markdown, options, quitAfterSave: true })
        })
        break
    }
  })
})

ipcMain.on('AGANI::response-file-save', handleResponseForSave)

ipcMain.on('AGANI::response-export', handleResponseForExport)

ipcMain.on('AGANI::close-window', e => {
  const win = BrowserWindow.fromWebContents(e.sender)
  appWindow.forceClose(win)
})

ipcMain.on('AGANI::window::drop', (e, fileList) => {
  for (const file of fileList) {
    if (isMarkdownFile(file)) {
      appWindow.createWindow(file)
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
    const newWindow = appWindow.createWindow(filePath)
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
  appWindow.createWindow()
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
      for (const win of appWindow.windows.values()) {
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
  appMenu.clearRecentlyUsedDocuments()
}
