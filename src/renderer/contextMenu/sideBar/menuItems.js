import * as contextMenu from './actions'

export const SEPARATOR = Object.freeze({
  type: 'separator'
})

export const NEW_FILE = Object.freeze({
  label: 'New File',
  id: 'newFileMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.newFile()
  }
})

export const NEW_DIRECTORY = Object.freeze({
  label: 'New Directory',
  id: 'newDirectoryMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.newDirectory()
  }
})

export const COPY = Object.freeze({
  label: 'Copy',
  id: 'copyMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.copy()
  }
})

export const CUT = Object.freeze({
  label: 'Cut',
  id: 'cutMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.cut()
  }
})

export const PASTE = Object.freeze({
  label: 'Paste',
  id: 'pasteMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.paste()
  }
})

export const RENAME = Object.freeze({
  label: 'Rename',
  id: 'renameMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.rename()
  }
})

export const DELETE = Object.freeze({
  label: 'Move To Trash',
  id: 'deleteMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.remove()
  }
})

export const SHOW_IN_FOLDER = Object.freeze({
  label: 'Show In Folder',
  id: 'showInFolderMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.showInFolder()
  }
})
