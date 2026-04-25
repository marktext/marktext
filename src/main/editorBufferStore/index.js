import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'
import { BrowserWindow, ipcMain } from 'electron'
class EditorBufferStore extends EventEmitter {
  constructor(paths) {
    super()

    const { editorBufferStorePath } = paths
    this.editorBufferStorePath = editorBufferStorePath
    this.bufferStores = null // This is an object of paths to buffer stores, buffer stores are NOT stored in memory for performance reasons, they are read from disk when needed and written to disk when updated
    this.serviceName = 'marktext'
    this.encryptKeys = ['githubToken']

    this.init()
  }

  init() {
    this._listenForIpcMain()
  }

  getAllBufferStores() {
    if (!this.bufferStores) {
      this.bufferStores = this.findEditorBufferStores(this.editorBufferStorePath)
    }

    return this.bufferStores
  }

  findEditorBufferStores(dir) {
    const results = {}
    const entries = fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isFile() && entry.name.endsWith('_editor_buffer_store.json')) {
        const id = entry.name.replace('_editor_buffer_store.json', '')
        results[id] = {
          id, // Add the id to the buffer store data for easier access later (in Editor)
          filePath: fullPath
        }
      }
    }

    return results
  }

  _listenForIpcMain() {
    // local main events
    ipcMain.on('update-buffer-state', (e, newState) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      const restoreBufferId = win?.restoreBufferId

      if (!restoreBufferId) {
        console.warn('No restoreBufferId found for window, skipping buffer state update')
      }

      fs.writeFile(this.bufferStores[restoreBufferId].filePath, JSON.stringify(newState), (err) => {
        if (err) {
          console.error('Failed to write buffer state to file', err)
        } else {
          console.log('Buffer state updated successfully')
        }
      })
    })
  }
}

export default EditorBufferStore
