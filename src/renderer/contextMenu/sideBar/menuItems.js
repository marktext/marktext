import * as contextMenu from './actions'

export const SEPARATOR = {
  type: 'separator'
}

export const NEW_FILE = {
  label: 'New File',
  id: 'newFileMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.newFile()
  }
}

export const NEW_DIRECTORY = {
  label: 'New Directory',
  id: 'newDirectoryMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.newDirectory()
  }
}

export const COPY = {
  label: 'Copy',
  id: 'copyMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.copy()
  }
}

export const CUT = {
  label: 'Cut',
  id: 'cutMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.cut()
  }
}

export const PASTE = {
  label: 'Paste',
  id: 'pasteMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.paste()
  }
}

export const RENAME = {
  label: 'Rename',
  id: 'renameMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.rename()
  }
}

export const DELETE = {
  label: 'Move To Trash',
  id: 'deleteMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.remove()
  }
}

export const SHOW_IN_FOLDER = {
  label: 'Show In Folder',
  id: 'showInFolderMenuItem',
  click (menuItem, browserWindow) {
    contextMenu.showInFolder()
  }
}
