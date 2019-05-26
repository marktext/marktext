import path from 'path'
import fse from 'fs-extra'
import log from 'electron-log'
import { exec } from 'child_process'
import { app, ipcMain, systemPreferences, clipboard } from 'electron'
import dayjs from 'dayjs'
import { isLinux, isOsx } from '../config'
import { isDirectory, isMarkdownFileOrLink, normalizeAndResolvePath } from '../filesystem'
import { getMenuItemById } from '../menu'
import { selectTheme } from '../menu/actions/theme'
import { dockMenu } from '../menu/templates'
import { watchers } from '../utils/imagePathAutoComplement'
import EditorWindow from '../windows/editor'
import SettingWindow from '../windows/setting'
import { WindowType } from './windowManager'
// import ShortcutCapture from 'shortcut-capture'

class App {

  /**
   * @param {Accessor} accessor The application accessor for application instances.
   * @param {arg.Result} args Parsed application arguments.
   */
  constructor (accessor, args) {
    this._accessor = accessor
    this._args = args || {_: []}
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

    app.on('open-file', this.openFile) // macOS only

    app.on('ready',  this.ready)

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
      contents.on('will-attach-webview', (event, webPreferences, params) => {
        console.warn('Prevented webview creation.')
        event.preventDefault()
      })
      contents.on('will-navigate', event => {
        console.warn('Prevented opening a link.')
        event.preventDefault()
      })
      contents.on('new-window', (event, url) => {
        console.warn('Prevented opening a new window.')
        event.preventDefault()
      })
    })
  }

  get screenshotFileName () {
    const screenshotFolderPath = this._accessor.dataCenter.getItem('screenshotFolderPath')
    const fileName = `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}-screenshot.png`
    return path.join(screenshotFolderPath, fileName)
  }

  ready = () => {
    const { _args: args } = this
    if (!isOsx && args._.length) {
      for (const pathname of args._) {
        // Ignore all unknown flags
        if (pathname.startsWith('--')) {
          continue
        }

        const info = this.normalizePath(pathname)
        if (info) {
          this._openFilesCache.push(info)
        }
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
          let setedTheme = null
          if (systemPreferences.isDarkMode() && theme !== 'dark') {
            selectTheme('dark')
            setedTheme = 'dark'
          }
          if (!systemPreferences.isDarkMode() && theme === 'dark') {
            selectTheme('light')
            setedTheme = 'light'
          }
          if (setedTheme) {
            const themeMenu = getMenuItemById('themeMenu')
            const menuItem = themeMenu.submenu.items.filter(item => (item.id === setedTheme))[0]
            if (menuItem) {
              menuItem.checked = true
            }
          }
        }
      )
    }

    if (this._openFilesCache.length) {
      this.openFileCache()
    } else {
      this.createEditorWindow()
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
    const info = this.normalizePath(pathname)
    if (info) {
      this._openFilesCache.push(info)

      if (app.isReady()) {
        // It might come more files
        if (this._openFilesTimer) {
          clearTimeout(this._openFilesTimer)
        }
        this._openFilesTimer = setTimeout(() => {
          this._openFilesTimer = null
          this.openFileCache()
        }, 100)
      }
    }
  }

  openFileCache = () => {
    // TODO: Allow to open multiple files in the same window.
    this._openFilesCache.forEach(fileInfo => this.createEditorWindow(fileInfo.path))
    this._openFilesCache.length = 0 // empty the open file path cache
  }

  normalizePath = pathname => {
    const isDir = isDirectory(pathname)
    if (isDir || isMarkdownFileOrLink(pathname)) {
      // Normalize and resolve the path or link target.
      const resolved = normalizeAndResolvePath(pathname)
      if (resolved) {
        return { isDir, path: resolved }
      } else {
        console.error(`[ERROR] Cannot resolve "${pathname}".`)
      }
    }
    return null
  }

  // --- private --------------------------------

  /**
   * Creates a new editor window.
   *
   * @param {string} [pathname] Path to a file, directory or link.
   * @param {string} [markdown] Markdown content.
   * @param {*} [options] BrowserWindow options.
   */
  createEditorWindow (pathname = null, markdown = '', options = {}) {
    const editor = new EditorWindow(this._accessor)
    editor.createWindow(pathname, markdown, options)
    this._windowManager.add(editor)
    if (this._windowManager.windowCount === 1) {
      this._accessor.menu.setActiveWindow(editor.id)
    }
  }
  /**
   * Create a new setting window.
   */
  createSettingWindow () {
    const setting = new SettingWindow(this._accessor)
    setting.createWindow()
    this._windowManager.add(setting)
    if (this._windowManager.windowCount === 1) {
      this._accessor.menu.setActiveWindow(setting.id)
    }
  }

  // TODO(sessions): ...
  // // Make Mark Text a single instance application.
  // _makeSingleInstance() {
  //   if (process.mas) return
  //
  //   app.requestSingleInstanceLock()
  //
  //   app.on('second-instance', (event, argv, workingDirectory) => {
  //     // // TODO: Get active/last active window and open process arvg etc
  //     // if (currentWindow) {
  //     //   if (currentWindow.isMinimized()) currentWindow.restore()
  //     //   currentWindow.focus()
  //     // }
  //   })
  // }

  _listenForIpcMain () {
    ipcMain.on('app-create-editor-window', () => {
      this.createEditorWindow()
    })

    ipcMain.on('screen-capture', win => {
      if (isOsx) {
        // Use macOs `screencapture` command line when in macOs system.
        const { screenshotFileName } = this
        exec(`screencapture -i -c`, async (err) => {
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
        // Do nothing, maybe we'll add screenCapture later on Linux and Windows.
        // if (this.shortcutCapture) {
        //   this.launchScreenshotWin = win
        //   this.shortcutCapture.shortcutCapture()
        // }
      }
    })

    ipcMain.on('app-create-settings-window', () => {
      const settingWins = this._windowManager.windowsOfType(WindowType.SETTING)
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
      this.createSettingWindow()
    })

    // ipcMain.on('app-open-file', filePath => {
    //   const windowId = this._windowManager.getActiveWindow()
    //   ipcMain.emit('app-open-file-by-id', windowId, filePath)
    // })

    ipcMain.on('app-open-file-by-id', (windowId, filePath) => {
      const { openFilesInNewWindow } = this._accessor.preferences.getAll()
      if (openFilesInNewWindow) {
        this.createEditorWindow(filePath)
      } else {
        const editor = this._windowManager.get(windowId)
        if (editor && !editor.quitting) {
          editor.openTab(filePath, true)
        }
      }
    })

    ipcMain.on('app-open-markdown-by-id', (windowId, data) => {
      const { openFilesInNewWindow } = this._accessor.preferences.getAll()
      if (openFilesInNewWindow) {
        this.createEditorWindow(undefined, data)
      } else {
        const editor = this._windowManager.get(windowId)
        if (editor && !editor.quitting) {
          editor.openUntitledTab(true, data)
        }
      }
    })

    ipcMain.on('app-open-directory-by-id', (windowId, pathname) => {
      // TODO: Open the directory in an existing window if prefered.
      this.createEditorWindow(pathname)
    })
  }
}

export default App
