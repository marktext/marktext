import { app } from 'electron'
import appMenu from './menu'
import appWindow from './window'
import { isOsx } from './config'
import { isMarkdownFile } from './utils'
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
  }

  ready () {
    if (!isOsx && process.argv.length >= 2) {
      for (const arg of process.argv) {
        if (isMarkdownFile(arg)) {
          this.openFilesCache = [arg]
          break
        }
      }
    }

    if (this.openFilesCache.length) {
      this.openFilesCache.forEach(path => appWindow.createWindow(path))
      this.openFilesCache.length = 0 // empty the open file path cache
    } else {
      appWindow.createWindow()
    }
    appMenu.updateAppMenu()
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
