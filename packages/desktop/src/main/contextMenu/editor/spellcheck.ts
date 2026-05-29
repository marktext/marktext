import { MenuItem, ipcMain, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import log from 'electron-log'
import { isOsx } from '../../config'
import { addToDictionary } from '../../spellchecker'
import { SEPARATOR } from './menuItems'
import { t } from '../../i18n'

/**
 * Build the spell checker menu depending on input.
 *
 * @param isMisspelled Whether a the selected word is misspelled.
 * @param misspelledWord The selected word.
 * @param wordSuggestions Suggestions for `selectedWord`.
 */
export default (
  isMisspelled: boolean,
  misspelledWord: string | undefined,
  wordSuggestions: string[] | undefined
): (MenuItem | MenuItemConstructorOptions)[] => {
  const spellingSubmenu: (MenuItem | MenuItemConstructorOptions)[] = []

  spellingSubmenu.push(
    new MenuItem({
      label: t('contextMenu.changeLanguage'),
      // NB: On macOS the OS spell checker is used and will detect the language automatically.
      visible: !isOsx,
      click(_menuItem, targetWindow) {
        if (targetWindow) {
          ;(targetWindow as BrowserWindow).webContents.send('mt::spelling-show-switch-language')
        }
      }
    })
  )

  // Handle misspelled word if wordSuggestions is set, otherwise word is correct.
  if (isMisspelled && misspelledWord && wordSuggestions) {
    spellingSubmenu.push({
      label: t('contextMenu.addToDictionary'),
      click(_menuItem, targetWindow) {
        if (!targetWindow) return
        const win = targetWindow as BrowserWindow
        if (!addToDictionary(win, misspelledWord)) {
          log.error(`Error while adding "${misspelledWord}" to dictionary.`)
          return
        }
        // Need to notify Chromium to invalidate the spelling underline.
        win.webContents.replaceMisspelling(misspelledWord)
      }
    })

    if (wordSuggestions.length > 0) {
      spellingSubmenu.push(SEPARATOR)
      for (const word of wordSuggestions) {
        spellingSubmenu.push({
          label: word,
          click(_menuItem, targetWindow) {
            if (targetWindow) {
              ;(targetWindow as BrowserWindow).webContents.send(
                'mt::spelling-replace-misspelling',
                {
                  word: misspelledWord,
                  replacement: word
                }
              )
            }
          }
        })
      }
    }
  } else {
    spellingSubmenu.push({
      label: t('contextMenu.editDictionary'),
      click() {
        ipcMain.emit('app-create-settings-window', 'spelling')
      }
    })
  }
  return spellingSubmenu
}
