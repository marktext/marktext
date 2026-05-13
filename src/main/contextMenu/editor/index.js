import { Menu, MenuItem } from 'electron'
import {
  SEPARATOR,
  copyAsHtmlMenuItem,
  copyAsMarkdownMenuItem,
  copyMenuItem,
  cutMenuItem,
  insertAfterMenuItem,
  insertBeforeMenuItem,
  pasteAsPlainTextMenuItem,
  pasteMenuItem
} from './menuItems'
import spellcheckMenuBuilder from './spellcheck'
import { createTranslator } from '../../i18n'

const buildContextItems = t => [
  insertBeforeMenuItem(t),
  insertAfterMenuItem(t),
  SEPARATOR,
  cutMenuItem(t),
  copyMenuItem(t),
  pasteMenuItem(t),
  SEPARATOR,
  copyAsMarkdownMenuItem(t),
  copyAsHtmlMenuItem(t),
  pasteAsPlainTextMenuItem(t)
]

const isInsideEditor = params => {
  const { isEditable, editFlags, inputFieldType } = params
  // WORKAROUND for Electron#32102: `params.spellcheckEnabled` is always false. Try to detect the editor container via other information.
  return isEditable && inputFieldType === 'none' && !!editFlags.canEditRichly
}

export const showEditorContextMenu = (win, event, params, isSpellcheckerEnabled, language = 'en') => {
  const { isEditable, hasImageContents, selectionText, editFlags, misspelledWord, dictionarySuggestions } = params
  const t = createTranslator(language)

  // NOTE: We have to get the word suggestions from this event because `webFrame.getWordSuggestions` and
  //       `webFrame.isWordMisspelled` doesn't work on Windows (Electron#28684).

  // Make sure that the request comes from a contenteditable inside the editor container.
  if (isInsideEditor(params) && !hasImageContents) {
    const hasText = selectionText.trim().length > 0
    const canCopy = hasText && editFlags.canCut && editFlags.canCopy
    // const canPaste = hasText && editFlags.canPaste
    const isMisspelled = isEditable && !!selectionText && !!misspelledWord

    const menu = new Menu()
    if (isSpellcheckerEnabled) {
      const spellingSubmenu = spellcheckMenuBuilder(isMisspelled, misspelledWord, dictionarySuggestions, t)
      menu.append(new MenuItem({
        label: t('Spelling...'),
        submenu: spellingSubmenu
      }))
      menu.append(new MenuItem(SEPARATOR))
    }

    const contextItems = buildContextItems(t)
    contextItems
      .filter(item => ['cutMenuItem', 'copyMenuItem', 'copyAsHtmlMenuItem', 'copyAsMarkdownMenuItem'].includes(item.id))
      .forEach(item => {
        item.enabled = canCopy
      })
    contextItems.forEach(item => {
      menu.append(new MenuItem(item))
    })
    menu.popup([{ window: win, x: event.clientX, y: event.clientY }])
  }
}
