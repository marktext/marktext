const DISABLE_LABELS = [
  // paragraph menu items
  'heading1MenuItem', 'heading2MenuItem', 'heading3MenuItem', 'heading4MenuItem',
  'heading5MenuItem', 'heading6MenuItem',
  'upgradeHeadingMenuItem', 'degradeHeadingMenuItem',
  'tableMenuItem',
  // formats menu items
  'hyperlinkMenuItem', 'imageMenuItem'
]

const MENU_ID_MAP = {
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
}

export const paragraph = (win, type) => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-paragraph-action', { type })
  }
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
