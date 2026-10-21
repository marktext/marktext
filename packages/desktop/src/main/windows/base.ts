import path from 'path'
import { app, type BrowserWindow } from 'electron'
import { TypedEmitter } from '@shared/types/typedEmitter'
import type Accessor from '../app/accessor'
import { getThemeBackgroundColor } from '../../common/theme'


export const WindowType = {
  BASE: 'base', // You shold never create a `BASE` window.
  EDITOR: 'editor',
  SETTINGS: 'settings'
} as const

export type WindowTypeValue = (typeof WindowType)[keyof typeof WindowType]

export const WindowLifecycle = {
  NONE: 0,
  LOADING: 1,
  READY: 2,
  QUITTED: 3
} as const

export type WindowLifecycleValue = (typeof WindowLifecycle)[keyof typeof WindowLifecycle]

export interface BaseWindowEvents {
  'window-ready': []
  'window-focus': []
  'window-blur': []
  'window-close': []
  'window-closed': []
}

export interface PreferenceLike {
  getAll(): {
    codeFontFamily?: string
    codeFontSize?: number
    hideScrollbar?: boolean
    theme?: string
    titleBarStyle?: string
    [key: string]: unknown
  }
}

export interface EnvLike {
  debug: boolean
  paths: { userDataPath: string }
}

class BaseWindow extends TypedEmitter<BaseWindowEvents> {
  protected _accessor: Accessor
  public id: number | null
  public browserWindow: BrowserWindow | null
  public lifecycle: WindowLifecycleValue
  public type: WindowTypeValue

  constructor(accessor: Accessor) {
    super()

    this._accessor = accessor
    this.id = null
    this.browserWindow = null
    this.lifecycle = WindowLifecycle.NONE
    this.type = WindowType.BASE
  }

  bringToFront(): void {
    const { browserWindow: win } = this
    if (!win) return
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    // Window focus alone does not activate a background app on macOS.
    if (process.platform === 'darwin') {
      app.show()
      app.focus({ steal: true })
    }
    win.focus()
    win.moveTop()
  }

  reload(): void {
    this.browserWindow?.reload()
  }

  destroy(): void {
    this.lifecycle = WindowLifecycle.QUITTED
    this.emit('window-closed')

    this.removeAllListeners()
    if (this.browserWindow) {
      this.browserWindow.destroy()
      this.browserWindow = null
    }
    this.id = null
  }


  protected _buildUrlWithSettings(
    windowId: number | null,
    env: EnvLike,
    userPreference: PreferenceLike
  ): URL {
    // NOTE: Only send absolutely necessary values. Full settings are delay loaded.
    const { type } = this
    const { debug, paths } = env
    const { codeFontFamily, codeFontSize, hideScrollbar, theme, titleBarStyle } =
      userPreference.getAll()

    // Decided at build time: a NODE_ENV inherited from the user's environment
    // must not point a built app at the dev server URL (#5053).
    const baseUrl = import.meta.env.DEV
      ? process.env['ELECTRON_RENDERER_URL']!
      : `file://${path.join(__dirname, '../renderer/index.html')}`

    const url = new URL(baseUrl)
    url.searchParams.set('udp', paths.userDataPath)
    url.searchParams.set('debug', debug ? '1' : '0')
    url.searchParams.set('wid', String(windowId))
    url.searchParams.set('type', type)

    url.searchParams.set('cff', codeFontFamily ?? '')
    url.searchParams.set('cfs', String(codeFontSize))
    url.searchParams.set('hsb', hideScrollbar ? '1' : '0')
    url.searchParams.set('theme', theme ?? '')
    url.searchParams.set('tbs', titleBarStyle ?? '')

    return url
  }

  protected _buildUrlString(
    windowId: number | null,
    env: EnvLike,
    userPreference: PreferenceLike,

    _category?: string | null
  ): string {
    return this._buildUrlWithSettings(windowId, env, userPreference).toString()
  }

  protected _getPreferredBackgroundColor(theme: string | undefined): string {
    // Paint using the active theme immediately to avoid a white startup flash.
    return getThemeBackgroundColor(theme)
  }
}

export default BaseWindow
