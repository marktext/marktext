import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'
import { BrowserWindow, ipcMain, systemPreferences } from 'electron'
import log from 'electron-log'
import { isOsx, isWindows } from '../config'
import { ensureDirSync } from '../filesystem'
import { hasSameKeys } from '../utils'
import { getStringRegKey, winHKEY } from '../platform/win32/registry.js'

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

class Preference extends EventEmitter {

  /**
   * @param {AppPaths} userDataPath The path instance.
   */
  constructor (paths) {
    super()

    const { userDataPath, preferencesFilePath } = paths
    this._userDataPath = userDataPath

    this.cache = null
    this.staticPath = path.join(__static, 'preference.md')
    this.settingsPath = preferencesFilePath
    this.init()
  }

  init () {
    const { settingsPath, staticPath } = this
    const defaultSettings = this.loadJson(staticPath)
    let userSetting = null

    // Try to load settings or write default settings if file doesn't exists.
    if (!fs.existsSync(settingsPath) || !this.loadJson(settingsPath)) {
      ensureDirSync(this._userDataPath)
      const content = fs.readFileSync(staticPath, 'utf-8')
      fs.writeFileSync(settingsPath, content, 'utf-8')

      userSetting = this.loadJson(settingsPath)
      if (isDarkSystemMode()) {
        userSetting.theme = 'dark'
      }
      this.validateSettings(userSetting)
    } else {
      userSetting = this.loadJson(settingsPath)

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
        this.validateSettings(userSetting)
        this.writeJson(userSetting, false)
          .catch(log.error)
      } else {
        this.validateSettings(userSetting)
      }
    }

    if (!userSetting) {
      console.error('ERROR: Cannot load settings.')
      userSetting = defaultSettings
      this.validateSettings(userSetting)
    }

    this.cache = userSetting
    this.emit('loaded', userSetting)

    this._listenForIpcMain()
  }

  getAll () {
    return this.cache
  }

  setItem (key, value) {
    const preUserSetting = this.getAll()
    const newUserSetting = this.cache = Object.assign({}, preUserSetting, { [key]: value })
    this.emit('entry-changed', key, value)
    return this.writeJson(newUserSetting)
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

    const preUserSetting = this.getAll()
    const newUserSetting = this.cache = Object.assign({}, preUserSetting, settings)

    Object.keys(settings).map(key => {
      this.emit('entry-changed', key, settings[key])
    })

    return this.writeJson(newUserSetting)
  }

  loadJson (filePath) {
    const JSON_REG = /```json(.+)```/g
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const userSetting = JSON_REG.exec(content.replace(/(?:\r\n|\n)/g, ''))[1]
      return JSON.parse(userSetting)
    } catch (err) {
      log.error(err)
      return null
    }
  }

  writeJson (json, async = true) {
    const { settingsPath } = this
    return new Promise((resolve, reject) => {
      const content = fs.readFileSync(this.staticPath, 'utf-8')
      const tokens = content.split('```')
      const newContent = tokens[0] +
        '```json\n' +
        JSON.stringify(json, null, 2) +
        '\n```' +
        tokens[2]
      if (async) {
        fs.writeFile(settingsPath, newContent, 'utf-8', err => {
          if (err) reject(err)
          else resolve(json)
        })
      } else {
        fs.writeFileSync(settingsPath, newContent, 'utf-8')
        resolve(json)
      }
    })
  }

  getPreferedEOL () {
    const { endOfLine } = this.getAll()
    if (endOfLine === 'lf') {
      return 'lf'
    }
    return endOfLine === 'crlf' || isWindows ? 'crlf' : 'lf'
  }

  /**
   * workaround for issue #265
   *   expects: settings != null
   * @param  {Object} settings preferences object
   */
  validateSettings (settings) {
    if (!settings) {
      log.warn('Broken settings detected: invalid settings object.')
      return
    }

    let brokenSettings = false
    if (!settings.theme || (settings.theme && !/^(?:dark|graphite|material-dark|one-dark|light|ulysses)$/.test(settings.theme))) {
      brokenSettings = true
      settings.theme = 'light'
    }

    if (!settings.codeFontFamily || typeof settings.codeFontFamily !== 'string' || settings.codeFontFamily.length > 60) {
      settings.codeFontFamily = 'DejaVu Sans Mono'
    }
    if (!settings.codeFontSize || typeof settings.codeFontSize !== 'string' || settings.codeFontFamily.length > 10) {
      settings.codeFontSize = '14px'
    }

    if (!settings.endOfLine || !/^(?:lf|crlf)$/.test(settings.endOfLine)) {
      settings.endOfLine = isWindows ? 'crlf' : 'lf'
    }

    if (!settings.bulletListMarker ||
      (settings.bulletListMarker && !/^(?:\+|-|\*)$/.test(settings.bulletListMarker))) {
      brokenSettings = true
      settings.bulletListMarker = '-'
    }

    if (!settings.titleBarStyle || !/^(?:native|csd|custom)$/.test(settings.titleBarStyle)) {
      settings.titleBarStyle = 'csd'
    }

    if (!settings.tabSize || typeof settings.tabSize !== 'number') {
      settings.tabSize = 4
    } else if (settings.tabSize < 1) {
      settings.tabSize = 1
    } else if (settings.tabSize > 4) {
      settings.tabSize = 4
    }

    if (!settings.listIndentation) {
      settings.listIndentation = 1
    } else if (typeof settings.listIndentation === 'number') {
      if (settings.listIndentation < 1 || settings.listIndentation > 4) {
        settings.listIndentation = 1
      }
    } else if (settings.listIndentation !== 'dfm') {
      settings.listIndentation = 1
    }

    if (brokenSettings) {
      log.warn('Broken settings detected; fallback to default value(s).')
    }

    // Currently no CSD is available on Linux and Windows (GH#690)
    const titleBarStyle = settings.titleBarStyle.toLowerCase()
    if (!isOsx && titleBarStyle === 'csd') {
      settings.titleBarStyle = 'custom'
    }
  }

  _listenForIpcMain () {
    ipcMain.on('mt::ask-for-user-preference', e => {
      const win = BrowserWindow.fromWebContents(e.sender)
      win.webContents.send('AGANI::user-preference', this.getAll())
    })

    ipcMain.on('mt::set-user-preference', (e, settings) => {
      this.setItems(settings).then(() => {
        ipcMain.emit('broadcast-preferences-changed', settings)
      }).catch(log.error)
    })
  }
}

export default Preference
