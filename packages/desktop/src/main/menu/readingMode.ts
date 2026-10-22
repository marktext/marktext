import type { Menu, MenuItem } from 'electron'

const blockedItems = [
  'paragraphMenuEntry',
  'formatMenuItem',
  'fileSaveMenuItem',
  'fileSaveAsMenuItem',
  'undoMenuItem',
  'redoMenuItem',
  'cutMenuItem',
  'pasteMenuItem',
  'pasteAsPlainTextMenuItem',
  'duplicateMenuItem',
  'createParagraphMenuItem',
  'deleteParagraphMenuItem',
  'findMenuItem',
  'findNextMenuItem',
  'findPreviousMenuItem',
  'replaceMenuItem',
  'sourceCodeModeMenuItem',
  'typewriterModeMenuItem',
  'focusModeMenuItem',
  'screenshot',
  'crlfLineEndingMenuEntry',
  'lfLineEndingMenuEntry'
]

const previousEnabled = new WeakMap<MenuItem, boolean>()

const applyItem = (item: MenuItem, readOnly: boolean): void => {
  if (item.type !== 'separator') {
    if (readOnly) {
      if (!previousEnabled.has(item)) previousEnabled.set(item, item.enabled)
      item.enabled = false
    } else if (previousEnabled.has(item)) {
      item.enabled = previousEnabled.get(item) ?? true
      previousEnabled.delete(item)
    }
  }
  item.submenu?.items.forEach((child) => applyItem(child, readOnly))
}

export const applyReadingMenu = (menu: Menu, readOnly: boolean, hasDocument = true): void => {
  const toggle = menu.getMenuItemById('readOnlyModeMenuItem')
  if (toggle) {
    toggle.checked = readOnly
    toggle.enabled = hasDocument
  }
  for (const id of blockedItems) {
    const item = menu.getMenuItemById(id)
    if (item) applyItem(item, readOnly)
  }
}
