import { Menu } from 'electron'
import fs from 'fs-extra'
import path from 'path'
import log from 'electron-log'
import isAccelerator from 'electron-is-accelerator'
import electronLocalshortcut from '@hfelix/electron-localshortcut'
import { isFile } from 'common/filesystem'
import { isOsx } from '../config'
import { getKeyboardLanguage, getVirtualLetters } from '../keyboard'

// Problematic key bindings:
//   Aidou: Ctrl+/ -> dead key
//   Inline Code: Ctrl+` -> dead key
//   Upgrade Heading: Ctrl+= -> points to Ctrl+Plus which is ok; Ctrl+Plus is broken

class Keybindings {

  /**
   * @param {string} userDataPath The user data path.
   */
  constructor (userDataPath) {
    this.configPath = path.join(userDataPath, 'keybindings.json')

    this.keys = new Map([
      // marktext - macOS only
      ['mtHide', 'Command+H'],
      ['mtHideOthers', 'Command+Alt+H'],

      // file menu
      ['fileNewFile', 'CmdOrCtrl+N'],
      ['fileNewTab', 'CmdOrCtrl+Shift+T'],
      ['fileOpenFile', 'CmdOrCtrl+O'],
      ['fileOpenFolder', 'CmdOrCtrl+Shift+O'],
      ['fileSave', 'CmdOrCtrl+S'],
      ['fileSaveAs', 'CmdOrCtrl+Shift+S'],
      ['filePrint', 'CmdOrCtrl+P'],
      ['filePreferences', 'CmdOrCtrl+,'], // marktext menu in macOS
      ['fileCloseTab', 'CmdOrCtrl+W'],
      ['fileCloseWindow', 'CmdOrCtrl+Shift+W'],
      ['fileQuit', 'CmdOrCtrl+Q'],

      // edit menu
      ['editUndo', 'CmdOrCtrl+Z'],
      ['editRedo', 'CmdOrCtrl+Shift+Z'],
      ['editCut', 'CmdOrCtrl+X'],
      ['editCopy', 'CmdOrCtrl+C'],
      ['editPaste', 'CmdOrCtrl+V'],
      ['editCopyAsMarkdown', 'CmdOrCtrl+Shift+C'],
      ['editCopyAsPlaintext', 'CmdOrCtrl+Shift+V'],
      ['editSelectAll', 'CmdOrCtrl+A'],
      ['editDuplicate', 'Shift+CmdOrCtrl+P'],
      ['editCreateParagraph', 'Shift+CmdOrCtrl+N'],
      ['editDeleteParagraph', 'Shift+CmdOrCtrl+D'],
      ['editFind', 'CmdOrCtrl+F'],
      ['editFindNext', 'CmdOrCtrl+Alt+U'],
      ['editFindPrevious', 'CmdOrCtrl+Shift+U'],
      ['editReplace', 'CmdOrCtrl+Alt+F'],
      ['editAidou', 'CmdOrCtrl+/'],
      ['editScreenshot', 'CmdOrCtrl+Alt+A'],

      // paragraph menu
      ['paragraphHeading1', 'CmdOrCtrl+1'],
      ['paragraphHeading2', 'CmdOrCtrl+2'],
      ['paragraphHeading3', 'CmdOrCtrl+3'],
      ['paragraphHeading4', 'CmdOrCtrl+4'],
      ['paragraphHeading5', 'CmdOrCtrl+5'],
      ['paragraphHeading6', 'CmdOrCtrl+6'],
      ['paragraphUpgradeHeading', 'CmdOrCtrl+='],
      ['paragraphDegradeHeading', 'CmdOrCtrl+-'],
      ['paragraphTable', 'CmdOrCtrl+T'],
      ['paragraphCodeFence', 'CmdOrCtrl+Alt+C'],
      ['paragraphQuoteBlock', 'CmdOrCtrl+Alt+Q'],
      ['paragraphMathBlock', 'CmdOrCtrl+Alt+M'],
      ['paragraphHtmlBlock', isOsx ? 'CmdOrCtrl+Alt+J' : 'CmdOrCtrl+Alt+H'],
      ['paragraphOrderList', 'CmdOrCtrl+Alt+O'],
      ['paragraphBulletList', 'CmdOrCtrl+Alt+U'],
      ['paragraphTaskList', 'CmdOrCtrl+Alt+X'],
      ['paragraphLooseListItem', 'CmdOrCtrl+Alt+L'],
      ['paragraphParagraph', 'CmdOrCtrl+0'],
      ['paragraphHorizontalLine', 'CmdOrCtrl+Alt+-'],
      ['paragraphYAMLFrontMatter', 'CmdOrCtrl+Alt+Y'],

      // format menu
      ['formatStrong', 'CmdOrCtrl+B'],
      ['formatEmphasis', 'CmdOrCtrl+I'],
      ['formatUnderline', 'CmdOrCtrl+U'],
      ['formatInlineCode', 'CmdOrCtrl+`'],
      ['formatInlineMath', 'Ctrl+M'],
      ['formatStrike', 'CmdOrCtrl+D'],
      ['formatHyperlink', 'CmdOrCtrl+L'],
      ['formatImage', 'CmdOrCtrl+Shift+I'],
      ['formatClearFormat', 'Shift+CmdOrCtrl+R'],

      // window menu
      ['windowMinimize', ''], // 'CmdOrCtrl+M' deprecated for math

      // view menu
      ['viewToggleFullScreen', isOsx ? 'Ctrl+Command+F' : 'F11'],
      ['viewSourceCodeMode', 'CmdOrCtrl+Alt+S'],
      ['viewTypewriterMode', 'CmdOrCtrl+Alt+T'],
      ['viewFocusMode', 'CmdOrCtrl+Shift+F'],
      ['viewToggleSideBar', 'CmdOrCtrl+J'],
      ['viewToggleTabBar', 'CmdOrCtrl+Alt+B'],
      ['viewDevToggleDeveloperTools', 'CmdOrCtrl+Alt+I'],
      ['viewDevReload', 'CmdOrCtrl+R']
    ])

    // fix non-US keyboards
    this.mnemonics = new Map()
    this._fixLayout()

    // load user-defined keybindings
    this._loadLocalKeybindings()
  }

  getAccelerator (id) {
    const name = this.keys.get(id)
    if (!name) {
      return ''
    }
    return name
  }

  registerKeyHandlers (win, acceleratorMap) {
    for (const item of acceleratorMap) {
      let { accelerator } = item

      // Fix broken shortcuts because of dead keys or non-US keyboard problems. We bind the
      // shortcut to another accelerator because of key mapping issues. E.g: 'Alt+/' is not
      // available on a German keyboard, because you have to press 'Shift+7' to produce '/'.
      // In this case we can remap the accelerator to 'Alt+7' or 'Ctrl+Shift+7'.
      const acceleratorFix = this.mnemonics.get(accelerator)
      if (acceleratorFix) {
        accelerator = acceleratorFix
      }

      // Regisiter shortcuts on the BrowserWindow instead of using Chromium's native menu.
      // This makes it possible to receive key down events before Chromium/Electron and we
      // can handle reserved Chromium shortcuts. Afterwards prevent the default action of
      // the event so the native menu is not triggered.
      electronLocalshortcut.register(win, accelerator, () => {
        if (global.MARKTEXT_DEBUG && process.env.MARKTEXT_DEBUG_KEYBOARD) {
          console.log(`You pressed ${accelerator}`)
        }
        callMenuCallback(item, win)
        return true // prevent default action
      })
    }
  }

  // --- private --------------------------------

  _fixLayout () {
    // fix wrong virtual key mapping on non-QWERTY layouts
    electronLocalshortcut.updateVirtualKeys(getVirtualLetters())

    // fix broken shortcuts and dead keys
    const lang = getKeyboardLanguage()
    switch (lang) {
      // fix aidou and inline code
      case 'ch':
      case 'de':
      case 'dk':
      case 'fi':
      case 'no':
      case 'se':
        this._fixInlineCode()

        if (!isOsx) {
          this._fixAidou()
        }
        break

      // fix aidou only
      case 'es':
      case 'fr':
      case 'hr':
      case 'it':
      case 'pl':
      case 'pt':
        if (!isOsx) {
          this._fixAidou()
        }
        break

      // custom layouts
      case 'bg':
        if (!isOsx) {
          this.mnemonics.set('CmdOrCtrl+/', 'CmdOrCtrl+8')
          this._fixInlineCode()
        }
        break
    }
  }

  _fixAidou () {
    this.mnemonics.set('CmdOrCtrl+/', 'CmdOrCtrl+7')
  }

  // fix dead backquote key on layouts like German
  _fixInlineCode () {
    this.keys.set('formatInlineCode', 'CmdOrCtrl+Shift+B')
  }

  _loadLocalKeybindings () {
    if (global.MARKTEXT_SAFE_MODE || !isFile(this.configPath)) {
      return
    }

    const json = fs.readJsonSync(this.configPath, { throws: false })
    if (!json || typeof json !== 'object') {
      log.warn('Invalid keybindings.json configuration.')
      return
    }

    // keybindings.json example:
    // {
    //   "fileSave": "CmdOrCtrl+S",
    //   "fileSaveAs": "CmdOrCtrl+Shift+S"
    // }

    const userAccelerators = new Map()
    for (const key in json) {
      if (this.keys.has(key)) {
        const value = json[key]
        if (typeof value === 'string') {
          if (value.length === 0) {
            // unset key
            this.keys.set(key, '')
          } else if (isAccelerator(value)) {
            // id / accelerator
            userAccelerators.set(key, value)
          }
        }
      }
    }

    if (userAccelerators.size === 0) {
      return
    }

    // deep clone shortcuts and unset user shortcuts
    const accelerators = new Map(this.keys)
    userAccelerators.forEach((value, key) => {
      accelerators.set(key, '')
    })

    // check for duplicate shortcuts
    for (const [userKey, userValue] of userAccelerators) {
      for (const [key, value] of accelerators) {
        if (this._isEqualAccelerator(value, userValue)) {
          const err = `Invalid keybindings.json configuration: Duplicate key ${userKey} - ${key}`
          console.log(err)
          log.error(err)
          return
        }
      }
      accelerators.set(userKey, userValue)
    }

    // update key bindings
    this.keys = accelerators
  }

  _isEqualAccelerator (a, b) {
    a = a.toLowerCase().replace('cmdorctrl', 'ctrl').replace('command', 'ctrl')
    b = b.toLowerCase().replace('cmdorctrl', 'ctrl').replace('command', 'ctrl')
    const i1 = a.indexOf('+')
    const i2 = b.indexOf('+')
    if (i1 === -1 && i2 === -1) {
      return a === b
    } else if (i1 === -1 || i2 === -1) {
      return false
    }

    const keysA = a.split('+')
    const keysB = b.split('+')
    const intersection = new Set([...keysA, ...keysB])
    return intersection.size === keysB.length
  }
}

export const parseMenu = menuTemplate => {
  const { submenu, accelerator, click, id, visible } = menuTemplate
  let items = []
  if (Array.isArray(menuTemplate)) {
    for (const item of menuTemplate) {
      const subitems = parseMenu(item)
      if (subitems) items.push(...subitems)
    }
  } else if (submenu) {
    const subitems = parseMenu(submenu)
    if (subitems) items.push(...subitems)
  } else if ((visible === undefined || visible) && accelerator && click) {
    items.push({
      accelerator,
      click,
      id // may be null
    })
  }
  return items.length === 0 ? null : items
}

const callMenuCallback = (menuInfo, win) => {
  const { click, id } = menuInfo
  if (click) {
    let menuItem = null
    if (id) {
      const menus = Menu.getApplicationMenu()
      menuItem = menus.getMenuItemById(id)
    }
    // Allow all shortcuts/menus without id and only enabled menus with id (GH#980).
    if (!menuItem || menuItem.enabled !== false) {
      click(menuItem, win)
    }
  } else {
    console.error('ERROR: callback function is not defined.')
  }
}

export default Keybindings
