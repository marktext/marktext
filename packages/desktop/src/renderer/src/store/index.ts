import { ref } from 'vue'
import { createPinia, defineStore } from 'pinia'

const pinia = createPinia()

export const useMainStore = defineStore('main', () => {
  const platform = ref<NodeJS.Platform>(window.electron.process.platform)
  const appVersion = ref<string>(window.electron.process.env.MARKTEXT_VERSION_STRING ?? '')
  const windowActive = ref(true)
  const init = ref(false)

  function SET_WIN_STATUS(status: boolean): void {
    windowActive.value = status
  }

  function SET_INITIALIZED(): void {
    init.value = true
  }

  function LISTEN_WIN_STATUS(): void {
    window.electron.ipcRenderer.on('mt::window-active-status', (_e, status) => {
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
