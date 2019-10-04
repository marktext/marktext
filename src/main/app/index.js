import path from 'path'
import fse from 'fs-extra'
import { exec } from 'child_process'
import dayjs from 'dayjs'
import log from 'electron-log'
import { app, BrowserWindow, clipboard, dialog, ipcMain, systemPreferences } from 'electron'
import { isChildOfDirectory } from 'common/filesystem/paths'
import { isLinux, isOsx } from '../config'
import parseArgs from '../cli/parser'
import { normalizeMarkdownPath } from '../filesystem/markdown'
import { selectTheme } from '../menu/actions/theme'
import { dockMenu } from '../menu/templates'
import { watchers } from '../utils/imagePathAutoComplement'
import { WindowType } from '../windows/base'
import EditorWindow from '../windows/editor'
import SettingWindow from '../windows/setting'

class App {
  /**
   * @param {Accessor} accessor The application accessor for application instances.
   * @param {arg.Result} args Parsed application arguments.
   */
  constructor (accessor, args) {
    this._accessor = accessor
    this._args = args || { _: [] }
    this._openFilesCache = []
    this._openFilesTimer = null
    this._windowManager = this._accessor.windowManager
    // this.launchScreenshotWin = null // The window which call the screenshot.
    // this.shortcutCapture = null

    this._listenForIpcMain()
  }

  /**
   * The entry point into the application.
   */
  init () {
    // Enable these features to use `backdrop-filter` css rules!
    if (isOsx) {
      app.commandLine.appendSwitch('enable-experimental-web-platform-features', 'true')
    }

    app.on('second-instance', (event, argv, workingDirectory) => {
      const { _openFilesCache, _windowManager } = this
      const args = parseArgs(argv.slice(1))

      const buf = []
      for (const pathname of args._) {
        // Ignore all unknown flags
        if (pathname.startsWith('--')) {
          continue
        }

        const info = normalizeMarkdownPath(path.resolve(workingDirectory, pathname))
        if (info) {
          buf.push(info)
        }
      }

      if (args['--new-window']) {
        this._openPathList(buf, true)
        return
      }

      _openFilesCache.push(...buf)
      if (_openFilesCache.length) {
        this._openFilesToOpen()
      } else {
        const activeWindow = _windowManager.getActiveWindow()
        if (activeWindow) {
          activeWindow.bringToFront()
        }
      }
    })

    app.on('open-file', this.openFile) // macOS only

    app.on('ready', this.ready)

    app.on('window-all-closed', () => {
      // Close all the image path watcher
      for (const watcher of watchers.values()) {
        watcher.close()
      }
      this._windowManager.closeWatcher()
      if (!isOsx) {
        app.quit()
      }
    })

    app.on('activate', () => { // macOS only
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (this._windowManager.windowCount === 0) {
        this.ready()
      }
    })

    // Prevent to load webview and opening links or new windows via HTML/JS.
    app.on('web-contents-created', (event, contents) => {
      contents.on('will-attach-webview', event => {
        event.preventDefault()
      })
      contents.on('will-navigate', event => {
        event.preventDefault()
      })
      contents.on('new-window', event => {
        event.preventDefault()
      })
    })
  }

  async getScreenshotFileName () {
    const screenshotFolderPath = await this._accessor.dataCenter.getItem('screenshotFolderPath')
    const fileName = `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}-screenshot.png`
    return path.join(screenshotFolderPath, fileName)
  }

  ready = () => {
    const { _args: args, _openFilesCache } = this
    const { preferences } = this._accessor

    if (args._.length) {
      for (const pathname of args._) {
        // Ignore all unknown flags
        if (pathname.startsWith('--')) {
          continue
        }

        const info = normalizeMarkdownPath(pathname)
        if (info) {
          _openFilesCache.push(info)
        }
      }
    }

    const { startUpAction, defaultDirectoryToOpen } = preferences.getAll()
    if (startUpAction === 'folder' && defaultDirectoryToOpen) {
      const info = normalizeMarkdownPath(defaultDirectoryToOpen)
      if (info) {
        _openFilesCache.unshift(info)
      }
    }

    if (process.platform === 'darwin') {
      app.dock.setMenu(dockMenu)

      // Listen for system theme change and change Mark Text own `dark` and `light`.
      // In macOS 10.14 Mojave, Apple introduced a new system-wide dark mode for
      // all macOS computers.
      systemPreferences.subscribeNotification(
        'AppleInterfaceThemeChangedNotification',
        () => {
          const preferences = this._accessor.preferences
          const { theme } = preferences.getAll()

          // Application menu is automatically updated via preference manager.
          if (systemPreferences.isDarkMode() && theme !== 'dark' &&
            theme !== 'material-dark' && theme !== 'one-dark') {
            selectTheme('dark')
          }
          if (!systemPreferences.isDarkMode() && theme !== 'light' &&
            theme !== 'ulysses' && theme !== 'graphite') {
            selectTheme('light')
          }
        }
      )
    }

    if (_openFilesCache.length) {
      this._openFilesToOpen()
    } else {
      this._createEditorWindow()
    }

    // this.shortcutCapture = new ShortcutCapture()
    // if (process.env.NODE_ENV === 'development') {
    //   this.shortcutCapture.dirname = path.resolve(path.join(__dirname, '../../../node_modules/shortcut-capture'))
    // }
    // this.shortcutCapture.on('capture', async ({ dataURL }) => {
    //   const { screenshotFileName } = this
    //   const image = nativeImage.createFromDataURL(dataURL)
    //   const bufferImage = image.toPNG()

    //   if (this.launchScreenshotWin) {
    //     this.launchScreenshotWin.webContents.send('mt::screenshot-captured')
    //     this.launchScreenshotWin = null
    //   }

    //   try {
    //     // write screenshot image into screenshot folder.
    //     await fse.writeFile(screenshotFileName, bufferImage)
    //   } catch (err) {
    //     log.error(err)
    //   }
    // })
  }

  openFile = (event, pathname) => {
    event.preventDefault()
    const info = normalizeMarkdownPath(pathname)
    if (info) {
      this._openFilesCache.push(info)

      if (app.isReady()) {
        // It might come more files
        if (this._openFilesTimer) {
          clearTimeout(this._openFilesTimer)
        }
        this._openFilesTimer = setTimeout(() => {
          this._openFilesTimer = null
          this._openFilesToOpen()
        }, 100)
      }
    }
  }

  // --- private --------------------------------

  /**
   * Creates a new editor window.
   *
   * @param {string} [rootDirectory] The root directory to open.
   * @param {string[]} [fileList] A list of markdown files to open.
   * @param {string[]} [markdownList] Array of markdown data to open.
   * @param {*} [options] The BrowserWindow options.
   * @returns {EditorWindow} The created editor window.
   */
  _createEditorWindow (rootDirectory = null, fileList = [], markdownList = [], options = {}) {
    const editor = new EditorWindow(this._accessor)
    editor.createWindow(rootDirectory, fileList, markdownList, options)
    this._windowManager.add(editor)
    if (this._windowManager.windowCount === 1) {
      this._accessor.menu.setActiveWindow(editor.id)
    }
    return editor
  }

  /**
   * Create a new setting window.
   */
  _createSettingWindow () {
    const setting = new SettingWindow(this._accessor)
    setting.createWindow()
    this._windowManager.add(setting)
    if (this._windowManager.windowCount === 1) {
      this._accessor.menu.setActiveWindow(setting.id)
    }
  }

  _openFilesToOpen () {
    this._openPathList(this._openFilesCache, false)
  }

  /**
   * Open the path list in the best window(s).
   *
   * @param {string[]} pathsToOpen The path list to open.
   * @param {boolean} openFilesInSameWindow Open all files in the same window with
   * the first directory and discard other directories.
   */
  _openPathList (pathsToOpen, openFilesInSameWindow = false) {
    const { _windowManager } = this
    const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')

    const fileSet = new Set()
    const directorySet = new Set()
    for (const { isDir, path } of pathsToOpen) {
      if (isDir) {
        directorySet.add(path)
      } else {
        fileSet.add(path)
      }
    }

    // Filter out directories that are already opened.
    for (const window of _windowManager.windows.values()) {
      if (window.type === WindowType.EDITOR) {
        const { openedRootDirectory } = window
        if (directorySet.has(openedRootDirectory)) {
          window.bringToFront()
          directorySet.delete(openedRootDirectory)
        }
      }
    }

    const directoriesToOpen = Array.from(directorySet).map(dir => ({ rootDirectory: dir, fileList: [] }))
    const filesToOpen = Array.from(fileSet)

    // Discard all directories except first one and add files.
    if (openFilesInSameWindow) {
      if (directoriesToOpen.length) {
        directoriesToOpen[0].fileList.push(...filesToOpen)
        directoriesToOpen.length = 1
      } else {
        directoriesToOpen.push({ rootDirectory: null, fileList: filesToOpen })
      }
      filesToOpen.length = 0
    }

    // Find the best window(s) to open the files in.
    if (!openFilesInSameWindow && !openFilesInNewWindow) {
      const isFirstWindow = _windowManager.getActiveEditorId() === null

      // Prefer new directories
      for (let i = 0; i < directoriesToOpen.length; ++i) {
        const { fileList, rootDirectory } = directoriesToOpen[i]

        let breakOuterLoop = false
        for (let j = 0; j < filesToOpen.length; ++j) {
          const pathname = filesToOpen[j]
          if (isChildOfDirectory(rootDirectory, pathname)) {
            if (isFirstWindow) {
              fileList.push(...filesToOpen)
              filesToOpen.length = 0
              breakOuterLoop = true
              break
            }
            fileList.push(pathname)
            filesToOpen.splice(j, 1)
            --j
          }
        }

        if (breakOuterLoop) {
          break
        }
      }

      // Find for the remaining files the best window to open the files in.
      if (isFirstWindow && directoriesToOpen.length && filesToOpen.length) {
        const { fileList } = directoriesToOpen[0]
        fileList.push(...filesToOpen)
        filesToOpen.length = 0
      } else {
        const windowList = _windowManager.findBestWindowToOpenIn(filesToOpen)
        for (const item of windowList) {
          const { windowId, fileList } = item

          // File list is empty when all files are already opened.
          if (fileList.length === 0) {
            continue
          }

          if (windowId !== null) {
            const window = _windowManager.get(windowId)
            if (window) {
              window.openTabsFromPaths(fileList)
              window.bringToFront()
              continue
            }
            // else: fallthrough
          }
          this._createEditorWindow(null, fileList)
        }
      }

      // Directores are always opened in a new window if not already opened.
      for (const item of directoriesToOpen) {
        const { rootDirectory, fileList } = item
        this._createEditorWindow(rootDirectory, fileList)
      }
    } else {
      // Open each file and directory in a new window.

      for (const pathname of filesToOpen) {
        this._createEditorWindow(null, [pathname])
      }

      for (const item of directoriesToOpen) {
        const { rootDirectory, fileList } = item
        this._createEditorWindow(rootDirectory, fileList)
      }
    }

    // Empty the file list
    pathsToOpen.length = 0
  }

  _listenForIpcMain () {
    ipcMain.on('app-create-editor-window', () => {
      this._createEditorWindow()
    })

    ipcMain.on('screen-capture', async win => {
      if (isOsx) {
        // Use macOs `screencapture` command line when in macOs system.
        const screenshotFileName = await this.getScreenshotFileName()
        exec('screencapture -i -c', async (err) => {
          if (err) {
            log.error(err)
            return
          }
          try {
            // Write screenshot image into screenshot folder.
            const image = clipboard.readImage()
            const bufferImage = image.toPNG()
            await fse.writeFile(screenshotFileName, bufferImage)
          } catch (err) {
            log.error(err)
          }
          win.webContents.send('mt::screenshot-captured')
        })
      } else {
        // TODO: Do nothing, maybe we'll add screenCapture later on Linux and Windows.
        // if (this.shortcutCapture) {
        //   this.launchScreenshotWin = win
        //   this.shortcutCapture.shortcutCapture()
        // }
      }
    })

    ipcMain.on('app-create-settings-window', () => {
      const settingWins = this._windowManager.getWindowsByType(WindowType.SETTING)
      if (settingWins.length >= 1) {
        // A setting window is already created
        const browserSettingWindow = settingWins[0].win.browserWindow
        if (isLinux) {
          browserSettingWindow.focus()
        } else {
          browserSettingWindow.moveTop()
        }
        return
      }
      this._createSettingWindow()
    })

    ipcMain.on('app-open-file-by-id', (windowId, filePath) => {
      const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, [filePath])
      } else {
        const editor = this._windowManager.get(windowId)
        if (editor) {
          editor.openTab(filePath, {}, true)
        }
      }
    })
    ipcMain.on('app-open-files-by-id', (windowId, fileList) => {
      const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, fileList)
      } else {
        const editor = this._windowManager.get(windowId)
        if (editor) {
          editor.openTabsFromPaths(
            fileList.map(p => normalizeMarkdownPath(p))
              .filter(i => i && !i.isDir)
              .map(i => i.path))
        }
      }
    })

    ipcMain.on('app-open-markdown-by-id', (windowId, data) => {
      const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, [], [data])
      } else {
        const editor = this._windowManager.get(windowId)
        if (editor) {
          editor.openUntitledTab(true, data)
        }
      }
    })

    ipcMain.on('app-open-directory-by-id', (windowId, pathname, openInSameWindow) => {
      const { openFolderInNewWindow } = this._accessor.preferences.getAll()
      if (openInSameWindow || !openFolderInNewWindow) {
        const editor = this._windowManager.get(windowId)
        if (editor) {
          editor.openFolder(pathname)
          return
        }
      }
      this._createEditorWindow(pathname)
    })

    // --- renderer -------------------

    ipcMain.on('mt::select-default-directory-to-open', async e => {
      const { preferences } = this._accessor
      const { defaultDirectoryToOpen } = preferences.getAll()
      const win = BrowserWindow.fromWebContents(e.sender)

      const { filePaths } = await dialog.showOpenDialog(win, {
        defaultPath: defaultDirectoryToOpen,
        properties: ['openDirectory', 'createDirectory']
      })
      if (filePaths) {
        preferences.setItems({ defaultDirectoryToOpen: filePaths[0] })
      }
    })

    ipcMain.on('mt::open-setting-window', () => {
      ipcMain.emit('app-create-settings-window')
    })
  }
}

export default App
