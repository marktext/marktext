import { defineStore } from 'pinia'
import bus from '../bus'
import { useEditorStore } from './editor'
import { useLayoutStore } from './layout'

export const useListenForMainStore = defineStore('listenForMain', () => {
  function EDITOR_EDIT_ACTION(type: string): void {
    if (
      useEditorStore().currentFile?.readOnly &&
      !['copy', 'copyAsRich', 'copyAsHtml', 'selectAll', 'findInFolder'].includes(type)
    )
      return
    const layoutStore = useLayoutStore()
    if (type === 'findInFolder') {
      layoutStore.SET_LAYOUT({
        rightColumn: 'search',
        showSideBar: true
      })
    }
    bus.emit(type, type)
  }

  function LISTEN_FOR_EDIT(): void {
    window.electron.ipcRenderer.on('mt::editor-edit-action', (_e, type) => {
      EDITOR_EDIT_ACTION(type as string)
    })
    bus.on('mt::editor-edit-action', (type: unknown) => {
      EDITOR_EDIT_ACTION(type as string)
    })
  }

  function LISTEN_FOR_SHOW_DIALOG(): void {
    window.electron.ipcRenderer.on('mt::about-dialog', () => {
      bus.emit('aboutDialog')
    })
    window.electron.ipcRenderer.on('mt::show-export-dialog', (_e, type) => {
      bus.emit('showExportDialog', type)
    })
  }

  /** Main asked for the document to convert; reply from the editor store. */
  function LISTEN_FOR_PANDOC_EXPORT(): void {
    window.electron.ipcRenderer.on('mt::export-with-pandoc', (_e, target) => {
      useEditorStore().EXPORT_PANDOC(target as string)
    })
  }

  function LISTEN_FOR_PARAGRAPH_INLINE_STYLE(): void {
    window.electron.ipcRenderer.on('mt::editor-paragraph-action', (_e, { type }) => {
      bus.emit('paragraph', type)
    })
    window.electron.ipcRenderer.on('mt::editor-format-action', (_e, { type }) => {
      bus.emit('format', type)
    })
  }

  return {
    EDITOR_EDIT_ACTION,
    LISTEN_FOR_EDIT,
    LISTEN_FOR_SHOW_DIALOG,
    LISTEN_FOR_PANDOC_EXPORT,
    LISTEN_FOR_PARAGRAPH_INLINE_STYLE
  }
})
