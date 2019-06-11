import path from 'path'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import log from 'electron-log'
import windowStateKeeper from 'electron-window-state'
import { isChildOfDirectory, isSamePathSync } from 'common/filesystem/paths'
import BaseWindow, { WindowLifecycle, WindowType } from './base'
import { ensureWindowPosition } from './utils'
import { TITLE_BAR_HEIGHT, editorWinOptions, isLinux, isOsx } from '../config'
import { loadMarkdownFile } from '../filesystem/markdown'

class EditorWindow extends BaseWindow {

  /**
   * @param {Accessor} accessor The application accessor for application instances.
   */
  constructor (accessor) {
    super(accessor)
    this.type = WindowType.EDITOR

    // Root directory and file list to open when the window is ready.
    this._directoryToOpen = null
    this._filesToOpen = [] // {doc: IMarkdownDocumentRaw, selected: boolean}
    this._markdownToOpen = [] // List of markdown strings or an empty string will open a new untitled tab

    // Root directory and file list that are currently opened. These lists are
    // used to find the best window to open new files in.
    this._openedRootDirectory = ''
    this._openedFiles = []
  }

  /**
   * Creates a new editor window.
   *
   * @param {string} [rootDirectory] The root directory to open.
   * @param {string[]} [fileList] A list of markdown files to open.
   * @param {string[]} [markdownList] Array of markdown data to open.
   * @param {*} [options] The BrowserWindow options.
   */
  createWindow (rootDirectory = null, fileList = [], markdownList = [], options = {}) {
    const { menu: appMenu, env, preferences } = this._accessor
    const addBlankTab = !rootDirectory && fileList.length === 0 && markdownList.length === 0

    const mainWindowState = windowStateKeeper({
      defaultWidth: 1200,
      defaultHeight: 800
    })

    const { x, y, width, height } = ensureWindowPosition(mainWindowState)
    const winOptions = Object.assign({ x, y, width, height }, editorWinOptions, options)
    if (isLinux) {
      winOptions.icon = path.join(__static, 'logo-96px.png')
    }

    // Enable native or custom/frameless window and titlebar
    const {
      titleBarStyle,
      theme,
      sideBarVisibility,
      tabBarVisibility,
      sourceCodeModeEnabled
    } = preferences.getAll()
    if (!isOsx) {
      winOptions.titleBarStyle = 'default'
      if (titleBarStyle === 'native') {
        winOptions.frame = true
      }
    }

    winOptions.backgroundColor = this._getPreferredBackgroundColor(theme)

    let win = this.browserWindow = new BrowserWindow(winOptions)
    this.id = win.id

    // Create a menu for the current window
    appMenu.addEditorMenu(win, { sourceCodeModeEnabled })

    win.webContents.once('did-finish-load', () => {
      this.lifecycle = WindowLifecycle.READY
      this.emit('window-ready')

      // Restore and focus window
      this.bringToFront()

      const lineEnding = preferences.getPreferedEOL()
      appMenu.updateLineEndingMenu(lineEnding)

      win.webContents.send('mt::bootstrap-editor', {
        addBlankTab,
        markdownList: this._markdownToOpen,
        lineEnding,
        sideBarVisibility,
        tabBarVisibility,
        sourceCodeModeEnabled
      })

      this._doOpenFilesToOpen()
      this._markdownToOpen.length = 0
    })

    win.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
      log.error(`The window failed to load or was cancelled: ${errorCode}; ${errorDescription}`)
    })

    win.webContents.once('crashed', (event, killed) => {
      const msg = `The renderer process has crashed unexpected or is killed (${killed}).`
      log.error(msg)

      dialog.showMessageBox(win, {
        type: 'warning',
        buttons: ['Close', 'Reload', 'Keep It Open'],
        message: 'Mark Text has crashed',
        detail: msg
      }, code => {
        if (win.id) {
          switch(code) {
            case 0: return this.destroy()
            case 1: return this.reload()
          }
        }
      })
    })

    win.on('focus', () => {
      this.emit('window-focus')
      win.webContents.send('AGANI::window-active-status', { status: true })
    })

    // Lost focus
    win.on('blur', () => {
      this.emit('window-blur')
      win.webContents.send('AGANI::window-active-status', { status: false })
    })

    ;['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen'].forEach(channel => {
      win.on(channel, () => {
        win.webContents.send(`mt::window-${channel}`)
      })
    })

    // Before closed. We cancel the action and ask the editor further instructions.
    win.on('close', event => {
      this.emit('window-close')

      event.preventDefault()
      win.webContents.send('AGANI::ask-for-close')

      // TODO: Close all watchers etc. Should we do this manually or listen to 'quit' event?
    })

    // The window is now destroyed.
    win.on('closed', () => {
      this.lifecycle = WindowLifecycle.QUITTED
      this.emit('window-closed')

      // Free window reference
      win = null
    })

    this.lifecycle = WindowLifecycle.LOADING
    win.loadURL(this._buildUrlString(this.id, env, preferences))
    win.setSheetOffset(TITLE_BAR_HEIGHT)

    mainWindowState.manage(win)

    // Delay load files and directories after the current control flow.
    setTimeout(() => {
      if (rootDirectory) {
        this.openFolder(rootDirectory)
      }
      if (fileList.length) {
        this.openTabs(fileList, 0)
      }
    }, 0)

    return win
  }

  /**
   * Open a new tab from a markdown file.
   *
   * @param {string} filePath The markdown file path.
   * @param {[boolean]} selected Whether the tab should become the selected tab (true if not set).
   */
  openTab (filePath, selected=true) {
    if (this.lifecycle === WindowLifecycle.QUITTED) return
    this.openTabs([ filePath ], selected ? 0 : -1 )
  }

    /**
   * Open new tabs from markdown files.
   *
   * @param {string[]} filePath The markdown file path list to open.
   * @param {[number]} selectedIndex Whether one of the given tabs should become the selected tab (-1 if not set).
   */
  openTabs (fileList, selectedIndex = -1) {
    if (this.lifecycle === WindowLifecycle.QUITTED) return

    const { browserWindow } = this
    const { preferences } = this._accessor
    const eol = preferences.getPreferedEOL()

    for (let i = 0; i < fileList.length; ++i) {
      const filePath = fileList[i]
      const selected = i === selectedIndex
      loadMarkdownFile(filePath, eol).then(rawDocument => {
        if (this.lifecycle === WindowLifecycle.READY) {
          this._doOpenTab(rawDocument, selected)
        } else {
          this._filesToOpen.push({ doc: rawDocument, selected })
        }
      }).catch(err => {
        console.error('[ERROR] Cannot open file or directory.')
        log.error(err)
        browserWindow.webContents.send('AGANI::show-notification', {
          title: 'Cannot open tab',
          type: 'error',
          message: err.message
        })
      })
    }
  }

  /**
   * Open a new untitled tab optional with a markdown string.
   *
   * @param {[boolean]} selected Whether the tab should become the selected tab (true if not set).
   * @param {[string]} markdown The markdown string.
   */
  openUntitledTab (selected=true, markdown='') {
    if (this.lifecycle === WindowLifecycle.QUITTED) return

    if (this.lifecycle === WindowLifecycle.READY) {
      const { browserWindow } = this
      browserWindow.webContents.send('mt::new-untitled-tab', selected, markdown)
    } else {
      this._markdownToOpen.push(markdown)
    }
  }

  /**
   * Open a (new) directory and replaces the old one.
   *
   * @param {string} pathname The directory path.
   */
  openFolder (pathname) {
    if (this.lifecycle === WindowLifecycle.QUITTED ||
      isSamePathSync(pathname, this._openedRootDirectory)) {
      return
    }

    if (this.lifecycle === WindowLifecycle.READY) {
      const { browserWindow } = this
      if (this._openedRootDirectory) {
        ipcMain.emit('watcher-unwatch-directory', browserWindow, this._openedRootDirectory)
      }

      this._openedRootDirectory = pathname
      ipcMain.emit('watcher-watch-directory', browserWindow, pathname)
      browserWindow.webContents.send('mt::open-directory', pathname)
    } else {
      this._directoryToOpen = pathname
    }
  }

  /**
   * Add a new path to the file list and watch the given path.
   *
   * @param {string} filePath The file path.
   */
  addToOpenedFiles (filePath) {
    const { _openedFiles, browserWindow } = this
    _openedFiles.push(filePath)
    ipcMain.emit('watcher-watch-file', browserWindow, filePath)
  }

  /**
   * Change a path in the opened file list and update the watcher.
   *
   * @param {string} pathname
   * @param {string} oldPathname
   */
  changeOpenedFilePath (pathname, oldPathname) {
    const { _openedFiles, browserWindow } = this
    const index = _openedFiles.findIndex(p => p === oldPathname)
    if (index === -1) {
      // The old path was not found but add the new one.
      _openedFiles.push(pathname)
    } else {
      _openedFiles[index] = pathname
    }
    ipcMain.emit('watcher-unwatch-file', browserWindow, oldPathname)
    ipcMain.emit('watcher-watch-file', browserWindow, pathname)
  }

  /**
   * Remove a path from the opened file list and stop watching the path.
   *
   * @param {string} pathname The full path.
   */
  removeFromOpenedFiles (pathname) {
    const { _openedFiles, browserWindow } = this
    const index = _openedFiles.findIndex(p => p === pathname)
    if (index !== -1) {
      _openedFiles.splice(index, 1)
    }
    ipcMain.emit('watcher-unwatch-file', browserWindow, pathname)
  }

  /**
   * Returns a score list for a given file list.
   *
   * @param {string[]} fileList The file list.
   * @returns {number[]}
   */
  getCandidateScores (fileList) {
    const { _openedFiles, _openedRootDirectory, id } = this
    const buf = []
    for (const pathname of fileList) {
      let score = 0
      if (_openedFiles.some(p => p === pathname)) {
        score = -1
      } else {
        if (isChildOfDirectory(_openedRootDirectory, pathname)) {
          score += 5
        }
        for (const item of _openedFiles) {
          if (isChildOfDirectory(path.dirname(item), pathname)) {
            score += 1
          }
        }
      }
      buf.push({ id, score })
    }
    return buf
  }

  reload () {
    const { id, browserWindow } = this

    // Close watchers
    ipcMain.emit('watcher-unwatch-all-by-id', id)

    // Reset saved state
    this._directoryToOpen = ''
    this._filesToOpen = []
    this._markdownToOpen = []
    this._openedRootDirectory = ''
    this._openedFiles = []

    browserWindow.webContents.once('did-finish-load', () => {
      this.lifecycle = WindowLifecycle.READY
      const { preferences } = this._accessor
      const { sideBarVisibility, tabBarVisibility, sourceCodeModeEnabled } = preferences.getAll()
      const lineEnding = preferences.getPreferedEOL()
      browserWindow.webContents.send('mt::bootstrap-editor', {
        addBlankTab: true,
        markdownList: [],
        lineEnding,
        sideBarVisibility,
        tabBarVisibility,
        sourceCodeModeEnabled
      })
    })

    this.lifecycle = WindowLifecycle.LOADING
    super.reload()
  }

  destroy () {
    super.destroy()

    // Watchers are freed from WindowManager.

    this._directoryToOpen = null
    this._filesToOpen = null
    this._markdownToOpen = null
    this._openedRootDirectory = null
    this._openedFiles = null
  }

  get openedRootDirectory () {
    return this._openedRootDirectory
  }

  // --- private ---------------------------------

  _getPreferredBackgroundColor (theme) {
    // Hardcode the theme background color and show the window direct for the fastet window ready time.
    // Later with custom themes we need the background color (e.g. from meta information) and wait
    // that the window is loaded and then pass theme data to the renderer.
    switch (theme) {
      case 'dark':
        return '#282828'
      case 'material-dark':
        return '#34393f'
      case 'ulysses':
      return '#f3f3f3'
      case 'graphite':
        return '#f7f7f7'
      case 'one-dark':
       return '#282c34'
      case 'light':
      default:
        return '#ffffff'
    }
  }

  /**
   * Open a new new tab from the markdown document.
   *
   * @param {IMarkdownDocumentRaw} rawDocument The markdown document.
   * @param {boolean} selected Whether the tab should become the selected tab (true if not set).
   */
  _doOpenTab (rawDocument, selected) {
    const { _accessor, _openedFiles, browserWindow } = this
    const { menu: appMenu } = _accessor
    const { pathname } = rawDocument

    // Listen for file changed.
    ipcMain.emit('watcher-watch-file', browserWindow, pathname)

    appMenu.addRecentlyUsedDocument(pathname)
    _openedFiles.push(pathname)
    browserWindow.webContents.send('AGANI::new-tab', rawDocument, selected)
  }

  _doOpenFilesToOpen () {
    if (this.lifecycle !== WindowLifecycle.READY) {
      throw new Error('Invalid state.')
    }

    if (this._directoryToOpen) {
      this.openFolder(this._directoryToOpen)
    }
    this._directoryToOpen = null

    for(const { doc, selected } of this._filesToOpen) {
      this._doOpenTab(doc, selected)
    }
    this._filesToOpen.length = 0
  }
}

export default EditorWindow
