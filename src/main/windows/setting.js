import path from 'path'
import BaseWindow from './base'
import { BrowserWindow, ipcMain } from 'electron'
import { WindowType } from '../app/windowManager'
import { TITLE_BAR_HEIGHT, defaultPreferenceWinOptions, isLinux, isOsx } from '../config'


class SettingWindow extends BaseWindow {

  /**
   * @param {Accessor} accessor The application accessor for application instances.
   */
  constructor (accessor) {
    super(accessor)
    this.type = WindowType.SETTING
  }

  /**
   * Creates a new setting window.
   *
   * @param {*} [options] BrowserWindow options.
   */
  createWindow (options = {}) {
    const { menu: appMenu, env, preferences } = this._accessor
    const winOptions = Object.assign({}, defaultPreferenceWinOptions, options)
    if (isLinux) {
      winOptions.icon = path.join(__static, 'logo-96px.png')
    }

    // Enable native or custom/frameless window and titlebar
    const { titleBarStyle } = preferences.getAll()
    if (!isOsx) {
      winOptions.titleBarStyle = 'default'
      if (titleBarStyle === 'native') {
        winOptions.frame = true
      }
    }

    let win = this.browserWindow = new BrowserWindow(winOptions)
    this.id = win.id

    // Create a menu for the current window
    appMenu.addSettingMenu(win)

    win.once('ready-to-show', async () => {
      win.show()

      this.emit('window-ready-to-show')
    })

    win.on('focus', () => {
      this.emit('window-focus')
      win.webContents.send('AGANI::window-active-status', { status: true })
    })

    // Lost focus
    win.on('blur', () => {
      this.emit('window-blur')
      win.webContents.send('AGANI::window-active-status', { status: false })
    })

    win.on('close', event => {
      this.emit('window-close')

      event.preventDefault()
      ipcMain.emit('window-close-by-id', win.id)
    })

    // The window is now destroyed.
    win.on('closed', () => {
      this.emit('window-closed')

      // Free window reference
      win = null
    })

    win.loadURL(this._buildUrlWithSettings(this.id, env, preferences))
    win.setSheetOffset(TITLE_BAR_HEIGHT)

    return win
  }
}

export default SettingWindow
