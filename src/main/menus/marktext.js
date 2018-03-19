import * as actions from '../actions/marktext'

export default function markTextMenu ({ app }) {
  return {
    label: 'Mark Text',
    submenu: [{
      label: 'About Mark Text',
      role: 'about'
    }, {
      label: 'Check for updates...',
      click (menuItem, browserWindow) {
        actions.checkUpdates(menuItem, browserWindow)
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
      label: 'Quit',
      accelerator: 'Command+Q',
      click: app.quit
    }]
  }
}
