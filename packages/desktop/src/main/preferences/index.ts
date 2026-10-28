import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import log from 'electron-log'
import { isWindows } from '../config'
import { onInternalChannel } from '../utils/internalIpc'
import { TypedEmitter } from '@shared/types/typedEmitter'
import { PreferenceFile } from './preferenceFile'
import type { PreferenceUpdateResult, UserPreferences } from '@shared/types/preferences'

type PreferenceEvents = Record<string, unknown[]>

interface AppPaths {
  readonly preferencesPath: string
}

class Preference extends TypedEmitter<PreferenceEvents> {
  public readonly preferencesPath: string
  public readonly hasPreferencesFile: boolean
  private readonly file: PreferenceFile

  constructor(paths: AppPaths) {
    super()
    this.preferencesPath = paths.preferencesPath
    this.file = new PreferenceFile(paths.preferencesPath, { dark: nativeTheme.shouldUseDarkColors })
    this.hasPreferencesFile = this.file.exists
    if (this.file.readOnly) log.warn('Preferences are unavailable; using read-only defaults')
    this._listenForIpcMain()
  }

  getAll(): UserPreferences & Record<string, unknown> {
    return this.file.get()
  }

  update(patch: unknown): PreferenceUpdateResult {
    const result = this.file.update(patch)
    if (result.status === 'persisted') {
      ipcMain.emit('broadcast-preferences-changed', { ...(patch as Record<string, unknown>) })
    }
    return result
  }

  setItem(key: string, value: unknown): void {
    this.setItems({ [key]: value })
  }

  getItem<T = unknown>(key: string): T {
    return this.file.get()[key] as T
  }

  setItems(settings: Record<string, unknown> | null | undefined): void {
    const result = this.update(settings)
    if (result.status === 'failed') log.warn(`Cannot persist preferences: ${result.reason}`)
  }

  getPreferredEol(): 'lf' | 'crlf' {
    const endOfLine = this.getItem<string>('endOfLine')
    if (endOfLine === 'lf') {
      return 'lf'
    }
    return endOfLine === 'crlf' || isWindows ? 'crlf' : 'lf'
  }

  exportJSON(): void {
    // todo
  }

  importJSON(): void {
    // todo
  }

  _listenForIpcMain(): void {
    ipcMain.on('mt::ask-for-user-preference', (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (win) {
        win.webContents.send('mt::user-preference', this.getAll())
      }
    })
    ipcMain.on('mt::set-user-preference', (_e, settings: Record<string, unknown>) => {
      this.setItems(settings)
    })
    ipcMain.on('mt::cmd-toggle-autosave', () => {
      this.setItem('autoSave', !this.getItem('autoSave'))
    })

    onInternalChannel('set-user-preference', (settings: Record<string, unknown>) => {
      this.setItems(settings)
    })
  }
}

export default Preference
