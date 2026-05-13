import * as contextMenu from './actions'
import { t } from '../../i18n'

// NOTE: This are mutable fields that may change at runtime.

export const SEPARATOR = {
  type: 'separator'
}

// Use function form to avoid calling the translation function during module load
export const getCloseThis = () => ({
  label: t('contextMenu.tabs.close'),
  id: 'closeThisTab',
  click(menuItem, browserWindow) {
    contextMenu.closeThis(menuItem._tabId)
  }
})

export const getCloseOthers = () => ({
  label: t('contextMenu.tabs.closeOthers'),
  id: 'closeOtherTabs',
  click(menuItem, browserWindow) {
    contextMenu.closeOthers(menuItem._tabId)
  }
})

export const getCloseSaved = () => ({
  label: t('contextMenu.tabs.closeSavedTabs'),
  id: 'closeSavedTabs',
  click(menuItem, browserWindow) {
    contextMenu.closeSaved()
  }
})

export const getCloseAll = () => ({
  label: t('contextMenu.tabs.closeAllTabs'),
  id: 'closeAllTabs',
  click(menuItem, browserWindow) {
    contextMenu.closeAll()
  }
})

export const getRENAME = () => ({
  label: t('contextMenu.tabs.rename'),
  id: 'renameFile',
  click(menuItem, browserWindow) {
    contextMenu.rename(menuItem._tabId)
  }
})

export const getCopyPath = () => ({
  label: t('contextMenu.tabs.copyPath'),
  id: 'copyPath',
  click(menuItem, browserWindow) {
    contextMenu.copyPath(menuItem._tabId)
  }
})

export const getShowInFolder = () => ({
  label: t('contextMenu.tabs.showInFolder'),
  id: 'showInFolder',
  click(menuItem, browserWindow) {
    contextMenu.showInFolder(menuItem._tabId)
  }
})

// Retained for backward compatibility
export const CLOSE_THIS = getCloseThis()
export const CLOSE_OTHERS = getCloseOthers()
export const CLOSE_SAVED = getCloseSaved()
export const CLOSE_ALL = getCloseAll()
export const RENAME = getRENAME()
export const COPY_PATH = getCopyPath()
export const SHOW_IN_FOLDER = getShowInFolder()
