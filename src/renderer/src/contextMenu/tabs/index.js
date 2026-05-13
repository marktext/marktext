import { getCurrentWindow, Menu as RemoteMenu, MenuItem as RemoteMenuItem } from '@electron/remote'
import {
  SEPARATOR,
  getCloseThis,
  getCloseOthers,
  getCloseSaved,
  getCloseAll,
  getRENAME,
  getCopyPath,
  getShowInFolder
} from './menuItems'

export const showContextMenu = (event, tab) => {
  const menu = new RemoteMenu()
  const win = getCurrentWindow()
  const { pathname } = tab
  // Dynamically fetch menu items to ensure correct translation
  const closeThis = getCloseThis()
  const closeOthers = getCloseOthers()
  const closeSaved = getCloseSaved()
  const closeAll = getCloseAll()
  const rename = getRENAME()
  const copyPath = getCopyPath()
  const showInFolder = getShowInFolder()

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
