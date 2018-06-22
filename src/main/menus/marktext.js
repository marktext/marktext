import { app } from 'electron'
import { showAboutDialog } from '../actions/help'
import * as actions from '../actions/marktext'

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
    accelerator: 'Cmd+,',
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
    accelerator: 'Command+H',
    role: 'hide'
  }, {
    label: 'Hide Others',
    accelerator: 'Command+Alt+H',
    role: 'hideothers'
  }, {
    label: 'Show All',
    role: 'unhide'
  }, {
    type: 'separator'
  }, {
    label: 'Quit Mark Text',
    accelerator: 'Command+Q',
    click: app.quit
  }]
}
