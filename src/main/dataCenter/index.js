import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'
import { BrowserWindow, ipcMain, dialog } from 'electron'
import keytar from 'keytar'
import schema from './schema'
import Store from 'electron-store'
import log from 'electron-log'
import { ensureDirSync } from 'common/filesystem'
import { IMAGE_EXTENSIONS } from 'common/filesystem/paths'

const DATA_CENTER_NAME = 'dataCenter'

class DataCenter extends EventEmitter {
  constructor (paths) {
    super()

    const { dataCenterPath, userDataPath } = paths
    this.dataCenterPath = dataCenterPath
    this.userDataPath = userDataPath
    this.serviceName = 'marktext'
    this.encryptKeys = ['githubToken']
    this.hasDataCenterFile = fs.existsSync(path.join(this.dataCenterPath, `./${DATA_CENTER_NAME}.json`))
    this.store = new Store({
      schema,
      name: DATA_CENTER_NAME
    })

    this.init()
  }
  init () {
    const defaltData = {
      imageFolderPath: path.join(this.userDataPath, 'images/'),
      screenshotFolderPath: path.join(this.userDataPath, 'screenshot/'),
      webImages: [],
      cloudImages: [],
      currentUploader: 'smms',
      imageBed: {
        github: {
          owner: '',
          repo: ''
        }
      }
    }
    if (!this.hasDataCenterFile) {
      this.store.set(defaltData)
      const imageFolderPath = this.store.get('imageFolderPath')
      const screenshotFolderPath = this.store.get('screenshotFolderPath')
      ensureDirSync(imageFolderPath)
      ensureDirSync(screenshotFolderPath)
    }

    this._listenForIpcMain()
  }

  async getAll () {
    const { serviceName, encryptKeys } = this
    const data = this.store.store
    try {
      const encryptData = await Promise.all(encryptKeys.map(key => {
        return keytar.getPassword(serviceName, key)
      }))
      const encryptObj = encryptKeys.reduce((acc, k, i) => {
        return {
          ...acc,
          [k]: encryptData[i]
        }
      }, {})

      return Object.assign(data, encryptObj)
    } catch (err) {
      log.error(err)
      return data
    }
  }

  addImage (key, url) {
    const items = this.store.get(key)
    const alreadyHas = items.some(item => item.url === url)
    let item
    if (alreadyHas) {
      item = items.find(item => item.url === url)
      item.timeStamp = +new Date()
    } else {
      item = {
        url,
        timeStamp: +new Date()
      }
      items.push(item)
    }

    ipcMain.emit('broadcast-web-image-added', { type: key, item })
    return this.store.set(key, items)
  }

  removeImage (type, url) {
    const items = this.store.get(type)
    const index = items.indexOf(url)
    const item = items[index]
    if (index === -1) return
    items.splice(index, 1)
    ipcMain.emit('broadcast-web-image-removed', { type, item })
    return this.store.set(type, items)
  }

  /**
   *
   * @param {string} key
   * return a promise
   */
  getItem (key) {
    const { encryptKeys, serviceName } = this
    if (encryptKeys.includes(key)) {
      return keytar.getPassword(serviceName, key)
    } else {
      const value = this.store.get(key)
      return Promise.resolve(value)
    }
  }

  async setItem (key, value) {
    const { encryptKeys, serviceName } = this
    if (
      key === 'imageFolderPath' ||
      key === 'screenshotFolderPath'
    ) {
      ensureDirSync(value)
    }
    ipcMain.emit('broadcast-user-data-changed', { [key]: value })
    if (encryptKeys.includes(key)) {
      try {
        return await keytar.setPassword(serviceName, key, value)
      } catch (err) {
        log.error(err)
      }
    } else {
      return this.store.set(key, value)
    }
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

  _listenForIpcMain () {
    // local main events
    ipcMain.on('set-image-folder-path', newPath => {
      this.setItem('imageFolderPath', newPath)
    })

    // events from renderer process
    ipcMain.on('mt::ask-for-user-data', async e => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const userData = await this.getAll()
      win.webContents.send('AGANI::user-preference', userData)
    })

    ipcMain.on('mt::ask-for-modify-image-folder-path', e => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const folder = dialog.showOpenDialog(win, {
        properties: [ 'openDirectory', 'createDirectory' ]
      })
      if (folder && folder[0]) {
        this.setItem('imageFolderPath', folder[0])
      }
    })

    ipcMain.on('mt::set-user-data', (e, userData) =>{
      this.setItems(userData)
    })

    ipcMain.on('mt::ask-for-image-path', e => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const files = dialog.showOpenDialog(win, {
        properties: [ 'openFile' ],
        filters: [{
          name: 'Images',
          extensions: IMAGE_EXTENSIONS
        }]
      })
      if (files && files[0]) {
        e.returnValue = files[0]
      } else {
        e.returnValue = ''
      }
    })
  }
}

export default DataCenter
