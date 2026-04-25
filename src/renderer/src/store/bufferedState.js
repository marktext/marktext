import debounce from 'lodash/debounce'

const BUFFERED_STATE_DEBOUNCE_MS = 1000
const BUFFERED_STATE_VERSION = 1

let bufferedStateStores = null

const setBufferedStateStores = (stores) => {
  bufferedStateStores = {
    ...bufferedStateStores,
    ...stores
  }
}

export const createBufferedState = () => {
  if (!bufferedStateStores?.editorStore) return null

  const { editorStore, projectStore, layoutStore } = bufferedStateStores
  const editorState = editorStore.CREATE_BUFFERED_STATE()
  if (!editorState) return null

  return {
    version: BUFFERED_STATE_VERSION,
    ...editorState,
    project: projectStore?.CREATE_BUFFERED_STATE?.() || null,
    layout: layoutStore?.CREATE_BUFFERED_STATE?.() || null
  }
}

const sendBufferedState = () => {
  const snapshot = createBufferedState()
  if (snapshot) {
    window.electron.ipcRenderer.send('update-buffer-state', snapshot)
  }
}

const debouncedSendBufferedState = debounce(sendBufferedState, BUFFERED_STATE_DEBOUNCE_MS)

export const scheduleBufferedStateUpdate = () => {
  debouncedSendBufferedState()
}

export const updateBufferedState = (stores) => {
  if (stores) {
    setBufferedStateStores(stores)
  }

  debouncedSendBufferedState.cancel()
  sendBufferedState()
}

export const registerBufferedStateStores = ({ editorStore, projectStore, layoutStore }) => {
  setBufferedStateStores({ editorStore, projectStore, layoutStore })
}
