import fs from 'fs'
import path from 'path'
import { ipcMain, BrowserWindow } from 'electron'
import { windows } from './createWindow'
import { getPath, hasSameKeys, log, ensureDir } from './utils'

const FILE_NAME = 'preference.md'
const staticPath = path.join(__static, FILE_NAME)
const userDataPath = path.join(getPath('userData'), FILE_NAME)

class Preference {
  constructor (staticPath, userDataPath) {
    this.cache = null
    this.staticPath = staticPath
    this.userDataPath = userDataPath

    this.init()
  }

  init () {
    // If the preference.md is not existed or can not load json from it.
    // Rebuild the preference.md
    let userSetting = null
    if (!fs.existsSync(userDataPath) || !this.loadJson(userDataPath)) {
      ensureDir(getPath('userData'))
      const content = fs.readFileSync(staticPath, 'utf-8')
      fs.writeFileSync(userDataPath, content, 'utf-8')
    } else {
      const defaultSettings = this.loadJson(staticPath)
      userSetting = this.loadJson(userDataPath)
      const requiresUpdate = !hasSameKeys(defaultSettings, userDataPath)
      if (requiresUpdate) {
        for (const key in userSetting) {
          if (userSetting.hasOwnProperty(key) && !defaultSettings.hasOwnProperty(key)) {
            delete userSetting[key]
          }
        }
        Object.assign(userSetting, defaultSettings)
        this.writeJson(userSetting, false)
          .catch(log)
      }
    }
    if (!userSetting) userSetting = this.loadJson(userDataPath)
    this.cache = userSetting
  }

  getAll () {
    return this.cache
  }

  setItem (key, value) {
    const preUserSetting = this.getAll()
    const newUserSetting = this.cache = Object.assign({}, preUserSetting, { [key]: value })
    return this.writeJson(newUserSetting)
  }

  loadJson (filePath) {
    const JSON_REG = /```json(.+)```/g
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const userSetting = JSON_REG.exec(content.replace(/\n/g, ''))[1]
      return JSON.parse(userSetting)
    } catch (err) {
      log(err)
      return null
    }
  }

  writeJson (json, async = true) {
    const { userDataPath } = this
    return new Promise((resolve, reject) => {
      const content = fs.readFileSync(userDataPath, 'utf-8')
      const tokens = content.split('```')
      const newContent = tokens[0] +
        '```json\n' +
        JSON.stringify(json, null, 2) +
        '\n```' +
        tokens[2]
      if (async) {
        fs.writeFile(userDataPath, newContent, 'utf-8', err => {
          if (err) reject(err)
          else resolve(json)
        })
      } else {
        fs.writeFileSync(userDataPath, newContent, 'utf-8')
        resolve(json)
      }
    })
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
