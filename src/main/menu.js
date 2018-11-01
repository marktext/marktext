import fs from 'fs'
import path from 'path'
import { Menu, app } from 'electron'
import configureMenu from './menus'
import { isFile, ensureDir, getPath, log } from './utils'

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
        .filter(f => f && isFile(f))

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
    windowMenus.set(window.id, this.buildDefaultMenu(window))

    //
    // TODO(#535): Copy `view` state from the current menu or rewrite parts of the editor because the editor
    //             opens a new file/window in source code mode if the previous mode was source code.
    //

    // TODO(fxha): Initialize ShortcutHandler and register shortcuts for the given window (GH project 6)
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
      console.error(`Cannot find window menu for id ${windowId}.`)
      log(`setActiveWindow: Cannot find window menu for id ${windowId}.`)

      // TODO(#535): Should we throw an exeption or return null?
      return null
    }
    return menu
  }

  setActiveWindow (windowId) {
    // Change application menu to the current window menu
    Menu.setApplicationMenu(this.getWindowMenuById(windowId))
    this.activeWindowId = windowId
  }

  buildDefaultMenu (window, recentUsedDocuments) {
    if (!recentUsedDocuments) {
      recentUsedDocuments = this.getRecentlyUsedDocuments()
    }

    // const menuTemplate = configureMenu(recentUsedDocuments)
    // #DEBUG
    let menuTemplate = configureMenu(recentUsedDocuments)
    menuTemplate.push({
      label: `Window id: ${window.id}`
    })
    // END #DEBUG
    const menu = Menu.buildFromTemplate(menuTemplate)

    let shortcutMap = null
    if (window) {
      // TODO(fxha): Build accelerator/function shortcut map from template (GH project 6)
    }

    return {
      shortcutMap, // reserved for shortcut fixes (GH project 6)
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
      // let { menu: newMenu } = this.buildDefaultMenu(null, recentUsedDocuments)
      const { menu: newMenu } = this.buildDefaultMenu({ id: key }, recentUsedDocuments) // #DEBUG show window id

      //
      // TODO(#535): Update menu checkboxes and radiobutton
      //

      // TODO(fxha): Update `shortcutMap` callback function  (GH project 6)

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

export default new AppMenu()
