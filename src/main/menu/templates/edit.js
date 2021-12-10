import * as actions from '../actions/edit'
import { isOsx } from '../../config'
import i18n from '../../i18n'

export default function (keybindings, userPreference) {
  const { aidou } = userPreference.getAll()
  return {
    label: i18n.t('menu.edit._title'),
    submenu: [{
      label: i18n.t('menu.edit.undo'),
      accelerator: keybindings.getAccelerator('edit.undo'),
      click: (menuItem, browserWindow) => {
        actions.edit(browserWindow, 'undo')
      }
    }, {
      label: i18n.t('menu.edit.redo'),
      accelerator: keybindings.getAccelerator('edit.redo'),
      click: (menuItem, browserWindow) => {
        actions.edit(browserWindow, 'redo')
      }
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.edit.cut'),
      accelerator: keybindings.getAccelerator('edit.cut'),
      role: 'cut'
    }, {
      label: i18n.t('menu.edit.copy'),
      accelerator: keybindings.getAccelerator('edit.copy'),
      role: 'copy'
    }, {
      label: i18n.t('menu.edit.paste'),
      accelerator: keybindings.getAccelerator('edit.paste'),
      role: 'paste'
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.edit.copyAsMarkdown'),
      accelerator: keybindings.getAccelerator('edit.copy-as-markdown'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'copyAsMarkdown')
      }
    }, {
      label: i18n.t('menu.edit.copyAsHtml'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'copyAsHtml')
      }
    }, {
      label: i18n.t('menu.edit.pasteAsPlainText'),
      accelerator: keybindings.getAccelerator('edit.copy-as-plaintext'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'pasteAsPlainText')
      }
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.edit.selectAll'),
      accelerator: keybindings.getAccelerator('edit.select-all'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'selectAll')
      }
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.edit.duplicate'),
      accelerator: keybindings.getAccelerator('edit.duplicate'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'duplicate')
      }
    }, {
      label: i18n.t('menu.edit.createParagraph'),
      accelerator: keybindings.getAccelerator('edit.create-paragraph'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'createParagraph')
      }
    }, {
      label: i18n.t('menu.edit.deleteParagraph'),
      accelerator: keybindings.getAccelerator('edit.delete-paragraph'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'deleteParagraph')
      }
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.edit.find'),
      accelerator: keybindings.getAccelerator('edit.find'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'find')
      }
    }, {
      label: i18n.t('menu.edit.findNext'),
      accelerator: keybindings.getAccelerator('edit.find-next'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'findNext')
      }
    }, {
      label: i18n.t('menu.edit.findPrev'),
      accelerator: keybindings.getAccelerator('edit.find-previous'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'findPrev')
      }
    }, {
      label: i18n.t('menu.edit.replace'),
      accelerator: keybindings.getAccelerator('edit.replace'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'replace')
      }
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.edit.findInFolder'),
      accelerator: keybindings.getAccelerator('edit.find-in-folder'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'findInFolder')
      }
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.edit.aidou'),
      visible: aidou,
      id: 'aidou',
      accelerator: keybindings.getAccelerator('edit.aidou'),
      click (menuItem, browserWindow) {
        actions.edit(browserWindow, 'aidou')
      }
    }, {
      label: i18n.t('menu.edit.screenshot'),
      id: 'screenshot',
      visible: isOsx,
      accelerator: keybindings.getAccelerator('edit.screenshot'),
      click (menuItem, browserWindow) {
        actions.screenshot(browserWindow)
      }
    }, {
      type: 'separator'
    }, {
      // TODO: Remove this menu entry and add it to the command palette (#1408).
      label: i18n.t('menu.edit.lineEnding'),
      submenu: [{
        id: 'crlfLineEndingMenuEntry',
        label: i18n.t('menu.edit.crlf'),
        type: 'radio',
        click (menuItem, browserWindow) {
          actions.lineEnding(browserWindow, 'crlf')
        }
      }, {
        id: 'lfLineEndingMenuEntry',
        label: i18n.t('menu.edit.lf'),
        type: 'radio',
        click (menuItem, browserWindow) {
          actions.lineEnding(browserWindow, 'lf')
        }
      }]
    }]
  }
}
