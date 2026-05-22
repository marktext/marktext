import { type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import * as actions from '../actions/edit'
import { isOsx } from '../../config'
import { COMMANDS } from '../../commands'
import { t } from '../../i18n'
import type Keybindings from '../../keyboard/shortcutHandler'

export default function(keybindings: Keybindings): MenuItemConstructorOptions {
  return {
    label: t('menu.edit.edit'),
    submenu: [
      {
        label: t('menu.edit.undo'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_UNDO),
        click: (_menuItem, browserWindow) => {
          actions.editorUndo(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.edit.redo'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_REDO),
        click: (_menuItem, browserWindow) => {
          actions.editorRedo(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.cut'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_CUT),
        click(_menuItem, browserWindow) {
          actions.nativeCut(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.edit.copy'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_COPY),
        click(_menuItem, browserWindow) {
          actions.nativeCopy(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.edit.paste'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_PASTE),
        click(_menuItem, browserWindow) {
          actions.nativePaste(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.copyAsRich'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_COPY_AS_RICH),
        click(_menuItem, browserWindow) {
          actions.editorCopyAsRich(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.edit.copyAsHtml'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_COPY_AS_HTML),
        click(_menuItem, browserWindow) {
          actions.editorCopyAsHtml(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.edit.pasteAsPlainText'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_PASTE_AS_PLAINTEXT),
        click(_menuItem, browserWindow) {
          actions.editorPasteAsPlainText(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.selectAll'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_SELECT_ALL),
        click(_menuItem, browserWindow) {
          actions.editorSelectAll(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.duplicate'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_DUPLICATE),
        click(_menuItem, browserWindow) {
          actions.editorDuplicate(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.edit.createParagraph'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_CREATE_PARAGRAPH),
        click(_menuItem, browserWindow) {
          actions.editorCreateParagraph(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.edit.deleteParagraph'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_DELETE_PARAGRAPH),
        click(_menuItem, browserWindow) {
          actions.editorDeleteParagraph(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.find'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_FIND),
        click(_menuItem, browserWindow) {
          actions.editorFind(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.edit.findNext'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_FIND_NEXT),
        click(_menuItem, browserWindow) {
          actions.editorFindNext(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.edit.findPrevious'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_FIND_PREVIOUS),
        click(_menuItem, browserWindow) {
          actions.editorFindPrevious(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        label: t('menu.edit.replace'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_REPLACE),
        click(_menuItem, browserWindow) {
          actions.editorReplace(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.findInFolder'),
        ...keybindings.acceleratorFor(COMMANDS.EDIT_FIND_IN_FOLDER),
        click(_menuItem, browserWindow) {
          actions.findInFolder(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.screenshot'),
        id: 'screenshot',
        visible: isOsx,
        ...keybindings.acceleratorFor(COMMANDS.EDIT_SCREENSHOT),
        click(_menuItem, browserWindow) {
          actions.screenshot(browserWindow as BrowserWindow | undefined)
        }
      },
      {
        type: 'separator'
      },
      {
        // TODO: Remove this menu entry and add it to the command palette (#1408).
        label: t('menu.edit.lineEnding'),
        submenu: [
          {
            id: 'crlfLineEndingMenuEntry',
            label: t('menu.edit.lineEndingCrlf'),
            type: 'radio',
            click(_menuItem, browserWindow) {
              actions.lineEnding(browserWindow as BrowserWindow | undefined, 'crlf')
            }
          },
          {
            id: 'lfLineEndingMenuEntry',
            label: t('menu.edit.lineEndingLf'),
            type: 'radio',
            click(_menuItem, browserWindow) {
              actions.lineEnding(browserWindow as BrowserWindow | undefined, 'lf')
            }
          }
        ]
      }
    ]
  }
}
