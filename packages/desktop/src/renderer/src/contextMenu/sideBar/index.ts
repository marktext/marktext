import {
  SEPARATOR,
  getNewFile,
  getNewDirectory,
  getCOPY,
  getCUT,
  getPASTE,
  getRENAME,
  getDELETE,
  getCopyPath,
  getShowInFolder
} from './menuItems'
import { t } from '../../i18n'
import { popupContextMenu, type ContextMenuItem } from '../popupMenu'

export const showContextMenu = (
  event: { clientX: number; clientY: number },
  hasPathCache: boolean
): void => {
  const contextItems: ContextMenuItem[] = [
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
    getCopyPath(),
    getShowInFolder()
  ]

  contextItems[5].enabled = hasPathCache

  const items: ContextMenuItem[] = contextItems.map((item) => {
    if (!item || item.type === 'separator') return item
    const click = item.click
    return {
      ...item,
      click: click ? () => click(null, null) : undefined
    }
  })

  popupContextMenu(items, { x: event.clientX, y: event.clientY })
}

export const showRootContextMenu = (
  event: { clientX: number; clientY: number },
  hasClipboard: boolean,
  ready: boolean,
  remove: () => void,
  retry: () => void
): void => {
  const paste = getPASTE()
  const items: ContextMenuItem[] = ready
    ? [getNewFile(), getNewDirectory(), { ...paste, enabled: hasClipboard }, SEPARATOR]
    : [{ label: t('sideBar.tree.retryFolder'), click: retry }, SEPARATOR]
  items.push(getCopyPath(), getShowInFolder(), SEPARATOR, { label: t('sideBar.tree.removeFolder'), click: remove })
  popupContextMenu(items.map(item => {
    if (!item || item.type === 'separator') return item
    const click = item.click
    return { ...item, click: click ? () => click(null, null) : undefined }
  }), { x: event.clientX, y: event.clientY })
}
