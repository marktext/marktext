import { shell, type BrowserWindow } from 'electron'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import log from 'electron-log'
import { electronLocalshortcut, isValidElectronAccelerator } from '@hfelix/electron-localshortcut'
import { isFile2 } from 'common/filesystem'
import { isEqualAccelerator } from 'common/keybinding'
import { isLinux, isOsx } from '../config'
import { getKeyboardInfo, keyboardLayoutMonitor, type KeyboardInfo } from '../keyboard'
import keybindingsDarwin from './keybindingsDarwin'
import keybindingsLinux from './keybindingsLinux'
import keybindingsWindows from './keybindingsWindows'
import type { CommandManager } from '../commands'

// AppEnvironment is defined elsewhere (cross-batch) — keep loose for now.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppEnvironment = any

type ShortcutCallback = (win: BrowserWindow) => void

class Keybindings {
  configPath: string
  commandManager: CommandManager
  userKeybindings: Map<string, string>
  keys: Map<string, string>

  /**
   * @param commandManager The command manager instance.
   * @param appEnvironment The application environment instance.
   */
  constructor(commandManager: CommandManager, appEnvironment: AppEnvironment) {
    const { userDataPath } = appEnvironment.paths
    this.configPath = path.join(userDataPath, 'keybindings.json')
    this.commandManager = commandManager

    this.userKeybindings = new Map()
    this.keys = this.getDefaultKeybindings()
    this._prepareKeyMapper()

    if (appEnvironment.isDevMode) {
      for (const [id, accelerator] of this.keys) {
        if (!commandManager.has(id)) {
          console.error(
            `[DEBUG] Command with id="${id}" isn't available for accelerator="${accelerator}".`
          )
        }
      }
    }

    // Load user-defined keybindings
    this._loadLocalKeybindings()
  }

  getAccelerator(id: string): string | null {
    const name = this.keys.get(id)
    if (!name) {
      return null
    }
    return name
  }

  registerAccelerator(win: BrowserWindow, accelerator: string, callback: ShortcutCallback): void {
    if (!win || !accelerator || !callback) {
      throw new Error(`addKeyHandler: invalid arguments (accelerator="${accelerator}").`)
    }

    // Register shortcuts on the BrowserWindow instead of using Chromium's native menu.
    // This makes it possible to receive key down events before Chromium/Electron and we
    // can handle reserved Chromium shortcuts. Afterwards prevent the default action of
    // the event so the native menu is not triggered.
    electronLocalshortcut.register(win, accelerator, () => {
      callback(win)
      return true // prevent default action
    })
  }

  unregisterAccelerator(win: BrowserWindow, accelerator: string): void {
    electronLocalshortcut.unregister(win, accelerator)
  }

  registerEditorKeyHandlers(win: BrowserWindow): void {
    for (const [id, accelerator] of this.keys) {
      if (accelerator && accelerator.length > 1) {
        this.registerAccelerator(win, accelerator, () => {
          this.commandManager.execute(id, win)
        })
      }
    }
  }

  openConfigInFileManager(): void {
    const { configPath } = this
    if (!isFile2(configPath)) {
      fs.writeFileSync(configPath, '{\n\n\n}\n', 'utf-8')
    }
    shell.openPath(configPath).catch((err: unknown) => console.error(err))
  }

  getDefaultKeybindings(): Map<string, string> {
    if (isOsx) {
      return keybindingsDarwin
    } else if (isLinux) {
      return keybindingsLinux
    }
    return keybindingsWindows
  }

  /**
   * Returns all user key bindings.
   *
   * @returns User key bindings.
   */
  getUserKeybindings(): Map<string, string> {
    return this.userKeybindings
  }

  /**
   * Sets and saves the given user key bindings on disk.
   *
   * @param userKeybindings New user key bindings.
   */
  async setUserKeybindings(
    userKeybindings: Map<string, string> | Iterable<readonly [string, string]>
  ): Promise<boolean> {
    this.userKeybindings = new Map(userKeybindings)
    return this._saveUserKeybindings()
  }

  // --- private --------------------------------

  _prepareKeyMapper(): void {
    // Update the key mapper to prevent problems on non-US keyboards.
    const { layout, keymap } = getKeyboardInfo()
    electronLocalshortcut.setKeyboardLayout(layout, keymap)

    // Notify key mapper when the keyboard layout was changed.
    keyboardLayoutMonitor.addListener(({ layout, keymap }: KeyboardInfo) => {
      const globalDebug = (globalThis as typeof globalThis & { MARKTEXT_DEBUG?: boolean })
        .MARKTEXT_DEBUG
      if (globalDebug && process.env.MARKTEXT_DEBUG_KEYBOARD) {
        console.log('[DEBUG] Keyboard layout changed:\n', layout)
      }
      electronLocalshortcut.setKeyboardLayout(layout, keymap)
    })
  }

  async _saveUserKeybindings(): Promise<boolean> {
    const { configPath, userKeybindings } = this
    try {
      const userKeybindingJson = JSON.stringify(Object.fromEntries(userKeybindings), null, 2)
      await fsPromises.writeFile(configPath, userKeybindingJson, 'utf8')
      return true
    } catch {
      return false
    }
  }

  _loadLocalKeybindings(): void {
    const safeMode = (globalThis as typeof globalThis & { MARKTEXT_SAFE_MODE?: boolean })
      .MARKTEXT_SAFE_MODE
    if (safeMode || !isFile2(this.configPath)) {
      return
    }

    const rawUserKeybindings = this._loadUserKeybindingsFromDisk()
    if (!rawUserKeybindings) {
      log.warn('Invalid keybinding configuration: failed to load or parse file.')
      return
    }

    // keybindings.json example:
    // {
    //   "file.save": "CmdOrCtrl+S",
    //   "file.save-as": "CmdOrCtrl+Shift+S"
    // }

    const userAccelerators: Map<string, string> = new Map()
    for (const key in rawUserKeybindings) {
      if (this.keys.has(key)) {
        const value = rawUserKeybindings[key]
        if (typeof value === 'string') {
          if (value.length === 0) {
            // Unset key
            userAccelerators.set(key, '')
          } else if (isValidElectronAccelerator(value)) {
            userAccelerators.set(key, value)
          } else {
            console.error(`[WARNING] "${value}" is not a valid accelerator.`)
          }
        }
      }
    }

    // Check for duplicate user shortcuts
    for (const [keyA, valueA] of userAccelerators) {
      for (const [keyB, valueB] of userAccelerators) {
        if (valueA !== '' && keyA !== keyB && isEqualAccelerator(valueA, valueB)) {
          const err = `Invalid keybindings.json configuration: Duplicate value for "${keyA}" and "${keyB}"!`
          console.log(err)
          log.error(err)
          return
        }
      }
    }

    if (userAccelerators.size === 0) {
      return
    }

    // Deep clone shortcuts
    const accelerators = new Map(this.keys)

    // Check for duplicate shortcuts
    for (const [userKey, userValue] of userAccelerators) {
      // Only search for conflicts when the user actually bound a key. Empty means "unbound"
      // and would incorrectly match any other default-empty entry via isEqualAccelerator.
      if (userValue) {
        for (const [key, value] of accelerators) {
          // This is a workaround to unset key bindings that the user used in `keybindings.json` before
          // proper settings. Keep this for now, but add the ID to the users key binding that we show the
          // right bindings in settings.
          if (isEqualAccelerator(value, userValue)) {
            // Unset default key
            accelerators.set(key, '')

            // This entry is actually unset because the user used the accelerator.
            if (userAccelerators.get(key) == null) {
              userAccelerators.set(key, '')
            }

            // A accelerator should only exist once in the default map.
            break
          }
        }
      }
      accelerators.set(userKey, userValue)
    }

    // Update key bindings
    this.keys = accelerators

    // Save user keybindings for settings
    this.userKeybindings = userAccelerators
  }

  _loadUserKeybindingsFromDisk(): Record<string, unknown> | null {
    try {
      const obj = JSON.parse(fs.readFileSync(this.configPath, 'utf8'))
      if (typeof obj !== 'object') {
        return null
      }
      return obj
    } catch {
      return null
    }
  }
}

export default Keybindings
