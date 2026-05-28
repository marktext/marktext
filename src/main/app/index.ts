import path from 'path'
import fsPromises from 'fs/promises'
import { exec } from 'child_process'
import dayjs from 'dayjs'
import log from 'electron-log'
import { app, BrowserWindow, clipboard, dialog, nativeTheme, shell, ipcMain } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'
import { isChildOfDirectory } from 'common/filesystem/paths'
import { isLinux, isOsx, isWindows } from '../config'
import parseArgs from '../cli/parser'
import { normalizeAndResolvePath } from '../filesystem'
import { normalizeMarkdownPath } from '../filesystem/markdown'
import { registerKeyboardListeners } from '../keyboard'
import { selectTheme } from '../menu/actions/theme'
import { dockMenu } from '../menu/templates'
import registerSpellcheckerListeners from '../spellchecker'
import { watchers } from '../utils/imagePathAutoComplement'
import { WindowType } from '../windows/base'
import EditorWindow from '../windows/editor'
import SettingWindow from '../windows/setting'
import { setLanguage } from '../i18n'
import { getNativeThemeSource, isDarkApplicationTheme } from './nativeTheme'
import type Accessor from './accessor'

interface CliArgs {
  _: string[]
  [flag: string]: unknown
}

interface PathInfo {
  isDir: boolean
  path: string
}

class App {
  private _accessor: Accessor
  private _args: CliArgs
  private _openFilesCache: PathInfo[]
  private _openFilesTimer: ReturnType<typeof setTimeout> | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _windowManager: any
  private _themeListenerRegistered: boolean

  /**
   * @param accessor The application accessor for application instances.
   * @param args Parsed application arguments.
   */
  constructor(accessor: Accessor, args: Partial<CliArgs>) {
    this._accessor = accessor
    this._args = (args as CliArgs) || ({ _: [] } as CliArgs)
    this._openFilesCache = []
    this._openFilesTimer = null
    this._windowManager = this._accessor.windowManager
    // this.launchScreenshotWin = null // The window which call the screenshot.
    // this.shortcutCapture = null

    // Initialize main process language
    this._initializeLanguage()
    this._listenForIpcMain()
    // Initialize theme listener
    this._themeListenerRegistered = false
  }

  /**
   * The entry point into the application.
   */
  init(): void {
    // Enable these features to use `backdrop-filter` css rules!
    if (isOsx) {
      app.commandLine.appendSwitch('enable-experimental-web-platform-features', 'true')
    }

    app.on('second-instance', (_event, argv, workingDirectory) => {
      const { _openFilesCache, _windowManager } = this
      const args = parseArgs(argv.slice(1)) as CliArgs

      const buf: PathInfo[] = []
      for (const pathname of args._) {
        // Ignore all unknown flags
        if (pathname.startsWith('--')) {
          continue
        }

        const info = normalizeMarkdownPath(path.resolve(workingDirectory, pathname))
        if (info) {
          buf.push(info as PathInfo)
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

    app.on('activate', () => {
      // macOS only
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (this._windowManager.windowCount === 0) {
        this.ready()
      }
    })

    // Prevent to load webview and opening links or new windows via HTML/JS.
    app.on('web-contents-created', (_event, contents) => {
      contents.on('will-attach-webview', (event) => {
        event.preventDefault()
      })
      contents.on('will-navigate', (event) => {
        event.preventDefault()
      })
      contents.setWindowOpenHandler(() => {
        return { action: 'deny' }
      })
    })
  }

  /**
   * Initialize main process language from preferences
   */
  private async _initializeLanguage(): Promise<void> {
    try {
      let currentLanguage = this._accessor.preferences.getItem('language')

      // If no language is set, auto-detect based on the system language
      if (!currentLanguage) {
        const systemLanguage = app.getLocale()
        log.info(`System language detected: ${systemLanguage}`)

        // Supported language list (based on languages actually supported by the project)
        const supportedLanguages = [
          'en',
          'zh-CN',
          'zh-TW',
          'ja',
          'ko',
          'fr',
          'de',
          'es',
          'pt',
          'ru'
        ]

        // Language mapping: system language code -> application language code
        const languageMap: Record<string, string> = {
          'zh-CN': 'zh-CN',
          'zh-TW': 'zh-TW',
          'zh-HK': 'zh-TW',
          zh: 'zh-CN',
          en: 'en',
          'en-US': 'en',
          'en-GB': 'en',
          ja: 'ja',
          'ja-JP': 'ja',
          ko: 'ko',
          'ko-KR': 'ko',
          fr: 'fr',
          'fr-FR': 'fr',
          de: 'de',
          'de-DE': 'de',
          es: 'es',
          'es-ES': 'es',
          pt: 'pt',
          'pt-BR': 'pt',
          ru: 'ru',
          'ru-RU': 'ru'
        }

        currentLanguage = languageMap[systemLanguage] || 'en'

        // If the detected language is not in the supported list, use English
        if (!supportedLanguages.includes(currentLanguage)) {
          currentLanguage = 'en'
        }

        // Save the detected language setting
        this._accessor.preferences.setItem('language', currentLanguage)
        log.info(`Auto-detected and set language to: ${currentLanguage}`)
      }

      setLanguage(currentLanguage)
      log.info(`Main process language initialized to: ${currentLanguage}`)
    } catch (error) {
      log.error('Failed to initialize main process language:', error)
      // If an error occurs, use English as the default language
      setLanguage('en')
    }
  }

  async getScreenshotFileName(): Promise<string> {
    const screenshotFolderPath = await this._accessor.dataCenter.getItem('screenshotFolderPath')
    const fileName = `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}-screenshot.png`
    return path.join(screenshotFolderPath, fileName)
  }

  ready = (): void => {
    const { _args: args, _openFilesCache } = this
    const { preferences, editorBufferStore } = this._accessor

    // Initialize language settings
    const {
      startUpAction,
      defaultDirectoryToOpen,
      followSystemTheme,
      lastOpenedFolder,
      lightModeTheme,
      darkModeTheme,
      theme,
      language
    } = preferences.getAll()

    if (language) {
      setLanguage(language)
    }

    if (args._.length) {
      for (const pathname of args._) {
        // Ignore all unknown flags
        if (pathname.startsWith('--')) {
          continue
        }

        const info = normalizeMarkdownPath(pathname)
        if (info) {
          _openFilesCache.push(info as PathInfo)
        }
      }
    }

    // We should NOT restore the previous buffer or open a folder if the user just wants to double click to open a file
    let isRestorePathway = false
    if (_openFilesCache.length === 0) {
      if (startUpAction === 'restoreAll') {
        // Restore based off the previous buffer
        isRestorePathway = true
      } else if (startUpAction === 'folder' && defaultDirectoryToOpen) {
        const info = normalizeMarkdownPath(defaultDirectoryToOpen)
        if (info) {
          _openFilesCache.unshift(info as PathInfo)
        }
      } else if (startUpAction === 'openLastFolder' && lastOpenedFolder) {
        const info = normalizeMarkdownPath(lastOpenedFolder)
        if (info) {
          _openFilesCache.unshift(info as PathInfo)
        }
      }
    }

    nativeTheme.themeSource = getNativeThemeSource({ followSystemTheme, theme })

    // Apply theme at startup if "Follow system theme" is enabled
    const isDarkTheme = isDarkApplicationTheme(theme)
    const systemIsDark = nativeTheme.shouldUseDarkColors

    if (followSystemTheme && isDarkTheme !== systemIsDark) {
      const newTheme = systemIsDark ? darkModeTheme : lightModeTheme
      log.info(
        `Following system theme at startup: ${newTheme} (system ${systemIsDark ? 'dark' : 'light'})`
      )
      selectTheme(newTheme)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcMain.on('broadcast-preferences-changed', (change: any) => {
      const nextPreferences = {
        ...preferences.getAll(),
        ...change
      }
      nativeTheme.themeSource = getNativeThemeSource(nextPreferences)

      // When followSystemTheme is enabled, immediately switch to match system
      if (change.followSystemTheme === true) {
        const systemIsDark = nativeTheme.shouldUseDarkColors
        const { lightModeTheme, darkModeTheme } = preferences.getAll()
        const newTheme = systemIsDark ? darkModeTheme : lightModeTheme

        log.info(
          `followSystemTheme enabled, switching to: ${newTheme} (system ${systemIsDark ? 'dark' : 'light'})`
        )
        selectTheme(newTheme)
        preferences.setItem('theme', newTheme)
      }
      // When light/dark mode theme preferences change, apply immediately if following system
      if (
        preferences.getItem('followSystemTheme') &&
        (change.lightModeTheme || change.darkModeTheme)
      ) {
        const systemIsDark = nativeTheme.shouldUseDarkColors

        // Get current values, but prefer the NEW values from the change event
        let { lightModeTheme, darkModeTheme } = preferences.getAll()

        // If these preferences were just changed, use the new values from the change object
        if (change.lightModeTheme !== undefined) {
          lightModeTheme = change.lightModeTheme
        }
        if (change.darkModeTheme !== undefined) {
          darkModeTheme = change.darkModeTheme
        }

        const newTheme = systemIsDark ? darkModeTheme : lightModeTheme

        log.info(`Theme preference changed, applying: ${newTheme}`)
        selectTheme(newTheme)
        preferences.setItem('theme', newTheme)
      }
    })

    // Listen for system theme changes and auto-switch if enabled
    if (!this._themeListenerRegistered) {
      nativeTheme.on('updated', () => {
        const { followSystemTheme, lightModeTheme, darkModeTheme } = preferences.getAll()

        if (followSystemTheme) {
          const systemIsDark = nativeTheme.shouldUseDarkColors
          const newTheme = systemIsDark ? darkModeTheme : lightModeTheme
          const currentTheme = preferences.getItem('theme')

          // Only switch if the theme actually needs to change
          if (newTheme !== currentTheme) {
            log.info(
              `System theme changed, switching to: ${newTheme} (system ${systemIsDark ? 'dark' : 'light'})`
            )
            selectTheme(newTheme)
            preferences.setItem('theme', newTheme)
          }
        }
      })
      this._themeListenerRegistered = true
    }

    if (isOsx) {
      app.dock?.setMenu(dockMenu)
    } else if (isWindows) {
      app.setJumpList([
        {
          type: 'recent'
        },
        {
          type: 'tasks',
          items: [
            {
              type: 'task',
              title: 'New Window',
              description: 'Opens a new window',
              program: process.execPath,
              args: '--new-window',
              iconPath: process.execPath,
              iconIndex: 0
            }
          ]
        }
      ])
    }

    const createWindow = (): void => {
      if (isRestorePathway) {
        // We will restore based off the previous buffer, one window per buffer store file
        const bufferStores = editorBufferStore.getAll()
        const bufferStoreList = Object.values(bufferStores) as Array<{
          id: string
          filePath: string | null
        }>
        if (bufferStoreList.length === 0) {
          this._createEditorWindow()
          return
        }

        bufferStoreList.forEach((bufferStoreInfo) => {
          // Read the buffer store file and pass the content
          this._createEditorWindow(null, [], [], {}, bufferStoreInfo)
        })
      } else if (_openFilesCache.length) {
        // We should wipe the buffer store if not it will keep creating new windows whenever we open files via double click in the file manager
        editorBufferStore.clearBufferStoresWithAllSaved()
        this._openFilesToOpen()
      } else {
        this._createEditorWindow()
      }
    }

    if (isLinux) {
      let windowCreated = false

      const createWindowOnce = (): void => {
        if (windowCreated) return
        windowCreated = true
        createWindow()
      }

      // Wait for theme to settle (Linux-specific issue?)
      nativeTheme.once('updated', createWindowOnce)
      // Fallback timeout in case 'updated' never fires (no theme change)
      setTimeout(createWindowOnce, 150)
    } else {
      // Create immediately on Windows/macOS
      createWindow()
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

  openFile = (event: Electron.Event, pathname: string): void => {
    event.preventDefault()
    const info = normalizeMarkdownPath(pathname)
    if (info) {
      this._openFilesCache.push(info as PathInfo)

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
   */
  private _createEditorWindow(
    rootDirectory: string | null = null,
    fileList: string[] = [],
    markdownList: string[] = [],
    options: Partial<BrowserWindowConstructorOptions> = {},
    bufferStoreInfo: { id: string; filePath: string | null } | null = null
  ): EditorWindow {
    const editor = new EditorWindow(this._accessor)
    if (rootDirectory) {
      this._accessor.preferences.setItems({ lastOpenedFolder: rootDirectory })
    }
    editor.createWindow(rootDirectory, fileList, markdownList, options, bufferStoreInfo)
    this._windowManager.add(editor)
    if (this._windowManager.windowCount === 1) {
      this._accessor.menu.setActiveWindow(editor.id)
    }
    return editor
  }

  /**
   * Create a new setting window.
   */
  private _createSettingWindow(category?: string | null): void {
    const setting = new SettingWindow(this._accessor)
    setting.createWindow(category ?? null)
    this._windowManager.add(setting)
    if (this._windowManager.windowCount === 1) {
      this._accessor.menu.setActiveWindow(setting.id)
    }
  }

  private _openFilesToOpen(): void {
    this._openPathList(this._openFilesCache, false)
  }

  /**
   * Open the path list in the best window(s).
   *
   * @param pathsToOpen The path list to open.
   * @param openFilesInSameWindow Open all files in the same window with
   * the first directory and discard other directories.
   */
  private _openPathList(pathsToOpen: PathInfo[], openFilesInSameWindow: boolean = false): void {
    const { _windowManager } = this
    const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')

    const fileSet = new Set<string>()
    const directorySet = new Set<string>()
    for (const { isDir, path } of pathsToOpen) {
      if (isDir) {
        directorySet.add(path)
      } else {
        fileSet.add(path)
      }
    }

    // Filter out directories that are already opened.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const window of _windowManager.windows.values() as Iterable<any>) {
      if (window.type === WindowType.EDITOR) {
        const { openedRootDirectory } = window
        if (directorySet.has(openedRootDirectory)) {
          window.bringToFront()
          directorySet.delete(openedRootDirectory)
        }
      }
    }

    const directoriesToOpen: { rootDirectory: string | null; fileList: string[] }[] = Array.from(
      directorySet
    ).map((dir) => ({
      rootDirectory: dir,
      fileList: []
    }))
    const filesToOpen = Array.from(fileSet)

    // Discard all directories except first one and add files.
    if (openFilesInSameWindow) {
      if (directoriesToOpen.length) {
        directoriesToOpen[0].fileList.push(...filesToOpen)
        directoriesToOpen.length = 1
      } else {
        directoriesToOpen.push({ rootDirectory: null, fileList: [...filesToOpen] })
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
          if (isChildOfDirectory(rootDirectory ?? '', pathname)) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const item of windowList as any[]) {
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

  private _openSettingsWindow(category?: string | null): void {
    const settingWins = this._windowManager.getWindowsByType(WindowType.SETTINGS)
    if (settingWins.length >= 1) {
      // A setting window is already created
      const browserSettingWindow = settingWins[0].win.browserWindow
      browserSettingWindow.webContents.send('settings::change-tab', category)
      if (isLinux) {
        browserSettingWindow.focus()
      } else {
        browserSettingWindow.moveTop()
      }
      return
    }
    this._createSettingWindow(category)
  }

  private _listenForIpcMain(): void {
    registerKeyboardListeners()
    registerSpellcheckerListeners()

    // Handle language setting requests
    ipcMain.on('mt::get-current-language', (event) => {
      const { language } = this._accessor.preferences.getAll()
      event.reply('mt::current-language', language || 'en')
    })

    ipcMain.on('app-create-editor-window', () => {
      this._createEditorWindow()
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcMain.on('screen-capture', async(win: any) => {
      if (isOsx) {
        // Use macOs `screencapture` command line when in macOs system.
        const screenshotFileName = await this.getScreenshotFileName()
        exec('screencapture -i -c', async(err) => {
          if (err) {
            log.error(err)
            return
          }
          try {
            // Write screenshot image into screenshot folder.
            const image = clipboard.readImage()
            const bufferImage = image.toPNG()
            await fsPromises.writeFile(screenshotFileName, bufferImage)
          } catch (writeErr) {
            log.error(writeErr)
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcMain.on('app-create-settings-window', (category: any) => {
      this._openSettingsWindow(category as string | undefined)
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcMain.on('app-open-file-by-id', (windowId: any, filePath: any) => {
      const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, [filePath as string])
      } else {
        const editor = this._windowManager.get(windowId as number)
        if (editor) {
          editor.openTab(filePath, {}, true)
        }
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcMain.on('app-open-files-by-id', (windowId: any, fileList: any) => {
      const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, fileList as string[])
      } else {
        const editor = this._windowManager.get(windowId as number)
        if (editor) {
          editor.openTabsFromPaths(
            (fileList as string[])
              .map((p) => normalizeMarkdownPath(p))
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((i: any) => i && !i.isDir)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((i: any) => i.path)
          )
        }
      }
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcMain.on('app-open-markdown-by-id', (windowId: any, data: any) => {
      const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, [], [data as string])
      } else {
        const editor = this._windowManager.get(windowId as number)
        if (editor) {
          editor.openUntitledTab(true, data as string)
        }
      }
    })

    ipcMain.on(
      'app-open-directory-by-id',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (windowId: any, pathname: any, openInSameWindow: any) => {
        const { openFolderInNewWindow } = this._accessor.preferences.getAll()
        if (openInSameWindow || !openFolderInNewWindow) {
          const editor = this._windowManager.get(windowId as number)
          if (editor) {
            editor.openFolder(pathname as string)
            return
          }
        }
        this._createEditorWindow(pathname as string)
      }
    )

    // --- renderer -------------------

    ipcMain.on('mt::app-try-quit', () => {
      app.quit()
    })

    ipcMain.on('mt::open-file-by-window-id', (_e, windowId: number, filePath: string) => {
      const resolvedPath = normalizeAndResolvePath(filePath)
      const openFilesInNewWindow = this._accessor.preferences.getItem('openFilesInNewWindow')
      if (openFilesInNewWindow) {
        this._createEditorWindow(null, [resolvedPath])
      } else {
        const editor = this._windowManager.get(windowId)
        if (editor) {
          editor.openTab(resolvedPath, {}, true)
        }
      }
    })

    ipcMain.on('mt::select-default-directory-to-open', async(e) => {
      const { preferences } = this._accessor
      const { defaultDirectoryToOpen } = preferences.getAll()
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return

      const { filePaths } = await dialog.showOpenDialog(win, {
        defaultPath: defaultDirectoryToOpen,
        properties: ['openDirectory', 'createDirectory']
      })
      if (filePaths && filePaths[0]) {
        preferences.setItems({ defaultDirectoryToOpen: filePaths[0] })
      }
    })

    ipcMain.on('mt::open-setting-window', () => {
      this._openSettingsWindow()
    })

    ipcMain.on('mt::make-screenshot', (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      ipcMain.emit('screen-capture', win)
    })

    ipcMain.on('mt::request-keybindings', (e) => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return
      const { keybindings } = this._accessor
      // Convert map to object
      win.webContents.send('mt::keybindings-response', Object.fromEntries(keybindings.keys))
    })

    ipcMain.on('mt::open-keybindings-config', () => {
      const { keybindings } = this._accessor
      keybindings.openConfigInFileManager()
    })

    ipcMain.handle('mt::keybinding-get-pref-keybindings', () => {
      const { keybindings } = this._accessor
      const defaultKeybindings = keybindings.getDefaultKeybindings()
      const userKeybindings = keybindings.getUserKeybindings()
      return { defaultKeybindings, userKeybindings }
    })

    ipcMain.handle('mt::keybinding-save-user-keybindings', async(_event, userKeybindings) => {
      const { keybindings } = this._accessor
      return keybindings.setUserKeybindings(userKeybindings)
    })

    ipcMain.handle('mt::fs-trash-item', async(_event, fullPath: string) => {
      return shell.trashItem(fullPath)
    })
  }
}

export default App
