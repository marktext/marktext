import fse from 'fs-extra'
import path from 'path'
import EventEmitter from 'events'
import Store from 'electron-store'
import { BrowserWindow, ipcMain, systemPreferences } from 'electron'
import log from 'electron-log'
import { isOsx, isWindows } from '../config'
import { hasSameKeys } from '../utils'
import { getStringRegKey, winHKEY } from '../platform/win32/registry.js'
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

const validate = settings => {
  // Currently no CSD is available on Linux and Windows (GH#690)
  const titleBarStyle = settings.titleBarStyle.toLowerCase()
  if (!isOsx && titleBarStyle === 'csd') {
    settings.titleBarStyle = 'custom'
  }
  return settings
}

const PREFERENCE_KEY = 'preference'

class Preference extends EventEmitter {

  /**
   * @param {AppPaths} userDataPath The path instance.
   */
  constructor (paths) {
    super()

    const { userDataPath } = paths
    this._userDataPath = userDataPath
    this.store = new Store({
      schema
    })

    this.staticPath = path.join(__static, 'preference.json')
    this.init()
  }

  init = () => {
    let defaultSettings = null
    try {
      defaultSettings = fse.readJsonSync(this.staticPath)
      if (isDarkSystemMode()) {
        defaultSettings.theme = 'dark'
      }
      defaultSettings = validate(defaultSettings)
    } catch (err) {
      log(err)
    }

    if (!defaultSettings) {
      console.error('Can not load static preference.json file')
      return
    }
    // first time user Mark Text
    if (!this.store.get(PREFERENCE_KEY)) {
      this.store.set(PREFERENCE_KEY, defaultSettings)
    } else {
      let userSetting = this.getAll()

      // Update outdated settings
      const requiresUpdate = !hasSameKeys(defaultSettings, userSetting)
      if (requiresUpdate) {
        // remove outdated settings
        for (const key in userSetting) {
          if (userSetting.hasOwnProperty(key) && !defaultSettings.hasOwnProperty(key)) {
            delete userSetting[key]
          }
        }
        // add new setting options
        for (const key in defaultSettings) {
          if (defaultSettings.hasOwnProperty(key) && !userSetting.hasOwnProperty(key)) {
            userSetting[key] = defaultSettings[key]
          }
        }
        userSetting = validate(userSetting)
        this.store.set(PREFERENCE_KEY, userSetting)
      }
    }

    this._listenForIpcMain()
  }

  getAll () {
    return this.store.get(PREFERENCE_KEY)
  }

  setItem (key, value) {
    ipcMain.emit('broadcast-preferences-changed', { [key]: value })
    key = key.startsWith('preference.') ? key : `preference.${key}`
    return this.store.set(key, value)
  }

  getItem (key) {
    key = key.startsWith('preference.') ? key : `preference.${key}`
    return this.store.get(key)
  }

  /**
   * Change multiple setting entries.
   *
   * @param {Object.<string, *>} settings A settings object or subset object with key/value entries.
   */
  setItems (settings) {
    if (!settings) {
      log.error('Cannot change settings without entires: object is undefined or null.')
      return
    }

    Object.keys(settings).map(key => {
      this.setItem(key, settings[key])
    })
  }

  getPreferedEOL () {
    const endOfLine = this.getItem('endOfLine')
    if (endOfLine === 'lf') {
      return 'lf'
    }
    return endOfLine === 'crlf' || isWindows ? 'crlf' : 'lf'
  }

  exportJSON () {
    // todo
  }

  importJSON () {
    // todo
  }

  _listenForIpcMain () {
    ipcMain.on('mt::ask-for-user-preference', e => {
      const win = BrowserWindow.fromWebContents(e.sender)
      win.webContents.send('AGANI::user-preference', this.getAll())
    })

    ipcMain.on('mt::set-user-preference', (e, settings) => {
      this.setItems(settings)
    })
  }
}

export default Preference
