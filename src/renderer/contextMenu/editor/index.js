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
import spellcheckMenuBuilder from './spellcheck'

const { Menu, MenuItem } = remote

/**
 * Show editor context menu.
 *
 * @param {MouseEvent} event The native mouse event.
 * @param {*} selection The editor line with start and end offset.
 * @param {[SpellChecker]} spellchecker The spellcheck wrapper.
 * @param {[string]} selectedWord The selected word.
 * @param {[string[]]} wordSuggestions Suggestions for `word`.
 * @param {*} replaceCallback The callback to replace the word by a replacement.
 */
export const showContextMenu = (event, selection, spellchecker, selectedWord, wordSuggestions, replaceCallback) => {
  const { start, end } = selection
  const menu = new Menu()
  const win = remote.getCurrentWindow()
  const disableCutAndCopy = start.key === end.key && start.offset === end.offset
  const CONTEXT_ITEMS = [INSERT_BEFORE, INSERT_AFTER, SEPARATOR, CUT, COPY, PASTE, SEPARATOR, COPY_AS_MARKDOWN, COPY_AS_HTML, PASTE_AS_PLAIN_TEXT]

  const spellingSubmenu = spellcheckMenuBuilder(spellchecker, selectedWord, wordSuggestions, replaceCallback)
  if (spellingSubmenu) {
    menu.append(new MenuItem({
      label: 'Spelling...',
      submenu: spellingSubmenu
    }))
    menu.append(new MenuItem(SEPARATOR))
  }

  [CUT, COPY, COPY_AS_HTML, COPY_AS_MARKDOWN].forEach(item => {
    item.enabled = !disableCutAndCopy
  })

  CONTEXT_ITEMS.forEach(item => {
    menu.append(new MenuItem(item))
  })
  menu.popup({ window: win, x: event.clientX, y: event.clientY })
}
