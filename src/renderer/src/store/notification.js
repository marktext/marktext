import { defineStore } from 'pinia'
import notice from '../services/notification'
import { t } from '../i18n'

export const useNotificationStore = defineStore('notification', {
  state: () => ({}),
  actions: {
    listenForNotification() {
      const DEFAULT_OPTS = {
        title: t('notifications.defaultTitle'),
        type: 'primary',
        time: 10000,
        message: t('notifications.defaultMessage')
      }

      window.electron.ipcRenderer.on('mt::show-notification', (e, opts) => {
        const options = Object.assign(DEFAULT_OPTS, opts)

        notice.notify(options)
      })

      window.electron.ipcRenderer.on('mt::pandoc-not-exists', async(e, opts) => {
        const options = Object.assign(DEFAULT_OPTS, opts)
        options.showConfirm = true
        await notice.notify(options)
        window.electron.shell.openExternal('http://pandoc.org')
      })
    }
  }
})
