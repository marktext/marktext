import * as actions from '../actions/edit'
import { isOsx } from '../../config'
import { COMMANDS } from '../../commands'
import { t } from '../../i18n'

export default function(keybindings) {
  return {
    label: t('menu.edit.edit'),
    submenu: [
      {
        label: t('menu.edit.undo'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_UNDO),
        click: (menuItem, browserWindow) => {
          actions.editorUndo(browserWindow)
        }
      },
      {
        label: t('menu.edit.redo'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_REDO),
        click: (menuItem, browserWindow) => {
          actions.editorRedo(browserWindow)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.cut'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_CUT),
        click(menuItem, browserWindow) {
          actions.nativeCut(browserWindow)
        }
      },
      {
        label: t('menu.edit.copy'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_COPY),
        click(menuItem, browserWindow) {
          actions.nativeCopy(browserWindow)
        }
      },
      {
        label: t('menu.edit.paste'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_PASTE),
        click(menuItem, browserWindow) {
          actions.nativePaste(browserWindow)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.copyAsRich'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_COPY_AS_RICH),
        click(menuItem, browserWindow) {
          actions.editorCopyAsRich(browserWindow)
        }
      },
      {
        label: t('menu.edit.copyAsHtml'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_COPY_AS_HTML),
        click(menuItem, browserWindow) {
          actions.editorCopyAsHtml(browserWindow)
        }
      },
      {
        label: t('menu.edit.pasteAsPlainText'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_PASTE_AS_PLAINTEXT),
        click(menuItem, browserWindow) {
          actions.editorPasteAsPlainText(browserWindow)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.selectAll'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_SELECT_ALL),
        click(menuItem, browserWindow) {
          actions.editorSelectAll(browserWindow)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.duplicate'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_DUPLICATE),
        click(menuItem, browserWindow) {
          actions.editorDuplicate(browserWindow)
        }
      },
      {
        label: t('menu.edit.createParagraph'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_CREATE_PARAGRAPH),
        click(menuItem, browserWindow) {
          actions.editorCreateParagraph(browserWindow)
        }
      },
      {
        label: t('menu.edit.deleteParagraph'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_DELETE_PARAGRAPH),
        click(menuItem, browserWindow) {
          actions.editorDeleteParagraph(browserWindow)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.find'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_FIND),
        click(menuItem, browserWindow) {
          actions.editorFind(browserWindow)
        }
      },
      {
        label: t('menu.edit.findNext'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_FIND_NEXT),
        click(menuItem, browserWindow) {
          actions.editorFindNext(browserWindow)
        }
      },
      {
        label: t('menu.edit.findPrevious'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_FIND_PREVIOUS),
        click(menuItem, browserWindow) {
          actions.editorFindPrevious(browserWindow)
        }
      },
      {
        label: t('menu.edit.replace'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_REPLACE),
        click(menuItem, browserWindow) {
          actions.editorReplace(browserWindow)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.findInFolder'),
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_FIND_IN_FOLDER),
        click(menuItem, browserWindow) {
          actions.findInFolder(browserWindow)
        }
      },
      {
        type: 'separator'
      },
      {
        label: t('menu.edit.screenshot'),
        id: 'screenshot',
        visible: isOsx,
        accelerator: keybindings.getAccelerator(COMMANDS.EDIT_SCREENSHOT),
        click(menuItem, browserWindow) {
          actions.screenshot(browserWindow)
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
            click(menuItem, browserWindow) {
              actions.lineEnding(browserWindow, 'crlf')
            }
          },
          {
            id: 'lfLineEndingMenuEntry',
            label: t('menu.edit.lineEndingLf'),
            type: 'radio',
            click(menuItem, browserWindow) {
              actions.lineEnding(browserWindow, 'lf')
            }
          }
        ]
      }
    ]
  }
}
