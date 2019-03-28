import fs from 'fs'
// import chokidar from 'chokidar'
import path from 'path'
import { promisify } from 'util'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import appWindow from '../window'
import { EXTENSION_HASN, EXTENSIONS, PANDOC_EXTENSIONS, URL_REG } from '../config'
import { writeFile, writeMarkdownFile } from '../utils/filesystem'
import appMenu from '../menu'
import { getPath, isMarkdownFile, isMarkdownFileOrLink, normalizeAndResolvePath, log, isFile, isDirectory, getRecommendTitle } from '../utils'
import userPreference from '../preference'
import pandoc from '../utils/pandoc'

// handle the response from render process.
const handleResponseForExport = async (e, { type, content, pathname, markdown }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  const extension = EXTENSION_HASN[type]
  const dirname = pathname ? path.dirname(pathname) : getPath('documents')
  let nakedFilename = getRecommendTitle(markdown)
  if (!nakedFilename) {
    nakedFilename = pathname ? path.basename(pathname, '.md') : 'Untitled'
  }
  const defaultPath = `${dirname}/${nakedFilename}${extension}`
  const filePath = dialog.showSaveDialog(win, {
    defaultPath
  })

  if (filePath) {
    let data = content
    try {
      if (!content && type === 'pdf') {
        data = await promisify(win.webContents.printToPDF.bind(win.webContents))({ printBackground: true })
        removePrintServiceFromWindow(win)
      }
      if (data) {
        await writeFile(filePath, data, extension)
        win.webContents.send('AGANI::export-success', { type, filePath })
      }
    } catch (err) {
      log(err)
      const ERROR_MSG = err.message || `Error happened when export ${filePath}`
      win.webContents.send('AGANI::show-notification', {
        title: 'Export File Error',
        type: 'error',
        message: ERROR_MSG
      })
    }
  } else {
    // User canceled save dialog
    if (type === 'pdf') {
      removePrintServiceFromWindow(win)
    }
  }
}

const handleResponseForPrint = e => {
  // See GH#749, Electron#16085 and Electron#17523.
  dialog.showMessageBox({
    type: 'info',
    buttons: ['OK'],
    defaultId: 0,
    noLink: true,
    message: 'Printing doesn\'t work',
    detail: 'Printing is disabled due to an Electron upstream issue. Please export the document as PDF and print the PDF file. We apologize for the inconvenience!'
  })
  // const win = BrowserWindow.fromWebContents(e.sender)
  // win.webContents.print({ printBackground: true }, () => {
  //   removePrintServiceFromWindow(win)
  // })
}

const handleResponseForSave = (e, { id, markdown, pathname, options }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  let recommendFilename = getRecommendTitle(markdown)
  if (!recommendFilename) {
    recommendFilename = 'Untitled'
  }

  // If the file doesn't exist on disk add it to the recently used documents later.
  const alreadyExistOnDisk = !!pathname
  pathname = pathname || dialog.showSaveDialog(win, {
    defaultPath: getPath('documents') + `/${recommendFilename}.md`
  })

  if (pathname && typeof pathname === 'string') {
    if (!alreadyExistOnDisk) {
      appMenu.addRecentlyUsedDocument(pathname)
    }

    return writeMarkdownFile(pathname, markdown, options, win)
      .then(() => {
        if (!alreadyExistOnDisk) {
          // it's a new created file, need watch
          appWindow.watcher.watch(win, pathname, 'file')
        }
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
      buttons: ['Save', 'Cancel', 'Don\'t save'],
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
const noticePandocNotFound = win => {
  return win.webContents.send('AGANI::pandoc-not-exists', {
    title: 'Import Warning',
    type: 'warning',
    message: 'Install pandoc before you want to import files.',
    time: 10000
  })
}

const pandocFile = async pathname => {
  try {
    const converter = pandoc(pathname, 'markdown')
    const data = await converter()
    // TODO: allow to open data also in a new tab instead window.
    appWindow.createWindow(undefined, data)
  } catch (err) {
    log(err)
  }
}

const removePrintServiceFromWindow = win => {
  // remove print service content and restore GUI
  win.webContents.send('AGANI::print-service-clearup')
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
  let recommendFilename = getRecommendTitle(markdown)
  if (!recommendFilename) {
    recommendFilename = 'Untitled'
  }
  const filePath = dialog.showSaveDialog(win, {
    defaultPath: pathname || getPath('documents') + `/${recommendFilename}.md`
  })
  if (filePath) {
    writeMarkdownFile(filePath, markdown, options, win)
      .then(() => {
        // need watch file after `save as`
        if (pathname !== filePath) {
          appWindow.watcher.watch(win, filePath, 'file')
          // unWatch the old file.
          appWindow.watcher.unWatch(win, pathname, 'file')
        }
        const filename = path.basename(filePath)
        win.webContents.send('AGANI::set-pathname', { id, pathname: filePath, filename })
      })
      .catch(log)
  }
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

ipcMain.on('AGANI::response-print', handleResponseForPrint)

ipcMain.on('AGANI::close-window', e => {
  const win = BrowserWindow.fromWebContents(e.sender)
  appWindow.forceClose(win)
})

ipcMain.on('AGANI::window::drop', async (e, fileList) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  for (const file of fileList) {
    if (isMarkdownFileOrLink(file)) {
      openFileOrFolder(win, file)
      break
    }
    // handle import file
    if (PANDOC_EXTENSIONS.some(ext => file.endsWith(ext))) {
      const existsPandoc = pandoc.exists()
      if (!existsPandoc) {
        noticePandocNotFound(win)
      } else {
        pandocFile(file)
      }
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
    appWindow.openFolder(win, pathname[0])
  }
})

ipcMain.on('AGANI::format-link-click', (e, { data, dirname }) => {
  if (URL_REG.test(data.href)) {
    return shell.openExternal(data.href)
  }
  let pathname = null
  if (path.isAbsolute(data.href) && isMarkdownFile(data.href)) {
    pathname = data.href
  }
  if (!path.isAbsolute(data.href) && isMarkdownFile(path.join(dirname, data.href))) {
    pathname = path.join(dirname, data.href)
  }
  if (pathname) {
    const win = BrowserWindow.fromWebContents(e.sender)
    return openFileOrFolder(win, pathname)
  }
})

export const exportFile = (win, type) => {
  win.webContents.send('AGANI::export', { type })
}

export const importFile = async win => {
  const existsPandoc = pandoc.exists()

  if (!existsPandoc) {
    return noticePandocNotFound(win)
  }
  const filename = dialog.showOpenDialog(win, {
    properties: [ 'openFile' ],
    filters: [{
      name: 'All Files',
      extensions: PANDOC_EXTENSIONS
    }]
  })

  if (filename && filename[0]) {
    pandocFile(filename[0])
  }
}

export const print = win => {
  win.webContents.send('AGANI::print')
}

export const openFileOrFolder = (win, pathname) => {
  const resolvedPath = normalizeAndResolvePath(pathname)
  if (isFile(resolvedPath)) {
    const { openFilesInNewWindow } = userPreference.getAll()
    if (openFilesInNewWindow) {
      appWindow.createWindow(resolvedPath)
    } else {
      appWindow.newTab(win, pathname)
    }
  } else if (isDirectory(resolvedPath)) {
    appWindow.createWindow(resolvedPath)
  } else {
    console.error(`[ERROR] Cannot open unknown file: "${resolvedPath}"`)
  }
}

export const openFolder = win => {
  const dirList = dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory']
  })
  if (dirList && dirList[0]) {
    openFileOrFolder(win, dirList[0])
  }
}

export const openFile = win => {
  const fileList = dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{
      name: 'text',
      extensions: EXTENSIONS
    }]
  })
  if (fileList && fileList[0]) {
    openFileOrFolder(win, fileList[0])
  }
}

export const newFile = () => {
  appWindow.createWindow()
}

/**
 * Creates a new tab.
 *
 * @param {BrowserWindow} win Browser window
 * @param {IMarkdownDocumentRaw} [rawDocument] Optional markdown document. If null a blank tab is created.
 */
export const newTab = (win, rawDocument = null) => {
  win.webContents.send('AGANI::new-tab', rawDocument)
}

export const closeTab = win => {
  win.webContents.send('AGANI::close-tab')
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
      for (const { win } of appWindow.windows.values()) {
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
