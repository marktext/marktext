import { toggleAlwaysOnTop, zoomIn, zoomOut } from '../actions/window'
import { isOsx } from '../../config'
import i18n from '../../i18n'

export default function (keybindings) {
  const menu = {
    label: i18n.t('menu.window._title'),
    role: 'window',
    submenu: [{
      label: i18n.t('menu.window.minimize'),
      accelerator: keybindings.getAccelerator('window.minimize'),
      role: 'minimize'
    }, {
      id: 'alwaysOnTopMenuItem',
      label: i18n.t('menu.window.alwaysOnTop'),
      type: 'checkbox',
      click (menuItem, browserWindow) {
        toggleAlwaysOnTop(browserWindow)
      }
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.window.zoomIn'),
      click (menuItem, browserWindow) {
        zoomIn(browserWindow)
      }
    }, {
      label: i18n.t('menu.window.zoomOut'),
      click (menuItem, browserWindow) {
        zoomOut(browserWindow)
      }
    }, {
      type: 'separator'
    }, {
      label: i18n.t('menu.window.fullScreen'),
      accelerator: keybindings.getAccelerator('window.toggle-full-screen'),
      click (item, focusedWindow) {
        if (focusedWindow) {
          focusedWindow.setFullScreen(!focusedWindow.isFullScreen())
        }
      }
    }]
  }

  if (isOsx) {
    menu.submenu.push({
      label: i18n.t('menu.window.bringAllToFront'),
      role: 'front'
    })
  }
  return menu
}
