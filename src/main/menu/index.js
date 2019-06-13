import fs from 'fs'
import path from 'path'
import { app, ipcMain, Menu } from 'electron'
import log from 'electron-log'
import { ensureDirSync, isDirectory, isFile } from 'common/filesystem'
import { isLinux } from '../config'
import { parseMenu } from '../keyboard/shortcutHandler'
import configureMenu, { configSettingMenu } from '../menu/templates'

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
    const FILE_NAME = 'recently-used-documents.json'
    this.MAX_RECENTLY_USED_DOCUMENTS = 12

    this._preferences = preferences
    this._keybindings = keybindings
    this._userDataPath = userDataPath

    this.RECENTS_PATH = path.join(userDataPath, FILE_NAME)
    this.isOsxOrWindows = /darwin|win32/.test(process.platform)
    this.isOsx = process.platform === 'darwin'
    this.activeWindowId = -1
    this.windowMenus = new Map()

    this._listenForIpcMain()
  }

  addRecentlyUsedDocument (filePath) {
    const { isOsxOrWindows, isOsx, MAX_RECENTLY_USED_DOCUMENTS, RECENTS_PATH } = this

    if (isOsxOrWindows) app.addRecentDocument(filePath)
    if (isOsx) return

    let recentDocuments = this.getRecentlyUsedDocuments()
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

  getRecentlyUsedDocuments () {
    const { RECENTS_PATH, MAX_RECENTLY_USED_DOCUMENTS } = this
    if (!isFile(RECENTS_PATH)) {
      return []
    }

    try {
      let recentDocuments = JSON.parse(fs.readFileSync(RECENTS_PATH, 'utf-8'))
        .filter(f => f && (isFile(f) || isDirectory(f)))

      if (recentDocuments.length > MAX_RECENTLY_USED_DOCUMENTS) {
        recentDocuments.splice(MAX_RECENTLY_USED_DOCUMENTS, recentDocuments.length - MAX_RECENTLY_USED_DOCUMENTS)
      }
      return recentDocuments
    } catch (err) {
      log.error(err)
      return []
    }
  }

  clearRecentlyUsedDocuments () {
    const { isOsxOrWindows, isOsx, RECENTS_PATH } = this
    if (isOsxOrWindows) app.clearRecentDocuments()
    if (isOsx) return

    const recentDocuments = []
    this.updateAppMenu(recentDocuments)
    const json = JSON.stringify(recentDocuments, null, 2)
    ensureDirSync(this._userDataPath)
    fs.writeFileSync(RECENTS_PATH, json, 'utf-8')
  }

  addDefaultMenu (windowId) {
    const { windowMenus } = this
    const menu = this.buildSettingMenu() // Setting menu is also the fallback menu.
    windowMenus.set(windowId, menu)
  }

  addSettingMenu (window) {
    const { windowMenus } = this
    const menu = this.buildSettingMenu()
    windowMenus.set(window.id, menu)
  }

  addEditorMenu (window, options = {}) {
    const { windowMenus } = this
    windowMenus.set(window.id, this.buildEditorMenu(true))

    const { menu, shortcutMap } = windowMenus.get(window.id)
    const currentMenu = Menu.getApplicationMenu() // the menu may be null
    updateMenuItemSafe(currentMenu, menu, 'sourceCodeModeMenuItem', !!options.sourceCodeModeEnabled)
    updateMenuItemSafe(currentMenu, menu, 'typewriterModeMenuItem', false)

    // FIXME: Focus mode is being ignored when you open a new window - inconsistency.
    // updateMenuItemSafe(currentMenu, menu, 'focusModeMenuItem', false)

    const { checked: isSourceMode } = menu.getMenuItemById('sourceCodeModeMenuItem')
    if (isSourceMode) {
      // BUG: When opening a file `typewriterMode` and `focusMode` will be reset by editor.
      //      If source code mode is set the editor must not change the values.
      const typewriterModeMenuItem = menu.getMenuItemById('typewriterModeMenuItem')
      const focusModeMenuItem = menu.getMenuItemById('focusModeMenuItem')
      typewriterModeMenuItem.enabled = false
      focusModeMenuItem.enabled = false
    }
    this._keybindings.registerKeyHandlers(window, shortcutMap)
  }

  removeWindowMenu (windowId) {
    // NOTE: Shortcut handler is automatically unregistered when window is closed.
    const { activeWindowId } = this
    this.windowMenus.delete(windowId)
    if (activeWindowId === windowId) {
      this.activeWindowId = -1
    }
  }

  getWindowMenuById (windowId) {
    const menu = this.windowMenus.get(windowId)
    if (!menu) {
      log.error(`getWindowMenuById: Cannot find window menu for id ${windowId}.`)
      throw new Error(`Cannot find window menu for id ${windowId}.`)
    }
    return menu.menu
  }

  has (windowId) {
    return this.windowMenus.has(windowId)
  }

  setActiveWindow (windowId) {
    if (this.activeWindowId !== windowId) {
      // Change application menu to the current window menu.
      this._setApplicationMenu(this.getWindowMenuById(windowId))
      this.activeWindowId = windowId
    }
  }

  buildEditorMenu (createShortcutMap, recentUsedDocuments) {
    if (!recentUsedDocuments) {
      recentUsedDocuments = this.getRecentlyUsedDocuments()
    }

    const menuTemplate = configureMenu(this._keybindings, this._preferences, recentUsedDocuments)
    const menu = Menu.buildFromTemplate(menuTemplate)

    let shortcutMap = null
    if (createShortcutMap) {
      shortcutMap = parseMenu(menuTemplate)
    }

    return {
      shortcutMap,
      menu,
      type: MenuType.EDITOR
    }
  }

  buildSettingMenu () {
    if (this.isOsx) {
      const menuTemplate = configSettingMenu(this._keybindings)
      const menu = Menu.buildFromTemplate(menuTemplate)
      return { menu, type: MenuType.SETTINGS }
    }
    return { menu: null, type: MenuType.SETTINGS }
  }

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

      const { menu: newMenu } = this.buildEditorMenu(false, recentUsedDocuments)

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

  updateLineEndingMenu (lineEnding) {
    updateLineEndingMenu(lineEnding)
  }

  updateAlwaysOnTopMenu (flag) {
    const menus = Menu.getApplicationMenu()
    const menu = menus.getMenuItemById('alwaysOnTopMenuItem')
    menu.checked = flag
  }

  updateThemeMenu = theme => {
    this.windowMenus.forEach((value, key) => {
      const { menu, type } = value
      if (type !== MenuType.EDITOR) return

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

  updateAutoSaveMenu = autoSave => {
    this.windowMenus.forEach((value, key) => {
      const { menu, type } = value
      if (type !== MenuType.EDITOR) return

      const autoSaveMenu = menu.getMenuItemById('autoSaveMenuItem')
      if (!autoSaveMenu) {
        return
      }
      autoSaveMenu.checked = autoSave
    })
  }

  updateAidouMenu = bool => {
    this.windowMenus.forEach((value, key) => {
      const { menu, type } = value
      if (type !== MenuType.EDITOR) return

      const aidouMenu = menu.getMenuItemById('aidou')
      if (!aidouMenu) {
        return
      }
      aidouMenu.visible = bool
    })
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
      if (prefs.aidou !== undefined) {
        this.updateAidouMenu(prefs.aidou)
      }
    })
  }
}

const updateMenuItem = (oldMenus, newMenus, id) => {
  const oldItem = oldMenus.getMenuItemById(id)
  const newItem = newMenus.getMenuItemById(id)
  newItem.checked = oldItem.checked
}

const updateMenuItemSafe = (oldMenus, newMenus, id, defaultValue) => {
  let checked = defaultValue
  if (oldMenus) {
    const oldItem = oldMenus.getMenuItemById(id)
    if (oldItem) {
      checked = oldItem.checked
    }
  }
  const newItem = newMenus.getMenuItemById(id)
  newItem.checked = checked
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

export const updateLineEndingMenu = lineEnding => {
  const menus = Menu.getApplicationMenu()
  const crlfMenu = menus.getMenuItemById('crlfLineEndingMenuEntry')
  const lfMenu = menus.getMenuItemById('lfLineEndingMenuEntry')
  if (lineEnding === 'crlf') {
    crlfMenu.checked = true
  } else {
    lfMenu.checked = true
  }
}

export default AppMenu
