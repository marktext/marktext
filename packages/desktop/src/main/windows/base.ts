import path from 'path'
import type { BrowserWindow } from 'electron'
import { TypedEmitter } from '@shared/types/typedEmitter'
import type Accessor from '../app/accessor'
import { getThemeBackgroundColor } from '../../common/theme'

/**
 * A MarkText window.
 * @property id Identifier (= browserWindow.id) or null during initialization.
 * @property browserWindow The browser window.
 * @property lifecycle The window lifecycle state.
 * @property type The window type.
 */

// Window type marktext support.
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

/**
 * Event payload map for `BaseWindow` and its subclasses (editor/setting).
 * Listeners are subscribed by `WindowManager` and other main-process code.
 */
export interface BaseWindowEvents {
  'window-ready': []
  'window-focus': []
  'window-blur': []
  'window-close': []
  'window-closed': []
}

// Subset of preference accessor used while building the renderer URL. Fields are
// optional to mirror `IUserPreferences` (the real `Preference.getAll()` return).
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

  /**
   * @param accessor The application accessor for application instances.
   */
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

  // --- private ---------------------------------

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

    const baseUrl =
      process.env.NODE_ENV === 'development'
        ? process.env['ELECTRON_RENDERER_URL']!
        : `file://${path.join(__dirname, '../renderer/index.html')}` // <-- This points to the path inside the packed ASAR archive, hence it is always correct

    const url = new URL(baseUrl)
    url.searchParams.set('udp', paths.userDataPath)
    url.searchParams.set('debug', debug ? '1' : '0')
    url.searchParams.set('wid', String(windowId))
    url.searchParams.set('type', type)

    // Settings
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
    // Paint the window with the active theme's background and show it directly,
    // for the fastest window-ready time. Previously only a handful of themes
    // were mapped and every other (dark) theme fell back to white, flashing
    // white on launch (#3957); the full per-theme map lives in common/theme.
    return getThemeBackgroundColor(theme)
  }
}

export default BaseWindow
