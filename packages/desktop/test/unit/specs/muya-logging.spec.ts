import { afterEach, describe, expect, it, vi } from 'vitest'
import muyaLogger from '../../../../muya/src/utils/logger'
import log from 'electron-log/renderer'
import bootstrapRenderer from '@/bootstrap'

vi.mock('@muyajs/core', async() => ({
  logger: (await import('../../../../muya/src/utils/logger')).default
}))

vi.mock('electron-log/renderer', () => ({
  default: {
    transports: { console: { level: 'info' } },
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn()
  }
}))

afterEach(() => {
  muyaLogger.setSink()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  if (errorListener) window.removeEventListener('error', errorListener)
  if (rejectionListener) window.removeEventListener('unhandledrejection', rejectionListener)
  muyaLogger.level('log')
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

let errorListener: EventListenerOrEventListenerObject | undefined
let rejectionListener: EventListenerOrEventListenerObject | undefined

describe('Muya production logging', () => {
  it('forwards warnings and errors to electron-log while leaving document operation logs out', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const addEventListener = window.addEventListener.bind(window)
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'error') errorListener = listener
      if (type === 'unhandledrejection') rejectionListener = listener
      addEventListener(type, listener, options)
    })
    window.history.replaceState(null, '', '/?udp=/tmp/marktext-log-test&wid=1')
    const editorLog = muyaLogger('editor:')

    bootstrapRenderer()
    editorLog.warn('Unknown operation')
    editorLog.error('Rebuilding from state')
    editorLog.log('Document contents')
    muyaLogger.level('info')
    editorLog.info('Document contents')

    expect(log.transports.console.level).toBe(false)
    expect(log.warn).toHaveBeenCalledExactlyOnceWith('[muya]', 'editor:', 'Unknown operation')
    expect(log.error).toHaveBeenCalledExactlyOnceWith('[muya]', 'editor:', 'Rebuilding from state')
    expect(log.log).not.toHaveBeenCalled()
    expect(log.info).not.toHaveBeenCalled()
  })
})
