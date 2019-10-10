import { remote } from 'electron'
import {
  CLOSE_THIS,
  CLOSE_OTHERS,
  CLOSE_SAVED,
  CLOSE_ALL,
  SEPARATOR,
  RENAME,
  COPY_PATH,
  SHOW_IN_FOLDER
} from './menuItems'

const { Menu, MenuItem } = remote

export const showContextMenu = (event, tab) => {
  const menu = new Menu()
  const win = remote.getCurrentWindow()
  const { pathname } = tab
  const CONTEXT_ITEMS = [CLOSE_THIS, CLOSE_OTHERS, CLOSE_SAVED, CLOSE_ALL, SEPARATOR, RENAME, COPY_PATH, SHOW_IN_FOLDER]
  const FILE_CONTEXT_ITEMS = [RENAME, COPY_PATH, SHOW_IN_FOLDER]

  FILE_CONTEXT_ITEMS.forEach(item => {
    item.enabled = !!pathname
  })

  CONTEXT_ITEMS.forEach(item => {
    const menuItem = new MenuItem(item)
    menuItem._tabId = tab.id
    menu.append(menuItem)
  })
  menu.popup({ window: win, x: event.clientX, y: event.clientY })
}
