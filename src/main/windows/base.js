import EventEmitter from 'events'
import { WindowType } from '../app/windowManager'

class BaseWindow extends EventEmitter {

  /**
   * @param {Accessor} accessor The application accessor for application instances.
   */
  constructor (accessor) {
    super()

    this._accessor = accessor
    this.type = WindowType.BASE
    this.id = null
    this.browserWindow = null
    this.quitting = false
  }

  destroy () {
    this.quitting = true
    this.emit('bye')

    this.removeAllListeners()
    this.browserWindow.destroy()
    this.browserWindow = null
    this.id = null
  }

  // --- private ---------------------------------
  _buildUrlWithSettings (windowId, env, userPreference) {
    // NOTE: Only send absolutely necessary values. Theme and titlebar settings
    //  are sended because we delay load the preferences.
    const { type } = this
    const { debug, paths } = env
    const { codeFontFamily, codeFontSize, theme, titleBarStyle } = userPreference.getAll()

    const baseUrl = process.env.NODE_ENV === 'development'
      ? `http://localhost:9091`
      : `file://${__dirname}/index.html`

    const url = new URL(baseUrl)
    url.searchParams.set('udp', paths.userDataPath)
    url.searchParams.set('debug', debug ? '1' : '0')
    url.searchParams.set('wid', windowId)
    url.searchParams.set('type', type)

    // Settings
    url.searchParams.set('cff', codeFontFamily)
    url.searchParams.set('cfs', codeFontSize)
    url.searchParams.set('theme', theme)
    url.searchParams.set('tbs', titleBarStyle)

    return url.toString()
  }
}

export default BaseWindow
