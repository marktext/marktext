import { defineStore } from 'pinia'
import notice from '../services/notification'
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options = Object.assign({ ...DEFAULT_OPTS }, opts as any)
      notice.notify(options)
    })

    window.electron.ipcRenderer.on('mt::pandoc-not-exists', async(_e, opts) => {
      // Preserve the custom title/message from main (e.g. dialog.importWarning
      // / dialog.installPandoc); previously the opts arg was dropped and the
      // user saw the generic defaultTitle/defaultMessage.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const options: any = Object.assign({ ...DEFAULT_OPTS }, opts, { showConfirm: true })
      await notice.notify(options)
      window.electron.shell.openExternal('http://pandoc.org')
    })
  }

  return { listenForNotification }
})
