import {
  SEPARATOR,
  getCloseThis,
  getCloseOthers,
  getCloseSaved,
  getCloseAll,
  getRENAME,
  getCopyPath,
  getShowInFolder,
  getShowInSideBar
} from './menuItems'
import { useEditorStore } from '@/store/editor'
import { t } from '../../i18n'
import { popupContextMenu } from '../popupMenu'

type MenuItemShape = {
  type?: string
  click?: (...args: unknown[]) => void
  enabled?: boolean
  [key: string]: unknown
}

const wrapClick = (item: MenuItemShape, tabId: string, pathname?: string | null): MenuItemShape => {
  if (!item || item.type === 'separator') return item
  const click = item.click
  return {
    ...item,
    click: click ? () => click({ _tabId: tabId, _pathname: pathname }, null) : undefined
  }
}

interface ContextMenuClickEvent {
  clientX: number
  clientY: number
}

interface TabLike {
  readOnly?: boolean
  modeChanging?: boolean
  id: string
  pathname?: string | null
}

export const showContextMenu = (event: ContextMenuClickEvent, tab: TabLike): void => {
  const { pathname } = tab
  const closeThis = getCloseThis()
  const closeOthers = getCloseOthers()
  const closeSaved = getCloseSaved()
  const closeAll = getCloseAll()
  const rename = getRENAME()
  const copyPath = getCopyPath()
  const showInFolder = getShowInFolder()
  const showInSideBar = getShowInSideBar()

  ;([rename, copyPath, showInFolder, showInSideBar] as MenuItemShape[]).forEach((item) => {
    item.enabled = !!pathname
  })

  const items = [
    {
      label: t(tab.readOnly ? 'readingMode.unlock' : 'readingMode.lock'),
      enabled: !tab.modeChanging,
      click: () => {
        void useEditorStore().SET_READ_ONLY(tab.id, !tab.readOnly)
      }
    },
    SEPARATOR,
    closeThis,
    closeOthers,
    closeSaved,
    closeAll,
    SEPARATOR,
    rename,
    copyPath,
    showInFolder,
    showInSideBar
  ].map((item) => wrapClick(item as MenuItemShape, tab.id, pathname))

  popupContextMenu(items, { x: event.clientX, y: event.clientY })
}
