import * as actions from '../actions/view'
import { isOsx } from '../config'
import keybindings from '../shortcutHandler'

let viewMenu = {
  label: 'View',
  submenu: [{
    label: 'Toggle Full Screen',
    accelerator: keybindings.get('viewToggleFullScreen'),
    click (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
      }
    }
  }, {
    type: 'separator'
  }, {
    label: 'Font...',
    accelerator: keybindings.get('viewChangeFont'),
    click (item, browserWindow) {
      actions.changeFont(browserWindow)
    }
  }, {
    type: 'separator'
  }, {
    id: 'sourceCodeModeMenuItem',
    label: 'Source Code Mode',
    accelerator: keybindings.get('viewSourceCodeMode'),
    type: 'checkbox',
    checked: false,
    click (item, browserWindow, event) {
      // if we call this function, the checked state is not set
      if (!event) {
        item.checked = !item.checked
      }
      actions.typeMode(browserWindow, 'sourceCode', item)
    }
  }, {
    id: 'typewriterModeMenuItem',
    label: 'Typewriter Mode',
    accelerator: keybindings.get('viewTypewriterMode'),
    type: 'checkbox',
    checked: false,
    click (item, browserWindow, event) {
      // if we call this function, the checked state is not set
      if (!event) {
        item.checked = !item.checked
      }
      actions.typeMode(browserWindow, 'typewriter', item)
    }
  }, {
    id: 'focusModeMenuItem',
    label: 'Focus Mode',
    accelerator: keybindings.get('viewFocusMode'),
    type: 'checkbox',
    checked: false,
    click (item, browserWindow, event) {
      // if we call this function, the checked state is not set
      if (!event) {
        item.checked = !item.checked
      }
      actions.typeMode(browserWindow, 'focus', item)
    }
  }, {
    type: 'separator'
  }, {
    label: 'Toggle Side Bar',
    id: 'sideBarMenuItem',
    accelerator: keybindings.get('viewToggleSideBar'),
    type: 'checkbox',
    checked: false,
    click (item, browserWindow) {
      actions.layout(item, browserWindow, 'showSideBar')
    }
  }, {
    label: 'Toggle Tab Bar',
    id: 'tabBarMenuItem',
    accelerator: keybindings.get('viewToggleTabBar'),
    type: 'checkbox',
    checked: false,
    click (item, browserWindow) {
      actions.layout(item, browserWindow, 'showTabBar')
    }
  }, {
    type: 'separator'
  }]
}

if (global.MARKTEXT_DEBUG) {
  // add devtool when development
  viewMenu.submenu.push({
    label: 'Toggle Developer Tools',
    accelerator: keybindings.get('viewDevToggleDeveloperTools'),
    click (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.webContents.toggleDevTools()
      }
    }
  })
  // add reload when development
  viewMenu.submenu.push({
    label: 'Reload',
    accelerator: keybindings.get('viewDevReload'),
    click (item, focusedWindow) {
      if (focusedWindow) {
        focusedWindow.reload()
      }
    }
  })
}

if (isOsx) {
  viewMenu.submenu.push({
    type: 'separator'
  }, {
    label: 'Bring All to Front',
    role: 'front'
  })
}

export default viewMenu
