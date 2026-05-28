import { defineStore } from 'pinia'
import bus from '../bus'
import { useLayoutStore } from './layout'

export const useListenForMainStore = defineStore('listenForMain', () => {
  function EDITOR_EDIT_ACTION(type: string): void {
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
    // Pass `type` through as-is (no String() coercion) — matches develop's JS
    // behavior, including when callers send unexpected non-string values.
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

  function LISTEN_FOR_PARAGRAPH_INLINE_STYLE(): void {
    // Pre-migration JS destructured `{ type }` and re-emitted it without a
    // guard. Restore the same shape; bus listeners that expect a payload get
    // the same `type` value (string at runtime per main process emitters).
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
    LISTEN_FOR_PARAGRAPH_INLINE_STYLE
  }
})
