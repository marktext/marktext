import fs from 'fs'
import path from 'path'
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { TypedEmitter } from '@shared/types/typedEmitter'

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

interface LoadedBufferStore {
  entry: BufferStoreEntry
  state: BufferStoreContent
  mtimeMs: number
}

interface EditorWindow {
  id: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
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

  prepareRestorableBufferStores(mergeDuplicateStores: boolean = false): BufferStoreEntry[] {
    this.bufferStores = this.getAllBufferStores()

    const loadedStores: LoadedBufferStore[] = []
    for (const id in this.bufferStores) {
      const entry = this.bufferStores[id]
      try {
        const state = this.readBufferStoreFile(entry.filePath)
        if (state.tabs.length === 0) {
          this.deleteBufferStore(id)
          continue
        }

        const { mtimeMs } = fs.statSync(entry.filePath)
        loadedStores.push({ entry, state, mtimeMs })
      } catch (e) {
        console.error('Failed to read buffer store file during restore', e)
      }
    }

    if (!mergeDuplicateStores) {
      return loadedStores.map((store) => store.entry)
    }

    try {
      return this.mergeDuplicateBufferStores(loadedStores)
    } catch (e) {
      console.error('Failed to merge buffer stores during restore', e)
      return loadedStores.map((store) => store.entry)
    }
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
            delete this.bufferStores[id]
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

  deleteBufferStore(id: string): void {
    if (!this.bufferStores) {
      this.bufferStores = this.findEditorBufferStores(this.editorBufferStorePath)
    }

    const bufferStore = this.bufferStores[id]
    if (!bufferStore) {
      return
    }

    try {
      if (fs.existsSync(bufferStore.filePath)) {
        fs.unlinkSync(bufferStore.filePath)
      }
    } catch (e) {
      console.error('Failed to delete buffer store file', e)
    }
    delete this.bufferStores[id]
  }

  mergeDuplicateBufferStores(stores: LoadedBufferStore[]): BufferStoreEntry[] {
    const groups = new Map<string, LoadedBufferStore[]>()
    for (const store of stores) {
      const rootDirectory =
        (store.state.project as { rootDirectory?: unknown } | undefined)?.rootDirectory ?? ''
      const key = typeof rootDirectory === 'string' ? rootDirectory : ''
      const group = groups.get(key) ?? []
      group.push(store)
      groups.set(key, group)
    }

    const result: BufferStoreEntry[] = []
    for (const group of groups.values()) {
      if (group.length === 1 || !this.hasOverlappingTabs(group)) {
        result.push(...group.map((store) => store.entry))
        continue
      }

      group.sort((a, b) => a.mtimeMs - b.mtimeMs)
      const target = group[group.length - 1]
      const mergedState = JSON.parse(JSON.stringify(target.state)) as BufferStoreContent
      const mergedTabs: Array<{ isSaved: boolean; [key: string]: unknown }> = []
      const tabIndexes = new Map<string, number>()
      const tabIdRemap = new Map<string, number>()
      const targetCurrentTab = target.state.tabs.find((tab) => tab.id === target.state.currentFileId)
      const targetCurrentKey = targetCurrentTab
        ? this.getTabMergeKey(target.entry.id, targetCurrentTab)
        : null

      for (const store of group) {
        for (const tab of store.state.tabs) {
          const key = this.getTabMergeKey(store.entry.id, tab)
          const existingIndex = tabIndexes.get(key)

          if (existingIndex == null) {
            tabIndexes.set(key, mergedTabs.length)
            tabIdRemap.set(this.getStoreTabId(store.entry.id, tab), mergedTabs.length)
            mergedTabs.push(JSON.parse(JSON.stringify(tab)))
            continue
          }

          const existingTab = mergedTabs[existingIndex]
          tabIdRemap.set(this.getStoreTabId(store.entry.id, tab), existingIndex)
          if (this.shouldReplaceMergedTab(existingTab, tab)) {
            mergedTabs[existingIndex] = JSON.parse(JSON.stringify(tab))
          }
        }
      }

      mergedTabs.forEach((tab, index) => {
        tab.id = `mt-${index}`
      })
      const currentFileIndex = targetCurrentKey ? tabIndexes.get(targetCurrentKey) : null
      mergedState.tabs = mergedTabs
      mergedState.currentFileId =
        (typeof currentFileIndex === 'number' ? mergedTabs[currentFileIndex] : mergedTabs[0])?.id ??
        null
      mergedState.restoreWarnings = group.flatMap((store) => {
        const restoreWarnings = Array.isArray(store.state.restoreWarnings)
          ? store.state.restoreWarnings
          : []
        return restoreWarnings.map((warning) => {
          if (!warning || typeof warning !== 'object') {
            return warning
          }

          const tabId = (warning as { tabId?: unknown }).tabId
          if (typeof tabId !== 'string') {
            return warning
          }

          const tabIndex = tabIdRemap.get(this.getStoreTabId(store.entry.id, { id: tabId }))
          return {
            ...warning,
            tabId: typeof tabIndex === 'number' ? mergedTabs[tabIndex]?.id ?? null : null
          }
        })
      })

      this.writeBufferStoreFile(target.entry.filePath, mergedState)
      for (const store of group.slice(0, -1)) {
        this.deleteBufferStore(store.entry.id)
      }
      result.push(target.entry)
    }

    return result
  }

  hasOverlappingTabs(stores: LoadedBufferStore[]): boolean {
    const seen = new Set<string>()

    for (const store of stores) {
      for (const tab of store.state.tabs) {
        if (typeof tab.pathname !== 'string' || !tab.pathname) {
          continue
        }

        if (seen.has(tab.pathname)) {
          return true
        }
        seen.add(tab.pathname)
      }
    }

    return false
  }

  getTabMergeKey(storeId: string, tab: { [key: string]: unknown }): string {
    return typeof tab.pathname === 'string' && tab.pathname
      ? `path:${tab.pathname}`
      : `untitled:${storeId}:${String(tab.id ?? '')}`
  }

  getStoreTabId(storeId: string, tab: { [key: string]: unknown }): string {
    return `${storeId}:${String(tab.id ?? '')}`
  }

  shouldReplaceMergedTab(
    existingTab: { isSaved: boolean; [key: string]: unknown },
    nextTab: { isSaved: boolean; [key: string]: unknown }
  ): boolean {
    if (!existingTab.isSaved && nextTab.isSaved) {
      return false
    }
    return true
  }

  updateBufferState(e: IpcMainInvokeEvent, newState: unknown): boolean {
    const win = BrowserWindow.fromWebContents(e.sender)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const restoreBufferId = (win as any)?.restoreBufferId as string | undefined

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
