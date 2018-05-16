import * as actions from '../actions/format'

export default {
  id: 'formatMenuItem',
  label: 'Format',
  submenu: [{
    id: 'strongMenuItem',
    label: 'Strong',
    type: 'checkbox',
    accelerator: 'Shift+CmdOrCtrl+B',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'strong')
    }
  }, {
    id: 'emphasisMenuItem',
    label: 'Emphasis',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+E',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'em')
    }
  }, {
    id: 'inlineCodeMenuItem',
    label: 'Inline Code',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+`',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'inline_code')
    }
  }, {
    type: 'separator'
  }, {
    id: 'strikeMenuItem',
    label: 'Strike',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+D',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'del')
    }
  }, {
    id: 'hyperlinkMenuItem',
    label: 'Hyperlink',
    type: 'checkbox',
    accelerator: 'CmdOrCtrl+L',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'link')
    }
  }, {
    id: 'imageMenuItem',
    label: 'Image',
    type: 'checkbox',
    accelerator: 'Shift+CmdOrCtrl+I',
    click (menuItem, browserWindow) {
      actions.format(browserWindow, 'image')
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
