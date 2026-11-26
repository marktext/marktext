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

export const showContextMenu = async(event: ContextMenuClickEvent, tab: TabLike): Promise<void> => {
  const ipc = window.electron.ipcRenderer
  const targets = await ipc.invoke('mt::tabs::transfer-targets')
  const transferItems = [
    {
      id: 'moveTabToNewWindow',
      label: t('contextMenu.tabs.moveToNewWindow'),
      click: () => { void ipc.invoke('mt::tabs::move', tab.id, null).catch(console.error) }
    },
    {
      id: 'moveTabToWindow',
      label: t('contextMenu.tabs.moveToWindow'),
      enabled: targets.length > 0,
      submenu: targets.length ? targets.map(target => ({
        id: `moveTabToWindow-${target.id}`,
        label: target.title,
        click: () => { void ipc.invoke('mt::tabs::move', tab.id, target.id).catch(console.error) }
      })) : undefined
    }
  ]
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
    ...transferItems,
    SEPARATOR,
    rename,
    copyPath,
    showInFolder,
    showInSideBar
  ].map((item) => wrapClick(item as MenuItemShape, tab.id, pathname))

  popupContextMenu(items, { x: event.clientX, y: event.clientY })
}
