import path from 'path'
import { BrowserWindow, ipcMain } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'
import { electronLocalshortcut } from 'common/localShortcut'
import BaseWindow, { WindowLifecycle, WindowType, type EnvLike, type PreferenceLike } from './base'
import type Accessor from '../app/accessor'
import { centerWindowOptions } from './utils'
import { TITLE_BAR_HEIGHT, preferencesWinOptions, isLinux, isOsx } from '../config'
import log from 'electron-log'

class SettingWindow extends BaseWindow {
  constructor(accessor: Accessor) {
    super(accessor)
    this.type = WindowType.SETTINGS
  }

  createWindow(category: string | null = null): BrowserWindow {
    const { menu: appMenu, env, keybindings, preferences } = this._accessor
    const winOptions: BrowserWindowConstructorOptions = Object.assign({}, preferencesWinOptions)
    centerWindowOptions(
      winOptions as BrowserWindowConstructorOptions & {
        width: number
        height: number
        x?: number
        y?: number
      }
    )
    if (isLinux) {
      winOptions.icon = path.join(
        (global as unknown as { __static: string }).__static,
        'logo-96px.png'
      )
    }

    // WORKAROUND: Electron has issues with different DPI per monitor when
    // setting a fixed window size.
    winOptions.resizable = true

    const { titleBarStyle, theme } = preferences.getAll()
    if (!isOsx) {
      winOptions.titleBarStyle = 'default'
      if (titleBarStyle === 'native') {
        winOptions.frame = true
      }
    }

    winOptions.backgroundColor = this._getPreferredBackgroundColor(theme)
    let win: BrowserWindow | null = (this.browserWindow = new BrowserWindow(winOptions))

    win.webContents.on('did-fail-load', (_event, code, desc, url) => {
      log.error(`did-fail-load ${code} ${desc} @ ${url}`)
    })
    win.webContents.on('render-process-gone', (_event, details) => {
      log.error(`render-process-gone: ${details.reason} (${details.exitCode})`)
    })

    this.id = win.id

    appMenu.addSettingMenu(win)

    win.once('ready-to-show', () => {
      this.lifecycle = WindowLifecycle.READY
      this.emit('window-ready')
    })

    win.on('focus', () => {
      this.emit('window-focus')
      win!.webContents.send('mt::window-active-status', { status: true })
    })

    win.on('blur', () => {
      this.emit('window-blur')
      win!.webContents.send('mt::window-active-status', { status: false })
    })

    win.on('close', (event) => {
      this.emit('window-close')

      event.preventDefault()
      ipcMain.emit('window-close-by-id', win!.id)
    })

    win.on('closed', () => {
      this.emit('window-closed')

      win = null
    })

    this.lifecycle = WindowLifecycle.LOADING
    win.loadURL(this._buildUrlString(this.id, env, preferences, category))
    win.setSheetOffset(TITLE_BAR_HEIGHT)

    const devToolsAccelerator = keybindings.getAccelerator('view.toggle-dev-tools')
    if (env.debug && devToolsAccelerator) {
      electronLocalshortcut.register(win, devToolsAccelerator, () => {
        win!.webContents.toggleDevTools()
      })
    }
    return win
  }

  protected override _buildUrlString(
    windowId: number | null,
    env: EnvLike,
    userPreference: PreferenceLike,
    category?: string | null
  ): string {
    const url = this._buildUrlWithSettings(windowId, env, userPreference)
    if (category) {
      url.searchParams.set('type', `${WindowType.SETTINGS}/${category}`)
    }
    return url.toString()
  }
}

export default SettingWindow
