import { useEditorStore } from '@/store/editor'
import bus from '../../bus'

export const closeThis = (tabId: string): void => {
  const store = useEditorStore()
  const tab = store.tabs.find(file => file.id === tabId)
  if (tab) store.CLOSE_TAB(tab)
}

export const closeOthers = (tabId: string): void => {
  const store = useEditorStore()
  const tab = store.tabs.find(file => file.id === tabId)
  if (tab) store.CLOSE_OTHER_TABS(tab)
}

export const closeSaved = (): void => {
  useEditorStore().CLOSE_SAVED_TABS()
}

export const closeAll = (): void => {
  useEditorStore().CLOSE_ALL_TABS()
}

export const rename = (tabId: string): void => {
  const store = useEditorStore()
  const tab = store.tabs.find(file => file.id === tabId)
  if (tab?.pathname) store.RENAME_FILE(tab)
}

export const copyPath = (tabId: string): void => {
  const tab = useEditorStore().tabs.find(file => file.id === tabId)
  if (tab?.pathname) window.electron.clipboard.writeText(tab.pathname)
}

export const showInFolder = (tabId: string): void => {
  const tab = useEditorStore().tabs.find(file => file.id === tabId)
  if (tab?.pathname) window.electron.shell.showItemInFolder(tab.pathname)
}

export const showInSideBar = (pathname?: string | null): void => {
  if (!pathname) return
  bus.emit('SIDEBAR::reveal-file', pathname)
}
