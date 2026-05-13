import { getCurrentWindow, Menu as RemoteMenu, MenuItem as RemoteMenuItem } from '@electron/remote'
import {
  SEPARATOR,
  getNewFile,
  getNewDirectory,
  getCOPY,
  getCUT,
  getPASTE,
  getRENAME,
  getDELETE,
  getShowInFolder
} from './menuItems'

export const showContextMenu = (event, hasPathCache) => {
  const menu = new RemoteMenu()
  const win = getCurrentWindow()
  // Dynamically fetch menu items to ensure correct translation
  const contextItems = [
    getNewFile(),
    getNewDirectory(),
    SEPARATOR,
    getCOPY(),
    getCUT(),
    getPASTE(),
    SEPARATOR,
    getRENAME(),
    getDELETE(),
    SEPARATOR,
    getShowInFolder()
  ]

  contextItems[5].enabled = hasPathCache // PASTE item

  contextItems.forEach(item => {
    menu.append(new RemoteMenuItem(item))
  })
  menu.popup([{ window: win, x: event.clientX, y: event.clientY }])
}
