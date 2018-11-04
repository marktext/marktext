import { Menu } from 'electron'
import path from 'path'
import isAccelerator from 'electron-is-accelerator'
import electronLocalshortcut from '@hfelix/electron-localshortcut'
import { isOsx } from './config'
import { getKeyboardLanguage } from './keyboardUtils'
import { isFile, getPath, log, readJson } from './utils'

// Problematic key bindings:
//   Aidou: Ctrl+/ -> dead key
//   Inline Code: Ctrl+` -> dead key
//   Upgrade Heading: Ctrl+= -> points to Ctrl+Plus which is ok; Ctrl+Plus is broken

class Keybindings {
  constructor () {
    this.configPath = path.join(getPath('userData'), 'keybindings.json')

    this.keys = new Map([
      // marktext - macOS only
      ['mtHide', 'Command+H'],
      ['mtHideOthers', 'Command+Alt+H'],

      // file menu
      ['fileNewFile', 'CmdOrCtrl+N'],
      ['fileNewTab', 'CmdOrCtrl+Shift+T'],
      ['fileOpenFile', 'CmdOrCtrl+O'],
      ['fileOpenFolder', 'CmdOrCtrl+Shift+O'],
      ['fileCloseTab', 'CmdOrCtrl+W'],
      ['fileSave', 'CmdOrCtrl+S'],
      ['fileSaveAs', 'CmdOrCtrl+Shift+S'],
      ['filePrint', 'CmdOrCtrl+P'],
      ['filePreferences', 'CmdOrCtrl+,'], // marktext menu in macOS
      ['fileQuit', isOsx ? 'Command+Q' : 'Alt+F4'],

      // edit menu
      ['editUndo', 'CmdOrCtrl+Z'],
      ['editRedo', 'CmdOrCtrl+Shift+Z'],
      ['editCut', 'CmdOrCtrl+X'],
      ['editCopy', 'CmdOrCtrl+C'],
      ['editPaste', 'CmdOrCtrl+V'],
      ['editCopyAsMarkdown', 'CmdOrCtrl+Shift+C'],
      ['editCopyAsPlaintext', 'CmdOrCtrl+Shift+V'],
      ['editSelectAll', 'CmdOrCtrl+A'],
      ['editFind', 'CmdOrCtrl+F'],
      ['editFindNext', 'CmdOrCtrl+Alt+U'],
      ['editFindPrevious', 'CmdOrCtrl+Shift+U'],
      ['editReplace', 'CmdOrCtrl+Alt+F'],
      ['editAidou', 'CmdOrCtrl+/'],

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
      ['paragraphCodeFences', 'CmdOrCtrl+Alt+C'],
      ['paragraphQuoteBlock', 'CmdOrCtrl+Alt+Q'],
      ['paragraphMathBlock', 'CmdOrCtrl+Alt+M'],
      ['paragraphHtmlBlock', 'CmdOrCtrl+Alt+H'],
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
      ['formatInlineCode', 'CmdOrCtrl+`'],
      ['formatStrike', 'CmdOrCtrl+D'],
      ['formatHyperlink', 'CmdOrCtrl+L'],
      ['formatImage', 'CmdOrCtrl+Shift+I'],
      ['formatClearFormat', 'Shift+CmdOrCtrl+R'],

      // window menu
      ['windowMinimize', 'CmdOrCtrl+M'],
      ['windowCloseWindow', 'CmdOrCtrl+Shift+W'],

      // view menu
      ['viewToggleFullScreen', isOsx ? 'Ctrl+Command+F' : 'F11'],
      ['viewChangeFont', 'CmdOrCtrl+.'],
      ['viewSourceCodeMode', 'CmdOrCtrl+Alt+S'],
      ['viewTypewriterMode', 'CmdOrCtrl+Alt+T'],
      ['viewFocusMode', 'CmdOrCtrl+Shift+F'],
      ['viewToggleSideBar', 'CmdOrCtrl+J'],
      ['viewToggleTabBar', 'CmdOrCtrl+Alt+B'],
      ['viewDevToggleDeveloperTools', isOsx ? 'Alt+Command+I' : 'Ctrl+Shift+I'],
      ['viewDevReload', 'CmdOrCtrl+R']
    ])

    // fix non-US keyboards
    this.mnemonics = new Map()
    this.fixLayout()

    // load user-defined keybindings
    this.loadLocalKeybindings()
  }

  fixLayout () {
    const lang = getKeyboardLanguage()
    switch (lang) {
      // fix aidou and inline code
      case 'ch':
      case 'de':
      case 'dk':
      case 'fi':
      case 'no':
      case 'se':
        this.fixInlineCode()

        if (!isOsx) {
          this.fixAidou()
        }
        break

      // fix aidou only
      case 'es':
      case 'hr':
      case 'it':
      case 'pl':
      case 'pt':
        if (!isOsx) {
          this.fixAidou()
        }
        break

      // custom layouts
      case 'bg':
        this.mnemonics.set('CmdOrCtrl+/', 'CmdOrCtrl+8')
        this.fixInlineCode()
        break
    }
  }

  fixAidou () {
    this.mnemonics.set('CmdOrCtrl+/', 'CmdOrCtrl+7')
  }

  // fix dead backquote key on layouts like German
  fixInlineCode () {
    this.keys.set('formatInlineCode', 'CmdOrCtrl+Shift+B')
  }

  loadLocalKeybindings () {
    if (global.MARKTEXT_SAFE_MODE || !isFile(this.configPath)) {
      return
    }

    const json = readJson(this.configPath, true)
    if (!json || typeof json !== 'object') {
      log('Invalid keybindings.json configuration.')
      return
    }

    // keybindings.json example:
    // {
    //   "fileSave": "CmdOrCtrl+S",
    //   "fileSaveAs": "CmdOrCtrl+Shift+S"
    // }

    // TODO: should we check for duplicate shortcuts

    for (const key in json) {
      if (this.keys.has(key)) {
        const value = json[key]
        if (isAccelerator(value)) {
          this.keys.set(key, value)
        }
      }
    }
  }

  get (id) {
    const name = this.keys.get(id)
    if (!name) {
      return ''
    }
    return name
  }
}

const keybindings = new Keybindings()

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

export const registerKeyHandler = (win, acceleratorMap) => {
  for (const item of acceleratorMap) {
    let { accelerator } = item

    // fix broken shortcuts because of dead keys or non-US keyboard problems
    const acceleratorFix = keybindings.mnemonics.get(accelerator)
    if (acceleratorFix) {
      accelerator = acceleratorFix
    }

    electronLocalshortcut.register(win, accelerator, () => {
      if (global.MARKTEXT_DEBUG && process.env.MARKTEXT_DEBUG_KEYBOARD) {
        console.log(`You pressed ${accelerator}`)
      }
      callMenuCallback(item, win)
      return true
    })
  }
}

const callMenuCallback = (menuInfo, win) => {
  const { click, id } = menuInfo
  if (click) {
    let menuItem = null
    if (id) {
      const menus = Menu.getApplicationMenu()
      menuItem = menus.getMenuItemById(id)
    }
    click(menuItem, win)
  } else {
    console.error('ERROR: callback function is not defined.')
  }
}

export default keybindings
