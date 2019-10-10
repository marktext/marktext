import * as contextMenu from './actions'

export const SEPARATOR = {
  type: 'separator'
}

export const CLOSE_THIS = {
  label: 'Close',
  id: 'closeThisTab',
  click (menuItem, browserWindow) {
    contextMenu.closeThis(menuItem.tab)
  }
}

export const CLOSE_OTHERS = {
  label: 'Close others',
  id: 'closeOtherTabs',
  click (menuItem, browserWindow) {
    contextMenu.closeOthers(menuItem.tab)
  }
}

export const CLOSE_SAVED = {
  label: 'Close saved tabs',
  id: 'closeSavedTabs',
  click (menuItem, browserWindow) {
    contextMenu.closeSaved()
  }
}

export const CLOSE_ALL = {
  label: 'Close all tabs',
  id: 'closeAllTabs',
  click (menuItem, browserWindow) {
    contextMenu.closeAll()
  }
}

export const RENAME = {
  label: 'Rename',
  id: 'renameFile',
  click (menuItem, browserWindow) {
    contextMenu.rename(menuItem.tab)
  }
}

export const COPY_PATH = {
  label: 'Copy path',
  id: 'copyPath',
  click (menuItem, browserWindow) {
    contextMenu.copyPath(menuItem.tab)
  }
}

export const SHOW_IN_FOLDER = {
  label: 'Show in folder',
  id: 'showInFolder',
  click (menuItem, browserWindow) {
    contextMenu.showInFolder(menuItem.tab)
  }
}
