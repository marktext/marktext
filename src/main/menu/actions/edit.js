import path from 'path'
import { ipcMain, BrowserWindow } from 'electron'
import log from 'electron-log'
import { COMMANDS } from '../../commands'
import { searchFilesAndDir } from '../../utils/imagePathAutoComplement'

// TODO(Refactor): Move to filesystem and provide generic API to search files in directories.
ipcMain.on('mt::ask-for-image-auto-path', (e, { pathname, src, id }) => {
  const win = BrowserWindow.fromWebContents(e.sender)
  if (!src || typeof src !== 'string') {
    win.webContents.send(`mt::response-of-image-path-${id}`, [])
    return
  }

  if (src.endsWith('/') || src.endsWith('\\') || src.endsWith('.')) {
    return win.webContents.send(`mt::response-of-image-path-${id}`, [])
  }
  const fullPath = path.isAbsolute(src) ? src : path.join(path.dirname(pathname), src)
  const dir = path.dirname(fullPath)
  const searchKey = path.basename(fullPath)
  searchFilesAndDir(dir, searchKey)
    .then(files => {
      return win.webContents.send(`mt::response-of-image-path-${id}`, files)
    })
    .catch(err => {
      log.error(err)
      return win.webContents.send(`mt::response-of-image-path-${id}`, [])
    })
})

// --- Menu actions -------------------------------------------------------------

export const editorUndo = win => {
  edit(win, 'undo')
}

export const editorRedo = win => {
  edit(win, 'redo')
}

export const editorCopyAsMarkdown = win => {
  edit(win, 'copyAsMarkdown')
}

export const editorCopyAsHtml = win => {
  edit(win, 'copyAsHtml')
}

export const editorPasteAsPlainText = win => {
  edit(win, 'pasteAsPlainText')
}

export const editorSelectAll = win => {
  edit(win, 'selectAll')
}

export const editorDuplicate = win => {
  edit(win, 'duplicate')
}

export const editorCreateParagraph = win => {
  edit(win, 'createParagraph')
}

export const editorDeleteParagraph = win => {
  edit(win, 'deleteParagraph')
}

export const editorFind = win => {
  edit(win, 'find')
}

export const editorFindNext = win => {
  edit(win, 'findNext')
}

export const editorFindPrevious = win => {
  edit(win, 'findPrev')
}

export const editorReplace = win => {
  edit(win, 'undo')
}

export const findInFolder = win => {
  edit(win, 'findInFolder')
}

export const edit = (win, type) => {
  if (win && win.webContents) {
    win.webContents.send('mt::editor-edit-action', type)
  }
}

export const nativeCut = win => {
  if (win) {
    win.webContents.cut()
  }
}

export const nativeCopy = win => {
  if (win) {
    win.webContents.copy()
  }
}

export const nativePaste = win => {
  if (win) {
    win.webContents.paste()
  }
}

export const screenshot = win => {
  ipcMain.emit('screen-capture', win)
}

export const lineEnding = (win, lineEnding) => {
  if (win && win.webContents) {
    win.webContents.send('mt::set-line-ending', lineEnding)
  }
}

// --- Commands -------------------------------------------------------------

export const loadEditCommands = commandManager => {
  commandManager.add(COMMANDS.EDIT_COPY, nativeCopy)
  commandManager.add(COMMANDS.EDIT_COPY_AS_HTML, editorCopyAsHtml)
  commandManager.add(COMMANDS.EDIT_COPY_AS_MARKDOWN, editorCopyAsMarkdown)
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

export const updateSidebarMenu = (applicationMenu, value) => {
  const sideBarMenuItem = applicationMenu.getMenuItemById('sideBarMenuItem')
  sideBarMenuItem.checked = !!value
}
