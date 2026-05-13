import { getCurrentWindow, Menu as RemoteMenu, MenuItem as RemoteMenuItem } from '@electron/remote'
import {
  SEPARATOR,
  getCLOSE_THIS,
  getCLOSE_OTHERS,
  getCLOSE_SAVED,
  getCLOSE_ALL,
  getRENAME,
  getCOPY_PATH,
  getSHOW_IN_FOLDER
} from './menuItems'

export const showContextMenu = (event, tab) => {
  const menu = new RemoteMenu()
  const win = getCurrentWindow()
  const { pathname } = tab
  // Dynamically fetch menu items to ensure correct translation
  const closeThis = getCLOSE_THIS()
  const closeOthers = getCLOSE_OTHERS()
  const closeSaved = getCLOSE_SAVED()
  const closeAll = getCLOSE_ALL()
  const rename = getRENAME()
  const copyPath = getCOPY_PATH()
  const showInFolder = getSHOW_IN_FOLDER()

  const CONTEXT_ITEMS = [closeThis, closeOthers, closeSaved, closeAll, SEPARATOR, rename, copyPath, showInFolder]
  const FILE_CONTEXT_ITEMS = [rename, copyPath, showInFolder]

  FILE_CONTEXT_ITEMS.forEach(item => {
    item.enabled = !!pathname
  })

  CONTEXT_ITEMS.forEach(item => {
    const menuItem = new RemoteMenuItem(item)
    menuItem._tabId = tab.id
    menu.append(menuItem)
  })
  menu.popup([{ window: win, x: event.clientX, y: event.clientY }])
}
