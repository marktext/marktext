import fs from 'fs'
import path from 'path'
import writeFileAtomic from 'write-file-atomic'
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
  tabs: Array<{ isSaved: boolean; pathname?: string | null; [key: string]: unknown }>
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

  /**
   * The buffer stores to restore on startup: at most one per distinct set of
   * open documents, newest wins. Superseded stores are deleted.
   *
   * A window's restore identity is the set of documents it had open. Stores
   * are only ever collected once every tab reports `isSaved`, so a document
   * edited across many sessions without an explicit save leaves one store
   * behind per session — and `restoreAll` then opens a window for each,
   * growing without bound.
   *
   * Stores holding an untitled tab keep their own identity: their content
   * exists nowhere else, so two untitled drafts must never collapse into one.
   */
  getRestorableBufferStores(): BufferStoreEntry[] {
    const stores = this.getAllBufferStores()
    const newestBySignature = new Map<string, { entry: BufferStoreEntry; mtimeMs: number }>()
    const superseded: BufferStoreEntry[] = []

    for (const id of Object.keys(stores)) {
      const entry = stores[id]
      let signature: string
      let mtimeMs: number

      try {
        const buffer = this.readBufferStoreFile(entry.filePath)
        const pathnames = buffer.tabs.map((tab) => tab.pathname)
        signature = pathnames.every((pathname) => !!pathname)
          ? JSON.stringify((pathnames as string[]).slice().sort())
          : `untitled:${entry.id}`
        mtimeMs = fs.statSync(entry.filePath).mtimeMs
      } catch (e) {
        console.error('Failed to inspect buffer store file while restoring', e)
        continue
      }

      const incumbent = newestBySignature.get(signature)
      if (!incumbent) {
        newestBySignature.set(signature, { entry, mtimeMs })
      } else if (mtimeMs > incumbent.mtimeMs) {
        newestBySignature.set(signature, { entry, mtimeMs })
        superseded.push(incumbent.entry)
      } else {
        superseded.push(entry)
      }
    }

    for (const entry of superseded) {
      try {
        fs.unlinkSync(entry.filePath)
        // `stores` is the live `this.bufferStores` map returned above.
        delete stores[entry.id]
      } catch (e) {
        console.error('Failed to delete superseded buffer store file', e)
      }
    }

    return [...newestBySignature.values()].map(({ entry }) => entry)
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
    // Durable atomic write: write-file-atomic writes to a temp file, fsyncs it,
    // then renames it over the target. The previous temp-file + rename here was
    // namespace-atomic (crash-safe) but omitted the fsync, so a power loss could
    // still leave this crash-recovery buffer — which holds unsaved tab content —
    // truncated or zero-filled, the same gap the document save path had (#3786).
    writeFileAtomic.sync(filePath, JSON.stringify(newState), 'utf8')
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
