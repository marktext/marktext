import fs from 'fs'
import path from 'path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import keytar from 'keytar'
import schema from './schema.json'
import Store, { type Schema } from 'electron-store'
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
  private readonly _serviceName = 'marktext'
  private readonly _encryptKeys: string[] = []
  private readonly _defaults: Record<string, unknown>
  // Unavailable storage uses detached defaults without allowing writes to replace the original.
  private readonly _store: Store<Record<string, unknown>> | null = null

  constructor(paths: DataCenterPaths) {
    super()

    const { dataCenterPath, userDataPath } = paths
    this._defaults = {
      imageFolderPath: path.join(userDataPath, 'images'),
      screenshotFolderPath: path.join(userDataPath, 'screenshot'),
      webImages: [],
      cloudImages: [],
      currentUploader: 'picgo'
    }
    const hasDataCenterFile = fs.existsSync(path.join(dataCenterPath, `${DATA_CENTER_NAME}.json`))
    try {
      const store = new Store<Record<string, unknown>>({
        schema: schema as Schema<Record<string, unknown>>,
        name: DATA_CENTER_NAME,
        cwd: dataCenterPath,
        defaults: this._defaults
      })
      if (!hasDataCenterFile) {
        ensureDirSync(store.get('screenshotFolderPath') as string)
      } else {
        const uploader = store.get('currentUploader')
        if (uploader === 'none' || uploader === 'github') store.set('currentUploader', 'picgo')
      }
      this._store = store
    } catch (error) {
      log.error('DataCenter is unavailable; using read-only defaults', error)
    }
    this._listenForIpcMain()
  }

  async getAll(): Promise<Record<string, unknown>> {
    const data = structuredClone(this._store?.store ?? this._defaults)
    try {
      const encryptData = await Promise.all(
        this._encryptKeys.map((key) => {
          return keytar.getPassword(this._serviceName, key)
        })
      )
      const encryptObj = this._encryptKeys.reduce<Record<string, string | null>>((acc, k, i) => {
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

  addImage(key: string, url: string): void {
    if (!this._store) return
    const items = this._store.get(key) as Array<{ url: string; timeStamp: number }>
    const alreadyHas = items.some((item) => item.url === url)
    let item
    if (alreadyHas) {
      item = items.find((it) => it.url === url)
      if (item) item.timeStamp = +new Date()
    } else {
      item = { url, timeStamp: +new Date() }
      items.push(item)
    }

    this._store.set(key, items)
    ipcMain.emit('broadcast-web-image-added', { type: key, item })
  }

  removeImage(type: string, url: string): unknown {
    if (!this._store) return
    const items = this._store.get(type) as unknown[]
    const index = items.indexOf(url)
    const item = items[index]
    if (index === -1) return
    items.splice(index, 1)
    this._store.set(type, items)
    ipcMain.emit('broadcast-web-image-removed', { type, item })
  }

  getItem(key: string): Promise<unknown> {
    if (this._encryptKeys.includes(key)) {
      return keytar.getPassword(this._serviceName, key)
    } else {
      const value = this._store ? this._store.get(key) : structuredClone(this._defaults[key])
      return Promise.resolve(value)
    }
  }

  async setItem(key: string, value: unknown): Promise<void> {
    if (!this._store) {
      log.error('Cannot update read-only DataCenter storage')
      return
    }
    if (key === 'screenshotFolderPath') {
      ensureDirSync(value as string)
    }
    if (this._encryptKeys.includes(key)) {
      try {
        await keytar.setPassword(this._serviceName, key, value as string)
      } catch (err) {
        log.error('Keytar error:', err)
        return
      }
    } else {
      this._store.set(key, value)
    }
    ipcMain.emit('broadcast-user-data-changed', { [key]: value })
  }

  setItems(settings: Record<string, unknown>): void {
    if (!settings) {
      log.error('Cannot change settings without entires: object is undefined or null.')
      return
    }

    Object.keys(settings).forEach((key) => {
      void this.setItem(key, settings[key]).catch((error) =>
        log.error('Cannot update DataCenter', error)
      )
    })
  }

  private _listenForIpcMain(): void {
    ipcMain.on('set-image-folder-path', (newPath) => {
      this.setItem('imageFolderPath', newPath)
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

    ipcMain.on('mt::set-user-data', (_e, userData: Record<string, unknown>) => {
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
