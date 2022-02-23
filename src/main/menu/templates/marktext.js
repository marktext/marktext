import { app, Menu } from 'electron'
import { showAboutDialog } from '../actions/help'
import * as actions from '../actions/marktext'

// macOS only menu.

export default function (keybindings) {
  return {
    label: 'MarkText',
    submenu: [{
      label: 'About MarkText',
      click (menuItem, browserWindow) {
        showAboutDialog(browserWindow)
      }
    }, {
      label: 'Check for updates...',
      click (menuItem, browserWindow) {
        actions.checkUpdates(browserWindow)
      }
    }, {
      label: 'Preferences',
      accelerator: keybindings.getAccelerator('file.preferences'),
      click () {
        actions.userSetting()
      }
    }, {
      type: 'separator'
    }, {
      label: 'Services',
      role: 'services',
      submenu: []
    }, {
      type: 'separator'
    }, {
      label: 'Hide MarkText',
      accelerator: keybindings.getAccelerator('mt.hide'),
      click () {
        Menu.sendActionToFirstResponder('hide:')
      }
    }, {
      label: 'Hide Others',
      accelerator: keybindings.getAccelerator('mt.hide-others'),
      click () {
        Menu.sendActionToFirstResponder('hideOtherApplications:')
      }
    }, {
      label: 'Show All',
      click () {
        Menu.sendActionToFirstResponder('unhideAllApplications:')
      }
    }, {
      type: 'separator'
    }, {
      label: 'Quit MarkText',
      accelerator: keybindings.getAccelerator('file.quit'),
      click: app.quit
    }]
  }
}
