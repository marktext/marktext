import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'
import { isOsx } from '../config'

/**
 * Add the given word to the spellchecker dictionary.
 *
 * @param {BrowserWindow} win The browser window.
 * @param {string} word The word to add.
 * @returns {boolean} Whether the word was added.
 */
export const addToDictionary = (win, word) => {
  return win.webContents.session.addWordToSpellCheckerDictionary(word)
}

/**
 * Remove the given word from the spellchecker dictionary.
 *
 * @param {BrowserWindow} win The browser window.
 * @param {string} word The word to remove.
 * @returns {boolean} Whether the word was removed.
 */
export const removeFromDictionary = (win, word) => {
  return win.webContents.session.removeWordFromSpellCheckerDictionary(word)
}

/**
 * Returns a list of all words in the custom dictionary.
 *
 * @param {BrowserWindow} win The browser window.
 * @returns {Promise<string[]>} List of custom dictionary words.
 */
export const getCustomDictionaryWords = async win => {
  return win.webContents.session.listWordsInSpellCheckerDictionary()
}

/**
 * Sets whether to enable the builtin spell checker.
 *
 * @param {BrowserWindow} win The browser window.
 * @param {boolean} enabled Whether to enable the builtin spell checker.
 */
export const setSpellCheckerEnabled = (win, enabled) => {
  win.webContents.session.setSpellCheckerEnabled(enabled)
  return win.webContents.session.isSpellCheckerEnabled() === enabled
}

/**
 * Switch the spellchecker to the given language and enable the builtin spell checker.
 *
 * @param {BrowserWindow} win The browser window.
 * @param {string} word The word to remove.
 * @throws Throws an exception if the language cannot be set.
 */
export const switchLanguage = (win, lang) => {
  win.webContents.session.setSpellCheckerLanguages([lang])
}

/**
 *
 * @param {BrowserWindow} win The browser window.
 * @returns {string[]} List of available spellchecker languages or an empty array on macOS.
 */
export const getAvailableDictionaries = win => {
  if (!win.webContents.session.isSpellCheckerEnabled) {
    console.warn('Spell Checker not available but dictionaries requested.')
    return []
  } else if (isOsx) {
    // NB: On macOS the OS spellchecker is used and will detect the language automatically.
    return []
  }
  return win.webContents.session.availableSpellCheckerLanguages
}

export default () => {
  ipcMain.handle('mt::spellchecker-remove-word', async (e, word) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return removeFromDictionary(win, word)
  })
  ipcMain.handle('mt::spellchecker-switch-language', async (e, lang) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    switchLanguage(win, lang)
    return null
  })
  ipcMain.handle('mt::spellchecker-get-available-dictionaries', async e => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return getAvailableDictionaries(win)
  })
  // NOTE: We have to set a language or call `switchLanguage` on Linux and Windows.
  ipcMain.handle('mt::spellchecker-set-enabled', async (e, enabled) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!setSpellCheckerEnabled(win, enabled)) {
      log.warn(`Failed to (de-)activate spell checking on editor (id=${win.id}).`)
      return false
    }
    return true
  })
  ipcMain.handle('mt::spellchecker-get-custom-dictionary-words', async e => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return getCustomDictionaryWords(win)
  })
}
