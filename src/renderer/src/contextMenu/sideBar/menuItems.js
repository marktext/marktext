import * as contextMenu from './actions'
import { t } from '../../i18n'

// NOTE: This are mutable fields that may change at runtime.

export const SEPARATOR = {
  type: 'separator'
}

// Use function form to avoid calling the translation function during module load
export const getNewFile = () => ({
  label: t('contextMenu.sideBar.newFile'),
  id: 'newFileMenuItem',
  click(menuItem, browserWindow) {
    contextMenu.newFile()
  }
})

export const getNewDirectory = () => ({
  label: t('contextMenu.sideBar.newDirectory'),
  id: 'newDirectoryMenuItem',
  click(menuItem, browserWindow) {
    contextMenu.newDirectory()
  }
})

export const getCOPY = () => ({
  label: t('contextMenu.sideBar.copy'),
  id: 'copyMenuItem',
  click(menuItem, browserWindow) {
    contextMenu.copy()
  }
})

export const getCUT = () => ({
  label: t('contextMenu.sideBar.cut'),
  id: 'cutMenuItem',
  click(menuItem, browserWindow) {
    contextMenu.cut()
  }
})

export const getPASTE = () => ({
  label: t('contextMenu.sideBar.paste'),
  id: 'pasteMenuItem',
  click(menuItem, browserWindow) {
    contextMenu.paste()
  }
})

export const getRENAME = () => ({
  label: t('contextMenu.sideBar.rename'),
  id: 'renameMenuItem',
  click(menuItem, browserWindow) {
    contextMenu.rename()
  }
})

export const getDELETE = () => ({
  label: t('contextMenu.sideBar.moveToTrash'),
  id: 'deleteMenuItem',
  click(menuItem, browserWindow) {
    contextMenu.remove()
  }
})

export const getShowInFolder = () => ({
  label: t('contextMenu.sideBar.showInFolder'),
  id: 'showInFolderMenuItem',
  click(menuItem, browserWindow) {
    contextMenu.showInFolder()
  }
})

// Retained for backward compatibility
export const NEW_FILE = getNewFile()
export const NEW_DIRECTORY = getNewDirectory()
export const COPY = getCOPY()
export const CUT = getCUT()
export const PASTE = getPASTE()
export const RENAME = getRENAME()
export const DELETE = getDELETE()
export const SHOW_IN_FOLDER = getShowInFolder()
