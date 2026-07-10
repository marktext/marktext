import { ref } from 'vue'
import { createPinia, defineStore } from 'pinia'

const pinia = createPinia()

// Main store for global states.
export const useMainStore = defineStore('main', () => {
  // Platform of system: 'darwin' | 'win32' | 'linux'
  const platform = ref<NodeJS.Platform>(window.electron.process.platform)
  const appVersion = ref<string>(window.electron.process.env.MARKTEXT_VERSION_STRING ?? '')
  // Whether current window is active or focused
  const windowActive = ref(true)
  // Whether MarkText is initialized
  const init = ref(false)

  function SET_WIN_STATUS(status: boolean): void {
    windowActive.value = status
  }

  function SET_INITIALIZED(): void {
    init.value = true
  }

  function LISTEN_WIN_STATUS(): void {
    window.electron.ipcRenderer.on('mt::window-active-status', (_e, status) => {
      // Main sends `{ status: boolean }` per IPC contract — narrow at the boundary.
      const flag = (status as unknown as { status?: boolean } | undefined)?.status
      windowActive.value = !!flag
    })
  }

  return {
    platform,
    appVersion,
    windowActive,
    init,
    SET_WIN_STATUS,
    SET_INITIALIZED,
    LISTEN_WIN_STATUS
  }
})

export default pinia
