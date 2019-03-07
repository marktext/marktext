import fs from 'fs'
import path from 'path'
import { app, ipcMain, Menu } from 'electron'
import configureMenu from './menus'
import { isDirectory, isFile, ensureDir, getPath, log } from './utils'
import { parseMenu, registerKeyHandler } from './shortcutHandler'

class AppMenu {
  constructor () {
    const FILE_NAME = 'recently-used-documents.json'

    this.MAX_RECENTLY_USED_DOCUMENTS = 12
    this.RECENTS_PATH = path.join(getPath('userData'), FILE_NAME)
    this.isOsxOrWindows = /darwin|win32/.test(process.platform)
    this.isOsx = process.platform === 'darwin'
    this.activeWindowId = -1
    this.windowMenus = new Map()
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
      ensureDir(getPath('userData'))
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
      log(err)
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
    ensureDir(getPath('userData'))
    fs.writeFileSync(RECENTS_PATH, json, 'utf-8')
  }

  addWindowMenuWithListener (window) {
    const { windowMenus } = this
    windowMenus.set(window.id, this.buildDefaultMenu(true))

    const { menu, shortcutMap } = windowMenus.get(window.id)
    const currentMenu = Menu.getApplicationMenu() // the menu may be null
    updateMenuItemSafe(currentMenu, menu, 'sourceCodeModeMenuItem', false)
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
    registerKeyHandler(window, shortcutMap)
  }

  removeWindowMenu (windowId) {
    // NOTE: Shortcut handler is automatically unregistered
    const { activeWindowId } = this
    this.windowMenus.delete(windowId)
    if (activeWindowId === windowId) {
      this.activeWindowId = -1
    }
  }

  getWindowMenuById (windowId) {
    const { menu } = this.windowMenus.get(windowId)
    if (!menu) {
      log(`getWindowMenuById: Cannot find window menu for id ${windowId}.`)
      throw new Error(`Cannot find window menu for id ${windowId}.`)
    }
    return menu
  }

  setActiveWindow (windowId) {
    // change application menu to the current window menu
    Menu.setApplicationMenu(this.getWindowMenuById(windowId))
    this.activeWindowId = windowId
  }

  buildDefaultMenu (createShortcutMap, recentUsedDocuments) {
    if (!recentUsedDocuments) {
      recentUsedDocuments = this.getRecentlyUsedDocuments()
    }

    const menuTemplate = configureMenu(recentUsedDocuments)
    const menu = Menu.buildFromTemplate(menuTemplate)

    let shortcutMap = null
    if (createShortcutMap) {
      shortcutMap = parseMenu(menuTemplate)
    }

    return {
      shortcutMap,
      menu
    }
  }

  updateAppMenu (recentUsedDocuments) {
    if (!recentUsedDocuments) {
      recentUsedDocuments = this.getRecentlyUsedDocuments()
    }

    // "we don't support changing menu object after calling setMenu, the behavior
    // is undefined if user does that." That means we have to recreate the
    // application menu each time.

    // rebuild all window menus
    this.windowMenus.forEach((value, key) => {
      const { menu: oldMenu } = value
      const { menu: newMenu } = this.buildDefaultMenu(false, recentUsedDocuments)

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
        Menu.setApplicationMenu(newMenu)
      }
    })
  }

  updateLineEndingnMenu (lineEnding) {
    const menus = Menu.getApplicationMenu()
    const crlfMenu = menus.getMenuItemById('crlfLineEndingMenuEntry')
    const lfMenu = menus.getMenuItemById('lfLineEndingMenuEntry')
    if (lineEnding === 'crlf') {
      crlfMenu.checked = true
    } else {
      lfMenu.checked = true
    }
  }

  updateTextDirectionMenu (textDirection) {
    const menus = Menu.getApplicationMenu()
    const ltrMenu = menus.getMenuItemById('textDirectionLTRMenuEntry')
    const rtlMenu = menus.getMenuItemById('textDirectionRTLMenuEntry')
    if (textDirection === 'ltr') {
      ltrMenu.checked = true
    } else {
      rtlMenu.checked = true
    }
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

const appMenu = new AppMenu()

ipcMain.on('AGANI::add-recently-used-document', (e, pathname) => {
  appMenu.addRecentlyUsedDocument(pathname)
})

export default appMenu
