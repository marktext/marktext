import * as contextMenu from './actions'
import { t } from '../../i18n'

export const showContextMenu = async (event, tab) => {
  const { pathname } = tab
  const hasPathname = !!pathname

  const menuTemplate = [
    { label: t('contextMenu.tabs.close'), id: 'closeThisTab', type: 'normal' },
    { label: t('contextMenu.tabs.closeOthers'), id: 'closeOtherTabs', type: 'normal' },
    { label: t('contextMenu.tabs.closeSavedTabs'), id: 'closeSavedTabs', type: 'normal' },
    { label: t('contextMenu.tabs.closeAllTabs'), id: 'closeAllTabs', type: 'normal' },
    { type: 'separator', id: 'sep1' },
    { label: t('contextMenu.tabs.rename'), id: 'renameFile', type: 'normal', enabled: hasPathname },
    { label: t('contextMenu.tabs.copyPath'), id: 'copyPath', type: 'normal', enabled: hasPathname },
    { label: t('contextMenu.tabs.showInFolder'), id: 'showInFolder', type: 'normal', enabled: hasPathname }
  ]

  const clickedId = await window.contextMenuAPI.show(menuTemplate)

  const actions = {
    closeThisTab: () => contextMenu.closeThis(tab.id),
    closeOtherTabs: () => contextMenu.closeOthers(tab.id),
    closeSavedTabs: () => contextMenu.closeSaved(),
    closeAllTabs: () => contextMenu.closeAll(),
    renameFile: () => contextMenu.rename(tab.id),
    copyPath: () => contextMenu.copyPath(tab.id),
    showInFolder: () => contextMenu.showInFolder(tab.id)
  }

  if (clickedId && actions[clickedId]) {
    actions[clickedId]()
  }
}
