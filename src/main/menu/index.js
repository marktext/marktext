import fs from 'fs'
import path from 'path'
import { app, ipcMain, Menu } from 'electron'
import log from 'electron-log'
import { ensureDirSync, isDirectory2, isFile2 } from 'common/filesystem'
import { isLinux, isOsx, isWindows } from '../config'
import { updateSidebarMenu } from '../menu/actions/edit'
import { updateFormatMenu } from '../menu/actions/format'
import { updateSelectionMenus } from '../menu/actions/paragraph'
import { viewLayoutChanged } from '../menu/actions/view'
import configureMenu, { configSettingMenu } from '../menu/templates'

const RECENTLY_USED_DOCUMENTS_FILE_NAME = 'recently-used-documents.json'
const MAX_RECENTLY_USED_DOCUMENTS = 12
export const MenuType = {
  DEFAULT: 0,
  EDITOR: 1,
  SETTINGS: 2
}

class AppMenu {
  /**
   * @param {Preference} preferences The preferences instances.
   * @param {Keybindings} keybindings The keybindings instances.
   * @param {string} userDataPath The user data path.
   */
  constructor (preferences, keybindings, userDataPath) {
    this._preferences = preferences
    this._keybindings = keybindings
    this._userDataPath = userDataPath

    this.RECENTS_PATH = path.join(userDataPath, RECENTLY_USED_DOCUMENTS_FILE_NAME)
    this.isOsxOrWindows = isOsx || isWindows
    this.activeWindowId = -1
    this.windowMenus = new Map()

    this._listenForIpcMain()
  }

  /**
   * Add the file or directory path to the recently used documents.
   *
   * @param {string} filePath The file or directory full path.
   */
  addRecentlyUsedDocument (filePath) {
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
      recentDocuments.splice(MAX_RECENTLY_USED_DOCUMENTS, recentDocuments.length - MAX_RECENTLY_USED_DOCUMENTS)
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
   *
   * @returns {string[]}
   */
  getRecentlyUsedDocuments () {
    const { RECENTS_PATH } = this
    if (!isFile2(RECENTS_PATH)) {
      return []
    }

    try {
      const recentDocuments = JSON.parse(fs.readFileSync(RECENTS_PATH, 'utf-8'))
        .filter(f => f && (isFile2(f) || isDirectory2(f)))

      if (recentDocuments.length > MAX_RECENTLY_USED_DOCUMENTS) {
        recentDocuments.splice(MAX_RECENTLY_USED_DOCUMENTS, recentDocuments.length - MAX_RECENTLY_USED_DOCUMENTS)
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
  clearRecentlyUsedDocuments () {
    const { isOsxOrWindows, RECENTS_PATH } = this
    if (isOsxOrWindows) app.clearRecentDocuments()
    if (isOsx) return

    const recentDocuments = []
    this.updateAppMenu(recentDocuments)
    const json = JSON.stringify(recentDocuments, null, 2)
    ensureDirSync(this._userDataPath)
    fs.writeFileSync(RECENTS_PATH, json, 'utf-8')
  }

  /**
   * Add a default menu to the given window.
   *
   * @param {number} windowId The window id.
   */
  addDefaultMenu (windowId) {
    const { windowMenus } = this
    const menu = this._buildSettingMenu() // Setting menu is also the fallback menu.
    windowMenus.set(windowId, menu)
  }

  /**
   * Add the settings menu to the given window.
   *
   * @param {BrowserWindow} window The settings browser window.
   */
  addSettingMenu (window) {
    const { windowMenus } = this
    const menu = this._buildSettingMenu()
    windowMenus.set(window.id, menu)
  }

  /**
   * Add the editor menu to the given window.
   *
   * @param {BrowserWindow} window The editor browser window.
   * @param {[*]} options The menu options.
   */
  addEditorMenu (window, options = {}) {
    const isSourceMode = !!options.sourceCodeModeEnabled
    const { windowMenus } = this
    windowMenus.set(window.id, this._buildEditorMenu())

    const { menu } = windowMenus.get(window.id)

    // Set source-code editor if preferred.
    const sourceCodeModeMenuItem = menu.getMenuItemById('sourceCodeModeMenuItem')
    sourceCodeModeMenuItem.checked = isSourceMode

    if (isSourceMode) {
      const typewriterModeMenuItem = menu.getMenuItemById('typewriterModeMenuItem')
      const focusModeMenuItem = menu.getMenuItemById('focusModeMenuItem')
      typewriterModeMenuItem.enabled = false
      focusModeMenuItem.enabled = false
    }

    const { _keybindings } = this
    _keybindings.registerEditorKeyHandlers(window)

    if (isWindows) {
      // WORKAROUND: Window close event isn't triggered on Windows if `setIgnoreMenuShortcuts(true)` is used (Electron#32674).
      // NB: Remove this immediately if upstream is fixed because the event may be emitted twice.
      _keybindings.registerAccelerator(window, 'Alt+F4', win => {
        if (win && !win.isDestroyed()) {
          win.close()
        }
      })
    }
  }

  /**
   * Remove menu from the given window.
   *
   * @param {number} windowId The window id.
   */
  removeWindowMenu (windowId) {
    // NOTE: Shortcut handler is automatically unregistered when window is closed.
    const { activeWindowId } = this
    this.windowMenus.delete(windowId)
    if (activeWindowId === windowId) {
      this.activeWindowId = -1
    }
  }

  /**
   * Returns the window menu.
   *
   * @param {number} windowId The window id.
   * @returns {Electron.Menu} The menu.
   */
  getWindowMenuById (windowId) {
    const menu = this.windowMenus.get(windowId)
    if (!menu) {
      log.error(`getWindowMenuById: Cannot find window menu for window id ${windowId}.`)
      throw new Error(`Cannot find window menu for id ${windowId}.`)
    }
    return menu.menu
  }

  /**
   * Check whether the given window has a menu.
   *
   * @param {number} windowId The window id.
   */
  has (windowId) {
    return this.windowMenus.has(windowId)
  }

  /**
   * Set the given window as last active.
   *
   * @param {number} windowId The window id.
   */
  setActiveWindow (windowId) {
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
   *
   * @param {[string[]]} recentUsedDocuments
   */
  updateAppMenu (recentUsedDocuments) {
    if (!recentUsedDocuments) {
      recentUsedDocuments = this.getRecentlyUsedDocuments()
    }

    // "we don't support changing menu object after calling setMenu, the behavior
    // is undefined if user does that." That mean we have to recreate the editor
    // application menu each time.

    // rebuild all window menus
    this.windowMenus.forEach((value, key) => {
      const { menu: oldMenu, type } = value
      if (type !== MenuType.EDITOR) return

      const { menu: newMenu } = this._buildEditorMenu(recentUsedDocuments)

      // all other menu items are set automatically
      updateMenuItem(oldMenu, newMenu, 'sourceCodeModeMenuItem')
      updateMenuItem(oldMenu, newMenu, 'typewriterModeMenuItem')
      updateMenuItem(oldMenu, newMenu, 'focusModeMenuItem')
      updateMenuItem(oldMenu, newMenu, 'sideBarMenuItem')
      updateMenuItem(oldMenu, newMenu, 'tabBarMenuItem')

      // update window menu
      value.menu = newMenu

      // update application menu if necessary
      const { activeWindowId } = this
      if (activeWindowId === key) {
        this._setApplicationMenu(newMenu)
      }
    })
  }

  /**
   * Update line ending menu items.
   *
   * @param {number} windowId The window id.
   * @param {string} lineEnding Either >lf< or >crlf<.
   */
  updateLineEndingMenu (windowId, lineEnding) {
    const menus = this.getWindowMenuById(windowId)
    const crlfMenu = menus.getMenuItemById('crlfLineEndingMenuEntry')
    const lfMenu = menus.getMenuItemById('lfLineEndingMenuEntry')
    if (lineEnding === 'crlf') {
      crlfMenu.checked = true
    } else {
      lfMenu.checked = true
    }
  }

  /**
   * Update always on top menu item.
   *
   * @param {number} windowId The window id.
   * @param {boolean} lineEnding Always on top.
   */
  updateAlwaysOnTopMenu (windowId, flag) {
    const menus = this.getWindowMenuById(windowId)
    const menu = menus.getMenuItemById('alwaysOnTopMenuItem')
    menu.checked = flag
  }

  /**
   * Update all theme entries from editor menus to the selected one.
   */
  updateThemeMenu = theme => {
    this.windowMenus.forEach(value => {
      const { menu, type } = value
      if (type !== MenuType.EDITOR) {
        return
      }

      const themeMenus = menu.getMenuItemById('themeMenu')
      if (!themeMenus) {
        return
      }

      themeMenus.submenu.items.forEach(item => (item.checked = false))
      themeMenus.submenu.items
        .forEach(item => {
          if (item.id && item.id === theme) {
            item.checked = true
          }
        })
    })
  }

  /**
   * Update all auto save entries from editor menus to the given state.
   */
  updateAutoSaveMenu = autoSave => {
    this.windowMenus.forEach(value => {
      const { menu, type } = value
      if (type !== MenuType.EDITOR) {
        return
      }

      const autoSaveMenu = menu.getMenuItemById('autoSaveMenuItem')
      if (!autoSaveMenu) {
        return
      }
      autoSaveMenu.checked = autoSave
    })
  }

  _buildEditorMenu (recentUsedDocuments = null) {
    if (!recentUsedDocuments) {
      recentUsedDocuments = this.getRecentlyUsedDocuments()
    }

    const menuTemplate = configureMenu(this._keybindings, this._preferences, recentUsedDocuments)
    const menu = Menu.buildFromTemplate(menuTemplate)
    return { menu, type: MenuType.EDITOR }
  }

  _buildSettingMenu () {
    if (isOsx) {
      const menuTemplate = configSettingMenu(this._keybindings)
      const menu = Menu.buildFromTemplate(menuTemplate)
      return { menu, type: MenuType.SETTINGS }
    }
    return { menu: null, type: MenuType.SETTINGS }
  }

  _setApplicationMenu (menu) {
    if (isLinux && !menu) {
      // WORKAROUND for Electron#16521: We cannot hide the (application) menu on Linux.
      const dummyMenu = Menu.buildFromTemplate([])
      Menu.setApplicationMenu(dummyMenu)
    } else {
      Menu.setApplicationMenu(menu)
    }
  }

  _listenForIpcMain () {
    ipcMain.on('mt::add-recently-used-document', (e, pathname) => {
      this.addRecentlyUsedDocument(pathname)
    })
    ipcMain.on('mt::update-line-ending-menu', (e, windowId, lineEnding) => {
      this.updateLineEndingMenu(windowId, lineEnding)
    })
    ipcMain.on('mt::update-format-menu', (e, windowId, formats) => {
      if (!this.has(windowId)) {
        log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
        return
      }
      updateFormatMenu(this.getWindowMenuById(windowId), formats)
    })
    ipcMain.on('mt::update-sidebar-menu', (e, windowId, value) => {
      if (!this.has(windowId)) {
        log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
        return
      }
      updateSidebarMenu(this.getWindowMenuById(windowId), value)
    })
    ipcMain.on('mt::view-layout-changed', (e, windowId, viewSettings) => {
      if (!this.has(windowId)) {
        log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
        return
      }
      viewLayoutChanged(this.getWindowMenuById(windowId), viewSettings)
    })
    ipcMain.on('mt::editor-selection-changed', (e, windowId, changes) => {
      if (!this.has(windowId)) {
        log.error(`UpdateApplicationMenu: Cannot find window menu for window id ${windowId}.`)
        return
      }
      updateSelectionMenus(this.getWindowMenuById(windowId), changes)
    })

    ipcMain.on('menu-add-recently-used', pathname => {
      this.addRecentlyUsedDocument(pathname)
    })
    ipcMain.on('menu-clear-recently-used', () => {
      this.clearRecentlyUsedDocuments()
    })

    ipcMain.on('broadcast-preferences-changed', prefs => {
      if (prefs.theme !== undefined) {
        this.updateThemeMenu(prefs.theme)
      }
      if (prefs.autoSave !== undefined) {
        this.updateAutoSaveMenu(prefs.autoSave)
      }
    })
  }
}

const updateMenuItem = (oldMenus, newMenus, id) => {
  const oldItem = oldMenus.getMenuItemById(id)
  const newItem = newMenus.getMenuItemById(id)
  newItem.checked = oldItem.checked
}

// ----------------------------------------------

// HACKY: We have one application menu per window and switch the menu when
// switching windows, so we can access and change the menu items via Electron.

/**
 * Return the menu from the application menu.
 *
 * @param {string} menuId Menu ID
 * @returns {Electron.Menu} Returns the menu or null.
 */
export const getMenuItemById = menuId => {
  const menus = Menu.getApplicationMenu()
  return menus.getMenuItemById(menuId)
}

export default AppMenu
