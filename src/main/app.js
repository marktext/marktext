import path from 'path'
import { app } from 'electron'
import appWindow from './window'
import { isOsx } from './config'
import { dockMenu } from './menus'
import { isDirectory, isMarkdownFile } from './utils'
import { watchers } from './utils/imagePathAutoComplement'

class App {
  constructor () {
    this.openFilesCache = []
  }

  init () {
    // Enable these features to use `backdrop-filter` css rules!
    if (isOsx) {
      app.commandLine.appendSwitch('enable-experimental-web-platform-features', 'true')
    }

    // Enable vscode chrome extension debugger connection
    if (process.env.NODE_ENV === 'development') {
      app.commandLine.appendSwitch('remote-debugging-port', '8315')
    }

    app.on('open-file', this.openFile.bind(this))

    app.on('ready', this.ready.bind(this))

    app.on('window-all-closed', () => {
      app.removeListener('open-file', this.openFile.bind(this))
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

  ready () {
    if (!isOsx && process.argv.length >= 2) {
      for (const arg of process.argv) {
        if (arg.startsWith('--')) {
          continue
        } else if (isDirectory(arg) || isMarkdownFile(arg)) {
          // Normalize path into an absolute path.
          this.openFilesCache = [ path.resolve(arg) ]
          break
        }
      }
    }

    // Set dock on macOS
    if (process.platform === 'darwin') {
      app.dock.setMenu(dockMenu)
    }

    if (this.openFilesCache.length) {
      this.openFilesCache.forEach(path => appWindow.createWindow(path))
      this.openFilesCache.length = 0 // empty the open file path cache
    } else {
      appWindow.createWindow()
    }
  }

  openFile (event, path) {
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
