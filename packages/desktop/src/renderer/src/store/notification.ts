import { defineStore } from 'pinia'
import notice, { type NotifyOptions } from '../services/notification'
import { t } from '../i18n'

export const useNotificationStore = defineStore('notification', () => {
  function listenForNotification(): void {
    const DEFAULT_OPTS = {
      title: t('notifications.defaultTitle'),
      type: 'primary' as const,
      time: 10000,
      message: t('notifications.defaultMessage')
    }

    window.electron.ipcRenderer.on('mt::show-notification', (_e, opts) => {
      const options = Object.assign({ ...DEFAULT_OPTS }, opts as Partial<NotifyOptions>)
      notice.notify(options)
    })

    window.electron.ipcRenderer.on('mt::pandoc-not-exists', async(_e, opts) => {
      // Preserve custom notification titles and messages from main.
      const options: NotifyOptions = Object.assign({ ...DEFAULT_OPTS }, opts as Partial<NotifyOptions>, {
        showConfirm: true
      })
      // Dismissing the notice rejects; only the confirm button means "yes".
      const confirmed = await notice
        .notify(options)
        .then(() => true)
        .catch(() => false)
      if (confirmed) window.electron.shell.openExternal('http://pandoc.org')
    })
  }

  return { listenForNotification }
})
