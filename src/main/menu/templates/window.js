import { toggleAlwaysOnTop } from '../actions/window'

export default function (keybindings) {
  return {
    label: 'Window',
    role: 'window',
    submenu: [{
      label: 'Minimize',
      accelerator: keybindings.getAccelerator('windowMinimize'),
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
      label: 'Close Window',
      accelerator: keybindings.getAccelerator('windowCloseWindow'),
      role: 'close'
    }]
  }
}
