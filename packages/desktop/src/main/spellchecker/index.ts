import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import { isOsx } from '../config'

/**
 * Add the given word to the spellchecker dictionary.
 */
export const addToDictionary = (win: BrowserWindow, word: string): boolean => {
  return win.webContents.session.addWordToSpellCheckerDictionary(word)
}

/**
 * Remove the given word from the spellchecker dictionary.
 */
export const removeFromDictionary = (win: BrowserWindow, word: string): boolean => {
  return win.webContents.session.removeWordFromSpellCheckerDictionary(word)
}

/**
 * Returns a list of all words in the custom dictionary.
 */
export const getCustomDictionaryWords = async (win: BrowserWindow): Promise<string[]> => {
  return win.webContents.session.listWordsInSpellCheckerDictionary()
}

/**
 * Sets whether to enable the builtin spell checker.
 */
export const setSpellCheckerEnabled = (win: BrowserWindow, enabled: boolean): boolean => {
  win.webContents.session.setSpellCheckerEnabled(enabled)
  return win.webContents.session.isSpellCheckerEnabled() === enabled
}

/**
 * Set the languages used by the builtin spell checker.
 */
export const setLanguages = (win: BrowserWindow, languages: string[]): void => {
  const selectedLanguages = [...new Set(languages)]
  if (selectedLanguages.length === 0) {
    throw new Error('Expected at least one language for spell checker.')
  }

  const availableLanguages = new Set(getAvailableDictionaries(win))
  const unavailableLanguage = selectedLanguages.find(
    (language) => !availableLanguages.has(language)
  )
  if (unavailableLanguage) {
    throw new Error(`Spell checker language is unavailable: ${unavailableLanguage}`)
  }

  win.webContents.session.setSpellCheckerLanguages(selectedLanguages)
}

/**
 * Returns the list of available spellchecker languages, or empty on macOS
 * where the OS spellchecker is used and language is auto-detected.
 */
export const getAvailableDictionaries = (win: BrowserWindow): string[] => {
  if (!win.webContents.session.isSpellCheckerEnabled) {
    console.warn('Spell Checker not available but dictionaries requested.')
    return []
  } else if (isOsx) {
    return []
  }

  const availableLanguages = win.webContents.session.availableSpellCheckerLanguages

  return availableLanguages.length > 0 ? availableLanguages : ['en-US']
}

const registerSpellcheckerHandlers = (): void => {
  ipcMain.handle('mt::spellchecker-remove-word', async (e, word: string) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return false
    return removeFromDictionary(win, word)
  })
  ipcMain.handle('mt::spellchecker-switch-language', async (e, languages: string[]) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win) setLanguages(win, languages)
    return null
  })
  ipcMain.handle('mt::spellchecker-get-available-dictionaries', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return []
    return getAvailableDictionaries(win)
  })
  // Linux and Windows require at least one configured language when enabling spellcheck.
  ipcMain.handle('mt::spellchecker-set-enabled', async (e, enabled: boolean) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return false
    if (!setSpellCheckerEnabled(win, enabled)) {
      log.warn(`Failed to (de-)activate spell checking on editor (id=${win.id}).`)
      return false
    }
    return true
  })
  ipcMain.handle('mt::spellchecker-get-custom-dictionary-words', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return []
    return getCustomDictionaryWords(win)
  })
}

export default registerSpellcheckerHandlers
