import { ipcMain } from 'electron'
import * as actions from '../actions/view'

export default function (keybindings) {
  const viewMenu = {
    label: '&View',
    submenu: [{
      label: 'Command Palette...',
      accelerator: keybindings.getAccelerator('view.command-palette'),
      click (menuItem, browserWindow) {
        actions.showCommandPalette(browserWindow)
      }
    }, {
      type: 'separator'
    }, {
      id: 'sourceCodeModeMenuItem',
      label: 'Source Code Mode',
      accelerator: keybindings.getAccelerator('view.source-code-mode'),
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
      accelerator: keybindings.getAccelerator('view.typewriter-mode'),
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
      accelerator: keybindings.getAccelerator('view.focus-mode'),
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
      label: 'Show Sidebar',
      id: 'sideBarMenuItem',
      accelerator: keybindings.getAccelerator('view.toggle-sidebar'),
      type: 'checkbox',
      checked: false,
      click (item, browserWindow, event) {
        // if we call this function, the checked state is not set
        if (!event) {
          item.checked = !item.checked
        }

        actions.layout(item, browserWindow, 'showSideBar')
      }
    }, {
      label: 'Show Tab Bar',
      id: 'tabBarMenuItem',
      accelerator: keybindings.getAccelerator('view.toggle-tabbar'),
      type: 'checkbox',
      checked: false,
      click (item, browserWindow, event) {
        // if we call this function, the checked state is not set
        if (!event) {
          item.checked = !item.checked
        }

        actions.layout(item, browserWindow, 'showTabBar')
      }
    }, {
      label: 'Toggle Table of Contents',
      id: 'tocMenuItem',
      accelerator: keybindings.getAccelerator('view.toggle-toc'),
      click (_, browserWindow) {
        actions.layout(null, browserWindow, 'rightColumn', 'toc')
      }
    }, {
      label: 'Reload Images',
      accelerator: keybindings.getAccelerator('view.reload-images'),
      click (item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.webContents.send('mt::invalidate-image-cache', {})
        }
      }
    }, {
      type: 'separator'
    }]
  }

  if (global.MARKTEXT_DEBUG) {
    viewMenu.submenu.push({
      label: 'Show Developer Tools',
      accelerator: keybindings.getAccelerator('view.toggle-dev-tools'),
      click (item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.webContents.toggleDevTools()
        }
      }
    })
    viewMenu.submenu.push({
      label: 'Reload window',
      accelerator: keybindings.getAccelerator('view.dev-reload'),
      click (item, focusedWindow) {
        if (focusedWindow) {
          ipcMain.emit('window-reload-by-id', focusedWindow.id)
        }
      }
    })
  }

  return viewMenu
}
