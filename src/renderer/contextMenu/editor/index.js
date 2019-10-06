import { remote } from 'electron'
import {
  CUT,
  COPY,
  PASTE,
  COPY_AS_MARKDOWN,
  COPY_AS_HTML,
  PASTE_AS_PLAIN_TEXT,
  SEPARATOR,
  INSERT_BEFORE,
  INSERT_AFTER
} from './menuItems'

const { Menu, MenuItem } = remote

export const showContextMenu = (event, selectionChanges, spellchecker, selectedWord, wordSuggestions, callback) => {
  const { start, end } = selectionChanges
  const menu = new Menu()
  const win = remote.getCurrentWindow()
  const disableCutAndCopy = start.key === end.key && start.offset === end.offset
  const CONTEXT_ITEMS = [INSERT_BEFORE, INSERT_AFTER, SEPARATOR, CUT, COPY, PASTE, SEPARATOR, COPY_AS_MARKDOWN, COPY_AS_HTML, PASTE_AS_PLAIN_TEXT]

  // --- START spellchecking ---

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
        click (menuItem, browserWindow) {
          spellchecker.switchLanguage(dict).then(m => {
            // TODO(spell): Handle result
            console.log(m)
            alert(JSON.stringify(m, null, 2))
          })
        }
      }))
    }

    spellingSubmenu.push(new MenuItem({
      label: 'Change Language...',
      submenu: availableDictionariesSubmenu
    }))

    // TODO(spell): Delete me
    spellingSubmenu.push(new MenuItem({
      label: 'Debug',
      click (menuItem, browserWindow) {
        alert(JSON.stringify(spellchecker.getConfiguration, null, 2))
      }
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
        }
      })
      spellingSubmenu.push(SEPARATOR)
      for (const word of wordSuggestions) {
        spellingSubmenu.push({
          label: word,
          click (menuItem, browserWindow) {
            console.log(`Clicked on "${word}"`) // #DEBUG

            // We cannot just use Chromium to replace a word because the change
            // is not forwarded to Muya.
            callback(word)
          }
        })
      }
    } else {
      spellingSubmenu.push({
        label: 'Remove from Dictionary',
        enabled: !!selectedWord && selectedWord.length >= 2, // TODO(spell): and inside custom dict
        click (menuItem, targetWindow) {
          // NOTE: Need to notify Chromium to invalidate the spelling underline.
          targetWindow.webContents.replaceMisspelling(selectedWord)
          spellchecker.removeFromDictionary(selectedWord)
        }
      })
    }

    menu.append(new MenuItem({
      label: 'Spelling...',
      submenu: spellingSubmenu
    }))
    menu.append(new MenuItem(SEPARATOR))
  }

  // --- END spellchecking ---

  if (/th|td/.test(start.block.type) && start.key === end.key) {
    CONTEXT_ITEMS.unshift(
      INSERT_ROW,
      REMOVE_ROW,
      INSERT_COLUMN,
      REMOVE_COLUMN,
      SEPARATOR,
      COPY_TABLE,
      SEPARATOR
    )
  }

  [CUT, COPY, COPY_AS_HTML, COPY_AS_MARKDOWN].forEach(item => {
    item.enabled = !disableCutAndCopy
  })

  CONTEXT_ITEMS.forEach(item => {
    menu.append(new MenuItem(item))
  })
  menu.popup({ window: win, x: event.clientX, y: event.clientY })
}
