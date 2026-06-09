import path from 'path'
import { BrowserWindow, ipcMain, type MenuItem } from 'electron'
import log from 'electron-log'
import { COMMANDS } from '../../commands'
import type { CommandManager } from '../../commands'
import { searchFilesAndDir } from '../../utils/imagePathAutoComplement'

type Win = BrowserWindow | null | undefined

// TODO(Refactor): Move to filesystem and provide generic API to search files in directories.
ipcMain.on('mt::ask-for-image-auto-path', (e, { pathname, src, id }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!win) {
    return
  }
  if (!src || typeof src !== 'string') {
    win.webContents.send(`mt::response-of-image-path-${id}`, [])
    return
  }

  const fullPath = path.isAbsolute(src) ? src : path.join(path.dirname(pathname), src)
  // Handle the case where it ends with a trailing slash (i.e. a directory) - we should list everything in the directory
  let dir: string | null = null
  let searchKey: string | null = null
  if (fullPath.endsWith(path.sep)) {
    dir = fullPath.slice(0, -1) // It should be the entire path minus just the trailing slash
    searchKey = ''
  } else {
    dir = path.dirname(fullPath)
    searchKey = path.basename(fullPath)
  }
  searchFilesAndDir(dir, searchKey)
    .then((files) => {
      return win.webContents.send(`mt::response-of-image-path-${id}`, files)
    })
    .catch((err: unknown) => {
      log.error(err)
      return win.webContents.send(`mt::response-of-image-path-${id}`, [])
    })
})

// --- Menu actions -------------------------------------------------------------

export const editorUndo = (win: Win): void => {
  edit(win, 'undo')
}

export const editorRedo = (win: Win): void => {
  edit(win, 'redo')
}

export const editorCopyAsRich = (win: Win): void => {
  edit(win, 'copyAsRich')
}

export const editorCopyAsHtml = (win: Win): void => {
  edit(win, 'copyAsHtml')
}

export const editorPasteAsPlainText = (win: Win): void => {
  edit(win, 'pasteAsPlainText')
}

export const editorSelectAll = (win: Win): void => {
  edit(win, 'selectAll')
}

export const editorDuplicate = (win: Win): void => {
  edit(win, 'duplicate')
}

export const editorCreateParagraph = (win: Win): void => {
  edit(win, 'createParagraph')
}

export const editorDeleteParagraph = (win: Win): void => {
  edit(win, 'deleteParagraph')
}

export const editorFind = (win: Win): void => {
  edit(win, 'find')
}

export const editorFindNext = (win: Win): void => {
  edit(win, 'findNext')
}

export const editorFindPrevious = (win: Win): void => {
  edit(win, 'findPrev')
}

export const editorReplace = (win: Win): void => {
  edit(win, 'replace')
}

export const findInFolder = (win: Win): void => {
  edit(win, 'findInFolder')
}

export const edit = (win: Win, type: string): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-edit-action', type)
  }
}

export const nativeCut = (win: Win): void => {
  if (win) {
    win.webContents.cut()
  }
}

export const nativeCopy = (win: Win): void => {
  if (win) {
    win.webContents.copy()
  }
}

export const nativePaste = (win: Win): void => {
  if (win) {
    win.webContents.paste()
  }
}

export const screenshot = (win: Win): void => {
  ipcMain.emit('screen-capture', win)
}

export const lineEnding = (win: Win, lineEnding: string): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::set-line-ending', lineEnding)
  }
}

// --- Commands -------------------------------------------------------------

export const loadEditCommands = (commandManager: CommandManager): void => {
  commandManager.add(COMMANDS.EDIT_COPY, nativeCopy)
  commandManager.add(COMMANDS.EDIT_COPY_AS_HTML, editorCopyAsHtml)
  commandManager.add(COMMANDS.EDIT_COPY_AS_RICH, editorCopyAsRich)
  commandManager.add(COMMANDS.EDIT_CREATE_PARAGRAPH, editorCreateParagraph)
  commandManager.add(COMMANDS.EDIT_CUT, nativeCut)
  commandManager.add(COMMANDS.EDIT_DELETE_PARAGRAPH, editorDeleteParagraph)
  commandManager.add(COMMANDS.EDIT_DUPLICATE, editorDuplicate)
  commandManager.add(COMMANDS.EDIT_FIND, editorFind)
  commandManager.add(COMMANDS.EDIT_FIND_IN_FOLDER, findInFolder)
  commandManager.add(COMMANDS.EDIT_FIND_NEXT, editorFindNext)
  commandManager.add(COMMANDS.EDIT_FIND_PREVIOUS, editorFindPrevious)
  commandManager.add(COMMANDS.EDIT_PASTE, nativePaste)
  commandManager.add(COMMANDS.EDIT_PASTE_AS_PLAINTEXT, editorPasteAsPlainText)
  commandManager.add(COMMANDS.EDIT_REDO, editorRedo)
  commandManager.add(COMMANDS.EDIT_REPLACE, editorReplace)
  commandManager.add(COMMANDS.EDIT_SCREENSHOT, screenshot)
  commandManager.add(COMMANDS.EDIT_SELECT_ALL, editorSelectAll)
  commandManager.add(COMMANDS.EDIT_UNDO, editorUndo)
}

// --- IPC events -------------------------------------------------------------

// NOTE: Don't use static `getMenuItemById` here, instead request the menu by
//       window id from `AppMenu` manager.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const updateSidebarMenu = (applicationMenu: any, value: unknown): void => {
  const sideBarMenuItem: MenuItem = applicationMenu.getMenuItemById('sideBarMenuItem')
  sideBarMenuItem.checked = !!value
}
