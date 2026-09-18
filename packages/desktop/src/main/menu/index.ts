import fs from 'fs'
import path from 'path'
import { app, Menu, ipcMain, type BrowserWindow } from 'electron'
import log from 'electron-log'
import { ensureDirSync, isDirectory2, isFile2 } from 'common/filesystem'
import { isLinux, isOsx, isWindows } from '../config'
import { updateSidebarMenu } from '../menu/actions/edit'
import { updateFormatMenu } from '../menu/actions/format'
import { updateSelectionMenus, type SelectionState } from '../menu/actions/paragraph'
import { onInternalChannel } from '../utils/internalIpc'
import { isPandocAvailable, refreshPandocAvailability } from '../app/pandocAvailability'
import { viewLayoutChanged } from '../menu/actions/view'
import configureMenu, { configSettingMenu } from '../menu/templates'
import { setLanguage } from '../i18n.js'
import type Preference from '../preferences'
import type Keybindings from '../keyboard/shortcutHandler'
import type { IUserPreferences } from '@shared/types/preferences'

const RECENTLY_USED_DOCUMENTS_FILE_NAME = 'recently-used-documents.json'
const MAX_RECENTLY_USED_DOCUMENTS = 12

export const MenuType = {
  DEFAULT: 0,
  EDITOR: 1,
  SETTINGS: 2
} as const

export type MenuTypeValue = (typeof MenuType)[keyof typeof MenuType]

interface WindowMenuEntry {
  menu: Menu | null
  type: MenuTypeValue
}

interface AddEditorMenuOptions {
  sourceCodeModeEnabled?: boolean
}

interface ThemeMenuChange {
  theme?: string
  followSystemTheme?: boolean
}

/**
 * Menu state the renderer set for a window, remembered so it can be replayed.
 *
 * `updateAppMenu` and `updateKeybindings` rebuild each editor menu from the
 * template and only carry five entries over (`updateMenuItem` below). Every
 * other runtime value lives on the menu object that is thrown away, so it is
 * lost with it: the Paragraph/Format greying of source-code mode (#3531), the
 * line-ending radio, "always on top", the Format check marks, and whether the
 * window has a document at all. A preference change that rebuilds the menus
 * would then silently re-enable commands that do not apply — measured with a
 * document in source-code mode, where the Paragraph submenu came back enabled
 * although it acts on the hidden WYSIWYG engine.
 *
 * The gap predates this, but writing a preference is easy now that the pandoc
 * page sends one `mt::set-user-preference` per checkbox click, so it is worth
 * closing rather than leaving every tick to reset the menus.
 */
interface WindowMenuState {
  /** `mt::update-pandoc-menu`: whether this window has a document open. */
  hasDocument?: boolean
  /** `mt::set-editor-format-menus-enabled`: false in source-code mode. */
  formatMenusEnabled?: boolean
  /** `mt::update-line-ending-menu`: the tab's line ending. */
  lineEnding?: string
  /** `mt::update-always-on-top-menu`. */
  alwaysOnTop?: boolean
  /** `mt::update-format-menu`: the Format check marks. */
  formats?: Record<string, boolean>
}

class AppMenu {
  private readonly _preferences: Preference
  private readonly _keybindings: Keybindings
  private readonly _userDataPath: string
  public readonly RECENTS_PATH: string
  public readonly isOsxOrWindows: boolean
  public activeWindowId: number
  public windowMenus: Map<number, WindowMenuEntry>
  /**
   * What the renderer has reported about each window, keyed by window id; see
   * `WindowMenuState`. A window that never reports keeps the pandoc export
   * submenu enabled rather than greyed out forever.
   */
  private readonly _windowMenuState: Map<number, WindowMenuState>

  /**
   * @param preferences The preferences instances.
   * @param keybindings The keybindings instances.
   * @param userDataPath The user data path.
   */
  constructor(
    preferences: Preference,
    keybindings: Keybindings,
    userDataPath: string
  ) {
    this._preferences = preferences
    this._keybindings = keybindings
    this._userDataPath = userDataPath

    this.RECENTS_PATH = path.join(userDataPath, RECENTLY_USED_DOCUMENTS_FILE_NAME)
    this.isOsxOrWindows = isOsx || isWindows
    this.activeWindowId = -1
    this.windowMenus = new Map()
    this._windowMenuState = new Map()

    // Initialize main process language from preferences
    this._initializeLanguage()

    this._listenForIpcMain()
  }

  /**
   * Add the file or directory path to the recently used documents.
   *
   * @param filePath The file or directory full path.
   */
  addRecentlyUsedDocument(filePath: string): void {
    const { isOsxOrWindows, RECENTS_PATH } = this

    if (isOsxOrWindows) app.addRecentDocument(filePath)
    if (isOsx) return

    const recentDocuments = this.getRecentlyUsedDocuments()
    const index = recentDocuments.indexOf(filePath)
    let needSave = index !== 0
    if (index > 0) {
      recentDocuments.splice(index, 1)
    }
    if (index !== 0) {
      recentDocuments.unshift(filePath)
    }

    if (recentDocuments.length > MAX_RECENTLY_USED_DOCUMENTS) {
      needSave = true
      recentDocuments.splice(
        MAX_RECENTLY_USED_DOCUMENTS,
        recentDocuments.length - MAX_RECENTLY_USED_DOCUMENTS
      )
    }

    this.updateAppMenu(recentDocuments)

    if (needSave) {
      ensureDirSync(this._userDataPath)
      const json = JSON.stringify(recentDocuments, null, 2)
      fs.writeFileSync(RECENTS_PATH, json, 'utf-8')
    }
  }

  /**
   * Returns a list of all recently used documents and folders.
   */
  getRecentlyUsedDocuments(): string[] {
    const { RECENTS_PATH } = this
    if (!isFile2(RECENTS_PATH)) {
      return []
    }

    try {
      const recentDocuments: string[] = JSON.parse(fs.readFileSync(RECENTS_PATH, 'utf-8')).filter(
        (f: string) => f && (isFile2(f) || isDirectory2(f))
      )

      if (recentDocuments.length > MAX_RECENTLY_USED_DOCUMENTS) {
        recentDocuments.splice(
          MAX_RECENTLY_USED_DOCUMENTS,
          recentDocuments.length - MAX_RECENTLY_USED_DOCUMENTS
        )
      }
      return recentDocuments
    } catch (err) {
      log.error('Error while read recently used documents:', err)
      return []
    }
  }

  /**
   * Clear recently used documents.
   */
  clearRecentlyUsedDocuments(): void {
    const { isOsxOrWindows, RECENTS_PATH } = this
    if (isOsxOrWindows) app.clearRecentDocuments()
    if (isOsx) return

    const recentDocuments: string[] = []
    this.updateAppMenu(recentDocuments)
    const json = JSON.stringify(recentDocuments, null, 2)
    ensureDirSync(this._userDataPath)
    fs.writeFileSync(RECENTS_PATH, json, 'utf-8')
  }

  /**
   * Add a default menu to the given window.
   *
   * @param windowId The window id.
   */
  addDefaultMenu(windowId: number): void {
    const { windowMenus } = this
    const menu = this._buildSettingMenu() // Setting menu is also the fallback menu.
    windowMenus.set(windowId, menu)
  }

  /**
   * Add the settings menu to the given window.
   *
   * @param window The settings browser window.
   */
  addSettingMenu(window: BrowserWindow): void {
    const { windowMenus } = this
    const menu = this._buildSettingMenu()
    windowMenus.set(window.id, menu)
  }

  /**
   * Add the editor menu to the given window.
   *
   * @param window The editor browser window.
   * @param options The menu options.
   */
  addEditorMenu(window: BrowserWindow, options: AddEditorMenuOptions = {}): void {
    const isSourceMode = !!options.sourceCodeModeEnabled
    const { windowMenus } = this
    windowMenus.set(window.id, this._buildEditorMenu())
    // Align the freshly built menu with the state last reported for this window,
    // if any. Until the renderer reports one the pandoc entry stays enabled —
    // see `_applyWindowMenuState`.
    this._applyWindowMenuState(window.id)

    const entry = windowMenus.get(window.id)!
    const menu = entry.menu!

    // Set source-code editor if preferred.
    const sourceCodeModeMenuItem = menu.getMenuItemById('sourceCodeModeMenuItem')
    if (sourceCodeModeMenuItem) {
      sourceCodeModeMenuItem.checked = isSourceMode
    }

    if (isSourceMode) {
      const typewriterModeMenuItem = menu.getMenuItemById('typewriterModeMenuItem')
      const focusModeMenuItem = menu.getMenuItemById('focusModeMenuItem')
      if (typewriterModeMenuItem) typewriterModeMenuItem.enabled = false
      if (focusModeMenuItem) focusModeMenuItem.enabled = false
    }

    const { _keybindings } = this
    _keybindings.registerEditorKeyHandlers(window)

    if (isWindows) {
      // WORKAROUND: Window close event isn't triggered on Windows if `setIgnoreMenuShortcuts(true)` is used (Electron#32674).
      // NB: Remove this immediately if upstream is fixed because the event may be emitted twice.
      _keybindings.registerAccelerator(window, 'Alt+F4', (win: BrowserWindow | null) => {
        if (win && !win.isDestroyed()) {
          win.close()
        }
      })
    }
  }

  /**
   * Remove menu from the given window.
   *
   * @param windowId The window id.
   */
  removeWindowMenu(windowId: number): void {
    // NOTE: Shortcut handler is automatically unregistered when window is closed.
    const { activeWindowId } = this
    this.windowMenus.delete(windowId)
    this._windowMenuState.delete(windowId)
    if (activeWindowId === windowId) {
      this.activeWindowId = -1
    }
  }

  /**
   * Returns the window menu.
   *
   * @param windowId The window id.
   */
  getWindowMenuById(windowId: number): Menu {
    const menu = this.windowMenus.get(windowId)
    if (!menu) {
      log.error(`getWindowMenuById: Cannot find window menu for window id ${windowId}.`)
      throw new Error(`Cannot find window menu for id ${windowId}.`)
    }
    // The original JS returns `menu.menu` directly; settings menus on non-macOS
    // platforms have `menu: null`, in which case the consumer is responsible
    // for handling the null/undefined return.
    return menu.menu as Menu
  }

  /**
   * Check whether the given window has a menu.
   *
   * @param windowId The window id.
   */
  has(windowId: number): boolean {
    return this.windowMenus.has(windowId)
  }

  /**
   * Set the given window as last active.
   *
   * @param windowId The window id.
   */
  setActiveWindow(windowId: number): void {
    if (this.activeWindowId !== windowId) {
      // Change application menu to the current window menu.
      this._setApplicationMenu(this.getWindowMenuById(windowId))
      this.activeWindowId = windowId
    }
  }

  /**
   * Updates all window menus.
   *
   * NOTE: We need this method to add or remove menu items at runtime.
   */
  updateAppMenu(recentUsedDocuments?: string[]): void {
    if (!recentUsedDocuments) {
      recentUsedDocuments = this.getRecentlyUsedDocuments()
    }

    // "we don't support changing menu object after calling setMenu, the behavior
    // is undefined if user does that." That mean we have to recreate the editor
    // application menu each time.

    // rebuild all window menus
    this.windowMenus.forEach((value, key) => {
      const { menu: oldMenu, type } = value
      if (type !== MenuType.EDITOR || !oldMenu) return

      const { menu: newMenu } = this._buildEditorMenu(recentUsedDocuments)
      if (!newMenu) return

      // all other menu items are set automatically
      updateMenuItem(oldMenu, newMenu, 'sourceCodeModeMenuItem')
      updateMenuItem(oldMenu, newMenu, 'typewriterModeMenuItem')
      updateMenuItem(oldMenu, newMenu, 'focusModeMenuItem')
      updateMenuItem(oldMenu, newMenu, 'sideBarMenuItem')
      updateMenuItem(oldMenu, newMenu, 'tabBarMenuItem')

      // update window menu
      value.menu = newMenu
      this._applyWindowMenuState(key)
      // update application menu if necessary
      const { activeWindowId } = this
      if (activeWindowId === key) {
        this._setApplicationMenu(newMenu)
      }
    })
  }

  /**
   * Rebuild every window menu so updated keybinding accelerators are reflected
   * wherever shortcuts are shown: the menu bar on Windows/Linux and the macOS
   * application menu for both editor and settings windows.
   */
  updateKeybindings(): void {
    const recentUsedDocuments = this.getRecentlyUsedDocuments()
    this.windowMenus.forEach((value, key) => {
      const { menu: oldMenu, type } = value

      let newMenu: Menu | null = null
      if (type === MenuType.EDITOR) {
        if (!oldMenu) return
        const { menu: rebuilt } = this._buildEditorMenu(recentUsedDocuments)
        if (!rebuilt) return

        updateMenuItem(oldMenu, rebuilt, 'sourceCodeModeMenuItem')
        updateMenuItem(oldMenu, rebuilt, 'typewriterModeMenuItem')
        updateMenuItem(oldMenu, rebuilt, 'focusModeMenuItem')
        updateMenuItem(oldMenu, rebuilt, 'sideBarMenuItem')
        updateMenuItem(oldMenu, rebuilt, 'tabBarMenuItem')
        newMenu = rebuilt
      } else if (type === MenuType.SETTINGS) {
        newMenu = this._buildSettingMenu().menu
        if (!newMenu) return
      } else {
        return
      }

      value.menu = newMenu
      this._applyWindowMenuState(key)
      if (this.activeWindowId === key) {
        this._setApplicationMenu(newMenu)
      }
    })
  }

  /**
   * Update line ending menu items.
   *
   * @param windowId The window id.
   * @param lineEnding Either >lf< or >crlf<.
   */
  updateLineEndingMenu(windowId: number, lineEnding: string): void {
    this._rememberWindowState(windowId, { lineEnding })
    const menus = this.getWindowMenuById(windowId)
    const crlfMenu = menus.getMenuItemById('crlfLineEndingMenuEntry')
    const lfMenu = menus.getMenuItemById('lfLineEndingMenuEntry')
    if (lineEnding === 'crlf') {
      if (crlfMenu) crlfMenu.checked = true
    } else {
      if (lfMenu) lfMenu.checked = true
    }
  }

  /**
   * Update always on top menu item.
   *
   * @param windowId The window id.
   * @param flag Always on top.
   */
  updateAlwaysOnTopMenu(windowId: number, flag: boolean): void {
    this._rememberWindowState(windowId, { alwaysOnTop: flag })
    const menus = this.getWindowMenuById(windowId)
    const menu = menus.getMenuItemById('alwaysOnTopMenuItem')
    if (menu) menu.checked = flag
  }

  /**
   * Grey out or re-enable the Paragraph and Format commands of a window.
   *
   * In source-code mode they act on the hidden WYSIWYG engine, so the renderer
   * turns them off and back on again (#3531).
   *
   * @param windowId The window id.
   * @param enabled Whether the commands apply to what the window is showing.
   */
  updateFormatMenusEnabled(windowId: number, enabled: boolean): void {
    this._rememberWindowState(windowId, { formatMenusEnabled: enabled })
    this._applyFormatMenusEnabled(windowId, enabled)
  }

  /**
   * Update the Format check marks of a window.
   *
   * @param windowId The window id.
   * @param formats A map of selected formats.
   */
  updateFormatMenuState(windowId: number, formats: Record<string, boolean>): void {
    this._rememberWindowState(windowId, { formats })
    updateFormatMenu(this.getWindowMenuById(windowId), formats)
  }

  /**
   * Update theme menu state across editor menus.
   */
  updateThemeMenu = ({ theme, followSystemTheme }: ThemeMenuChange = {}): void => {
    this.windowMenus.forEach((value) => {
      const { menu, type } = value
      if (type !== MenuType.EDITOR || !menu) {
        return
      }

      const themeMenus = menu.getMenuItemById('themeMenu')
      if (!themeMenus || !themeMenus.submenu) {
        return
      }

      themeMenus.submenu.items.forEach((item) => {
        if (item.type === 'radio' && typeof followSystemTheme !== 'undefined') {
          item.enabled = !followSystemTheme
        }

        if (item.id === 'follow-system-theme' && typeof followSystemTheme !== 'undefined') {
          item.checked = followSystemTheme
        }

        if (item.type === 'radio' && typeof theme !== 'undefined') {
          item.checked = item.id === theme
        } else if (item.id && item.id === theme) {
          item.checked = true
        }
      })
    })
  }

  /**
   * Update all auto save entries from editor menus to the given state.
   */
  updateAutoSaveMenu = (autoSave: boolean): void => {
    this.windowMenus.forEach((value) => {
      const { menu, type } = value
      if (type !== MenuType.EDITOR || !menu) {
        return
      }

      const autoSaveMenu = menu.getMenuItemById('autoSaveMenuItem')
      if (!autoSaveMenu) {
        return
      }
      autoSaveMenu.checked = autoSave
    })
  }

  /**
   * Record whether a window has a document open, and enable or grey out its
   * pandoc export submenu accordingly.
   *
   * The submenu exports the active tab, and the main process cannot see the
   * renderer's tabs: without this the entries stay clickable while the window
   * shows the recent-files page, where a click does nothing at all and the user
   * gets no feedback (#5379).
   *
   * @param windowId The window id.
   * @param hasDocument Whether the window has a document open.
   */
  updatePandocMenu(windowId: number, hasDocument: boolean): void {
    if (!this.has(windowId)) return
    this._rememberWindowState(windowId, { hasDocument })
    this._applyWindowMenuState(windowId)
  }

  /**
   * Apply everything known about a window to its current menu.
   *
   * Called after every rebuild — the menu objects a rebuild produces are new, so
   * whatever the renderer had set on the previous one is gone. See
   * `WindowMenuState`.
   *
   * @param windowId The window id.
   */
  private _applyWindowMenuState(windowId: number): void {
    // Pandoc availability is not per window and a window that never reported
    // must still be greyed out when the binary is missing, so this part always
    // runs; the rest only replays what the window actually reported.
    this._applyPandocMenuState(windowId)

    const state = this._windowMenuState.get(windowId)
    if (!state) {
      return
    }

    if (state.formatMenusEnabled !== undefined) {
      this._applyFormatMenusEnabled(windowId, state.formatMenusEnabled)
    }
    if (state.lineEnding !== undefined) {
      this.updateLineEndingMenu(windowId, state.lineEnding)
    }
    if (state.alwaysOnTop !== undefined) {
      this.updateAlwaysOnTopMenu(windowId, state.alwaysOnTop)
    }
    if (state.formats) {
      updateFormatMenu(this.getWindowMenuById(windowId), state.formats)
    }
  }

  /**
   * Apply what is known about a window to its two pandoc entries: whether pandoc
   * can be run at all, and whether this window has a document.
   *
   * A window that has not reported keeps the export entry enabled — a renderer
   * that never reports must not be able to leave the menu permanently greyed
   * out.
   *
   * @param windowId The window id.
   */
  private _applyPandocMenuState(windowId: number): void {
    const menu = this.windowMenus.get(windowId)?.menu
    if (!menu) {
      return
    }

    const pandocAvailable = isPandocAvailable()

    // The export submenu acts on the active tab, so it also needs a document
    // open; import creates the document, so it depends on pandoc alone.
    const exportItem = menu.getMenuItemById('convertWithPandocMenuItem')
    if (exportItem) {
      const { hasDocument } = this._windowMenuState.get(windowId) ?? {}
      exportItem.enabled = pandocAvailable && hasDocument !== false
    }

    const importItem = menu.getMenuItemById('importFileMenuItem')
    if (importItem) {
      importItem.enabled = pandocAvailable
    }
  }

  /**
   * Note down what the renderer reported, merging it into whatever the window
   * had already reported.
   *
   * @param windowId The window id.
   * @param patch The values to remember.
   */
  private _rememberWindowState(windowId: number, patch: WindowMenuState): void {
    this._windowMenuState.set(windowId, { ...this._windowMenuState.get(windowId), ...patch })
  }

  /**
   * Grey out or re-enable the Paragraph and Format submenus of a window.
   *
   * @param windowId The window id.
   * @param enabled Whether the commands apply to what the window is showing.
   */
  private _applyFormatMenusEnabled(windowId: number, enabled: boolean): void {
    const menu = this.getWindowMenuById(windowId)
    for (const id of ['paragraphMenuEntry', 'formatMenuItem']) {
      const entry = menu.getMenuItemById(id)
      entry?.submenu?.items.forEach((item) => (item.enabled = enabled))
    }
  }

  _buildEditorMenu(recentUsedDocuments: string[] | null = null): WindowMenuEntry {
    if (!recentUsedDocuments) {
      recentUsedDocuments = this.getRecentlyUsedDocuments()
    }

    const menuTemplate = configureMenu(this._keybindings, this._preferences, recentUsedDocuments)
    const menu = Menu.buildFromTemplate(menuTemplate)
    return { menu, type: MenuType.EDITOR }
  }

  _buildSettingMenu(): WindowMenuEntry {
    if (isOsx) {
      const menuTemplate = configSettingMenu(this._keybindings)
      const menu = Menu.buildFromTemplate(menuTemplate)
      return { menu, type: MenuType.SETTINGS }
    }
    return { menu: null, type: MenuType.SETTINGS }
  }

  _setApplicationMenu(menu: Menu | null): void {
    if (isLinux && !menu) {
      // WORKAROUND for Electron#16521: We cannot hide the (application) menu on Linux.
      const dummyMenu = Menu.buildFromTemplate([])
      Menu.setApplicationMenu(dummyMenu)
    } else {
      Menu.setApplicationMenu(menu)
    }
  }

  /**
   * Initialize main process language from preferences
   */
  async _initializeLanguage(): Promise<void> {
    try {
      const currentLanguage = this._preferences.getItem<string>('language')
      if (currentLanguage) {
        setLanguage(currentLanguage)
        log.info(`Main process language initialized to: ${currentLanguage}`)
      }
    } catch (error) {
      log.error('Failed to initialize main process language:', error)
    }
  }

  _listenForIpcMain(): void {
    ipcMain.on('mt::add-recently-used-document', (_e, pathname: string) => {
      this.addRecentlyUsedDocument(pathname)
    })
    ipcMain.on('mt::update-line-ending-menu', (_e, windowId: number, lineEnding: string) => {
      if (!this.has(windowId)) return
      this.updateLineEndingMenu(windowId, lineEnding)
    })
    ipcMain.on(
      'mt::update-format-menu',
      (_e, windowId: number, formats: Record<string, boolean>) => {
        if (!this.has(windowId)) {
          log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
          return
        }
        this.updateFormatMenuState(windowId, formats)
      }
    )
    ipcMain.on('mt::update-sidebar-menu', (_e, windowId: number, value: unknown) => {
      if (!this.has(windowId)) {
        log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
        return
      }
      updateSidebarMenu(this.getWindowMenuById(windowId), value)
    })
    ipcMain.on(
      'mt::view-layout-changed',
      (_e, windowId: number, viewSettings: Record<string, unknown>) => {
        if (!this.has(windowId)) {
          log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
          return
        }
        viewLayoutChanged(this.getWindowMenuById(windowId), viewSettings)
      }
    )
    ipcMain.on('mt::editor-selection-changed', (_e, windowId: number, changes: SelectionState) => {
      if (!this.has(windowId)) {
        log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
        return
      }
      updateSelectionMenus(this.getWindowMenuById(windowId), changes)
    })

    // In source-code mode the Paragraph and Format commands act on the hidden
    // WYSIWYG engine, so grey them out; on return to WYSIWYG they are re-enabled
    // and the next selection change refines them (#3531).
    ipcMain.on('mt::set-editor-format-menus-enabled', (_e, windowId: number, enabled: boolean) => {
      if (!this.has(windowId)) return
      this.updateFormatMenusEnabled(windowId, enabled)
    })

    // The renderer owns the tab list and the main process cannot read it, so it
    // reports here whether this window has a document to export; the pandoc
    // entry is greyed out when it does not (#5379).
    ipcMain.on('mt::update-pandoc-menu', (_e, windowId: number, hasDocument: boolean) => {
      this.updatePandocMenu(windowId, hasDocument)
    })

    onInternalChannel('menu-add-recently-used', (pathname: string) => {
      this.addRecentlyUsedDocument(pathname)
    })
    ipcMain.on('menu-clear-recently-used', () => {
      this.clearRecentlyUsedDocuments()
    })

    onInternalChannel('broadcast-preferences-changed', async(prefs: Partial<IUserPreferences>) => {
      if (prefs.theme !== undefined || prefs.followSystemTheme !== undefined) {
        this.updateAppMenu()
      }
      if (prefs.autoSave !== undefined) {
        this.updateAutoSaveMenu(prefs.autoSave)
      }
      if (prefs.language) {
        // Update main process language and rebuild menu
        setLanguage(prefs.language)
        this.updateAppMenu()
      }
      if (prefs.pandocExportFormats !== undefined || prefs.pandocDefaultFormat !== undefined) {
        // These two decide what the "Convert with Pandoc" submenu contains and
        // which of its entries is marked as the default, and the submenu is
        // built from the preferences — without this rebuild the menu keeps
        // offering the previous list until a restart.
        this.updateAppMenu()
      }
      if (prefs.pandocPath !== undefined) {
        // The path decides whether pandoc can be run, which is what enables the
        // export and import entries; a changed answer rebuilds the menus.
        refreshPandocAvailability()
      }
    })
  }
}

const updateMenuItem = (oldMenus: Menu, newMenus: Menu, id: string): void => {
  const oldItem = oldMenus.getMenuItemById(id)
  const newItem = newMenus.getMenuItemById(id)
  if (oldItem && newItem) {
    newItem.checked = oldItem.checked
  }
}

// ----------------------------------------------

// HACKY: We have one application menu per window and switch the menu when
// switching windows, so we can access and change the menu items via Electron.

/**
 * Return the menu from the application menu.
 *
 * @param menuId Menu ID
 * @returns Returns the menu or null.
 */
export const getMenuItemById = (menuId: string): Electron.MenuItem | null => {
  const menus = Menu.getApplicationMenu()
  if (!menus) return null
  return menus.getMenuItemById(menuId)
}

export default AppMenu
