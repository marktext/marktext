import * as actions from '../actions/format'

export default {
  label: 'Format',
  submenu: [{
    label: 'Strong',
    accelerator: 'Shift+CmdOrCtrl+B',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'strong')
    }
  }, {
    label: 'Emphasis',
    accelerator: 'CmdOrCtrl+E',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'em')
    }
  }, {
    label: 'Inline Code',
    accelerator: 'CmdOrCtrl+`',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'code')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Strike',
    accelerator: 'CmdOrCtrl+D',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'del')
    }
  }, {
    label: 'Hyperlink',
    accelerator: 'CmdOrCtrl+L',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'a')
    }
  }, {
    label: 'Image',
    accelerator: 'Shift+CmdOrCtrl+I',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'img')
    }
  }, {
    type: 'separator'
  }, {
    label: 'Clear Format',
    accelerator: 'Shift+CmdOrCtrl+R',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'clear')
    }
  }]
}
