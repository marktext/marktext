import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VNode } from 'vue'

const { closeAllMock, notifyMock } = vi.hoisted(() => ({
  closeAllMock: vi.fn(),
  notifyMock: vi.fn()
}))

vi.mock('element-plus', () => ({
  ElNotification: Object.assign(notifyMock, { closeAll: closeAllMock })
}))

import notice from '@/services/notification'

interface CapturedOptions {
  title?: string
  message: () => VNode
  type?: string
  duration?: number
  position?: string
  zIndex?: number
  customClass: string[]
  onClick: () => void
  onClose: () => void
}

const lastOptions = (): CapturedOptions => notifyMock.mock.calls.at(-1)?.[0] as CapturedOptions

const messageBody = (): VNode & { children: VNode[] } =>
  lastOptions().message() as VNode & { children: VNode[] }

describe('notification service', () => {
  let closeMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    closeMock = vi.fn()
    notifyMock.mockReset()
    notifyMock.mockReturnValue({ close: closeMock })
    closeAllMock.mockReset()
  })

  it('maps the app options onto an Element Plus notification', () => {
    notice.notify({
      title: 'Export warning',
      message: 'first<br>second',
      type: 'warning',
      time: 2000,
      showConfirm: true
    })

    const options = lastOptions()
    expect(options).toMatchObject({
      title: 'Export warning',
      type: 'warning',
      duration: 2000,
      position: 'bottom-right',
      zIndex: 10100
    })
    expect(options.customClass).toEqual(['mt-notification', 'mt-warn', 'mt-confirm'])
    expect(messageBody().children[0].props?.innerHTML).toBe('first<br>second')
  })

  it('resolves when the confirm button is pressed', async() => {
    const promise = notice.notify({ message: 'Copy the URL?', showConfirm: true })
    const confirm = messageBody().children[1]

    ;(confirm.props?.onClick as () => void)()

    await expect(promise).resolves.toBeUndefined()
    expect(closeMock).toHaveBeenCalledTimes(1)
  })

  it('rejects when a confirm notice is dismissed', async() => {
    const promise = notice.notify({ message: 'Copy the URL?', showConfirm: true })

    lastOptions().onClose()

    await expect(promise).rejects.toThrow('Notification dismissed')
  })

  it('resolves ordinary notices when they close', async() => {
    const promise = notice.notify({ message: 'Copied' })

    lastOptions().onClose()

    await expect(promise).resolves.toBeUndefined()
  })

  it('closes every Element Plus notification when cleared', () => {
    notice.clear()

    expect(closeAllMock).toHaveBeenCalledTimes(1)
  })
})
