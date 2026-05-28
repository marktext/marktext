import * as contextMenu from './actions'
import { t } from '../../i18n'

// NOTE: This are mutable fields that may change at runtime.

export const SEPARATOR = {
  type: 'separator'
}

// Use function form to avoid calling the translation function during module load
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TabMenuItem = { _tabId: string; [key: string]: any }

export const getCloseThis = () => ({
  label: t('contextMenu.tabs.close'),
  id: 'closeThisTab',
  click(menuItem: TabMenuItem, _browserWindow?: unknown) {
    contextMenu.closeThis(menuItem._tabId)
  }
})

export const getCloseOthers = () => ({
  label: t('contextMenu.tabs.closeOthers'),
  id: 'closeOtherTabs',
  click(menuItem: TabMenuItem, _browserWindow?: unknown) {
    contextMenu.closeOthers(menuItem._tabId)
  }
})

export const getCloseSaved = () => ({
  label: t('contextMenu.tabs.closeSavedTabs'),
  id: 'closeSavedTabs',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  click(_menuItem: any, _browserWindow?: unknown) {
    contextMenu.closeSaved()
  },
  enabled: true
})

export const getCloseAll = () => ({
  label: t('contextMenu.tabs.closeAllTabs'),
  id: 'closeAllTabs',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  click(_menuItem: any, _browserWindow?: unknown) {
    contextMenu.closeAll()
  }
})

export const getRENAME = () => ({
  label: t('contextMenu.tabs.rename'),
  id: 'renameFile',
  click(menuItem: TabMenuItem, _browserWindow?: unknown) {
    contextMenu.rename(menuItem._tabId)
  }
})

export const getCopyPath = () => ({
  label: t('contextMenu.tabs.copyPath'),
  id: 'copyPath',
  click(menuItem: TabMenuItem, _browserWindow?: unknown) {
    contextMenu.copyPath(menuItem._tabId)
  }
})

export const getShowInFolder = () => ({
  label: t('contextMenu.tabs.showInFolder'),
  id: 'showInFolder',
  click(menuItem: TabMenuItem, _browserWindow?: unknown) {
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
