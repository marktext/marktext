import { ipcMain, shell } from 'electron'
import log from 'electron-log'
import EventEmitter from 'events'
import fsPromises from 'fs/promises'
import { getCurrentKeyboardLayout, getKeyMap, onDidChangeKeyboardLayout } from 'native-keymap'
import os from 'os'
import path from 'path'

let currentKeyboardInfo = null
const loadKeyboardInfo = () => {
  currentKeyboardInfo = {
    layout: getCurrentKeyboardLayout(),
    keymap: getKeyMap()
  }
  return currentKeyboardInfo
}

export const getKeyboardInfo = () => {
  if (!currentKeyboardInfo) {
    return loadKeyboardInfo()
  }
  return currentKeyboardInfo
}

const KEYBOARD_LAYOUT_MONITOR_CHANNEL_ID = 'onDidChangeKeyboardLayout'
class KeyboardLayoutMonitor extends EventEmitter {
  constructor () {
    super()
    this._isSubscribed = false
    this._emitTimer = null
  }

  addListener (callback) {
    this._ensureNativeListener()
    this.on(KEYBOARD_LAYOUT_MONITOR_CHANNEL_ID, callback)
  }

  removeListener (callback) {
    this.removeListener(KEYBOARD_LAYOUT_MONITOR_CHANNEL_ID, callback)
  }

  _ensureNativeListener () {
    if (!this._isSubscribed) {
      this._isSubscribed = true
      onDidChangeKeyboardLayout(() => {
        // The keyboard layout change event may be emitted multiple times.
        clearTimeout(this._emitTimer)
        this._emitTimer = setTimeout(() => {
          this.emit(KEYBOARD_LAYOUT_MONITOR_CHANNEL_ID, loadKeyboardInfo())
          this._emitTimer = null
        }, 150)
      })
    }
  }
}

// Export a single-instance of the monitor.
export const keyboardLayoutMonitor = new KeyboardLayoutMonitor()

export const registerKeyboardListeners = () => {
  ipcMain.handle('mt::keybinding-get-keyboard-info', async () => {
    return getKeyboardInfo()
  })
  ipcMain.on('mt::keybinding-debug-dump-keyboard-info', async () => {
    const dumpPath = path.join(os.tmpdir(), 'marktext_keyboard_info.json')
    const content = JSON.stringify(getKeyboardInfo(), null, 2)
    fsPromises.writeFile(dumpPath, content, 'utf8')
      .then(() => {
        console.log(`Keyboard information written to "${dumpPath}".`)
        shell.openPath(dumpPath)
      })
      .catch(error => {
        log.error('Error dumping keyboard information:', error)
      })
  })
}
