import { VIEW_MENU_ITEM } from '../config'
import * as actions from '../actions/view'

let viewMenu = {
  label: 'View',
  submenu: [{
    label: 'Toggle Full Screen',
    accelerator: (function () {
      if (process.platform === 'darwin') {
        return 'Ctrl+Command+F'
      } else {
        return 'F11'
      }
    })(),
    click: function (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
      }
    }
  }, {
    type: 'separator'
  }, {
    label: 'Font...',
    accelerator: 'CmdOrCtrl+.',
    click (item, browserWindow) {
      actions.changeFont(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    id: 'sourceCodeModeMenuItem',
    label: 'Source Code Mode',
    accelerator: 'CmdOrCtrl+U',
    type: 'checkbox',
    checked: VIEW_MENU_ITEM['Source Code Mode'],
    click (item, browserWindow) {
      actions.typeMode(browserWindow, item, 'sourceCode')
    }
  }, {
    id: 'typewriterModeMenuItem',
    label: 'Typewriter Mode',
    accelerator: 'Shift+CmdOrCtrl+T',
    type: 'checkbox',
    checked: VIEW_MENU_ITEM['Typewriter Mode'],
    click (item, browserWindow) {
      actions.typeMode(browserWindow, item, 'typewriter')
    }
  }, {
    id: 'focusModeMenuItem',
    label: 'Focus Mode',
    accelerator: 'Shift+CmdOrCtrl+F',
    type: 'checkbox',
    checked: VIEW_MENU_ITEM['Focus Mode'],
    click (item, browserWindow) {
      actions.typeMode(browserWindow, item, 'focus')
    }
  }, {
    type: 'separator'
  }]
}

if (process.env.NODE_ENV !== 'production' || process.env.NODE_ENV === 'development') {
  // add devtool when development
  viewMenu.submenu.push({
    label: 'Toggle Developer Tools',
    accelerator: (function () {
      if (process.platform === 'darwin') {
        return 'Alt+Command+I'
      } else {
        return 'Ctrl+Shift+I'
      }
    })(),
    click: function (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.webContents.toggleDevTools()
      }
    }
  })
  // add reload when development
  viewMenu.submenu.push({
    label: 'Reload',
    accelerator: 'CmdOrCtrl+R',
    click: function (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.reload()
      }
    }
  })
}

if (process.platform === 'darwin') {
  viewMenu.submenu.push({
    type: 'separator'
  }, {
    label: 'Bring All to Front',
    role: 'front'
  })
}

export default viewMenu
