import { app } from 'electron'
import { showAboutDialog } from '../actions/help'
import * as actions from '../actions/marktext'
import keybindings from '../shortcutHandler'

export default {
  label: 'Mark Text',
  submenu: [{
    label: 'About Mark Text',
    click (menuItem, browserWindow) {
      showAboutDialog(browserWindow)
    }
  }, {
    label: 'Check for updates...',
    click (menuItem, browserWindow) {
      actions.checkUpdates(menuItem, browserWindow)
    }
  }, {
    label: 'Preferences',
    accelerator: keybindings.getAccelerator('filePreferences'),
    click (menuItem, browserWindow) {
      actions.userSetting(menuItem, browserWindow)
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
    label: 'Hide Mark Text',
    accelerator: keybindings.getAccelerator('mtHide'),
    role: 'hide'
  }, {
    label: 'Hide Others',
    accelerator: keybindings.getAccelerator('mtHideOthers'),
    role: 'hideothers'
  }, {
    label: 'Show All',
    role: 'unhide'
  }, {
    type: 'separator'
  }, {
    label: 'Quit Mark Text',
    accelerator: keybindings.getAccelerator('fileQuit'),
    click: app.quit
  }]
}
