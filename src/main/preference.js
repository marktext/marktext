import fs from 'fs'
import path from 'path'
import { ipcMain, BrowserWindow } from 'electron'
import { windows } from './createWindow'
import { getPath, hasSameKeys, log, mkdir } from './utils'

const FILE_NAME = 'preference.md'
const staticPath = path.join(__static, FILE_NAME)
const userDataPath = path.join(getPath('userData'), FILE_NAME)

class Preference {
  constructor (staticPath, userDataPath) {
    this.cache = null
    this.staticPath = staticPath
    this.userDataPath = userDataPath
    this.requiresUpdate = false

    if (!fs.existsSync(userDataPath)) {
      mkdir(getPath('userData'))
      const content = fs.readFileSync(staticPath, 'utf-8')
      fs.writeFileSync(userDataPath, content, 'utf-8')
    } else {
      // load settings into cache
      this.getAll()

      // if needed update settings to latest version
      this.update()
    }
  }

  getAll () {
    const { cache } = this
    if (cache) {
      return cache
    } else {
      const defaultSettings = this.loadJson(staticPath)
      const userSettings = this.loadJson(userDataPath)
      if (userSettings) {
        // combine latest settings with user settings
        this.cache = Object.assign({}, defaultSettings, userSettings)
        // check if we have to update user settings
        this.requiresUpdate = !hasSameKeys(defaultSettings, userSettings)
        return this.cache
      }
      return defaultSettings
    }
  }

  setItem (key, value) {
    const { userDataPath } = this
    const preUserSetting = this.getAll()
    const newUserSetting = this.cache = Object.assign({}, preUserSetting, { [key]: value })

    return new Promise((resolve, reject) => {
      const content = fs.readFileSync(userDataPath, 'utf-8')
      const tokens = content.split('```')
      const newContent = tokens[0] +
        '```json\n' +
        JSON.stringify(newUserSetting, null, 2) +
        '\n```' +
        tokens[2]
      fs.writeFile(userDataPath, newContent, 'utf-8', err => {
        if (err) reject(err)
        else resolve(newUserSetting)
      })
    })
  }

  update () {
    if (this.requiresUpdate) {
      this.requiresUpdate = false

      // check if there are keys to remove
      const defaultSettings = this.loadJson(staticPath)
      Object.keys(this.cache).map(key => {
        if (typeof defaultSettings[key] === 'undefined') {
          delete this.cache[key]
        }
      })

      // write latest settings to filesystem. 'setItem' will rewrite complete user settings.
      const userSettings = this.getAll()
      this.setItem('theme', userSettings.theme)
    }
  }

  loadJson (filePath) {
    const JSON_REG = /```json(.+)```/g
    const content = fs.readFileSync(filePath, 'utf-8')
    try {
      const userSetting = JSON_REG.exec(content.replace(/\n/g, ''))[1]
      return JSON.parse(userSetting)
    } catch (err) {
      log(err)
      return null
    }
  }
}

const preference = new Preference(staticPath, userDataPath)

ipcMain.on('AGANI::ask-for-user-preference', e => {
  const win = BrowserWindow.fromWebContents(e.sender)
  win.webContents.send('AGANI::user-preference', preference.getAll())
})

ipcMain.on('AGANI::set-user-preference', (e, pre) => {
  Object.keys(pre).map(key => {
    preference.setItem(key, pre[key])
      .then(() => {
        for (const win of windows.values()) {
          win.webContents.send('AGANI::user-preference', { [key]: pre[key] })
        }
      })
      .catch(log)
  })
})

export default preference
