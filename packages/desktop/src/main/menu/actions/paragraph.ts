import { type BrowserWindow, type MenuItem } from 'electron'
import { COMMANDS } from '../../commands'
import type { CommandManager } from '../../commands'

type Win = BrowserWindow | null | undefined

const DISABLE_LABELS: readonly string[] = [
  // paragraph menu items
  'heading1MenuItem',
  'heading2MenuItem',
  'heading3MenuItem',
  'heading4MenuItem',
  'heading5MenuItem',
  'heading6MenuItem',
  'upgradeHeadingMenuItem',
  'degradeHeadingMenuItem',
  'tableMenuItem',
  // formats menu items
  'hyperlinkMenuItem',
  'imageMenuItem'
]

const MENU_ID_MAP: Readonly<Record<string, string>> = Object.freeze({
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

const transformEditorElement = (win: Win, type: string): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-paragraph-action', { type })
  }
}

export const bulletList = (win: Win): void => {
  transformEditorElement(win, 'ul-bullet')
}

export const codeFence = (win: Win): void => {
  transformEditorElement(win, 'pre')
}

export const degradeHeading = (win: Win): void => {
  transformEditorElement(win, 'degrade heading')
}

export const frontMatter = (win: Win): void => {
  transformEditorElement(win, 'front-matter')
}

export const heading1 = (win: Win): void => {
  transformEditorElement(win, 'heading 1')
}

export const heading2 = (win: Win): void => {
  transformEditorElement(win, 'heading 2')
}

export const heading3 = (win: Win): void => {
  transformEditorElement(win, 'heading 3')
}

export const heading4 = (win: Win): void => {
  transformEditorElement(win, 'heading 4')
}

export const heading5 = (win: Win): void => {
  transformEditorElement(win, 'heading 5')
}

export const heading6 = (win: Win): void => {
  transformEditorElement(win, 'heading 6')
}

export const horizontalLine = (win: Win): void => {
  transformEditorElement(win, 'hr')
}

export const htmlBlock = (win: Win): void => {
  transformEditorElement(win, 'html')
}

export const looseListItem = (win: Win): void => {
  transformEditorElement(win, 'loose-list-item')
}

export const mathFormula = (win: Win): void => {
  transformEditorElement(win, 'mathblock')
}

export const orderedList = (win: Win): void => {
  transformEditorElement(win, 'ol-order')
}

export const paragraph = (win: Win): void => {
  transformEditorElement(win, 'paragraph')
}

export const quoteBlock = (win: Win): void => {
  transformEditorElement(win, 'blockquote')
}

export const table = (win: Win): void => {
  transformEditorElement(win, 'table')
}

export const taskList = (win: Win): void => {
  transformEditorElement(win, 'ul-task')
}

export const increaseHeading = (win: Win): void => {
  transformEditorElement(win, 'upgrade heading')
}

// --- Commands -------------------------------------------------------------

export const loadParagraphCommands = (commandManager: CommandManager): void => {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setParagraphMenuItemStatus = (applicationMenu: any, bool: boolean): void => {
  const paragraphMenuItem = applicationMenu.getMenuItemById('paragraphMenuEntry')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paragraphMenuItem.submenu.items.forEach((item: any) => (item.enabled = bool))
}

const setMultipleStatus = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applicationMenu: any,
  list: readonly string[],
  status: boolean
): void => {
  const paragraphMenuItem = applicationMenu.getMenuItemById('paragraphMenuEntry')
  paragraphMenuItem.submenu.items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item: any) => item.id && list.includes(item.id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .forEach((item: any) => (item.enabled = status))
}

interface SelectionState {
  affiliation: Record<string, boolean>
  isTable?: boolean
  isLooseListItem?: boolean
  isTaskList?: boolean
  isDisabled?: boolean
  isMultiline?: boolean
  isCodeFences?: boolean
  isCodeContent?: boolean
}

const setCheckedMenuItem = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applicationMenu: any,
  { affiliation, isTable, isLooseListItem, isTaskList }: SelectionState
): void => {
  const paragraphMenuItem = applicationMenu.getMenuItemById('paragraphMenuEntry')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paragraphMenuItem.submenu.items.forEach((item: any) => (item.checked = false))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paragraphMenuItem.submenu.items.forEach((item: any) => {
    if (!item.id) {
      return false
    } else if (item.id === 'looseListItemMenuItem') {
      item.checked = !!isLooseListItem
    } else if (
      Object.keys(affiliation).some((b) => {
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
      })
    ) {
      item.checked = true
    }
    return undefined
  })
}

/**
 * Update paragraph menu entires from given state.
 *
 * @param applicationMenu The application menu instance.
 * @param state The selection information.
 */
export const updateSelectionMenus = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applicationMenu: any,
  state: SelectionState
): void => {
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
  const formatMenuItem: MenuItem = applicationMenu.getMenuItemById('formatMenuItem')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(formatMenuItem.submenu as any).items.forEach((item: any) => (item.enabled = true))

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(formatMenuItem.submenu as any).items.forEach((item: any) => (item.enabled = false))

      if (Object.keys(affiliation).some((b) => /code$/.test(b))) {
        setMultipleStatus(applicationMenu, ['codeFencesMenuItem'], true)
      }
    }
  } else if (isMultiline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(formatMenuItem.submenu as any).items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => item.id && DISABLE_LABELS.includes(item.id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .forEach((item: any) => (item.enabled = false))
    setMultipleStatus(applicationMenu, DISABLE_LABELS, false)
  }

  // Disable loose list item.
  if (!affiliation.ul && !affiliation.ol) {
    setMultipleStatus(applicationMenu, ['looseListItemMenuItem'], false)
  }
}
