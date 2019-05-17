import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'
import { BrowserWindow, ipcMain, dialog } from 'electron'
import schema from './schema'
import Store from 'electron-store'
import { ensureDirSync } from '../filesystem'

const DATA_CENTER_NAME = 'dataCenter'

class DataCenter extends EventEmitter {
  constructor (paths) {
    super()

    const { dataCenterPath, userDataPath } = paths
    this.dataCenterPath = dataCenterPath
    this.userDataPath = userDataPath
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
      webImages: [],
      cloudImages: []
    }
    if (!this.hasDataCenterFile) {
      this.store.set(defaltData)
      const imageFolderPath = this.store.get('imageFolderPath')
      ensureDirSync(imageFolderPath)
    }

    this._listenForIpcMain()
  }

  getAll () {
    return this.store.store
  }

  changeImageFolderPath (newPath) {
    ipcMain.emit('broadcast-image-folder-path-changed', { path: newPath })
    this.store.set('imageFolderPath', newPath)
    ensureDirSync(newPath)
    return newPath
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

  getItem (key) {
    return this.store.get(key)
  }

  _listenForIpcMain () {
    // local main events
    ipcMain.on('set-image-folder-path', newPath => {
      this.changeImageFolderPath(newPath)
    })

    // events from renderer process
    ipcMain.on('mt::ask-for-image-folder-path', e => {
      const win = BrowserWindow.fromWebContents(e.sender)
      win.webContents.send('mt::image-folder-path', this.getItem('imageFolderPath'))
    })

    ipcMain.on('mt::ask-for-modify-image-folder-path', e => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const folder = dialog.showOpenDialog(win, {
        properties: [ 'openDirectory', 'createDirectory' ]
      })
      if (folder && folder[0]) {
        this.changeImageFolderPath(folder[0])
      }
    })
  }
}

export default DataCenter
