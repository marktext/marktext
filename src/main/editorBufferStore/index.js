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
    if (!fs.existsSync(this.editorBufferStorePath)) {
      fs.mkdirSync(this.editorBufferStorePath, { recursive: true })
    }
    this._listenForIpcMain()
  }

  getAll() {
    return this.getAllBufferStores()
  }

  getAllBufferStores() {
    if (!this.bufferStores) {
      this.bufferStores = this.findEditorBufferStores(this.editorBufferStorePath)
    }

    return this.bufferStores
  }

  handleClose(restoreBufferId, editorWindows) {
    // If > 1 window is present, and the window being closed has all files saved, we can delete its saved buffer
    // This allows the case where we want to actually close an extra window

    if (!restoreBufferId) {
      console.warn('No restoreBufferId found for window, skipping buffer cleanup')
      return
    }

    if (!(restoreBufferId in this.bufferStores)) {
      console.warn('No buffer store found for restoreBufferId, skipping buffer cleanup')
      return
    }

    if (editorWindows.length > 1) {
      // Check if all files in the buffer store are saved OR there are no more tabs opened
      if (!fs.existsSync(this.bufferStores[restoreBufferId].filePath)) {
        return
      }
      try {
        const buffer = JSON.parse(
          fs.readFileSync(this.bufferStores[restoreBufferId].filePath).toString()
        )
        const allSaved = buffer.tabs.every((file) => file.isSaved)
        if (buffer.tabs.length === 0 || allSaved) {
          // Delete the buffer store file
          fs.unlink(this.bufferStores[restoreBufferId].filePath, (err) => {
            if (err) {
              console.error('Failed to delete buffer store file', err)
            } else {
              delete this.bufferStores[restoreBufferId]
            }
          })
        }
      } catch (e) {
        console.error('Failed to read or parse buffer store file during cleanup', e)
      }
    }
  }

  findEditorBufferStores(dir) {
    const results = {}
    if (!fs.existsSync(dir)) {
      return results
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true })

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
        return
      }

      if (!this.bufferStores) {
        this.bufferStores = this.findEditorBufferStores(this.editorBufferStorePath)
      }

      if (!this.bufferStores[restoreBufferId]) {
        this.bufferStores[restoreBufferId] = {
          id: restoreBufferId,
          filePath: path.join(
            this.editorBufferStorePath,
            `${restoreBufferId}_editor_buffer_store.json`
          )
        }
      }

      fs.writeFileSync(this.bufferStores[restoreBufferId].filePath, JSON.stringify(newState))
    })
  }
}

export default EditorBufferStore
