import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import keytar from 'keytar'
import schema from './schema'
import Store from 'electron-store'
import log from 'electron-log'
import { ensureDirSync } from 'common/filesystem'
import { IMAGE_EXTENSIONS } from 'common/filesystem/paths'
import crypto from 'crypto'

const EDITOR_BUFFER_STORE = `${process.pid}-${crypto.randomUUID()}_editor_buffer_store`

class EditorBufferStore extends EventEmitter {
  constructor(paths) {
    super()

    const { editorBufferStorePath } = paths
    this.editorBufferStorePath = editorBufferStorePath
    this.serviceName = 'marktext'
    this.encryptKeys = ['githubToken']
    this.store = new Store({
      schema: {},
      name: EDITOR_BUFFER_STORE
    })

    this.init()
  }

  init() {
    // Need to check for any number of data centre files and restore appropriate windows
    const bufferStores = this.findEditorBufferStores(this.editorBufferStorePath)

    // Launch 1 window per buffer store file found - this restore process needs a lot of work

    this._listenForIpcMain()
  }

  findEditorBufferStores(dir) {
    const results = []
    const entries = fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isFile() && entry.name.endsWith('_editor_buffer_store.json')) {
        results.push(fullPath)
      }
    }

    return results
  }

  _listenForIpcMain() {
    // local main events
    ipcMain.on('set-image-folder-path', (newPath) => {
      this.setItem('imageFolderPath', newPath)
    })

    // events from renderer process
    ipcMain.on('mt::ask-for-user-data', async (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const userData = await this.getAll()
      win.webContents.send('mt::user-preference', userData)
    })

    ipcMain.on('mt::ask-for-modify-image-folder-path', async (e, imagePath) => {
      if (!imagePath) {
        const win = BrowserWindow.fromWebContents(e.sender)
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

    ipcMain.on('mt::set-user-data', (e, userData) => {
      this.setItems(userData)
    })

    // TODO: Replace sync. call.
    ipcMain.on('mt::ask-for-image-path', async (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const { filePaths } = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [
          {
            name: 'Images',
            extensions: IMAGE_EXTENSIONS
          }
        ]
      })

      if (filePaths && filePaths[0]) {
        e.returnValue = filePaths[0]
      } else {
        e.returnValue = ''
      }
    })
  }
}

export default EditorBufferStore
