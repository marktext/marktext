import * as contextMenu from './actions'
import { t } from '../../i18n'

export const showContextMenu = async (event, hasPathCache) => {
  const menuTemplate = [
    { label: t('contextMenu.sideBar.newFile'), id: 'newFileMenuItem', type: 'normal' },
    { label: t('contextMenu.sideBar.newDirectory'), id: 'newDirectoryMenuItem', type: 'normal' },
    { type: 'separator', id: 'sep1' },
    { label: t('contextMenu.sideBar.copy'), id: 'copyMenuItem', type: 'normal' },
    { label: t('contextMenu.sideBar.cut'), id: 'cutMenuItem', type: 'normal' },
    { label: t('contextMenu.sideBar.paste'), id: 'pasteMenuItem', type: 'normal', enabled: hasPathCache },
    { type: 'separator', id: 'sep2' },
    { label: t('contextMenu.sideBar.rename'), id: 'renameMenuItem', type: 'normal' },
    { label: t('contextMenu.sideBar.moveToTrash'), id: 'deleteMenuItem', type: 'normal' },
    { type: 'separator', id: 'sep3' },
    { label: t('contextMenu.sideBar.showInFolder'), id: 'showInFolderMenuItem', type: 'normal' }
  ]

  const clickedId = await window.contextMenuAPI.show(menuTemplate)

  const actions = {
    newFileMenuItem: contextMenu.newFile,
    newDirectoryMenuItem: contextMenu.newDirectory,
    copyMenuItem: contextMenu.copy,
    cutMenuItem: contextMenu.cut,
    pasteMenuItem: contextMenu.paste,
    renameMenuItem: contextMenu.rename,
    deleteMenuItem: contextMenu.remove,
    showInFolderMenuItem: contextMenu.showInFolder
  }

  if (clickedId && actions[clickedId]) {
    actions[clickedId]()
  }
}
