import fs from 'fs'
// import chokidar from 'chokidar'
import path from 'path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import appWindow from '../window'
import { EXTENSION_HASN, EXTENSIONS } from '../config'
import { writeFile, writeMarkdownFile } from '../utils/filesystem'
import appMenu from '../menu'
import { getPath, isMarkdownFile, log, isFile, isDirectory } from '../utils'
import userPreference from '../preference'

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
      else {
        writeFile(filePath, data, extension)
          .catch(log)
      }
    })
  } else {
    writeFile(filePath, content, extension)
      .catch(log)
  }
}

const handleResponseForSave = (e, { id, markdown, pathname, options }) => {
  const win = BrowserWindow.fromWebContents(e.sender)

  pathname = pathname || dialog.showSaveDialog(win, {
    defaultPath: getPath('documents') + '/Untitled.md'
  })

  if (pathname && typeof pathname === 'string') {
    return writeMarkdownFile(pathname, markdown, options, win)
      .then(() => {
        const filename = path.basename(pathname)
        win.webContents.send('AGANI::set-pathname', { id, pathname, filename })
        return id
      })
  } else {
    return Promise.resolve()
  }
}

const showUnsavedFilesMessage = (win, files) => {
  return new Promise((resolve, reject) => {
    dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Save', 'Cancel', 'Delete'],
      defaultId: 0,
      message: `Do you want to save the changes you made to ${files.length} ${files.length === 1 ? 'file' : 'files'}?\n\n${files.map(f => f.filename).join('\n')}`,
      detail: `Your changes will be lost if you don't save them.`,
      cancelId: 1,
      noLink: true
    }, index => {
      switch (index) {
        case 2:
          resolve({ needSave: false })
          break
        case 0:
          setTimeout(() => {
            resolve({ needSave: true })
          })
          break
      }
    })
  })
}

ipcMain.on('AGANI::save-all', (e, unSavedFiles) => {
  Promise.all(unSavedFiles.map(file => handleResponseForSave(e, file)))
    .catch(log)
})

ipcMain.on('AGANI::save-close', async (e, unSavedFiles, isSingle) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const { needSave } = await showUnsavedFilesMessage(win, unSavedFiles)
  const EVENT = isSingle ? 'AGANI::save-single-response' : 'AGANI::save-all-response'
  if (needSave) {
    Promise.all(unSavedFiles.map(file => handleResponseForSave(e, file)))
      .then(arr => {
        const data = arr.filter(id => id)
        win.send(EVENT, { err: null, data })
      })
      .catch(err => {
        win.send(EVENT, { err, data: null })
        log(err)
      })
  } else {
    const data = unSavedFiles.map(f => f.id)
    win.send(EVENT, { err: null, data })
  }
})

ipcMain.on('AGANI::response-file-save-as', (e, { id, markdown, pathname, options }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const filePath = dialog.showSaveDialog(win, {
    defaultPath: pathname || getPath('documents') + '/Untitled.md'
  })
  writeMarkdownFile(filePath, markdown, options, win)
    .then(() => {
      const filename = path.basename(filePath)
      win.webContents.send('AGANI::set-pathname', { id, pathname: filePath, filename })
    })
    .catch(log)
})

ipcMain.on('AGANI::response-close-confirm', async (e, unSavedFiles) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const { needSave } = await showUnsavedFilesMessage(win, unSavedFiles)
  if (needSave) {
    Promise.all(unSavedFiles.map(file => handleResponseForSave(e, file)))
      .then(() => {
        appWindow.forceClose(win)
      })
      .catch(err => {
        console.log(err)
        log(err)
      })
  } else {
    appWindow.forceClose(win)
  }
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

ipcMain.on('AGANI::rename', (e, { id, pathname, newPathname }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!isFile(newPathname)) {
    fs.renameSync(pathname, newPathname)
    e.sender.send('AGANI::set-pathname', {
      id,
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
          id,
          pathname: newPathname,
          filename: path.basename(newPathname)
        })
      }
    })
  }
})

ipcMain.on('AGANI::response-file-move-to', (e, { id, pathname }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  let newPath = dialog.showSaveDialog(win, {
    buttonLabel: 'Move to',
    nameFieldLabel: 'Filename:',
    defaultPath: pathname
  })
  if (newPath === undefined) return
  fs.renameSync(pathname, newPath)
  e.sender.send('AGANI::set-pathname', { id, pathname: newPath, filename: path.basename(newPath) })
})

ipcMain.on('AGANI::ask-for-open-project-in-sidebar', e => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const pathname = dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory']
  })
  if (pathname && pathname[0]) {
    appWindow.openProject(win, pathname[0])
  }
})

export const exportFile = (win, type) => {
  win.webContents.send('AGANI::export', { type })
}

export const print = win => {
  win.webContents.print({ silent: false, printBackground: true, deviceName: '' })
}

export const openFileOrProject = pathname => {
  if (isFile(pathname) || isDirectory(pathname)) {
    appWindow.createWindow(pathname)
  }
}

export const openProject = win => {
  const pathname = dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory']
  })
  if (pathname && pathname[0]) {
    openFileOrProject(pathname[0])
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
    openFileOrProject(filename[0])
  }
}

export const newFile = () => {
  appWindow.createWindow()
}

export const newTab = win => {
  win.webContents.send('AGANI::new-tab')
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
