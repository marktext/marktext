import fs from 'fs'
import path from 'path'
import { app, Menu } from 'electron'
import configureMenu, { dockMenu } from './menus'
import { isFile, ensureDir, getPath, log } from './utils'

const MAX_RECENTLY_USED_DOCUMENTS = 12
const FILE_NAME = 'recently-used-documents.json'
const recentlyUsedDocumentsPath = path.join(getPath('userData'), FILE_NAME)
const isOsxOrWindows = /darwin|win32/.test(process.platform)
let initMacDock = false

export const addRecentlyUsedDocuments = filePath => {
  if (isOsxOrWindows) app.addRecentDocument(filePath)
  if (process.platform === 'darwin') return

  let recentDocuments = getRecentlyUsedDocuments()
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

  updateApplicationMenu(recentDocuments)

  if (needSave) {
    ensureDir(getPath('userData'))
    const json = JSON.stringify(recentDocuments, null, 2)
    fs.writeFileSync(recentlyUsedDocumentsPath, json, 'utf-8')
  }
}

export const clearRecentlyUsedDocuments = () => {
  if (isOsxOrWindows) app.clearRecentDocuments()
  if (process.platform === 'darwin') return

  const recentDocuments = []
  updateApplicationMenu(recentDocuments)
  const json = JSON.stringify(recentDocuments, null, 2)
  ensureDir(getPath('userData'))
  fs.writeFileSync(recentlyUsedDocumentsPath, json, 'utf-8')
}

export const getRecentlyUsedDocuments = () => {
  if (!isFile(recentlyUsedDocumentsPath)) {
    return []
  }

  try {
    let recentDocuments = JSON.parse(fs.readFileSync(recentlyUsedDocumentsPath, 'utf-8'))
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

export const updateApplicationMenu = (recentUsedDocuments) => {
  if (!recentUsedDocuments) {
    recentUsedDocuments = getRecentlyUsedDocuments()
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
  initMacDock = true
}
