import EventEmitter from 'events'
import { isLinux } from '../config'

/**
 * A Mark Text window.
 * @typedef {BaseWindow} IApplicationWindow
 * @property {number | null} id Identifier (= browserWindow.id) or null during initialization.
 * @property {Electron.BrowserWindow} browserWindow The browse window.
 * @property {WindowLifecycle} lifecycle The window lifecycle state.
 * @property {WindowType} type The window type.
 */

// Window type marktext support.
export const WindowType = {
  BASE: 'base', // You shold never create a `BASE` window.
  EDITOR: 'editor',
  SETTING: 'setting'
}

export const WindowLifecycle = {
  NONE: 0,
  LOADING: 1,
  READY: 2,
  QUITTED: 3
}

class BaseWindow extends EventEmitter {
  /**
   * @param {Accessor} accessor The application accessor for application instances.
   */
  constructor (accessor) {
    super()

    this._accessor = accessor
    this.id = null
    this.browserWindow = null
    this.lifecycle = WindowLifecycle.NONE
    this.type = WindowType.BASE
  }

  bringToFront () {
    const { browserWindow: win } = this
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    if (isLinux) {
      win.focus()
    } else {
      win.moveTop()
    }
  }

  reload () {
    this.browserWindow.reload()
  }

  destroy () {
    this.lifecycle = WindowLifecycle.QUITTED
    this.emit('window-closed')

    this.removeAllListeners()
    if (this.browserWindow) {
      this.browserWindow.destroy()
      this.browserWindow = null
    }
    this.id = null
  }

  // --- private ---------------------------------

  _buildUrlWithSettings (windowId, env, userPreference) {
    // NOTE: Only send absolutely necessary values. Full settings are delay loaded.
    const { type } = this
    const { debug, paths } = env
    const {
      codeFontFamily,
      codeFontSize,
      hideScrollbar,
      theme,
      titleBarStyle
    } = userPreference.getAll()

    const baseUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:9091'
      : `file://${__dirname}/index.html`

    const url = new URL(baseUrl)
    url.searchParams.set('udp', paths.userDataPath)
    url.searchParams.set('debug', debug ? '1' : '0')
    url.searchParams.set('wid', windowId)
    url.searchParams.set('type', type)

    // Settings
    url.searchParams.set('cff', codeFontFamily)
    url.searchParams.set('cfs', codeFontSize)
    url.searchParams.set('hsb', hideScrollbar ? '1' : '0')
    url.searchParams.set('theme', theme)
    url.searchParams.set('tbs', titleBarStyle)

    return url
  }

  _buildUrlString (windowId, env, userPreference) {
    return this._buildUrlWithSettings(windowId, env, userPreference).toString()
  }
}

export default BaseWindow
