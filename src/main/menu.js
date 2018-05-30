import fs from 'fs'
import path from 'path'
import { Menu, app } from 'electron'
import configureMenu, { dockMenu } from './menus'
import { isFile, ensureDir, getPath, log } from './utils'

class AppMenu {
  constructor () {
    const FILE_NAME = 'recently-used-documents.json'

    this.initMacDock = false
    this.MAX_RECENTLY_USED_DOCUMENTS = 12
    this.RECENTS_PATH = path.join(getPath('userData'), FILE_NAME)
    this.isOsxOrWindows = /darwin|win32/.test(process.platform)
    this.isOsx = process.platform === 'darwin'
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

  updateAppMenu (recentUsedDocuments) {
    const { initMacDock } = this

    if (!recentUsedDocuments) {
      recentUsedDocuments = this.getRecentlyUsedDocuments()
    }

    // "we don't support changing menu object after calling setMenu, the behavior
    // is undefined if user does that." That means we have to recreate the
    // application menu each time.

    const menu = Menu.buildFromTemplate(configureMenu(recentUsedDocuments))
    Menu.setApplicationMenu(menu)
    if (!initMacDock && process.platform === 'darwin') {
      // app.dock is only for macosx
      app.dock.setMenu(dockMenu)
    }
    this.initMacDock = true
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
}

export default new AppMenu()
