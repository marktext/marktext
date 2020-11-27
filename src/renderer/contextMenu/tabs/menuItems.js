import * as contextMenu from './actions'

export const SEPARATOR = Object.freeze({
  type: 'separator'
})

export const CLOSE_THIS = Object.freeze({
  label: 'Close',
  id: 'closeThisTab',
  click (menuItem, browserWindow) {
    contextMenu.closeThis(menuItem._tabId)
  }
})

export const CLOSE_OTHERS = Object.freeze({
  label: 'Close others',
  id: 'closeOtherTabs',
  click (menuItem, browserWindow) {
    contextMenu.closeOthers(menuItem._tabId)
  }
})

export const CLOSE_SAVED = Object.freeze({
  label: 'Close saved tabs',
  id: 'closeSavedTabs',
  click (menuItem, browserWindow) {
    contextMenu.closeSaved()
  }
})

export const CLOSE_ALL = Object.freeze({
  label: 'Close all tabs',
  id: 'closeAllTabs',
  click (menuItem, browserWindow) {
    contextMenu.closeAll()
  }
})

export const RENAME = Object.freeze({
  label: 'Rename',
  id: 'renameFile',
  click (menuItem, browserWindow) {
    contextMenu.rename(menuItem._tabId)
  }
})

export const COPY_PATH = Object.freeze({
  label: 'Copy path',
  id: 'copyPath',
  click (menuItem, browserWindow) {
    contextMenu.copyPath(menuItem._tabId)
  }
})

export const SHOW_IN_FOLDER = Object.freeze({
  label: 'Show in folder',
  id: 'showInFolder',
  click (menuItem, browserWindow) {
    contextMenu.showInFolder(menuItem._tabId)
  }
})
