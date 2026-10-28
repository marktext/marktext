import path from 'path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'
import log from 'electron-log'
import { isChildOfDirectory } from 'common/filesystem/paths'
import BaseWindow, { WindowLifecycle, WindowType } from './base'
import type Accessor from '../app/accessor'
import { zoomIn, zoomOut } from './utils'
import { TITLE_BAR_HEIGHT, editorWinOptions, isLinux, isOsx } from '../config'
import { showEditorContextMenu } from '../contextMenu/editor'
import { switchLanguage } from '../spellchecker'
import type { TabOptions } from '@shared/types/files'
import { ProjectRoots, resolveExistingPath } from './projectRoots'
import { randomUUID } from 'node:crypto'
import type { PreparedSessionWindow } from '@shared/types/applicationState'

export interface FileOpenOptions extends TabOptions {
  allowMissing?: boolean
}

interface CandidateScore {
  id: number | null
  score: number
}

class EditorWindow extends BaseWindow {
  // Root directory and file list that are currently opened. These lists are
  // used to find the best window to open new files in.
  readonly projectRoots: ProjectRoots
  private _openedFiles: string[] | null
  public readonly sessionStateId: string
  public sessionReady: Promise<void> = Promise.resolve()

  constructor(accessor: Accessor, private preparedSession?: PreparedSessionWindow) {
    super(accessor)
    this.type = WindowType.EDITOR
    this.sessionStateId = preparedSession?.snapshot.id ?? randomUUID()

    this.projectRoots = new ProjectRoots({
      publish: snapshot => this.browserWindow?.webContents.send('mt::project-roots-changed', snapshot),
      watch: root => {
        const { key, watchToken } = root
        ipcMain.emit('watcher-watch-directory', this.browserWindow, root.pathname, {
          rootKey: key,
          watchToken,
          onStatus: (status: 'ready' | 'unavailable', error?: string) => this.projectRoots.setStatus(key, watchToken, status, error)
        })
      },
      unwatch: root => ipcMain.emit('watcher-unwatch-directory', this.browserWindow, root.pathname),
      remember: pathname => {
        this._accessor.menu.addRecentlyUsedDocument(pathname)
      }
    })
    this._openedFiles = []

  }

  createWindow(
    rootDirectory: string | null = null,
    fileList: string[] = [],
    markdownList: string[] = [],
    options: Partial<BrowserWindowConstructorOptions> = {},
    fileOptions: Record<string, FileOpenOptions> = {}
  ): BrowserWindow {
    const { menu: appMenu, env, preferences, sessionHost: host } = this._accessor
    const winOptions: BrowserWindowConstructorOptions = Object.assign(
      { width: 1200, height: 800 },
      editorWinOptions,
      options,
      { show: false }
    )
    if (isLinux) winOptions.icon = path.join(process.cwd(), 'static', 'logo-96px.png')
    const { titleBarStyle, theme, spellcheckerEnabled, spellcheckerLanguage, sourceCodeModeEnabled } = preferences.getAll()

    if (!isOsx) {
      winOptions.titleBarStyle = 'default'
      if (titleBarStyle === 'native') {
        winOptions.frame = true
      }
    }

    winOptions.backgroundColor = this._getPreferredBackgroundColor(theme)
    if (env.disableSpellcheck) {
      ;(winOptions.webPreferences as { spellcheck: boolean }).spellcheck = false
    }

    let win: BrowserWindow | null = (this.browserWindow = new BrowserWindow(winOptions))

    this.id = win.id
    host.registerEditor(this)
    const prepared = this.preparedSession
      ? Promise.resolve(this.preparedSession)
      : host.prepareNewWindow(rootDirectory, fileList, markdownList, fileOptions)
    this.preparedSession = undefined
    this.sessionReady = prepared.then(prepared => {
      prepared.snapshot.id = this.sessionStateId
      return host.bindEditor(this, prepared)
    })
    void this.sessionReady.catch(error => host.report(error, this.sessionStateId))

    if (spellcheckerEnabled && !isOsx) {
      try {
        switchLanguage(win, spellcheckerLanguage as string)
      } catch (error) {
        log.error('Unable to set spell checker language on startup:', error)
      }
    }

    appMenu.addEditorMenu(win, { sourceCodeModeEnabled })

    win.webContents.on('context-menu', (event, params) => {
      showEditorContextMenu(win!, event, params, preferences.getItem('spellcheckerEnabled'))
    })

    win.webContents.once('did-finish-load', () => {
      this.lifecycle = WindowLifecycle.READY
      this.emit('window-ready')

      this.bringToFront()

      const lineEnding = preferences.getPreferredEol()
      appMenu.updateLineEndingMenu(this.id!, lineEnding)

      win!.webContents.on('zoom-changed', (_event, zoomDirection) => {
        if (zoomDirection === 'in') {
          zoomIn(win!)
        } else if (zoomDirection === 'out') {
          zoomOut(win!)
        }
      })
    })

    win.webContents.once('did-fail-load', (_event, errorCode, errorDescription, url) => {
      log.error(
        `The window failed to load or was cancelled: ${errorCode}; ${errorDescription}; @ ${url}`
      )
    })

    win.webContents.once('render-process-gone', async(_event, { reason }) => {
      if (reason === 'clean-exit') {
        return
      }
      host.rendererGone(this)

      const msg = `The renderer process has crashed unexpected or is killed (${reason}).`
      log.error(msg)

      if (reason === 'abnormal-exit') {
        return
      }

      const { response } = await dialog.showMessageBox(win!, {
        type: 'warning',
        buttons: ['Close', 'Reload', 'Keep It Open'],
        message: 'MarkText has crashed',
        detail: msg
      })

      if (win!.id) {
        switch (response) {
          case 0:
            return host.closeWindow(this)
          case 1:
            return this.reload()
        }
      }
    })

    win.on('focus', () => {
      this.emit('window-focus')
      win!.webContents.send('mt::window-active-status', { status: true })
    })

    win.on('blur', () => {
      this.emit('window-blur')
      win!.webContents.send('mt::window-active-status', { status: false })
    })
    ;(['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'] as const).forEach(
      (channel) => {
        // Electron's BrowserWindow.on() is heavily overloaded — the union of
        // event names can't be satisfied by a single overload, so we widen.
        ;(win! as { on(event: string, listener: () => void): void }).on(channel, () => {
          win!.webContents.send(`mt::window-${channel}`)
        })
      }
    )

    // Before closed. We cancel the action and ask the editor further instructions.
    win.on('close', (event) => {
      this.emit('window-close')

      event.preventDefault()
      void host.closeWindow(this).catch(error => host.report(error, this.sessionStateId))

      // TODO: Close all watchers etc. Should we do this manually or listen to 'quit' event?
    })

    win.on('closed', () => {
      this.lifecycle = WindowLifecycle.QUITTED
      this.emit('window-closed')

      win = null
    })

    this.lifecycle = WindowLifecycle.LOADING
    win.loadURL(this._buildUrlString(this.id, env, preferences))
    win.setSheetOffset(TITLE_BAR_HEIGHT)

    // Disable application menu shortcuts because we want to handle key bindings ourself.
    win.webContents.setIgnoreMenuShortcuts(true)

    return win
  }

  override bringToFront(): void {
    const host = this._accessor.sessionHost
    if (!host.isRendererInitialized(this.sessionStateId)) return
    super.bringToFront()
  }

  openTab(filePath: string, options: FileOpenOptions = {}, selected = true): void {
    if (this.lifecycle === WindowLifecycle.QUITTED) return
    const host = this._accessor.sessionHost
    void host.openFile(this, filePath, options, selected)
      .catch(error => host.report(error, this.sessionStateId))
  }

  removeRoot(key: string): Promise<boolean> {
    return this._accessor.sessionHost.removeRoot(this, key)
  }

  cancelPendingPreview(requestId: number): void {
    this._accessor.sessionHost.cancelPreview(this.sessionStateId, requestId)
  }

  openTabs(fileList: { filePath: string; selected: boolean; options: FileOpenOptions }[]): void {
    for (const file of fileList) this.openTab(file.filePath, file.options, file.selected)
  }

  openUntitledTab(selected = true, markdown = ''): void {
    if (this.lifecycle === WindowLifecycle.QUITTED) return
    const host = this._accessor.sessionHost
    void this.sessionReady.then(() => host.newDocument(this.sessionStateId, '', markdown, selected))
      .catch(error => host.report(error, this.sessionStateId))
  }

  openFolder(pathname: string): void {
    this.addFolder(pathname, true)
  }

  addFolder(pathname: string, replace = false): void {
    if (!pathname || this.lifecycle === WindowLifecycle.QUITTED) return
    const host = this._accessor.sessionHost
    void host.changeFolder(this, pathname, replace)
      .catch(error => host.report(error, this.sessionStateId))
  }

  openTabsFromPaths(filePaths: string[], fileOptions: Record<string, FileOpenOptions> = {}): void {
    if (!filePaths || filePaths.length === 0) return

    const fileList = filePaths.map((p) => ({
      filePath: p,
      options: fileOptions[p] ?? {},
      selected: false
    }))
    fileList[0].selected = true
    this.openTabs(fileList)
  }

  addToOpenedFiles(filePath: string): void {
    const { _openedFiles, browserWindow } = this
    if (!_openedFiles!.includes(filePath)) _openedFiles!.push(filePath)
    ipcMain.emit('watcher-watch-file', browserWindow, filePath)
  }

  changeOpenedFilePath(pathname: string, oldPathname: string): void {
    const { _openedFiles, browserWindow } = this
    const index = _openedFiles!.findIndex((p) => p === oldPathname)
    if (index === -1) {
      _openedFiles!.push(pathname)
    } else {
      _openedFiles![index] = pathname
    }
    ipcMain.emit('watcher-unwatch-file', browserWindow, oldPathname)
    ipcMain.emit('watcher-watch-file', browserWindow, pathname)
  }

  removeFromOpenedFiles(pathname: string): void {
    const { _openedFiles, browserWindow } = this
    const index = _openedFiles!.findIndex((p) => p === pathname)
    if (index !== -1) {
      _openedFiles!.splice(index, 1)
    }
    ipcMain.emit('watcher-unwatch-file', browserWindow, pathname)
  }

  getCandidateScores(fileList: string[]): CandidateScore[] {
    const { _openedFiles, id } = this
    const buf: CandidateScore[] = []
    for (const inputPath of fileList) {
      const pathname = resolveExistingPath(inputPath)
      let score = 0
      if (_openedFiles!.some((p) => resolveExistingPath(p) === pathname)) {
        score = -1
      } else {
        if (this.projectRoots.roots.some(root => isChildOfDirectory(root.key, pathname))) {
          score += 5
        }
        for (const item of _openedFiles!) {
          if (isChildOfDirectory(path.dirname(resolveExistingPath(item)), pathname)) {
            score += 1
          }
        }
      }
      buf.push({ id, score })
    }
    return buf
  }

  override destroy(): void {
    super.destroy()

    // Watchers are freed from WindowManager.

    this.projectRoots.clear()
    this._openedFiles = null
  }
}

export default EditorWindow
