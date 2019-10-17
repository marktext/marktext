import { remote } from 'electron'
import log from 'electron-log'
import bus from '@/bus'
import { SEPARATOR } from './menuItems'

const { MenuItem } = remote

/**
 * Build the spell checker menu depending on input.
 *
 * @param {[SpellChecker]} spellchecker The spellcheck wrapper.
 * @param {[string]} selectedWord The selected word.
 * @param {[string[]]} wordSuggestions Suggestions for `word`.
 * @param {*} replaceCallback The callback to replace the word by a replacement.
 * @returns {MenuItem[]}
 */
export default (spellchecker, selectedWord, wordSuggestions, replaceCallback) => {
  if (spellchecker && spellchecker.isEnabled) {
    const spellingSubmenu = []

    // Change language menu entries
    const currentLanguage = spellchecker.lang
    const availableDictionaries = spellchecker.getAvailableDictionaries()
    const availableDictionariesSubmenu = []
    for (const dict of availableDictionaries) {
      availableDictionariesSubmenu.push(new MenuItem({
        label: dict,
        enabled: dict !== currentLanguage,
        click () {
          bus.$emit('switch-spellchecker-language', dict)
        }
      }))
    }

    spellingSubmenu.push(new MenuItem({
      label: 'Change Language...',
      submenu: availableDictionariesSubmenu
    }))

    spellingSubmenu.push(SEPARATOR)

    // Word suggestions
    if (selectedWord && wordSuggestions && wordSuggestions.length > 0) {
      spellingSubmenu.push({
        label: 'Add to Dictionary',
        click (menuItem, targetWindow) {
          // NOTE: Need to notify Chromium to invalidate the spelling underline.
          targetWindow.webContents.replaceMisspelling(selectedWord)
          spellchecker.addToDictionary(selectedWord)
            .catch(error => {
              log.error(`Error while adding "${selectedWord}" to dictionary.`)
              log.error(error)
            })
        }
      })
      // Ignore word for current runtime for all languages.
      spellingSubmenu.push({
        label: 'Ignore',
        click (menuItem, targetWindow) {
          // NOTE: Need to notify Chromium to invalidate the spelling underline.
          targetWindow.webContents.replaceMisspelling(selectedWord)
          spellchecker.ignoreWord(selectedWord)
        }
      })
      spellingSubmenu.push(SEPARATOR)
      for (const word of wordSuggestions) {
        spellingSubmenu.push({
          label: word,
          click () {
            // Notify Muya to replace the word. We cannot just use Chromium to
            // replace the word because the change is not forwarded to Muya.
            replaceCallback(word)
          }
        })
      }
    } else {
      spellingSubmenu.push({
        label: 'Remove from Dictionary',
        // NOTE: We cannot validate that the word is inside the user dictionary.
        enabled: !!selectedWord && selectedWord.length >= 2,
        click (menuItem, targetWindow) {
          // NOTE: Need to notify Chromium to invalidate the spelling underline.
          targetWindow.webContents.replaceMisspelling(selectedWord)
          spellchecker.removeFromDictionary(selectedWord)
            .catch(error => {
              log.error(`Error while removing "${selectedWord}" from dictionary.`)
              log.error(error)
            })
        }
      })
    }
    return spellingSubmenu
  }
  return null
}
