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

export const showContextMenu = (event, selectionChanges, spellChecker, selectedWord, wordSuggestions, callback) => {
  const { start, end } = selectionChanges
  const menu = new Menu()
  const win = remote.getCurrentWindow()
  const disableCutAndCopy = start.key === end.key && start.offset === end.offset
  const CONTEXT_ITEMS = [INSERT_BEFORE, INSERT_AFTER, SEPARATOR, CUT, COPY, PASTE, SEPARATOR, COPY_AS_MARKDOWN, COPY_AS_HTML, PASTE_AS_PLAIN_TEXT]

  // --- START spellchecking ---
  const spellingSubmenu = []

  // NOTE: This is an experimental branch and not production ready, so don't care about settings and style.

  if (spellChecker) {
    // Download further dictionaries for Hunspell
    const { isHunspell } = spellChecker.getConfiguration
    if (isHunspell) {
      // TODO(spell): async calls below; during downloading we should block the UI or block language switches and further downloads
      spellingSubmenu.push(new MenuItem({
        label: 'Download More...',
        click (menuItem, browserWindow) {
          // TODO(spell): Show download dialog via vue dialog

          const lang = 'de-DE' // prompt('Please enter the 4 letter language code (language name, region name):', 'en-US')

          // TODO(spell): Handle result
          spellChecker.loadDictionary(lang).then(m => {
            const { language } = m
            console.log(language)
            alert(JSON.stringify(language, null, 2))
          })
        }
      }))
    }

    // Change language
    const availableDictionaries = spellChecker.getAvailableDictionaries()
    const availableDictionariesSubmenu = []
    for (const dict of availableDictionaries) {
      availableDictionariesSubmenu.push(new MenuItem({
        label: dict,
        click (menuItem, browserWindow) {
          spellChecker.switchLanguage(dict).then(m => {
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
        alert(JSON.stringify(spellChecker.getConfiguration, null, 2))
        alert(JSON.stringify(spellChecker.getAvailableDictionaries(), null, 2))
      }
    }))

    spellingSubmenu.push(SEPARATOR)

    // Word suggestions
    if (selectedWord && wordSuggestions && wordSuggestions.length > 0) {
      spellingSubmenu.push({
        label: 'Add To Dictionary',
        enabled: false, // TODO(spell): see API todo
        click (menuItem, browserWindow) {
          spellChecker.addToDictionary(selectedWord)
        }
      })
      spellingSubmenu.push(SEPARATOR)
      for (const word of wordSuggestions) {
        spellingSubmenu.push({
          label: word,
          click (menuItem, browserWindow) {
            console.log(`Clicked on "${word}"`) // #DEBUG

            // NOTE: We cannot just use Electron to replace a word because the change is not forwarded to muya/editor.
            // browserWindow.webContents.replaceMisspelling(word)

            // NOTE: It's very likely that this call can have side effects because
            //       of none existing muya, renderer (editor) and main process synchronization.
            callback(word)
          }
        })
      }
    } else {
      spellingSubmenu.push({
        label: 'Remove From Dictionary',
        enabled: false, // !!selectedWord && selectedWord.length >= 2, // TODO(spell): see API todo
        click (menuItem, browserWindow) {
          spellChecker.removeFromDictionary(selectedWord)
        }
      })
    }
  } else {
    spellingSubmenu.push({
      label: 'Error while initializing spell checker API.',
      enabled: false
    })
  }

  menu.append(new MenuItem({
    label: 'Spelling...',
    submenu: spellingSubmenu
  }))
  menu.append(new MenuItem(SEPARATOR))

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
