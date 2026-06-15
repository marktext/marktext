import debounce from 'lodash/debounce'
import { useEditorStore } from './editor'
import { useProjectStore } from './project'
import { useLayoutStore } from './layout'

const BUFFERED_STATE_DEBOUNCE_MS = 1000
const BUFFERED_STATE_VERSION = 1

interface StoreCache {
  editorStore: ReturnType<typeof useEditorStore> | null
  projectStore: ReturnType<typeof useProjectStore> | null
  layoutStore: ReturnType<typeof useLayoutStore> | null
}

const stores: StoreCache = {
  editorStore: null,
  projectStore: null,
  layoutStore: null
}

export const createBufferedState = (): Record<string, unknown> | null => {
  if (!stores.editorStore) {
    stores.editorStore = useEditorStore()
  }
  if (!stores.projectStore) {
    stores.projectStore = useProjectStore()
  }
  if (!stores.layoutStore) {
    stores.layoutStore = useLayoutStore()
  }

  const editorState = stores.editorStore.CREATE_BUFFERED_STATE()
  if (!editorState) return null

  return {
    version: BUFFERED_STATE_VERSION,
    ...editorState,
    project: stores.projectStore?.CREATE_BUFFERED_STATE?.() || null,
    layout: stores.layoutStore?.CREATE_BUFFERED_STATE?.() || null
  }
}

export const sendBufferedState = (): Promise<unknown> => {
  const snapshot = createBufferedState()
  if (snapshot) {
    return window.electron.ipcRenderer.invoke('update-buffer-state', snapshot)
  }

  return Promise.resolve(false)
}

export const debouncedSendBufferedState = debounce(() => {
  sendBufferedState().catch((err) => {
    console.error('Failed to update buffered state', err)
  })
}, BUFFERED_STATE_DEBOUNCE_MS)
