import { app } from 'electron'
import { showAboutDialog } from '../actions/help'
import * as actions from '../actions/marktext'
import { t } from '../../i18n'

// macOS only menu.

export default function(keybindings) {
  return {
    label: t('menu.marktext.title'),
    submenu: [{
      label: t('menu.marktext.about'),
      click(menuItem, focusedWindow) {
        showAboutDialog(focusedWindow)
      }
    }, {
      label: t('menu.marktext.checkUpdates'),
      click(menuItem, focusedWindow) {
        actions.checkUpdates(focusedWindow)
      }
    }, {
      label: t('menu.marktext.preferences'),
      accelerator: keybindings.getAccelerator('file.preferences'),
      click() {
        actions.userSetting()
      }
    }, {
      type: 'separator'
    }, {
      label: t('menu.marktext.services'),
      role: 'services',
      submenu: []
    }, {
      type: 'separator'
    }, {
      label: t('menu.marktext.hide'),
      accelerator: keybindings.getAccelerator('mt.hide'),
      click() {
        actions.osxHide()
      }
    }, {
      label: t('menu.marktext.hideOthers'),
      accelerator: keybindings.getAccelerator('mt.hide-others'),
      click() {
        actions.osxHideAll()
      }
    }, {
      label: t('menu.marktext.showAll'),
      click() {
        actions.osxShowAll()
      }
    }, {
      type: 'separator'
    }, {
      label: t('menu.marktext.quit'),
      accelerator: keybindings.getAccelerator('file.quit'),
      click: app.quit
    }]
  }
}
