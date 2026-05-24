import fs from 'fs'
import path from 'path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import keytar from 'keytar'
import schema from './schema.json'
import Store from 'electron-store'
import log from 'electron-log'
import { ensureDirSync } from 'common/filesystem'
import { IMAGE_EXTENSIONS } from 'common/filesystem/paths'
import { TypedEmitter } from '@shared/types/typedEmitter'

const DATA_CENTER_NAME = 'dataCenter'

// No events emitted directly on `this`. ipcMain.emit is used for cross-
// process broadcasts but those don't fire through this instance.
type DataCenterEvents = Record<string, unknown[]>

interface DataCenterPaths {
  dataCenterPath: string
  userDataPath: string
}

class DataCenter extends TypedEmitter<DataCenterEvents> {
  dataCenterPath: string
  userDataPath: string
  serviceName: string
  encryptKeys: string[]
  hasDataCenterFile: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: Store<any>

  constructor(paths: DataCenterPaths) {
    super()

    const { dataCenterPath, userDataPath } = paths
    this.dataCenterPath = dataCenterPath
    this.userDataPath = userDataPath
    this.serviceName = 'marktext'
    this.encryptKeys = []
    this.hasDataCenterFile = fs.existsSync(
      path.join(this.dataCenterPath, `./${DATA_CENTER_NAME}.json`)
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.store = new Store<any>({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      schema: schema as any,
      name: DATA_CENTER_NAME
    })

    this.init()
  }

  init(): void {
    const defaultData = {
      imageFolderPath: path.join(this.userDataPath, 'images'),
      screenshotFolderPath: path.join(this.userDataPath, 'screenshot'),
      webImages: [],
      cloudImages: [],
      currentUploader: 'picgo'
    }

    if (!this.hasDataCenterFile) {
      this.store.set(defaultData)
      ensureDirSync(this.store.get('screenshotFolderPath') as string)
    } else {
      // Migrate legacy uploader values that no longer exist
      const stored = this.store.get('currentUploader') as string | undefined
      if (stored === 'none' || stored === 'github') {
        this.store.set('currentUploader', 'picgo')
      }
    }
    this._listenForIpcMain()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getAll(): Promise<Record<string, any>> {
    const { serviceName, encryptKeys } = this
    const data = this.store.store
    try {
      const encryptData = await Promise.all(
        encryptKeys.map((key) => {
          return keytar.getPassword(serviceName, key)
        })
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const encryptObj = encryptKeys.reduce<Record<string, any>>((acc, k, i) => {
        return {
          ...acc,
          [k]: encryptData[i]
        }
      }, {})

      return Object.assign(data, encryptObj)
    } catch (err) {
      log.error('Failed to decrypt secure keys:', err)
      return data
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addImage(key: string, url: string): any {
    const items = this.store.get(key) as Array<{ url: string; timeStamp: number }>
    const alreadyHas = items.some((item) => item.url === url)
    let item
    if (alreadyHas) {
      item = items.find((it) => it.url === url)
      if (item) item.timeStamp = +new Date()
    } else {
      item = { url, timeStamp: +new Date() }
      items.push(item)
    }

    ipcMain.emit('broadcast-web-image-added', { type: key, item })
    return this.store.set(key, items)
  }

  removeImage(type: string, url: string): unknown {
    const items = this.store.get(type) as unknown[]
    const index = items.indexOf(url)
    const item = items[index]
    if (index === -1) return
    items.splice(index, 1)
    ipcMain.emit('broadcast-web-image-removed', { type, item })
    return this.store.set(type, items)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getItem(key: string): Promise<any> | any {
    const { encryptKeys, serviceName } = this
    if (encryptKeys.includes(key)) {
      return keytar.getPassword(serviceName, key)
    } else {
      const value = this.store.get(key)
      return Promise.resolve(value)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async setItem(key: string, value: any): Promise<any> {
    const { encryptKeys, serviceName } = this
    if (key === 'screenshotFolderPath') {
      ensureDirSync(value as string)
    }
    ipcMain.emit('broadcast-user-data-changed', { [key]: value })
    if (encryptKeys.includes(key)) {
      try {
        return await keytar.setPassword(serviceName, key, value)
      } catch (err) {
        log.error('Keytar error:', err)
      }
    } else {
      return this.store.set(key, value)
    }
  }

  /**
   * Change multiple setting entries.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setItems(settings: Record<string, any>): void {
    if (!settings) {
      log.error('Cannot change settings without entires: object is undefined or null.')
      return
    }

    Object.keys(settings).forEach((key) => {
      this.setItem(key, settings[key])
    })
  }

  _listenForIpcMain(): void {
    ipcMain.on('set-image-folder-path', (newPath) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.setItem('imageFolderPath', newPath as any)
    })

    ipcMain.on('mt::ask-for-user-data', async(e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return
      const userData = await this.getAll()
      win.webContents.send('mt::user-preference', userData)
    })

    ipcMain.on('mt::ask-for-modify-image-folder-path', async(e, imagePath?: string) => {
      if (!imagePath) {
        const win = BrowserWindow.fromWebContents(e.sender)
        if (!win) return
        const { filePaths } = await dialog.showOpenDialog(win, {
          properties: ['openDirectory', 'createDirectory']
        })
        if (filePaths && filePaths[0]) {
          imagePath = filePaths[0]
        }
      }
      if (imagePath) {
        this.setItem('imageFolderPath', imagePath)
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcMain.on('mt::set-user-data', (_e, userData: Record<string, any>) => {
      this.setItems(userData)
    })

    ipcMain.handle('mt::ask-for-image-path', async(e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return ''
      const { filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [
          {
            name: 'Images',
            extensions: [...IMAGE_EXTENSIONS]
          }
        ]
      })

      if (filePaths && filePaths[0]) {
        return filePaths[0]
      } else {
        return ''
      }
    })
  }
}

export default DataCenter
