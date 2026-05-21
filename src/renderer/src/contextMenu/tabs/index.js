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
import { popupContextMenu } from '../popupMenu'

const wrapClick = (item, tabId) => {
  if (!item || item.type === 'separator') return item
  const click = item.click
  return {
    ...item,
    click: click ? () => click({ _tabId: tabId }, null) : undefined
  }
}

export const showContextMenu = (event, tab) => {
  const { pathname } = tab
  const closeThis = getCloseThis()
  const closeOthers = getCloseOthers()
  const closeSaved = getCloseSaved()
  const closeAll = getCloseAll()
  const rename = getRENAME()
  const copyPath = getCopyPath()
  const showInFolder = getShowInFolder()

  ;[rename, copyPath, showInFolder].forEach((item) => {
    item.enabled = !!pathname
  })

  const items = [closeThis, closeOthers, closeSaved, closeAll, SEPARATOR, rename, copyPath, showInFolder]
    .map((item) => wrapClick(item, tab.id))

  popupContextMenu(items, { x: event.clientX, y: event.clientY })
}
