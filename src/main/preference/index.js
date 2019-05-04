import fse from 'fs-extra'
import path from 'path'
import Store from 'electron-store'
import { ipcMain, BrowserWindow, systemPreferences } from 'electron'
import { isOsx, isWindows } from './config'
import { hasSameKeys, log } from './utils'
import { getStringRegKey, winHKEY } from './platform/win32/registry.js'
import schema from './schema'

const isDarkSystemMode = () => {
  if (isOsx) {
    return systemPreferences.isDarkMode()
  } else if (isWindows) {
    // NOTE: This key is a 32-Bit DWORD but converted to JS string!
    const buf = getStringRegKey(winHKEY.HKCU, 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', 'AppsUseLightTheme')
    return buf === '' // zero (0)
  }
  return false
}

const validate = setting => {
  // Currently no CSD is available on Linux and Windows (GH#690)
  const titleBarStyle = settings.general.titleBarStyle.toLowerCase()
  if (!isOsx && titleBarStyle === 'csd') {
    settings.titleBarStyle = 'custom'
  }
  return setting
}

const PREFERENCE_KEY = 'preference'

// use for store user preference and user data like image folder, upload config etc.
class Preference {
  constructor (mtApp) {
    const FILE_NAME = 'preference.json'
    this.mtApp = mtApp
    this.store = new Store({
      schema
    })
    this.defautPath = path.join(__static, FILE_NAME)
  }

  init = async () => {
    let defaultSetting = null
    try {
      defaultSetting = await fse.readJSON(this.defautPath)
      if (isDarkSystemMode()) {
        defaultSetting.theme = 'dark'
      }
      defaultSetting = validate(defaultSetting)
    } catch (err) {
      log(err)
    }
    if (!defaultSetting) return
    // first time user Mark Text
    if (!this.store.get(PREFERENCE_KEY)) {
      this.store.set(PREFERENCE_KEY, defaultSetting)
    } else {
      const userSetting = this.getAll()

      // Update outdated settings
      const requiresUpdate = !hasSameKeys(defaultSettings, userSetting)
      if (requiresUpdate) {
        // remove outdated settings
        for (const key in userSetting) {
          if (typeof userSetting[key] === 'object') {
            for (const innerKey of Object.keys(userSetting[key])) {
              if (userSetting[key].hasOwnProperty(innerKey) && !defaultSetting[key].hasOwnProperty(innerKey)) {
                delete userSetting[key][innerKey]
              }
            }
          } else {
            if (userSetting.hasOwnProperty(key) && !defaultSettings.hasOwnProperty(key)) {
              delete userSetting[key]
            }
          }
        }
        // add new setting options
        for (const key in defaultSettings) {
          if (defaultSettings.hasOwnProperty(key) && !userSetting.hasOwnProperty(key)) {
            userSetting[key] = defaultSettings[key]
          }
          if (typeof defaultSetting[key] === 'object') {
            for (const innerKey of Object.keys(defaultSetting[key])) {
              if (!userSetting[key].hasOwnProperty(innerKey) && defaultSetting[key].hasOwnProperty(innerKey)) {
                userSetting[key][innerKey] = defaultSetting[key][innerKey]
              }
            }
          }
        }
        userSetting = validate(userSetting)
        this.store.set(PREFERENCE_KEY, userSetting)
      }
    }
  }

  listen () {
    ipcMain.on('AGANI::ask-for-user-preference', e => {
      const win = BrowserWindow.fromWebContents(e.sender)
      win.webContents.send('AGANI::user-preference', this.getAll())
    })
    
    ipcMain.on('AGANI::set-user-preference', (e, pre) => {
      Object.keys(pre).map(key => {
        this.setItem(key, pre[key])
          .then(() => {
            for (const { win } of this.app.appWindow.windows.values()) {
              win.webContents.send('AGANI::user-preference', { [key]: pre[key] })
            }
          })
          .catch(log)
      })
    })
  }

  getAll () {
    return this.store.get(PREFERENCE_KEY)
  }

  getItem (key) {
    return this.store.get(key)
  }

  setItem (key, value) {
    return this.store.set(key, value)
  }

  subscribe (key, cb) {
    this.store.onDidChange(key, cb)
  }

  exportJSON () {
    // todo
  }

  importJSON () {
    // todo
  }
}

export default Preference
