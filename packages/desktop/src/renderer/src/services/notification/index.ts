import { h, type VNode } from 'vue'
import { ElNotification, type NotificationHandle } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { sanitize, EXPORT_DOMPURIFY_CONFIG } from '../../util/dompurify'
import { t } from '../../i18n'
import './index.css'

export type NotificationType = 'primary' | 'error' | 'warning' | 'info'

// Above every overlay in the app: notifications are the only channel for
// reporting some failures.
const BASE_Z_INDEX = 10100

const TYPE_CLASS: Record<NotificationType, string> = {
  primary: 'mt-primary',
  error: 'mt-error',
  warning: 'mt-warn',
  info: 'mt-info'
}

const createConfirmButton = (onClick: (event?: MouseEvent) => void): VNode =>
  h(
    'button',
    {
      type: 'button',
      class: 'plain-button confirm mt-notification__confirm',
      'aria-label': t('common.ok'),
      onClick
    },
    [h(Check)]
  )

export interface NotifyOptions {
  time?: number
  title?: string
  message?: string
  type?: NotificationType
  showConfirm?: boolean
}

interface NotificationService {
  name: string
  clear(): void
  notify(opts: NotifyOptions): Promise<void>
}

const notification: NotificationService = {
  name: 'notify',
  clear() {
    ElNotification.closeAll()
  },
  notify({
    time = 10000,
    title = '',
    message = '',
    type = 'primary',
    showConfirm = false
  }: NotifyOptions): Promise<void> {
    const notificationType = TYPE_CLASS[type] ? type : 'primary'
    let handle: NotificationHandle | null = null
    let settled = false
    let resolveNotice: (() => void) | undefined
    let rejectNotice: ((reason?: unknown) => void) | undefined

    const promise = new Promise<void>((resolve, reject) => {
      resolveNotice = resolve
      rejectNotice = reject
    })

    const settle = (confirmed: boolean): void => {
      if (settled) return
      settled = true
      if (confirmed) {
        resolveNotice?.()
      } else {
        rejectNotice?.(new Error('Notification dismissed'))
      }
    }

    const confirm = (event?: MouseEvent): void => {
      event?.preventDefault()
      event?.stopPropagation()
      settle(true)
      handle?.close()
    }

    const text = h('div', {
      class: 'mt-notification__text',
      innerHTML: sanitize(message, EXPORT_DOMPURIFY_CONFIG)
    })
    const confirmButton = showConfirm ? createConfirmButton(confirm) : null
    const body = h('div', { class: 'mt-notification__body' }, [text, confirmButton])

    handle = ElNotification({
      title,
      message: () => body,
      type: notificationType,
      duration: typeof time === 'number' && time > 0 ? time : 0,
      position: 'bottom-right',
      showClose: true,
      pauseOnHover: true,
      zIndex: BASE_Z_INDEX,
      customClass: [
        'mt-notification',
        TYPE_CLASS[notificationType],
        showConfirm ? 'mt-confirm' : ''
      ],
      onClick: () => confirm(),
      // A confirmed notice resolves before its leave transition starts. Every
      // other exit settles the Promise according to whether a decision was made.
      onClose: () => settle(!showConfirm)
    })

    return promise
  }
}

export default notification
