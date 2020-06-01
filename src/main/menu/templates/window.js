import { toggleAlwaysOnTop, zoomIn, zoomOut } from '../actions/window'
import { isOsx } from '../../config'

export default function (keybindings) {
  const menu = {
    label: '&Window',
    role: 'window',
    submenu: [{
      label: 'Minimize',
      accelerator: keybindings.getAccelerator('window.minimize'),
      role: 'minimize'
    }, {
      id: 'alwaysOnTopMenuItem',
      label: 'Always on Top',
      type: 'checkbox',
      click (menuItem, browserWindow) {
        toggleAlwaysOnTop(browserWindow)
      }
    }, {
      type: 'separator'
    }, {
      label: 'Zoom In',
      click (menuItem, browserWindow) {
        zoomIn(browserWindow)
      }
    }, {
      label: 'Zoom Out',
      click (menuItem, browserWindow) {
        zoomOut(browserWindow)
      }
    }, {
      type: 'separator'
    }, {
      label: 'Show in Full Screen',
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
      label: 'Bring All to Front',
      role: 'front'
    })
  }
  return menu
}
