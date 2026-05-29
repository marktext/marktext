import { defineStore } from 'pinia'
import notice from '../services/notification'

export const useAutoUpdatesStore = defineStore('autoUpdates', () => {
  function LISTEN_FOR_UPDATE(): void {
    window.electron.ipcRenderer.on('mt::UPDATE_ERROR', (_e, message) => {
      notice.notify({
        title: 'Update',
        type: 'error',
        time: 10000,
        message: String(message ?? '')
      })
    })
    window.electron.ipcRenderer.on('mt::UPDATE_NOT_AVAILABLE', (_e, message) => {
      notice.notify({
        title: 'Update not Available',
        type: 'primary',
        message: String(message ?? '')
      })
    })
    window.electron.ipcRenderer.on('mt::UPDATE_DOWNLOADED', (_e, message) => {
      notice.notify({
        title: 'Update Downloaded',
        type: 'info',
        message: String(message ?? '')
      })
    })
    window.electron.ipcRenderer.on('mt::UPDATE_AVAILABLE', (_e, message) => {
      notice
        .notify({
          title: 'Update Available',
          type: 'primary',
          message: String(message ?? ''),
          showConfirm: true
        })
        .then(() => {
          const needUpdate = true
          window.electron.ipcRenderer.send('mt::NEED_UPDATE', { needUpdate })
        })
        .catch(() => {
          const needUpdate = false
          window.electron.ipcRenderer.send('mt::NEED_UPDATE', { needUpdate })
        })
    })
  }

  return { LISTEN_FOR_UPDATE }
})
