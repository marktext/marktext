import { Menu } from 'electron'
import { minimizeWindow, toggleAlwaysOnTop, toggleFullScreen } from '../actions/window'
import { zoomIn, zoomOut } from '../../windows/utils'
import { isOsx } from '../../config'
import { t } from '../../i18n'

export default function(keybindings) {
  const menu = {
    label: t('menu.window.title'),
    role: 'window',
    submenu: [{
      label: t('menu.window.minimize'),
      accelerator: keybindings.getAccelerator('window.minimize'),
      click(menuItem, browserWindow) {
        minimizeWindow(browserWindow)
      }
    }, {
      id: 'alwaysOnTopMenuItem',
      label: t('menu.window.alwaysOnTop'),
      type: 'checkbox',
      accelerator: keybindings.getAccelerator('window.toggle-always-on-top'),
      click(menuItem, browserWindow) {
        toggleAlwaysOnTop(browserWindow)
      }
    }, {
      type: 'separator'
    }, {
      label: t('menu.window.zoomIn'),
      accelerator: keybindings.getAccelerator('window.zoomIn'),
      click(menuItem, browserWindow) {
        zoomIn(browserWindow)
      }
    }, {
      label: t('menu.window.zoomOut'),
      accelerator: keybindings.getAccelerator('window.zoomOut'),
      click(menuItem, browserWindow) {
        zoomOut(browserWindow)
      }
    }, {
      type: 'separator'
    }, {
      label: t('menu.window.fullScreen'),
      accelerator: keybindings.getAccelerator('window.toggle-full-screen'),
      click(item, browserWindow) {
        if (browserWindow) {
          toggleFullScreen(browserWindow)
        }
      }
    }]
  }

  if (isOsx) {
    menu.submenu.push({
      label: t('menu.window.bringAllToFront'),
      click() {
        Menu.sendActionToFirstResponder('arrangeInFront:')
      }
    })
  }
  return menu
}
