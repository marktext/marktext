import { COMMANDS } from '../../commands'

const DISABLE_LABELS = [
  // paragraph menu items
  'heading1MenuItem', 'heading2MenuItem', 'heading3MenuItem', 'heading4MenuItem',
  'heading5MenuItem', 'heading6MenuItem',
  'upgradeHeadingMenuItem', 'degradeHeadingMenuItem',
  'tableMenuItem',
  // formats menu items
  'hyperlinkMenuItem', 'imageMenuItem'
]

const MENU_ID_MAP = Object.freeze({
  heading1MenuItem: 'h1',
  heading2MenuItem: 'h2',
  heading3MenuItem: 'h3',
  heading4MenuItem: 'h4',
  heading5MenuItem: 'h5',
  heading6MenuItem: 'h6',
  tableMenuItem: 'figure',
  codeFencesMenuItem: 'pre',
  htmlBlockMenuItem: 'html',
  mathBlockMenuItem: 'multiplemath',
  quoteBlockMenuItem: 'blockquote',
  orderListMenuItem: 'ol',
  bulletListMenuItem: 'ul',
  // taskListMenuItem: 'ul',
  paragraphMenuItem: 'p',
  horizontalLineMenuItem: 'hr',
  frontMatterMenuItem: 'frontmatter' // 'pre'
})

const transformEditorElement = (win, type) => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-paragraph-action', { type })
  }
}

export const bulletList = win => {
  transformEditorElement(win, 'ul-bullet')
}

export const codeFence = win => {
  transformEditorElement(win, 'pre')
}

export const degradeHeading = win => {
  transformEditorElement(win, 'degrade heading')
}

export const frontMatter = win => {
  transformEditorElement(win, 'front-matter')
}

export const heading1 = win => {
  transformEditorElement(win, 'heading 1')
}

export const heading2 = win => {
  transformEditorElement(win, 'heading 2')
}

export const heading3 = win => {
  transformEditorElement(win, 'heading 3')
}

export const heading4 = win => {
  transformEditorElement(win, 'heading 4')
}

export const heading5 = win => {
  transformEditorElement(win, 'heading 5')
}

export const heading6 = win => {
  transformEditorElement(win, 'heading 6')
}

export const horizontalLine = win => {
  transformEditorElement(win, 'hr')
}

export const htmlBlock = win => {
  transformEditorElement(win, 'html')
}

export const looseListItem = win => {
  transformEditorElement(win, 'loose-list-item')
}

export const mathFormula = win => {
  transformEditorElement(win, 'mathblock')
}

export const orderedList = win => {
  transformEditorElement(win, 'ol-order')
}

export const paragraph = win => {
  transformEditorElement(win, 'paragraph')
}

export const quoteBlock = win => {
  transformEditorElement(win, 'blockquote')
}

export const table = win => {
  transformEditorElement(win, 'table')
}

export const taskList = win => {
  transformEditorElement(win, 'ul-task')
}

export const increaseHeading = win => {
  transformEditorElement(win, 'upgrade heading')
}

// --- Commands -------------------------------------------------------------

export const loadParagraphCommands = commandManager => {
  commandManager.add(COMMANDS.PARAGRAPH_BULLET_LIST, bulletList)
  commandManager.add(COMMANDS.PARAGRAPH_CODE_FENCE, codeFence)
  commandManager.add(COMMANDS.PARAGRAPH_DEGRADE_HEADING, degradeHeading)
  commandManager.add(COMMANDS.PARAGRAPH_FRONT_MATTER, frontMatter)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_1, heading1)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_2, heading2)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_3, heading3)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_4, heading4)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_5, heading5)
  commandManager.add(COMMANDS.PARAGRAPH_HEADING_6, heading6)
  commandManager.add(COMMANDS.PARAGRAPH_HORIZONTAL_LINE, horizontalLine)
  commandManager.add(COMMANDS.PARAGRAPH_HTML_BLOCK, htmlBlock)
  commandManager.add(COMMANDS.PARAGRAPH_LOOSE_LIST_ITEM, looseListItem)
  commandManager.add(COMMANDS.PARAGRAPH_MATH_FORMULA, mathFormula)
  commandManager.add(COMMANDS.PARAGRAPH_ORDERED_LIST, orderedList)
  commandManager.add(COMMANDS.PARAGRAPH_PARAGRAPH, paragraph)
  commandManager.add(COMMANDS.PARAGRAPH_QUOTE_BLOCK, quoteBlock)
  commandManager.add(COMMANDS.PARAGRAPH_TABLE, table)
  commandManager.add(COMMANDS.PARAGRAPH_TASK_LIST, taskList)
  commandManager.add(COMMANDS.PARAGRAPH_INCREASE_HEADING, increaseHeading)
}

// --- IPC events -------------------------------------------------------------

// NOTE: Don't use static `getMenuItemById` here, instead request the menu by
//       window id from `AppMenu` manager.

const setParagraphMenuItemStatus = (applicationMenu, bool) => {
  const paragraphMenuItem = applicationMenu.getMenuItemById('paragraphMenuEntry')
  paragraphMenuItem.submenu.items
    .forEach(item => (item.enabled = bool))
}

const setMultipleStatus = (applicationMenu, list, status) => {
  const paragraphMenuItem = applicationMenu.getMenuItemById('paragraphMenuEntry')
  paragraphMenuItem.submenu.items
    .filter(item => item.id && list.includes(item.id))
    .forEach(item => (item.enabled = status))
}

const setCheckedMenuItem = (applicationMenu, { affiliation, isTable, isLooseListItem, isTaskList }) => {
  const paragraphMenuItem = applicationMenu.getMenuItemById('paragraphMenuEntry')
  paragraphMenuItem.submenu.items.forEach(item => (item.checked = false))
  paragraphMenuItem.submenu.items.forEach(item => {
    if (!item.id) {
      return false
    } else if (item.id === 'looseListItemMenuItem') {
      item.checked = !!isLooseListItem
    } else if (Object.keys(affiliation).some(b => {
      if (b === 'ul' && isTaskList) {
        if (item.id === 'taskListMenuItem') {
          return true
        }
        return false
      } else if (isTable && item.id === 'tableMenuItem') {
        return true
      } else if (item.id === 'codeFencesMenuItem' && /code$/.test(b)) {
        return true
      }
      return b === MENU_ID_MAP[item.id]
    })) {
      item.checked = true
    }
  })
}

/**
 * Update paragraph menu entires from given state.
 *
 * @param {Electron.MenuItem} applicationMenu The application menu instance.
 * @param {*} state The selection information.
 */
export const updateSelectionMenus = (applicationMenu, state) => {
  const {
    // Key/boolean object like "ul: true" of block elements that are selected.
    // This may be an empty object when multiple block elements are selected.
    affiliation,
    isDisabled,
    isMultiline,
    isCodeFences,
    isCodeContent
  } = state

  // Reset format menu.
  const formatMenuItem = applicationMenu.getMenuItemById('formatMenuItem')
  formatMenuItem.submenu.items.forEach(item => (item.enabled = true))

  // Handle menu checked.
  setCheckedMenuItem(applicationMenu, state)

  // Reset paragraph menu.
  setParagraphMenuItemStatus(applicationMenu, !isDisabled)
  if (isDisabled) {
    return
  }

  if (isCodeFences) {
    setParagraphMenuItemStatus(applicationMenu, false)

    // A code line is selected.
    if (isCodeContent) {
      formatMenuItem.submenu.items.forEach(item => (item.enabled = false))

      // TODO: Allow to transform to paragraph for other code blocks too but
      //   currently not supported by Muya.
      // // Allow to transform to paragraph.
      // if (affiliation.frontmatter) {
      //   setMultipleStatus(applicationMenu, ['frontMatterMenuItem'], true)
      // } else if (affiliation.html) {
      //   setMultipleStatus(applicationMenu, ['htmlBlockMenuItem'], true)
      // } else if (affiliation.multiplemath) {
      //   setMultipleStatus(applicationMenu, ['mathBlockMenuItem'], true)
      // } else {
      //  setMultipleStatus(applicationMenu, ['codeFencesMenuItem'], true)
      // }

      if (Object.keys(affiliation).some(b => /code$/.test(b))) {
        setMultipleStatus(applicationMenu, ['codeFencesMenuItem'], true)
      }
    }
  } else if (isMultiline) {
    formatMenuItem.submenu.items
      .filter(item => item.id && DISABLE_LABELS.includes(item.id))
      .forEach(item => (item.enabled = false))
    setMultipleStatus(applicationMenu, DISABLE_LABELS, false)
  }

  // Disable loose list item.
  if (!affiliation.ul && !affiliation.ol) {
    setMultipleStatus(applicationMenu, ['looseListItemMenuItem'], false)
  }
}
