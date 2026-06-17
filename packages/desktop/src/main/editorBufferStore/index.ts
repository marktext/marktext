import fs from 'fs'
import path from 'path'
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { TypedEmitter } from '@shared/types/typedEmitter'
import type BaseWindow from '../windows/base'

interface EditorBufferStorePaths {
  editorBufferStorePath: string
}

interface BufferStoreEntry {
  id: string
  filePath: string
}

interface BufferStoreContent {
  tabs: Array<{ isSaved: boolean; [key: string]: unknown }>
  [key: string]: unknown
}

interface EditorWindow {
  id: number
  win: BaseWindow
}

// No instance-level events emitted; kept as TypedEmitter for parity with the
// other main classes.
type EditorBufferStoreEvents = Record<string, unknown[]>

class EditorBufferStore extends TypedEmitter<EditorBufferStoreEvents> {
  editorBufferStorePath: string
  bufferStores: Record<string, BufferStoreEntry> | null
  serviceName: string
  encryptKeys: string[]
  writeSequence: number

  constructor(paths: EditorBufferStorePaths) {
    super()

    const { editorBufferStorePath } = paths
    this.editorBufferStorePath = editorBufferStorePath
    // Object of paths to buffer stores. Buffer stores are NOT held in memory
    // for performance reasons — they are read from disk when needed and
    // written to disk when updated.
    this.bufferStores = null
    this.serviceName = 'marktext'
    this.encryptKeys = []
    this.writeSequence = 0

    this.init()
  }

  init(): void {
    if (!fs.existsSync(this.editorBufferStorePath)) {
      fs.mkdirSync(this.editorBufferStorePath, { recursive: true })
    }
    this._listenForIpcMain()
  }

  getAll(): Record<string, BufferStoreEntry> {
    return this.getAllBufferStores()
  }

  getAllBufferStores(): Record<string, BufferStoreEntry> {
    if (!this.bufferStores) {
      this.bufferStores = this.findEditorBufferStores(this.editorBufferStorePath)
    }

    return this.bufferStores
  }

  clearBufferStoresWithAllSaved(): void {
    this.bufferStores = this.getAllBufferStores()

    for (const id in this.bufferStores) {
      try {
        const buffer = this.readBufferStoreFile(this.bufferStores[id].filePath)
        const allSaved = buffer.tabs.every((file) => file.isSaved)
        if (buffer.tabs.length === 0 || allSaved) {
          try {
            fs.unlinkSync(this.bufferStores[id].filePath)
          } catch (e) {
            console.error('Failed to delete buffer store file during clear', e)
          }
        }
      } catch (e) {
        console.error('Failed to read buffer store file during clear', e)
      }
    }
  }

  handleClose(restoreBufferId: string | undefined, editorWindows: EditorWindow[]): void {
    // If > 1 window is present, and the window being closed has all files
    // saved, we can delete its saved buffer.

    if (!restoreBufferId) {
      console.warn('No restoreBufferId found for window, skipping buffer cleanup')
      return
    }

    if (!this.bufferStores) {
      this.bufferStores = this.findEditorBufferStores(this.editorBufferStorePath)
    }

    if (!(restoreBufferId in this.bufferStores)) {
      console.warn('No buffer store found for restoreBufferId, skipping buffer cleanup')
      return
    }

    if (editorWindows.length > 1) {
      if (!fs.existsSync(this.bufferStores[restoreBufferId].filePath)) {
        return
      }
      try {
        const buffer = this.readBufferStoreFile(this.bufferStores[restoreBufferId].filePath)
        const allSaved = buffer.tabs.every((file) => file.isSaved)
        if (buffer.tabs.length === 0 || allSaved) {
          fs.unlinkSync(this.bufferStores[restoreBufferId].filePath)
          delete this.bufferStores[restoreBufferId]
        }
      } catch (e) {
        console.error('Failed to read or parse buffer store file during cleanup', e)
      }
    }
  }

  findEditorBufferStores(dir: string): Record<string, BufferStoreEntry> {
    const results: Record<string, BufferStoreEntry> = {}
    if (!fs.existsSync(dir)) {
      return results
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isFile() && entry.name.endsWith('_editor_buffer_store.json')) {
        const id = entry.name.replace('_editor_buffer_store.json', '')
        results[id] = { id, filePath: fullPath }
      }
    }

    return results
  }

  getBufferStoreInfo(restoreBufferId: string): BufferStoreEntry {
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

    return this.bufferStores[restoreBufferId]
  }

  readBufferStoreFile(filePath: string): BufferStoreContent {
    const content = fs.readFileSync(filePath, 'utf8')
    if (!content.trim()) {
      throw new Error('Buffer store file is empty.')
    }

    const buffer = JSON.parse(content) as BufferStoreContent
    if (!buffer || !Array.isArray(buffer.tabs)) {
      throw new Error('Invalid editor buffer state.')
    }

    return buffer
  }

  writeBufferStoreFile(filePath: string, newState: unknown): void {
    const tempPath = path.join(
      path.dirname(filePath),
      `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${++this.writeSequence}.tmp`
    )

    try {
      // Write temp file first, then rename to the final file for atomicity
      // and reduced risk of data corruption.
      fs.writeFileSync(tempPath, JSON.stringify(newState), 'utf8')
      fs.renameSync(tempPath, filePath)
    } catch (err) {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath)
        }
      } catch (cleanupErr) {
        console.error('Failed to clean up temporary buffer store file', cleanupErr)
      }
      throw err
    }
  }

  updateBufferState(e: IpcMainInvokeEvent, newState: unknown): boolean {
    const win = BrowserWindow.fromWebContents(e.sender)
    const restoreBufferId = (win as unknown as { restoreBufferId?: string })?.restoreBufferId

    if (!restoreBufferId) {
      console.warn('No restoreBufferId found for window, skipping buffer state update')
      return false
    }

    const bufferStore = this.getBufferStoreInfo(restoreBufferId)
    this.writeBufferStoreFile(bufferStore.filePath, newState)
    return true
  }

  getUnUsedBufferUUID(): string {
    if (!this.bufferStores) {
      this.bufferStores = this.findEditorBufferStores(this.editorBufferStorePath)
    }

    let uuid: string
    do {
      uuid = crypto.randomUUID()
    } while (uuid in this.bufferStores)

    return uuid
  }

  _listenForIpcMain(): void {
    ipcMain.handle('update-buffer-state', (e, newState) => {
      return this.updateBufferState(e, newState)
    })
  }
}

export default EditorBufferStore
