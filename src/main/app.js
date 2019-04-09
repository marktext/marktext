import { app, systemPreferences } from 'electron'
import appWindow from './window'
import { isOsx } from './config'
import { dockMenu } from './menus'
import { isDirectory, isMarkdownFileOrLink, getMenuItemById, normalizeAndResolvePath } from './utils'
import { watchers } from './utils/imagePathAutoComplement'
import { selectTheme } from './actions/theme'
import preference from './preference'

class App {
  constructor () {
    this.openFilesCache = []
  }

  init () {
    // Enable these features to use `backdrop-filter` css rules!
    if (isOsx) {
      app.commandLine.appendSwitch('enable-experimental-web-platform-features', 'true')
    }

    app.on('open-file', this.openFile)

    app.on('ready', this.ready)

    app.on('window-all-closed', () => {
      app.removeListener('open-file', this.openFile)
      // close all the image path watcher
      for (const watcher of watchers.values()) {
        watcher.close()
      }
      if (!isOsx) {
        appWindow.clear()
        app.quit()
      }
    })

    app.on('activate', () => {
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (appWindow.windows.size === 0) {
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
        event.preventDefault();
      });
      contents.on('new-window', (event, url) => {
        console.warn('Prevented opening a new window.')
        event.preventDefault()
      })
    })
  }

  ready = () => {
    if (!isOsx && process.argv.length >= 2) {
      for (const arg of process.argv) {
        if (arg.startsWith('--')) {
          continue
        } else if (isDirectory(arg) || isMarkdownFileOrLink(arg)) {
          // Normalize and resolve the path or link target.
          const resolved = normalizeAndResolvePath(arg)
          if (resolved) {
            // TODO: Allow to open multiple files.
            this.openFilesCache = [ resolved ]
            break
          } else {
            console.error(`[ERROR] Cannot resolve "${arg}".`)
          }
        }
      }
    }

    // Set dock on macOS
    if (process.platform === 'darwin') {
      app.dock.setMenu(dockMenu)

      // Listen for system theme change and change Mark Text own `dark` and `light`.
      // In macOS 10.14 Mojave,  Apple introduced a new system-wide dark mode for
      // all macOS computers.
      systemPreferences.subscribeNotification(
        'AppleInterfaceThemeChangedNotification',
        () => {
          const { theme } = preference.getAll()
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

    if (this.openFilesCache.length) {
      this.openFilesCache.forEach(path => appWindow.createWindow(path))
      this.openFilesCache.length = 0 // empty the open file path cache
    } else {
      appWindow.createWindow()
    }
  }

  openFile = (event, path) => {
    const { openFilesCache } = this
    event.preventDefault()
    if (app.isReady()) {
      appWindow.createWindow(path)
    } else {
      openFilesCache.push(path)
    }
  }
}

export default App
