import { ipcMain } from 'electron'
import * as actions from '../actions/view'
import i18n from '../../i18n'

export default function (keybindings) {
  const viewMenu = {
    label: i18n.t('menu.view._title'),
    submenu: [{
      label: i18n.t('menu.view.commandPalette'),
      accelerator: keybindings.getAccelerator('view.command-palette'),
      click (menuItem, browserWindow) {
        actions.showCommandPalette(browserWindow)
      }
    }, {
      type: 'separator'
    }, {
      id: 'sourceCodeModeMenuItem',
      label: i18n.t('menu.view.srcMode'),
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
      label: i18n.t('menu.view.typewriterMode'),
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
      label: i18n.t('menu.view.focusMode'),
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
      label: i18n.t('menu.view.showSideBar'),
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
      label: i18n.t('menu.view.showTabBar'),
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
      label: i18n.t('menu.view.toggleToc'),
      id: 'tocMenuItem',
      accelerator: keybindings.getAccelerator('view.toggle-toc'),
      click (_, browserWindow) {
        actions.layout(null, browserWindow, 'rightColumn', 'toc')
      }
    }, {
      type: 'separator'
    }]
  }

  if (global.MARKTEXT_DEBUG) {
    viewMenu.submenu.push({
      label: i18n.t('menu.view.showDevTools'),
      accelerator: keybindings.getAccelerator('view.toggle-dev-tools'),
      click (item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.webContents.toggleDevTools()
        }
      }
    })
    viewMenu.submenu.push({
      label: i18n.t('menu.view.reload'),
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
